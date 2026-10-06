// Que ve cada perfil. Modulo puro: no toca el DOM ni la base de datos.
// Es un filtro de interfaz para la demo, no un control de acceso.

const TODOS = ['administrador', 'apoderado', 'interventor'];

// roles: null = vista publica, no necesita perfil.
export const RUTAS = [
  // El arranque decide solo: bienvenida, selector o la pantalla del perfil.
  { id: 'inicio', patron: /^#?\/?$/, roles: null },
  { id: 'perfil', patron: /^#\/perfil$/, roles: null, nav: { href: '#/perfil', etiqueta: 'Perfil', icono: 'perfil' } },
  { id: 'mesas', patron: /^#\/mesas$/, roles: TODOS, nav: { href: '#/mesas', etiqueta: 'Mesas', icono: 'mesas' } },
  { id: 'mesa', patron: /^#\/mesa\/([\w-]+)$/, roles: TODOS, padre: 'mesas' },
  { id: 'acta', patron: /^#\/mesa\/([\w-]+)\/acta$/, roles: ['interventor'], padre: 'mesas' },
  { id: 'reclamacion', patron: /^#\/mesa\/([\w-]+)\/reclamacion$/, roles: ['interventor', 'apoderado'], padre: 'mesas' },
  {
    id: 'panel',
    patron: /^#\/panel$/,
    roles: ['administrador', 'apoderado'],
    nav: { href: '#/panel', etiqueta: 'Panel', icono: 'panel' },
  },
  { id: 'actividad', patron: /^#\/panel\/actividad$/, roles: ['administrador', 'apoderado'], padre: 'panel' },
  {
    id: 'organizacion',
    patron: /^#\/organizacion$/,
    roles: ['administrador'],
    nav: { href: '#/organizacion', etiqueta: 'Equipo', icono: 'organizacion' },
  },
  { id: 'gestion-colegio', patron: /^#\/organizacion\/colegio\/([\w-]+)$/, roles: ['administrador'], padre: 'organizacion' },
  { id: 'gestion-mesa', patron: /^#\/organizacion\/mesa\/([\w-]+)$/, roles: ['administrador'], padre: 'organizacion' },
  {
    id: 'auditoria',
    patron: /^#\/auditoria$/,
    roles: ['administrador'],
    nav: { href: '#/auditoria', etiqueta: 'Auditoría', icono: 'registro' },
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

// La barra inferior del movil admite 5 destinos. Si hay mas, sale "Perfil":
// el boton de perfil de la cabecera lleva al mismo sitio.
const MAXIMO_NAV = 5;

export function navegacion(perfil) {
  const destinos = RUTAS.filter((ruta) => ruta.nav && puedeVer(perfil, ruta)).map((ruta) => ({ id: ruta.id, ...ruta.nav }));
  return destinos.length > MAXIMO_NAV ? destinos.filter((destino) => destino.id !== 'perfil') : destinos;
}

export function mesasVisibles(perfil, mesas) {
  if (!perfil) return [];
  if (perfil.rol === 'administrador') return mesas;
  if (perfil.rol === 'apoderado') return mesas.filter((mesa) => perfil.colegioIds.includes(mesa.colegioId));
  return mesas.filter((mesa) => perfil.mesaIds.includes(mesa.id));
}

// Solo el interventor de la mesa captura su acta.
// Una mesa desactivada esta cerrada a cambios: no admite capturas ni reenvios.
export function puedeCapturar(perfil, mesa) {
  return mesa.activo !== false && perfil?.rol === 'interventor' && perfil.mesaIds.includes(mesa.id);
}

// Valida o devuelve el apoderado del colegio o el administrador; nunca quien
// envio el acta, y solo mientras esta enviada.
export function puedeValidar(perfil, mesa, acta) {
  if (!perfil || acta?.estado !== 'enviada' || perfil.id === acta.enviadaPor) return false;
  if (perfil.rol === 'administrador') return true;
  return perfil.rol === 'apoderado' && perfil.colegioIds.includes(mesa.colegioId);
}

// Reclaman el interventor de la mesa y el apoderado de su colegio.
export function puedeReclamar(perfil, mesa) {
  if (mesa.activo === false) return false; // cerrada a cambios
  if (perfil?.rol === 'interventor') return perfil.mesaIds.includes(mesa.id);
  return perfil?.rol === 'apoderado' && perfil.colegioIds.includes(mesa.colegioId);
}

// Donde aterriza cada perfil al elegirlo.
export function rutaInicial(perfil) {
  if (perfil.rol === 'administrador') return '#/panel';
  if (perfil.rol === 'interventor' && perfil.mesaIds.length === 1) return `#/mesa/${perfil.mesaIds[0]}`;
  return '#/mesas';
}

// El perfil guardado como activo, si sigue existiendo y en uso.
export function perfilVigente(perfiles, id) {
  const perfil = perfiles.find((p) => p.id === id);
  return perfil && perfil.activo !== false ? perfil : null;
}

// Que se ve al abrir la app: la bienvenida si no hay datos, el selector si no
// hay perfil vigente, o directamente la pantalla de inicio del perfil.
export function arranque(perfiles, perfil) {
  if (perfiles.length === 0) return { vista: 'bienvenida' };
  if (!perfil || perfil.activo === false) return { vista: 'selector' };
  return { ir: rutaInicial(perfil) };
}
