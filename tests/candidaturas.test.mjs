import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';

import { actaValidada, nuevaActa } from '../js/actas.js';
import { nuevaEntrada, verificaCadena } from '../js/auditoria.js';
import { candidaturas, usaNombres } from '../js/candidaturas.js';
import { CONFIG } from '../js/config.js';
import { consolida, filasDeSuma } from '../js/consolidado.js';
import { datosEjemplo } from '../js/datos-ejemplo.js';
import { pdfDelPanel, pdfDeMesa } from '../js/documentos.js';
import { CANDIDATURA_MAXIMO, ErrorGestion, abreBorrador, guardaColegio, renombraCandidaturas } from '../js/gestion.js';
import { validaActa } from '../js/validaciones.js';

const { colegios, mesas, perfiles } = datosEjemplo();
const ADMIN = perfiles.find((p) => p.id === 'administrador');
const AHORA = '2026-01-01T21:00:00.000Z';
const POR_DEFECTO = { A: 'PP', B: 'VOX', C: 'SALF' };
const texto = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

// Los nombres vigentes viven en un modulo: cada test los deja como los encontro.
afterEach(() => usaNombres(null));

const cifras = { electores: 500, votantes: 412, nulos: 3, blancos: 5, candidaturas: { A: 200, B: 150, C: 54 } };
const ACTA = actaValidada(
  nuevaActa({
    id: 'acta-1',
    fotoId: 'foto-1',
    mesaId: 'mesa-001',
    perfil: perfiles.find((p) => p.id === 'interventor-1'),
    cifras,
    validacion: validaActa(cifras, CONFIG.candidaturas),
    motivo: '',
    foto: { sha256: '1'.repeat(64), capturadaEn: '2026-01-01T20:00:00.000Z' },
    enviadaEn: '2026-01-01T20:05:00.000Z',
    version: 1,
  }),
  ADMIN,
  AHORA,
);

const borrador = (nombres = null) => abreBorrador({ colegios, mesas, perfiles, actas: [ACTA], reclamaciones: [], candidaturas: usaNombres(nombres) });
const nombresDe = (b) => Object.fromEntries(b.candidaturas.map(({ id, nombre }) => [id, nombre]));
const falla = (b, nombres, codigo, campo) =>
  assert.throws(
    () => renombraCandidaturas(b, nombres),
    (error) => error instanceof ErrorGestion && error.codigo === codigo && error.campo === campo,
    `${JSON.stringify(nombres)} -> ${codigo} en ${campo}`,
  );

// Cadenas de texto de un PDF de la demo, con sus escapes deshechos.
const cadenasDe = (pdf) =>
  [...Buffer.from(pdf.bytes()).toString('latin1').matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(([, cadena]) =>
    cadena.replace(/\\([0-7]{3})|\\(.)/g, (_, octal, otro) => (octal ? String.fromCharCode(parseInt(octal, 8)) : otro)),
  );
const pdfMesa = () => pdfDeMesa({ mesa: mesas[0], colegio: colegios[0], acta: ACTA, reclamaciones: [], perfiles, fotoJpeg: null, hora: (iso) => iso, generadoEn: AHORA });
const consolidado = () => consolida({ colegios, mesas, actas: [ACTA], candidaturas: candidaturas() });
const pdfPanel = () => pdfDelPanel({ consolidado: consolidado(), ambito: 'Todo el municipio', hora: (iso) => iso, generadoEn: AHORA });

// ---- Nombres de partida ------------------------------------------------------

test('las candidaturas son tres, con identificadores A, B y C y los nombres de partida', () => {
  assert.deepEqual(CONFIG.candidaturas, [
    { id: 'A', nombre: 'PP' },
    { id: 'B', nombre: 'VOX' },
    { id: 'C', nombre: 'SALF' },
  ]);
  assert.deepEqual(candidaturas(), CONFIG.candidaturas);
  assert.equal(CANDIDATURA_MAXIMO, 20);
});

// ---- Validacion de nombres -----------------------------------------------------

test('un nombre se recorta, no puede quedar vacio ni pasar de 20 caracteres', () => {
  const b = borrador();
  renombraCandidaturas(b, { A: '  Lista   Uno  ' });
  assert.deepEqual(nombresDe(b), { A: 'Lista Uno', B: 'VOX', C: 'SALF' });
  falla(b, { B: '' }, 'nombre-vacio', 'B');
  falla(b, { C: '   ' }, 'nombre-vacio', 'C');
  falla(b, { B: 'x'.repeat(21) }, 'candidatura-larga', 'B');
  renombraCandidaturas(b, { B: 'x'.repeat(20) });
  assert.equal(b.candidaturas[1].nombre, 'x'.repeat(20));
  // Los espacios de los lados no cuentan para el limite.
  renombraCandidaturas(b, { C: ` ${'y'.repeat(20)} ` });
  assert.equal(b.candidaturas[2].nombre, 'y'.repeat(20));
});

test('dos candidaturas no pueden llamarse igual, sin distinguir mayusculas', () => {
  const b = borrador();
  falla(b, { B: 'pp' }, 'candidatura-repetida', 'B');
  falla(b, { A: 'Lista', C: 'LISTA' }, 'candidatura-repetida', 'C');
  falla(b, { A: 'salf' }, 'candidatura-repetida', 'C');
  assert.deepEqual(nombresDe(b), POR_DEFECTO, 'un guardado que falla no cambia nada');
  assert.deepEqual(b.registros, []);
  // Se validan juntas: dos pueden intercambiarse el nombre en un solo guardado.
  renombraCandidaturas(b, { A: 'VOX', B: 'PP' });
  assert.deepEqual(nombresDe(b), { A: 'VOX', B: 'PP', C: 'SALF' });
});

test('no se anaden ni se quitan candidaturas, y los identificadores no cambian', () => {
  const b = borrador();
  renombraCandidaturas(b, { A: 'Uno', B: 'Dos', C: 'Tres', D: 'Cuatro', id: 'Z' });
  assert.deepEqual(b.candidaturas, [
    { id: 'A', nombre: 'Uno' },
    { id: 'B', nombre: 'Dos' },
    { id: 'C', nombre: 'Tres' },
  ]);
});

// ---- Solo cambia la etiqueta ---------------------------------------------------

test('renombrar no toca ninguna acta ni ninguna cifra', () => {
  const antes = structuredClone(ACTA);
  const totalAntes = structuredClone(consolidado().total);
  const b = borrador();
  renombraCandidaturas(b, { A: 'Lista Uno', B: 'Lista Dos', C: 'Lista Tres' });
  usaNombres(nombresDe(b));
  assert.deepEqual(ACTA, antes);
  assert.equal(b.actas[0], ACTA, 'el borrador no copia ni cambia las actas');
  assert.deepEqual(consolidado().total, totalAntes);
  assert.deepEqual(Object.keys(ACTA.cifras.candidaturas), ['A', 'B', 'C']);
  assert.equal(validaActa(ACTA.cifras, candidaturas()).cuadra, validaActa(ACTA.cifras, CONFIG.candidaturas).cuadra);
});

// ---- Auditoria -----------------------------------------------------------------

test('cada nombre cambiado deja su entrada, con el anterior y el nuevo', () => {
  const b = borrador();
  renombraCandidaturas(b, { A: 'Lista Uno', B: 'VOX', C: 'Lista Tres' });
  assert.deepEqual(b.registros, [
    { accion: 'candidatura-renombrada', objeto: { tipo: 'candidatura', id: 'A', nombre: 'Lista Uno' }, cambio: [{ campo: 'nombre', antes: 'PP', despues: 'Lista Uno' }], mesaId: null },
    { accion: 'candidatura-renombrada', objeto: { tipo: 'candidatura', id: 'C', nombre: 'Lista Tres' }, cambio: [{ campo: 'nombre', antes: 'SALF', despues: 'Lista Tres' }], mesaId: null },
  ]);
  assert.equal(CONFIG.gestion.detalle(b.registros[0]), 'Candidatura A. Nombre: de «PP» a «Lista Uno».');
  assert.equal(CONFIG.auditoria.acciones['candidatura-renombrada'], 'Candidatura renombrada');
  // Guardar sin cambiar nada no apunta nada.
  const otro = borrador();
  renombraCandidaturas(otro, { A: ' PP ', B: 'VOX', C: 'SALF' });
  assert.deepEqual(otro.registros, []);
});

test('las entradas del cambio entran en la misma cadena de huellas, y tocarlas la rompe', async () => {
  const b = borrador();
  guardaColegio(b, { nombre: 'Colegio 9' });
  renombraCandidaturas(b, { A: 'Lista Uno', B: 'Lista Dos' });
  const cadena = [await nuevaEntrada(null, { hora: AHORA, perfil: ADMIN, accion: 'datos-cargados', detalle: 'x' })];
  for (const registro of b.registros) {
    cadena.push(await nuevaEntrada(cadena.at(-1), { hora: AHORA, perfil: ADMIN, accion: registro.accion, mesaId: registro.mesaId, detalle: CONFIG.gestion.detalle(registro), objeto: registro.objeto, cambio: registro.cambio }));
  }
  assert.deepEqual(cadena.map((e) => e.accion), ['datos-cargados', 'colegio-creado', 'candidatura-renombrada', 'candidatura-renombrada']);
  assert.deepEqual(await verificaCadena(cadena), { ok: true, total: 4, rotaEn: null, motivo: null });
  assert.equal(cadena[2].perfilId, 'administrador');
  // Cambiar el nombre anterior apuntado rompe la cadena en esa entrada.
  const manipulada = structuredClone(cadena);
  manipulada[2].cambio[0].antes = 'Otro';
  assert.deepEqual(await verificaCadena(manipulada), { ok: false, total: 4, rotaEn: 3, motivo: 'contenido' });
});

// ---- El nombre vigente, en todas partes ----------------------------------------

test('acta, panel y los dos PDF usan el nombre vigente', () => {
  for (const nombres of [POR_DEFECTO, { A: 'Lista Uno', B: 'B2', C: 'Agrupación de Ejemplo' }]) {
    usaNombres(nombres);
    const esperados = ['A', 'B', 'C'].map((id) => nombres[id]);
    // Filas del acta y de la suma del panel: [nombre, votos, identificador].
    assert.deepEqual(filasDeSuma(ACTA.cifras, CONFIG.acta.campos, candidaturas()).slice(4), [
      [esperados[0], 200, 'A'],
      [esperados[1], 150, 'B'],
      [esperados[2], 54, 'C'],
    ]);
    const leyenda = `Columnas: A = ${esperados[0]} · B = ${esperados[1]} · C = ${esperados[2]}.`;
    assert.equal(CONFIG.panel.textos.leyenda(candidaturas()), leyenda);

    const mesa = cadenasDe(pdfMesa());
    const panel = cadenasDe(pdfPanel());
    for (const [i, nombre] of esperados.entries()) {
      const votos = String([200, 150, 54][i]);
      // PDF de la mesa: el nombre, y a su derecha sus votos.
      assert.equal(mesa[mesa.indexOf(nombre) + 1], votos, `PDF de mesa: ${nombre}`);
      // PDF del panel: en la suma de validadas.
      assert.equal(panel[panel.indexOf(nombre) + 1], votos, `PDF del panel: ${nombre}`);
    }
    // El desglose del panel lleva la letra en la columna y la leyenda con los nombres.
    assert.ok(panel.includes(leyenda), 'leyenda del desglose en el PDF del panel');
    for (const viejo of ['Candidatura A', 'Candidatura B', 'Candidatura C']) {
      assert.ok(!mesa.includes(viejo) && !panel.includes(viejo), `ya no dice ${viejo}`);
    }
    // Los avisos de datos ficticios siguen en los dos documentos.
    for (const cadenas of [mesa, panel]) {
      assert.ok(cadenas.includes('Hora del dispositivo, no verificada; demo con datos ficticios.'));
      assert.ok(cadenas.includes('DEMO · DATO INTERNO, NO OFICIAL'));
    }
  }
});

test('un nombre de 20 caracteres cabe en una linea de las tablas del PDF', () => {
  const largo = 'M'.repeat(20);
  usaNombres({ A: largo });
  for (const cadenas of [cadenasDe(pdfMesa()), cadenasDe(pdfPanel())]) {
    assert.equal(cadenas[cadenas.indexOf(largo) + 1], '200', 'el nombre va entero y seguido de sus votos');
  }
});

test('las vistas y los PDF leen los nombres vigentes, no los de config.js', () => {
  for (const ruta of ['js/vistas/acta.js', 'js/vistas/panel.js', 'js/documentos.js']) {
    const codigo = texto(ruta);
    assert.ok(!codigo.includes('CONFIG.candidaturas'), `${ruta} no usa los nombres de partida`);
    assert.ok(codigo.includes('candidaturas()'), `${ruta} usa los vigentes`);
  }
  // El texto generico se queda.
  assert.equal(CONFIG.acta.textos.tituloCandidaturas, 'Votos por candidatura');
});

// ---- Restaurar y reiniciar -----------------------------------------------------

test('restaurar por defecto devuelve los tres nombres y lo deja apuntado', () => {
  const b = borrador({ A: 'Lista Uno', B: 'VOX', C: 'Lista Tres' });
  renombraCandidaturas(b, POR_DEFECTO);
  assert.deepEqual(nombresDe(b), POR_DEFECTO);
  assert.deepEqual(b.registros.map((r) => [r.objeto.id, r.cambio[0].antes, r.cambio[0].despues]), [
    ['A', 'Lista Uno', 'PP'],
    ['C', 'Lista Tres', 'SALF'],
  ]);
  // Si ya estaban por defecto, no hay nada que apuntar.
  const igual = borrador();
  renombraCandidaturas(igual, POR_DEFECTO);
  assert.deepEqual(igual.registros, []);
  // La accion de la app restaura a los nombres de config.js, con confirmacion.
  const app = texto('js/app.js');
  assert.match(app, /async restauraCandidaturas\(\) \{\s*const porDefecto = CONFIG\.candidaturas;\s*const aceptado = await confirmar\(/);
});

test('los nombres guardados sobreviven a recargar, y reiniciar la demo vuelve a los de partida', () => {
  // Lo guardado se aplica tal cual; lo que falte, de config.js.
  assert.deepEqual(usaNombres({ A: 'Lista Uno', B: 'Lista Dos', C: 'Lista Tres' }).map((c) => c.nombre), ['Lista Uno', 'Lista Dos', 'Lista Tres']);
  assert.deepEqual(usaNombres({ B: 'Lista Dos' }).map((c) => c.nombre), ['PP', 'Lista Dos', 'SALF']);
  // Reiniciar vacia la base de datos: sin nada guardado, los de partida.
  assert.deepEqual(usaNombres(null), CONFIG.candidaturas);
  assert.notEqual(usaNombres(null)[0], CONFIG.candidaturas[0], 'la lista vigente es una copia: no se cambia config.js');

  const app = texto('js/app.js');
  // Se guardan en IndexedDB, en la misma transaccion que su entrada de auditoria...
  assert.match(app, /meta: \[\{ clave: 'candidaturas', valor: Object\.fromEntries\(borrador\.candidaturas\.map/);
  // ...se leen al arrancar y tras cada cambio...
  assert.match(app, /db\.leer\('meta', 'candidaturas'\)/);
  assert.match(app, /candidaturas: usaNombres\(nombres\?\.valor \?\? null\)/);
  // ...y "Reiniciar demo" vacia todos los almacenes, tambien ese.
  assert.match(app, /await db\.vaciarTodo\(\);\s*await recarga\(\);/);
  assert.match(texto('js/db.js'), /const nombres = Object\.keys\(ALMACENES\);[\s\S]*?objectStore\(nombre\)\.clear\(\)/);
});

test('el aviso de datos ficticios sigue en la bienvenida, en el banner y en el pie de los PDF', () => {
  const html = texto('index.html');
  assert.ok(html.includes('<strong>Demo de presentación con datos ficticios.</strong>'));
  assert.ok(html.includes('<strong>Demo con datos ficticios.</strong> No uses actas reales.'));
  assert.equal(CONFIG.pdf.textos.nota, 'Hora del dispositivo, no verificada; demo con datos ficticios.');
});
