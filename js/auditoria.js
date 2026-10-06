// Registro de auditoria encadenado. Modulo puro: construye y verifica, no guarda.
//
// Cada entrada lleva la huella de la anterior, asi que cambiar, quitar o
// reordenar una entrada rompe la cadena a partir de ese punto. Esto ensena el
// mecanismo; no impide que alguien con acceso al navegador reescriba la
// cadena entera y la vuelva a encadenar. Eso solo lo impide un servidor.

import { sha256Hex } from './hash.js';

export const GENESIS = '0'.repeat(64);

// Los campos que entran en la huella, siempre en este orden.
const CAMPOS = ['seq', 'hora', 'perfilId', 'rol', 'accion', 'mesaId', 'detalle'];

export function canonico(entrada) {
  return JSON.stringify(CAMPOS.map((campo) => entrada[campo] ?? null));
}

function huella(hashPrevio, entrada) {
  return sha256Hex(new TextEncoder().encode(`${hashPrevio}\n${canonico(entrada)}`));
}

// Entrada siguiente a `anterior` (null si es la primera).
export async function nuevaEntrada(anterior, { hora, perfil, accion, mesaId = null, detalle = '' }) {
  const entrada = {
    seq: (anterior?.seq ?? 0) + 1,
    hora,
    perfilId: perfil?.id ?? null,
    rol: perfil?.rol ?? null,
    accion,
    mesaId,
    detalle,
  };
  const hashPrevio = anterior?.hash ?? GENESIS;
  return { ...entrada, hashPrevio, hash: await huella(hashPrevio, entrada) };
}

// Recorre las entradas en orden y dice donde se rompe la cadena, si se rompe.
// motivo: 'secuencia' (falta o sobra una entrada), 'enlace' (no apunta a la
// anterior) o 'contenido' (la entrada no coincide con su huella).
export async function verificaCadena(entradas) {
  let anterior = null;
  for (const entrada of entradas) {
    const rota = (motivo) => ({ ok: false, total: entradas.length, rotaEn: entrada.seq, motivo });
    if (entrada.seq !== (anterior?.seq ?? 0) + 1) return rota('secuencia');
    const previo = anterior?.hash ?? GENESIS;
    if (entrada.hashPrevio !== previo) return rota('enlace');
    if (entrada.hash !== (await huella(previo, entrada))) return rota('contenido');
    anterior = entrada;
  }
  return { ok: true, total: entradas.length, rotaEn: null, motivo: null };
}
