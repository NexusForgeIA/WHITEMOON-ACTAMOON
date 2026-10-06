// Prepara la foto del acta: huella del archivo original y copia reducida.

import { sha256Hex } from './hash.js';

export class ErrorFoto extends Error {}

// Tamano de la copia reducida: el lado mayor no pasa de `maximo` y no se amplia.
export function dimensionesReducidas(ancho, alto, maximo) {
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

// Devuelve el archivo original intacto, su SHA-256, la hora del dispositivo y
// una copia JPEG ya enderezada para pantalla y PDF. La huella es siempre la
// del original, nunca la de la copia.
export async function preparaFoto(archivo, ladoMaximo) {
  if (!archivo.type.startsWith('image/')) throw new ErrorFoto('tipo');
  const capturadaEn = new Date().toISOString();
  const sha256 = await sha256Hex(await archivo.arrayBuffer());

  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new ErrorFoto('ilegible');
  }

  const { ancho, alto } = dimensionesReducidas(imagen.width, imagen.height, ladoMaximo);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.getContext('2d').drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();
  const vista = await new Promise((resolve) => lienzo.toBlob(resolve, 'image/jpeg', 0.85));
  if (!vista) throw new ErrorFoto('ilegible');

  return { original: archivo, vista, sha256, capturadaEn, tipo: archivo.type, bytes: archivo.size, ancho, alto };
}
