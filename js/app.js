import { CONFIG } from './config.js';
import { datosEjemplo } from './datos-ejemplo.js';
import * as db from './db.js';
import { navegacion, puedeVer, resuelve, rutaInicial } from './permisos.js';
import { avisa, confirmar, enlaceDeContacto, h, icono, limpiaAvisos } from './ui.js';
import { vistaAyuda } from './vistas/ayuda.js';
import { vistaMensaje } from './vistas/comun.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaMesa, vistaMesas } from './vistas/mesas.js';
import { vistaOrganizacion } from './vistas/organizacion.js';

const VISTAS = {
  inicio: vistaInicio,
  mesas: vistaMesas,
  mesa: vistaMesa,
  organizacion: vistaOrganizacion,
  ayuda: vistaAyuda,
};

const estado = { perfiles: [], colegios: [], mesas: [], perfil: null };

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
      await db.guardar(datosEjemplo());
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
      ir('#/');
      avisa('Demo reiniciada. No queda ningún dato guardado.');
    });
  },
};

// Ejecuta una accion que escribe en la base de datos y traduce el fallo a un
// mensaje que se entienda.
async function intenta(fn) {
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof db.ErrorAlmacenamiento)) throw error;
    avisa(error.sinEspacio ? CONFIG.textos.sinEspacio : CONFIG.textos.errorGuardado, 'error');
  }
}

async function recarga() {
  const [perfiles, colegios, mesas, activo] = await Promise.all([
    db.todos('perfiles'),
    db.todos('colegios'),
    db.todos('mesas'),
    db.leer('meta', 'perfilActivo'),
  ]);
  Object.assign(estado, {
    perfiles,
    colegios,
    mesas,
    perfil: perfiles.find((perfil) => perfil.id === activo?.valor) ?? null,
  });
}

// Navega y repinta aunque el hash no cambie.
function ir(hash) {
  if (location.hash === hash) pinta({ foco: true });
  else location.hash = hash;
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
  });
}

arranca();
