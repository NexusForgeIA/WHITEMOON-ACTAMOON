import { CONFIG } from '../config.js';
import { h } from '../ui.js';
import { apoderadoDe, interventorDe } from './comun.js';

// Quien cubre que. Solo para el administrador.
export function vistaOrganizacion({ estado }) {
  return {
    titulo: 'Organización',
    nodo: h(
      'div',
      { class: 'vista' },
      h('h1', { tabindex: '-1' }, 'Organización'),
      h('p', { class: 'entradilla' }, `${CONFIG.eleccion.ambito} · quién cubre cada colegio y cada mesa`),
      estado.colegios.map((colegio) =>
        h(
          'table',
          { class: 'tabla' },
          h(
            'caption',
            null,
            h('span', { class: 'tabla__titulo' }, colegio.nombre),
            h('span', { class: 'tabla__nota' }, apoderadoDe(estado, colegio.id)?.etiqueta ?? 'Sin apoderado'),
          ),
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Mesa'), h('th', { scope: 'col' }, 'Interventor'))),
          h(
            'tbody',
            null,
            estado.mesas
              .filter((mesa) => mesa.colegioId === colegio.id)
              .map((mesa) =>
                h(
                  'tr',
                  null,
                  h('th', { scope: 'row' }, h('a', { href: `#/mesa/${mesa.id}` }, mesa.nombre)),
                  h('td', null, interventorDe(estado, mesa.id)?.etiqueta ?? 'Sin asignar'),
                ),
              ),
          ),
        ),
      ),
    ),
  };
}
