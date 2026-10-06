# ACTAMOON

Demo de presentación de ACTAMOON: captura de actas de escrutinio por mesa,
consolidación y evidencias, como recuento paralelo interno de interventores y
apoderados.

**Es una demo con datos ficticios. No es un sistema oficial ni publica resultados.**

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

## Arrancar en local

Los módulos ES necesitan un servidor; cualquiera sirve:

```
python -m http.server 8000
```

y abrir `http://localhost:8000/`.

## Comprobaciones

```
node --test                           # acta, hash, doble confirmación, cadena de auditoría, permisos, ausencia de red, CSP, portada
python scripts/verifica-contraste.py  # contraste AA de la paleta (lee assets/css/tokens.css)
```

## Estructura

```
index.html               la app: una sola página, rutas por hash
portada.html             portada de presentación (textos en js/config.js)
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
js/datos-ejemplo.js      Municipio de Ejemplo: colegios, mesas y perfiles
js/vistas/               una por pantalla
scripts/                 verificación de contraste
tests/                   node --test
```
