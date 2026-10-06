// Candidaturas vigentes. Son las de config.js: los identificadores (A, B, C)
// no cambian nunca, porque las actas guardan las cifras por identificador. El
// nombre es solo una etiqueta, y el administrador puede cambiarlo desde
// «Equipo»: app.js lo lee de la base de datos y lo deja aqui para que acta,
// panel y PDF usen el mismo.

import { CONFIG } from './config.js';

let vigentes = CONFIG.candidaturas;

export const candidaturas = () => vigentes;

// nombres: { id: nombre } tal como se guardo, o null para los de config.js.
export function usaNombres(nombres) {
  vigentes = CONFIG.candidaturas.map(({ id, nombre }) => ({ id, nombre: nombres?.[id] ?? nombre }));
  return vigentes;
}
