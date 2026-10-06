// Uso sin conexion: registra el Service Worker y pinta dos avisos, "sin
// conexion" y "hay una version nueva". Lo usan la app y la portada.

import { CONFIG } from './config.js';
import { h, icono } from './ui.js';

const T = CONFIG.offline.textos;

export function preparaOffline() {
  let registro = null;
  let pedida = false;

  const sinConexion = h('p', { class: 'sistema__aviso sistema__aviso--red', id: 'sin-conexion', hidden: true }, icono('sin-red'), h('span', null, T.sinConexion));
  const actualizar = h(
    'button',
    {
      type: 'button',
      class: 'boton boton--menor',
      id: 'actualizar',
      onclick: () => {
        // La recarga la pide quien pulsa; nunca se impone.
        pedida = true;
        actualizar.disabled = true;
        registro?.waiting?.postMessage('activar');
      },
    },
    T.actualizar,
  );
  const versionNueva = h('p', { class: 'sistema__aviso sistema__aviso--version', id: 'version-nueva', hidden: true }, icono('descarga'), h('span', null, T.versionNueva), actualizar);
  document.querySelector('.cabecera').after(h('div', { class: 'sistema', role: 'status' }, sinConexion, versionNueva));

  const pintaRed = () => {
    sinConexion.hidden = navigator.onLine;
  };
  window.addEventListener('online', pintaRed);
  window.addEventListener('offline', pintaRed);
  pintaRed();

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pedida) location.reload();
  });

  // Hay version nueva cuando un Service Worker espera y ya habia otro al mando.
  const ofrece = () => {
    if (registro.waiting && navigator.serviceWorker.controller) versionNueva.hidden = false;
  };
  navigator.serviceWorker.register('sw.js').then(
    (nuevo) => {
      registro = nuevo;
      ofrece();
      registro.addEventListener('updatefound', () => registro.installing?.addEventListener('statechange', ofrece));
    },
    () => {
      // Sin Service Worker la demo funciona igual, solo que necesita conexion para abrirse.
    },
  );
}
