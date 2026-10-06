import assert from 'node:assert/strict';
import { test } from 'node:test';

import { actaDe, actaDevuelta, actaValidada, admiteCaptura, nuevaActa } from '../js/actas.js';
import { GENESIS, canonico, nuevaEntrada, verificaCadena } from '../js/auditoria.js';
import { CONFIG } from '../js/config.js';
import { datosEjemplo } from '../js/datos-ejemplo.js';
import { puedeCapturar, puedeReclamar, puedeValidar, puedeVer, resuelve } from '../js/permisos.js';
import { validaActa } from '../js/validaciones.js';

const { mesas, perfiles } = datosEjemplo();
const perfil = (id) => perfiles.find((p) => p.id === id);
const mesa = (id) => mesas.find((m) => m.id === id);

const CIFRAS = { electores: 500, votantes: 412, nulos: 3, blancos: 5, candidaturas: { A: 200, B: 150, C: 54 } };
const FOTO = { sha256: 'a'.repeat(64), capturadaEn: '2026-01-01T20:00:00.000Z' };
const AHORA = '2026-01-01T20:30:00.000Z';

// Acta enviada por el interventor 3 (mesa 003, colegio 2, apoderado 1).
function enviada(version = 1) {
  return nuevaActa({
    id: `acta-${version}`,
    fotoId: 'foto-1',
    mesaId: 'mesa-003',
    perfil: perfil('interventor-3'),
    cifras: CIFRAS,
    validacion: validaActa(CIFRAS, CONFIG.candidaturas),
    motivo: '',
    foto: FOTO,
    enviadaEn: '2026-01-01T20:05:00.000Z',
    version,
  });
}

// ---- Doble confirmacion ----------------------------------------------------

test('valida el apoderado del colegio o el administrador, y nadie mas', () => {
  const acta = enviada();
  assert.equal(puedeValidar(perfil('apoderado-1'), mesa('mesa-003'), acta), true);
  assert.equal(puedeValidar(perfil('administrador'), mesa('mesa-003'), acta), true);
  assert.equal(puedeValidar(perfil('apoderado-2'), mesa('mesa-003'), acta), false, 'apoderado de otro colegio');
  assert.equal(puedeValidar(perfil('interventor-3'), mesa('mesa-003'), acta), false, 'quien la envio');
  assert.equal(puedeValidar(perfil('interventor-4'), mesa('mesa-003'), acta), false, 'otro interventor');
  assert.equal(puedeValidar(null, mesa('mesa-003'), acta), false);
});

test('nunca valida quien envio el acta, tenga el rol que tenga', () => {
  const acta = { ...enviada(), enviadaPor: 'apoderado-1' };
  assert.equal(puedeValidar(perfil('apoderado-1'), mesa('mesa-003'), acta), false);
  assert.equal(puedeValidar(perfil('administrador'), mesa('mesa-003'), acta), true);
  const propia = { ...enviada(), enviadaPor: 'administrador' };
  assert.equal(puedeValidar(perfil('administrador'), mesa('mesa-003'), propia), false);
  assert.throws(() => actaValidada(propia, perfil('administrador'), AHORA), /quien la envio/);
  assert.throws(() => actaDevuelta(propia, perfil('administrador'), 'un motivo', AHORA), /quien la envio/);
});

test('solo se valida un acta enviada', () => {
  const validada = actaValidada(enviada(), perfil('apoderado-1'), AHORA);
  const devuelta = actaDevuelta(enviada(), perfil('apoderado-1'), 'Los nulos no coinciden', AHORA);
  for (const acta of [null, undefined, validada, devuelta]) {
    assert.equal(puedeValidar(perfil('apoderado-1'), mesa('mesa-003'), acta), false);
    assert.equal(puedeValidar(perfil('administrador'), mesa('mesa-003'), acta), false);
  }
  assert.throws(() => actaValidada(validada, perfil('administrador'), AHORA), /acta enviada/);
  assert.throws(() => actaDevuelta(validada, perfil('administrador'), 'x', AHORA), /acta enviada/);
  assert.throws(() => actaValidada(devuelta, perfil('administrador'), AHORA), /acta enviada/);
});

test('validar deja quien y cuando, sin tocar lo demas', () => {
  const acta = enviada();
  const validada = actaValidada(acta, perfil('apoderado-1'), AHORA);
  assert.deepEqual(validada, { ...acta, estado: 'validada', validadaPor: 'apoderado-1', validadaEn: AHORA });
  assert.equal(acta.estado, 'enviada', 'el original no se modifica');
});

test('devolver guarda quien, cuando y el motivo', () => {
  const devuelta = actaDevuelta(enviada(), perfil('administrador'), '  Los nulos no coinciden  ', AHORA);
  assert.equal(devuelta.estado, 'devuelta');
  assert.deepEqual(devuelta.devolucion, { por: 'administrador', en: AHORA, motivo: 'Los nulos no coinciden' });
  assert.equal(devuelta.validadaPor, undefined);
});

test('solo una mesa sin acta o con el acta devuelta admite captura', () => {
  const acta = enviada();
  assert.equal(admiteCaptura(null), true);
  assert.equal(admiteCaptura(acta), false);
  assert.equal(admiteCaptura(actaValidada(acta, perfil('apoderado-1'), AHORA)), false);
  assert.equal(admiteCaptura(actaDevuelta(acta, perfil('apoderado-1'), 'motivo', AHORA)), true);
});

test('la correccion es una version nueva y la devuelta se conserva', () => {
  const devuelta = actaDevuelta(enviada(1), perfil('apoderado-1'), 'Los nulos no coinciden', AHORA);
  const corregida = enviada(2);
  const actas = [devuelta, corregida];
  assert.equal(actaDe(actas, 'mesa-003'), corregida);
  assert.deepEqual([corregida.version, corregida.estado, corregida.devolucion], [2, 'enviada', undefined]);
  assert.equal(actas[0].estado, 'devuelta');
  assert.equal(puedeValidar(perfil('apoderado-1'), mesa('mesa-003'), corregida), true);
  assert.equal(puedeCapturar(perfil('interventor-3'), mesa('mesa-003')), true);
});

// ---- Reclamaciones ---------------------------------------------------------

test('reclaman el interventor de la mesa y el apoderado de su colegio', () => {
  assert.equal(puedeReclamar(perfil('interventor-3'), mesa('mesa-003')), true);
  assert.equal(puedeReclamar(perfil('apoderado-1'), mesa('mesa-003')), true);
  assert.equal(puedeReclamar(perfil('interventor-4'), mesa('mesa-003')), false);
  assert.equal(puedeReclamar(perfil('apoderado-2'), mesa('mesa-003')), false);
  assert.equal(puedeReclamar(perfil('administrador'), mesa('mesa-003')), false);
  assert.equal(puedeReclamar(null, mesa('mesa-003')), false);

  const ruta = resuelve('#/mesa/mesa-003/reclamacion');
  assert.deepEqual([ruta.ruta.id, ruta.params], ['reclamacion', ['mesa-003']]);
  assert.equal(puedeVer(perfil('interventor-3'), ruta.ruta), true);
  assert.equal(puedeVer(perfil('apoderado-1'), ruta.ruta), true);
  assert.equal(puedeVer(perfil('administrador'), ruta.ruta), false);
});

// ---- Auditoria -------------------------------------------------------------

async function cadena(n) {
  const entradas = [];
  for (let i = 0; i < n; i += 1) {
    entradas.push(
      await nuevaEntrada(entradas.at(-1) ?? null, {
        hora: `2026-01-01T20:0${i}:00.000Z`,
        perfil: i === 0 ? null : perfil('interventor-3'),
        accion: i === 0 ? 'datos-cargados' : 'acta-enviada',
        mesaId: i === 0 ? null : 'mesa-003',
        detalle: `detalle ${i}`,
      }),
    );
  }
  return entradas;
}

test('la primera entrada cuelga del genesis y cada una de la anterior', async () => {
  const [a, b, c] = await cadena(3);
  assert.deepEqual([a.seq, b.seq, c.seq], [1, 2, 3]);
  assert.equal(a.hashPrevio, GENESIS);
  assert.equal(b.hashPrevio, a.hash);
  assert.equal(c.hashPrevio, b.hash);
  for (const e of [a, b, c]) assert.match(e.hash, /^[0-9a-f]{64}$/);
  assert.equal(new Set([a.hash, b.hash, c.hash]).size, 3);
  assert.deepEqual([a.perfilId, a.rol, a.mesaId], [null, null, null]);
  assert.deepEqual([b.perfilId, b.rol, b.mesaId, b.accion], ['interventor-3', 'interventor', 'mesa-003', 'acta-enviada']);
});

test('la huella es reproducible y depende de todos los campos', async () => {
  const datos = { hora: '2026-01-01T20:00:00.000Z', perfil: perfil('apoderado-1'), accion: 'acta-validada', mesaId: 'mesa-003', detalle: 'Versión 1.' };
  const base = await nuevaEntrada(null, datos);
  assert.equal((await nuevaEntrada(null, datos)).hash, base.hash);
  assert.equal(canonico(base), '[1,"2026-01-01T20:00:00.000Z","apoderado-1","apoderado","acta-validada","mesa-003","Versión 1."]');
  const variantes = [
    { hora: '2026-01-01T20:00:00.001Z' },
    { perfil: perfil('administrador') },
    { accion: 'acta-devuelta' },
    { mesaId: 'mesa-004' },
    { detalle: 'Versión 2.' },
  ];
  for (const cambio of variantes) {
    assert.notEqual((await nuevaEntrada(null, { ...datos, ...cambio })).hash, base.hash, JSON.stringify(Object.keys(cambio)));
  }
  assert.notEqual((await nuevaEntrada(base, datos)).hash, base.hash, 'la posicion en la cadena tambien cuenta');
});

test('una cadena intacta se verifica, tambien si esta vacia', async () => {
  assert.deepEqual(await verificaCadena([]), { ok: true, total: 0, rotaEn: null, motivo: null });
  assert.deepEqual(await verificaCadena(await cadena(1)), { ok: true, total: 1, rotaEn: null, motivo: null });
  assert.deepEqual(await verificaCadena(await cadena(6)), { ok: true, total: 6, rotaEn: null, motivo: null });
});

test('cambiar el contenido de una entrada rompe la cadena en esa entrada', async () => {
  for (const campo of ['hora', 'perfilId', 'rol', 'accion', 'mesaId', 'detalle']) {
    const entradas = await cadena(5);
    entradas[2] = { ...entradas[2], [campo]: 'manipulado' };
    assert.deepEqual(await verificaCadena(entradas), { ok: false, total: 5, rotaEn: 3, motivo: 'contenido' }, campo);
  }
});

test('cambiar una huella, quitar, repetir o reordenar entradas tambien la rompe', async () => {
  const con = async (cambia) => {
    const entradas = await cadena(5);
    return verificaCadena(cambia(entradas) ?? entradas);
  };
  assert.deepEqual(await con((e) => { e[2] = { ...e[2], hash: 'f'.repeat(64) }; }), { ok: false, total: 5, rotaEn: 3, motivo: 'contenido' });
  assert.deepEqual(await con((e) => { e[2] = { ...e[2], hashPrevio: 'f'.repeat(64) }; }), { ok: false, total: 5, rotaEn: 3, motivo: 'enlace' });
  assert.deepEqual(await con((e) => { e.splice(2, 1); }), { ok: false, total: 4, rotaEn: 4, motivo: 'secuencia' });
  assert.deepEqual(await con((e) => { e.shift(); }), { ok: false, total: 4, rotaEn: 2, motivo: 'secuencia' });
  assert.deepEqual(await con((e) => { e.splice(2, 0, e[1]); }), { ok: false, total: 6, rotaEn: 2, motivo: 'secuencia' });
  assert.deepEqual(await con((e) => { [e[1], e[2]] = [e[2], e[1]]; }), { ok: false, total: 5, rotaEn: 3, motivo: 'secuencia' });
  // Quitar la ultima no se detecta: la cadena que queda es coherente.
  assert.equal((await con((e) => { e.pop(); })).ok, true);
});

test('una cadena reescrita entera vuelve a verificarse: el mecanismo no es una garantia', async () => {
  const original = await cadena(4);
  const reescrita = [];
  for (const entrada of original) {
    reescrita.push(
      await nuevaEntrada(reescrita.at(-1) ?? null, {
        hora: entrada.hora,
        perfil: entrada.perfilId ? perfil(entrada.perfilId) : null,
        accion: entrada.accion,
        mesaId: entrada.mesaId,
        detalle: entrada.seq === 2 ? 'detalle falsificado' : entrada.detalle,
      }),
    );
  }
  assert.equal((await verificaCadena(reescrita)).ok, true);
  assert.notEqual(reescrita.at(-1).hash, original.at(-1).hash, 'solo se nota comparando con una huella guardada fuera');
});

test('cada accion registrada tiene su nombre en la configuracion', () => {
  assert.deepEqual(Object.keys(CONFIG.auditoria.acciones), ['datos-cargados', 'acta-enviada', 'acta-validada', 'acta-devuelta', 'reclamacion-registrada']);
  assert.match(CONFIG.auditoria.textos.aviso, /solo lo impide un servidor/);
  assert.match(CONFIG.auditoria.textos.avisoTitulo, /no es una garantía/);
});
