// Service Worker de ACTAMOON: deja la demo utilizable sin conexion.
//
// Guarda en cache todos los archivos de la app al instalarse y los sirve
// desde ahi. Solo atiende peticiones GET del propio origen que esten en la
// lista; todo lo demas lo deja pasar sin tocarlo. Las rutas son relativas a
// donde se sirve este archivo, asi que funciona igual en la raiz que bajo una
// subcarpeta (GitHub Pages).
//
// VERSION y PRECACHE los escribe `node scripts/version-sw.mjs`: hay que
// ejecutarlo cada vez que cambie un archivo de la app. Un test falla si no
// estan al dia.

const VERSION = "13e266495ccc";
const PRECACHE = [
  "./",
  "assets/css/app.css",
  "assets/css/portada.css",
  "assets/css/tokens.css",
  "assets/fonts/IBMPlexMono-Regular-Latin1.woff2",
  "assets/fonts/IBMPlexSans-Regular-Latin1.woff2",
  "assets/fonts/IBMPlexSans-SemiBold-Latin1.woff2",
  "assets/icons/actamoon-favicon.svg",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/img/acta.svg",
  "assets/img/actamoon-logo-oscuro.svg",
  "assets/img/actamoon-logo.svg",
  "index.html",
  "js/actas.js",
  "js/app.js",
  "js/auditoria.js",
  "js/config.js",
  "js/consolidado.js",
  "js/contacto.js",
  "js/datos-ejemplo.js",
  "js/db.js",
  "js/documentos.js",
  "js/foto.js",
  "js/gestion.js",
  "js/hash.js",
  "js/kpi.js",
  "js/offline.js",
  "js/pdf.js",
  "js/permisos.js",
  "js/portada.js",
  "js/ui.js",
  "js/validaciones.js",
  "js/vistas/acta.js",
  "js/vistas/actividad.js",
  "js/vistas/auditoria.js",
  "js/vistas/ayuda.js",
  "js/vistas/comun.js",
  "js/vistas/foto-campo.js",
  "js/vistas/gestion.js",
  "js/vistas/inicio.js",
  "js/vistas/mesas.js",
  "js/vistas/organizacion.js",
  "js/vistas/panel.js",
  "js/vistas/reclamacion.js",
  "js/vistas/validacion.js",
  "manifest.webmanifest",
  "portada.html"
];

const PREFIJO = 'actamoon-';
const CACHE = PREFIJO + VERSION;
const RAIZ = new URL('./', self.location.href);
const RUTAS = new Set(PRECACHE.map((ruta) => new URL(ruta, RAIZ).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: 'reload' se salta la cache HTTP: la version nueva trae archivos nuevos.
      await cache.addAll(PRECACHE.map((ruta) => new Request(new URL(ruta, RAIZ), { cache: 'reload' })));
      // Un servidor puede responder con una redireccion (por ejemplo, a una
      // URL sin .html). Una respuesta redirigida no sirve para una navegacion,
      // asi que se guarda una copia limpia.
      for (const peticion of await cache.keys()) {
        const respuesta = await cache.match(peticion);
        if (!respuesta.redirected) continue;
        const limpia = new Response(await respuesta.blob(), { status: respuesta.status, statusText: respuesta.statusText, headers: respuesta.headers });
        await cache.put(peticion, limpia);
      }
    })(),
  );
});

// La version nueva espera a que la pagina lo pida: no se impone una recarga.
self.addEventListener('message', (event) => {
  if (event.data === 'activar') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((nombre) => nombre.startsWith(PREFIJO) && nombre !== CACHE).map((nombre) => caches.delete(nombre)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !RUTAS.has(url.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const guardada = await cache.match(new URL(url.pathname, url.origin), { ignoreSearch: true });
      // Si la cache se ha perdido, se repite la misma peticion del navegador.
      return guardada ?? fetch(event.request);
    })(),
  );
});
