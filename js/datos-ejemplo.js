// Datos de ejemplo, ficticios a proposito: colegios y mesas numerados y
// perfiles sin nombre de persona.

const MESAS_POR_COLEGIO = 2;
const COLEGIOS_POR_APODERADO = [[1, 2], [3]];

export function datosEjemplo() {
  const colegios = [1, 2, 3].map((n) => ({ id: `colegio-${n}`, nombre: `Colegio ${n}` }));

  const mesas = colegios.flatMap((colegio, i) =>
    Array.from({ length: MESAS_POR_COLEGIO }, (_, j) => {
      const codigo = String(i * MESAS_POR_COLEGIO + j + 1).padStart(3, '0');
      return { id: `mesa-${codigo}`, colegioId: colegio.id, nombre: `Mesa ${codigo}` };
    }),
  );

  const perfiles = [
    { id: 'administrador', rol: 'administrador', etiqueta: 'Administrador' },
    ...COLEGIOS_POR_APODERADO.map((numeros, i) => ({
      id: `apoderado-${i + 1}`,
      rol: 'apoderado',
      etiqueta: `Apoderado ${i + 1}`,
      colegioIds: numeros.map((n) => `colegio-${n}`),
    })),
    ...mesas.map((mesa, i) => ({
      id: `interventor-${i + 1}`,
      rol: 'interventor',
      etiqueta: `Interventor ${i + 1}`,
      mesaIds: [mesa.id],
    })),
  ];

  return { colegios, mesas, perfiles };
}
