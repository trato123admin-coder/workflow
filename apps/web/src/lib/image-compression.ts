import { DEFAULT_IMAGE_MAX_PX } from '@workflow/shared';

function calculateScaledDimensions(
  width: number,
  height: number,
  maxPx: number
): { width: number; height: number } {
  if (width <= maxPx && height <= maxPx) {
    return { width, height };
  }
  if (width > height) {
    return {
      width: maxPx,
      height: Math.round((height * maxPx) / width),
    };
  }
  return {
    width: Math.round((width * maxPx) / height),
    height: maxPx,
  };
}

/**
 * Optimiza y comprime una imagen en el navegador antes de transferirla (01-anexo §B.5 #1).
 * Si la imagen excede maxPx (2000px por defecto), la escala proporcionalmente y la codifica a JPEG (82% calidad).
 * Si el archivo es un PDF o DOCX, se retorna intacto.
 */
export async function optimizeImageFile(
  file: File,
  maxPx: number = DEFAULT_IMAGE_MAX_PX,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = calculateScaledDimensions(img.width, img.height, maxPx);

      if (width === img.width && height === img.height && file.size < 1.5 * 1024 * 1024) {
        return resolve(file);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) return resolve(file);
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

function buildJpegPdf(jpegBytes: Uint8Array, width: number, height: number): Uint8Array {
  const maxPtW = 595.28;
  const maxPtH = 841.89;
  const scale = Math.min(maxPtW / width, maxPtH / height, 1);
  const ptW = (width * scale).toFixed(2);
  const ptH = (height * scale).toFixed(2);

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;

  const add = (t: string | Uint8Array) => {
    const b = typeof t === 'string' ? encoder.encode(t) : t;
    chunks.push(b);
    currentOffset += b.length;
  };

  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  offsets.push(currentOffset);
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offsets.push(currentOffset);
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  offsets.push(currentOffset);
  add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`);
  offsets.push(currentOffset);
  const stream = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im1 Do\nQ\n`;
  add(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  offsets.push(currentOffset);
  add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  add(jpegBytes);
  add('\nendstream\nendobj\n');

  const startXref = currentOffset;
  add('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    add(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Convierte una foto o imagen a un documento PDF 1.4 estándar (01-anexo §B.5 #1).
 * Comprime la imagen a JPEG y la encapsula en un flujo PDF con DCTDecode sin dependencias externas.
 */
export async function convertImageToPdf(
  file: File,
  maxPx: number = DEFAULT_IMAGE_MAX_PX
): Promise<File> {
  if (file.type === 'application/pdf') return file;
  if (!file.type.startsWith('image/')) return file;

  const jpegFile = await optimizeImageFile(file, maxPx, 0.85);
  const arrayBuffer = await jpegFile.arrayBuffer();
  const jpegBytes = new Uint8Array(arrayBuffer);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(jpegFile);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const pdfBytes = buildJpegPdf(jpegBytes, img.width || 800, img.height || 600);
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      resolve(new File([pdfBytes.buffer as ArrayBuffer], `${baseName}.pdf`, { type: 'application/pdf', lastModified: Date.now() }));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(jpegFile);
    };
    img.src = url;
  });
}
