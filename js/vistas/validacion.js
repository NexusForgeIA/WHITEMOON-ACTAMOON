// Doble confirmacion: otro perfil valida o devuelve el acta enviada.

import { CONFIG } from '../config.js';
import { puedeValidar } from '../permisos.js';
import { h, icono } from '../ui.js';
import { formateaHora } from './comun.js';

const T = CONFIG.validacion.textos;

const etiquetaDe = (estado, id) => estado.perfiles.find((perfil) => perfil.id === id)?.etiqueta ?? id;

// Como quedo el acta tras pasar por el validador. Nada si sigue pendiente.
export function resultadoValidacion(acta, estado) {
  if (acta.estado === 'validada') {
    return h(
      'p',
      { class: 'nota nota--ok', id: 'acta-validada' },
      icono('ok'),
      h('span', null, T.validadaPor(etiquetaDe(estado, acta.validadaPor), formateaHora(acta.validadaEn))),
    );
  }
  if (acta.estado === 'devuelta') {
    return h(
      'div',
      { class: 'nota nota--error', id: 'acta-devuelta' },
      icono('no'),
      h(
        'div',
        null,
        h('strong', null, T.devueltaTitulo),
        h('p', null, T.devueltaPor(etiquetaDe(estado, acta.devolucion.por), formateaHora(acta.devolucion.en))),
        h('p', null, `${T.motivoDevolucion}: ${acta.devolucion.motivo}`),
      ),
    );
  }
  return null;
}

// Botones de validar y devolver. Solo para quien puede validar esta acta.
export function formularioValidacion({ acta, mesa, estado, acciones }) {
  if (!puedeValidar(estado.perfil, mesa, acta)) return null;

  const error = h('p', { class: 'campo__error', role: 'alert', hidden: true }, T.faltaMotivo);
  const motivo = h('textarea', {
    id: 'motivo-devolucion',
    class: 'campo__entrada campo__entrada--texto',
    rows: '3',
    'aria-describedby': 'motivo-devolucion-ayuda',
  });
  const validar = h('button', { type: 'button', class: 'boton', id: 'validar-acta', onclick: () => ejecuta(() => acciones.validarActa(mesa)) }, icono('ok'), T.validar);
  const devolver = h(
    'button',
    {
      type: 'button',
      class: 'boton boton--secundario',
      id: 'devolver-acta',
      'aria-expanded': 'false',
      'aria-controls': 'devolucion',
      onclick: () => abre(true),
    },
    T.devolver,
  );
  const confirmar = h(
    'button',
    {
      type: 'button',
      class: 'boton boton--peligro',
      id: 'confirmar-devolucion',
      onclick: () => {
        const valido = motivo.value.trim().length >= CONFIG.validacion.motivoMinimo;
        error.hidden = valido;
        motivo.setAttribute('aria-invalid', String(!valido));
        if (!valido) motivo.focus();
        else ejecuta(() => acciones.devolverActa(mesa, motivo.value));
      },
    },
    T.confirmarDevolucion,
  );
  const cancelar = h('button', { type: 'button', class: 'boton boton--secundario', onclick: () => abre(false) }, T.cancelar);
  const devolucion = h(
    'fieldset',
    { class: 'devolucion', id: 'devolucion', hidden: true },
    h('legend', null, T.devolver),
    h(
      'div',
      { class: 'campo' },
      h('label', { for: 'motivo-devolucion' }, T.motivoDevolucion),
      motivo,
      h('p', { class: 'campo__ayuda', id: 'motivo-devolucion-ayuda' }, T.motivoAyuda(CONFIG.validacion.motivoMinimo)),
      error,
    ),
    h('div', { class: 'acciones' }, confirmar, cancelar),
  );

  function abre(abierto) {
    devolucion.hidden = !abierto;
    devolver.setAttribute('aria-expanded', String(abierto));
    (abierto ? motivo : devolver).focus();
  }

  // Evita el doble toque mientras se guarda.
  async function ejecuta(accion) {
    const botones = [validar, devolver, confirmar, cancelar];
    botones.forEach((boton) => (boton.disabled = true));
    if (!(await accion())) botones.forEach((boton) => (boton.disabled = false));
  }

  return h(
    'section',
    { class: 'grupo', 'aria-labelledby': 'validacion-titulo' },
    h('h2', { id: 'validacion-titulo' }, T.titulo),
    h('p', null, T.instruccion),
    h('div', { class: 'acciones' }, validar, devolver),
    devolucion,
  );
}
