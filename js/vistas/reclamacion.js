// Reclamaciones de una mesa: texto, foto opcional y hora, registradas en el
// momento. No se editan ni se borran.

import { CONFIG } from '../config.js';
import { leer } from '../db.js';
import { puedeReclamar } from '../permisos.js';
import { h, icono, urlTemporal } from '../ui.js';
import { formateaHora, nombreColegio, vistaMensaje } from './comun.js';
import { campoFoto } from './foto-campo.js';

const T = CONFIG.reclamaciones.textos;

export function vistaReclamacion({ estado, params: [mesaId], acciones }) {
  const mesa = estado.mesas.find((m) => m.id === mesaId);
  if (!mesa || !puedeReclamar(estado.perfil, mesa)) {
    return vistaMensaje('Reclamación no disponible', `El perfil ${estado.perfil.etiqueta} no registra reclamaciones en esta mesa.`, {
      href: '#/mesas',
      texto: 'Volver a las mesas',
    });
  }

  const borrador = { foto: null };
  const error = h('p', { class: 'campo__error', role: 'alert', hidden: true }, T.faltaTexto);
  const texto = h('textarea', {
    id: 'reclamacion-texto',
    class: 'campo__entrada campo__entrada--texto',
    rows: '5',
    'aria-describedby': 'reclamacion-ayuda',
  });
  const foto = campoFoto({
    id: 'foto-reclamacion',
    alt: T.fotoAlt(mesa.nombre),
    destino: borrador,
    alCambiar: () => {},
    hacer: T.anadirFoto,
  });
  const guardar = h(
    'button',
    {
      type: 'button',
      class: 'boton',
      id: 'guardar-reclamacion',
      onclick: async () => {
        const valido = texto.value.trim().length >= CONFIG.reclamaciones.textoMinimo;
        error.hidden = valido;
        texto.setAttribute('aria-invalid', String(!valido));
        if (!valido) {
          texto.focus();
          return;
        }
        guardar.disabled = true;
        if (!(await acciones.registrarReclamacion({ mesa, texto: texto.value, foto: borrador.foto }))) guardar.disabled = false;
      },
    },
    T.guardar,
  );

  return {
    titulo: T.tituloNueva(mesa.nombre),
    nodo: h(
      'div',
      { class: 'vista' },
      h('a', { class: 'volver', href: `#/mesa/${mesa.id}` }, icono('atras'), mesa.nombre),
      h('h1', { tabindex: '-1' }, T.tituloNueva(mesa.nombre)),
      h('p', { class: 'entradilla' }, nombreColegio(estado, mesa.colegioId)),
      h('p', { class: 'nota nota--pend' }, icono('aviso'), h('span', null, CONFIG.acta.textos.avisoFotos)),
      h(
        'div',
        { class: 'campo' },
        h('label', { for: 'reclamacion-texto' }, T.texto),
        texto,
        h('p', { class: 'campo__ayuda', id: 'reclamacion-ayuda' }, T.textoAyuda(CONFIG.reclamaciones.textoMinimo)),
        error,
      ),
      h('section', { class: 'grupo', 'aria-labelledby': 'reclamacion-foto' }, h('h2', { id: 'reclamacion-foto' }, T.foto), foto.nodos),
      h('div', { class: 'grupo' }, h('p', { class: 'campo__ayuda' }, T.horaNota), guardar),
    ),
  };
}

function fotoDeReclamacion(reclamacion, mesa) {
  const zona = h('div', { class: 'foto' }, h('p', null, CONFIG.acta.textos.cargandoFoto));
  const perdida = () => zona.replaceChildren(h('p', null, CONFIG.acta.textos.fotoPerdida));
  leer('fotos', reclamacion.fotoId).then((registro) => {
    if (!registro) return perdida();
    zona.replaceChildren(
      h('img', { class: 'foto__imagen foto__imagen--menor', src: urlTemporal(registro.vista), alt: T.fotoAlt(mesa.nombre) }),
      h('p', { class: 'evidencia__nota' }, T.huellaFoto),
      h('code', { class: 'huella' }, reclamacion.fotoSha256),
    );
  }, perdida);
  return zona;
}

// Reclamaciones ya registradas, en la ficha de la mesa.
export function listaReclamaciones(mesa, estado) {
  const reclamaciones = estado.reclamaciones
    .filter((reclamacion) => reclamacion.mesaId === mesa.id)
    .sort((a, b) => a.creadaEn.localeCompare(b.creadaEn));
  const autor = (id) => estado.perfiles.find((perfil) => perfil.id === id)?.etiqueta ?? id;

  return h(
    'section',
    { class: 'grupo', 'aria-labelledby': 'reclamaciones-titulo' },
    h('h2', { id: 'reclamaciones-titulo' }, T.titulo),
    reclamaciones.length === 0
      ? h('p', { id: 'sin-reclamaciones' }, T.ninguna)
      : h(
          'ol',
          { class: 'reclamaciones', role: 'list' },
          reclamaciones.map((reclamacion) =>
            h(
              'li',
              null,
              h('p', { class: 'reclamaciones__meta' }, T.autor(autor(reclamacion.perfilId), formateaHora(reclamacion.creadaEn))),
              h('p', { class: 'reclamaciones__texto' }, reclamacion.texto),
              reclamacion.fotoId && fotoDeReclamacion(reclamacion, mesa),
            ),
          ),
        ),
    puedeReclamar(estado.perfil, mesa) &&
      h('a', { class: 'boton boton--secundario', id: 'nueva-reclamacion', href: `#/mesa/${mesa.id}/reclamacion` }, T.nueva),
  );
}
