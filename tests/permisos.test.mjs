import assert from 'node:assert/strict';
import { test } from 'node:test';

import { datosEjemplo } from '../js/datos-ejemplo.js';
import { mesasVisibles, navegacion, puedeVer, resuelve, rutaInicial } from '../js/permisos.js';

const { colegios, mesas, perfiles } = datosEjemplo();
const perfil = (id) => perfiles.find((p) => p.id === id);
const ruta = (hash) => resuelve(hash).ruta;
const ids = (lista) => lista.map((x) => x.id);

test('los datos de ejemplo son coherentes', () => {
  assert.equal(colegios.length, 3);
  assert.equal(mesas.length, 6);
  for (const mesa of mesas) {
    assert.ok(colegios.some((c) => c.id === mesa.colegioId), `${mesa.id} tiene colegio`);
    const interventores = perfiles.filter((p) => p.rol === 'interventor' && p.mesaIds.includes(mesa.id));
    assert.equal(interventores.length, 1, `${mesa.id} tiene un interventor`);
  }
  for (const colegio of colegios) {
    const apoderados = perfiles.filter((p) => p.rol === 'apoderado' && p.colegioIds.includes(colegio.id));
    assert.equal(apoderados.length, 1, `${colegio.id} tiene un apoderado`);
  }
  assert.equal(new Set(ids(perfiles)).size, perfiles.length);
});

test('las rutas se resuelven por hash', () => {
  assert.equal(ruta('').id, 'inicio');
  assert.equal(ruta('#/').id, 'inicio');
  assert.equal(ruta('#/mesas').id, 'mesas');
  assert.deepEqual(resuelve('#/mesa/mesa-003').params, ['mesa-003']);
  assert.equal(resuelve('#/no-existe'), null);
  assert.equal(resuelve('#/mesa/'), null);
});

test('sin perfil solo se ven las vistas publicas', () => {
  assert.deepEqual(ids(navegacion(null)), ['inicio', 'ayuda']);
  assert.equal(puedeVer(null, ruta('#/mesas')), false);
  assert.equal(puedeVer(null, ruta('#/mesa/mesa-001')), false);
  assert.equal(puedeVer(null, ruta('#/organizacion')), false);
  assert.equal(puedeVer(null, ruta('#/ayuda')), true);
  assert.deepEqual(mesasVisibles(null, mesas), []);
});

test('el interventor solo ve su mesa', () => {
  const p = perfil('interventor-3');
  assert.deepEqual(ids(navegacion(p)), ['inicio', 'mesas', 'ayuda']);
  assert.equal(puedeVer(p, ruta('#/organizacion')), false);
  assert.equal(puedeVer(p, ruta('#/auditoria')), false);
  assert.deepEqual(ids(mesasVisibles(p, mesas)), ['mesa-003']);
  assert.equal(rutaInicial(p), '#/mesa/mesa-003');
});

test('el apoderado solo ve las mesas de sus colegios', () => {
  const uno = perfil('apoderado-1');
  assert.deepEqual(ids(navegacion(uno)), ['inicio', 'mesas', 'ayuda']);
  assert.equal(puedeVer(uno, ruta('#/organizacion')), false);
  assert.equal(puedeVer(uno, ruta('#/auditoria')), false);
  assert.deepEqual(ids(mesasVisibles(uno, mesas)), ['mesa-001', 'mesa-002', 'mesa-003', 'mesa-004']);
  assert.deepEqual(ids(mesasVisibles(perfil('apoderado-2'), mesas)), ['mesa-005', 'mesa-006']);
  assert.equal(rutaInicial(uno), '#/mesas');
});

test('el administrador lo ve todo', () => {
  const p = perfil('administrador');
  assert.deepEqual(ids(navegacion(p)), ['inicio', 'mesas', 'organizacion', 'auditoria', 'ayuda']);
  assert.equal(puedeVer(p, ruta('#/organizacion')), true);
  assert.equal(puedeVer(p, ruta('#/auditoria')), true);
  assert.equal(mesasVisibles(p, mesas).length, mesas.length);
});
