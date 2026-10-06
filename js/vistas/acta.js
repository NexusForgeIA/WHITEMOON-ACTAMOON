import { actaDe } from '../actas.js';
import { CONFIG } from '../config.js';
import { leer } from '../db.js';
import { ErrorFoto, preparaFoto } from '../foto.js';
import { puedeCapturar } from '../permisos.js';
import { avisa, h, icono, urlTemporal } from '../ui.js';
import { leeEntero, puedeEnviar, validaActa } from '../validaciones.js';
import { formateaHora, nombreColegio, tamano, vistaMensaje } from './comun.js';

const T = CONFIG.acta.textos;

// Lo tecleado en cada mesa mientras no se envia. Vive en memoria: una recarga
// de la pagina lo pierde.
const borradores = new Map();

function borradorDe(mesaId) {
  if (!borradores.has(mesaId)) borradores.set(mesaId, { textos: {}, foto: null, confirma: false, motivo: '' });
  return borradores.get(mesaId);
}

function camposDelActa() {
  return [
    ...CONFIG.acta.campos,
    ...CONFIG.candidaturas.map(({ id, nombre }) => ({ id: `candidatura-${id}`, etiqueta: nombre, candidatura: true })),
  ];
}

function cifrasDe(textos) {
  return {
    ...Object.fromEntries(CONFIG.acta.campos.map(({ id }) => [id, leeEntero(textos[id])])),
    candidaturas: Object.fromEntries(
      CONFIG.candidaturas.map(({ id }) => [id, leeEntero(textos[`candidatura-${id}`])]),
    ),
  };
}

// Frases que explican cada regla incumplida.
function explicaDescuadre(validacion) {
  return validacion.reglas
    .filter((regla) => !regla.ok)
    .map((regla) => {
      if (regla.id === 'votantes-electores') return T.masVotantes(regla.diferencia);
      return regla.diferencia > 0 ? T.sobran(regla.diferencia) : T.faltan(-regla.diferencia);
    });
}

function datosDeFoto(sha256, capturadaEn, bytes) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(sha256);
      avisa(T.huellaCopiada);
    } catch {
      avisa(T.huellaNoCopiada, 'error');
    }
  };
  return h(
    'dl',
    { class: 'evidencia' },
    h(
      'div',
      null,
      h('dt', null, T.huella),
      h('dd', null, h('code', { class: 'huella' }, sha256)),
      h('dd', null, h('button', { type: 'button', class: 'boton boton--secundario boton--menor', onclick: copiar }, T.copiarHuella)),
    ),
    h('div', null, h('dt', null, T.hora), h('dd', null, formateaHora(capturadaEn)), h('dd', { class: 'evidencia__nota' }, T.horaNota)),
    bytes != null && h('div', null, h('dt', null, T.tamano), h('dd', null, tamano(bytes))),
  );
}

export function vistaActa({ estado, params: [mesaId], acciones }) {
  const mesa = estado.mesas.find((m) => m.id === mesaId);
  if (!mesa || !puedeCapturar(estado.perfil, mesa)) {
    return vistaMensaje('Captura no disponible', `El perfil ${estado.perfil.etiqueta} no captura el acta de esta mesa.`, {
      href: '#/mesas',
      texto: 'Volver a las mesas',
    });
  }
  if (actaDe(estado.actas, mesa.id)) {
    return vistaMensaje('Esta mesa ya tiene acta', 'El acta está enviada y pendiente de validar.', {
      href: `#/mesa/${mesa.id}`,
      texto: `Ver ${mesa.nombre}`,
    });
  }

  const borrador = borradorDe(mesa.id);
  let intentado = false;

  // ---- Foto ----------------------------------------------------------------
  const zonaFoto = h('div', { class: 'foto', 'aria-live': 'polite' });
  const errorFoto = h('p', { class: 'campo__error', role: 'alert', hidden: true });
  const etiquetaFoto = h('label', { class: 'boton', for: 'foto-acta' });
  const entradaFoto = h('input', {
    type: 'file',
    id: 'foto-acta',
    class: 'oculto',
    accept: 'image/*',
    capture: 'environment',
    onchange: async () => {
      const [archivo] = entradaFoto.files;
      entradaFoto.value = '';
      if (!archivo) return;
      errorFoto.hidden = true;
      zonaFoto.replaceChildren(h('p', null, T.procesando));
      try {
        borrador.foto = await preparaFoto(archivo, CONFIG.acta.fotoLadoMaximo);
      } catch (error) {
        if (!(error instanceof ErrorFoto)) throw error;
        errorFoto.textContent = T.fotoIlegible;
        errorFoto.hidden = false;
      }
      pintaFoto();
      actualiza();
    },
  });

  function pintaFoto() {
    const { foto } = borrador;
    etiquetaFoto.replaceChildren(icono('camara'), foto ? T.repetirFoto : T.hacerFoto);
    zonaFoto.replaceChildren(
      ...(foto
        ? [
            h('img', { class: 'foto__imagen', src: urlTemporal(foto.vista), width: foto.ancho, height: foto.alto, alt: T.fotoAlt(mesa.nombre) }),
            datosDeFoto(foto.sha256, foto.capturadaEn, foto.bytes),
          ]
        : []),
    );
  }

  // ---- Cifras --------------------------------------------------------------
  const campos = camposDelActa().map((campo) => {
    const error = h('p', { class: 'campo__error', id: `error-${campo.id}`, hidden: true });
    const entrada = h('input', {
      id: `cifra-${campo.id}`,
      class: 'campo__entrada',
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      maxlength: '7',
      'aria-describedby': `error-${campo.id}`,
      value: borrador.textos[campo.id] ?? '',
      oninput: () => {
        borrador.textos[campo.id] = entrada.value;
        actualiza();
      },
    });
    return { ...campo, entrada, error, nodo: h('div', { class: 'campo' }, h('label', { for: entrada.id }, campo.etiqueta), entrada, error) };
  });

  const resumen = h('div', { class: 'nota', role: 'status' });

  // ---- Descuadre -----------------------------------------------------------
  const casilla = h('input', {
    type: 'checkbox',
    id: 'confirma-papel',
    checked: borrador.confirma,
    onchange: () => {
      borrador.confirma = casilla.checked;
      actualiza();
    },
  });
  const motivo = h('textarea', {
    id: 'motivo',
    class: 'campo__entrada campo__entrada--texto',
    rows: '3',
    'aria-describedby': 'motivo-ayuda',
    oninput: () => {
      borrador.motivo = motivo.value;
      actualiza();
    },
  });
  motivo.value = borrador.motivo;
  const descuadre = h(
    'fieldset',
    { class: 'descuadre', hidden: true },
    h('legend', null, T.descuadreTitulo),
    h('p', null, T.descuadreTexto),
    h('label', { class: 'casilla', for: 'confirma-papel' }, casilla, h('span', null, T.confirmaPapel)),
    h(
      'div',
      { class: 'campo' },
      h('label', { for: 'motivo' }, T.motivo),
      motivo,
      h('p', { class: 'campo__ayuda', id: 'motivo-ayuda' }, T.motivoAyuda(CONFIG.acta.motivoMinimo)),
    ),
  );

  // ---- Envio ---------------------------------------------------------------
  const pendientes = h('ul', { class: 'pendientes', role: 'alert', hidden: true });
  const enviar = h('button', { type: 'button', class: 'boton', id: 'enviar-acta', onclick: envia }, T.enviar);

  function estadoActual() {
    const cifras = cifrasDe(borrador.textos);
    const validacion = validaActa(cifras, CONFIG.candidaturas);
    const envio = puedeEnviar({
      validacion,
      hayFoto: Boolean(borrador.foto),
      confirmaPapel: borrador.confirma,
      motivo: borrador.motivo,
      motivoMinimo: CONFIG.acta.motivoMinimo,
    });
    return { cifras, validacion, envio };
  }

  function actualiza() {
    const { validacion, envio } = estadoActual();

    for (const campo of campos) {
      const fallo = validacion.errores.find((error) => error.campo === campo.id);
      // Una cifra mal escrita se avisa al momento; una vacia, solo tras intentar enviar.
      const visible = fallo && (fallo.tipo === 'invalido' || intentado);
      campo.error.textContent = visible ? (fallo.tipo === 'invalido' ? T.cifraInvalida : T.cifraFalta) : '';
      campo.error.hidden = !visible;
      campo.entrada.setAttribute('aria-invalid', String(Boolean(visible)));
    }

    if (!validacion.completa) {
      resumen.className = 'nota nota--neutra';
      resumen.replaceChildren(icono('pendiente'), h('span', null, T.incompleta));
    } else if (validacion.cuadra) {
      resumen.className = 'nota nota--ok';
      resumen.replaceChildren(icono('ok'), h('span', null, T.cuadra));
    } else {
      resumen.className = 'nota nota--error';
      resumen.replaceChildren(
        icono('aviso'),
        h('div', null, h('strong', null, T.noCuadra), explicaDescuadre(validacion).map((frase) => h('p', null, frase))),
      );
    }
    descuadre.hidden = !(validacion.completa && !validacion.cuadra);

    pendientes.replaceChildren(...(intentado ? envio.falta.map((clave) => h('li', null, T.falta[clave])) : []));
    pendientes.hidden = !intentado || envio.ok;
    return { validacion, envio };
  }

  async function envia() {
    intentado = true;
    const { validacion, envio } = actualiza();
    if (!envio.ok) {
      const primero = {
        foto: entradaFoto,
        cifras: campos.find((campo) => validacion.errores.some((error) => error.campo === campo.id))?.entrada,
        confirmacion: casilla,
        motivo,
      }[envio.falta[0]];
      primero?.focus();
      return;
    }
    enviar.disabled = true;
    const enviado = await acciones.enviarActa({
      mesa,
      cifras: cifrasDe(borrador.textos),
      validacion,
      motivo: borrador.motivo,
      foto: borrador.foto,
    });
    if (enviado) borradores.delete(mesa.id);
    else enviar.disabled = false;
  }

  pintaFoto();
  actualiza();

  const generales = campos.filter((campo) => !campo.candidatura);
  const candidaturas = campos.filter((campo) => campo.candidatura);

  return {
    titulo: `Acta de la ${mesa.nombre}`,
    nodo: h(
      'div',
      { class: 'vista' },
      h('a', { class: 'volver', href: `#/mesa/${mesa.id}` }, icono('atras'), mesa.nombre),
      h('h1', { tabindex: '-1' }, `Acta de la ${mesa.nombre}`),
      h('p', { class: 'entradilla' }, nombreColegio(estado, mesa.colegioId)),
      h('p', { class: 'nota nota--pend' }, icono('aviso'), h('span', null, T.avisoFotos)),

      h(
        'section',
        { class: 'grupo', 'aria-labelledby': 'acta-foto' },
        h('h2', { id: 'acta-foto' }, T.tituloFoto),
        entradaFoto,
        etiquetaFoto,
        errorFoto,
        zonaFoto,
      ),

      h(
        'section',
        { class: 'grupo', 'aria-labelledby': 'acta-cifras' },
        h('h2', { id: 'acta-cifras' }, T.tituloCifras),
        h('div', { class: 'campos' }, generales.map((campo) => campo.nodo)),
        h(
          'fieldset',
          { class: 'campos-grupo' },
          h('legend', null, T.tituloCandidaturas),
          h('div', { class: 'campos' }, candidaturas.map((campo) => campo.nodo)),
        ),
        resumen,
        descuadre,
      ),

      h('div', { class: 'grupo' }, pendientes, enviar),
    ),
  };
}

// Acta ya enviada, tal como se ve en la ficha de la mesa.
export function detalleActa(acta, mesa, estado) {
  const foto = h('div', { class: 'foto' }, h('p', null, T.cargandoFoto));
  leer('fotos', acta.fotoId).then(
    (registro) => {
      foto.replaceChildren(
        registro
          ? h('img', { class: 'foto__imagen', src: urlTemporal(registro.vista), alt: T.fotoAlt(mesa.nombre) })
          : h('p', null, T.fotoPerdida),
      );
    },
    () => foto.replaceChildren(h('p', null, T.fotoPerdida)),
  );

  const fila = (etiqueta, valor) => h('tr', null, h('th', { scope: 'row' }, etiqueta), h('td', null, String(valor)));
  const remitente = estado.perfiles.find((perfil) => perfil.id === acta.enviadaPor)?.etiqueta ?? acta.enviadaPor;

  return [
    acta.descuadre &&
      h(
        'div',
        { class: 'nota nota--error' },
        icono('aviso'),
        h(
          'div',
          null,
          h('strong', null, T.enviadaConDescuadre),
          explicaDescuadre(validaActa(acta.cifras, CONFIG.candidaturas)).map((frase) => h('p', null, frase)),
          h('p', null, `${T.motivo}: ${acta.descuadre.motivo}`),
        ),
      ),
    h(
      'section',
      { class: 'grupo', 'aria-labelledby': 'detalle-cifras' },
      h('h2', { id: 'detalle-cifras' }, T.tituloCifras),
      h(
        'table',
        { class: 'tabla tabla--cifras' },
        h(
          'tbody',
          null,
          CONFIG.acta.campos.map(({ id, etiqueta }) => fila(etiqueta, acta.cifras[id])),
          CONFIG.candidaturas.map(({ id, nombre }) => fila(nombre, acta.cifras.candidaturas[id])),
        ),
      ),
      h('p', { class: 'evidencia__nota' }, T.enviadaPor(remitente, formateaHora(acta.enviadaEn))),
    ),
    h(
      'section',
      { class: 'grupo', 'aria-labelledby': 'detalle-foto' },
      h('h2', { id: 'detalle-foto' }, T.tituloFoto),
      foto,
      datosDeFoto(acta.fotoSha256, acta.capturadaEn, null),
    ),
  ];
}
