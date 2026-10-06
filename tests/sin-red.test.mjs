// La demo no habla con nadie. Este test falla si el codigo de la app contiene
// una API de red o una URL externa; la CSP de index.html es la segunda barrera.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const EXTENSIONES = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.json', '.webmanifest']);
const IGNORADOS = new Set(['.git', 'node_modules', 'tests', 'scripts']);

const APIS = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['importScripts', /\bimportScripts\b/],
];

// Cualquier esquema de red, y las URL sin esquema del tipo //host/ruta.
const URL_EXTERNA = /\b(?:https?|wss?|ftp):\/\/[^\s"'`)<>]+|(?<=["'(=]\s*)\/\/[\w.-]+\.[a-z]{2,}[^\s"'`)<>]*/gi;

// Unica llamada a fetch admitida: el Service Worker repitiendo, tal cual, la
// peticion que le llega del navegador cuando no la tiene en cache. No puede
// pedir otra URL ni salir del origen (el propio sw.js filtra antes por origen).
const FETCH_PERMITIDO = { archivo: 'sw.js', codigo: 'fetch(event.request)' };

const PERMITIDAS = new Set([
  // Espacio de nombres XML: es un identificador, el navegador no lo descarga.
  'http://www.w3.org/2000/svg',
  // Enlace de salida del boton "Solicitar demo" de la portada. La pagina no lo
  // carga: solo se abre si el visitante lo pulsa, y solo si CONTACTO es un telefono.
  'https://wa.me/',
]);

// Etiquetas de vista previa (WhatsApp y redes): tienen que llevar la direccion
// publica completa. La pagina no la pide: la lee quien comparte el enlace.
// Solo valen en estas tres etiquetas de los HTML y solo hacia la propia demo.
const PUBLICA = 'https://nexusforgeia.github.io/WHITEMOON-ACTAMOON/';
const VISTA_PREVIA = /^\s*<meta (?:property="og:(?:url|image)"|name="twitter:image") content="([^"]+)">\s*$/;
const esVistaPrevia = (nombre, linea) => nombre.endsWith('.html') && (VISTA_PREVIA.exec(linea)?.[1] ?? '').startsWith(PUBLICA);

function archivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    if (IGNORADOS.has(entrada.name)) return [];
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(ruta);
    return EXTENSIONES.has(extname(entrada.name)) ? [ruta] : [];
  });
}

const codigo = archivos(RAIZ).map((ruta) => ({
  nombre: relative(RAIZ, ruta).replaceAll('\\', '/'),
  texto: readFileSync(ruta, 'utf8'),
}));

const paginas = codigo.filter((archivo) => archivo.nombre.endsWith('.html'));

test('hay codigo que revisar', () => {
  const nombres = codigo.map((archivo) => archivo.nombre);
  for (const esperado of ['index.html', 'portada.html', 'sw.js', 'manifest.webmanifest', 'js/app.js', 'js/db.js', 'js/offline.js', 'js/portada.js', 'assets/css/app.css']) {
    assert.ok(nombres.includes(esperado), `falta ${esperado}`);
  }
});

test('el codigo no usa APIs de red', () => {
  const hallazgos = [];
  for (const { nombre, texto } of codigo) {
    texto.split('\n').forEach((linea, i) => {
      const revisada = nombre === FETCH_PERMITIDO.archivo ? linea.replace(FETCH_PERMITIDO.codigo, '') : linea;
      for (const [api, patron] of APIS) {
        if (patron.test(revisada)) hallazgos.push(`${nombre}:${i + 1} usa ${api}`);
      }
    });
  }
  assert.deepEqual(hallazgos, []);
});

test('la excepcion de fetch es una sola linea de sw.js, y sw.js solo atiende su origen', () => {
  const sw = codigo.find((archivo) => archivo.nombre === 'sw.js').texto;
  assert.equal(sw.split('fetch(').length - 1, 1, 'una sola llamada a fetch en sw.js');
  assert.ok(sw.includes(FETCH_PERMITIDO.codigo));
  assert.match(sw, /url\.origin !== self\.location\.origin[^\n]*\) return;/, 'lo que no es del propio origen no se toca');
  for (const { nombre, texto } of codigo) {
    if (nombre !== 'sw.js') assert.ok(!/\bfetch\s*\(/.test(texto), `${nombre} no puede llamar a fetch`);
  }
});

test('el codigo no contiene URL externas', () => {
  const hallazgos = [];
  for (const { nombre, texto } of codigo) {
    texto.split('\n').forEach((linea, i) => {
      if (esVistaPrevia(nombre, linea)) return;
      for (const url of linea.match(URL_EXTERNA) ?? []) {
        if (!PERMITIDAS.has(url)) hallazgos.push(`${nombre}:${i + 1} ${url}`);
      }
    });
  }
  assert.deepEqual(hallazgos, []);
});

test('los detectores detectan', () => {
  const usaApi = (muestra) => APIS.some(([, patron]) => patron.test(muestra));
  const urls = (muestra) => muestra.match(URL_EXTERNA) ?? [];

  for (const muestra of [
    'fetch("/datos")',
    'await fetch (url)',
    'new XMLHttpRequest()',
    'navigator.sendBeacon(u)',
    'new WebSocket(u)',
  ]) {
    assert.ok(usaApi(muestra), muestra);
  }
  for (const muestra of ['src="https://cdn.example/x.js"', "url('//fonts.example.com/a.css')", 'wss://x.example/s']) {
    assert.equal(urls(muestra).length, 1, muestra);
  }
  for (const muestra of ["addEventListener('fetch', manejador)", 'href="#/ayuda"', '// comentario', 'a / b // c.d']) {
    assert.ok(!usaApi(muestra), muestra);
    assert.equal(urls(muestra).length, 0, muestra);
  }
});

test('cada pagina lleva una CSP que solo permite el propio origen', () => {
  for (const { nombre, texto } of paginas) {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(texto)?.[1];
    assert.ok(csp, `${nombre}: falta la CSP`);
    const directivas = Object.fromEntries(
      csp
        .split(';')
        .map((directiva) => directiva.trim().split(/\s+/))
        .map(([directiva, ...valores]) => [directiva, valores]),
    );
    assert.deepEqual(directivas['default-src'], ["'self'"], nombre);
    assert.deepEqual(directivas['object-src'], ["'none'"], nombre);
    for (const [directiva, valores] of Object.entries(directivas)) {
      for (const valor of valores) {
        assert.ok(["'self'", "'none'", 'blob:', 'data:'].includes(valor), `${nombre}: ${directiva} permite ${valor}`);
      }
    }
  }
});

test('la vista previa al compartir: etiquetas completas, con direcciones absolutas de la propia demo', () => {
  const contenido = (texto, clave) => new RegExp(`<meta (?:property|name)="${clave}" content="([^"]*)">`).exec(texto)?.[1];
  const imagen = `${PUBLICA}assets/img/og.jpg`;
  const titulo = 'ACTAMOON · Control de actas por mesa, con rastro';
  const descripcion = 'Demo de presentación con datos ficticios para interventores y apoderados. No es un sistema oficial.';
  assert.deepEqual(paginas.map((p) => p.nombre).sort(), ['index.html', 'portada.html']);
  for (const { nombre, texto } of paginas) {
    const esperado = {
      'og:type': 'website',
      'og:locale': 'es_ES',
      'og:site_name': 'ACTAMOON',
      'og:title': titulo,
      'og:description': descripcion,
      'og:url': nombre === 'index.html' ? PUBLICA : PUBLICA + nombre,
      'og:image': imagen,
      'og:image:type': 'image/jpeg',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': 'Logo de ACTAMOON y la frase Control de actas por mesa, con rastro.',
      'twitter:card': 'summary_large_image',
      'twitter:title': titulo,
      'twitter:description': descripcion,
      'twitter:image': imagen,
    };
    for (const [clave, valor] of Object.entries(esperado)) assert.equal(contenido(texto, clave), valor, `${nombre}: ${clave}`);
  }
  // La excepcion no abre la puerta a otras direcciones ni a otras etiquetas.
  assert.ok(esVistaPrevia('index.html', `  <meta property="og:image" content="${imagen}">\r`));
  assert.ok(!esVistaPrevia('index.html', '  <meta property="og:image" content="https://otro.example/og.jpg">'));
  assert.ok(!esVistaPrevia('index.html', `  <script src="${PUBLICA}js/app.js"></script>`));
  assert.ok(!esVistaPrevia('js/app.js', `  <meta property="og:image" content="${imagen}">`));
});

test('la imagen de vista previa es un JPEG de 1200x630, ligero y fuera de la cache sin conexion', () => {
  const bytes = readFileSync(join(RAIZ, 'assets/img/og.jpg'));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], 'es un JPEG');
  assert.ok(bytes.length < 300 * 1024, `${bytes.length} bytes`);
  // Cabecera SOF0/SOF2 del JPEG: alto y ancho.
  let i = 2;
  while (i < bytes.length && !(bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2))) i += 2 + bytes.readUInt16BE(i + 2);
  assert.deepEqual([bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)], [1200, 630]);
  const sw = codigo.find((archivo) => archivo.nombre === 'sw.js').texto;
  assert.ok(!sw.includes('og.jpg'), 'no se guarda para usar sin conexion');
});

test('cada pagina pide no indexar', () => {
  for (const { nombre, texto } of paginas) {
    assert.match(texto, /<meta name="robots" content="noindex, nofollow">/, nombre);
  }
});
