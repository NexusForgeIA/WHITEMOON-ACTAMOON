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

// Espacios de nombres XML: son identificadores, el navegador no los descarga.
const PERMITIDAS = new Set(['http://www.w3.org/2000/svg']);

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

const html = () => codigo.find((archivo) => archivo.nombre === 'index.html').texto;

test('hay codigo que revisar', () => {
  const nombres = codigo.map((archivo) => archivo.nombre);
  for (const esperado of ['index.html', 'js/app.js', 'js/db.js', 'assets/css/app.css']) {
    assert.ok(nombres.includes(esperado), `falta ${esperado}`);
  }
});

test('el codigo no usa APIs de red', () => {
  const hallazgos = [];
  for (const { nombre, texto } of codigo) {
    texto.split('\n').forEach((linea, i) => {
      for (const [api, patron] of APIS) {
        if (patron.test(linea)) hallazgos.push(`${nombre}:${i + 1} usa ${api}`);
      }
    });
  }
  assert.deepEqual(hallazgos, []);
});

test('el codigo no contiene URL externas', () => {
  const hallazgos = [];
  for (const { nombre, texto } of codigo) {
    texto.split('\n').forEach((linea, i) => {
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

test('index.html lleva una CSP que solo permite el propio origen', () => {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html())?.[1];
  assert.ok(csp, 'falta la CSP');
  const directivas = Object.fromEntries(
    csp
      .split(';')
      .map((directiva) => directiva.trim().split(/\s+/))
      .map(([nombre, ...valores]) => [nombre, valores]),
  );
  assert.deepEqual(directivas['default-src'], ["'self'"]);
  assert.deepEqual(directivas['object-src'], ["'none'"]);
  for (const [nombre, valores] of Object.entries(directivas)) {
    for (const valor of valores) {
      assert.ok(["'self'", "'none'", 'blob:', 'data:'].includes(valor), `${nombre} permite ${valor}`);
    }
  }
});

test('index.html pide no indexar', () => {
  assert.match(html(), /<meta name="robots" content="noindex, nofollow">/);
});
