import { actaDe, actaDevuelta, actaValidada, nuevaActa, registroFoto } from './actas.js';
import { nuevaEntrada } from './auditoria.js';
import { CONFIG } from './config.js';
import { datosEjemplo } from './datos-ejemplo.js';
import * as db from './db.js';
import { navegacion, puedeReclamar, puedeValidar, puedeVer, resuelve, rutaInicial } from './permisos.js';
import { avisa, confirmar, enlaceDeContacto, h, icono, liberaUrls, limpiaAvisos } from './ui.js';
import { vistaActa } from './vistas/acta.js';
import { vistaAuditoria } from './vistas/auditoria.js';
import { vistaAyuda } from './vistas/ayuda.js';
import { vistaMensaje } from './vistas/comun.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaMesa, vistaMesas } from './vistas/mesas.js';
import { vistaOrganizacion } from './vistas/organizacion.js';
import { vistaReclamacion } from './vistas/reclamacion.js';

const VISTAS = {
  inicio: vistaInicio,
  mesas: vistaMesas,
  mesa: vistaMesa,
  acta: vistaActa,
  reclamacion: vistaReclamacion,
  auditoria: vistaAuditoria,
  organizacion: vistaOrganizacion,
  ayuda: vistaAyuda,
};

const estado = { perfiles: [], colegios: [], mesas: [], actas: [], reclamaciones: [], auditoria: [], perfil: null };

const D = CONFIG.auditoria.detalle;
const ahora = () => new Date().toISOString();

// Guarda los datos de una accion junto con su entrada de auditoria: o entra
// todo o no entra nada.
async function guardaConRegistro(lotes, accion, mesaId, detalle) {
  const entrada = await nuevaEntrada(estado.auditoria.at(-1) ?? null, {
    hora: ahora(),
    perfil: estado.perfil,
    accion,
    mesaId,
    detalle,
  });
  await db.guardar({ ...lotes, auditoria: [entrada] });
}

const acciones = {
  async elegirPerfil(id) {
    await intenta(async () => {
      await db.guardar({ meta: [{ clave: 'perfilActivo', valor: id }] });
      await recarga();
      ir(rutaInicial(estado.perfil));
    });
  },

  async cargarEjemplo() {
    await intenta(async () => {
      await db.pidePersistencia();
      const datos = datosEjemplo();
      await guardaConRegistro(
        datos,
        'datos-cargados',
        null,
        D.datosCargados(datos.colegios.length, datos.mesas.length, datos.perfiles.length),
      );
      await recarga();
      pinta({ foco: true });
      avisa('Datos de ejemplo cargados.');
    });
  },

  async reiniciar() {
    const aceptado = await confirmar({
      titulo: CONFIG.textos.reiniciarTitulo,
      texto: CONFIG.textos.reiniciarTexto,
      aceptar: 'Sí, borrar todo',
    });
    if (!aceptado) return;
    await intenta(async () => {
      await db.vaciarTodo();
      await recarga();
      ir('#/', 'Demo reiniciada. No queda ningún dato guardado.');
    });
  },

  // Guarda foto y acta juntas: o entran las dos o ninguna. Devuelve si se guardo.
  // Si corrige un acta devuelta, es una version nueva; la anterior no se toca.
  enviarActa({ mesa, cifras, validacion, motivo, foto }) {
    return intenta(async () => {
      // Una foto con id ya esta guardada: es la del acta devuelta, sin repetir.
      const fotoId = foto.id ?? crypto.randomUUID();
      const acta = nuevaActa({
        id: crypto.randomUUID(),
        fotoId,
        mesaId: mesa.id,
        perfil: estado.perfil,
        cifras,
        validacion,
        motivo,
        foto,
        enviadaEn: ahora(),
        version: (actaDe(estado.actas, mesa.id)?.version ?? 0) + 1,
      });
      const fotos = foto.id ? {} : { fotos: [registroFoto(fotoId, foto)] };
      await guardaConRegistro({ ...fotos, actas: [acta] }, 'acta-enviada', mesa.id, D.actaEnviada(acta));
      await recarga();
      ir(`#/mesa/${mesa.id}`, CONFIG.acta.textos.enviada);
    });
  },

  // Doble confirmacion. Devuelven si se guardo.
  validarActa(mesa) {
    return resuelveActa(mesa, 'acta-validada', (acta) => actaValidada(acta, estado.perfil, ahora()), D.actaValidada, CONFIG.validacion.textos.validada);
  },

  devolverActa(mesa, motivo) {
    return resuelveActa(mesa, 'acta-devuelta', (acta) => actaDevuelta(acta, estado.perfil, motivo, ahora()), D.actaDevuelta, CONFIG.validacion.textos.devuelta);
  },

  registrarReclamacion({ mesa, texto, foto }) {
    if (!puedeReclamar(estado.perfil, mesa)) return false;
    return intenta(async () => {
      const fotoId = foto ? crypto.randomUUID() : null;
      const reclamacion = {
        id: crypto.randomUUID(),
        mesaId: mesa.id,
        texto: texto.trim(),
        fotoId,
        fotoSha256: foto?.sha256 ?? null,
        perfilId: estado.perfil.id,
        creadaEn: ahora(),
      };
      const fotos = foto ? { fotos: [registroFoto(fotoId, foto)] } : {};
      await guardaConRegistro({ ...fotos, reclamaciones: [reclamacion] }, 'reclamacion-registrada', mesa.id, D.reclamacion(reclamacion));
      await recarga();
      ir(`#/mesa/${mesa.id}`, CONFIG.reclamaciones.textos.registrada);
    });
  },
};

function resuelveActa(mesa, accion, transforma, detalle, aviso) {
  const acta = actaDe(estado.actas, mesa.id);
  if (!puedeValidar(estado.perfil, mesa, acta)) return false;
  return intenta(async () => {
    const resuelta = transforma(acta);
    await guardaConRegistro({ actas: [resuelta] }, accion, mesa.id, detalle(resuelta));
    await recarga();
    pinta({ foco: true });
    avisa(aviso);
  });
}

// Ejecuta una accion que escribe en la base de datos y traduce el fallo a un
// mensaje que se entienda. Devuelve si la accion termino bien.
async function intenta(fn) {
  try {
    await fn();
    return true;
  } catch (error) {
    if (!(error instanceof db.ErrorAlmacenamiento)) throw error;
    avisa(error.sinEspacio ? CONFIG.textos.sinEspacio : CONFIG.textos.errorGuardado, 'error');
    return false;
  }
}

async function recarga() {
  const [perfiles, colegios, mesas, actas, reclamaciones, auditoria, activo] = await Promise.all([
    db.todos('perfiles'),
    db.todos('colegios'),
    db.todos('mesas'),
    db.todos('actas'),
    db.todos('reclamaciones'),
    db.todos('auditoria'),
    db.leer('meta', 'perfilActivo'),
  ]);
  Object.assign(estado, {
    perfiles,
    colegios,
    mesas,
    actas,
    reclamaciones,
    auditoria,
    perfil: perfiles.find((perfil) => perfil.id === activo?.valor) ?? null,
  });
}

let avisoPendiente = null;

// Navega y repinta aunque el hash no cambie. El aviso, si lo hay, se muestra
// ya en la vista de destino.
function ir(hash, aviso = null) {
  if (location.hash === hash) {
    pinta({ foco: true });
    if (aviso) avisa(aviso);
  } else {
    avisoPendiente = aviso;
    location.hash = hash;
  }
}

function vistaActual() {
  const destino = resuelve(location.hash);
  if (!destino) {
    return { vista: vistaMensaje('Página no encontrada', 'Esta dirección no existe en la demo.', { href: '#/', texto: 'Ir al inicio' }) };
  }
  const { ruta, params } = destino;
  if (!puedeVer(estado.perfil, ruta)) {
    const vista = estado.perfil
      ? vistaMensaje('Vista no disponible', `El perfil ${estado.perfil.etiqueta} no tiene acceso a esta vista.`, {
          href: rutaInicial(estado.perfil),
          texto: 'Volver a lo tuyo',
        })
      : vistaMensaje('Elige antes un perfil', 'Esta vista necesita un perfil activo.', { href: '#/', texto: 'Elegir perfil' });
    return { vista };
  }
  return { ruta, vista: VISTAS[ruta.id]({ estado, params, acciones }) };
}

function pinta({ foco = false } = {}) {
  liberaUrls();
  const { ruta, vista } = vistaActual();
  document.title = `${vista.titulo} · ${CONFIG.producto} (demo)`;
  document.getElementById('contenido').replaceChildren(vista.nodo);
  pintaCabecera();
  pintaNavegacion(ruta);
  if (foco) {
    window.scrollTo(0, 0);
    vista.nodo.querySelector('h1').focus();
  }
}

function pintaCabecera() {
  const enlace = document.getElementById('perfil-activo');
  enlace.replaceChildren(
    icono('perfil'),
    h('span', null, estado.perfil ? estado.perfil.etiqueta : 'Sin perfil'),
    h('span', { class: 'oculto' }, '. Cambiar de perfil'),
  );
}

function pintaNavegacion(ruta) {
  const activa = ruta?.padre ?? ruta?.id;
  document.getElementById('nav-lista').replaceChildren(
    ...navegacion(estado.perfil).map((destino) =>
      h(
        'li',
        null,
        h(
          'a',
          { href: destino.href, 'aria-current': destino.id === activa ? 'page' : null },
          icono(destino.icono),
          h('span', null, destino.etiqueta),
        ),
      ),
    ),
  );
}

function preparaDialogo() {
  const dialogo = document.getElementById('dialogo');
  document.getElementById('dialogo-no').addEventListener('click', () => dialogo.close('no'));
  document.getElementById('dialogo-si').addEventListener('click', () => dialogo.close('si'));
}

function pintaContacto() {
  const contacto = enlaceDeContacto();
  if (!contacto) return;
  const parrafo = document.getElementById('pie-contacto');
  parrafo.replaceChildren(h('span', null, CONFIG.textos.contacto), contacto);
  parrafo.hidden = false;
}

async function arranca() {
  preparaDialogo();
  pintaContacto();
  document.getElementById('ambito').textContent = `${CONFIG.eleccion.tipo} · ${CONFIG.eleccion.ambito}`;
  try {
    await recarga();
  } catch {
    avisa(CONFIG.textos.errorGuardado, 'error');
  }
  pinta();
  window.addEventListener('hashchange', () => {
    limpiaAvisos();
    pinta({ foco: true });
    if (avisoPendiente) avisa(avisoPendiente);
    avisoPendiente = null;
  });
}

arranca();
