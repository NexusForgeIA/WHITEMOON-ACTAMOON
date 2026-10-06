// KPI de actividad, dentro del Panel. Administrador: todo. Apoderado: sus colegios.

import { CONFIG } from '../config.js';
import { calculaKpi, textoDeDuracion, textoDeMedia, textoDeRazon } from '../kpi.js';
import { mesasVisibles } from '../permisos.js';
import { h, icono } from '../ui.js';
import { describeAmbito } from './comun.js';

const T = CONFIG.kpi.textos;
const horaCorta = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

// Barra con trama propia. La cifra va siempre en texto, al lado.
function barra(trama, fraccion) {
  const lleno = h('span', { class: `barra__lleno barra__lleno--${trama}` });
  lleno.style.width = `${Math.round(Math.max(0, Math.min(1, fraccion ?? 0)) * 100)}%`;
  return h('span', { class: 'barra', 'aria-hidden': 'true' }, lleno);
}

function tabla(id, cabeceras, filas, titulo) {
  return h(
    'div',
    { class: 'desplazable', role: 'region', tabindex: '0', 'aria-label': titulo },
    h(
      'table',
      { class: 'tabla tabla--kpi', id },
      h('caption', { class: 'oculto' }, titulo),
      h('thead', null, h('tr', null, cabeceras.map((texto, i) => h('th', { scope: 'col', class: i > 0 ? 'num' : null }, texto)))),
      h(
        'tbody',
        null,
        filas.map((celdas) =>
          h(
            'tr',
            null,
            celdas.map((celda, i) => (i === 0 ? h('th', { scope: 'row' }, celda) : h('td', { class: celda?.classList?.contains('barra') ? 'tabla__barra' : 'num' }, celda))),
          ),
        ),
      ),
    ),
  );
}

const seccion = (id, titulo, ...hijos) => h('section', { class: 'grupo', 'aria-labelledby': id }, h('h2', { id }, titulo), hijos);

export function vistaActividad({ estado }) {
  const mesas = mesasVisibles(estado.perfil, estado.mesas);
  const k = calculaKpi({
    colegios: estado.colegios,
    mesas,
    actas: estado.actas,
    reclamaciones: estado.reclamaciones,
    auditoria: estado.auditoria,
    ahora: new Date().toISOString(),
    generales: estado.perfil.rol === 'administrador',
  });
  const E = CONFIG.panel.estados;
  const perfil = (id) => (id ? (estado.perfiles.find((p) => p.id === id)?.etiqueta ?? id) : CONFIG.auditoria.textos.sinPerfil);
  const deMesas = (n) => (k.base.mesas === 0 ? null : n / k.base.mesas);

  const estados = [
    [E.validada, k.estados.validada, 1],
    [E.enviada, k.estados.pendiente, 2],
    [E.devuelta, k.estados.devuelta, 3],
    [E['sin-acta'], k.estados.sinActa, 4],
  ];
  const tiempos = [
    [T.capturaEnvio, k.tiempos.capturaEnvio],
    [T.envioValidacion, k.tiempos.envioValidacion],
    [T.envioDevolucion, k.tiempos.envioDevolucion],
    [T.cicloCompleto, k.tiempos.cicloCompleto],
  ];
  const excluidas = tiempos.reduce((suma, [, tramo]) => suma + tramo.excluidas, 0);

  return {
    titulo: T.titulo,
    nodo: h(
      'div',
      { class: 'vista vista--ancha' },
      h('a', { class: 'volver', href: '#/panel' }, icono('atras'), CONFIG.panel.textos.titulo),
      h('h1', { tabindex: '-1' }, T.titulo),
      h('p', { class: 'entradilla' }, `${CONFIG.eleccion.tipo} · ${describeAmbito(estado.perfil, estado)}`),
      h('p', { class: 'nota nota--pend', id: 'kpi-aviso' }, icono('aviso'), h('span', null, T.aviso)),

      seccion(
        'kpi-cobertura',
        T.cobertura,
        tabla(
          'tabla-cobertura',
          [T.indicador, T.valor, T.proporcion],
          [
            [T.coberturaEnvio, textoDeRazon(k.cobertura.envio, T), barra(1, k.cobertura.envio.valor)],
            [T.coberturaValidada, textoDeRazon(k.cobertura.validada, T), barra(2, k.cobertura.validada.valor)],
          ],
          T.cobertura,
        ),
      ),

      seccion(
        'kpi-estados',
        T.estados,
        tabla('tabla-estados', [CONFIG.panel.textos.estado, T.mesas, T.proporcion], estados.map(([etiqueta, n, trama]) => [etiqueta, T.de(n, k.base.mesas), barra(trama, deMesas(n))]), T.estados),
        h('h3', { id: 'kpi-evolucion' }, T.evolucion),
        k.evolucion.columnas.length === 0
          ? h('p', { id: 'sin-evolucion' }, T.sinDatos)
          : [
              h('p', { class: 'evidencia__nota' }, T.evolucionNota(k.evolucion.tramoMinutos)),
              tabla(
                'tabla-evolucion',
                [T.tramo, E.validada, E.enviada, E.devuelta, E['sin-acta']],
                k.evolucion.columnas.map((col) => [horaCorta.format(new Date(col.desde)), String(col.validada), String(col.pendiente), String(col.devuelta), String(col.sinActa)]),
                T.evolucion,
              ),
            ],
      ),

      seccion(
        'kpi-calidad',
        T.calidad,
        tabla(
          'tabla-calidad',
          [T.indicador, T.valor, T.proporcion],
          [
            [T.descuadre, textoDeRazon(k.calidad.descuadre, T), barra(1, k.calidad.descuadre.valor)],
            [T.devueltasAhora, textoDeRazon(k.calidad.devueltasAhora, T), barra(2, k.calidad.devueltasAhora.valor)],
            [T.tasaDevolucion, textoDeRazon(k.calidad.tasaDevolucion, T), barra(3, k.calidad.tasaDevolucion.valor)],
            [
              T.versionesPorActa,
              k.calidad.versionesPorActa.valor === null ? T.sinDatos : `${textoDeMedia(k.calidad.versionesPorActa, T)} (${T.versionesBase(k.calidad.versionesPorActa.n, k.calidad.versionesPorActa.de)})`,
              '',
            ],
          ],
          T.calidad,
        ),
      ),

      seccion(
        'kpi-tiempos',
        T.tiempos,
        h('p', { class: 'nota nota--pend', id: 'kpi-orientativo' }, icono('aviso'), h('span', null, h('strong', null, T.orientativo), ` ${T.orientativoTexto}`)),
        tabla(
          'tabla-tiempos',
          [T.tramoTiempo, T.casos, T.mediana, T.maximo],
          tiempos.map(([etiqueta, tramo]) => [etiqueta, String(tramo.n), textoDeDuracion(tramo.mediana, T), textoDeDuracion(tramo.maximo, T)]),
          T.tiempos,
        ),
        excluidas > 0 && h('p', { class: 'evidencia__nota', id: 'kpi-excluidas' }, T.excluidas(excluidas)),
      ),

      seccion(
        'kpi-pendientes',
        T.pendientes,
        k.pendientes.length === 0
          ? h('p', { id: 'sin-pendientes' }, T.sinPendientes)
          : tabla(
              'tabla-pendientes',
              [CONFIG.panel.textos.mesa, T.esperando],
              k.pendientes.map(({ mesa, antiguedad }) => [h('a', { href: `#/mesa/${mesa.id}` }, mesa.nombre), textoDeDuracion(Math.max(0, antiguedad), T)]),
              T.pendientes,
            ),
      ),

      seccion(
        'kpi-reclamaciones',
        T.reclamaciones,
        h('p', { id: 'kpi-reclamaciones-total' }, T.reclamacionesTotal(k.reclamaciones.total)),
        tabla(
          'tabla-reclamaciones',
          [T.colegioMesa, T.reclamaciones],
          k.reclamaciones.porColegio.flatMap((grupo) => [
            [h('strong', null, grupo.colegio.nombre), h('strong', null, String(grupo.total))],
            ...grupo.mesas.map(({ mesa, total }) => [mesa.nombre, String(total)]),
          ]),
          T.reclamaciones,
        ),
      ),

      seccion(
        'kpi-acciones',
        T.acciones,
        h('p', { class: 'evidencia__nota' }, T.accionesNota),
        k.acciones.total === 0
          ? h('p', { id: 'sin-acciones' }, T.sinDatos)
          : [
              tabla(
                'tabla-acciones-tipo',
                [T.tipo, T.accionesColumna, T.proporcion],
                k.acciones.porTipo.map(({ accion, total }, i) => [CONFIG.auditoria.acciones[accion] ?? accion, T.de(total, k.acciones.total), barra((i % 4) + 1, total / k.acciones.total)]),
                T.accionesPorTipo,
              ),
              tabla(
                'tabla-acciones-perfil',
                [T.perfil, T.accionesColumna, T.proporcion],
                k.acciones.porPerfil.map(({ perfilId, total }, i) => [perfil(perfilId), T.de(total, k.acciones.total), barra((i % 4) + 1, total / k.acciones.total)]),
                T.accionesPorPerfil,
              ),
            ],
      ),
    ),
  };
}
