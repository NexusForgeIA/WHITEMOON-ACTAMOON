// Gestion de colegios, mesas y equipo. Modulo puro: aplica cambios sobre un
// borrador y apunta que ha cambiado; no guarda ni pinta.
//
// Reglas:
//   - Lo que tiene actas o reclamaciones no se borra: solo se desactiva.
//   - Una mesa con actas o reclamaciones no cambia de colegio.
//   - Reasignar no toca lo ya registrado: actas, reclamaciones y auditoria
//     guardan el identificador de quien actuo, no la asignacion.
//   - Los perfiles no se borran nunca, y no llevan nombre de persona: se
//     numeran solos.
//   - Desactivar un colegio cierra tambien sus mesas. Una mesa cerrada sigue
//     contando en totales y KPI; solo deja de admitir capturas y reclamaciones.
//   - Las candidaturas son siempre las mismas: solo cambia su nombre, que es
//     una etiqueta. Las actas guardan las cifras por identificador (A, B, C),
//     asi que renombrar no toca ninguna.

export const NOMBRE_MAXIMO = 40;
export const CANDIDATURA_MAXIMO = 20;

export class ErrorGestion extends Error {
  // campo: en los formularios con varios campos, cual es el que falla.
  constructor(codigo, campo = null) {
    super(codigo);
    this.name = 'ErrorGestion';
    this.codigo = codigo;
    this.campo = campo;
  }
}

const activo = (cosa) => cosa.activo !== false;
const estadoDe = (cosa) => (activo(cosa) ? 'activo' : 'desactivado');

// Copia de trabajo. `registros` acumula lo que hay que apuntar en la
// auditoria; `borrados`, lo que hay que quitar de la base de datos.
export function abreBorrador({ colegios, mesas, perfiles, actas, reclamaciones, candidaturas = [] }) {
  return {
    colegios: structuredClone(colegios),
    mesas: structuredClone(mesas),
    perfiles: structuredClone(perfiles),
    candidaturas: structuredClone(candidaturas),
    actas,
    reclamaciones,
    registros: [],
    borrados: { colegios: [], mesas: [] },
  };
}

function apunta(b, accion, tipo, cosa, cambio) {
  b.registros.push({ accion, objeto: { tipo, id: cosa.id, nombre: cosa.nombre ?? cosa.etiqueta }, cambio, mesaId: tipo === 'mesa' ? cosa.id : null });
}

function busca(lista, id) {
  const cosa = lista.find((x) => x.id === id);
  if (!cosa) throw new ErrorGestion('no-existe');
  return cosa;
}

// Nombre recortado y valido: ni vacio, ni largo, ni repetido en su lista.
export function nombreValido(nombre, lista, propioId = null) {
  const limpio = String(nombre ?? '').trim().replace(/\s+/g, ' ');
  if (limpio === '') throw new ErrorGestion('nombre-vacio');
  if (limpio.length > NOMBRE_MAXIMO) throw new ErrorGestion('nombre-largo');
  if (lista.some((x) => x.id !== propioId && x.nombre.toLowerCase() === limpio.toLowerCase())) throw new ErrorGestion('nombre-repetido');
  return limpio;
}

// Siguiente numero libre entre los identificadores "prefijo-N".
function siguiente(lista, prefijo) {
  const numeros = lista.map((x) => Number(new RegExp(`^${prefijo}-(\\d+)$`).exec(x.id)?.[1] ?? 0));
  return Math.max(0, ...numeros) + 1;
}

export function tieneRegistros(b, mesaId) {
  return b.actas.some((acta) => acta.mesaId === mesaId) || b.reclamaciones.some((reclamacion) => reclamacion.mesaId === mesaId);
}

export function puedeBorrarse(b, tipo, id) {
  if (tipo === 'mesa') return !tieneRegistros(b, id);
  if (tipo === 'colegio') return !b.mesas.some((mesa) => mesa.colegioId === id);
  return false; // los perfiles no se borran
}

const apoderadoDe = (b, colegioId) => b.perfiles.find((p) => p.rol === 'apoderado' && p.colegioIds.includes(colegioId)) ?? null;
const interventorDe = (b, mesaId) => b.perfiles.find((p) => p.rol === 'interventor' && p.mesaIds.includes(mesaId)) ?? null;

function asignable(b, perfilId, rol) {
  if (!perfilId) return null;
  const perfil = busca(b.perfiles, perfilId);
  if (perfil.rol !== rol) throw new ErrorGestion('rol-equivocado');
  if (!activo(perfil)) throw new ErrorGestion('perfil-desactivado');
  return perfil;
}

// Un colegio tiene como mucho un apoderado; un apoderado puede llevar varios.
function asignaApoderado(b, colegio, perfilId) {
  const antes = apoderadoDe(b, colegio.id);
  const despues = asignable(b, perfilId, 'apoderado');
  if ((antes?.id ?? null) === (despues?.id ?? null)) return;
  if (antes) antes.colegioIds = antes.colegioIds.filter((id) => id !== colegio.id);
  if (despues) despues.colegioIds = [...despues.colegioIds, colegio.id];
  apunta(b, 'asignacion-cambiada', 'colegio', colegio, [{ campo: 'apoderado', antes: antes?.etiqueta ?? null, despues: despues?.etiqueta ?? null }]);
}

// Una mesa tiene como mucho un interventor, y un interventor una sola mesa:
// al asignarlo a otra, deja la que tenia.
function asignaInterventor(b, mesa, perfilId) {
  const antes = interventorDe(b, mesa.id);
  const despues = asignable(b, perfilId, 'interventor');
  if ((antes?.id ?? null) === (despues?.id ?? null)) return;
  if (antes) antes.mesaIds = antes.mesaIds.filter((id) => id !== mesa.id);
  if (despues) {
    for (const otra of despues.mesaIds) {
      apunta(b, 'asignacion-cambiada', 'mesa', busca(b.mesas, otra), [{ campo: 'interventor', antes: despues.etiqueta, despues: null }]);
    }
    despues.mesaIds = [mesa.id];
  }
  apunta(b, 'asignacion-cambiada', 'mesa', mesa, [{ campo: 'interventor', antes: antes?.etiqueta ?? null, despues: despues?.etiqueta ?? null }]);
}

// Alta (sin id) o edicion de un colegio. apoderadoId: undefined = no tocar.
export function guardaColegio(b, { id = null, nombre, apoderadoId }) {
  let colegio;
  if (id === null) {
    colegio = { id: `colegio-${siguiente(b.colegios, 'colegio')}`, nombre: nombreValido(nombre, b.colegios), activo: true };
    b.colegios.push(colegio);
    apunta(b, 'colegio-creado', 'colegio', colegio, [{ campo: 'nombre', antes: null, despues: colegio.nombre }]);
  } else {
    colegio = busca(b.colegios, id);
    const nuevo = nombreValido(nombre, b.colegios, id);
    if (nuevo !== colegio.nombre) {
      const antes = colegio.nombre;
      colegio.nombre = nuevo;
      apunta(b, 'colegio-editado', 'colegio', colegio, [{ campo: 'nombre', antes, despues: nuevo }]);
    }
  }
  if (apoderadoId !== undefined) asignaApoderado(b, colegio, apoderadoId);
  return colegio.id;
}

// Alta (sin id) o edicion de una mesa. interventorId: undefined = no tocar.
export function guardaMesa(b, { id = null, nombre, colegioId, interventorId }) {
  const colegio = busca(b.colegios, colegioId);
  let mesa;
  if (id === null) {
    if (!activo(colegio)) throw new ErrorGestion('colegio-desactivado');
    mesa = { id: `mesa-${String(siguiente(b.mesas, 'mesa')).padStart(3, '0')}`, colegioId, nombre: nombreValido(nombre, b.mesas), activo: true };
    b.mesas.push(mesa);
    apunta(b, 'mesa-creada', 'mesa', mesa, [
      { campo: 'nombre', antes: null, despues: mesa.nombre },
      { campo: 'colegio', antes: null, despues: colegio.nombre },
    ]);
  } else {
    mesa = busca(b.mesas, id);
    const cambio = [];
    const nuevo = nombreValido(nombre, b.mesas, id);
    if (nuevo !== mesa.nombre) {
      cambio.push({ campo: 'nombre', antes: mesa.nombre, despues: nuevo });
      mesa.nombre = nuevo;
    }
    if (colegioId !== mesa.colegioId) {
      // Moverla cambiaria los subtotales por colegio de lo ya registrado.
      if (tieneRegistros(b, mesa.id)) throw new ErrorGestion('mesa-con-registros');
      if (!activo(colegio)) throw new ErrorGestion('colegio-desactivado');
      cambio.push({ campo: 'colegio', antes: busca(b.colegios, mesa.colegioId).nombre, despues: colegio.nombre });
      mesa.colegioId = colegioId;
    }
    if (cambio.length > 0) apunta(b, 'mesa-editada', 'mesa', mesa, cambio);
  }
  if (interventorId !== undefined) asignaInterventor(b, mesa, interventorId);
  return mesa.id;
}

// Perfil nuevo, numerado solo: no hay campo de nombre.
export function creaPerfil(b, rol, etiquetaDelRol) {
  if (rol !== 'interventor' && rol !== 'apoderado') throw new ErrorGestion('rol-equivocado');
  const numero = siguiente(b.perfiles, rol);
  const perfil = { id: `${rol}-${numero}`, rol, etiqueta: `${etiquetaDelRol} ${numero}`, activo: true, ...(rol === 'interventor' ? { mesaIds: [] } : { colegioIds: [] }) };
  b.perfiles.push(perfil);
  apunta(b, 'perfil-creado', 'perfil', perfil, [{ campo: 'rol', antes: null, despues: etiquetaDelRol }]);
  return perfil.id;
}

// Desactivar o reactivar. tipo: 'colegio', 'mesa' o 'perfil'.
export function cambiaActivo(b, tipo, id, quiereActivo) {
  const cosa = busca({ colegio: b.colegios, mesa: b.mesas, perfil: b.perfiles }[tipo], id);
  if (activo(cosa) === quiereActivo) return;
  if (tipo === 'perfil' && cosa.rol === 'administrador') throw new ErrorGestion('administrador');
  if (tipo === 'mesa' && quiereActivo && !activo(busca(b.colegios, cosa.colegioId))) throw new ErrorGestion('colegio-desactivado');

  const cambio = [{ campo: 'estado', antes: estadoDe(cosa), despues: quiereActivo ? 'activo' : 'desactivado' }];
  cosa.activo = quiereActivo;
  if (tipo === 'colegio' && !quiereActivo) {
    // Cerrar un colegio cierra sus mesas, y queda dicho cuales.
    for (const mesa of b.mesas.filter((m) => m.colegioId === id && activo(m))) {
      mesa.activo = false;
      cambio.push({ campo: 'mesa', antes: `${mesa.nombre}: activo`, despues: `${mesa.nombre}: desactivado` });
    }
  }
  const sufijo = quiereActivo ? 'reactivad' : 'desactivad';
  apunta(b, `${tipo}-${sufijo}${tipo === 'mesa' ? 'a' : 'o'}`, tipo, cosa, cambio);
}

// Borrar de verdad: solo lo que no tiene nada registrado.
export function borra(b, tipo, id) {
  if (tipo === 'mesa') {
    const mesa = busca(b.mesas, id);
    if (tieneRegistros(b, id)) throw new ErrorGestion('mesa-con-registros');
    for (const perfil of b.perfiles) if (perfil.mesaIds) perfil.mesaIds = perfil.mesaIds.filter((x) => x !== id);
    b.mesas = b.mesas.filter((m) => m.id !== id);
    b.borrados.mesas.push(id);
    // La mesa deja de existir: la entrada no la referencia como mesa.
    b.registros.push({ accion: 'mesa-borrada', objeto: { tipo, id, nombre: mesa.nombre }, cambio: [{ campo: 'nombre', antes: mesa.nombre, despues: null }], mesaId: null });
  } else if (tipo === 'colegio') {
    const colegio = busca(b.colegios, id);
    if (b.mesas.some((mesa) => mesa.colegioId === id)) throw new ErrorGestion('colegio-con-mesas');
    for (const perfil of b.perfiles) if (perfil.colegioIds) perfil.colegioIds = perfil.colegioIds.filter((x) => x !== id);
    b.colegios = b.colegios.filter((c) => c.id !== id);
    b.borrados.colegios.push(id);
    apunta(b, 'colegio-borrado', 'colegio', colegio, [{ campo: 'nombre', antes: colegio.nombre, despues: null }]);
  } else {
    throw new ErrorGestion('perfil-no-se-borra');
  }
}

// Cambia el nombre de las candidaturas. nombres: { id: nombre }; la que no
// venga se queda como esta. Se validan las tres juntas, asi que dos pueden
// intercambiarse el nombre en un solo guardado. Cada nombre que cambia deja
// su entrada, con el anterior y el nuevo.
export function renombraCandidaturas(b, nombres) {
  const limpios = b.candidaturas.map(({ id, nombre }) => {
    const limpio = String(nombres[id] ?? nombre).trim().replace(/\s+/g, ' ');
    if (limpio === '') throw new ErrorGestion('nombre-vacio', id);
    if (limpio.length > CANDIDATURA_MAXIMO) throw new ErrorGestion('candidatura-larga', id);
    return limpio;
  });
  limpios.forEach((nombre, i) => {
    const primera = limpios.findIndex((otro) => otro.toLowerCase() === nombre.toLowerCase());
    if (primera !== i) throw new ErrorGestion('candidatura-repetida', b.candidaturas[i].id);
  });
  b.candidaturas.forEach((candidatura, i) => {
    const antes = candidatura.nombre;
    if (limpios[i] === antes) return;
    candidatura.nombre = limpios[i];
    apunta(b, 'candidatura-renombrada', 'candidatura', candidatura, [{ campo: 'nombre', antes, despues: limpios[i] }]);
  });
}
