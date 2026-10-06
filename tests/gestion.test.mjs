import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actaDevuelta, actaValidada, nuevaActa } from '../js/actas.js';
import { GENESIS, canonico, nuevaEntrada, verificaCadena } from '../js/auditoria.js';
import { CONFIG } from '../js/config.js';
import { consolida } from '../js/consolidado.js';
import { datosEjemplo } from '../js/datos-ejemplo.js';
import { ErrorGestion, abreBorrador, borra, cambiaActivo, creaPerfil, guardaColegio, guardaMesa, nombreValido, puedeBorrarse, tieneRegistros } from '../js/gestion.js';
import { calculaKpi } from '../js/kpi.js';
import { mesasVisibles, puedeCapturar, puedeReclamar, puedeValidar, puedeVer, resuelve } from '../js/permisos.js';
import { validaActa } from '../js/validaciones.js';

const AHORA = '2026-01-01T21:00:00.000Z';
const c = (electores, votantes, nulos, blancos, x, y, z) => ({ electores, votantes, nulos, blancos, candidaturas: { A: x, B: y, C: z } });

// Mismo reparto que los tests del panel: 001 y 002 validadas, 003 enviada con
// descuadre, 004 v1 devuelta y v2 validada, 005 devuelta, 006 sin acta. Una
// reclamacion en la 004.
function escenario() {
  const { colegios, mesas, perfiles } = datosEjemplo();
  const perfil = (id) => perfiles.find((p) => p.id === id);
  const acta = (n, cifras, { version = 1, motivo = '' } = {}) =>
    nuevaActa({
      id: `acta-${n}-v${version}`,
      fotoId: `foto-${n}`,
      mesaId: `mesa-00${n}`,
      perfil: perfil(`interventor-${n}`),
      cifras,
      validacion: validaActa(cifras, CONFIG.candidaturas),
      motivo,
      foto: { sha256: String(n).repeat(64), capturadaEn: '2026-01-01T20:00:00.000Z' },
      enviadaEn: '2026-01-01T20:05:00.000Z',
      version,
    });
  const actas = [
    actaValidada(acta(1, c(500, 412, 3, 5, 200, 150, 54)), perfil('apoderado-1'), AHORA),
    actaValidada(acta(2, c(400, 300, 2, 8, 100, 120, 70)), perfil('administrador'), AHORA),
    acta(3, c(600, 450, 5, 5, 210, 140, 80), { motivo: 'El acta tiene una enmienda' }),
    actaDevuelta(acta(4, c(300, 999, 1, 1, 90, 60, 49), { motivo: 'Cifra ilegible' }), perfil('apoderado-1'), 'Revisa los votantes', AHORA),
    actaValidada(acta(4, c(300, 200, 1, 1, 90, 60, 49), { version: 2, motivo: 'El acta suma 201' }), perfil('administrador'), AHORA),
    actaDevuelta(acta(5, c(700, 500, 10, 10, 200, 200, 80)), perfil('apoderado-2'), 'La foto no se lee', AHORA),
  ];
  const reclamaciones = [{ id: 'r1', mesaId: 'mesa-004', texto: 'x', perfilId: 'interventor-4', creadaEn: AHORA }];
  return { colegios, mesas, perfiles, actas, reclamaciones };
}
const codigo = (fn) => {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ErrorGestion, String(error));
    return error.codigo;
  }
  return null;
};
const totales = (e) => consolida({ colegios: e.colegios, mesas: e.mesas, actas: e.actas, candidaturas: CONFIG.candidaturas });
const borradorNuevo = () => abreBorrador(escenario());

// ---- Nombres -----------------------------------------------------------------

test('el nombre se recorta y no puede ir vacio, pasar de 40 caracteres ni repetirse', () => {
  const { colegios } = escenario();
  assert.equal(nombreValido('  Colegio   del  Sur ', colegios), 'Colegio del Sur');
  assert.equal(codigo(() => nombreValido('   ', colegios)), 'nombre-vacio');
  assert.equal(nombreValido('x'.repeat(40), colegios), 'x'.repeat(40));
  assert.equal(codigo(() => nombreValido('x'.repeat(41), colegios)), 'nombre-largo');
  assert.equal(codigo(() => nombreValido('colegio 1', colegios)), 'nombre-repetido', 'sin distinguir mayusculas');
  assert.equal(nombreValido('Colegio 1', colegios, 'colegio-1'), 'Colegio 1', 'su propio nombre no cuenta como repetido');
});

// ---- Altas y ediciones ---------------------------------------------------------

test('alta de colegio, de mesa y de perfiles numerados, con su asignacion', () => {
  const b = borradorNuevo();
  const colegioId = guardaColegio(b, { nombre: 'Colegio 4' });
  assert.equal(colegioId, 'colegio-4');
  const apoderadoId = creaPerfil(b, 'apoderado', 'Apoderado');
  const interventorId = creaPerfil(b, 'interventor', 'Interventor');
  assert.deepEqual([apoderadoId, interventorId], ['apoderado-3', 'interventor-7']);
  assert.deepEqual(b.perfiles.at(-1), { id: 'interventor-7', rol: 'interventor', etiqueta: 'Interventor 7', activo: true, mesaIds: [] });
  guardaColegio(b, { id: colegioId, nombre: 'Colegio 4', apoderadoId });
  const mesaId = guardaMesa(b, { nombre: 'Mesa 007', colegioId, interventorId });
  assert.equal(mesaId, 'mesa-007');
  assert.deepEqual(b.mesas.at(-1), { id: 'mesa-007', colegioId: 'colegio-4', nombre: 'Mesa 007', activo: true });
  assert.deepEqual(b.perfiles.find((p) => p.id === 'apoderado-3').colegioIds, ['colegio-4']);
  assert.deepEqual(b.perfiles.find((p) => p.id === 'interventor-7').mesaIds, ['mesa-007']);
  assert.deepEqual(b.registros.map((r) => r.accion), ['colegio-creado', 'perfil-creado', 'perfil-creado', 'asignacion-cambiada', 'mesa-creada', 'asignacion-cambiada']);
  // Los perfiles nuevos ya valen para los permisos.
  const nueva = b.mesas.at(-1);
  assert.equal(puedeCapturar(b.perfiles.find((p) => p.id === 'interventor-7'), nueva), true);
  assert.deepEqual(mesasVisibles(b.perfiles.find((p) => p.id === 'apoderado-3'), b.mesas).map((m) => m.id), ['mesa-007']);
});

test('un perfil no lleva nombre de persona y no puede ser administrador', () => {
  const b = borradorNuevo();
  assert.equal(codigo(() => creaPerfil(b, 'administrador', 'Administrador')), 'rol-equivocado');
  const id = creaPerfil(b, 'interventor', 'Interventor');
  assert.match(b.perfiles.find((p) => p.id === id).etiqueta, /^Interventor \d+$/);
});

test('editar apunta el valor anterior y el nuevo; guardar sin cambios no apunta nada', () => {
  const b = borradorNuevo();
  guardaColegio(b, { id: 'colegio-1', nombre: 'Colegio 1' });
  guardaMesa(b, { id: 'mesa-006', nombre: 'Mesa 006', colegioId: 'colegio-3' });
  assert.deepEqual(b.registros, []);
  guardaColegio(b, { id: 'colegio-1', nombre: 'Colegio Norte' });
  guardaMesa(b, { id: 'mesa-006', nombre: 'Mesa F', colegioId: 'colegio-1' });
  assert.deepEqual(b.registros, [
    { accion: 'colegio-editado', objeto: { tipo: 'colegio', id: 'colegio-1', nombre: 'Colegio Norte' }, cambio: [{ campo: 'nombre', antes: 'Colegio 1', despues: 'Colegio Norte' }], mesaId: null },
    {
      accion: 'mesa-editada',
      objeto: { tipo: 'mesa', id: 'mesa-006', nombre: 'Mesa F' },
      cambio: [
        { campo: 'nombre', antes: 'Mesa 006', despues: 'Mesa F' },
        { campo: 'colegio', antes: 'Colegio 3', despues: 'Colegio Norte' },
      ],
      mesaId: 'mesa-006',
    },
  ]);
  assert.equal(codigo(() => guardaMesa(b, { id: 'mesa-006', nombre: 'Mesa 001', colegioId: 'colegio-1' })), 'nombre-repetido');
  assert.equal(codigo(() => guardaMesa(b, { id: 'mesa-999', nombre: 'X', colegioId: 'colegio-1' })), 'no-existe');
});

// ---- Integridad ----------------------------------------------------------------

test('no se borra una mesa con actas o reclamaciones, ni un colegio con mesas', () => {
  const b = borradorNuevo();
  for (const id of ['mesa-001', 'mesa-003', 'mesa-004', 'mesa-005']) {
    assert.equal(tieneRegistros(b, id), true, id);
    assert.equal(puedeBorrarse(b, 'mesa', id), false, id);
    assert.equal(codigo(() => borra(b, 'mesa', id)), 'mesa-con-registros', id);
  }
  assert.equal(codigo(() => borra(b, 'colegio', 'colegio-3')), 'colegio-con-mesas');
  assert.equal(codigo(() => borra(b, 'perfil', 'interventor-1')), 'perfil-no-se-borra');
  assert.equal(b.mesas.length, 6);
  assert.deepEqual(b.registros, []);

  // La 006 no tiene nada: se borra, y con ella su asignacion.
  assert.equal(puedeBorrarse(b, 'mesa', 'mesa-006'), true);
  borra(b, 'mesa', 'mesa-006');
  assert.deepEqual(b.borrados, { colegios: [], mesas: ['mesa-006'] });
  assert.deepEqual(b.perfiles.find((p) => p.id === 'interventor-6').mesaIds, []);
  assert.equal(b.registros.at(-1).accion, 'mesa-borrada');
  assert.equal(puedeBorrarse(b, 'colegio', 'colegio-3'), false, 'le queda la 005');
});

test('un colegio vacio si se borra, y deja de estar asignado', () => {
  const b = borradorNuevo();
  const id = guardaColegio(b, { nombre: 'Colegio 4', apoderadoId: 'apoderado-2' });
  assert.deepEqual(b.perfiles.find((p) => p.id === 'apoderado-2').colegioIds, ['colegio-3', 'colegio-4']);
  borra(b, 'colegio', id);
  assert.deepEqual(b.perfiles.find((p) => p.id === 'apoderado-2').colegioIds, ['colegio-3']);
  assert.deepEqual(b.borrados.colegios, ['colegio-4']);
});

test('una mesa con actas o reclamaciones no cambia de colegio; una vacia si', () => {
  const b = borradorNuevo();
  assert.equal(codigo(() => guardaMesa(b, { id: 'mesa-001', nombre: 'Mesa 001', colegioId: 'colegio-3' })), 'mesa-con-registros');
  assert.equal(codigo(() => guardaMesa(b, { id: 'mesa-004', nombre: 'Mesa 004', colegioId: 'colegio-1' })), 'mesa-con-registros');
  assert.equal(b.mesas.find((m) => m.id === 'mesa-001').colegioId, 'colegio-1');
  guardaMesa(b, { id: 'mesa-006', nombre: 'Mesa 006', colegioId: 'colegio-1' });
  assert.equal(b.mesas.find((m) => m.id === 'mesa-006').colegioId, 'colegio-1');
});

test('reasignar no reescribe lo ya registrado', () => {
  const e = escenario();
  const antes = JSON.stringify([e.actas, e.reclamaciones]);
  const b = abreBorrador(e);
  const nuevo = creaPerfil(b, 'interventor', 'Interventor');
  guardaMesa(b, { id: 'mesa-001', nombre: 'Mesa 001', colegioId: 'colegio-1', interventorId: nuevo });
  guardaColegio(b, { id: 'colegio-1', nombre: 'Colegio 1', apoderadoId: 'apoderado-2' });
  assert.equal(JSON.stringify([b.actas, b.reclamaciones]), antes);
  assert.deepEqual([b.actas[0].enviadaPor, b.actas[0].validadaPor], ['interventor-1', 'apoderado-1']);
  // La asignacion si ha cambiado.
  assert.deepEqual(b.perfiles.find((p) => p.id === 'interventor-1').mesaIds, []);
  assert.deepEqual(b.perfiles.find((p) => p.id === nuevo).mesaIds, ['mesa-001']);
  assert.deepEqual(b.perfiles.find((p) => p.id === 'apoderado-1').colegioIds, ['colegio-2']);
  assert.deepEqual(b.perfiles.find((p) => p.id === 'apoderado-2').colegioIds, ['colegio-3', 'colegio-1']);
  assert.deepEqual(b.registros.at(-1).cambio, [{ campo: 'apoderado', antes: 'Apoderado 1', despues: 'Apoderado 2' }]);
  // El perfil antiguo sigue existiendo, asi que su nombre se sigue resolviendo.
  assert.ok(b.perfiles.some((p) => p.id === 'interventor-1'));
});

test('un interventor lleva una sola mesa: al asignarlo a otra deja la que tenia, y queda apuntado', () => {
  const b = borradorNuevo();
  guardaMesa(b, { id: 'mesa-006', nombre: 'Mesa 006', colegioId: 'colegio-3', interventorId: 'interventor-1' });
  assert.deepEqual(b.perfiles.find((p) => p.id === 'interventor-1').mesaIds, ['mesa-006']);
  assert.deepEqual(b.perfiles.find((p) => p.id === 'interventor-6').mesaIds, []);
  assert.deepEqual(
    b.registros.map((r) => [r.objeto.id, r.cambio[0]]),
    [
      ['mesa-001', { campo: 'interventor', antes: 'Interventor 1', despues: null }],
      ['mesa-006', { campo: 'interventor', antes: 'Interventor 6', despues: 'Interventor 1' }],
    ],
  );
  guardaMesa(b, { id: 'mesa-006', nombre: 'Mesa 006', colegioId: 'colegio-3', interventorId: null });
  assert.deepEqual(b.perfiles.find((p) => p.id === 'interventor-1').mesaIds, []);
  assert.equal(codigo(() => guardaMesa(b, { id: 'mesa-006', nombre: 'Mesa 006', colegioId: 'colegio-3', interventorId: 'apoderado-1' })), 'rol-equivocado');
});

// ---- Desactivar ----------------------------------------------------------------

test('una mesa desactivada queda cerrada a cambios: ni capturas ni reclamaciones, pero lo pendiente se resuelve', () => {
  const e = escenario();
  const b = abreBorrador(e);
  cambiaActivo(b, 'mesa', 'mesa-003', false);
  cambiaActivo(b, 'mesa', 'mesa-005', false);
  cambiaActivo(b, 'mesa', 'mesa-006', false);
  const perfil = (id) => b.perfiles.find((p) => p.id === id);
  const mesa = (id) => b.mesas.find((m) => m.id === id);
  assert.equal(mesa('mesa-003').activo, false);
  // 003: acta enviada. Ni captura ni reclamacion; validar o devolver, si.
  assert.equal(puedeCapturar(perfil('interventor-3'), mesa('mesa-003')), false);
  assert.equal(puedeReclamar(perfil('interventor-3'), mesa('mesa-003')), false);
  assert.equal(puedeReclamar(perfil('apoderado-1'), mesa('mesa-003')), false);
  assert.equal(puedeValidar(perfil('apoderado-1'), mesa('mesa-003'), e.actas[2]), true);
  assert.equal(puedeValidar(perfil('administrador'), mesa('mesa-003'), e.actas[2]), true);
  // 005: acta devuelta. Cerrada, ya no se reenvia.
  assert.equal(puedeCapturar(perfil('interventor-5'), mesa('mesa-005')), false);
  // 006: sin acta. Cerrada, no se captura.
  assert.equal(puedeCapturar(perfil('interventor-6'), mesa('mesa-006')), false);
  // Una abierta sigue igual.
  assert.equal(puedeCapturar(perfil('interventor-1'), mesa('mesa-001')), true);
  assert.equal(puedeReclamar(perfil('interventor-1'), mesa('mesa-001')), true);
  // Y se sigue viendo.
  assert.equal(mesasVisibles(perfil('interventor-3'), b.mesas).length, 1);

  cambiaActivo(b, 'mesa', 'mesa-006', true);
  assert.equal(puedeCapturar(perfil('interventor-6'), mesa('mesa-006')), true);
  assert.deepEqual(b.registros.map((r) => r.accion), ['mesa-desactivada', 'mesa-desactivada', 'mesa-desactivada', 'mesa-reactivada']);
  assert.deepEqual(b.registros[0].cambio, [{ campo: 'estado', antes: 'activo', despues: 'desactivado' }]);
});

test('desactivar un colegio cierra sus mesas y lo deja apuntado; reactivarlo no las reabre solo', () => {
  const b = borradorNuevo();
  cambiaActivo(b, 'colegio', 'colegio-2', false);
  assert.deepEqual(b.mesas.filter((m) => m.activo === false).map((m) => m.id), ['mesa-003', 'mesa-004']);
  assert.deepEqual(b.registros[0].cambio, [
    { campo: 'estado', antes: 'activo', despues: 'desactivado' },
    { campo: 'mesa', antes: 'Mesa 003: activo', despues: 'Mesa 003: desactivado' },
    { campo: 'mesa', antes: 'Mesa 004: activo', despues: 'Mesa 004: desactivado' },
  ]);
  assert.equal(codigo(() => cambiaActivo(b, 'mesa', 'mesa-003', true)), 'colegio-desactivado');
  assert.equal(codigo(() => guardaMesa(b, { nombre: 'Mesa 007', colegioId: 'colegio-2' })), 'colegio-desactivado');
  cambiaActivo(b, 'colegio', 'colegio-2', true);
  assert.equal(b.mesas.find((m) => m.id === 'mesa-003').activo, false);
  cambiaActivo(b, 'mesa', 'mesa-003', true);
  assert.equal(b.mesas.find((m) => m.id === 'mesa-003').activo, true);
});

test('un perfil desactivado no se puede asignar, y el administrador no se desactiva', () => {
  const b = borradorNuevo();
  cambiaActivo(b, 'perfil', 'interventor-6', false);
  assert.equal(b.registros[0].accion, 'perfil-desactivado');
  assert.equal(codigo(() => guardaMesa(b, { id: 'mesa-001', nombre: 'Mesa 001', colegioId: 'colegio-1', interventorId: 'interventor-6' })), 'perfil-desactivado');
  assert.equal(codigo(() => cambiaActivo(b, 'perfil', 'administrador', false)), 'administrador');
  cambiaActivo(b, 'perfil', 'interventor-6', false);
  assert.equal(b.registros.length, 1, 'desactivar dos veces no apunta dos veces');
});

// ---- Los totales validados no cambian -------------------------------------------

test('renombrar, reasignar, crear y desactivar no alteran los totales ya validados ni los KPI de lo registrado', () => {
  const e = escenario();
  const antes = totales(e);
  const kpiAntes = calculaKpi({ ...e, auditoria: [], ahora: AHORA, generales: true });

  const b = abreBorrador(e);
  guardaColegio(b, { id: 'colegio-1', nombre: 'Colegio Norte', apoderadoId: 'apoderado-2' });
  guardaMesa(b, { id: 'mesa-001', nombre: 'Mesa A', colegioId: 'colegio-1', interventorId: creaPerfil(b, 'interventor', 'Interventor') });
  cambiaActivo(b, 'mesa', 'mesa-002', false);
  cambiaActivo(b, 'colegio', 'colegio-2', false);
  cambiaActivo(b, 'perfil', 'apoderado-1', false);
  const despues = totales(b);

  assert.deepEqual(despues.total, antes.total);
  assert.deepEqual(despues.total.validadas, { mesas: 3, electores: 1200, votantes: 912, nulos: 6, blancos: 14, candidaturas: { A: 390, B: 330, C: 173 } });
  assert.deepEqual(despues.contadores, antes.contadores);
  assert.deepEqual(despues.porColegio.map((g) => g.validadas), antes.porColegio.map((g) => g.validadas), 'los subtotales por colegio tampoco');
  assert.equal(despues.porColegio[0].colegio.nombre, 'Colegio Norte');

  const kpiDespues = calculaKpi({ ...b, auditoria: [], ahora: AHORA, generales: true });
  for (const clave of ['base', 'cobertura', 'estados', 'calidad', 'tiempos']) assert.deepEqual(kpiDespues[clave], kpiAntes[clave], clave);
});

test('crear una mesa nueva cambia la base de la cobertura, no los totales', () => {
  const e = escenario();
  const b = abreBorrador(e);
  guardaMesa(b, { nombre: 'Mesa 007', colegioId: 'colegio-1' });
  assert.deepEqual(totales(b).total, totales(e).total);
  assert.equal(totales(b).contadores.mesas, 7);
  assert.deepEqual(calculaKpi({ ...b, auditoria: [], ahora: AHORA, generales: true }).cobertura.validada, { n: 3, de: 7, valor: 3 / 7 });
});

// ---- Auditoria -----------------------------------------------------------------

// Cadena de la fase 3, con las huellas que daba el codigo de entonces.
const CADENA_FASE_3 = [
  { seq: 1, hora: '2026-01-01T20:00:00.000Z', perfilId: null, rol: null, accion: 'datos-cargados', mesaId: null, detalle: '3 colegios, 6 mesas y 9 perfiles.', hashPrevio: GENESIS, hash: '3771b42bce3dc48d0a65c6fb4fd5c82142339bcaed7b54dcf4e30e85f34b4679' },
  { seq: 2, hora: '2026-01-01T20:05:00.000Z', perfilId: 'interventor-3', rol: 'interventor', accion: 'acta-enviada', mesaId: 'mesa-003', detalle: `Versión 1, con descuadre. Foto ${'a'.repeat(64)}`, hashPrevio: '3771b42bce3dc48d0a65c6fb4fd5c82142339bcaed7b54dcf4e30e85f34b4679', hash: '90d7405b92483b7fc777f6420bba3c885821c146eefde697af4a2c5c30492ff2' },
  { seq: 3, hora: '2026-01-01T20:30:00.000Z', perfilId: 'apoderado-1', rol: 'apoderado', accion: 'acta-devuelta', mesaId: 'mesa-003', detalle: 'Versión 1. Motivo: Los nulos no coinciden', hashPrevio: '90d7405b92483b7fc777f6420bba3c885821c146eefde697af4a2c5c30492ff2', hash: 'b55c8d703161abfcbd9c1ee375f2dc26f7716782bd2e197ec78e7b912cd1409e' },
];

test('la cadena de la fase 3, con sus huellas conocidas, sigue verificando', async () => {
  assert.deepEqual(await verificaCadena(CADENA_FASE_3), { ok: true, total: 3, rotaEn: null, motivo: null });
  // Y el codigo de hoy sigue dando esas mismas huellas para esas mismas entradas.
  const perfil = (id, rol) => (id ? { id, rol } : null);
  let anterior = null;
  for (const original of CADENA_FASE_3) {
    anterior = await nuevaEntrada(anterior, { hora: original.hora, perfil: perfil(original.perfilId, original.rol), accion: original.accion, mesaId: original.mesaId, detalle: original.detalle });
    assert.equal(anterior.hash, original.hash, `entrada ${original.seq}`);
    assert.ok(!('objeto' in anterior) && !('cambio' in anterior), 'una entrada antigua no gana campos');
  }
  assert.equal(canonico(CADENA_FASE_3[0]), '[1,"2026-01-01T20:00:00.000Z",null,null,"datos-cargados",null,"3 colegios, 6 mesas y 9 perfiles."]');
});

test('las entradas de gestion siguen la cadena de la fase 3 y llevan quien, cuando, objeto y valor anterior y nuevo', async () => {
  const b = borradorNuevo();
  guardaColegio(b, { id: 'colegio-1', nombre: 'Colegio Norte' });
  cambiaActivo(b, 'mesa', 'mesa-006', false);
  const admin = { id: 'administrador', rol: 'administrador' };
  const cadena = [...CADENA_FASE_3];
  for (const [i, registro] of b.registros.entries()) {
    cadena.push(await nuevaEntrada(cadena.at(-1), { hora: `2026-01-01T21:0${i}:00.000Z`, perfil: admin, accion: registro.accion, mesaId: registro.mesaId, detalle: 'texto', objeto: registro.objeto, cambio: registro.cambio }));
  }
  assert.deepEqual(await verificaCadena(cadena), { ok: true, total: 5, rotaEn: null, motivo: null });
  const edicion = cadena[3];
  assert.deepEqual(
    [edicion.seq, edicion.hashPrevio, edicion.perfilId, edicion.rol, edicion.hora, edicion.accion],
    [4, CADENA_FASE_3[2].hash, 'administrador', 'administrador', '2026-01-01T21:00:00.000Z', 'colegio-editado'],
  );
  assert.deepEqual(edicion.objeto, { tipo: 'colegio', id: 'colegio-1', nombre: 'Colegio Norte' });
  assert.deepEqual(edicion.cambio, [{ campo: 'nombre', antes: 'Colegio 1', despues: 'Colegio Norte' }]);
  assert.equal(cadena[4].mesaId, 'mesa-006');

  // El objeto y el cambio entran en la huella: tocarlos rompe la cadena ahi.
  for (const manipula of [(e) => ({ ...e, cambio: [{ campo: 'nombre', antes: 'Colegio 1', despues: 'Otro' }] }), (e) => ({ ...e, objeto: { ...e.objeto, id: 'colegio-2' } }), (e) => ({ ...e, cambio: undefined })]) {
    const rota = [...cadena];
    rota[3] = manipula(rota[3]);
    assert.deepEqual(await verificaCadena(rota), { ok: false, total: 5, rotaEn: 4, motivo: 'contenido' });
  }
});

test('cada accion de gestion tiene su nombre y su texto en la configuracion', () => {
  const acciones = ['colegio-creado', 'colegio-editado', 'colegio-desactivado', 'colegio-reactivado', 'colegio-borrado', 'mesa-creada', 'mesa-editada', 'mesa-desactivada', 'mesa-reactivada', 'mesa-borrada', 'perfil-creado', 'perfil-desactivado', 'perfil-reactivado', 'asignacion-cambiada'];
  for (const accion of acciones) assert.ok(CONFIG.auditoria.acciones[accion], accion);
  const G = CONFIG.gestion;
  assert.equal(G.detalle({ objeto: { nombre: 'Colegio Norte' }, cambio: [{ campo: 'nombre', antes: 'Colegio 1', despues: 'Colegio Norte' }] }), 'Colegio Norte. Nombre: de «Colegio 1» a «Colegio Norte».');
  assert.equal(G.detalle({ objeto: { nombre: 'Mesa 007' }, cambio: [{ campo: 'nombre', antes: null, despues: 'Mesa 007' }, { campo: 'interventor', antes: 'Interventor 1', despues: null }] }), 'Mesa 007. Nombre: «Mesa 007». Interventor: de «Interventor 1» a ninguno.');
  for (const error of ['nombre-vacio', 'nombre-largo', 'nombre-repetido', 'mesa-con-registros', 'colegio-con-mesas', 'colegio-desactivado', 'perfil-desactivado', 'administrador', 'rol-equivocado', 'no-existe', 'perfil-no-se-borra']) assert.ok(G.errores[error], error);
});

// ---- Rutas ---------------------------------------------------------------------

test('la gestion es solo para el administrador', () => {
  const { perfiles } = datosEjemplo();
  const perfil = (id) => perfiles.find((p) => p.id === id);
  for (const hash of ['#/organizacion', '#/organizacion/colegio/nuevo', '#/organizacion/colegio/colegio-1', '#/organizacion/mesa/nueva', '#/organizacion/mesa/mesa-001']) {
    const destino = resuelve(hash);
    assert.ok(destino, hash);
    assert.equal(puedeVer(perfil('administrador'), destino.ruta), true, hash);
    assert.equal(puedeVer(perfil('apoderado-1'), destino.ruta), false, hash);
    assert.equal(puedeVer(perfil('interventor-1'), destino.ruta), false, hash);
    assert.equal(puedeVer(null, destino.ruta), false, hash);
  }
  assert.deepEqual(resuelve('#/organizacion/mesa/mesa-001').params, ['mesa-001']);
});
