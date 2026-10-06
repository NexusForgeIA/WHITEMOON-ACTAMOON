// Boton de camara con vista previa, huella y hora. Lo usan la captura del
// acta y las reclamaciones.

import { CONFIG } from '../config.js';
import { ErrorFoto, preparaFoto } from '../foto.js';
import { avisa, h, icono, urlTemporal } from '../ui.js';
import { formateaHora, tamano } from './comun.js';

const T = CONFIG.acta.textos;

export function datosDeFoto(sha256, capturadaEn, bytes) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(sha256);
      avisa(T.huellaCopiada);
    } catch {
      avisa(T.huellaNoCopiada, 'error');
    }
  };
  return h(
    'dl',
    { class: 'evidencia' },
    h(
      'div',
      null,
      h('dt', null, T.huella),
      h('dd', null, h('code', { class: 'huella' }, sha256)),
      h('dd', null, h('button', { type: 'button', class: 'boton boton--secundario boton--menor', onclick: copiar }, T.copiarHuella)),
    ),
    h('div', null, h('dt', null, T.hora), h('dd', null, formateaHora(capturadaEn)), h('dd', { class: 'evidencia__nota' }, T.horaNota)),
    bytes != null && h('div', null, h('dt', null, T.tamano), h('dd', null, tamano(bytes))),
  );
}

// La foto elegida se deja en destino.foto. `pinta` repinta la vista previa
// cuando destino.foto cambia desde fuera.
export function campoFoto({ id, alt, destino, alCambiar, hacer = T.hacerFoto, repetir = T.repetirFoto }) {
  const zona = h('div', { class: 'foto', 'aria-live': 'polite' });
  const error = h('p', { class: 'campo__error', role: 'alert', hidden: true });
  const etiqueta = h('label', { class: 'boton', for: id });
  const entrada = h('input', {
    type: 'file',
    id,
    class: 'oculto',
    accept: 'image/*',
    capture: 'environment',
    onchange: async () => {
      const [archivo] = entrada.files;
      entrada.value = '';
      if (!archivo) return;
      error.hidden = true;
      zona.replaceChildren(h('p', null, T.procesando));
      try {
        destino.foto = await preparaFoto(archivo, CONFIG.acta.fotoLadoMaximo);
      } catch (fallo) {
        if (!(fallo instanceof ErrorFoto)) throw fallo;
        error.textContent = T.fotoIlegible;
        error.hidden = false;
      }
      pinta();
      alCambiar();
    },
  });

  function pinta() {
    const { foto } = destino;
    etiqueta.replaceChildren(icono('camara'), foto ? repetir : hacer);
    zona.replaceChildren(
      ...(foto
        ? [
            h('img', { class: 'foto__imagen', src: urlTemporal(foto.vista), width: foto.ancho, height: foto.alto, alt }),
            datosDeFoto(foto.sha256, foto.capturadaEn, foto.bytes),
          ]
        : []),
    );
  }

  pinta();
  return { entrada, pinta, nodos: [entrada, etiqueta, error, zona] };
}
