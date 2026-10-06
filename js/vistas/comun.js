import { h, icono } from '../ui.js';

const lista = new Intl.ListFormat('es', { type: 'conjunction' });

export function nombreColegio(estado, colegioId) {
  return estado.colegios.find((colegio) => colegio.id === colegioId)?.nombre ?? '';
}

// "Todo el municipio", "Colegio 1 y Colegio 2", "Mesa 001 · Colegio 1".
export function describeAmbito(perfil, estado) {
  if (perfil.rol === 'administrador') return 'Todo el municipio';
  if (perfil.rol === 'apoderado') return lista.format(perfil.colegioIds.map((id) => nombreColegio(estado, id)));
  return perfil.mesaIds
    .map((id) => estado.mesas.find((mesa) => mesa.id === id))
    .filter(Boolean)
    .map((mesa) => `${mesa.nombre} · ${nombreColegio(estado, mesa.colegioId)}`)
    .join(', ');
}

export function interventorDe(estado, mesaId) {
  return estado.perfiles.find((perfil) => perfil.rol === 'interventor' && perfil.mesaIds.includes(mesaId));
}

export function apoderadoDe(estado, colegioId) {
  return estado.perfiles.find((perfil) => perfil.rol === 'apoderado' && perfil.colegioIds.includes(colegioId));
}

export function chipSinActa() {
  return h('span', { class: 'chip chip--pend' }, icono('pendiente'), 'Sin acta');
}

export function vistaMensaje(titulo, texto, enlace) {
  return {
    titulo,
    nodo: h(
      'div',
      { class: 'vista' },
      h('h1', { tabindex: '-1' }, titulo),
      h('p', null, texto),
      h('p', null, h('a', { href: enlace.href }, enlace.texto)),
    ),
  };
}
