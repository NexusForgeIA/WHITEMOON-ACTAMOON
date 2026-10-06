import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CONFIG } from '../js/config.js';
import { datosEjemplo } from '../js/datos-ejemplo.js';
import { abreBorrador, cambiaActivo, creaPerfil, guardaMesa } from '../js/gestion.js';
import { arranque, navegacion, perfilVigente, puedeVer, resuelve, rutaInicial } from '../js/permisos.js';

const { colegios, mesas, perfiles } = datosEjemplo();
const perfil = (id) => perfiles.find((p) => p.id === id);
// Los saltos de linea se igualan: git puede dejar CRLF en Windows.
const texto = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

// ---- Los casos de arranque ---------------------------------------------------

test('primera visita, sin datos: la bienvenida', () => {
  assert.deepEqual(arranque([], null), { vista: 'bienvenida' });
});

test('con datos y sin perfil: el selector, no una pantalla vacia', () => {
  assert.deepEqual(arranque(perfiles, null), { vista: 'selector' });
  assert.deepEqual(arranque(perfiles, undefined), { vista: 'selector' });
});

test('con perfil elegido: entra directo en su pantalla de inicio', () => {
  assert.deepEqual(arranque(perfiles, perfil('administrador')), { ir: '#/panel' });
  assert.deepEqual(arranque(perfiles, perfil('apoderado-1')), { ir: '#/mesas' });
  assert.deepEqual(arranque(perfiles, perfil('interventor-3')), { ir: '#/mesa/mesa-003' });
});

test('perfil guardado que se desactivo despues: vuelve al selector', () => {
  const b = abreBorrador({ colegios, mesas, perfiles, actas: [], reclamaciones: [] });
  cambiaActivo(b, 'perfil', 'interventor-3', false);
  // El identificador guardado sigue siendo el suyo, pero ya no vale.
  assert.equal(perfilVigente(b.perfiles, 'interventor-3'), null);
  assert.deepEqual(arranque(b.perfiles, perfilVigente(b.perfiles, 'interventor-3')), { vista: 'selector' });
  // Y aunque llegara el perfil desactivado tal cual, tampoco entra.
  assert.deepEqual(arranque(b.perfiles, b.perfiles.find((p) => p.id === 'interventor-3')), { vista: 'selector' });
  // Reactivado, vuelve a entrar directo.
  cambiaActivo(b, 'perfil', 'interventor-3', true);
  assert.deepEqual(arranque(b.perfiles, perfilVigente(b.perfiles, 'interventor-3')), { ir: '#/mesa/mesa-003' });
});

test('perfilVigente: el guardado solo vale si existe y esta en uso', () => {
  assert.equal(perfilVigente(perfiles, 'apoderado-1'), perfil('apoderado-1'));
  assert.equal(perfilVigente(perfiles, 'no-existe'), null);
  assert.equal(perfilVigente(perfiles, undefined), null);
  assert.equal(perfilVigente([], 'administrador'), null, 'tras reiniciar la demo no queda perfil');
});

test('cada perfil aterriza en una pantalla que puede ver', () => {
  const b = abreBorrador({ colegios, mesas, perfiles, actas: [], reclamaciones: [] });
  const nuevoId = creaPerfil(b, 'interventor', 'Interventor');
  const sinMesa = b.perfiles.find((p) => p.id === nuevoId);
  guardaMesa(b, { id: 'mesa-001', nombre: 'Mesa 001', colegioId: 'colegio-1', interventorId: null });
  for (const p of b.perfiles) {
    const destino = resuelve(rutaInicial(p));
    assert.ok(destino, `${p.id} -> ${rutaInicial(p)}`);
    assert.equal(puedeVer(p, destino.ruta), true, p.id);
  }
  assert.equal(rutaInicial(sinMesa), '#/mesas', 'un interventor sin mesa cae en la lista');
  assert.equal(rutaInicial(perfil('administrador')), '#/panel');
});

// ---- Rutas y navegacion ------------------------------------------------------

test('el arranque y el selector son publicos; el selector es la pestana "Perfil"', () => {
  assert.equal(resuelve('').ruta.id, 'inicio');
  assert.equal(resuelve('#/').ruta.id, 'inicio');
  assert.equal(resuelve('#/perfil').ruta.id, 'perfil');
  assert.equal(puedeVer(null, resuelve('#/').ruta), true);
  assert.equal(puedeVer(null, resuelve('#/perfil').ruta), true);
  assert.deepEqual(navegacion(null).map((d) => [d.id, d.href]), [['perfil', '#/perfil'], ['ayuda', '#/ayuda']]);
  assert.equal(navegacion(perfil('interventor-1'))[0].href, '#/perfil');
  // El administrador tiene cinco pestanas: la de perfil cede el sitio, y cambia desde la cabecera.
  assert.ok(!navegacion(perfil('administrador')).some((d) => d.id === 'perfil'));
});

// ---- Textos y marcado --------------------------------------------------------

test('la entrada dice lo acordado y solo describe lo que cada rol puede hacer', () => {
  const E = CONFIG.entrada;
  assert.equal(E.frase, 'Control de actas por mesa, con rastro.');
  assert.equal(E.probar, 'Probar la demo');
  assert.deepEqual(Object.keys(E.roles), ['interventor', 'apoderado', 'administrador']);
  assert.equal(E.roles.interventor.linea, 'Captura y corrige actas de su mesa.');
  assert.equal(E.roles.apoderado.linea, 'Valida o devuelve las de su colegio.');
  assert.equal(E.roles.administrador.linea, 'Panel, actividad y auditoría.');
  assert.equal(E.elegir(1), '1 perfil');
  assert.equal(E.elegir(6), '6 perfiles');
});

test('index.html lleva los dos avisos del banner y el enlace de cambiar de perfil', () => {
  const html = texto('index.html');
  assert.match(html, /<span id="banner-app"><strong>Demo de presentación con datos ficticios\.<\/strong> No es un sistema oficial ni publica resultados\.<\/span>/);
  assert.match(html, /<span id="banner-entrada" hidden><strong>Demo con datos ficticios\.<\/strong> No uses actas reales\.<\/span>/);
  assert.match(html, /<a class="cabecera__perfil" id="perfil-activo" href="#\/perfil" hidden><\/a>/);
});

test('la app instalada arranca en la pantalla de entrada', () => {
  const manifest = JSON.parse(texto('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(resuelve(new URL(manifest.start_url, 'https://ejemplo.test/WHITEMOON-ACTAMOON/').hash).ruta.id, 'inicio');
});

test('la animacion de entrada solo existe si no se ha pedido menos movimiento', () => {
  const css = texto('assets/css/app.css');
  const conMovimiento = /@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?animation: entra/.test(css);
  assert.ok(conMovimiento, 'la animacion va dentro de no-preference');
  const fuera = css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}\n/, '');
  assert.ok(!/animation: entra/.test(fuera), 'no hay animacion fuera de ese bloque');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\* \{\s*transition: none !important;\s*animation: none !important;/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
