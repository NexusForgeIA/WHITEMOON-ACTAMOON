import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actaDevuelta, actaValidada, nuevaActa } from '../js/actas.js';
import { CONFIG } from '../js/config.js';
import { consolida, filasDeSuma } from '../js/consolidado.js';
import { datosEjemplo } from '../js/datos-ejemplo.js';
import { pdfDelPanel, pdfDeMesa } from '../js/documentos.js';
import { Pdf, anchoDeTexto, cadenaPdf, dimensionesJpeg, parteEnLineas } from '../js/pdf.js';
import { mesasVisibles } from '../js/permisos.js';
import { validaActa } from '../js/validaciones.js';

const { colegios, mesas, perfiles } = datosEjemplo();
const perfil = (id) => perfiles.find((p) => p.id === id);
const CANDIDATURAS = CONFIG.candidaturas;
const AHORA = '2026-01-01T21:00:00.000Z';
const hora = (iso) => `HORA(${iso})`;

function acta(n, cifras, { version = 1, motivo = '' } = {}) {
  return nuevaActa({
    id: `acta-${n}-v${version}`,
    fotoId: `foto-${n}`,
    mesaId: `mesa-00${n}`,
    perfil: perfil(`interventor-${n}`),
    cifras,
    validacion: validaActa(cifras, CANDIDATURAS),
    motivo,
    foto: { sha256: String(n).repeat(64), capturadaEn: '2026-01-01T20:00:00.000Z' },
    enviadaEn: '2026-01-01T20:05:00.000Z',
    version,
  });
}
const cifras = (electores, votantes, nulos, blancos, a, b, c) => ({ electores, votantes, nulos, blancos, candidaturas: { A: a, B: b, C: c } });

// Caso conocido, con las seis mesas del ejemplo:
//   001 (colegio 1) validada             500 / 412 = 3 + 5 + 200 + 150 + 54
//   002 (colegio 1) validada             400 / 300 = 2 + 8 + 100 + 120 + 70
//   003 (colegio 2) enviada, descuadre   600 / 450 ; 5 + 5 + 210 + 140 + 80 = 440
//   004 (colegio 2) v1 devuelta y v2 validada, con descuadre   300 / 200 ; 1 + 1 + 90 + 60 + 49 = 201
//   005 (colegio 3) devuelta             700 / 500 = 10 + 10 + 200 + 200 + 80
//   006 (colegio 3) sin acta
const ADMIN = perfil('administrador');
const ACTAS = [
  actaValidada(acta(1, cifras(500, 412, 3, 5, 200, 150, 54)), perfil('apoderado-1'), AHORA),
  actaValidada(acta(2, cifras(400, 300, 2, 8, 100, 120, 70)), ADMIN, AHORA),
  acta(3, cifras(600, 450, 5, 5, 210, 140, 80), { motivo: 'El acta tiene una enmienda' }),
  actaDevuelta(acta(4, cifras(300, 999, 1, 1, 90, 60, 49), { motivo: 'Cifra ilegible en el acta' }), perfil('apoderado-1'), 'Revisa los votantes', AHORA),
  actaValidada(acta(4, cifras(300, 200, 1, 1, 90, 60, 49), { version: 2, motivo: 'El acta suma 201' }), ADMIN, AHORA),
  actaDevuelta(acta(5, cifras(700, 500, 10, 10, 200, 200, 80)), perfil('apoderado-2'), 'La foto no se lee', AHORA),
];
const panel = (quien) => consolida({ colegios, mesas: mesasVisibles(quien, mesas), actas: ACTAS, candidaturas: CANDIDATURAS });

// ---- Consolidado -----------------------------------------------------------

test('el total cuenta solo las actas validadas', () => {
  const { total } = panel(ADMIN);
  // 001 + 002 + 004 v2
  assert.deepEqual(total.validadas, { mesas: 3, electores: 1200, votantes: 912, nulos: 6, blancos: 14, candidaturas: { A: 390, B: 330, C: 173 } });
});

test('las enviadas sin validar se suman aparte, como provisional', () => {
  const { total } = panel(ADMIN);
  assert.deepEqual(total.provisional, { mesas: 1, electores: 600, votantes: 450, nulos: 5, blancos: 5, candidaturas: { A: 210, B: 140, C: 80 } });
});

test('las devueltas, las versiones antiguas y las mesas sin acta no suman en ningun lado', () => {
  const { total } = panel(ADMIN);
  const todo = total.validadas.votantes + total.provisional.votantes;
  assert.equal(todo, 412 + 300 + 200 + 450, 'ni los 500 de la 005 devuelta ni los 999 de la 004 v1');
  assert.equal(total.validadas.mesas + total.provisional.mesas, 4);
});

test('los contadores cuentan el acta vigente de cada mesa', () => {
  assert.deepEqual(panel(ADMIN).contadores, { mesas: 6, sinActa: 1, pendiente: 1, validada: 3, devuelta: 1, descuadre: 2 });
});

test('el desglose va por colegio y mesa, con su subtotal de validadas', () => {
  const { porColegio } = panel(ADMIN);
  assert.deepEqual(porColegio.map((g) => g.colegio.nombre), ['Colegio 1', 'Colegio 2', 'Colegio 3']);
  assert.deepEqual(
    porColegio.map((g) => g.mesas.map((m) => [m.mesa.nombre, m.estado, m.acta?.version ?? null])),
    [
      [['Mesa 001', 'validada', 1], ['Mesa 002', 'validada', 1]],
      [['Mesa 003', 'enviada', 1], ['Mesa 004', 'validada', 2]],
      [['Mesa 005', 'devuelta', 1], ['Mesa 006', 'sin-acta', null]],
    ],
  );
  assert.deepEqual(porColegio[0].validadas, { mesas: 2, electores: 900, votantes: 712, nulos: 5, blancos: 13, candidaturas: { A: 300, B: 270, C: 124 } });
  assert.deepEqual([porColegio[1].validadas.votantes, porColegio[1].provisional.votantes], [200, 450]);
  assert.deepEqual([porColegio[2].validadas.mesas, porColegio[2].provisional.mesas, porColegio[2].validadas.votantes], [0, 0, 0]);
  // Los subtotales suman el total.
  for (const campo of ['mesas', 'electores', 'votantes', 'nulos', 'blancos']) {
    assert.equal(porColegio.reduce((s, g) => s + g.validadas[campo], 0), panel(ADMIN).total.validadas[campo], campo);
  }
});

test('el apoderado solo consolida sus colegios', () => {
  const uno = panel(perfil('apoderado-1'));
  assert.deepEqual(uno.porColegio.map((g) => g.colegio.id), ['colegio-1', 'colegio-2']);
  assert.deepEqual(uno.contadores, { mesas: 4, sinActa: 0, pendiente: 1, validada: 3, devuelta: 0, descuadre: 2 });
  assert.equal(uno.total.validadas.votantes, 912);

  const dos = panel(perfil('apoderado-2'));
  assert.deepEqual(dos.porColegio.map((g) => g.colegio.id), ['colegio-3']);
  assert.deepEqual(dos.contadores, { mesas: 2, sinActa: 1, pendiente: 0, validada: 0, devuelta: 1, descuadre: 0 });
  assert.deepEqual([dos.total.validadas.mesas, dos.total.provisional.mesas], [0, 0]);
});

test('sin actas todo es cero', () => {
  const vacio = consolida({ colegios, mesas, actas: [], candidaturas: CANDIDATURAS });
  assert.deepEqual(vacio.contadores, { mesas: 6, sinActa: 6, pendiente: 0, validada: 0, devuelta: 0, descuadre: 0 });
  assert.deepEqual(vacio.total.validadas, { mesas: 0, electores: 0, votantes: 0, nulos: 0, blancos: 0, candidaturas: { A: 0, B: 0, C: 0 } });
});

test('filasDeSuma sigue el orden del acta', () => {
  const filas = filasDeSuma(panel(ADMIN).total.validadas, CONFIG.acta.campos, CANDIDATURAS);
  assert.deepEqual(filas, [
    ['Electores censados', 1200, null],
    ['Votantes', 912, null],
    ['Votos nulos', 6, null],
    ['Votos en blanco', 14, null],
    ['Candidatura A', 390, 'A'],
    ['Candidatura B', 330, 'B'],
    ['Candidatura C', 173, 'C'],
  ]);
});

// ---- PDF: lector minimo para comprobar que el archivo esta bien formado -----

const latin1 = (bytes) => Buffer.from(bytes).toString('latin1');

// Lee la tabla xref y comprueba que cada objeto empieza donde dice.
function abrePdf(bytes) {
  const texto = latin1(bytes);
  assert.ok(texto.startsWith('%PDF-1.4\n'), 'cabecera');
  assert.ok(texto.endsWith('%%EOF\n'), 'fin de archivo');
  const inicio = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(texto)[1]);
  assert.equal(texto.slice(inicio, inicio + 5), 'xref\n');
  const [, primero, cuantos] = /^xref\n(\d+) (\d+)\n/.exec(texto.slice(inicio)).map(Number);
  assert.equal(primero, 0);
  const entradas = texto.slice(inicio).split('\n').slice(2, 2 + cuantos);
  assert.equal(entradas[0], '0000000000 65535 f ');
  const objetos = {};
  entradas.slice(1).forEach((entrada, i) => {
    assert.match(entrada, /^\d{10} 00000 n $/, 'cada entrada mide 20 bytes con su salto');
    const posicion = Number(entrada.slice(0, 10));
    const numero = i + 1;
    assert.ok(texto.startsWith(`${numero} 0 obj\n`, posicion), `el objeto ${numero} esta en su posicion`);
    objetos[numero] = texto.slice(posicion, texto.indexOf('endobj', posicion));
  });
  assert.match(texto.slice(inicio), new RegExp(`trailer\\n<< /Size ${cuantos} /Root 1 0 R /Info 6 0 R >>`));

  const paginas = Object.values(objetos).filter((o) => /\/Type \/Page /.test(o));
  const declaradas = Number(/\/Count (\d+)/.exec(objetos[2])[1]);
  const hijos = /\/Kids \[([^\]]*)\]/.exec(objetos[2])[1].trim().split(/ 0 R ?/).filter(Boolean).map(Number);
  assert.equal(paginas.length, declaradas);
  assert.equal(hijos.length, declaradas);
  for (const hijo of hijos) assert.match(objetos[hijo], /\/Type \/Page \/Parent 2 0 R \/Contents (\d+) 0 R/);

  // Cada flujo mide lo que declara.
  const flujos = [];
  for (const [numero, objeto] of Object.entries(objetos)) {
    const m = /\/Length (\d+) >>\nstream\n/.exec(objeto);
    if (!m) continue;
    const desde = m.index + m[0].length;
    const contenido = objeto.slice(desde, desde + Number(m[1]));
    assert.equal(objeto.slice(desde + Number(m[1]), desde + Number(m[1]) + 11), '\nendstream\n', `flujo del objeto ${numero}`);
    flujos.push({ numero: Number(numero), objeto, contenido });
  }

  // Texto de las paginas: cadenas (…) Tj con sus escapes deshechos.
  const textoDePagina = (contenido) =>
    [...contenido.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(([, cadena]) =>
      cadena.replace(/\\([0-7]{3})|\\(.)/g, (_, octal, otro) => (octal ? String.fromCharCode(parseInt(octal, 8)) : otro)),
    );
  const contenidos = hijos.map((hijo) => {
    const ref = Number(/\/Contents (\d+) 0 R/.exec(objetos[hijo])[1]);
    return textoDePagina(flujos.find((f) => f.numero === ref).contenido);
  });
  return { objetos, paginas: declaradas, textos: contenidos, todo: contenidos.flat().join('\n'), imagenes: flujos.filter((f) => /\/Subtype \/Image/.test(f.objeto)) };
}

// JPEG minimo: cabecera SOI, APP0, SOF0 con sus dimensiones, y fin.
function jpegDePrueba(ancho, alto, componentes = 3) {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, alto >> 8, alto & 0xff, ancho >> 8, ancho & 0xff, componentes, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

test('cadenaPdf escapa parentesis y barras, y pasa acentos y ene a WinAnsi', () => {
  assert.equal(cadenaPdf('Mesa (001) \\ fin'), '(Mesa \\(001\\) \\\\ fin)');
  assert.equal(cadenaPdf('áéíóúñÑ¿¡ü'), '(\\341\\351\\355\\363\\372\\361\\321\\277\\241\\374)');
  assert.equal(cadenaPdf('· « » €'), '(\\267 \\253 \\273 \\200)');
  assert.equal(cadenaPdf('日本'), '(??)');
  assert.match(cadenaPdf('á\n\t'), /^\([\x20-\x7e]*\)$/, 'siempre ASCII');
});

test('el texto se parte para caber en el ancho, tambien una huella sin espacios', () => {
  const lineas = parteEnLineas('uno dos tres cuatro cinco seis siete ocho nueve diez', 'normal', 10, 80);
  assert.ok(lineas.length > 2);
  for (const linea of lineas) assert.ok(anchoDeTexto(linea, 'normal', 10) <= 80, linea);
  assert.equal(lineas.join(' '), 'uno dos tres cuatro cinco seis siete ocho nueve diez');

  const huella = 'a'.repeat(64);
  const trozos = parteEnLineas(huella, 'mono', 9, 200);
  assert.equal(trozos.join(''), huella);
  assert.ok(trozos.length > 1 && trozos.every((t) => anchoDeTexto(t, 'mono', 9) <= 200));

  assert.deepEqual(parteEnLineas('uno\n\ndos', 'normal', 10, 500), ['uno', '', 'dos']);
  assert.equal(anchoDeTexto('aaaa', 'mono', 10), 24);
  assert.equal(anchoDeTexto('ñ', 'normal', 10), anchoDeTexto('n', 'normal', 10));
});

test('dimensionesJpeg lee ancho, alto y componentes', () => {
  assert.deepEqual(dimensionesJpeg(jpegDePrueba(1600, 1200)), { ancho: 1600, alto: 1200, componentes: 3 });
  assert.deepEqual(dimensionesJpeg(jpegDePrueba(300, 4000, 1)), { ancho: 300, alto: 4000, componentes: 1 });
  assert.throws(() => dimensionesJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), /No es un JPEG/);
});

test('un PDF vacio es valido y tiene una pagina', () => {
  const pdf = new Pdf({ titulo: 'Prueba', cabecera: 'CABECERA', pie: 'Pie', fecha: new Date(AHORA) });
  const doc = abrePdf(pdf.bytes());
  assert.equal(doc.paginas, 1);
  assert.match(doc.objetos[6], /\/CreationDate \(D:20260101210000Z\)/);
  assert.deepEqual(doc.textos[0], ['ACTAMOON', 'CABECERA', 'Pie', 'Página 1 de 1']);
  for (const [i, base] of ['Helvetica', 'Helvetica-Bold', 'Courier'].entries()) {
    assert.match(doc.objetos[3 + i], new RegExp(`/BaseFont /${base} /Encoding /WinAnsiEncoding`));
  }
});

test('el texto largo pasa de pagina y cada pagina lleva cabecera, pie y numero', () => {
  const pdf = new Pdf({ titulo: 'Largo', cabecera: 'CABECERA', pie: 'Nota al pie', fecha: new Date(AHORA) });
  for (let i = 1; i <= 120; i += 1) pdf.texto(`Línea número ${i}`);
  const doc = abrePdf(pdf.bytes());
  assert.equal(doc.paginas, 3);
  assert.equal(pdf.paginas, 3);
  doc.textos.forEach((pagina, i) => {
    assert.ok(pagina.includes('ACTAMOON') && pagina.includes('CABECERA') && pagina.includes('Nota al pie'));
    assert.ok(pagina.includes(`Página ${i + 1} de 3`));
  });
  const lineas = doc.textos.flat().filter((t) => t.startsWith('Línea número'));
  assert.deepEqual(lineas, Array.from({ length: 120 }, (_, i) => `Línea número ${i + 1}`), 'ninguna linea se pierde ni se repite');
});

test('la foto se incrusta byte a byte como JPEG', () => {
  const jpeg = jpegDePrueba(1600, 1200);
  const pdf = new Pdf({ titulo: 'Foto', cabecera: 'C', pie: 'P', fecha: new Date(AHORA) });
  pdf.imagen(jpeg);
  const doc = abrePdf(pdf.bytes());
  assert.equal(doc.imagenes.length, 1);
  assert.match(doc.imagenes[0].objeto, /\/Width 1600 \/Height 1200 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode/);
  assert.deepEqual(Uint8Array.from(Buffer.from(doc.imagenes[0].contenido, 'latin1')), jpeg);
  // La imagen se declara en la pagina que la dibuja, no en todas.
  assert.match(doc.objetos[8], /\/Type \/Page .*\/XObject << \/Im1 7 0 R >>/);
  assert.throws(() => new Pdf({ titulo: 'x', cabecera: 'c', pie: 'p' }).imagen(jpegDePrueba(10, 10, 4)), /no admitido/);
});

// ---- Documentos ------------------------------------------------------------

const RECLAMACIONES = [
  { id: 'r1', mesaId: 'mesa-004', texto: 'Se cerró la puerta diez minutos.\nSegunda línea.', fotoId: 'f', fotoSha256: 'c'.repeat(64), perfilId: 'interventor-4', creadaEn: '2026-01-01T20:10:00.000Z' },
  { id: 'r2', mesaId: 'mesa-004', texto: 'El apoderado deja constancia.', fotoId: null, fotoSha256: null, perfilId: 'apoderado-1', creadaEn: '2026-01-01T20:20:00.000Z' },
];

function documentoDeMesa(extra = {}) {
  const validada = ACTAS[4];
  return pdfDeMesa({
    mesa: mesas[3],
    colegio: colegios[1],
    acta: validada,
    reclamaciones: RECLAMACIONES,
    perfiles,
    fotoJpeg: jpegDePrueba(1600, 1200),
    hora,
    generadoEn: AHORA,
    ...extra,
  });
}

test('el PDF de una mesa se abre y lleva sus datos, cifras, descuadre, reclamaciones, foto y huella', () => {
  const doc = abrePdf(documentoDeMesa().bytes());
  assert.equal(doc.paginas, 2);
  const t = doc.todo;
  for (const esperado of [
    'Acta de la Mesa 004',
    'Elecciones generales / municipales · Municipio de Ejemplo',
    'Colegio 2',
    'Interventor 4',
    'Apoderado 1',
    'Validada',
    'Versión del acta',
    'Interventor 4, HORA(2026-01-01T20:05:00.000Z)',
    'Administrador, HORA(2026-01-01T21:00:00.000Z)',
    'Electores censados',
    'Votos en blanco',
    'Candidatura C',
    'Acta enviada con descuadre.',
    'Nulos, blancos y candidaturas suman 1 voto más que los votantes.',
    'Motivo del descuadre: El acta suma 201',
    'Huella SHA-256 del archivo original',
    '4'.repeat(64),
    'HORA(2026-01-01T20:00:00.000Z)',
    '1. Interventor 4 · HORA(2026-01-01T20:10:00.000Z)',
    'Se cerró la puerta diez minutos.',
    'Segunda línea.',
    'c'.repeat(64),
    '2. Apoderado 1 · HORA(2026-01-01T20:20:00.000Z)',
    'Sin foto adjunta.',
  ]) {
    assert.ok(t.includes(esperado), `falta: ${esperado}`);
  }
  // Las cifras, en su tabla y en orden.
  const cifrasEnOrden = ['300', '200', '1', '1', '90', '60', '49'];
  const todos = doc.textos.flat();
  const desde = todos.indexOf('Electores censados');
  assert.deepEqual(cifrasEnOrden, [1, 3, 5, 7, 9, 11, 13].map((i) => todos[desde + i]));
  // La nota, al pie de todas las paginas y al final del documento.
  const nota = 'Hora del dispositivo, no verificada; demo con datos ficticios.';
  doc.textos.forEach((pagina) => assert.ok(pagina.includes(nota)));
  assert.equal(todos.filter((x) => x === nota).length, doc.paginas + 1);
  doc.textos.forEach((pagina) => assert.ok(pagina.includes('DEMO · DATO INTERNO, NO OFICIAL')));
  assert.equal(doc.imagenes.length, 1);
  assert.match(doc.imagenes[0].objeto, /\/Width 1600 \/Height 1200/);
  assert.match(doc.objetos[6], /\/Title \(Acta de la Mesa 004\)/);
});

test('el PDF de una mesa refleja un acta devuelta, sin reclamaciones y sin foto', () => {
  const doc = abrePdf(documentoDeMesa({ acta: ACTAS[3], reclamaciones: [], fotoJpeg: null }).bytes());
  const t = doc.todo;
  for (const esperado of ['Devuelta', 'Apoderado 1, HORA(2026-01-01T21:00:00.000Z)', 'Motivo de la devolución', 'Revisa los votantes', 'La foto no está en este dispositivo.', 'No hay reclamaciones registradas en esta mesa.', 'Hay 699 votantes más que electores.']) {
    assert.ok(t.includes(esperado), `falta: ${esperado}`);
  }
  assert.equal(doc.imagenes.length, 0);
  assert.ok(!t.includes('Validada'));
});

test('un acta que cuadra lo dice en su PDF', () => {
  const doc = abrePdf(documentoDeMesa({ acta: ACTAS[0], mesa: mesas[0], colegio: colegios[0], reclamaciones: [] }).bytes());
  assert.ok(doc.todo.includes('Las cifras cuadran.'));
  assert.ok(!doc.todo.includes('descuadre'));
});

test('el PDF del panel se abre y lleva estados, totales validados, provisional y desglose', () => {
  const pdf = pdfDelPanel({ consolidado: panel(ADMIN), ambito: 'Todo el municipio', hora, generadoEn: AHORA });
  const doc = abrePdf(pdf.bytes());
  assert.equal(doc.paginas, 2);
  const todos = doc.textos.flat();
  const t = doc.todo;
  for (const esperado of ['Panel consolidado', 'Todo el municipio', 'HORA(2026-01-01T21:00:00.000Z)', 'Actas por estado', 'Solo actas validadas.', 'Enviadas sin validar', 'Colegio 1', 'Colegio 2', 'Colegio 3', 'Subtotal validadas', 'Pendiente de validar (descuadre)', 'Validada (descuadre)']) {
    assert.ok(t.includes(esperado), `falta: ${esperado}`);
  }
  const trasLaEtiqueta = (etiqueta, n = 1) => todos[todos.indexOf(etiqueta) + n];
  assert.equal(trasLaEtiqueta('Con descuadre'), '2');
  // Primera tabla de suma = validadas; la segunda = provisional.
  const sumas = todos.map((x, i) => (x === 'Mesas sumadas' ? i : -1)).filter((i) => i >= 0);
  assert.equal(sumas.length, 2);
  assert.deepEqual([1, 3, 5, 7, 9, 11, 13, 15].map((d) => todos[sumas[0] + d]), ['3', '1200', '912', '6', '14', '390', '330', '173']);
  assert.deepEqual([1, 3, 5, 7, 9, 11, 13, 15].map((d) => todos[sumas[1] + d]), ['1', '600', '450', '5', '5', '210', '140', '80']);
  // Una fila del desglose y la mesa sin acta.
  const fila = todos.indexOf('Mesa 004');
  assert.deepEqual(todos.slice(fila, fila + 9), ['Mesa 004', 'Validada (descuadre)', '300', '200', '1', '1', '90', '60', '49']);
  const vacia = todos.indexOf('Mesa 006');
  assert.deepEqual(todos.slice(vacia, vacia + 4), ['Mesa 006', 'Sin acta', '-', '-']);
  const nota = 'Hora del dispositivo, no verificada; demo con datos ficticios.';
  doc.textos.forEach((pagina) => assert.ok(pagina.includes(nota)));
});
