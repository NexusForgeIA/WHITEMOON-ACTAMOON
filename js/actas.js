// Registros de acta. Modulo puro: construye y consulta, no guarda.

// Acta lista para guardar. `foto` es lo que devuelve preparaFoto; `id` y
// `fotoId` los pone quien llama para que este modulo no dependa del azar.
export function nuevaActa({ id, fotoId, mesaId, perfil, cifras, validacion, motivo, foto, enviadaEn }) {
  const incumplidas = validacion.reglas.filter((regla) => !regla.ok).map((regla) => regla.id);
  return {
    id,
    mesaId,
    version: 1,
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

// El acta vigente de una mesa: la de version mas alta.
export function actaDe(actas, mesaId) {
  return actas.filter((acta) => acta.mesaId === mesaId).sort((a, b) => b.version - a.version)[0] ?? null;
}
