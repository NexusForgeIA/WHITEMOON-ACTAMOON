import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actaDevuelta, actaValidada, nuevaActa } from '../js/actas.js';
import { CONFIG } from '../js/config.js';
import { datosEjemplo } from '../js/datos-ejemplo.js';
import { calculaKpi, mediana, razon, textoDeDuracion, textoDeMedia, textoDeRazon } from '../js/kpi.js';
import { mesasVisibles } from '../js/permisos.js';
import { validaActa } from '../js/validaciones.js';

const { colegios, mesas, perfiles } = datosEjemplo();
const perfil = (id) => perfiles.find((p) => p.id === id);
const T = CONFIG.kpi.textos;
const MIN = 60000;
const a = (hhmm) => `2026-01-01T${hhmm}:00.000Z`;

function acta(n, cifras, { foto, envio, version = 1, fotoId = `foto-${n}`, motivo = '' }) {
  return nuevaActa({
    id: `acta-${n}-v${version}`,
    fotoId,
    mesaId: `mesa-00${n}`,
    perfil: perfil(`interventor-${n}`),
    cifras,
    validacion: validaActa(cifras, CONFIG.candidaturas),
    motivo,
    foto: { sha256: String(n).repeat(64), capturadaEn: a(foto) },
    enviadaEn: a(envio),
    version,
  });
}
const c = (electores, votantes, nulos, blancos, x, y, z) => ({ electores, votantes, nulos, blancos, candidaturas: { A: x, B: y, C: z } });

// Caso conocido (el mismo reparto que el test del panel), con horas:
//   001 foto 20:00, envio 20:02, validada 20:10
//   002 foto 20:01, envio 20:05, validada 20:25
//   003 foto 20:03, envio 20:04, pendiente, con descuadre
//   004 v1 foto 20:06, envio 20:08, devuelta 20:12; v2 (misma foto) envio 20:20, validada 20:50, con descuadre
//   005 foto 20:07, envio 20:30, devuelta 20:40
//   006 sin acta
const ACTAS = [
  actaValidada(acta(1, c(500, 412, 3, 5, 200, 150, 54), { foto: '20:00', envio: '20:02' }), perfil('apoderado-1'), a('20:10')),
  actaValidada(acta(2, c(400, 300, 2, 8, 100, 120, 70), { foto: '20:01', envio: '20:05' }), perfil('administrador'), a('20:25')),
  acta(3, c(600, 450, 5, 5, 210, 140, 80), { foto: '20:03', envio: '20:04', motivo: 'El acta tiene una enmienda' }),
  actaDevuelta(acta(4, c(300, 999, 1, 1, 90, 60, 49), { foto: '20:06', envio: '20:08', motivo: 'Cifra ilegible' }), perfil('apoderado-1'), 'Revisa los votantes', a('20:12')),
  actaValidada(acta(4, c(300, 200, 1, 1, 90, 60, 49), { foto: '20:06', envio: '20:20', version: 2, motivo: 'El acta suma 201' }), perfil('administrador'), a('20:50')),
  actaDevuelta(acta(5, c(700, 500, 10, 10, 200, 200, 80), { foto: '20:07', envio: '20:30' }), perfil('apoderado-2'), 'La foto no se lee', a('20:40')),
];
const RECLAMACIONES = [
  { id: 'r1', mesaId: 'mesa-004', perfilId: 'interventor-4', creadaEn: a('20:09') },
  { id: 'r2', mesaId: 'mesa-004', perfilId: 'apoderado-1', creadaEn: a('20:13') },
  { id: 'r3', mesaId: 'mesa-001', perfilId: 'interventor-1', creadaEn: a('20:03') },
];
const entrada = (seq, perfilId, accion, mesaId = null) => ({ seq, perfilId, accion, mesaId });
const AUDITORIA = [
  entrada(1, null, 'datos-cargados'),
  entrada(2, 'interventor-1', 'acta-enviada', 'mesa-001'),
  entrada(3, 'interventor-1', 'reclamacion-registrada', 'mesa-001'),
  entrada(4, 'interventor-3', 'acta-enviada', 'mesa-003'),
  entrada(5, 'interventor-2', 'acta-enviada', 'mesa-002'),
  entrada(6, 'interventor-4', 'acta-enviada', 'mesa-004'),
  entrada(7, 'interventor-4', 'reclamacion-registrada', 'mesa-004'),
  entrada(8, 'apoderado-1', 'acta-validada', 'mesa-001'),
  entrada(9, 'apoderado-1', 'acta-devuelta', 'mesa-004'),
  entrada(10, 'apoderado-1', 'reclamacion-registrada', 'mesa-004'),
  entrada(11, 'interventor-4', 'acta-enviada', 'mesa-004'),
  entrada(12, 'administrador', 'acta-validada', 'mesa-002'),
  entrada(13, 'interventor-5', 'acta-enviada', 'mesa-005'),
  entrada(14, 'apoderado-2', 'acta-devuelta', 'mesa-005'),
  entrada(15, 'administrador', 'acta-validada', 'mesa-004'),
];
const kpi = (quien, extra = {}) =>
  calculaKpi({
    colegios,
    mesas: mesasVisibles(quien, mesas),
    actas: ACTAS,
    reclamaciones: RECLAMACIONES,
    auditoria: AUDITORIA,
    ahora: a('21:00'),
    generales: quien.rol === 'administrador',
    ...extra,
  });
const ADMIN = perfil('administrador');

test('razon lleva su base y vale null si la base es cero', () => {
  assert.deepEqual(razon(2, 5), { n: 2, de: 5, valor: 0.4 });
  assert.deepEqual(razon(0, 5), { n: 0, de: 5, valor: 0 });
  assert.deepEqual(razon(0, 0), { n: 0, de: 0, valor: null });
});

test('mediana: impar, par y sin datos', () => {
  assert.equal(mediana([5, 1, 3]), 3);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
  assert.equal(mediana([7]), 7);
  assert.equal(mediana([]), null);
});

test('cobertura: 4 de 6 con acta enviada o validada y 3 de 6 validadas', () => {
  const k = kpi(ADMIN);
  assert.deepEqual(k.base, { mesas: 6, conActa: 5, versiones: 6 });
  assert.deepEqual(k.cobertura.envio, { n: 4, de: 6, valor: 4 / 6 });
  assert.deepEqual(k.cobertura.validada, { n: 3, de: 6, valor: 0.5 });
});

test('actas por estado: se cuenta el acta vigente de cada mesa', () => {
  assert.deepEqual(kpi(ADMIN).estados, { validada: 3, pendiente: 1, devuelta: 1, sinActa: 1 });
});

test('calidad: descuadre 2 de 5, devueltas ahora 1 de 5, tasa de devolucion 2 de 6 y 1,2 versiones por acta', () => {
  const { calidad } = kpi(ADMIN);
  assert.deepEqual(calidad.descuadre, { n: 2, de: 5, valor: 0.4 });
  assert.deepEqual(calidad.devueltasAhora, { n: 1, de: 5, valor: 0.2 });
  assert.deepEqual(calidad.tasaDevolucion, { n: 2, de: 6, valor: 2 / 6 });
  assert.deepEqual(calidad.versionesPorActa, { n: 6, de: 5, valor: 1.2 });
});

test('tiempos: mediana y maximo de cada tramo', () => {
  const { tiempos } = kpi(ADMIN);
  // 1, 2, 2, 4 y 23 min. La version 2 de la 004 reutiliza la foto y no cuenta.
  assert.deepEqual(tiempos.capturaEnvio, { n: 5, mediana: 2 * MIN, maximo: 23 * MIN, excluidas: 0 });
  // 8, 20 y 30 min.
  assert.deepEqual(tiempos.envioValidacion, { n: 3, mediana: 20 * MIN, maximo: 30 * MIN, excluidas: 0 });
  // 4 y 10 min: numero par, la media de los dos centrales.
  assert.deepEqual(tiempos.envioDevolucion, { n: 2, mediana: 7 * MIN, maximo: 10 * MIN, excluidas: 0 });
  // 8, 20 y 42 min: la 004 cuenta desde el envio de su version 1.
  assert.deepEqual(tiempos.cicloCompleto, { n: 3, mediana: 20 * MIN, maximo: 42 * MIN, excluidas: 0 });
});

test('una duracion negativa (reloj cambiado) se excluye y se cuenta', () => {
  const rara = actaValidada(acta(6, c(100, 50, 0, 0, 20, 20, 10), { foto: '20:50', envio: '20:40' }), ADMIN, a('20:35'));
  const { tiempos } = kpi(ADMIN, { actas: [...ACTAS, rara] });
  assert.deepEqual(tiempos.capturaEnvio, { n: 5, mediana: 2 * MIN, maximo: 23 * MIN, excluidas: 1 });
  assert.deepEqual(tiempos.envioValidacion, { n: 3, mediana: 20 * MIN, maximo: 30 * MIN, excluidas: 1 });
  assert.equal(tiempos.cicloCompleto.excluidas, 1);
});

test('una foto nueva al corregir si cuenta en captura a envio', () => {
  const corregida = actaValidada(acta(4, c(300, 200, 1, 1, 90, 60, 49), { foto: '20:15', envio: '20:20', version: 2, fotoId: 'foto-4-bis' }), ADMIN, a('20:50'));
  const { tiempos } = kpi(ADMIN, { actas: [...ACTAS.filter((x) => x.id !== 'acta-4-v2'), corregida] });
  // 1, 2, 2, 4, 5 y 23 min.
  assert.deepEqual([tiempos.capturaEnvio.n, tiempos.capturaEnvio.mediana], [6, 3 * MIN]);
});

test('evolucion: tramos de 15 minutos, cuatro columnas, con el estado al final de cada una', () => {
  const { evolucion } = kpi(ADMIN);
  assert.equal(evolucion.tramoMinutos, 15);
  assert.deepEqual(evolucion.columnas, [
    { desde: a('20:00'), validada: 1, pendiente: 2, devuelta: 1, sinActa: 2 },
    { desde: a('20:15'), validada: 2, pendiente: 2, devuelta: 0, sinActa: 2 },
    { desde: a('20:30'), validada: 2, pendiente: 2, devuelta: 1, sinActa: 1 },
    { desde: a('20:45'), validada: 3, pendiente: 1, devuelta: 1, sinActa: 1 },
  ]);
  // La ultima columna coincide con los estados actuales.
  const { desde, ...ultima } = evolucion.columnas.at(-1);
  assert.deepEqual(ultima, kpi(ADMIN).estados);
  for (const columna of evolucion.columnas) assert.equal(columna.validada + columna.pendiente + columna.devuelta + columna.sinActa, 6);
});

test('evolucion: el tramo es el menor de 1, 5, 15 o 60 minutos que no pasa de ocho columnas', () => {
  const con = (horas) => {
    const actas = horas.map((h, i) => acta(i + 1, c(10, 5, 0, 0, 2, 2, 1), { foto: h, envio: h }));
    return kpi(ADMIN, { actas }).evolucion;
  };
  assert.deepEqual([con(['20:00', '20:07']).tramoMinutos, con(['20:00', '20:07']).columnas.length], [1, 8]);
  assert.deepEqual([con(['20:00', '20:08']).tramoMinutos, con(['20:00', '20:08']).columnas.length], [5, 2]);
  assert.deepEqual([con(['20:00', '20:39']).tramoMinutos, con(['20:00', '20:39']).columnas.length], [5, 8]);
  assert.deepEqual([con(['20:00', '20:40']).tramoMinutos, con(['20:00', '20:40']).columnas.length], [15, 3]);
  assert.deepEqual([con(['12:00', '19:59']).tramoMinutos, con(['12:00', '19:59']).columnas.length], [60, 8]);
  // Mas de ocho horas: el tramo se dobla.
  assert.deepEqual([con(['08:00', '20:30']).tramoMinutos, con(['08:00', '20:30']).columnas.length], [120, 7]);
  assert.deepEqual(con(['20:00']).columnas.length, 1);
});

test('reclamaciones por colegio y por mesa', () => {
  const { reclamaciones } = kpi(ADMIN);
  assert.equal(reclamaciones.total, 3);
  assert.deepEqual(
    reclamaciones.porColegio.map((g) => [g.colegio.nombre, g.total, g.mesas.map((m) => [m.mesa.nombre, m.total])]),
    [
      ['Colegio 1', 1, [['Mesa 001', 1], ['Mesa 002', 0]]],
      ['Colegio 2', 2, [['Mesa 003', 0], ['Mesa 004', 2]]],
      ['Colegio 3', 0, [['Mesa 005', 0], ['Mesa 006', 0]]],
    ],
  );
});

test('acciones por tipo y por perfil, de la auditoria', () => {
  const { acciones } = kpi(ADMIN);
  assert.equal(acciones.total, 15);
  assert.deepEqual(Object.fromEntries(acciones.porTipo.map((x) => [x.accion, x.total])), {
    'acta-enviada': 6,
    'acta-validada': 3,
    'reclamacion-registrada': 3,
    'acta-devuelta': 2,
    'datos-cargados': 1,
  });
  assert.equal(acciones.porTipo[0].accion, 'acta-enviada', 'de mas a menos');
  assert.deepEqual(Object.fromEntries(acciones.porPerfil.map((x) => [x.perfilId, x.total])), {
    'interventor-4': 3,
    'apoderado-1': 3,
    'interventor-1': 2,
    administrador: 2,
    'interventor-2': 1,
    'interventor-3': 1,
    'interventor-5': 1,
    'apoderado-2': 1,
    null: 1,
  });
  assert.equal(acciones.porTipo.reduce((s, x) => s + x.total, 0), 15);
});

test('pendientes de validar, de mas antigua a mas reciente', () => {
  const { pendientes } = kpi(ADMIN);
  assert.deepEqual(pendientes.map((p) => [p.mesa.nombre, p.antiguedad]), [['Mesa 003', 56 * MIN]]);

  const otra = acta(6, c(100, 50, 0, 0, 20, 20, 10), { foto: '20:01', envio: '20:02' });
  const dos = kpi(ADMIN, { actas: [...ACTAS, otra] }).pendientes;
  assert.deepEqual(dos.map((p) => [p.mesa.nombre, p.antiguedad]), [['Mesa 006', 58 * MIN], ['Mesa 003', 56 * MIN]]);
});

test('el apoderado solo mide las mesas de sus colegios', () => {
  const uno = kpi(perfil('apoderado-1'));
  assert.deepEqual(uno.base, { mesas: 4, conActa: 4, versiones: 5 });
  assert.deepEqual([uno.cobertura.envio.n, uno.cobertura.envio.de, uno.cobertura.validada.n], [4, 4, 3]);
  assert.deepEqual(uno.estados, { validada: 3, pendiente: 1, devuelta: 0, sinActa: 0 });
  assert.deepEqual([uno.calidad.tasaDevolucion.n, uno.calidad.tasaDevolucion.de], [1, 5]);
  assert.deepEqual(uno.reclamaciones.porColegio.map((g) => g.colegio.id), ['colegio-1', 'colegio-2']);
  // Sin la entrada general ni las dos de la mesa 005.
  assert.equal(uno.acciones.total, 12);
  assert.ok(!uno.acciones.porTipo.some((x) => x.accion === 'datos-cargados'));
  assert.ok(!uno.acciones.porPerfil.some((x) => x.perfilId === 'apoderado-2' || x.perfilId === 'interventor-5'));

  const dos = kpi(perfil('apoderado-2'));
  assert.deepEqual(dos.base, { mesas: 2, conActa: 1, versiones: 1 });
  assert.deepEqual(dos.cobertura.envio, { n: 0, de: 2, valor: 0 });
  assert.deepEqual(dos.calidad.devueltasAhora, { n: 1, de: 1, valor: 1 });
  assert.deepEqual(dos.tiempos.envioValidacion, { n: 0, mediana: null, maximo: null, excluidas: 0 });
  assert.deepEqual(dos.tiempos.envioDevolucion, { n: 1, mediana: 10 * MIN, maximo: 10 * MIN, excluidas: 0 });
  assert.equal(dos.acciones.total, 2);
  assert.deepEqual(dos.pendientes, []);
});

test('sin datos: ninguna division por cero', () => {
  const sinActas = kpi(ADMIN, { actas: [], reclamaciones: [], auditoria: [] });
  assert.deepEqual(sinActas.cobertura.envio, { n: 0, de: 6, valor: 0 });
  for (const clave of ['descuadre', 'devueltasAhora', 'tasaDevolucion', 'versionesPorActa']) assert.equal(sinActas.calidad[clave].valor, null, clave);
  for (const tramo of Object.values(sinActas.tiempos)) assert.deepEqual(tramo, { n: 0, mediana: null, maximo: null, excluidas: 0 });
  assert.deepEqual(sinActas.evolucion, { tramoMinutos: null, columnas: [] });
  assert.deepEqual([sinActas.acciones.total, sinActas.reclamaciones.total, sinActas.pendientes.length], [0, 0, 0]);

  const sinMesas = calculaKpi({ colegios, mesas: [], actas: ACTAS, reclamaciones: RECLAMACIONES, auditoria: AUDITORIA, ahora: a('21:00'), generales: false });
  assert.deepEqual(sinMesas.cobertura.envio, { n: 0, de: 0, valor: null });
  assert.deepEqual(sinMesas.cobertura.validada, { n: 0, de: 0, valor: null });
  assert.deepEqual(sinMesas.base, { mesas: 0, conActa: 0, versiones: 0 });
  const todo = JSON.stringify(sinMesas) + JSON.stringify(sinActas);
  assert.ok(!todo.includes('NaN') && !todo.includes('Infinity'));
});

test('las cifras se muestran con su base, y sin base dicen "sin datos"', () => {
  assert.equal(textoDeRazon(razon(2, 5), T), '2 de 5 (40 %)');
  assert.equal(textoDeRazon(razon(2, 6), T), '2 de 6 (33,3 %)');
  assert.equal(textoDeRazon(razon(0, 4), T), '0 de 4 (0 %)');
  assert.equal(textoDeRazon(razon(0, 0), T), 'Sin datos');
  assert.equal(textoDeMedia(razon(6, 5), T), '1,2');
  assert.equal(textoDeMedia(razon(0, 0), T), 'Sin datos');
  assert.equal(textoDeDuracion(null, T), 'Sin datos');
  assert.equal(textoDeDuracion(0, T), '0 s');
  assert.equal(textoDeDuracion(45000, T), '45 s');
  assert.equal(textoDeDuracion(2 * MIN, T), '2 min');
  assert.equal(textoDeDuracion(7.5 * MIN, T), '7 min 30 s');
  assert.equal(textoDeDuracion(60 * MIN, T), '1 h');
  assert.equal(textoDeDuracion(125 * MIN, T), '2 h 5 min');
});

// ---- Los KPI en el PDF del panel ---------------------------------------------

// Cadenas de texto de un PDF sin comprimir, con sus escapes deshechos.
function textosDelPdf(crudo) {
  return [...crudo.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(([, cadena]) =>
    cadena.replace(/\\([0-7]{3})|\\(.)/g, (_, octal, otro) => (octal ? String.fromCharCode(parseInt(octal, 8)) : otro)),
  );
}

test('el PDF del panel lleva los KPI con su base, la nota de orientativo y barras con rellenos distintos', async () => {
  const { consolida } = await import('../js/consolidado.js');
  const { pdfDelPanel } = await import('../js/documentos.js');
  const consolidado = consolida({ colegios, mesas, actas: ACTAS, candidaturas: CONFIG.candidaturas });
  const bytes = pdfDelPanel({ consolidado, kpi: kpi(ADMIN), perfiles, ambito: 'Todo el municipio', hora: (iso) => `HORA(${iso})`, generadoEn: a('21:00') }).bytes();
  const crudo = Buffer.from(bytes).toString('latin1');
  assert.ok(crudo.startsWith('%PDF-1.4\n') && crudo.endsWith('%%EOF\n'));
  const textos = textosDelPdf(crudo);
  const tras = (etiqueta) => textos[textos.indexOf(etiqueta) + 1];
  assert.equal(tras('Mesas con acta enviada o validada'), '4 de 6 (66,7 %)');
  assert.equal(tras('Mesas con acta validada'), '3 de 6 (50 %)');
  assert.equal(tras('Actas con descuadre'), '2 de 5 (40 %)');
  assert.equal(tras('Actas devueltas ahora'), '1 de 5 (20 %)');
  assert.equal(tras('Envíos que acabaron devueltos'), '2 de 6 (33,3 %)');
  assert.equal(tras('Versiones por acta'), '1,2 (6 versiones de 5 actas)');
  const fila = (etiqueta, n) => textos.slice(textos.indexOf(etiqueta), textos.indexOf(etiqueta) + n);
  assert.deepEqual(fila('De la foto al envío', 4), ['De la foto al envío', '5', '2 min', '23 min']);
  assert.deepEqual(fila('Del envío a la devolución', 4), ['Del envío a la devolución', '2', '7 min', '10 min']);
  assert.deepEqual(fila('Del primer envío a la validación final', 4), ['Del primer envío a la validación final', '3', '20 min', '42 min']);
  assert.deepEqual(fila('HORA(2026-01-01T20:15:00.000Z)', 5), ['HORA(2026-01-01T20:15:00.000Z)', '2', '2', '0', '2']);
  assert.ok(textos.includes('Orientativo. Los tiempos salen de la hora del dispositivo, que no está verificada.'));
  assert.ok(textos.includes('3 reclamaciones registradas.'));
  assert.deepEqual(fila('Acta enviada', 2), ['Acta enviada', '6 de 15']);
  assert.ok(textos.includes('Interventor 4') && textos.includes('Sin perfil'));
  // Barras: una solida (relleno), otras rayadas (recorte con W n) y todas con su contorno.
  assert.ok(crudo.includes(' re f\n'), 'hay barras solidas');
  assert.ok(crudo.includes(' re W n '), 'hay barras con rayas recortadas');
  // La nota al pie sigue en todas las paginas, y una vez mas al final.
  const paginas = Number(/\/Count (\d+)/.exec(crudo)[1]);
  assert.equal(textos.filter((t) => t === 'Hora del dispositivo, no verificada; demo con datos ficticios.').length, paginas + 1);
});

test('sin KPI, el PDF del panel sigue como estaba', async () => {
  const { consolida } = await import('../js/consolidado.js');
  const { pdfDelPanel } = await import('../js/documentos.js');
  const consolidado = consolida({ colegios, mesas, actas: ACTAS, candidaturas: CONFIG.candidaturas });
  const crudo = Buffer.from(pdfDelPanel({ consolidado, ambito: 'Todo el municipio', hora: (iso) => iso, generadoEn: a('21:00') }).bytes()).toString('latin1');
  assert.ok(!textosDelPdf(crudo).includes('Cobertura'));
});
