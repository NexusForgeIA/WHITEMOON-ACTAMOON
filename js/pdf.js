// Generador de PDF propio, sin librerias. Modulo puro: devuelve bytes.
//
// PDF 1.4, A4, con las fuentes estandar Helvetica, Helvetica-Bold y Courier en
// codificacion WinAnsi (cubre el espanol). Sin compresion: los flujos de
// contenido van en texto, y las fotos JPEG se incrustan tal cual (DCTDecode).

const ANCHO = 595.28;
const ALTO = 841.89;
const MARGEN = 48;
const UTIL = ANCHO - 2 * MARGEN;
const SUELO = MARGEN + 34; // por debajo va el pie
const TECHO = ALTO - MARGEN - 26; // por encima va la cabecera

const FUENTES = {
  normal: { ref: 'F1', base: 'Helvetica' },
  negrita: { ref: 'F2', base: 'Helvetica-Bold' },
  mono: { ref: 'F3', base: 'Courier' },
};

// Anchos de los caracteres 32..126 en milesimas del cuerpo (metricas AFM).
const ANCHOS = {
  normal: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
    556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
    260, 334, 584,
  ],
  negrita: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
    556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
    280, 389, 584,
  ],
};

// Caracteres fuera de Latin-1 que WinAnsi si tiene.
const WINANSI = { 0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };

function codigoWinAnsi(caracter) {
  const codigo = caracter.codePointAt(0);
  if (codigo > 0xff || (codigo >= 0x80 && codigo <= 0x9f)) return WINANSI[codigo] ?? 0x3f; // '?'
  return codigo;
}

// Cadena PDF entre parentesis, en ASCII: lo demas va como escape octal.
export function cadenaPdf(texto) {
  let salida = '';
  for (const caracter of String(texto)) {
    const codigo = codigoWinAnsi(caracter);
    if (codigo === 0x28 || codigo === 0x29 || codigo === 0x5c) salida += `\\${String.fromCharCode(codigo)}`;
    else if (codigo < 32 || codigo > 126) salida += `\\${codigo.toString(8).padStart(3, '0')}`;
    else salida += String.fromCharCode(codigo);
  }
  return `(${salida})`;
}

function anchoDeCaracter(caracter, fuente) {
  if (fuente === 'mono') return 600;
  const tabla = ANCHOS[fuente];
  const codigo = caracter.codePointAt(0);
  if (codigo >= 32 && codigo <= 126) return tabla[codigo - 32];
  // Una letra acentuada mide lo que su letra base; lo demas, como una cifra.
  const base = caracter.normalize('NFD').codePointAt(0);
  return base >= 32 && base <= 126 ? tabla[base - 32] : 556;
}

export function anchoDeTexto(texto, fuente, cuerpo) {
  let total = 0;
  for (const caracter of String(texto)) total += anchoDeCaracter(caracter, fuente);
  return (total * cuerpo) / 1000;
}

// Parte el texto en lineas que caben en `ancho`. Una palabra mas ancha que la
// linea (una huella, por ejemplo) se corta por caracteres.
export function parteEnLineas(texto, fuente, cuerpo, ancho) {
  const lineas = [];
  for (const parrafo of String(texto).split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const candidata = linea ? `${linea} ${palabra}` : palabra;
      if (anchoDeTexto(candidata, fuente, cuerpo) <= ancho) {
        linea = candidata;
        continue;
      }
      if (linea) lineas.push(linea);
      linea = '';
      let resto = palabra;
      while (anchoDeTexto(resto, fuente, cuerpo) > ancho) {
        let n = 1;
        while (n < resto.length && anchoDeTexto(resto.slice(0, n + 1), fuente, cuerpo) <= ancho) n += 1;
        lineas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      linea = resto;
    }
    lineas.push(linea);
  }
  return lineas;
}

// Ancho, alto y numero de componentes de un JPEG, leidos de su cabecera SOF.
export function dimensionesJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('No es un JPEG');
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('JPEG mal formado');
    const marcador = bytes[i + 1];
    if (marcador === 0xff) {
      i += 1; // relleno
      continue;
    }
    const esSof = marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
    if (esSof) {
      return { alto: (bytes[i + 5] << 8) | bytes[i + 6], ancho: (bytes[i + 7] << 8) | bytes[i + 8], componentes: bytes[i + 9] };
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  throw new Error('JPEG sin cabecera de imagen');
}

const n = (valor) => Number(valor.toFixed(2)).toString();
const ascii = (texto) => Uint8Array.from(texto, (caracter) => caracter.charCodeAt(0));

export class Pdf {
  #titulo;
  #cabecera;
  #pie;
  #fecha;
  #paginas = [[]];
  #imagenes = [];
  #y = TECHO;

  // cabecera: texto a la derecha de cada pagina. pie: nota al pie de cada pagina.
  constructor({ titulo, cabecera, pie, fecha = new Date() }) {
    this.#titulo = titulo;
    this.#cabecera = cabecera;
    this.#pie = pie;
    this.#fecha = fecha;
  }

  get paginas() {
    return this.#paginas.length;
  }

  #ops() {
    return this.#paginas.at(-1);
  }

  // Asegura que caben `alto` puntos; si no, pasa de pagina.
  #reserva(alto) {
    if (this.#y - alto >= SUELO) return;
    this.#paginas.push([]);
    this.#y = TECHO;
  }

  #pinta(ops, texto, x, y, fuente, cuerpo, gris = 0) {
    ops.push(`BT /${FUENTES[fuente].ref} ${n(cuerpo)} Tf ${n(gris)} g ${n(x)} ${n(y)} Td ${cadenaPdf(texto)} Tj ET`);
  }

  #regla(ops, y, gris = 0.75) {
    ops.push(`${n(gris)} G 0.5 w ${n(MARGEN)} ${n(y)} m ${n(ANCHO - MARGEN)} ${n(y)} l S`);
  }

  espacio(alto = 8) {
    this.#y -= alto;
    return this;
  }

  texto(contenido, { fuente = 'normal', cuerpo = 10, gris = 0, sangria = 0 } = {}) {
    const salto = cuerpo * 1.4;
    // Un 2 % de holgura: los anchos de las letras acentuadas son aproximados.
    for (const linea of parteEnLineas(contenido, fuente, cuerpo, (UTIL - sangria) * 0.98)) {
      this.#reserva(salto);
      this.#y -= salto;
      this.#pinta(this.#ops(), linea, MARGEN + sangria, this.#y, fuente, cuerpo, gris);
    }
    return this;
  }

  titulo(contenido) {
    this.texto(contenido, { fuente: 'negrita', cuerpo: 18 });
    return this.espacio(6);
  }

  subtitulo(contenido) {
    this.#reserva(60); // que el subtitulo no se quede solo al final de la pagina
    this.espacio(12);
    this.texto(contenido, { fuente: 'negrita', cuerpo: 12 });
    return this.espacio(2);
  }

  // Lista de [etiqueta, valor]: la etiqueta en gris a la izquierda.
  pares(lista, { columna = 150 } = {}) {
    const cuerpo = 10;
    const salto = cuerpo * 1.5;
    for (const [etiqueta, valor] of lista) {
      const lineas = parteEnLineas(valor, 'normal', cuerpo, (UTIL - columna) * 0.98);
      this.#reserva(salto * lineas.length);
      lineas.forEach((linea, i) => {
        this.#y -= salto;
        if (i === 0) this.#pinta(this.#ops(), etiqueta, MARGEN, this.#y, 'normal', 9, 0.35);
        this.#pinta(this.#ops(), linea, MARGEN + columna, this.#y, 'normal', cuerpo);
      });
    }
    return this;
  }

  // columnas: [{ titulo, ancho (fraccion del ancho util), derecha }]. filas: listas de celdas.
  // destacada: indice de la fila que va en negrita (un subtotal).
  tabla(columnas, filas, { destacada = -1 } = {}) {
    const cuerpo = 9;
    const alto = 17;
    let x = MARGEN;
    const cols = columnas.map((columna) => {
      const inicio = x;
      x += columna.ancho * UTIL;
      return { ...columna, inicio, fin: x };
    });
    const fila = (celdas, fuente, gris) => {
      this.#reserva(alto);
      this.#y -= alto;
      celdas.forEach((celda, i) => {
        const texto = String(celda);
        const col = cols[i];
        const xCelda = col.derecha ? col.fin - 4 - anchoDeTexto(texto, fuente, cuerpo) : col.inicio + 2;
        this.#pinta(this.#ops(), texto, xCelda, this.#y + 5, fuente, cuerpo, gris);
      });
      this.#regla(this.#ops(), this.#y);
    };
    this.#reserva(alto * 3); // la cabecera nunca queda sola
    fila(cols.map((col) => col.titulo), 'negrita', 0.2);
    filas.forEach((celdas, i) => fila(celdas, i === destacada ? 'negrita' : 'normal', 0));
    return this.espacio(4);
  }

  // Incrusta un JPEG sin recodificarlo, ajustado al ancho util y a `altoMaximo`.
  imagen(jpeg, { altoMaximo = 360 } = {}) {
    const { ancho, alto, componentes } = dimensionesJpeg(jpeg);
    if (componentes !== 1 && componentes !== 3) throw new Error('JPEG con un espacio de color no admitido');
    const escala = Math.min(UTIL / ancho, altoMaximo / alto);
    const w = ancho * escala;
    const hh = alto * escala;
    this.#reserva(hh + 8);
    this.#y -= hh + 4;
    this.#imagenes.push({ jpeg, ancho, alto, componentes, pagina: this.#paginas.length - 1 });
    this.#ops().push(`q ${n(w)} 0 0 ${n(hh)} ${n(MARGEN)} ${n(this.#y)} cm /Im${this.#imagenes.length} Do Q`);
    this.#ops().push(`0.45 G 0.5 w ${n(MARGEN)} ${n(this.#y)} ${n(w)} ${n(hh)} re S`);
    return this.espacio(4);
  }

  // Cabecera y pie de cada pagina, cuando ya se sabe cuantas hay.
  #marco(pagina, total) {
    const ops = [];
    const yCabecera = ALTO - MARGEN - 4;
    this.#pinta(ops, 'ACTAMOON', MARGEN, yCabecera, 'negrita', 9);
    this.#pinta(ops, this.#cabecera, ANCHO - MARGEN - anchoDeTexto(this.#cabecera, 'negrita', 8), yCabecera, 'negrita', 8, 0.2);
    this.#regla(ops, yCabecera - 6, 0.3);

    this.#regla(ops, MARGEN + 26, 0.3);
    const numero = `Página ${pagina} de ${total}`;
    const anchoNumero = anchoDeTexto(numero, 'normal', 8);
    parteEnLineas(this.#pie, 'normal', 8, (UTIL - anchoNumero - 16) * 0.98)
      .slice(0, 2)
      .forEach((linea, i) => this.#pinta(ops, linea, MARGEN, MARGEN + 14 - i * 10, 'normal', 8, 0.3));
    this.#pinta(ops, numero, ANCHO - MARGEN - anchoNumero, MARGEN + 14, 'normal', 8, 0.3);
    return ops;
  }

  bytes() {
    const trozos = [];
    const posiciones = [];
    let largo = 0;
    const escribe = (trozo) => {
      const datos = typeof trozo === 'string' ? ascii(trozo) : trozo;
      trozos.push(datos);
      largo += datos.length;
    };
    const objeto = (numero, cuerpo, flujo) => {
      posiciones[numero] = largo;
      escribe(`${numero} 0 obj\n${cuerpo}\n`);
      if (flujo) {
        escribe('stream\n');
        escribe(flujo);
        escribe('\nendstream\n');
      }
      escribe('endobj\n');
    };

    // Numeracion: 1 catalogo, 2 paginas, 3-5 fuentes, 6 info, imagenes, y
    // despues cada pagina con su contenido.
    const primeraImagen = 7;
    const primeraPagina = primeraImagen + this.#imagenes.length;
    const totalPaginas = this.#paginas.length;
    const ultimo = primeraPagina + totalPaginas * 2 - 1;

    escribe('%PDF-1.4\n');
    escribe(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a)); // marca de archivo binario

    objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const hijos = this.#paginas.map((_, i) => `${primeraPagina + i * 2} 0 R`).join(' ');
    const fuentes = Object.values(FUENTES).map(({ ref }, i) => `/${ref} ${3 + i} 0 R`).join(' ');
    objeto(2, `<< /Type /Pages /Kids [${hijos}] /Count ${totalPaginas} /MediaBox [0 0 ${ANCHO} ${ALTO}] >>`);
    Object.values(FUENTES).forEach(({ base }, i) => {
      objeto(3 + i, `<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`);
    });
    const f = this.#fecha;
    const dos = (valor) => String(valor).padStart(2, '0');
    const marca = `D:${f.getUTCFullYear()}${dos(f.getUTCMonth() + 1)}${dos(f.getUTCDate())}${dos(f.getUTCHours())}${dos(f.getUTCMinutes())}${dos(f.getUTCSeconds())}Z`;
    objeto(6, `<< /Title ${cadenaPdf(this.#titulo)} /Producer ${cadenaPdf('ACTAMOON (demo)')} /CreationDate (${marca}) >>`);

    this.#imagenes.forEach(({ jpeg, ancho, alto, componentes }, i) => {
      const color = componentes === 1 ? '/DeviceGray' : '/DeviceRGB';
      objeto(
        primeraImagen + i,
        `<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace ${color} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
        jpeg,
      );
    });

    this.#paginas.forEach((ops, i) => {
      const contenido = ascii([...this.#marco(i + 1, totalPaginas), ...ops].join('\n'));
      const pagina = primeraPagina + i * 2;
      // Cada pagina declara solo las imagenes que dibuja.
      const xobjetos = this.#imagenes
        .map((imagen, k) => (imagen.pagina === i ? `/Im${k + 1} ${primeraImagen + k} 0 R` : ''))
        .filter(Boolean)
        .join(' ');
      objeto(pagina, `<< /Type /Page /Parent 2 0 R /Contents ${pagina + 1} 0 R /Resources << /Font << ${fuentes} >> /XObject << ${xobjetos} >> >> >>`);
      objeto(pagina + 1, `<< /Length ${contenido.length} >>`, contenido);
    });

    const inicioXref = largo;
    escribe(`xref\n0 ${ultimo + 1}\n0000000000 65535 f \n`);
    for (let numero = 1; numero <= ultimo; numero += 1) escribe(`${String(posiciones[numero]).padStart(10, '0')} 00000 n \n`);
    escribe(`trailer\n<< /Size ${ultimo + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);

    const salida = new Uint8Array(largo);
    let posicion = 0;
    for (const trozo of trozos) {
      salida.set(trozo, posicion);
      posicion += trozo.length;
    }
    return salida;
  }
}
