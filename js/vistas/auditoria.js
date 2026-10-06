// Registro de auditoria. Solo para el administrador.

import { verificaCadena } from '../auditoria.js';
import { CONFIG } from '../config.js';
import { h, icono } from '../ui.js';
import { formateaHora } from './comun.js';

const T = CONFIG.auditoria.textos;

export function vistaAuditoria({ estado }) {
  const entradas = estado.auditoria;
  const resultado = h('div', { id: 'resultado-cadena', role: 'status' });
  const perfil = (id) => (id ? (estado.perfiles.find((p) => p.id === id)?.etiqueta ?? id) : T.sinPerfil);
  const mesa = (id) => estado.mesas.find((m) => m.id === id)?.nombre;

  const verificar = h(
    'button',
    {
      type: 'button',
      class: 'boton',
      id: 'verificar-cadena',
      onclick: async () => {
        verificar.disabled = true;
        const cadena = await verificaCadena(entradas);
        verificar.disabled = false;
        resultado.className = cadena.ok ? 'nota nota--ok' : 'nota nota--error';
        resultado.replaceChildren(
          icono(cadena.ok ? 'ok' : 'aviso'),
          h(
            'div',
            null,
            h('strong', null, cadena.ok ? T.integra(cadena.total) : T.rota(cadena.rotaEn)),
            h('p', null, cadena.ok ? T.integraNota : T.rotaNota[cadena.motivo]),
          ),
        );
      },
    },
    T.verificar,
  );

  return {
    titulo: T.titulo,
    nodo: h(
      'div',
      { class: 'vista' },
      h('h1', { tabindex: '-1' }, T.titulo),
      h('p', { class: 'entradilla' }, T.entradilla),
      h('div', { class: 'nota nota--pend', id: 'aviso-cadena' }, icono('aviso'), h('div', null, h('strong', null, T.avisoTitulo), h('p', null, T.aviso))),
      entradas.length === 0
        ? h('p', { id: 'sin-entradas' }, T.vacia)
        : [
            h('div', { class: 'grupo' }, verificar, resultado),
            h(
              'ol',
              { class: 'registro', role: 'list' },
              // Lo ultimo, arriba.
              [...entradas].reverse().map((entrada) =>
                h(
                  'li',
                  { 'data-seq': entrada.seq },
                  h('p', { class: 'registro__meta' }, `${T.entrada(entrada.seq)} · ${formateaHora(entrada.hora)}`),
                  h(
                    'p',
                    { class: 'registro__accion' },
                    [perfil(entrada.perfilId), CONFIG.auditoria.acciones[entrada.accion] ?? entrada.accion, mesa(entrada.mesaId)]
                      .filter(Boolean)
                      .join(' · '),
                  ),
                  entrada.detalle && h('p', { class: 'registro__detalle' }, entrada.detalle),
                  h('p', { class: 'evidencia__nota' }, T.huella),
                  h('code', { class: 'huella' }, entrada.hash),
                ),
              ),
            ),
          ],
    ),
  };
}
