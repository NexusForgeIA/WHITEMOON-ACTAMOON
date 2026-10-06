import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

import { calcula, lee } from '../scripts/version-sw.mjs';

const RAIZ = new URL('../', import.meta.url);
const texto = (ruta) => readFileSync(new URL(ruta, RAIZ), 'utf8');
const sw = texto('sw.js');

test('sw.js esta al dia: su lista y su version corresponden a los archivos actuales', () => {
  const esperado = calcula();
  const escrito = lee();
  assert.deepEqual(escrito.precache, esperado.precache, 'la lista no esta al dia: ejecuta node scripts/version-sw.mjs');
  assert.equal(escrito.version, esperado.version, 'la version no esta al dia: ejecuta node scripts/version-sw.mjs');
});

test('la lista guarda lo necesario para abrir la app y la portada sin conexion', () => {
  const { precache } = lee();
  for (const ruta of [
    './',
    'index.html',
    'portada.html',
    'manifest.webmanifest',
    'assets/css/tokens.css',
    'assets/css/app.css',
    'assets/css/portada.css',
    'assets/img/actamoon-logo.svg',
    'assets/img/actamoon-logo-oscuro.svg',
    'assets/icons/actamoon-favicon.svg',
    'assets/icons/apple-touch-icon.png',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'js/app.js',
    'js/portada.js',
    'js/offline.js',
    'js/pdf.js',
  ]) {
    assert.ok(precache.includes(ruta), `falta ${ruta}`);
  }
  // Todo el JavaScript, todas las hojas de estilo y todas las fuentes.
  const enDisco = (carpeta, ext) => readdirSync(new URL(carpeta, RAIZ), { recursive: true }).map((f) => `${carpeta}${String(f).replaceAll('\\', '/')}`).filter((f) => f.endsWith(ext));
  for (const ruta of [...enDisco('js/', '.js'), ...enDisco('assets/css/', '.css'), ...enDisco('assets/fonts/', '.woff2')]) {
    assert.ok(precache.includes(ruta), `falta ${ruta}`);
  }
  assert.equal(new Set(precache).size, precache.length, 'sin repetidos');
  for (const ruta of precache.slice(1)) assert.ok(existsSync(new URL(ruta, RAIZ)), `${ruta} no existe`);
  assert.ok(!precache.some((ruta) => /^(tests|scripts)\/|README|LICENSE|sw\.js/.test(ruta)), 'ni tests, ni scripts, ni el propio sw.js');
});

test('todas las rutas son relativas: la demo se sirve bajo una subcarpeta', () => {
  const relativa = (ruta) => !/^([a-z]+:|\/)/i.test(ruta) && !ruta.includes('..');
  for (const ruta of lee().precache) assert.ok(relativa(ruta), `ruta no relativa en sw.js: ${ruta}`);

  const manifest = JSON.parse(texto('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icono of manifest.icons) assert.ok(relativa(icono.src), icono.src);

  for (const pagina of ['index.html', 'portada.html']) {
    const html = texto(pagina);
    const referencias = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('#'));
    assert.ok(referencias.length > 10);
    for (const ref of referencias) assert.ok(relativa(ref), `${pagina}: ${ref}`);
    assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/, pagina);
  }
  assert.match(texto('js/offline.js'), /serviceWorker\.register\('sw\.js'\)/, 'el registro tambien es relativo');
  assert.match(sw, /const RAIZ = new URL\('\.\/', self\.location\.href\);/);
});

test('con otra carpeta base, las rutas del Service Worker se resuelven dentro de ella', () => {
  const base = 'https://ejemplo.test/WHITEMOON-ACTAMOON/';
  const rutas = lee().precache.map((ruta) => new URL(ruta, base).pathname);
  assert.ok(rutas.every((ruta) => ruta.startsWith('/WHITEMOON-ACTAMOON/')));
  assert.ok(rutas.includes('/WHITEMOON-ACTAMOON/') && rutas.includes('/WHITEMOON-ACTAMOON/js/app.js'));
});

test('los iconos del manifest existen y miden lo que declaran', () => {
  const manifest = JSON.parse(texto('manifest.webmanifest'));
  assert.deepEqual(manifest.icons.map((i) => i.sizes), ['192x192', '512x512']);
  for (const icono of manifest.icons) {
    const png = readFileSync(new URL(icono.src, RAIZ));
    assert.equal(png.subarray(1, 4).toString(), 'PNG', icono.src);
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icono.sizes, icono.src);
    assert.equal(icono.type, 'image/png');
  }
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.description, /datos ficticios/);
});

test('la cache lleva la version en el nombre y al activarse borra las anteriores', () => {
  assert.match(sw, /const CACHE = PREFIJO \+ VERSION;/);
  assert.match(sw, /nombre\.startsWith\(PREFIJO\) && nombre !== CACHE\)\.map\(\(nombre\) => caches\.delete\(nombre\)\)/);
});

test('la version nueva no se impone: solo se activa cuando la pagina lo pide', () => {
  assert.equal(sw.split('skipWaiting(').length - 1, 1, 'una sola llamada a skipWaiting');
  assert.match(sw, /addEventListener\('message', \(event\) => \{\s*if \(event\.data === 'activar'\) self\.skipWaiting\(\);/);
  const offline = texto('js/offline.js');
  assert.equal(offline.split('location.reload(').length - 1, 1);
  assert.match(offline, /if \(pedida\) location\.reload\(\);/, 'solo se recarga si se ha pulsado Actualizar');
});

test('el Service Worker solo atiende GET de su origen que esten en la lista', () => {
  assert.match(sw, /if \(event\.request\.method !== 'GET' \|\| url\.origin !== self\.location\.origin \|\| !RUTAS\.has\(url\.pathname\)\) return;/);
  assert.ok(!/https?:\/\//.test(sw), 'sw.js no nombra ninguna URL externa');
});
