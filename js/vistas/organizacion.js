// Equipo: colegios, mesas y perfiles, con quien cubre que, y los nombres de
// las candidaturas. Solo administrador.

import { CONFIG } from '../config.js';
import { CANDIDATURA_MAXIMO } from '../gestion.js';
import { h, icono } from '../ui.js';
import { apoderadoDe, chipDeEstado, describeAmbito, interventorDe } from './comun.js';

const T = CONFIG.gestion.textos;

// Los tres nombres se editan y se guardan juntos: asi dos candidaturas pueden
// intercambiarse el nombre. No se anaden ni se quitan.
function seccionCandidaturas(estado, acciones) {
  const error = h('p', { class: 'campo__error', id: 'error-candidaturas', role: 'alert', hidden: true });
  const campos = estado.candidaturas.map(({ id, nombre }) => {
    const entrada = h('input', {
      id: `nombre-candidatura-${id}`,
      class: 'campo__entrada campo__entrada--nombre',
      type: 'text',
      maxlength: String(CANDIDATURA_MAXIMO),
      autocomplete: 'off',
      'aria-describedby': 'candidaturas-ayuda error-candidaturas',
      value: nombre,
    });
    return { id, entrada, nodo: h('div', { class: 'campo' }, h('label', { for: `nombre-candidatura-${id}` }, T.candidatura(id)), entrada) };
  });
  const muestra = (fallo) => {
    if (!fallo) return;
    error.textContent = CONFIG.gestion.errores[fallo.codigo] ?? CONFIG.textos.errorGuardado;
    error.hidden = false;
    (campos.find((campo) => campo.id === fallo.campo) ?? campos[0]).entrada.focus();
  };
  const guardar = h(
    'button',
    {
      type: 'button',
      class: 'boton',
      id: 'guardar-candidaturas',
      onclick: async () => {
        error.hidden = true;
        guardar.disabled = true;
        const fallo = await acciones.renombraCandidaturas(Object.fromEntries(campos.map((campo) => [campo.id, campo.entrada.value])));
        guardar.disabled = false;
        muestra(fallo);
      },
    },
    T.guardarCandidaturas,
  );
  const restaurar = h(
    'button',
    { type: 'button', class: 'boton boton--secundario', id: 'restaurar-candidaturas', onclick: async () => muestra(await acciones.restauraCandidaturas()) },
    T.restaurarCandidaturas,
  );
  return h(
    'section',
    { class: 'grupo', 'aria-labelledby': 'equipo-candidaturas' },
    h('h2', { id: 'equipo-candidaturas' }, T.candidaturas),
    h('p', null, T.candidaturasNota),
    h(
      'div',
      { class: 'grupo grupo--formulario' },
      campos.map((campo) => campo.nodo),
      h('p', { class: 'campo__ayuda', id: 'candidaturas-ayuda' }, T.candidaturaAyuda(CANDIDATURA_MAXIMO)),
      error,
      h('div', { class: 'acciones' }, guardar, restaurar),
    ),
  );
}

export function vistaOrganizacion({ estado, acciones }) {
  const perfiles = (rol) => estado.perfiles.filter((perfil) => perfil.rol === rol);

  const colegio = (c) =>
    h(
      'section',
      { class: 'grupo', 'aria-labelledby': `equipo-${c.id}`, 'data-colegio': c.id },
      h('h3', { id: `equipo-${c.id}` }, c.nombre, ' ', chipDeEstado(c)),
      h('p', { class: 'evidencia__nota' }, `${T.apoderado}: ${apoderadoDe(estado, c.id)?.etiqueta ?? T.sinAsignar}`),
      h('a', { class: 'boton boton--secundario boton--menor', href: `#/organizacion/colegio/${c.id}` }, T.editarColegio(c.nombre)),
      h(
        'table',
        { class: 'tabla' },
        h('caption', { class: 'oculto' }, T.mesasDe(c.nombre)),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, T.mesa), h('th', { scope: 'col' }, T.estado), h('th', { scope: 'col' }, T.interventor))),
        h(
          'tbody',
          null,
          estado.mesas
            .filter((mesa) => mesa.colegioId === c.id)
            .map((mesa) =>
              h(
                'tr',
                { 'data-mesa': mesa.id },
                h('th', { scope: 'row' }, h('a', { href: `#/organizacion/mesa/${mesa.id}` }, mesa.nombre)),
                h('td', null, chipDeEstado(mesa)),
                h('td', null, interventorDe(estado, mesa.id)?.etiqueta ?? T.sinAsignar),
              ),
            ),
        ),
      ),
    );

  const perfil = (p) => {
    const esActivo = p.activo !== false;
    return h(
      'li',
      { 'data-perfil-fila': p.id },
      h('span', { class: 'fila__titulo' }, p.etiqueta),
      h('span', { class: 'evidencia__nota' }, describeAmbito(p, estado) || T.sinAsignar),
      chipDeEstado(p),
      p.rol !== 'administrador' &&
        h(
          'button',
          { type: 'button', class: 'boton boton--secundario boton--menor', onclick: () => acciones.cambiaActivo('perfil', p.id, !esActivo) },
          esActivo ? T.desactivar : T.reactivar,
        ),
    );
  };

  return {
    titulo: T.titulo,
    nodo: h(
      'div',
      { class: 'vista' },
      h('h1', { tabindex: '-1' }, T.titulo),
      h('p', { class: 'entradilla' }, `${CONFIG.eleccion.ambito} · ${T.entradilla}`),
      h('p', { class: 'nota nota--pend', id: 'aviso-ficticios' }, icono('aviso'), h('span', null, T.avisoFicticios)),

      h(
        'section',
        { class: 'grupo', 'aria-labelledby': 'equipo-colegios' },
        h('h2', { id: 'equipo-colegios' }, T.colegiosYMesas),
        h(
          'div',
          { class: 'acciones' },
          h('a', { class: 'boton', id: 'nuevo-colegio', href: '#/organizacion/colegio/nuevo' }, T.nuevoColegio),
          h('a', { class: 'boton boton--secundario', id: 'nueva-mesa', href: '#/organizacion/mesa/nueva' }, T.nuevaMesa),
        ),
        estado.colegios.map(colegio),
      ),

      h(
        'section',
        { class: 'grupo', 'aria-labelledby': 'equipo-perfiles' },
        h('h2', { id: 'equipo-perfiles' }, T.perfiles),
        h('p', null, T.perfilesNota),
        h(
          'div',
          { class: 'acciones' },
          h('button', { type: 'button', class: 'boton boton--secundario', id: 'nuevo-interventor', onclick: () => acciones.creaPerfil('interventor') }, T.nuevoInterventor),
          h('button', { type: 'button', class: 'boton boton--secundario', id: 'nuevo-apoderado', onclick: () => acciones.creaPerfil('apoderado') }, T.nuevoApoderado),
        ),
        ['administrador', 'apoderado', 'interventor'].map((rol) => h('ul', { class: 'filas filas--perfiles', role: 'list', 'data-rol': rol }, perfiles(rol).map(perfil))),
      ),

      seccionCandidaturas(estado, acciones),
    ),
  };
}
