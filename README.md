# ACTAMOON

Demo de presentación de ACTAMOON: captura de actas de escrutinio por mesa,
consolidación y evidencias, como recuento paralelo interno de interventores y
apoderados.

**Es una demo con datos ficticios. No es un sistema oficial ni publica resultados.**

Todos los derechos reservados. Ver [Derechos](#derechos).

## Qué hay hoy

- Perfiles simulados y datos de ejemplo (Municipio de Ejemplo, colegios y mesas
  numerados, candidaturas A, B y C).
- Captura del acta: foto, huella SHA-256 del archivo, hora del dispositivo,
  cifras y validaciones aritméticas.
- Doble confirmación por otro perfil, reclamaciones y registro de auditoría.
- Portada de presentación.

Pendiente: el consolidado por mesa, el PDF por mesa y el modo sin conexión.

## Fotos y datos

- La demo **no usa fotos de actas reales**. El repositorio no contiene ninguna
  foto: sus únicas imágenes son el logo, los iconos y una ilustración dibujada.
- La pantalla de captura avisa de que no se fotografíen actas reales. Las fotos
  que se hagan al probarla se quedan en el navegador de quien las hace.
- No hay nombres de personas, partidos ni municipios reales.

## Qué es y qué no

- HTML, CSS y JavaScript sin frameworks, sin dependencias y sin paso de build.
- Todos los datos viven en IndexedDB, en el navegador. La app no hace
  peticiones de red: lo impone la CSP de `index.html` y lo vigila
  `tests/sin-red.test.mjs`.
- Los perfiles (administrador, apoderado, interventor) son simulados. Filtran
  lo que se ve en la interfaz; no son seguridad real.
- No demuestra seguridad real, hora de servidor ni sincronización entre
  dispositivos. Eso pertenece al producto con backend.
- El registro de auditoría encadena cada entrada con la huella de la anterior.
  En local eso enseña el mecanismo, no garantiza que el registro sea
  inalterable: quien tenga acceso al navegador puede reescribirlo entero.

## Contacto

El contacto que enseñan la portada y el pie de la app sale de la constante
`CONTACTO` de `js/config.js`, y solo de ahí: un test falla si aparece escrito
en cualquier otro archivo. Con la constante vacía, el contacto no se muestra.

## Arrancar en local

Los módulos ES necesitan un servidor; cualquiera sirve:

```
npx serve                    # http://localhost:3000/
python -m http.server 8000   # http://localhost:8000/
```

La app está en la raíz y la portada en `portada.html`.

## Comprobaciones

```
node --test                           # acta, hash, doble confirmación, auditoría, panel, PDF, sin conexión, permisos, ausencia de red, CSP, portada
python scripts/verifica-contraste.py  # contraste AA de la paleta (lee assets/css/tokens.css)
```

## Sin conexión

`sw.js` guarda todos los archivos de la app al abrirla por primera vez y los
sirve desde ahí, así que después abre y funciona sin red. Las rutas son
relativas: vale igual en la raíz que bajo una subcarpeta.

La lista de archivos y su versión se escriben solas:

```
node scripts/version-sw.mjs
```

Hay que ejecutarlo **cada vez que cambie un archivo de la app** y confirmar el
`sw.js` que deja; `node --test` falla si no está al día. Al cambiar la versión,
quien tenga la demo abierta ve «Hay una versión nueva» y decide cuándo
actualizar: no se recarga sola.

## Estructura

```
index.html               la app: una sola página, rutas por hash
portada.html             portada de presentación (textos en js/config.js)
sw.js                    Service Worker: guarda la app para usarla sin conexión
manifest.webmanifest     nombre, colores e iconos al instalarla
assets/css/tokens.css    paleta, tipografía y espaciado
assets/css/app.css       componentes y disposición
assets/fonts/            IBM Plex Sans y Mono (licencia OFL en OFL.txt)
js/config.js             ámbito de la elección, campos del acta, candidaturas y textos
js/app.js                arranque, router y acciones
js/db.js                 IndexedDB
js/permisos.js           qué ve y qué captura cada perfil (módulo puro)
js/validaciones.js       aritmética del acta y condiciones de envío (módulo puro)
js/hash.js               SHA-256 con Web Crypto
js/foto.js               huella del original y copia reducida a 1600 px
js/actas.js              registros de acta y doble confirmación (módulo puro)
js/auditoria.js          registro encadenado por huellas: crear y verificar (módulo puro)
js/consolidado.js        panel: totales de actas validadas, provisional y desglose (módulo puro)
js/pdf.js                generador de PDF propio, sin librerías (módulo puro)
js/documentos.js         PDF de una mesa y PDF del panel (módulo puro)
js/offline.js            registro del Service Worker y avisos de conexión y de versión
js/datos-ejemplo.js      Municipio de Ejemplo: colegios, mesas y perfiles
js/vistas/               una por pantalla
scripts/                 verificación de contraste y versión del Service Worker
tests/                   node --test
```

## Derechos

Copyright (c) 2026 ACTAMOON. Todos los derechos reservados.

El repositorio es público para que la demo pueda verse; eso no concede ninguna
licencia de uso, copia, modificación ni distribución. El texto completo está en
[LICENSE](LICENSE).

Las tipografías IBM Plex de `assets/fonts/` son de sus autores y se distribuyen
bajo la SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).
