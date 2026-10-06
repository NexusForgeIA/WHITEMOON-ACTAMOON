// Registros de acta. Modulo puro: construye y consulta, no guarda.

// Acta lista para guardar. `foto` es lo que devuelve preparaFoto; `id` y
// `fotoId` los pone quien llama para que este modulo no dependa del azar.
export function nuevaActa({ id, fotoId, mesaId, perfil, cifras, validacion, motivo, foto, enviadaEn, version = 1 }) {
  const incumplidas = validacion.reglas.filter((regla) => !regla.ok).map((regla) => regla.id);
  return {
    id,
    mesaId,
    version,
    estado: 'enviada',
    cifras,
    descuadre: incumplidas.length > 0 ? { reglas: incumplidas, motivo: motivo.trim() } : null,
    fotoId,
    fotoSha256: foto.sha256,
    capturadaEn: foto.capturadaEn,
    enviadaEn,
    enviadaPor: perfil.id,
  };
}

export function registroFoto(fotoId, foto) {
  return {
    id: fotoId,
    original: foto.original,
    vista: foto.vista,
    sha256: foto.sha256,
    tipo: foto.tipo,
    bytes: foto.bytes,
    creadaEn: foto.capturadaEn,
  };
}

// Una mesa admite captura si no tiene acta o si la suya fue devuelta.
export function admiteCaptura(acta) {
  return !acta || acta.estado === 'devuelta';
}

// Doble confirmacion. Solo se resuelve un acta enviada, y nunca por quien la
// envio: quien llama ya lo ha comprobado, y aqui se impide de todos modos.
function resuelve(acta, perfil) {
  if (acta.estado !== 'enviada') throw new Error('Solo se resuelve un acta enviada');
  if (perfil.id === acta.enviadaPor) throw new Error('No puede resolver el acta quien la envio');
}

export function actaValidada(acta, perfil, ahora) {
  resuelve(acta, perfil);
  return { ...acta, estado: 'validada', validadaPor: perfil.id, validadaEn: ahora };
}

export function actaDevuelta(acta, perfil, motivo, ahora) {
  resuelve(acta, perfil);
  return { ...acta, estado: 'devuelta', devolucion: { por: perfil.id, en: ahora, motivo: motivo.trim() } };
}

// El acta vigente de una mesa: la de version mas alta.
export function actaDe(actas, mesaId) {
  return actas.filter((acta) => acta.mesaId === mesaId).sort((a, b) => b.version - a.version)[0] ?? null;
}
