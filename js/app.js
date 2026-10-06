import { actaDe, actaDevuelta, actaValidada, nuevaActa, registroFoto } from './actas.js';
import { nuevaEntrada } from './auditoria.js';
import { usaNombres } from './candidaturas.js';
import { CONFIG } from './config.js';
import { datosEjemplo } from './datos-ejemplo.js';
import { pdfDelPanel, pdfDeMesa } from './documentos.js';
import * as db from './db.js';
import * as gestion from './gestion.js';
import { calculaKpi } from './kpi.js';
import { preparaOffline } from './offline.js';
import { arranque, mesasVisibles, navegacion, perfilVigente, puedeCapturar, puedeReclamar, puedeValidar, puedeVer, resuelve, rutaInicial } from './permisos.js';
import { avisa, confirmar, descarga, enlaceDeContacto, h, icono, liberaUrls, limpiaAvisos } from './ui.js';
import { vistaActa } from './vistas/acta.js';
import { vistaActividad } from './vistas/actividad.js';
import { vistaAuditoria } from './vistas/auditoria.js';
import { vistaGestionColegio, vistaGestionMesa } from './vistas/gestion.js';
import { vistaAyuda } from './vistas/ayuda.js';
import { formateaHora, vistaMensaje } from './vistas/comun.js';
import { vistaBienvenida, vistaSelector } from './vistas/inicio.js';
import { vistaMesa, vistaMesas } from './vistas/mesas.js';
import { vistaOrganizacion } from './vistas/organizacion.js';
import { vistaPanel } from './vistas/panel.js';
import { vistaReclamacion } from './vistas/reclamacion.js';

const VISTAS = {
  perfil: vistaSelector,
  mesas: vistaMesas,
  mesa: vistaMesa,
  acta: vistaActa,
  reclamacion: vistaReclamacion,
  panel: vistaPanel,
  actividad: vistaActividad,
  'gestion-colegio': vistaGestionColegio,
  'gestion-mesa': vistaGestionMesa,
  auditoria: vistaAuditoria,
  organizacion: vistaOrganizacion,
  ayuda: vistaAyuda,
};

const estado = { perfiles: [], colegios: [], mesas: [], actas: [], reclamaciones: [], auditoria: [], candidaturas: usaNombres(null), perfil: null };

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
    if (estado.perfiles.find((perfil) => perfil.id === id)?.activo === false) return;
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
      // Desde la bienvenida, el arranque ya ensena el selector.
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
    if (!puedeCapturar(estado.perfil, mesa)) return false;
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

// Los PDF se generan en el navegador con lo que hay guardado.
Object.assign(acciones, {
  async descargarPdfMesa(mesa) {
    const acta = actaDe(estado.actas, mesa.id);
    const foto = await db.leer('fotos', acta.fotoId);
    const pdf = pdfDeMesa({
      mesa,
      colegio: estado.colegios.find((colegio) => colegio.id === mesa.colegioId),
      acta,
      reclamaciones: estado.reclamaciones.filter((r) => r.mesaId === mesa.id).sort((a, b) => a.creadaEn.localeCompare(b.creadaEn)),
      perfiles: estado.perfiles,
      fotoJpeg: foto ? new Uint8Array(await foto.vista.arrayBuffer()) : null,
      hora: formateaHora,
      generadoEn: ahora(),
    });
    descarga(pdf.bytes(), CONFIG.pdf.textos.archivoMesa(mesa.id, acta.version), 'application/pdf');
    avisa(CONFIG.pdf.textos.generando);
  },

  async descargarPdfPanel(consolidado, ambito) {
    const generadoEn = ahora();
    const kpi = calculaKpi({
      colegios: estado.colegios,
      mesas: mesasVisibles(estado.perfil, estado.mesas),
      actas: estado.actas,
      reclamaciones: estado.reclamaciones,
      auditoria: estado.auditoria,
      ahora: generadoEn,
      generales: estado.perfil.rol === 'administrador',
    });
    const pdf = pdfDelPanel({ consolidado, kpi, perfiles: estado.perfiles, ambito, hora: formateaHora, generadoEn });
    descarga(pdf.bytes(), CONFIG.pdf.textos.archivoPanel, 'application/pdf');
    avisa(CONFIG.pdf.textos.generando);
  },
});

// ---- Gestion de colegios, mesas y equipo (solo administrador) ----------------

const G = CONFIG.gestion.textos;

// Aplica una operacion de gestion sobre un borrador y, si cambia algo, lo
// guarda junto con sus entradas de auditoria en una sola transaccion.
// Devuelve el codigo del error de gestion, o null si todo fue bien.
async function gestiona(opera, { destino = null, aviso }) {
  if (estado.perfil?.rol !== 'administrador') return 'no-existe';
  const borrador = gestion.abreBorrador(estado);
  try {
    opera(borrador);
  } catch (error) {
    if (!(error instanceof gestion.ErrorGestion)) throw error;
    return error.codigo;
  }
  const hayCambios = borrador.registros.length > 0;
  if (hayCambios) {
    const guardado = await intenta(async () => {
      const entradas = [];
      for (const registro of borrador.registros) {
        entradas.push(
          await nuevaEntrada(entradas.at(-1) ?? estado.auditoria.at(-1) ?? null, {
            hora: ahora(),
            perfil: estado.perfil,
            accion: registro.accion,
            mesaId: registro.mesaId,
            detalle: CONFIG.gestion.detalle(registro),
            objeto: registro.objeto,
            cambio: registro.cambio,
          }),
        );
      }
      // Los nombres de las candidaturas solo se guardan si alguno ha cambiado.
      const nombres = borrador.registros.some((registro) => registro.objeto.tipo === 'candidatura')
        ? { meta: [{ clave: 'candidaturas', valor: Object.fromEntries(borrador.candidaturas.map(({ id, nombre }) => [id, nombre])) }] }
        : {};
      await db.guardar({ colegios: borrador.colegios, mesas: borrador.mesas, perfiles: borrador.perfiles, ...nombres, auditoria: entradas }, borrador.borrados);
      await recarga();
    });
    if (!guardado) return null;
  }
  // El aviso puede depender de lo que la operacion haya creado.
  const texto = hayCambios ? (typeof aviso === 'function' ? aviso() : aviso) : G.sinCambios;
  if (destino) ir(destino, texto);
  else {
    pinta({ foco: true });
    avisa(texto);
  }
  return null;
}

Object.assign(acciones, {
  guardaColegio: (datos) => gestiona((b) => gestion.guardaColegio(b, datos), { destino: '#/organizacion', aviso: G.guardado }),
  guardaMesa: (datos) => gestiona((b) => gestion.guardaMesa(b, datos), { destino: '#/organizacion', aviso: G.guardado }),

  creaPerfil(rol) {
    const etiquetaDelRol = CONFIG.roles[rol].singular;
    let etiqueta;
    return gestiona(
      (b) => {
        const id = gestion.creaPerfil(b, rol, etiquetaDelRol);
        etiqueta = b.perfiles.find((perfil) => perfil.id === id).etiqueta;
      },
      { aviso: () => G.perfilCreado(etiqueta) },
    );
  },

  cambiaActivo: (tipo, id, activo) => gestiona((b) => gestion.cambiaActivo(b, tipo, id, activo), { aviso: activo ? G.reactivado : G.desactivado }),

  async borra(tipo, id, nombre) {
    const aceptado = await confirmar({ titulo: G.borrarTitulo(nombre), texto: G.borrarTexto, aceptar: G.borrarAceptar });
    if (!aceptado) return null;
    return gestiona((b) => gestion.borra(b, tipo, id), { destino: '#/organizacion', aviso: G.borrado });
  },

  // nombres: { id: nombre }. Devuelve null o { codigo, campo } con la
  // candidatura cuyo nombre no vale.
  async renombraCandidaturas(nombres, aviso = G.candidaturasGuardadas) {
    let campo = null;
    const codigo = await gestiona(
      (b) => {
        try {
          gestion.renombraCandidaturas(b, nombres);
        } catch (error) {
          campo = error.campo ?? null;
          throw error;
        }
      },
      { aviso },
    );
    return codigo ? { codigo, campo } : null;
  },

  async restauraCandidaturas() {
    const porDefecto = CONFIG.candidaturas;
    const aceptado = await confirmar({
      titulo: G.restaurarTitulo,
      texto: G.restaurarTexto(porDefecto.map(({ nombre }) => nombre).join(', ')),
      aceptar: G.restaurarAceptar,
    });
    if (!aceptado) return null;
    return acciones.renombraCandidaturas(Object.fromEntries(porDefecto.map(({ id, nombre }) => [id, nombre])), G.candidaturasRestauradas);
  },
});

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
  const [perfiles, colegios, mesas, actas, reclamaciones, auditoria, activo, nombres] = await Promise.all([
    db.todos('perfiles'),
    db.todos('colegios'),
    db.todos('mesas'),
    db.todos('actas'),
    db.todos('reclamaciones'),
    db.todos('auditoria'),
    db.leer('meta', 'perfilActivo'),
    db.leer('meta', 'candidaturas'),
  ]);
  Object.assign(estado, {
    perfiles,
    colegios,
    mesas,
    actas,
    reclamaciones,
    auditoria,
    // Sin nombres guardados (o tras reiniciar la demo), los de config.js.
    candidaturas: usaNombres(nombres?.valor ?? null),
    perfil: perfilVigente(perfiles, activo?.valor),
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
  const contexto = { estado, params, acciones };
  if (ruta.id === 'inicio') {
    // El arranque: bienvenida, selector o, con perfil, su pantalla de inicio.
    const decision = arranque(estado.perfiles, estado.perfil);
    if (decision.ir) return { redirige: decision.ir };
    return { ruta, vista: decision.vista === 'bienvenida' ? vistaBienvenida(contexto) : vistaSelector(contexto) };
  }
  // Sin datos no hay perfiles que elegir: el selector lleva a la bienvenida.
  if (ruta.id === 'perfil' && estado.perfiles.length === 0) return { redirige: '#/' };
  if (!puedeVer(estado.perfil, ruta)) {
    // Sin perfil, cualquier pantalla interna lleva al arranque.
    if (!estado.perfil) return { redirige: '#/' };
    return {
      vista: vistaMensaje('Vista no disponible', `El perfil ${estado.perfil.etiqueta} no tiene acceso a esta vista.`, {
        href: rutaInicial(estado.perfil),
        texto: 'Volver a lo tuyo',
      }),
    };
  }
  return { ruta, vista: VISTAS[ruta.id](contexto) };
}

function pinta({ foco = false } = {}) {
  liberaUrls();
  const { ruta, vista, redirige } = vistaActual();
  if (redirige) {
    // replace: el arranque no queda en el historial y "atras" no rebota.
    location.replace(redirige);
    return;
  }
  document.title = `${vista.titulo} · ${CONFIG.producto} (demo)`;
  // La bienvenida va a pantalla completa y el banner lleva su propio aviso.
  const bienvenida = vista.pantalla === 'bienvenida';
  document.body.classList.remove('arrancando');
  document.body.classList.toggle('es-bienvenida', bienvenida);
  document.getElementById('banner-app').hidden = bienvenida;
  document.getElementById('banner-entrada').hidden = !bienvenida;
  document.getElementById('contenido').replaceChildren(vista.nodo);
  pintaCabecera();
  pintaNavegacion(ruta);
  if (foco) {
    window.scrollTo(0, 0);
    vista.nodo.querySelector('h1').focus();
  }
}

function pintaCabecera() {
  // Sin perfil no hay nada que cambiar: el boton no se muestra.
  const enlace = document.getElementById('perfil-activo');
  enlace.hidden = !estado.perfil;
  if (!estado.perfil) return;
  enlace.replaceChildren(
    icono('perfil'),
    h(
      'span',
      { class: 'cabecera__perfil-texto' },
      h('span', { class: 'cabecera__perfil-nombre' }, estado.perfil.etiqueta),
      h('span', { class: 'oculto' }, '. '),
      h('span', { class: 'cabecera__perfil-accion' }, CONFIG.entrada.cambiar),
    ),
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
  preparaOffline();
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
