// Pinta portada.html a partir de PORTADA (config.js). Aqui no hay textos.

import { CONTACTO, PORTADA } from './config.js';
import { enlaceContacto } from './contacto.js';
import { h, icono } from './ui.js';

const APP = './';

function banda(clase, id, ...hijos) {
  return h('section', { class: `banda ${clase}`, 'aria-labelledby': id }, h('div', { class: 'ancho' }, hijos));
}

function hero({ titulo, frase, nota, ctaDemo, ctaContacto, ilustracionAlt }) {
  const contacto = enlaceContacto(CONTACTO);
  return banda(
    'hero',
    'hero-titulo',
    h(
      'div',
      { class: 'hero__texto' },
      h('h1', { id: 'hero-titulo' }, titulo),
      h('p', { class: 'hero__frase' }, frase),
      h(
        'div',
        { class: 'hero__acciones' },
        h('a', { class: 'boton', href: APP }, ctaDemo),
        contacto && h('a', { class: 'boton boton--secundario', id: 'solicitar-demo', href: contacto }, ctaContacto),
      ),
      h('p', { class: 'hero__nota' }, nota),
    ),
    h('img', { class: 'hero__imagen', src: 'assets/img/acta.svg', width: '480', height: '400', alt: ilustracionAlt }),
  );
}

function pasos({ titulo, items }) {
  return banda(
    'banda--pagina',
    'pasos-titulo',
    h('h2', { id: 'pasos-titulo' }, titulo),
    h(
      'ol',
      { class: 'pasos' },
      items.map((paso) => h('li', null, h('h3', null, paso.titulo), h('p', null, paso.texto))),
    ),
  );
}

function ofrece({ titulo, items }) {
  return banda(
    'banda--clara',
    'ofrece-titulo',
    h('h2', { id: 'ofrece-titulo' }, titulo),
    h(
      'dl',
      { class: 'ofrece' },
      items.map((item) => h('div', null, h('dt', null, item.titulo), h('dd', null, item.texto))),
    ),
  );
}

function noHace({ titulo, entradilla, items }) {
  return banda(
    'banda--tinta',
    'nohace-titulo',
    h('h2', { id: 'nohace-titulo' }, titulo),
    h('p', { class: 'banda__entradilla' }, entradilla),
    h(
      'ul',
      { class: 'nohace', role: 'list' },
      items.map((item) =>
        h('li', null, icono('no'), h('div', null, h('h3', null, item.titulo), h('p', null, item.texto))),
      ),
    ),
  );
}

function privacidad({ titulo, items }) {
  return banda(
    'banda--pagina',
    'privacidad-titulo',
    h('h2', { id: 'privacidad-titulo' }, titulo),
    h(
      'ul',
      { class: 'privacidad', role: 'list' },
      items.map((texto) => h('li', null, icono('ok'), h('span', null, texto))),
    ),
  );
}

document.getElementById('entrar-demo').textContent = PORTADA.entrarDemo;
document.getElementById('pie-aviso').textContent = PORTADA.pie;
document
  .getElementById('contenido')
  .replaceChildren(
    hero(PORTADA.hero),
    pasos(PORTADA.pasos),
    ofrece(PORTADA.ofrece),
    noHace(PORTADA.noHace),
    privacidad(PORTADA.privacidad),
  );
