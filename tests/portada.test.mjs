import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CONTACTO, CONTACTO_ASUNTO, PORTADA } from '../js/config.js';
import { enlaceContacto } from '../js/contacto.js';

const RAIZ = new URL('../', import.meta.url);
const lee = (ruta) => readFileSync(new URL(ruta, RAIZ), 'utf8');

// Lo que la portada no puede decir, ni siquiera para negarlo.
const PROHIBIDO = [
  /fraude/i,
  /alerta/i,
  /irregularidad/i,
  /\bIA\b/,
  /inteligencia artificial/i,
  /lectura autom[aá]tica/i,
  /tiempo real/i,
  /24 ?h/i,
  /\bfirm/i,
  /asesor/i,
  /jur[ií]dic/i,
  /partido/i,
  /testimoni/i,
  /precio|tarifa|€|\beuros?\b/i,
  /\d\s?%/,
  /whitemoon/i,
];

test('la portada y config.js no contienen nada de la lista prohibida', () => {
  const hallazgos = [];
  for (const ruta of ['portada.html', 'js/config.js', 'js/portada.js']) {
    lee(ruta)
      .split('\n')
      // Unica excepcion: el valor de CONTACTO, que es el correo comercial.
      .map((linea) => (linea.startsWith('export const CONTACTO = ') ? '' : linea))
      .forEach((linea, i) => {
        for (const patron of PROHIBIDO) {
          if (patron.test(linea)) hallazgos.push(`${ruta}:${i + 1} ${patron} -> ${linea.trim()}`);
        }
      });
  }
  assert.deepEqual(hallazgos, []);
});

test('la lista prohibida detecta lo que tiene que detectar', () => {
  const salta = (frase) => PROHIBIDO.some((patron) => patron.test(frase));
  for (const frase of [
    'contra el fraude',
    'alerta de irregularidad',
    'la IA hace el resto',
    'en tiempo real',
    'verifica firmas',
    'listo en 24 h',
    'asesor jurídico',
    'un 30% más',
    'desde 99 euros',
    'WhiteMoon',
  ]) {
    assert.ok(salta(frase), frase);
  }
  for (const frase of ['Doble confirmación', 'una segunda persona que las confirma', 'mesas confirmadas']) {
    assert.ok(!salta(frase), frase);
  }
});

test('la portada tiene las seis partes del encargo', () => {
  assert.equal(PORTADA.hero.titulo, 'Control de actas para interventores y apoderados');
  assert.equal(PORTADA.hero.ctaDemo, 'Probar la demo');
  assert.equal(PORTADA.hero.ctaContacto, 'Solicitar demo:');
  assert.equal(PORTADA.pasos.items.length, 3);
  assert.equal(PORTADA.ofrece.items.length, 7);
  assert.equal(PORTADA.noHace.items.length, 4);
  assert.ok(PORTADA.privacidad.items.length >= 2);
  assert.match(PORTADA.pie, /datos ficticios/);
});

test('portada.js no lleva textos propios', () => {
  const cadenas = lee('js/portada.js').match(/'[^']*'|`[^`]*`/g) ?? [];
  // Una lista de clases CSS tiene una o dos palabras; una frase, tres o mas.
  const frases = cadenas.filter((cadena) => /\S+\s+\S+\s+\S+/.test(cadena) && !cadena.includes('${'));
  assert.deepEqual(frases, []);
});

test('sin contacto no hay enlace', () => {
  assert.equal(enlaceContacto(''), null);
  assert.equal(enlaceContacto('   '), null);
  assert.equal(enlaceContacto(undefined), null);
});

test('el contacto configurado es un correo y se abre con el asunto prellenado', () => {
  assert.match(CONTACTO, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.equal(CONTACTO_ASUNTO, 'ACTAMOON: consulta');
  assert.equal(enlaceContacto(CONTACTO, CONTACTO_ASUNTO), `mailto:${CONTACTO}?subject=ACTAMOON%3A%20consulta`);
});

test('el contacto solo esta escrito en la constante CONTACTO', () => {
  const sitios = [];
  const visita = (dir) => {
    for (const entrada of readdirSync(new URL(dir, RAIZ), { withFileTypes: true })) {
      if (['.git', 'node_modules'].includes(entrada.name)) continue;
      const ruta = dir + entrada.name;
      if (entrada.isDirectory()) visita(ruta + '/');
      else if (/\.(html|js|mjs|css|svg|md|py|json|webmanifest)$/.test(entrada.name)) {
        lee(ruta)
          .split('\n')
          .forEach((linea, i) => {
            if (linea.toLowerCase().includes(CONTACTO.toLowerCase())) sitios.push(`${ruta}:${i + 1}`);
          });
      }
    }
  };
  visita('');
  assert.equal(sitios.length, 1, sitios.join(', '));
  assert.match(sitios[0], /^js\/config\.js:\d+$/);
});

test('un correo abre mailto y un telefono abre WhatsApp', () => {
  assert.equal(enlaceContacto('demo@example.org'), 'mailto:demo@example.org');
  assert.equal(enlaceContacto(' demo@example.org '), 'mailto:demo@example.org');
  assert.equal(enlaceContacto('demo@example.org', 'Hola & adiós'), 'mailto:demo@example.org?subject=Hola%20%26%20adi%C3%B3s');
  assert.equal(enlaceContacto('+00 000 000 000'), 'https://wa.me/00000000000');
  assert.equal(enlaceContacto('00000000000'), 'https://wa.me/00000000000');
});

test('un contacto que no se reconoce no genera enlace', () => {
  for (const valor of ['hola', '12345', 'demo@', 'javascript:alert(1)', 'https://example.org']) {
    assert.equal(enlaceContacto(valor), null, valor);
  }
});
