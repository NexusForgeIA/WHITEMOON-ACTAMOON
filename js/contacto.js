// Convierte el valor de CONTACTO en el enlace del boton "Solicitar demo".
// Modulo puro. Devuelve null si no hay contacto o no se reconoce.

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?[\d\s().-]{9,}$/;

export function enlaceContacto(valor) {
  const contacto = (valor ?? '').trim();
  if (CORREO.test(contacto)) return 'mailto:' + contacto;
  if (TELEFONO.test(contacto)) return 'https://wa.me/' + contacto.replace(/\D/g, '');
  return null;
}
