// Panel consolidado. Modulo puro: suma, no pinta.
//
// El total cuenta SOLO actas validadas. Las enviadas sin validar se suman
// aparte, como provisional. Las devueltas y las mesas sin acta no suman en
// ningun lado. De cada mesa manda su acta vigente (la version mas alta).

import { actaDe } from './actas.js';

function sumaVacia(candidaturas) {
  return {
    mesas: 0,
    electores: 0,
    votantes: 0,
    nulos: 0,
    blancos: 0,
    candidaturas: Object.fromEntries(candidaturas.map(({ id }) => [id, 0])),
  };
}

function acumula(suma, cifras) {
  suma.mesas += 1;
  for (const campo of ['electores', 'votantes', 'nulos', 'blancos']) suma[campo] += cifras[campo];
  for (const id of Object.keys(suma.candidaturas)) suma.candidaturas[id] += cifras.candidaturas[id];
}

// mesas: las que ve quien consulta (el apoderado, solo las de sus colegios).
export function consolida({ colegios, mesas, actas, candidaturas }) {
  const total = { validadas: sumaVacia(candidaturas), provisional: sumaVacia(candidaturas) };
  const contadores = { mesas: mesas.length, sinActa: 0, pendiente: 0, validada: 0, devuelta: 0, descuadre: 0 };

  const porColegio = colegios
    .map((colegio) => {
      const grupo = { colegio, validadas: sumaVacia(candidaturas), provisional: sumaVacia(candidaturas), mesas: [] };
      for (const mesa of mesas.filter((m) => m.colegioId === colegio.id)) {
        const acta = actaDe(actas, mesa.id);
        const estado = acta?.estado ?? 'sin-acta';
        grupo.mesas.push({ mesa, acta, estado });

        if (estado === 'sin-acta') contadores.sinActa += 1;
        else if (estado === 'enviada') contadores.pendiente += 1;
        else contadores[estado] += 1;
        if (acta?.descuadre) contadores.descuadre += 1;

        const destino = { validada: 'validadas', enviada: 'provisional' }[estado];
        if (destino) {
          acumula(grupo[destino], acta.cifras);
          acumula(total[destino], acta.cifras);
        }
      }
      return grupo;
    })
    .filter((grupo) => grupo.mesas.length > 0);

  return { total, contadores, porColegio };
}

// Filas de una suma, en el orden del acta: [etiqueta, valor, idCandidatura?].
export function filasDeSuma(suma, campos, candidaturas) {
  return [
    ...campos.map(({ id, etiqueta }) => [etiqueta, suma[id], null]),
    ...candidaturas.map(({ id, nombre }) => [nombre, suma.candidaturas[id], id]),
  ];
}
