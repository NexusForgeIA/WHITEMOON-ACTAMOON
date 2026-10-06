// Los dos documentos PDF de la demo: el de una mesa y el del panel. Modulo
// puro: recibe los datos ya leidos y devuelve un Pdf.

import { candidaturas } from './candidaturas.js';
import { CONFIG } from './config.js';
import { filasDeSuma } from './consolidado.js';
import { textoDeDuracion, textoDeMedia, textoDeRazon } from './kpi.js';
import { Pdf } from './pdf.js';
import { frasesDescuadre, validaActa } from './validaciones.js';

const T = CONFIG.pdf.textos;

const ESTADOS = CONFIG.panel.estados;
const etiquetaDe = (perfiles, id) => perfiles.find((perfil) => perfil.id === id)?.etiqueta ?? id ?? T.nadie;

// hora: funcion que formatea un instante ISO (la misma que usa la interfaz).
export function pdfDeMesa({ mesa, colegio, acta, reclamaciones, perfiles, fotoJpeg, hora, generadoEn }) {
  const pdf = new Pdf({ titulo: T.tituloMesa(mesa.nombre), cabecera: T.cabecera, pie: T.nota, fecha: new Date(generadoEn) });
  const quien = (id) => etiquetaDe(perfiles, id);
  const interventor = perfiles.find((perfil) => perfil.rol === 'interventor' && perfil.mesaIds.includes(mesa.id));
  const apoderado = perfiles.find((perfil) => perfil.rol === 'apoderado' && perfil.colegioIds.includes(colegio.id));

  pdf.titulo(T.tituloMesa(mesa.nombre));
  pdf.pares([
    [T.eleccion, `${CONFIG.eleccion.tipo} · ${CONFIG.eleccion.ambito}`],
    [T.colegio, colegio.nombre],
    [T.mesa, mesa.nombre],
    [T.interventor, interventor?.etiqueta ?? T.nadie],
    [T.apoderado, apoderado?.etiqueta ?? T.nadie],
    [T.estado, ESTADOS[acta.estado]],
    [T.version, String(acta.version)],
    [T.enviada, T.porEl(quien(acta.enviadaPor), hora(acta.enviadaEn))],
    ...(acta.estado === 'validada' ? [[T.validada, T.porEl(quien(acta.validadaPor), hora(acta.validadaEn))]] : []),
    ...(acta.estado === 'devuelta'
      ? [
          [T.devuelta, T.porEl(quien(acta.devolucion.por), hora(acta.devolucion.en))],
          [T.motivoDevolucion, acta.devolucion.motivo],
        ]
      : []),
    [T.generado, hora(generadoEn)],
  ]);

  pdf.subtitulo(T.cifras);
  pdf.tabla(
    [
      { titulo: T.concepto, ancho: 0.7 },
      { titulo: T.valor, ancho: 0.3, derecha: true },
    ],
    filasDeSuma(acta.cifras, CONFIG.acta.campos, candidaturas()).map(([etiqueta, valor]) => [etiqueta, valor]),
  );
  if (acta.descuadre) {
    pdf.texto(T.conDescuadre, { fuente: 'negrita' });
    for (const frase of frasesDescuadre(validaActa(acta.cifras, candidaturas()), CONFIG.acta.textos)) pdf.texto(frase);
    pdf.texto(`${T.motivoDescuadre}: ${acta.descuadre.motivo}`);
  } else {
    pdf.texto(CONFIG.acta.textos.cuadra);
  }

  pdf.subtitulo(T.foto);
  if (fotoJpeg) pdf.imagen(fotoJpeg);
  else pdf.texto(T.sinFoto);
  pdf.texto(T.huella, { cuerpo: 9, gris: 0.35 });
  pdf.texto(acta.fotoSha256, { fuente: 'mono', cuerpo: 9 });
  pdf.pares([[T.capturada, hora(acta.capturadaEn)]]);
  pdf.texto(T.notaFoto(CONFIG.acta.fotoLadoMaximo), { cuerpo: 9, gris: 0.35 });

  pdf.subtitulo(T.reclamaciones);
  if (reclamaciones.length === 0) pdf.texto(T.sinReclamaciones);
  reclamaciones.forEach((reclamacion, i) => {
    pdf.espacio(4);
    pdf.texto(`${i + 1}. ${quien(reclamacion.perfilId)} · ${hora(reclamacion.creadaEn)}`, { fuente: 'negrita' });
    pdf.texto(reclamacion.texto);
    if (reclamacion.fotoSha256) {
      pdf.texto(T.huellaReclamacion, { cuerpo: 9, gris: 0.35 });
      pdf.texto(reclamacion.fotoSha256, { fuente: 'mono', cuerpo: 9 });
    } else {
      pdf.texto(T.reclamacionSinFoto, { cuerpo: 9, gris: 0.35 });
    }
  });

  pdf.espacio(14);
  pdf.texto(T.nota, { fuente: 'negrita', cuerpo: 9 });
  return pdf;
}

function tablaDeSuma(pdf, suma) {
  pdf.tabla(
    [
      { titulo: T.concepto, ancho: 0.7 },
      { titulo: T.valor, ancho: 0.3, derecha: true },
    ],
    [[T.mesasSumadas, suma.mesas], ...filasDeSuma(suma, CONFIG.acta.campos, candidaturas()).map(([etiqueta, valor]) => [etiqueta, valor])],
  );
}

// Seccion de actividad del PDF del panel: las mismas cifras que la pantalla.
function actividadEnPdf(pdf, kpi, perfiles, hora) {
  const K = CONFIG.kpi.textos;
  const P = CONFIG.panel.textos;
  const fraccion = (cuenta) => (kpi.base.mesas === 0 ? 0 : cuenta / kpi.base.mesas);
  const dosColumnas = [
    { titulo: K.indicador, ancho: 0.6 },
    { titulo: K.valor, ancho: 0.4, derecha: true },
  ];

  pdf.subtitulo(K.titulo);
  pdf.texto(K.aviso, { cuerpo: 9, gris: 0.35 });

  pdf.subtitulo(K.cobertura);
  pdf.barras([
    { etiqueta: K.coberturaEnvio, texto: textoDeRazon(kpi.cobertura.envio, K), fraccion: kpi.cobertura.envio.valor, relleno: 'solido' },
    { etiqueta: K.coberturaValidada, texto: textoDeRazon(kpi.cobertura.validada, K), fraccion: kpi.cobertura.validada.valor, relleno: 'rayado' },
  ]);

  pdf.subtitulo(K.estados);
  pdf.barras([
    { etiqueta: ESTADOS.validada, texto: K.de(kpi.estados.validada, kpi.base.mesas), fraccion: fraccion(kpi.estados.validada), relleno: 'solido' },
    { etiqueta: ESTADOS.enviada, texto: K.de(kpi.estados.pendiente, kpi.base.mesas), fraccion: fraccion(kpi.estados.pendiente), relleno: 'rayado' },
    { etiqueta: ESTADOS.devuelta, texto: K.de(kpi.estados.devuelta, kpi.base.mesas), fraccion: fraccion(kpi.estados.devuelta), relleno: 'cruzado' },
    { etiqueta: ESTADOS['sin-acta'], texto: K.de(kpi.estados.sinActa, kpi.base.mesas), fraccion: fraccion(kpi.estados.sinActa), relleno: 'hueco' },
  ]);
  if (kpi.evolucion.columnas.length > 0) {
    pdf.texto(`${K.evolucion}. ${K.evolucionNota(kpi.evolucion.tramoMinutos)}`, { cuerpo: 9, gris: 0.35 });
    pdf.tabla(
      [
        { titulo: K.tramo, ancho: 0.4 },
        ...[ESTADOS.validada, P.pendienteCorto, ESTADOS.devuelta, ESTADOS['sin-acta']].map((titulo) => ({ titulo, ancho: 0.15, derecha: true })),
      ],
      kpi.evolucion.columnas.map((columna) => [hora(columna.desde), columna.validada, columna.pendiente, columna.devuelta, columna.sinActa]),
    );
  }

  pdf.subtitulo(K.calidad);
  const versiones = kpi.calidad.versionesPorActa;
  pdf.tabla(dosColumnas, [
    [K.descuadre, textoDeRazon(kpi.calidad.descuadre, K)],
    [K.devueltasAhora, textoDeRazon(kpi.calidad.devueltasAhora, K)],
    [K.tasaDevolucion, textoDeRazon(kpi.calidad.tasaDevolucion, K)],
    [K.versionesPorActa, versiones.valor === null ? K.sinDatos : `${textoDeMedia(versiones, K)} (${K.versionesBase(versiones.n, versiones.de)})`],
  ]);

  pdf.subtitulo(K.tiempos);
  pdf.texto(`${K.orientativo} ${K.orientativoTexto}`, { fuente: 'negrita', cuerpo: 9 });
  const tramos = [
    [K.capturaEnvio, kpi.tiempos.capturaEnvio],
    [K.envioValidacion, kpi.tiempos.envioValidacion],
    [K.envioDevolucion, kpi.tiempos.envioDevolucion],
    [K.cicloCompleto, kpi.tiempos.cicloCompleto],
  ];
  pdf.tabla(
    [
      { titulo: K.tramoTiempo, ancho: 0.46 },
      { titulo: K.casos, ancho: 0.14, derecha: true },
      { titulo: K.mediana, ancho: 0.2, derecha: true },
      { titulo: K.maximo, ancho: 0.2, derecha: true },
    ],
    tramos.map(([etiqueta, tramo]) => [etiqueta, tramo.n, textoDeDuracion(tramo.mediana, K), textoDeDuracion(tramo.maximo, K)]),
  );
  const excluidas = tramos.reduce((suma, [, tramo]) => suma + tramo.excluidas, 0);
  if (excluidas > 0) pdf.texto(K.excluidas(excluidas), { cuerpo: 9, gris: 0.35 });

  pdf.subtitulo(K.pendientes);
  if (kpi.pendientes.length === 0) pdf.texto(K.sinPendientes);
  else pdf.tabla([{ titulo: P.mesa, ancho: 0.6 }, { titulo: K.esperando, ancho: 0.4, derecha: true }], kpi.pendientes.map(({ mesa, antiguedad }) => [mesa.nombre, textoDeDuracion(Math.max(0, antiguedad), K)]));

  pdf.subtitulo(K.reclamaciones);
  pdf.texto(K.reclamacionesTotal(kpi.reclamaciones.total));
  pdf.tabla(
    [{ titulo: K.colegioMesa, ancho: 0.7 }, { titulo: K.reclamaciones, ancho: 0.3, derecha: true }],
    kpi.reclamaciones.porColegio.flatMap((grupo) => [[grupo.colegio.nombre, grupo.total], ...grupo.mesas.map(({ mesa, total }) => [`   ${mesa.nombre}`, total])]),
  );

  pdf.subtitulo(K.acciones);
  pdf.texto(K.accionesNota, { cuerpo: 9, gris: 0.35 });
  if (kpi.acciones.total === 0) {
    pdf.texto(K.sinDatos);
    return;
  }
  const columnasDeAcciones = (titulo) => [{ titulo, ancho: 0.7 }, { titulo: K.accionesColumna, ancho: 0.3, derecha: true }];
  pdf.tabla(columnasDeAcciones(K.tipo), kpi.acciones.porTipo.map(({ accion, total }) => [CONFIG.auditoria.acciones[accion] ?? accion, K.de(total, kpi.acciones.total)]));
  pdf.tabla(
    columnasDeAcciones(K.perfil),
    kpi.acciones.porPerfil.map(({ perfilId, total }) => [perfilId ? etiquetaDe(perfiles, perfilId) : CONFIG.auditoria.textos.sinPerfil, K.de(total, kpi.acciones.total)]),
  );
}

export function pdfDelPanel({ consolidado, kpi, perfiles, ambito, hora, generadoEn }) {
  const pdf = new Pdf({ titulo: T.tituloPanel, cabecera: T.cabecera, pie: T.nota, fecha: new Date(generadoEn) });
  const P = CONFIG.panel.textos;
  const c = consolidado.contadores;

  pdf.titulo(T.tituloPanel);
  pdf.pares([
    [T.eleccion, `${CONFIG.eleccion.tipo} · ${CONFIG.eleccion.ambito}`],
    [T.ambito, ambito],
    [T.generado, hora(generadoEn)],
  ]);

  pdf.subtitulo(P.estados);
  pdf.tabla(
    [
      { titulo: T.estado, ancho: 0.7 },
      { titulo: T.mesasColumna, ancho: 0.3, derecha: true },
    ],
    [
      [ESTADOS.validada, c.validada],
      [ESTADOS.enviada, c.pendiente],
      [ESTADOS.devuelta, c.devuelta],
      [ESTADOS['sin-acta'], c.sinActa],
      [P.conDescuadre, c.descuadre],
      [P.totalMesas, c.mesas],
    ],
    { destacada: 5 },
  );

  pdf.subtitulo(P.totales);
  pdf.texto(P.totalesNota, { cuerpo: 9, gris: 0.35 });
  tablaDeSuma(pdf, consolidado.total.validadas);

  pdf.subtitulo(P.provisional);
  pdf.texto(P.provisionalNota, { cuerpo: 9, gris: 0.35 });
  tablaDeSuma(pdf, consolidado.total.provisional);

  const numeros = [...CONFIG.acta.campos.map((campo) => campo.corto), ...candidaturas().map((candidatura) => candidatura.id)];
  const columnas = [
    { titulo: T.mesa, ancho: 0.16 },
    { titulo: T.estado, ancho: 0.28 },
    ...numeros.map((titulo) => ({ titulo, ancho: 0.56 / numeros.length, derecha: true })),
  ];
  const celdas = (cifras) => [
    ...CONFIG.acta.campos.map(({ id }) => cifras[id]),
    ...candidaturas().map(({ id }) => cifras.candidaturas[id]),
  ];
  pdf.subtitulo(P.desglose);
  pdf.texto(P.leyenda(candidaturas()), { cuerpo: 9, gris: 0.35 });
  for (const grupo of consolidado.porColegio) {
    pdf.subtitulo(grupo.colegio.nombre);
    const filas = grupo.mesas.map(({ mesa, acta, estado }) => [
      mesa.nombre,
      `${ESTADOS[estado]}${acta?.descuadre ? ` (${P.descuadreCorto})` : ''}`,
      ...(acta ? celdas(acta.cifras) : numeros.map(() => '-')),
    ]);
    filas.push([P.subtotal, '', ...celdas(grupo.validadas)]);
    pdf.tabla(columnas, filas, { destacada: filas.length - 1 });
  }

  if (kpi) actividadEnPdf(pdf, kpi, perfiles ?? [], hora);

  pdf.espacio(14);
  pdf.texto(T.nota, { fuente: 'negrita', cuerpo: 9 });
  return pdf;
}
