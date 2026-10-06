// KPI de actividad. Modulo puro: calcula a partir de lo ya registrado (actas
// con todas sus versiones, reclamaciones y auditoria), no guarda nada.
//
// Cada proporcion lleva su base ({ n, de }) y vale null si la base es cero:
// nunca se divide por cero. Las duraciones salen de la hora del dispositivo,
// que no esta verificada: son orientativas.

import { actaDe } from './actas.js';

const MINUTO = 60000;
const TRAMOS = [1, 5, 15, 60]; // minutos
const COLUMNAS_MAXIMAS = 8;

export function razon(n, de) {
  return { n, de, valor: de === 0 ? null : n / de };
}

export function mediana(valores) {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
}

// Resumen de una lista de pares [inicio, fin] en ISO. Una duracion negativa
// (reloj del dispositivo cambiado) se excluye y se cuenta aparte.
function resumenDeDuraciones(pares) {
  const duraciones = pares.map(([inicio, fin]) => Date.parse(fin) - Date.parse(inicio));
  const validas = duraciones.filter((ms) => ms >= 0);
  return {
    n: validas.length,
    mediana: mediana(validas),
    maximo: validas.length > 0 ? Math.max(...validas) : null,
    excluidas: duraciones.length - validas.length,
  };
}

// Estado de cada mesa al final de cada tramo de hora del dispositivo. El
// tramo es el menor de 1, 5, 15 o 60 minutos que no pasa de ocho columnas;
// si ni con 60 cabe, se va doblando.
function evolucionDeEstados(mesas, versiones) {
  const hechos = versiones
    .flatMap((acta) => [
      { en: acta.enviadaEn, mesaId: acta.mesaId, estado: 'pendiente' },
      acta.validadaEn && { en: acta.validadaEn, mesaId: acta.mesaId, estado: 'validada' },
      acta.devolucion && { en: acta.devolucion.en, mesaId: acta.mesaId, estado: 'devuelta' },
    ])
    .filter(Boolean)
    .map((hecho) => ({ ...hecho, t: Date.parse(hecho.en) }))
    .sort((a, b) => a.t - b.t);
  if (hechos.length === 0) return { tramoMinutos: null, columnas: [] };

  const columnasCon = (minutos) => {
    const tramo = minutos * MINUTO;
    const inicio = Math.floor(hechos[0].t / tramo) * tramo;
    return { inicio, tramo, total: Math.floor((hechos.at(-1).t - inicio) / tramo) + 1 };
  };
  let minutos = TRAMOS.find((m) => columnasCon(m).total <= COLUMNAS_MAXIMAS) ?? TRAMOS.at(-1);
  while (columnasCon(minutos).total > COLUMNAS_MAXIMAS) minutos *= 2;
  const { inicio, tramo, total } = columnasCon(minutos);

  const columnas = [];
  const estadoDe = new Map();
  let siguiente = 0;
  for (let i = 0; i < total; i += 1) {
    const fin = inicio + (i + 1) * tramo;
    while (siguiente < hechos.length && hechos[siguiente].t < fin) {
      estadoDe.set(hechos[siguiente].mesaId, hechos[siguiente].estado);
      siguiente += 1;
    }
    const cuenta = { validada: 0, pendiente: 0, devuelta: 0 };
    for (const estado of estadoDe.values()) cuenta[estado] += 1;
    columnas.push({ desde: new Date(inicio + i * tramo).toISOString(), ...cuenta, sinActa: mesas.length - estadoDe.size });
  }
  return { tramoMinutos: minutos, columnas };
}

// mesas: las del ambito de quien consulta. generales: si se cuentan tambien
// las entradas de auditoria que no son de ninguna mesa (solo el administrador).
export function calculaKpi({ colegios, mesas, actas, reclamaciones, auditoria, ahora, generales }) {
  const ids = new Set(mesas.map((mesa) => mesa.id));
  const versiones = actas.filter((acta) => ids.has(acta.mesaId));
  const vigentes = mesas.map((mesa) => actaDe(versiones, mesa.id)).filter(Boolean);
  const en = (estado) => vigentes.filter((acta) => acta.estado === estado);

  // ---- Tiempos ---------------------------------------------------------------
  const anterior = (acta) => versiones.find((otra) => otra.mesaId === acta.mesaId && otra.version === acta.version - 1);
  // Al corregir un acta con la misma foto, captura -> envio no mide nada.
  const conFotoNueva = versiones.filter((acta) => anterior(acta)?.fotoId !== acta.fotoId);
  const primera = (acta) => versiones.find((otra) => otra.mesaId === acta.mesaId && otra.version === 1) ?? acta;
  const tiempos = {
    capturaEnvio: resumenDeDuraciones(conFotoNueva.map((acta) => [acta.capturadaEn, acta.enviadaEn])),
    envioValidacion: resumenDeDuraciones(versiones.filter((acta) => acta.validadaEn).map((acta) => [acta.enviadaEn, acta.validadaEn])),
    envioDevolucion: resumenDeDuraciones(versiones.filter((acta) => acta.devolucion).map((acta) => [acta.enviadaEn, acta.devolucion.en])),
    cicloCompleto: resumenDeDuraciones(en('validada').map((acta) => [primera(acta).enviadaEn, acta.validadaEn])),
  };

  // ---- Reclamaciones ---------------------------------------------------------
  const propias = reclamaciones.filter((reclamacion) => ids.has(reclamacion.mesaId));
  const porColegio = colegios
    .map((colegio) => {
      const filas = mesas
        .filter((mesa) => mesa.colegioId === colegio.id)
        .map((mesa) => ({ mesa, total: propias.filter((reclamacion) => reclamacion.mesaId === mesa.id).length }));
      return { colegio, total: filas.reduce((suma, fila) => suma + fila.total, 0), mesas: filas };
    })
    .filter((grupo) => grupo.mesas.length > 0);

  // ---- Acciones (auditoria) --------------------------------------------------
  const entradas = auditoria.filter((entrada) => (entrada.mesaId ? ids.has(entrada.mesaId) : generales));
  const agrupa = (clave) => {
    const cuenta = new Map();
    for (const entrada of entradas) cuenta.set(entrada[clave], (cuenta.get(entrada[clave]) ?? 0) + 1);
    return [...cuenta].map(([valor, total]) => ({ [clave]: valor, total })).sort((a, b) => b.total - a.total);
  };

  return {
    base: { mesas: mesas.length, conActa: vigentes.length, versiones: versiones.length },
    cobertura: {
      envio: razon(en('enviada').length + en('validada').length, mesas.length),
      validada: razon(en('validada').length, mesas.length),
    },
    estados: {
      validada: en('validada').length,
      pendiente: en('enviada').length,
      devuelta: en('devuelta').length,
      sinActa: mesas.length - vigentes.length,
    },
    calidad: {
      descuadre: razon(vigentes.filter((acta) => acta.descuadre).length, vigentes.length),
      devueltasAhora: razon(en('devuelta').length, vigentes.length),
      tasaDevolucion: razon(versiones.filter((acta) => acta.devolucion).length, versiones.length),
      versionesPorActa: razon(versiones.length, vigentes.length),
    },
    tiempos,
    evolucion: evolucionDeEstados(mesas, versiones),
    reclamaciones: { total: propias.length, porColegio },
    acciones: { total: entradas.length, porTipo: agrupa('accion'), porPerfil: agrupa('perfilId') },
    // Lo que mas tiempo lleva esperando, primero.
    pendientes: en('enviada')
      .map((acta) => ({ mesa: mesas.find((mesa) => mesa.id === acta.mesaId), acta, antiguedad: Date.parse(ahora) - Date.parse(acta.enviadaEn) }))
      .sort((a, b) => b.antiguedad - a.antiguedad),
  };
}

// ---- Textos de las cifras ----------------------------------------------------

const porcentaje = new Intl.NumberFormat('es', { style: 'percent', maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat('es', { maximumFractionDigits: 2 });

// "2 de 5 (40 %)", o el texto de sin datos si la base es cero.
export function textoDeRazon(r, textos) {
  // Intl separa la cifra del signo con un espacio duro; aqui va uno normal.
  return r.valor === null ? textos.sinDatos : `${textos.de(r.n, r.de)} (${porcentaje.format(r.valor).replace(/\s/g, ' ')})`;
}

// Una media: "1,2 (6 de 5)" no se lee bien, asi que va el valor y su base aparte.
export function textoDeMedia(r, textos) {
  return r.valor === null ? textos.sinDatos : decimal.format(r.valor);
}

export function textoDeDuracion(ms, textos) {
  if (ms === null) return textos.sinDatos;
  const segundos = Math.round(ms / 1000);
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return segundos % 60 === 0 ? `${minutos} min` : `${minutos} min ${segundos % 60} s`;
  return minutos % 60 === 0 ? `${Math.floor(minutos / 60)} h` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}
