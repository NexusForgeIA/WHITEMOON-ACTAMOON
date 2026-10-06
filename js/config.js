// Configuracion de la demo. Todo lo que dependeria de la eleccion o del pais
// (ambito, textos, y mas adelante los campos del acta y los plazos) vive aqui.

export const CONFIG = {
  producto: 'ACTAMOON',

  eleccion: {
    tipo: 'Elecciones municipales',
    ambito: 'Municipio de Ejemplo',
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
