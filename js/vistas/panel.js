// Panel consolidado. Administrador: todo el municipio. Apoderado: sus colegios.

import { CONFIG } from '../config.js';
import { consolida, filasDeSuma } from '../consolidado.js';
import { mesasVisibles } from '../permisos.js';
import { h, icono } from '../ui.js';
import { chipsDeMesa, describeAmbito } from './comun.js';

const T = CONFIG.panel.textos;

// Barra de una candidatura: la distingue su trama, no su color.
function barra(indice, valor, maximo) {
  const lleno = h('span', { class: `barra__lleno barra__lleno--${(indice % 3) + 1}` });
  lleno.style.width = `${maximo > 0 ? Math.round((valor / maximo) * 100) : 0}%`;
  return h('span', { class: 'barra', 'aria-hidden': 'true' }, lleno);
}

function tablaDeSuma(suma, id) {
  const filas = filasDeSuma(suma, CONFIG.acta.campos, CONFIG.candidaturas);
  const maximo = Math.max(0, ...filas.filter(([, , candidatura]) => candidatura).map(([, valor]) => valor));
  let indice = 0;
  return h(
    'table',
    { class: 'tabla tabla--suma', id },
    h('caption', { class: 'oculto' }, T.tituloTabla),
    h(
      'tbody',
      null,
      h('tr', null, h('th', { scope: 'row' }, T.mesasSumadas), h('td', null, String(suma.mesas)), h('td', null)),
      filas.map(([etiqueta, valor, candidatura]) =>
        h(
          'tr',
          null,
          h('th', { scope: 'row' }, etiqueta),
          h('td', null, String(valor)),
          h('td', { class: 'tabla__barra' }, candidatura && barra(indice++, valor, maximo)),
        ),
      ),
    ),
  );
}

function contador(clase, simbolo, etiqueta, valor, id) {
  return h('div', { class: 'contador', id }, h('dt', null, h('span', { class: `chip ${clase}` }, icono(simbolo), etiqueta)), h('dd', null, String(valor)));
}

function desglose(grupo) {
  const cabeceras = [...CONFIG.acta.campos.map((campo) => [campo.corto, campo.etiqueta]), ...CONFIG.candidaturas.map((c) => [c.id, c.nombre])];
  const celdas = (cifras) => [
    ...CONFIG.acta.campos.map(({ id }) => cifras[id]),
    ...CONFIG.candidaturas.map(({ id }) => cifras.candidaturas[id]),
  ];
  const titulo = `desglose-${grupo.colegio.id}`;
  return h(
    'section',
    { class: 'grupo', 'aria-labelledby': titulo },
    h('h3', { id: titulo }, grupo.colegio.nombre),
    // La tabla es ancha: en movil se desplaza dentro de su caja, no la pagina.
    h(
      'div',
      { class: 'desplazable', role: 'region', tabindex: '0', 'aria-labelledby': titulo },
      h(
        'table',
        { class: 'tabla tabla--desglose' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', { scope: 'col' }, T.mesa),
            h('th', { scope: 'col' }, T.estado),
            cabeceras.map(([corto, largo]) => h('th', { scope: 'col', class: 'num' }, h('abbr', { title: largo }, corto))),
          ),
        ),
        h(
          'tbody',
          null,
          grupo.mesas.map(({ mesa, acta }) =>
            h(
              'tr',
              { 'data-mesa': mesa.id },
              h('th', { scope: 'row' }, h('a', { href: `#/mesa/${mesa.id}` }, mesa.nombre)),
              h('td', null, chipsDeMesa(acta)),
              acta ? celdas(acta.cifras).map((valor) => h('td', { class: 'num' }, String(valor))) : cabeceras.map(() => h('td', { class: 'num' }, '-')),
            ),
          ),
        ),
        h(
          'tfoot',
          null,
          h('tr', null, h('th', { scope: 'row', colspan: '2' }, T.subtotal), celdas(grupo.validadas).map((valor) => h('td', { class: 'num' }, String(valor)))),
        ),
      ),
    ),
  );
}

export function vistaPanel({ estado, acciones }) {
  const mesas = mesasVisibles(estado.perfil, estado.mesas);
  const consolidado = consolida({ colegios: estado.colegios, mesas, actas: estado.actas, candidaturas: CONFIG.candidaturas });
  const c = consolidado.contadores;
  const E = CONFIG.panel.estados;
  const ambito = describeAmbito(estado.perfil, estado);

  const descargar = h(
    'button',
    {
      type: 'button',
      class: 'boton boton--secundario',
      id: 'pdf-panel',
      onclick: async () => {
        descargar.disabled = true;
        await acciones.descargarPdfPanel(consolidado, ambito);
        descargar.disabled = false;
      },
    },
    icono('descarga'),
    T.descargar,
  );

  return {
    titulo: T.titulo,
    nodo: h(
      'div',
      { class: 'vista vista--ancha' },
      h('h1', { tabindex: '-1' }, T.titulo),
      h('p', { class: 'entradilla' }, `${CONFIG.eleccion.tipo} · ${ambito}`),
      h('p', { class: 'nota nota--pend', id: 'no-oficial' }, icono('aviso'), h('span', null, h('strong', null, T.noOficial), ` ${T.noOficialTexto}`)),

      h(
        'section',
        { class: 'grupo', 'aria-labelledby': 'panel-estados' },
        h('h2', { id: 'panel-estados' }, T.estados),
        h(
          'dl',
          { class: 'contadores' },
          contador('chip--ok', 'ok', E.validada, c.validada, 'cuenta-validada'),
          contador('chip--pend', 'pendiente', E.enviada, c.pendiente, 'cuenta-pendiente'),
          contador('chip--err', 'no', E.devuelta, c.devuelta, 'cuenta-devuelta'),
          contador('chip--neutro', 'pendiente', E['sin-acta'], c.sinActa, 'cuenta-sin-acta'),
          contador('chip--err', 'aviso', T.conDescuadre, c.descuadre, 'cuenta-descuadre'),
        ),
        h('p', { class: 'evidencia__nota', id: 'cuenta-mesas' }, T.deMesas(c.mesas)),
      ),

      h(
        'section',
        { class: 'grupo', 'aria-labelledby': 'panel-totales' },
        h('h2', { id: 'panel-totales' }, T.totales),
        h('p', null, T.totalesNota),
        tablaDeSuma(consolidado.total.validadas, 'total-validadas'),
      ),

      h(
        'section',
        { class: 'grupo provisional', 'aria-labelledby': 'panel-provisional' },
        h('h2', { id: 'panel-provisional' }, T.provisional, ' ', h('span', { class: 'chip chip--pend' }, icono('pendiente'), T.etiquetaProvisional)),
        h('p', null, T.provisionalNota),
        tablaDeSuma(consolidado.total.provisional, 'total-provisional'),
      ),

      h('section', { class: 'grupo', 'aria-labelledby': 'panel-desglose' }, h('h2', { id: 'panel-desglose' }, T.desglose), consolidado.porColegio.map(desglose)),

      h('div', { class: 'acciones' }, h('a', { class: 'boton', id: 'ver-actividad', href: '#/panel/actividad' }, icono('panel'), CONFIG.kpi.textos.enlace), descargar),
    ),
  };
}
