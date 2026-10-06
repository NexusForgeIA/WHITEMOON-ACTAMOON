// Los dos documentos PDF de la demo: el de una mesa y el del panel. Modulo
// puro: recibe los datos ya leidos y devuelve un Pdf.

import { CONFIG } from './config.js';
import { filasDeSuma } from './consolidado.js';
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
    filasDeSuma(acta.cifras, CONFIG.acta.campos, CONFIG.candidaturas).map(([etiqueta, valor]) => [etiqueta, valor]),
  );
  if (acta.descuadre) {
    pdf.texto(T.conDescuadre, { fuente: 'negrita' });
    for (const frase of frasesDescuadre(validaActa(acta.cifras, CONFIG.candidaturas), CONFIG.acta.textos)) pdf.texto(frase);
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
    [[T.mesasSumadas, suma.mesas], ...filasDeSuma(suma, CONFIG.acta.campos, CONFIG.candidaturas).map(([etiqueta, valor]) => [etiqueta, valor])],
  );
}

export function pdfDelPanel({ consolidado, ambito, hora, generadoEn }) {
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

  const numeros = [...CONFIG.acta.campos.map((campo) => campo.corto), ...CONFIG.candidaturas.map((candidatura) => candidatura.id)];
  const columnas = [
    { titulo: T.mesa, ancho: 0.16 },
    { titulo: T.estado, ancho: 0.28 },
    ...numeros.map((titulo) => ({ titulo, ancho: 0.56 / numeros.length, derecha: true })),
  ];
  const celdas = (cifras) => [
    ...CONFIG.acta.campos.map(({ id }) => cifras[id]),
    ...CONFIG.candidaturas.map(({ id }) => cifras.candidaturas[id]),
  ];
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

  pdf.espacio(14);
  pdf.texto(T.nota, { fuente: 'negrita', cuerpo: 9 });
  return pdf;
}
