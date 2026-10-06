// Huella SHA-256 calculada en el propio dispositivo con Web Crypto.

// datos: ArrayBuffer o TypedArray. Devuelve 64 caracteres hexadecimales.
export async function sha256Hex(datos) {
  const resumen = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(resumen), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
