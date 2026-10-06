import { CONFIG } from '../config.js';
import { espacio } from '../db.js';
import { h } from '../ui.js';
import { tamano } from './comun.js';

export function vistaAyuda() {
  const almacenamiento = h('p', { id: 'espacio-usado' }, 'Calculando el espacio usado.');
  pintaEspacio(almacenamiento);

  return {
    titulo: 'Ayuda',
    nodo: h(
      'div',
      { class: 'vista vista--texto' },
      h('h1', { tabindex: '-1' }, 'Ayuda'),
      h(
        'p',
        null,
        `${CONFIG.producto} es una demo de presentación con datos ficticios. Enseña cómo trabajarían un interventor, un apoderado y un administrador durante un recuento paralelo interno. No es un sistema oficial ni publica resultados.`,
      ),

      h('h2', null, 'Qué no demuestra esta demo'),
      h('p', null, 'Todo esto pertenece al producto con servidor, no a esta demo:'),
      h(
        'dl',
        { class: 'limites' },
        CONFIG.noDemuestra.map((limite) => h('div', null, h('dt', null, limite.titulo), h('dd', null, limite.texto))),
      ),

      h('h2', null, 'Dónde están los datos'),
      h(
        'p',
        null,
        'Todo se guarda en este navegador y no sale de él: la demo no hace peticiones de red, no usa cookies y no lleva analítica. «Reiniciar demo», en la pantalla de perfil, lo borra todo.',
      ),
      almacenamiento,
    ),
  };
}

async function pintaEspacio(parrafo) {
  const datos = await espacio().catch(() => null);
  if (!datos) {
    parrafo.textContent = 'Este navegador no informa del espacio usado.';
    return;
  }
  const persistencia = datos.persistente
    ? 'El navegador ha aceptado conservar estos datos aunque falte espacio.'
    : 'El navegador podría borrar estos datos si se queda sin espacio.';
  parrafo.textContent = `Espacio usado: ${tamano(datos.usado)} de ${tamano(datos.cuota)} disponibles. ${persistencia}`;
}
