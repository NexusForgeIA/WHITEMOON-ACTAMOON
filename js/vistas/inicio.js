// Pantalla de entrada: la bienvenida (sin datos) y el selector de perfil.

import { CONFIG } from '../config.js';
import { h, icono } from '../ui.js';
import { describeAmbito } from './comun.js';

const T = CONFIG.entrada;
// El orden en que se presentan los roles, con su icono.
const ROLES = [
  ['interventor', 'camara'],
  ['apoderado', 'ok'],
  ['administrador', 'panel'],
];

// Primera visita: logo, una frase y un boton. Va a pantalla completa; el
// aviso de demo lo lleva el banner, con su texto de entrada.
export function vistaBienvenida({ acciones }) {
  const probar = h(
    'button',
    {
      type: 'button',
      class: 'boton boton--grande',
      id: 'probar-demo',
      onclick: async () => {
        probar.disabled = true;
        await acciones.cargarEjemplo();
        probar.disabled = false;
      },
    },
    T.probar,
  );
  return {
    titulo: T.tituloBienvenida,
    pantalla: 'bienvenida',
    nodo: h(
      'div',
      { class: 'bienvenida' },
      h('h1', { class: 'bienvenida__logo', tabindex: '-1' }, h('img', { src: 'assets/img/actamoon-logo.svg', alt: CONFIG.producto, width: '275', height: '64' })),
      h('p', { class: 'bienvenida__frase' }, T.frase),
      probar,
      h('p', { class: 'bienvenida__enlaces' }, h('a', { href: 'portada.html' }, T.portada), h('a', { href: '#/ayuda' }, T.queEs)),
    ),
  };
}

function botonPerfil(perfil, estado, acciones) {
  const activo = estado.perfil?.id === perfil.id;
  // Un perfil desactivado se ve, pero no se puede elegir.
  const desactivado = perfil.activo === false;
  return h(
    'button',
    {
      type: 'button',
      class: 'perfil',
      'data-perfil': perfil.id,
      'aria-pressed': String(activo),
      disabled: desactivado,
      onclick: () => acciones.elegirPerfil(perfil.id),
    },
    h('span', { class: 'perfil__nombre' }, perfil.etiqueta),
    h('span', { class: 'perfil__ambito' }, describeAmbito(perfil, estado) || CONFIG.gestion.textos.sinAsignar),
    activo && h('span', { class: 'perfil__activo' }, T.perfilActivo),
    desactivado && h('span', { class: 'perfil__activo perfil__activo--no' }, CONFIG.gestion.textos.perfilDesactivado),
  );
}

// Tarjeta de un rol. Con un solo perfil en uso, entra directo; con varios,
// despliega la lista para elegir cual.
function tarjetaDeRol(rol, simbolo, estado, acciones) {
  const perfiles = estado.perfiles.filter((perfil) => perfil.rol === rol);
  const enUso = perfiles.filter((perfil) => perfil.activo !== false);
  const directo = perfiles.length === 1 && enUso.length === 1;
  const esElActivo = estado.perfil?.rol === rol;
  const lista = h('ul', { class: 'perfiles', role: 'list', id: `perfiles-${rol}`, hidden: !esElActivo || directo }, perfiles.map((perfil) => h('li', null, botonPerfil(perfil, estado, acciones))));

  const tarjeta = h(
    'button',
    {
      type: 'button',
      class: 'rol',
      'data-rol': rol,
      // La tarjeta que entra directo es, a la vez, el boton de ese perfil.
      'data-perfil': directo ? enUso[0].id : null,
      'aria-pressed': directo ? String(esElActivo) : null,
      'aria-expanded': directo ? null : String(!lista.hidden),
      'aria-controls': directo ? null : lista.id,
      onclick: () => {
        if (directo) return acciones.elegirPerfil(enUso[0].id);
        lista.hidden = !lista.hidden;
        tarjeta.setAttribute('aria-expanded', String(!lista.hidden));
        if (!lista.hidden) lista.querySelector('button:not(:disabled)')?.focus();
        return null;
      },
    },
    icono(simbolo),
    h('span', { class: 'rol__texto' }, h('span', { class: 'rol__nombre' }, T.roles[rol].nombre), h('span', { class: 'rol__linea' }, T.roles[rol].linea)),
    esElActivo && directo ? h('span', { class: 'perfil__activo' }, T.perfilActivo) : !directo && h('span', { class: 'rol__cuantos' }, T.elegir(enUso.length)),
  );
  return h('li', { class: 'rol__grupo' }, tarjeta, !directo && lista);
}

export function vistaSelector({ estado, acciones }) {
  const resumen = T.resumen(estado.colegios.length, estado.mesas.length, estado.perfiles.length);
  return {
    titulo: T.tituloSelector,
    nodo: h(
      'div',
      { class: 'vista' },
      h('h1', { tabindex: '-1' }, T.tituloSelector),
      h('p', { class: 'nota nota--pend' }, icono('aviso'), h('span', null, CONFIG.textos.perfilesSimulados)),
      h('ul', { class: 'roles', role: 'list' }, ROLES.map(([rol, simbolo]) => tarjetaDeRol(rol, simbolo, estado, acciones))),
      h(
        'section',
        { class: 'grupo', 'aria-labelledby': 'datos-demo' },
        h('h2', { id: 'datos-demo' }, T.datos),
        h('p', null, resumen),
        h('button', { type: 'button', class: 'boton boton--peligro', id: 'reiniciar-demo', onclick: acciones.reiniciar }, T.reiniciar),
      ),
    ),
  };
}
