// Aritmetica del acta. Modulo puro: no toca el DOM ni la base de datos.
//
// Reglas:
//   votantes-electores   votantes <= electores
//   suma-votantes        nulos + blancos + candidaturas = votantes

// Convierte lo tecleado en un entero >= 0. '' -> null (sin rellenar);
// cualquier otra cosa que no sea un entero sin signo -> NaN.
export function leeEntero(texto) {
  const limpio = String(texto ?? '').trim();
  if (limpio === '') return null;
  return /^\d+$/.test(limpio) ? Number(limpio) : NaN;
}

// cifras: { electores, votantes, nulos, blancos, candidaturas: { id: n } },
// con los valores tal como los devuelve leeEntero.
export function validaActa(cifras, candidaturas) {
  const valores = {
    electores: cifras.electores,
    votantes: cifras.votantes,
    nulos: cifras.nulos,
    blancos: cifras.blancos,
    ...Object.fromEntries(candidaturas.map(({ id }) => [`candidatura-${id}`, cifras.candidaturas?.[id]])),
  };

  const errores = Object.entries(valores)
    .filter(([, valor]) => !Number.isSafeInteger(valor) || valor < 0)
    .map(([campo, valor]) => ({ campo, tipo: valor == null ? 'falta' : 'invalido' }));

  if (errores.length > 0) return { completa: false, errores, reglas: [], cuadra: false };

  const suma = cifras.nulos + cifras.blancos + candidaturas.reduce((total, { id }) => total + cifras.candidaturas[id], 0);
  const reglas = [
    {
      id: 'votantes-electores',
      ok: cifras.votantes <= cifras.electores,
      // Votantes de mas respecto al censo.
      diferencia: Math.max(0, cifras.votantes - cifras.electores),
    },
    {
      id: 'suma-votantes',
      ok: suma === cifras.votantes,
      suma,
      // Positiva: sobran votos en el desglose. Negativa: faltan.
      diferencia: suma - cifras.votantes,
    },
  ];

  return { completa: true, errores, reglas, cuadra: reglas.every((regla) => regla.ok) };
}

// Frases que explican cada regla incumplida. textos: masVotantes, sobran y faltan.
export function frasesDescuadre(validacion, textos) {
  return validacion.reglas
    .filter((regla) => !regla.ok)
    .map((regla) => {
      if (regla.id === 'votantes-electores') return textos.masVotantes(regla.diferencia);
      return regla.diferencia > 0 ? textos.sobran(regla.diferencia) : textos.faltan(-regla.diferencia);
    });
}

// Decide si el acta se puede enviar y, si no, que falta. Con descuadre solo
// pasa si se confirma que el papel dice eso y se escribe un motivo.
export function puedeEnviar({ validacion, hayFoto, confirmaPapel, motivo, motivoMinimo }) {
  const falta = [];
  if (!hayFoto) falta.push('foto');
  if (!validacion.completa) falta.push('cifras');
  if (validacion.completa && !validacion.cuadra) {
    if (!confirmaPapel) falta.push('confirmacion');
    if ((motivo ?? '').trim().length < motivoMinimo) falta.push('motivo');
  }
  return { ok: falta.length === 0, falta };
}
