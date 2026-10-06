// Configuracion de la demo. Todo lo que dependeria de la eleccion o del pais
// (ambito, textos, y mas adelante los campos del acta y los plazos) vive aqui.

const votos = (n) => `${n} ${n === 1 ? 'voto' : 'votos'}`;

export const CONFIG = {
  producto: 'ACTAMOON',

  eleccion: {
    tipo: 'Elecciones municipales',
    ambito: 'Municipio de Ejemplo',
  },

  candidaturas: [
    { id: 'A', nombre: 'Candidatura A' },
    { id: 'B', nombre: 'Candidatura B' },
    { id: 'C', nombre: 'Candidatura C' },
  ],

  // El acta: que cifras se piden, limites y todos sus textos. Las reglas
  // aritmeticas estan en validaciones.js.
  acta: {
    campos: [
      { id: 'electores', etiqueta: 'Electores censados' },
      { id: 'votantes', etiqueta: 'Votantes' },
      { id: 'nulos', etiqueta: 'Votos nulos' },
      { id: 'blancos', etiqueta: 'Votos en blanco' },
    ],
    motivoMinimo: 10,
    fotoLadoMaximo: 1600,

    textos: {
      avisoFotos: 'No fotografíes actas reales con esta demo. Las fotos quedan en este dispositivo.',

      tituloFoto: 'Foto del acta',
      hacerFoto: 'Hacer foto',
      repetirFoto: 'Repetir foto',
      procesando: 'Procesando la foto.',
      fotoIlegible: 'No se ha podido leer ese archivo como imagen. Prueba con otra foto.',
      fotoAlt: (mesa) => `Foto del acta de la ${mesa}`,
      cargandoFoto: 'Cargando la foto.',
      fotoPerdida: 'La foto no está en este dispositivo.',

      huella: 'Huella SHA-256 del archivo original',
      copiarHuella: 'Copiar huella',
      huellaCopiada: 'Huella copiada.',
      huellaNoCopiada: 'No se ha podido copiar. Selecciona la huella a mano.',
      hora: 'Hora de captura',
      horaNota: 'Hora del dispositivo, no verificada.',
      tamano: 'Tamaño del archivo',

      tituloCifras: 'Cifras del acta',
      tituloCandidaturas: 'Votos por candidatura',
      cifraInvalida: 'Escribe un número entero, sin puntos ni decimales.',
      cifraFalta: 'Falta esta cifra.',

      incompleta: 'Rellena todas las cifras para comprobar las sumas.',
      cuadra: 'Las cifras cuadran.',
      noCuadra: 'Las cifras no cuadran.',
      masVotantes: (n) => `Hay ${n} ${n === 1 ? 'votante' : 'votantes'} más que electores.`,
      sobran: (n) => `Nulos, blancos y candidaturas suman ${votos(n)} más que los votantes.`,
      faltan: (n) => `Nulos, blancos y candidaturas suman ${votos(n)} menos que los votantes.`,

      descuadreTitulo: 'Enviar con descuadre',
      descuadreTexto:
        'Si el acta en papel dice exactamente esto, puedes enviarla así. Quedará marcada para quien la valide y en el consolidado.',
      confirmaPapel: 'El acta en papel dice esto',
      motivo: 'Motivo',
      motivoAyuda: (minimo) => `Explica qué ves en el acta. Mínimo ${minimo} caracteres.`,

      enviar: 'Enviar acta',
      enviada: 'Acta enviada. Queda pendiente de validar.',
      falta: {
        foto: 'Falta la foto del acta.',
        cifras: 'Faltan cifras o alguna no es un número entero.',
        confirmacion: 'Marca «El acta en papel dice esto» para enviar un acta que no cuadra.',
        motivo: 'Escribe el motivo del descuadre.',
      },

      enviadaConDescuadre: 'Enviada con descuadre',
      enviadaPor: (quien, cuando) => `Enviada por ${quien} el ${cuando}.`,
    },
  },

  roles: {
    administrador: { singular: 'Administrador', plural: 'Administrador' },
    apoderado: { singular: 'Apoderado', plural: 'Apoderados' },
    interventor: { singular: 'Interventor', plural: 'Interventores' },
  },

  textos: {
    perfilesSimulados:
      'Perfiles simulados. En esta demo cualquiera puede cambiar de perfil: no es seguridad real.',
    reiniciarTitulo: '¿Reiniciar la demo?',
    reiniciarTexto:
      'Se borrará todo lo guardado en este navegador: perfiles, colegios, mesas y cualquier dato que hayas introducido. No se puede deshacer.',
    sinEspacio:
      'No queda espacio en este dispositivo para guardar más datos. Libera espacio o reinicia la demo.',
    errorGuardado: 'No se han podido guardar los datos en este navegador.',
    contacto: 'Contacto:',
  },

  // Lo que la demo NO demuestra. Pertenece al producto con backend.
  noDemuestra: [
    {
      titulo: 'Seguridad real',
      texto:
        'Los perfiles son simulados: no hay cuentas ni contraseñas y cualquiera puede cambiar de perfil. Lo que ve cada uno se filtra en la interfaz, no en un servidor.',
    },
    {
      titulo: 'Hora de servidor',
      texto:
        'Las horas son las del reloj de este dispositivo, que se puede cambiar. Una hora fiable la tiene que poner un servidor.',
    },
    {
      titulo: 'Sincronización entre dispositivos',
      texto:
        'Los datos se quedan en este navegador. Lo que se introduce aquí no llega a ningún otro dispositivo.',
    },
  ],
};

// Contacto comercial. Es el unico sitio donde se escribe: la portada y el pie
// de la app lo leen de aqui. Vacio, el contacto no se muestra. Admite un correo
// (se abre con mailto) o un telefono con prefijo internacional (WhatsApp).
export const CONTACTO = 'comercial@whitemoon.es';

// Asunto con el que se abre el correo.
export const CONTACTO_ASUNTO = 'ACTAMOON: consulta';

// Textos de portada.html. La portada no lleva ningun texto fuera de aqui.
export const PORTADA = {
  entrarDemo: 'Probar la demo',

  hero: {
    titulo: 'Control de actas para interventores y apoderados',
    frase:
      'Foto del acta, cifras comprobadas y una segunda persona que las confirma: un recuento paralelo interno, mesa a mesa.',
    nota: 'Lo que vas a probar es una demo de presentación con datos ficticios.',
    ctaDemo: 'Probar la demo',
    ctaContacto: 'Solicitar demo:',
    ilustracionAlt: 'Un acta en papel con sus cifras y, al lado, un móvil que la ha fotografiado.',
  },

  pasos: {
    titulo: 'Cómo funciona',
    items: [
      {
        titulo: 'Foto del acta',
        texto: 'El interventor fotografía con el móvil el acta de su mesa.',
      },
      {
        titulo: 'Cifras con validaciones aritméticas',
        texto:
          'Anota a mano electores, votantes, nulos, blancos y votos por candidatura. La aplicación comprueba las sumas; no lee la foto.',
      },
      {
        titulo: 'Doble confirmación',
        texto:
          'Un apoderado o el administrador coteja las cifras con la foto. Hasta entonces, la mesa no cuenta en el consolidado.',
      },
    ],
  },

  ofrece: {
    titulo: 'Qué ofrece',
    items: [
      {
        titulo: 'Validaciones aritméticas',
        texto:
          'Comprueba que los votantes no superan a los electores y que nulos, blancos y candidaturas suman los votantes. Si no cuadra, pide un motivo antes de enviar.',
      },
      {
        titulo: 'Huella de la foto',
        texto:
          'Calcula el SHA-256 de la foto en el propio dispositivo y lo muestra, para poder comprobar más tarde que el archivo es el mismo.',
      },
      {
        titulo: 'Hora de cada captura',
        texto: 'Anota la hora del dispositivo al fotografiar el acta y al registrar cada reclamación.',
      },
      {
        titulo: 'Registro de auditoría',
        texto: 'Cada acción queda apuntada con su perfil, su hora y su huella. El registro solo admite añadir entradas.',
      },
      {
        titulo: 'Consolidado por mesa',
        texto: 'Suma solo las mesas confirmadas y enseña cuáles faltan, siempre como dato interno, no oficial.',
      },
      {
        titulo: 'PDF por mesa',
        texto: 'Un documento por mesa con la foto, la huella, la hora, las cifras y las reclamaciones.',
      },
      {
        titulo: 'Funcionamiento sin conexión',
        texto: 'Los datos se guardan en el dispositivo y la aplicación se sigue abriendo sin cobertura.',
      },
    ],
  },

  noHace: {
    titulo: 'Qué no hace',
    entradilla: 'Conviene saberlo antes de probarla.',
    items: [
      {
        titulo: 'No es un sistema oficial',
        texto: 'Es una herramienta interna de quien la usa.',
      },
      {
        titulo: 'No publica resultados',
        texto: 'El consolidado es un dato interno y así va etiquetado.',
      },
      {
        titulo: 'No sustituye al acta en papel',
        texto: 'El documento que vale es el acta de la mesa. Aquí solo se guarda una copia de trabajo.',
      },
      {
        titulo: 'La demo no demuestra seguridad real, hora de servidor ni sincronización entre dispositivos',
        texto: 'Las tres cosas pertenecen al producto con servidor.',
      },
    ],
  },

  privacidad: {
    titulo: 'Privacidad',
    items: [
      'En la demo todo queda en el navegador: no se envía nada a ningún servidor.',
      'No se escanea la lista de votantes. Solo se trabaja con las cifras del acta.',
      'Sin cookies y sin analítica.',
    ],
  },

  pie: 'Demo de presentación con datos ficticios. No es un sistema oficial ni publica resultados.',
};
