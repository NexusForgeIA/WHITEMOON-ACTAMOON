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

## Arrancar en local

Los módulos ES necesitan un servidor; cualquiera sirve:

```
python -m http.server 8000
```

y abrir `http://localhost:8000/`.

## Comprobaciones

```
node --test                           # permisos por perfil, datos de ejemplo, ausencia de red, CSP
python scripts/verifica-contraste.py  # contraste AA de la paleta (lee assets/css/tokens.css)
```

## Estructura

```
index.html               una sola página, rutas por hash
assets/css/tokens.css    paleta, tipografía y espaciado
assets/css/app.css       componentes y disposición
assets/fonts/            IBM Plex Sans y Mono (licencia OFL en OFL.txt)
js/config.js             ámbito de la elección y textos
js/app.js                arranque, router y acciones
js/db.js                 IndexedDB
js/permisos.js           qué ve cada perfil (módulo puro)
js/datos-ejemplo.js      Municipio de Ejemplo: colegios, mesas y perfiles
js/vistas/               una por pantalla
scripts/                 verificación de contraste
tests/                   node --test
```
