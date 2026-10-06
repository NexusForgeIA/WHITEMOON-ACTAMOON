// Escribe en sw.js la lista de archivos que se guardan para usar la demo sin
// conexion (PRECACHE) y la version de esa lista (VERSION): los 12 primeros
// caracteres del SHA-256 de todos esos archivos. Si cambia un byte de la app,
// cambia la version, y el navegador instala el Service Worker nuevo.
//
// Uso:  node scripts/version-sw.mjs      (y se confirma el sw.js que deja)
// tests/offline.test.mjs falla si sw.js no esta al dia.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = new URL('../', import.meta.url);
const SUELTOS = ['index.html', 'portada.html', 'manifest.webmanifest'];
// carpeta -> extensiones que se guardan (null: todas).
const CARPETAS = {
  'assets/css/': ['.css'],
  'assets/fonts/': ['.woff2'],
  'assets/icons/': null,
  'assets/img/': null,
  'js/': ['.js'],
};
const BINARIOS = /\.(png|woff2)$/;

function lista(carpeta, extensiones) {
  return readdirSync(new URL(carpeta, RAIZ), { withFileTypes: true }).flatMap((entrada) => {
    if (entrada.isDirectory()) return lista(`${carpeta}${entrada.name}/`, extensiones);
    return !extensiones || extensiones.some((ext) => entrada.name.endsWith(ext)) ? [carpeta + entrada.name] : [];
  });
}

// Lo que sw.js deberia llevar segun los archivos que hay ahora mismo.
export function calcula() {
  const archivos = [...SUELTOS, ...Object.entries(CARPETAS).flatMap(([carpeta, ext]) => lista(carpeta, ext))].sort();
  const resumen = createHash('sha256');
  for (const ruta of archivos) {
    const bytes = readFileSync(new URL(ruta, RAIZ));
    // Los saltos de linea se igualan para que la version no dependa de como
    // haya dejado git los archivos de texto en cada sistema.
    const contenido = BINARIOS.test(ruta) ? bytes : bytes.toString('utf8').replaceAll('\r\n', '\n');
    resumen.update(`${ruta}\0`).update(contenido).update('\0');
  }
  // "./" es la propia carpeta: asi la app abre sin escribir index.html.
  return { version: resumen.digest('hex').slice(0, 12), precache: ['./', ...archivos] };
}

// Lo que sw.js lleva escrito.
export function lee() {
  const sw = readFileSync(new URL('sw.js', RAIZ), 'utf8').replaceAll('\r\n', '\n');
  return {
    version: /^const VERSION = "([0-9a-f]{12})";$/m.exec(sw)?.[1],
    precache: JSON.parse(/^const PRECACHE = (\[[^;]*\]);$/m.exec(sw)?.[1] ?? 'null'),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { version, precache } = calcula();
  const ruta = new URL('sw.js', RAIZ);
  // Se compara sin contar los saltos de linea, que git puede haber cambiado.
  const antes = readFileSync(ruta, 'utf8').replaceAll('\r\n', '\n');
  const despues = antes
    .replace(/^const VERSION = "[0-9a-f]{12}";$/m, `const VERSION = "${version}";`)
    .replace(/^const PRECACHE = \[[^;]*\];$/m, `const PRECACHE = ${JSON.stringify(precache, null, 2)};`);
  if (despues === antes) {
    console.log(`sw.js ya estaba al dia (version ${version}, ${precache.length} archivos)`);
  } else {
    writeFileSync(ruta, despues);
    console.log(`sw.js actualizado: version ${version}, ${precache.length} archivos`);
  }
}
