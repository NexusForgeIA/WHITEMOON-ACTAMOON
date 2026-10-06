// Envoltorio minimo de IndexedDB. Todos los datos de la demo viven aqui, en
// este navegador.

const NOMBRE = 'actamoon';
const VERSION = 2;

// Para anadir un almacen: se declara aqui y se sube VERSION. La actualizacion
// solo crea lo que falta, asi que no borra datos existentes.
const ALMACENES = {
  meta: { keyPath: 'clave' },
  colegios: { keyPath: 'id' },
  mesas: { keyPath: 'id' },
  perfiles: { keyPath: 'id' },
  actas: { keyPath: 'id' },
  fotos: { keyPath: 'id' },
};

export class ErrorAlmacenamiento extends Error {
  constructor(causa) {
    super(causa?.message ?? 'Error de almacenamiento');
    this.name = 'ErrorAlmacenamiento';
    this.sinEspacio = causa?.name === 'QuotaExceededError';
  }
}

let conexion;

function abrir() {
  conexion ??= new Promise((resolve, reject) => {
    const peticion = indexedDB.open(NOMBRE, VERSION);
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      for (const [nombre, opciones] of Object.entries(ALMACENES)) {
        if (!db.objectStoreNames.contains(nombre)) db.createObjectStore(nombre, opciones);
      }
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => {
      conexion = undefined;
      reject(new ErrorAlmacenamiento(peticion.error));
    };
  });
  return conexion;
}

// Ejecuta fn dentro de una transaccion y resuelve cuando se ha confirmado.
// Si fn devuelve una peticion, resuelve con su resultado.
async function transaccion(almacenes, modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(almacenes, modo);
    tx.onerror = tx.onabort = () => reject(new ErrorAlmacenamiento(tx.error));
    try {
      const peticion = fn(tx);
      tx.oncomplete = () => resolve(peticion?.result);
    } catch (error) {
      // Un put puede fallar al momento (por ejemplo, sin espacio): nada se guarda.
      reject(new ErrorAlmacenamiento(error));
      tx.abort();
    }
  });
}

export function todos(almacen) {
  return transaccion(almacen, 'readonly', (tx) => tx.objectStore(almacen).getAll());
}

export function leer(almacen, clave) {
  return transaccion(almacen, 'readonly', (tx) => tx.objectStore(almacen).get(clave));
}

// lotes: { almacen: [valores] }. Todo o nada.
export function guardar(lotes) {
  return transaccion(Object.keys(lotes), 'readwrite', (tx) => {
    for (const [almacen, valores] of Object.entries(lotes)) {
      const store = tx.objectStore(almacen);
      for (const valor of valores) store.put(valor);
    }
  });
}

export function vaciarTodo() {
  const nombres = Object.keys(ALMACENES);
  return transaccion(nombres, 'readwrite', (tx) => {
    for (const nombre of nombres) tx.objectStore(nombre).clear();
  });
}

// Pide al navegador que no desaloje los datos si falta espacio. Puede decir que no.
export async function pidePersistencia() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function espacio() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  const persistente = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usado: usage, cuota: quota, persistente };
}
