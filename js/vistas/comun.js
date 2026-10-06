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

// Estado de la mesa segun su acta vigente.
export function chipsDeMesa(acta) {
  if (!acta) return h('span', { class: 'chip chip--neutro' }, icono('pendiente'), 'Sin acta');
  const [clase, simbolo, etiqueta] = {
    enviada: ['chip--pend', 'pendiente', 'Pendiente de validar'],
    validada: ['chip--ok', 'ok', 'Validada'],
    devuelta: ['chip--err', 'no', 'Devuelta'],
  }[acta.estado];
  return h(
    'span',
    { class: 'chips' },
    h('span', { class: `chip ${clase}` }, icono(simbolo), etiqueta),
    acta.descuadre && h('span', { class: 'chip chip--err' }, icono('aviso'), 'Descuadre'),
  );
}

const UNIDADES = ['B', 'kB', 'MB', 'GB', 'TB'];
const numero = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });

export function tamano(bytes) {
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < UNIDADES.length - 1) {
    valor /= 1024;
    i += 1;
  }
  return `${numero.format(valor)} ${UNIDADES[i]}`;
}

const fechaHora = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});

// Fecha y hora con segundos y zona horaria, a partir de un instante ISO.
export function formateaHora(iso) {
  return fechaHora.format(new Date(iso));
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
