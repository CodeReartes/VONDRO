import {
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  PDF417Reader
} from '@zxing/library';

export interface ArgentineDniPdf417Result {
  rawText: string;
  tramiteNumber?: string;
  lastName: string;
  firstName: string;
  fullName: string;
  dni: string;
  gender?: string;
  ejemplar?: string;
  birthDate?: string;
  issueDate?: string;
  isValidArgentinePdf417: boolean;
}

/**
 * Parsea el string crudo del código de barras PDF417 del DNI tarjeta argentino (RENAPER).
 * Soporta tanto el formato moderno (sin @ inicial) como el formato anterior (inicia con @).
 */
export function parseArgentineDniPdf417(rawText: string): ArgentineDniPdf417Result | null {
  const clean = String(rawText || '').trim();
  if (!clean || !clean.includes('@')) return null;

  const parts = clean.split('@').map(p => p.trim());

  // Formato anterior (ej: "@12345678@A@1@APELLIDO@NOMBRE@ARGENTINA@DD/MM/YYYY@M@DD/MM/YYYY@TRAMITE...")
  if (clean.startsWith('@') && parts.length >= 6) {
    const dniDigits = (parts[1] || '').replace(/\D/g, '');
    const lastName = parts[4] || '';
    const firstName = parts[5] || '';
    if (dniDigits.length >= 7 && dniDigits.length <= 9 && (lastName || firstName)) {
      return {
        rawText: clean,
        dni: dniDigits,
        ejemplar: parts[2] || undefined,
        lastName,
        firstName,
        fullName: `${firstName} ${lastName}`.trim(),
        birthDate: parts[7] || undefined,
        gender: parts[8] || undefined,
        issueDate: parts[9] || undefined,
        tramiteNumber: parts[10] || undefined,
        isValidArgentinePdf417: true
      };
    }
  }

  // Formato estándar vigente (ej: "00456789123@APELLIDO@NOMBRE@M@38410826@A@15/08/1994@10/03/2020@...")
  if (parts.length >= 5) {
    const tramiteNumber = (parts[0] || '').replace(/\D/g, '') || undefined;
    const lastName = parts[1] || '';
    const firstName = parts[2] || '';
    const gender = parts[3] || undefined;
    const dniDigits = (parts[4] || '').replace(/\D/g, '');
    const ejemplar = parts[5] || undefined;
    const birthDate = parts[6] || undefined;
    const issueDate = parts[7] || undefined;

    if (dniDigits.length >= 7 && dniDigits.length <= 9 && (lastName || firstName)) {
      return {
        rawText: clean,
        tramiteNumber,
        lastName,
        firstName,
        fullName: `${firstName} ${lastName}`.trim(),
        dni: dniDigits,
        gender,
        ejemplar,
        birthDate,
        issueDate,
        isValidArgentinePdf417: true
      };
    }
  }

  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function decodeCanvasWithZxing(canvas: HTMLCanvasElement, reader: PDF417Reader): string | null {
  try {
    const luminance = new HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    const result = reader.decode(bitmap, hints);
    return result?.getText() || null;
  } catch {
    return null;
  }
}

/**
 * Intenta leer el código PDF417 directamente desde la foto del frente del DNI en el navegador.
 * Prueba primero BarcodeDetector nativo (si el dispositivo lo soporta) y luego ZXing PDF417Reader
 * sobre múltiples recortes/rotaciones.
 */
export async function scanPdf417FromImageDataUrl(dataUrl: string): Promise<ArgentineDniPdf417Result | null> {
  if (!dataUrl || typeof document === 'undefined') return null;

  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    // 1. Native BarcodeDetector (Chrome / Android WebView)
    const BarcodeDetectorApi = (window as any).BarcodeDetector;
    if (BarcodeDetectorApi) {
      try {
        const supported: string[] = await BarcodeDetectorApi.getSupportedFormats?.() || [];
        if (supported.includes('pdf417')) {
          const detector = new BarcodeDetectorApi({ formats: ['pdf417'] });
          const detected = await detector.detect(img);
          for (const item of detected || []) {
            const parsed = parseArgentineDniPdf417(item?.rawValue || '');
            if (parsed) return parsed;
          }
        }
      } catch {
        // Fallback to ZXing
      }
    }

    // 2. ZXing PDF417Reader across full image, bottom strip, and 90°/270° rotated crops
    const reader = new PDF417Reader();
    const crops: Array<{ sx: number; sy: number; sw: number; sh: number; rotateDeg: number }> = [
      { sx: 0, sy: 0, sw: w, sh: h, rotateDeg: 0 },
      { sx: 0, sy: Math.floor(h * 0.45), sw: w, sh: Math.ceil(h * 0.55), rotateDeg: 0 },
      { sx: 0, sy: 0, sw: w, sh: h, rotateDeg: 90 },
      { sx: 0, sy: 0, sw: w, sh: h, rotateDeg: 270 }
    ];

    for (const crop of crops) {
      const canvas = document.createElement('canvas');
      const maxDim = 1400;
      const scale = Math.min(1.5, maxDim / Math.max(crop.sw, crop.sh));
      const dw = Math.max(1, Math.round(crop.sw * scale));
      const dh = Math.max(1, Math.round(crop.sh * scale));

      if (crop.rotateDeg === 90 || crop.rotateDeg === 270) {
        canvas.width = dh;
        canvas.height = dw;
      } else {
        canvas.width = dw;
        canvas.height = dh;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.save();
      if (crop.rotateDeg === 90) {
        ctx.translate(dh, 0);
        ctx.rotate(Math.PI / 2);
      } else if (crop.rotateDeg === 270) {
        ctx.translate(0, dw);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, dw, dh);
      ctx.restore();

      const text = decodeCanvasWithZxing(canvas, reader);
      if (text) {
        const parsed = parseArgentineDniPdf417(text);
        if (parsed) return parsed;
      }
    }

    return null;
  } catch {
    return null;
  }
}
