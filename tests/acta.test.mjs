import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actaDe, nuevaActa, registroFoto } from '../js/actas.js';
import { CONFIG } from '../js/config.js';
import { datosEjemplo } from '../js/datos-ejemplo.js';
import { dimensionesReducidas } from '../js/foto.js';
import { sha256Hex } from '../js/hash.js';
import { puedeCapturar, puedeVer, resuelve } from '../js/permisos.js';
import { leeEntero, puedeEnviar, validaActa } from '../js/validaciones.js';

const CANDIDATURAS = CONFIG.candidaturas;
const MINIMO = CONFIG.acta.motivoMinimo;

// 500 electores, 412 votantes = 3 nulos + 5 blancos + 200 + 150 + 54.
const cuadrada = () => ({ electores: 500, votantes: 412, nulos: 3, blancos: 5, candidaturas: { A: 200, B: 150, C: 54 } });
const con = (cambios) => ({ ...cuadrada(), ...cambios });
const regla = (validacion, id) => validacion.reglas.find((r) => r.id === id);

// ---- leeEntero -------------------------------------------------------------

test('leeEntero acepta solo enteros sin signo', () => {
  assert.equal(leeEntero('0'), 0);
  assert.equal(leeEntero(' 412 '), 412);
  assert.equal(leeEntero('007'), 7);
  assert.equal(leeEntero(''), null);
  assert.equal(leeEntero('   '), null);
  assert.equal(leeEntero(undefined), null);
  for (const malo of ['-1', '1.5', '1,5', '1.000', '12a', '1e3', '+3', '٣']) {
    assert.ok(Number.isNaN(leeEntero(malo)), malo);
  }
});

// ---- validaActa ------------------------------------------------------------

test('un acta que cuadra pasa las dos reglas', () => {
  const v = validaActa(cuadrada(), CANDIDATURAS);
  assert.equal(v.completa, true);
  assert.equal(v.cuadra, true);
  assert.deepEqual(v.errores, []);
  assert.deepEqual(v.reglas.map((r) => [r.id, r.ok]), [['votantes-electores', true], ['suma-votantes', true]]);
  assert.equal(regla(v, 'suma-votantes').suma, 412);
});

test('limites: votantes igual a electores cuadra, uno mas no', () => {
  assert.equal(validaActa(con({ electores: 412 }), CANDIDATURAS).cuadra, true);
  const v = validaActa(con({ electores: 411 }), CANDIDATURAS);
  assert.equal(v.cuadra, false);
  assert.deepEqual([regla(v, 'votantes-electores').ok, regla(v, 'votantes-electores').diferencia], [false, 1]);
  assert.equal(regla(v, 'suma-votantes').ok, true);
});

test('la suma detecta un voto de mas y un voto de menos', () => {
  const sobra = validaActa(con({ nulos: 4 }), CANDIDATURAS);
  assert.deepEqual([sobra.cuadra, regla(sobra, 'suma-votantes').diferencia], [false, 1]);
  const falta = validaActa(con({ candidaturas: { A: 200, B: 150, C: 51 } }), CANDIDATURAS);
  assert.deepEqual([falta.cuadra, regla(falta, 'suma-votantes').diferencia, regla(falta, 'suma-votantes').suma], [false, -3, 409]);
});

test('pueden fallar las dos reglas a la vez', () => {
  const v = validaActa(con({ electores: 400, blancos: 6 }), CANDIDATURAS);
  assert.deepEqual(v.reglas.map((r) => r.ok), [false, false]);
  assert.equal(regla(v, 'votantes-electores').diferencia, 12);
});

test('todo a cero cuadra', () => {
  const v = validaActa({ electores: 0, votantes: 0, nulos: 0, blancos: 0, candidaturas: { A: 0, B: 0, C: 0 } }, CANDIDATURAS);
  assert.equal(v.cuadra, true);
});

test('una cifra vacia o mal escrita deja el acta incompleta y sin reglas', () => {
  const vacia = validaActa(con({ nulos: null }), CANDIDATURAS);
  assert.deepEqual([vacia.completa, vacia.cuadra, vacia.reglas.length], [false, false, 0]);
  assert.deepEqual(vacia.errores, [{ campo: 'nulos', tipo: 'falta' }]);

  const mala = validaActa(con({ votantes: NaN, candidaturas: { A: 200, B: -1, C: 54 } }), CANDIDATURAS);
  assert.deepEqual(mala.errores, [
    { campo: 'votantes', tipo: 'invalido' },
    { campo: 'candidatura-B', tipo: 'invalido' },
  ]);

  const sinCandidatura = validaActa(con({ candidaturas: { A: 200, B: 150 } }), CANDIDATURAS);
  assert.deepEqual(sinCandidatura.errores, [{ campo: 'candidatura-C', tipo: 'falta' }]);

  const decimal = validaActa(con({ blancos: 5.5 }), CANDIDATURAS);
  assert.deepEqual(decimal.errores, [{ campo: 'blancos', tipo: 'invalido' }]);
});

test('un acta recien abierta pide todas las cifras', () => {
  const v = validaActa({ candidaturas: {} }, CANDIDATURAS);
  assert.deepEqual(
    v.errores.map((e) => e.campo),
    ['electores', 'votantes', 'nulos', 'blancos', 'candidatura-A', 'candidatura-B', 'candidatura-C'],
  );
});

// ---- puedeEnviar -----------------------------------------------------------

const envio = (cifras, resto = {}) =>
  puedeEnviar({
    validacion: validaActa(cifras, CANDIDATURAS),
    hayFoto: true,
    confirmaPapel: false,
    motivo: '',
    motivoMinimo: MINIMO,
    ...resto,
  });

test('un acta que cuadra y tiene foto se puede enviar sin mas', () => {
  assert.deepEqual(envio(cuadrada()), { ok: true, falta: [] });
});

test('sin foto no se envia', () => {
  assert.deepEqual(envio(cuadrada(), { hayFoto: false }), { ok: false, falta: ['foto'] });
});

test('con cifras incompletas no se envia, aunque se marque la casilla', () => {
  const r = envio(con({ nulos: null }), { confirmaPapel: true, motivo: 'un motivo bien largo' });
  assert.deepEqual(r, { ok: false, falta: ['cifras'] });
});

test('un descuadre bloquea el envio hasta confirmar y escribir el motivo', () => {
  const descuadrada = con({ nulos: 4 });
  assert.deepEqual(envio(descuadrada), { ok: false, falta: ['confirmacion', 'motivo'] });
  assert.deepEqual(envio(descuadrada, { confirmaPapel: true }), { ok: false, falta: ['motivo'] });
  assert.deepEqual(envio(descuadrada, { motivo: 'El acta tiene una enmienda' }), { ok: false, falta: ['confirmacion'] });
  assert.deepEqual(envio(descuadrada, { confirmaPapel: true, motivo: 'x'.repeat(MINIMO - 1) }), { ok: false, falta: ['motivo'] });
  assert.deepEqual(envio(descuadrada, { confirmaPapel: true, motivo: `  ${'x'.repeat(MINIMO - 1)}   ` }), { ok: false, falta: ['motivo'] });
  assert.deepEqual(envio(descuadrada, { confirmaPapel: true, motivo: 'x'.repeat(MINIMO) }), { ok: true, falta: [] });
});

// ---- hash ------------------------------------------------------------------

test('sha256Hex da los vectores conocidos de SHA-256', async () => {
  const bytes = (texto) => new TextEncoder().encode(texto);
  assert.equal(await sha256Hex(bytes('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(await sha256Hex(bytes('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    await sha256Hex(bytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
});

test('sha256Hex acepta ArrayBuffer y cambia con un solo byte', async () => {
  const datos = new Uint8Array(4096).map((_, i) => i % 251);
  const huella = await sha256Hex(datos.buffer);
  assert.match(huella, /^[0-9a-f]{64}$/);
  assert.equal(await sha256Hex(datos), huella);
  datos[4095] ^= 1;
  assert.notEqual(await sha256Hex(datos), huella);
});

// ---- foto ------------------------------------------------------------------

test('la copia reducida no pasa de 1600 px de lado y no amplia', () => {
  assert.equal(CONFIG.acta.fotoLadoMaximo, 1600);
  assert.deepEqual(dimensionesReducidas(4000, 3000, 1600), { ancho: 1600, alto: 1200 });
  assert.deepEqual(dimensionesReducidas(3000, 4000, 1600), { ancho: 1200, alto: 1600 });
  assert.deepEqual(dimensionesReducidas(1600, 900, 1600), { ancho: 1600, alto: 900 });
  assert.deepEqual(dimensionesReducidas(800, 600, 1600), { ancho: 800, alto: 600 });
  assert.deepEqual(dimensionesReducidas(10000, 3, 1600), { ancho: 1600, alto: 1 });
});

// ---- actas -----------------------------------------------------------------

const { mesas, perfiles } = datosEjemplo();
const perfil = (id) => perfiles.find((p) => p.id === id);
const FOTO = { original: 'ORIGINAL', vista: 'VISTA', sha256: 'a'.repeat(64), capturadaEn: '2026-01-01T20:00:00.000Z', tipo: 'image/jpeg', bytes: 1234 };

function acta(cifras, motivo = '') {
  return nuevaActa({
    id: 'acta-1',
    fotoId: 'foto-1',
    mesaId: 'mesa-003',
    perfil: perfil('interventor-3'),
    cifras,
    validacion: validaActa(cifras, CANDIDATURAS),
    motivo,
    foto: FOTO,
    enviadaEn: '2026-01-01T20:05:00.000Z',
  });
}

test('el acta enviada guarda cifras, huella, horas y remitente', () => {
  assert.deepEqual(acta(cuadrada()), {
    id: 'acta-1',
    mesaId: 'mesa-003',
    version: 1,
    estado: 'enviada',
    cifras: cuadrada(),
    descuadre: null,
    fotoId: 'foto-1',
    fotoSha256: 'a'.repeat(64),
    capturadaEn: '2026-01-01T20:00:00.000Z',
    enviadaEn: '2026-01-01T20:05:00.000Z',
    enviadaPor: 'interventor-3',
  });
});

test('el acta con descuadre queda marcada con sus reglas y su motivo', () => {
  const a = acta(con({ electores: 400, blancos: 6 }), '  El acta tiene una enmienda  ');
  assert.deepEqual(a.descuadre, { reglas: ['votantes-electores', 'suma-votantes'], motivo: 'El acta tiene una enmienda' });
  assert.equal(a.estado, 'enviada');
});

test('la foto se guarda con el original intacto y la huella del original', () => {
  assert.deepEqual(registroFoto('foto-1', FOTO), {
    id: 'foto-1',
    original: 'ORIGINAL',
    vista: 'VISTA',
    sha256: 'a'.repeat(64),
    tipo: 'image/jpeg',
    bytes: 1234,
    creadaEn: '2026-01-01T20:00:00.000Z',
  });
});

test('actaDe devuelve la version mas alta de la mesa', () => {
  const actas = [
    { id: 'x', mesaId: 'mesa-001', version: 1 },
    { id: 'y', mesaId: 'mesa-003', version: 1 },
    { id: 'z', mesaId: 'mesa-003', version: 2 },
  ];
  assert.equal(actaDe(actas, 'mesa-003').id, 'z');
  assert.equal(actaDe(actas, 'mesa-001').id, 'x');
  assert.equal(actaDe(actas, 'mesa-002'), null);
  assert.equal(actaDe([], 'mesa-001'), null);
});

// ---- permisos de captura ---------------------------------------------------

test('solo el interventor de la mesa captura su acta', () => {
  const mesa = (id) => mesas.find((m) => m.id === id);
  assert.equal(puedeCapturar(perfil('interventor-3'), mesa('mesa-003')), true);
  assert.equal(puedeCapturar(perfil('interventor-3'), mesa('mesa-004')), false);
  assert.equal(puedeCapturar(perfil('apoderado-1'), mesa('mesa-003')), false);
  assert.equal(puedeCapturar(perfil('administrador'), mesa('mesa-003')), false);
  assert.equal(puedeCapturar(null, mesa('mesa-003')), false);
});

test('la ruta de captura es solo para interventores', () => {
  const destino = resuelve('#/mesa/mesa-003/acta');
  assert.equal(destino.ruta.id, 'acta');
  assert.deepEqual(destino.params, ['mesa-003']);
  assert.equal(resuelve('#/mesa/mesa-003').ruta.id, 'mesa');
  assert.equal(puedeVer(perfil('interventor-3'), destino.ruta), true);
  assert.equal(puedeVer(perfil('apoderado-1'), destino.ruta), false);
  assert.equal(puedeVer(perfil('administrador'), destino.ruta), false);
  assert.equal(puedeVer(null, destino.ruta), false);
});
