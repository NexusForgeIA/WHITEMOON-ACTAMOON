import { actaDe, admiteCaptura } from '../actas.js';
import { CONFIG } from '../config.js';
import { mesasVisibles, puedeCapturar, puedeValidar } from '../permisos.js';
import { h, icono } from '../ui.js';
import { detalleActa } from './acta.js';
import { apoderadoDe, chipsDeMesa, interventorDe, nombreColegio, vistaMensaje } from './comun.js';
import { listaReclamaciones } from './reclamacion.js';
import { formularioValidacion, resultadoValidacion } from './validacion.js';

export function vistaMesas({ estado }) {
  const visibles = mesasVisibles(estado.perfil, estado.mesas);
  const colegios = estado.colegios.filter((colegio) => visibles.some((mesa) => mesa.colegioId === colegio.id));
  const titulo = visibles.length === 1 ? 'Tu mesa' : 'Mesas';
  const porValidar = visibles.filter((mesa) => puedeValidar(estado.perfil, mesa, actaDe(estado.actas, mesa.id))).length;

  return {
    titulo,
    nodo: h(
      'div',
      { class: 'vista' },
      h('h1', { tabindex: '-1' }, titulo),
      h('p', { class: 'entradilla' }, `${CONFIG.eleccion.tipo} · ${CONFIG.eleccion.ambito}`),
      porValidar > 0 &&
        h('p', { class: 'nota nota--pend', id: 'por-validar' }, icono('pendiente'), h('span', null, CONFIG.validacion.textos.pendientes(porValidar))),
      colegios.map((colegio) =>
        h(
          'section',
          { class: 'grupo', 'aria-labelledby': `mesas-${colegio.id}` },
          h('h2', { id: `mesas-${colegio.id}` }, colegio.nombre),
          h(
            'ul',
            { class: 'filas', role: 'list' },
            visibles
              .filter((mesa) => mesa.colegioId === colegio.id)
              .map((mesa) =>
                h(
                  'li',
                  null,
                  h(
                    'a',
                    { class: 'fila', href: `#/mesa/${mesa.id}` },
                    h('span', { class: 'fila__titulo' }, mesa.nombre),
                    chipsDeMesa(actaDe(estado.actas, mesa.id)),
                    icono('adelante'),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),
  };
}

export function vistaMesa({ estado, params: [mesaId], acciones }) {
  const mesa = mesasVisibles(estado.perfil, estado.mesas).find((m) => m.id === mesaId);
  if (!mesa) {
    return vistaMensaje('Mesa no disponible', `El perfil ${estado.perfil.etiqueta} no tiene asignada esta mesa.`, {
      href: '#/mesas',
      texto: 'Volver a las mesas',
    });
  }

  const dato = (termino, valor) => h('div', null, h('dt', null, termino), h('dd', null, valor));
  const acta = actaDe(estado.actas, mesa.id);

  return {
    titulo: mesa.nombre,
    nodo: h(
      'div',
      { class: 'vista' },
      h('a', { class: 'volver', href: '#/mesas' }, icono('atras'), 'Mesas'),
      h('h1', { tabindex: '-1' }, mesa.nombre),
      h('p', null, chipsDeMesa(acta)),
      acta && resultadoValidacion(acta, estado),
      admiteCaptura(acta) &&
        puedeCapturar(estado.perfil, mesa) &&
        h(
          'a',
          { class: 'boton', id: 'capturar-acta', href: `#/mesa/${mesa.id}/acta` },
          icono('camara'),
          acta ? CONFIG.validacion.textos.corregir : 'Capturar acta',
        ),
      h(
        'dl',
        { class: 'ficha' },
        dato('Colegio', nombreColegio(estado, mesa.colegioId)),
        dato('Ámbito', CONFIG.eleccion.ambito),
        dato('Interventor', interventorDe(estado, mesa.id)?.etiqueta ?? 'Sin asignar'),
        dato('Apoderado', apoderadoDe(estado, mesa.colegioId)?.etiqueta ?? 'Sin asignar'),
      ),
      acta && detalleActa(acta, mesa, estado),
      acta && formularioValidacion({ acta, mesa, estado, acciones }),
      acta &&
        h(
          'button',
          { type: 'button', class: 'boton boton--secundario', id: 'pdf-mesa', onclick: () => acciones.descargarPdfMesa(mesa) },
          icono('descarga'),
          CONFIG.pdf.textos.descargarMesa,
        ),
      listaReclamaciones(mesa, estado),
    ),
  };
}
