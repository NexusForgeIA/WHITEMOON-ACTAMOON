// Piezas de interfaz compartidas. El DOM se construye con nodos, nunca con
// innerHTML, para que ningun texto introducido pueda colarse como marcado.

import { CONTACTO, CONTACTO_ASUNTO } from './config.js';
import { enlaceContacto } from './contacto.js';

const SVG = 'http://www.w3.org/2000/svg';
const CIRCULO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z';

const TRAZOS = {
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  mesas: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  organizacion: 'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
  ayuda: `${CIRCULO} M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7 M12 17h.01`,
  aviso: 'M12 4 2.5 20h19z M12 10v4 M12 17h.01',
  ok: `${CIRCULO} M8 12.5l3 3 5-6`,
  error: `${CIRCULO} M12 8v5 M12 16h.01`,
  no: `${CIRCULO} M5.6 5.6l12.8 12.8`,
  camara: 'M4 8h3l1.5-2h7L17 8h3v11H4z M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  registro: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3',
  panel: 'M4 20V10 M10 20V4 M16 20v-7 M3 20h18',
  descarga: 'M12 4v11 M7 11l5 5 5-5 M5 20h14',
  pendiente: `${CIRCULO} M12 7v5l3 2`,
  adelante: 'M9 6l6 6-6 6',
  atras: 'M15 6l-6 6 6 6',
};

export function h(etiqueta, atributos, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos ?? {})) {
    if (valor == null || valor === false) continue;
    if (nombre.startsWith('on')) el.addEventListener(nombre.slice(2), valor);
    else el.setAttribute(nombre, valor === true ? '' : valor);
  }
  el.append(...hijos.flat(Infinity).filter((hijo) => hijo != null && hijo !== false));
  return el;
}

// Icono decorativo: el significado lo lleva siempre el texto de al lado.
export function icono(nombre) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const trazo = document.createElementNS(SVG, 'path');
  trazo.setAttribute('d', TRAZOS[nombre]);
  svg.append(trazo);
  return svg;
}

// Enlace de contacto, o null si CONTACTO esta vacio. El texto visible es el
// propio contacto, para poder copiarlo sin abrir el cliente de correo.
export function enlaceDeContacto() {
  const href = enlaceContacto(CONTACTO, CONTACTO_ASUNTO);
  return href && h('a', { class: 'contacto', href }, CONTACTO.trim());
}

// Direcciones blob: de las fotos en pantalla. Se liberan al cambiar de vista.
const urls = new Set();

export function urlTemporal(blob) {
  const url = URL.createObjectURL(blob);
  urls.add(url);
  return url;
}

export function liberaUrls() {
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
}

// Ofrece unos bytes como archivo descargable, sin pasar por la red.
export function descarga(bytes, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const enlace = h('a', { href: url, download: nombre, hidden: true });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

let temporizador;

// Mensaje de estado flotante. Los de exito se retiran solos; los de
// error se quedan hasta el siguiente aviso o cambio de vista.
export function avisa(texto, tipo = 'ok') {
  const zona = document.getElementById('avisos');
  clearTimeout(temporizador);
  zona.replaceChildren(h('p', { class: `aviso aviso--${tipo}` }, icono(tipo), h('span', null, texto)));
  if (tipo === 'ok') temporizador = setTimeout(limpiaAvisos, 6000);
}

export function limpiaAvisos() {
  clearTimeout(temporizador);
  document.getElementById('avisos').replaceChildren();
}

// Confirmacion previa a una accion destructiva. Resuelve true solo si se acepta.
export function confirmar({ titulo, texto, aceptar }) {
  const dialogo = document.getElementById('dialogo');
  document.getElementById('dialogo-titulo').textContent = titulo;
  document.getElementById('dialogo-texto').textContent = texto;
  document.getElementById('dialogo-si').textContent = aceptar;
  dialogo.returnValue = '';
  dialogo.showModal();
  return new Promise((resolve) => {
    dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'si'), { once: true });
  });
}
