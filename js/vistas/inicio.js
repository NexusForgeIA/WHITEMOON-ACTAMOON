import { CONFIG } from '../config.js';
import { h, icono } from '../ui.js';
import { describeAmbito } from './comun.js';

const ORDEN_ROLES = ['administrador', 'apoderado', 'interventor'];

export function vistaInicio({ estado, acciones }) {
  const hayDatos = estado.perfiles.length > 0;
  return {
    titulo: 'Elige un perfil',
    nodo: h(
      'div',
      { class: 'vista' },
      h('h1', { tabindex: '-1' }, 'Elige un perfil'),
      hayDatos ? selector(estado, acciones) : vacio(acciones),
      hayDatos && datosDeLaDemo(estado, acciones),
    ),
  };
}

function vacio(acciones) {
  return h(
    'section',
    { class: 'vacio' },
    h('p', null, 'Esta demo todavía no tiene datos. Carga el ejemplo para ver los perfiles, los colegios y las mesas.'),
    h(
      'button',
      { type: 'button', class: 'boton', id: 'cargar-ejemplo', onclick: acciones.cargarEjemplo },
      'Cargar datos de ejemplo',
    ),
  );
}

function selector(estado, acciones) {
  return [
    h('p', { class: 'nota nota--pend' }, icono('aviso'), h('span', null, CONFIG.textos.perfilesSimulados)),
    ORDEN_ROLES.map((rol) => {
      const perfiles = estado.perfiles.filter((perfil) => perfil.rol === rol);
      return h(
        'section',
        { class: 'grupo', 'aria-labelledby': `rol-${rol}` },
        h('h2', { id: `rol-${rol}` }, CONFIG.roles[rol].plural),
        h(
          'ul',
          { class: 'perfiles', role: 'list' },
          perfiles.map((perfil) => h('li', null, botonPerfil(perfil, estado, acciones))),
        ),
      );
    }),
  ];
}

function botonPerfil(perfil, estado, acciones) {
  const activo = estado.perfil?.id === perfil.id;
  return h(
    'button',
    {
      type: 'button',
      class: 'perfil',
      'data-perfil': perfil.id,
      'aria-pressed': String(activo),
      onclick: () => acciones.elegirPerfil(perfil.id),
    },
    h('span', { class: 'perfil__nombre' }, perfil.etiqueta),
    h('span', { class: 'perfil__ambito' }, describeAmbito(perfil, estado)),
    activo && h('span', { class: 'perfil__activo' }, 'Perfil activo'),
  );
}

function datosDeLaDemo(estado, acciones) {
  const resumen = `Datos de ejemplo cargados: ${estado.colegios.length} colegios, ${estado.mesas.length} mesas y ${estado.perfiles.length} perfiles. Todos ficticios.`;
  return h(
    'section',
    { class: 'grupo', 'aria-labelledby': 'datos-demo' },
    h('h2', { id: 'datos-demo' }, 'Datos de la demo'),
    h('p', null, resumen),
    h(
      'button',
      { type: 'button', class: 'boton boton--peligro', id: 'reiniciar-demo', onclick: acciones.reiniciar },
      'Reiniciar demo',
    ),
  );
}
