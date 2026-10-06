// Formularios de alta y edicion de colegios y mesas. Solo administrador.

import { CONFIG } from '../config.js';
import { NOMBRE_MAXIMO, abreBorrador, puedeBorrarse, tieneRegistros } from '../gestion.js';
import { h, icono } from '../ui.js';
import { apoderadoDe, chipDeEstado, interventorDe, vistaMensaje } from './comun.js';

const T = CONFIG.gestion.textos;
const NUEVO = new Set(['nuevo', 'nueva']);

function campoNombre(valor) {
  const entrada = h('input', {
    id: 'campo-nombre',
    class: 'campo__entrada campo__entrada--nombre',
    type: 'text',
    maxlength: String(NOMBRE_MAXIMO),
    autocomplete: 'off',
    'aria-describedby': 'campo-nombre-ayuda error-formulario',
    value: valor,
  });
  return { entrada, nodo: h('div', { class: 'campo' }, h('label', { for: 'campo-nombre' }, T.nombre), entrada, h('p', { class: 'campo__ayuda', id: 'campo-nombre-ayuda' }, T.nombreAyuda(NOMBRE_MAXIMO))) };
}

// Desplegable con "sin asignar" y las opciones dadas: [{ id, texto }].
function campoSelector(id, etiqueta, opciones, elegido, { ayuda = null, bloqueado = false, sinAsignar = true } = {}) {
  const selector = h(
    'select',
    { id, class: 'campo__entrada campo__entrada--nombre', disabled: bloqueado, 'aria-describedby': ayuda ? `${id}-ayuda` : null },
    sinAsignar && h('option', { value: '', selected: !elegido }, T.sinAsignar),
    opciones.map((opcion) => h('option', { value: opcion.id, selected: opcion.id === elegido }, opcion.texto)),
  );
  return { selector, nodo: h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), selector, ayuda && h('p', { class: 'campo__ayuda', id: `${id}-ayuda` }, ayuda)) };
}

// Parte comun: titulo, formulario, error y botones de guardar, desactivar y borrar.
function formulario({ titulo, cosa, tipo, campos, puedeBorrar, notaBorrado, alGuardar, acciones }) {
  const error = h('p', { class: 'campo__error', id: 'error-formulario', role: 'alert', hidden: true });
  const muestra = (codigo) => {
    error.textContent = CONFIG.gestion.errores[codigo] ?? CONFIG.textos.errorGuardado;
    error.hidden = false;
    document.getElementById('campo-nombre')?.focus();
  };
  const esActivo = cosa ? cosa.activo !== false : true;
  const guardar = h(
    'button',
    {
      type: 'button',
      class: 'boton',
      id: 'guardar',
      onclick: async () => {
        error.hidden = true;
        guardar.disabled = true;
        const codigo = await alGuardar();
        guardar.disabled = false;
        if (codigo) muestra(codigo);
      },
    },
    T.guardar,
  );

  return {
    titulo,
    nodo: h(
      'div',
      { class: 'vista' },
      h('a', { class: 'volver', href: '#/organizacion' }, icono('atras'), T.titulo),
      h('h1', { tabindex: '-1' }, titulo),
      cosa && h('p', null, chipDeEstado(cosa)),
      h('p', { class: 'nota nota--pend' }, icono('aviso'), h('span', null, T.avisoFicticios)),
      h('div', { class: 'grupo grupo--formulario' }, campos, error, guardar),
      cosa &&
        h(
          'section',
          { class: 'grupo', 'aria-labelledby': 'gestion-estado' },
          h('h2', { id: 'gestion-estado' }, T.estadoTitulo),
          h('p', null, esActivo ? T.desactivarNota[tipo] : T.reactivarNota[tipo]),
          h(
            'div',
            { class: 'acciones' },
            h(
              'button',
              { type: 'button', class: 'boton boton--secundario', id: esActivo ? 'desactivar' : 'reactivar', onclick: async () => {
                const codigo = await acciones.cambiaActivo(tipo, cosa.id, !esActivo);
                if (codigo) muestra(codigo);
              } },
              esActivo ? T.desactivar : T.reactivar,
            ),
            puedeBorrar && h('button', { type: 'button', class: 'boton boton--peligro', id: 'borrar', onclick: () => acciones.borra(tipo, cosa.id, cosa.nombre) }, T.borrar),
          ),
          !puedeBorrar && h('p', { class: 'evidencia__nota', id: 'no-se-borra' }, notaBorrado),
        ),
    ),
  };
}

export function vistaGestionColegio({ estado, params: [id], acciones }) {
  const colegio = NUEVO.has(id) ? null : estado.colegios.find((c) => c.id === id);
  if (!colegio && !NUEVO.has(id)) return vistaMensaje(T.noExiste, T.noExisteTexto, { href: '#/organizacion', texto: T.titulo });

  const b = abreBorrador(estado);
  const nombre = campoNombre(colegio?.nombre ?? '');
  const apoderados = estado.perfiles.filter((p) => p.rol === 'apoderado' && p.activo !== false).map((p) => ({ id: p.id, texto: p.etiqueta }));
  const apoderado = campoSelector('campo-apoderado', T.apoderado, apoderados, colegio ? apoderadoDe(estado, colegio.id)?.id : null);

  return formulario({
    titulo: colegio ? T.editarColegio(colegio.nombre) : T.nuevoColegio,
    cosa: colegio,
    tipo: 'colegio',
    campos: [nombre.nodo, apoderado.nodo],
    puedeBorrar: colegio ? puedeBorrarse(b, 'colegio', colegio.id) : false,
    notaBorrado: T.colegioNoSeBorra,
    acciones,
    alGuardar: () => acciones.guardaColegio({ id: colegio?.id ?? null, nombre: nombre.entrada.value, apoderadoId: apoderado.selector.value || null }),
  });
}

export function vistaGestionMesa({ estado, params: [id], acciones }) {
  const mesa = NUEVO.has(id) ? null : estado.mesas.find((m) => m.id === id);
  if (!mesa && !NUEVO.has(id)) return vistaMensaje(T.noExiste, T.noExisteTexto, { href: '#/organizacion', texto: T.titulo });

  const b = abreBorrador(estado);
  const conRegistros = mesa ? tieneRegistros(b, mesa.id) : false;
  const nombre = campoNombre(mesa?.nombre ?? '');
  // Para una mesa nueva, solo colegios activos; al editar, tambien el suyo aunque este cerrado.
  const colegios = estado.colegios.filter((c) => c.activo !== false || c.id === mesa?.colegioId).map((c) => ({ id: c.id, texto: c.nombre }));
  if (colegios.length === 0) return vistaMensaje(T.sinColegios, T.sinColegiosTexto, { href: '#/organizacion/colegio/nuevo', texto: T.nuevoColegio });
  const colegio = campoSelector('campo-colegio', T.colegio, colegios, mesa?.colegioId ?? colegios[0].id, {
    sinAsignar: false,
    bloqueado: conRegistros,
    ayuda: conRegistros ? T.colegioFijo : null,
  });
  const interventores = estado.perfiles.filter((p) => p.rol === 'interventor' && p.activo !== false).map((p) => ({ id: p.id, texto: p.etiqueta }));
  const interventor = campoSelector('campo-interventor', T.interventor, interventores, mesa ? interventorDe(estado, mesa.id)?.id : null, { ayuda: T.interventorAyuda });

  return formulario({
    titulo: mesa ? T.editarMesa(mesa.nombre) : T.nuevaMesa,
    cosa: mesa,
    tipo: 'mesa',
    campos: [nombre.nodo, colegio.nodo, interventor.nodo],
    puedeBorrar: mesa ? puedeBorrarse(b, 'mesa', mesa.id) : false,
    notaBorrado: T.mesaNoSeBorra,
    acciones,
    alGuardar: () =>
      acciones.guardaMesa({ id: mesa?.id ?? null, nombre: nombre.entrada.value, colegioId: colegio.selector.value, interventorId: interventor.selector.value || null }),
  });
}
