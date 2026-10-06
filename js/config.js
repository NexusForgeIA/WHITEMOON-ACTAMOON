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
      { id: 'electores', etiqueta: 'Electores censados', corto: 'Elect.' },
      { id: 'votantes', etiqueta: 'Votantes', corto: 'Vot.' },
      { id: 'nulos', etiqueta: 'Votos nulos', corto: 'Nulos' },
      { id: 'blancos', etiqueta: 'Votos en blanco', corto: 'Blancos' },
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

      tituloCaptura: (mesa) => `Acta de la ${mesa}`,
      tituloCorreccion: (mesa) => `Corregir el acta de la ${mesa}`,
      yaEnviada: {
        enviada: 'El acta está enviada y pendiente de validar.',
        validada: 'El acta ya está validada.',
      },
      version: (n) => `Versión ${n} del acta`,

      enviar: 'Enviar acta',
      reenviar: 'Reenviar acta',
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

  // Doble confirmacion: valida un apoderado o el administrador, nunca quien envio.
  validacion: {
    motivoMinimo: 10,
    textos: {
      titulo: 'Validación',
      instruccion: 'Coteja las cifras con la foto antes de validar. Hasta entonces, esta mesa no cuenta en el consolidado.',
      validar: 'Validar acta',
      devolver: 'Devolver al interventor',
      motivoDevolucion: 'Motivo de la devolución',
      motivoAyuda: (minimo) => `Di qué hay que corregir. Mínimo ${minimo} caracteres.`,
      confirmarDevolucion: 'Confirmar devolución',
      cancelar: 'Cancelar',
      faltaMotivo: 'Escribe el motivo de la devolución.',
      validada: 'Acta validada.',
      devuelta: 'Acta devuelta al interventor.',
      validadaPor: (quien, cuando) => `Validada por ${quien} el ${cuando}.`,
      devueltaTitulo: 'Acta devuelta',
      devueltaPor: (quien, cuando) => `Devuelta por ${quien} el ${cuando}.`,
      corregir: 'Corregir y reenviar',
      pendientes: (n) => (n === 1 ? 'Hay 1 acta pendiente de validar.' : `Hay ${n} actas pendientes de validar.`),
    },
  },

  // Panel consolidado. El total cuenta solo actas validadas.
  panel: {
    estados: {
      'sin-acta': 'Sin acta',
      enviada: 'Pendiente de validar',
      validada: 'Validada',
      devuelta: 'Devuelta',
    },
    textos: {
      titulo: 'Panel consolidado',
      noOficial: 'Dato interno, no oficial.',
      noOficialTexto: 'Es el recuento paralelo de quien usa la aplicación y solo suma las actas que ha validado otro perfil.',
      estados: 'Actas por estado',
      conDescuadre: 'Con descuadre',
      descuadreCorto: 'descuadre',
      pendienteCorto: 'Pendiente',
      totalMesas: 'Mesas',
      deMesas: (n) => (n === 1 ? 'Sobre 1 mesa.' : `Sobre ${n} mesas.`),
      totales: 'Totales',
      totalesNota: 'Solo actas validadas.',
      provisional: 'Enviadas sin validar',
      etiquetaProvisional: 'Provisional',
      provisionalNota: 'Suma provisional de las actas enviadas que nadie ha validado todavía. No entra en los totales.',
      tituloTabla: 'Suma por concepto',
      mesasSumadas: 'Mesas sumadas',
      desglose: 'Desglose por colegio y mesa',
      mesa: 'Mesa',
      estado: 'Estado',
      subtotal: 'Subtotal validadas',
      descargar: 'Descargar PDF del panel',
    },
  },

  // Gestion de colegios, mesas y equipo (solo administrador). Las reglas
  // estan en gestion.js.
  gestion: {
    campos: { nombre: 'Nombre', colegio: 'Colegio', apoderado: 'Apoderado', interventor: 'Interventor', estado: 'Estado', mesa: 'Mesa', rol: 'Rol' },
    // Texto de la entrada de auditoria: que objeto y que cambio, con el valor
    // anterior y el nuevo.
    detalle: ({ objeto, cambio }) => {
      const campos = { nombre: 'Nombre', colegio: 'Colegio', apoderado: 'Apoderado', interventor: 'Interventor', estado: 'Estado', mesa: 'Mesa', rol: 'Rol' };
      const valor = (v) => (v === null ? 'ninguno' : `«${v}»`);
      const frases = cambio.map((c) => `${campos[c.campo] ?? c.campo}: ${c.antes === null ? valor(c.despues) : `de ${valor(c.antes)} a ${valor(c.despues)}`}.`);
      return `${objeto.nombre}. ${frases.join(' ')}`;
    },
    errores: {
      'nombre-vacio': 'Escribe un nombre.',
      'nombre-largo': 'El nombre no puede pasar de 40 caracteres.',
      'nombre-repetido': 'Ya hay otro con ese nombre.',
      'mesa-con-registros': 'Esta mesa tiene actas o reclamaciones: no se puede borrar ni cambiar de colegio. Se puede desactivar.',
      'colegio-con-mesas': 'Este colegio tiene mesas: no se puede borrar. Se puede desactivar.',
      'colegio-desactivado': 'El colegio está desactivado. Reactívalo antes.',
      'perfil-desactivado': 'Ese perfil está desactivado y no se puede asignar.',
      administrador: 'El administrador no se puede desactivar.',
      'rol-equivocado': 'Ese perfil no tiene el rol que hace falta.',
      'no-existe': 'Ya no existe.',
      'perfil-no-se-borra': 'Los perfiles no se borran: lo que hicieron tiene que seguir a su nombre.',
    },
    textos: {
      titulo: 'Equipo',
      entradilla: 'colegios, mesas y quién cubre cada una',
      avisoFicticios: 'Usa nombres ficticios. No escribas colegios, lugares ni personas reales.',
      colegiosYMesas: 'Colegios y mesas',
      nuevoColegio: 'Nuevo colegio',
      nuevaMesa: 'Nueva mesa',
      editarColegio: (nombre) => `Editar ${nombre}`,
      editarMesa: (nombre) => `Editar ${nombre}`,
      mesasDe: (nombre) => `Mesas de ${nombre}`,
      mesa: 'Mesa',
      estado: 'Estado',
      colegio: 'Colegio',
      apoderado: 'Apoderado',
      interventor: 'Interventor',
      interventorAyuda: 'Un interventor lleva una sola mesa: si ya tenía otra, la deja.',
      sinAsignar: 'Sin asignar',
      nombre: 'Nombre',
      nombreAyuda: (maximo) => `Hasta ${maximo} caracteres. Ficticio.`,
      colegioFijo: 'Esta mesa tiene actas o reclamaciones y no puede cambiar de colegio.',
      guardar: 'Guardar',
      guardado: 'Cambios guardados.',
      sinCambios: 'No había nada que cambiar.',
      perfiles: 'Perfiles',
      perfilesNota: 'Los perfiles se numeran solos y no llevan nombre de persona. No se borran: lo que hicieron sigue a su nombre.',
      nuevoInterventor: 'Nuevo interventor',
      nuevoApoderado: 'Nuevo apoderado',
      perfilCreado: (etiqueta) => `${etiqueta} creado. Asígnalo desde un colegio o una mesa.`,
      enUso: 'En uso',
      fueraDeUso: 'Desactivado',
      cerrada: 'Cerrada a cambios',
      cerradaNota: 'Mesa cerrada a cambios: no admite capturas, reenvíos ni reclamaciones nuevas. Lo ya registrado sigue contando.',
      estadoTitulo: 'Desactivar o borrar',
      desactivar: 'Desactivar',
      reactivar: 'Reactivar',
      desactivarNota: {
        colegio: 'Desactivar un colegio cierra también sus mesas. Lo ya registrado sigue contando en totales y KPI.',
        mesa: 'Una mesa desactivada queda cerrada a cambios: no admite capturas, reenvíos ni reclamaciones nuevas. Un acta pendiente todavía se puede validar o devolver, y lo ya registrado sigue contando.',
      },
      reactivarNota: {
        colegio: 'Reactivar el colegio no reabre sus mesas: cada una se reactiva aparte.',
        mesa: 'Al reactivarla, la mesa vuelve a admitir capturas y reclamaciones.',
      },
      desactivado: 'Desactivado. Lo ya registrado sigue contando.',
      reactivado: 'Reactivado.',
      borrar: 'Borrar',
      borrarTitulo: (nombre) => `¿Borrar ${nombre}?`,
      borrarTexto: 'No tiene nada registrado, así que se puede borrar. El borrado queda apuntado en la auditoría. No se puede deshacer.',
      borrarAceptar: 'Sí, borrar',
      borrado: 'Borrado.',
      mesaNoSeBorra: 'Tiene actas o reclamaciones: no se puede borrar, solo desactivar.',
      colegioNoSeBorra: 'Tiene mesas: no se puede borrar, solo desactivar.',
      noExiste: 'No existe',
      noExisteTexto: 'Ese colegio o esa mesa ya no existe.',
      sinColegios: 'No hay colegios en uso',
      sinColegiosTexto: 'Una mesa necesita un colegio en uso.',
      perfilDesactivado: 'Perfil desactivado',
    },
  },

  // KPI de actividad. Salen de lo ya registrado; las formulas estan en kpi.js.
  kpi: {
    textos: {
      titulo: 'Actividad',
      enlace: 'Ver la actividad',
      aviso: 'Indicadores calculados con lo registrado en este dispositivo. Cada cifra lleva su base: con pocas actas, una proporción dice poco.',
      sinDatos: 'Sin datos',
      de: (n, total) => `${n} de ${total}`,
      indicador: 'Indicador',
      valor: 'Valor',
      proporcion: 'Proporción',
      mesas: 'Mesas',

      cobertura: 'Cobertura',
      coberturaEnvio: 'Mesas con acta enviada o validada',
      coberturaValidada: 'Mesas con acta validada',

      estados: 'Actas por estado',
      evolucion: 'Evolución',
      evolucionNota: (minutos) => `Estado de las mesas al final de cada tramo de ${minutos} min, según la hora del dispositivo.`,
      tramo: 'Tramo desde',

      calidad: 'Calidad',
      descuadre: 'Actas con descuadre',
      devueltasAhora: 'Actas devueltas ahora',
      tasaDevolucion: 'Envíos que acabaron devueltos',
      versionesPorActa: 'Versiones por acta',
      versionesBase: (versiones, actas) => `${versiones} versiones de ${actas} actas`,

      tiempos: 'Tiempos',
      orientativo: 'Orientativo.',
      orientativoTexto: 'Los tiempos salen de la hora del dispositivo, que no está verificada.',
      tramoTiempo: 'Tramo',
      casos: 'Casos',
      mediana: 'Mediana',
      maximo: 'Máximo',
      capturaEnvio: 'De la foto al envío',
      envioValidacion: 'Del envío a la validación',
      envioDevolucion: 'Del envío a la devolución',
      cicloCompleto: 'Del primer envío a la validación final',
      excluidas: (n) => (n === 1 ? 'Se ha dejado fuera 1 duración negativa: el reloj del dispositivo cambió.' : `Se han dejado fuera ${n} duraciones negativas: el reloj del dispositivo cambió.`),

      pendientes: 'Pendientes de validar, por antigüedad',
      sinPendientes: 'No hay actas pendientes de validar.',
      esperando: 'Esperando',

      reclamaciones: 'Reclamaciones',
      reclamacionesTotal: (n) => (n === 1 ? '1 reclamación registrada.' : `${n} reclamaciones registradas.`),
      colegioMesa: 'Colegio y mesa',

      acciones: 'Acciones registradas',
      accionesNota: 'Solo cuenta lo que entra en la auditoría: carga de datos, envíos, validaciones, devoluciones y reclamaciones.',
      accionesPorTipo: 'Acciones por tipo',
      accionesPorPerfil: 'Acciones por perfil',
      accionesColumna: 'Acciones',
      tipo: 'Tipo',
      perfil: 'Perfil',
    },
  },

  // Documentos PDF. La nota va al pie de todas las paginas.
  pdf: {
    textos: {
      nota: 'Hora del dispositivo, no verificada; demo con datos ficticios.',
      cabecera: 'DEMO · DATO INTERNO, NO OFICIAL',
      tituloMesa: (mesa) => `Acta de la ${mesa}`,
      tituloPanel: 'Panel consolidado',
      archivoMesa: (mesa, version) => `actamoon-${mesa}-v${version}.pdf`,
      archivoPanel: 'actamoon-panel.pdf',
      descargarMesa: 'Descargar PDF de la mesa',
      eleccion: 'Elección',
      ambito: 'Ámbito',
      colegio: 'Colegio',
      mesa: 'Mesa',
      mesasColumna: 'Mesas',
      mesasSumadas: 'Mesas sumadas',
      interventor: 'Interventor',
      apoderado: 'Apoderado',
      nadie: 'Sin asignar',
      estado: 'Estado',
      version: 'Versión del acta',
      enviada: 'Enviada',
      validada: 'Validada',
      devuelta: 'Devuelta',
      motivoDevolucion: 'Motivo de la devolución',
      porEl: (quien, cuando) => `${quien}, ${cuando}`,
      generado: 'Documento generado',
      cifras: 'Cifras del acta',
      concepto: 'Concepto',
      valor: 'Valor',
      conDescuadre: 'Acta enviada con descuadre.',
      motivoDescuadre: 'Motivo del descuadre',
      foto: 'Foto del acta',
      sinFoto: 'La foto no está en este dispositivo.',
      huella: 'Huella SHA-256 del archivo original',
      capturada: 'Hora de captura',
      notaFoto: (lado) => `La imagen es una copia reducida a ${lado} px de lado. La huella es la del archivo original, no la de esta copia.`,
      reclamaciones: 'Reclamaciones',
      sinReclamaciones: 'No hay reclamaciones registradas en esta mesa.',
      huellaReclamacion: 'Huella SHA-256 de la foto adjunta',
      reclamacionSinFoto: 'Sin foto adjunta.',
      generando: 'PDF generado.',
    },
  },

  // Uso sin conexion (Service Worker).
  offline: {
    textos: {
      sinConexion: 'Sin conexión. La demo sigue funcionando con lo guardado en este dispositivo.',
      versionNueva: 'Hay una versión nueva.',
      actualizar: 'Actualizar',
    },
  },

  reclamaciones: {
    textoMinimo: 10,
    textos: {
      titulo: 'Reclamaciones',
      ninguna: 'No hay reclamaciones registradas en esta mesa.',
      nueva: 'Registrar reclamación',
      tituloNueva: (mesa) => `Reclamación en la ${mesa}`,
      texto: 'Qué ha pasado',
      textoAyuda: (minimo) => `Descríbelo con tus palabras. Mínimo ${minimo} caracteres.`,
      foto: 'Foto (opcional)',
      anadirFoto: 'Añadir foto',
      fotoAlt: (mesa) => `Foto adjunta a una reclamación de la ${mesa}`,
      huellaFoto: 'Huella SHA-256 de la foto',
      horaNota: 'Se registra con la hora del dispositivo en el momento de guardarla. Después no se puede editar ni borrar.',
      guardar: 'Registrar reclamación',
      faltaTexto: 'Escribe la reclamación.',
      registrada: 'Reclamación registrada.',
      autor: (quien, cuando) => `${quien} · ${cuando}`,
    },
  },

  // Registro de auditoria: que acciones se apuntan y como se describen.
  auditoria: {
    acciones: {
      'datos-cargados': 'Datos de ejemplo cargados',
      'acta-enviada': 'Acta enviada',
      'acta-validada': 'Acta validada',
      'acta-devuelta': 'Acta devuelta',
      'reclamacion-registrada': 'Reclamación registrada',
      'colegio-creado': 'Colegio creado',
      'colegio-editado': 'Colegio editado',
      'colegio-desactivado': 'Colegio desactivado',
      'colegio-reactivado': 'Colegio reactivado',
      'colegio-borrado': 'Colegio borrado',
      'mesa-creada': 'Mesa creada',
      'mesa-editada': 'Mesa editada',
      'mesa-desactivada': 'Mesa desactivada',
      'mesa-reactivada': 'Mesa reactivada',
      'mesa-borrada': 'Mesa borrada',
      'perfil-creado': 'Perfil creado',
      'perfil-desactivado': 'Perfil desactivado',
      'perfil-reactivado': 'Perfil reactivado',
      'asignacion-cambiada': 'Asignación cambiada',
    },
    detalle: {
      datosCargados: (colegios, mesas, perfiles) => `${colegios} colegios, ${mesas} mesas y ${perfiles} perfiles.`,
      actaEnviada: (acta) => `Versión ${acta.version}${acta.descuadre ? ', con descuadre' : ''}. Foto ${acta.fotoSha256}`,
      actaValidada: (acta) => `Versión ${acta.version}.`,
      actaDevuelta: (acta) => `Versión ${acta.version}. Motivo: ${acta.devolucion.motivo}`,
      reclamacion: (reclamacion) => (reclamacion.fotoSha256 ? `Con foto ${reclamacion.fotoSha256}` : 'Sin foto.'),
    },
    textos: {
      titulo: 'Auditoría',
      entradilla: 'Registro de acciones. Solo se añade: la aplicación no edita ni borra entradas.',
      avisoTitulo: 'Muestra el mecanismo, no es una garantía',
      aviso:
        'Cada entrada lleva la huella de la anterior, así que cambiar una rompe la cadena. Pero la cadena entera está guardada en este navegador: quien tenga acceso a él puede reescribirla de principio a fin y volver a encadenarla. Eso solo lo impide un servidor que guarde las huellas fuera del dispositivo.',
      verificar: 'Verificar cadena',
      integra: (n) => `La cadena encaja: ${n === 1 ? '1 entrada enlazada' : `${n} entradas enlazadas`} correctamente.`,
      integraNota: 'Que encaje significa que es coherente consigo misma, no que nadie la haya reescrito.',
      rota: (seq) => `La cadena se rompe en la entrada ${seq}.`,
      rotaNota: {
        secuencia: 'Falta o sobra una entrada antes de esta.',
        enlace: 'Esta entrada no apunta a la huella de la anterior.',
        contenido: 'El contenido de esta entrada no coincide con su huella.',
      },
      vacia: 'Todavía no hay acciones registradas.',
      sinPerfil: 'Sin perfil',
      entrada: (seq) => `Entrada ${seq}`,
      huella: 'Huella de la entrada',
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
      'Se borrará todo lo guardado en este navegador: perfiles, colegios, mesas, actas, fotos, reclamaciones y el registro de auditoría. No se puede deshacer.',
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
    {
      titulo: 'Un registro que no se pueda alterar',
      texto:
        'El registro de auditoría encadena cada entrada con la huella de la anterior. Aquí eso enseña el mecanismo, pero no demuestra que el registro sea inalterable: en el navegador alguien podría reescribirlo entero y volver a encadenarlo. Eso solo lo impide un servidor.',
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
