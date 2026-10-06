// Que ve cada perfil. Modulo puro: no toca el DOM ni la base de datos.
// Es un filtro de interfaz para la demo, no un control de acceso.

const TODOS = ['administrador', 'apoderado', 'interventor'];

// roles: null = vista publica, no necesita perfil.
export const RUTAS = [
  { id: 'inicio', patron: /^#?\/?$/, roles: null, nav: { href: '#/', etiqueta: 'Perfil', icono: 'perfil' } },
  { id: 'mesas', patron: /^#\/mesas$/, roles: TODOS, nav: { href: '#/mesas', etiqueta: 'Mesas', icono: 'mesas' } },
  { id: 'mesa', patron: /^#\/mesa\/([\w-]+)$/, roles: TODOS, padre: 'mesas' },
  {
    id: 'organizacion',
    patron: /^#\/organizacion$/,
    roles: ['administrador'],
    nav: { href: '#/organizacion', etiqueta: 'Organización', icono: 'organizacion' },
  },
  { id: 'ayuda', patron: /^#\/ayuda$/, roles: null, nav: { href: '#/ayuda', etiqueta: 'Ayuda', icono: 'ayuda' } },
];

export function resuelve(hash) {
  for (const ruta of RUTAS) {
    const m = ruta.patron.exec(hash);
    if (m) return { ruta, params: m.slice(1) };
  }
  return null;
}

export function puedeVer(perfil, ruta) {
  if (!ruta.roles) return true;
  return Boolean(perfil) && ruta.roles.includes(perfil.rol);
}

export function navegacion(perfil) {
  return RUTAS.filter((ruta) => ruta.nav && puedeVer(perfil, ruta)).map((ruta) => ({ id: ruta.id, ...ruta.nav }));
}

export function mesasVisibles(perfil, mesas) {
  if (!perfil) return [];
  if (perfil.rol === 'administrador') return mesas;
  if (perfil.rol === 'apoderado') return mesas.filter((mesa) => perfil.colegioIds.includes(mesa.colegioId));
  return mesas.filter((mesa) => perfil.mesaIds.includes(mesa.id));
}

// Donde aterriza cada perfil al elegirlo.
export function rutaInicial(perfil) {
  if (perfil.rol === 'interventor' && perfil.mesaIds.length === 1) return `#/mesa/${perfil.mesaIds[0]}`;
  return '#/mesas';
}
