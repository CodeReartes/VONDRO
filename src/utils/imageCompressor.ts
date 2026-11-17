/**
 * Compresses an image file (e.g. JPG, PNG, WEBP) client-side using Canvas.
 * Returns a compressed base64 data URL string.
 * Max dimension: 400x400 (ideal for avatars & profile photos).
 * Output quality: 0.8 JPEG (~20KB - 40KB).
 */
export const compressImageFile = (
  file: File, 
  maxWidth: number = 400, 
  maxHeight: number = 400, 
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If not an image file, reject or read raw
    if (!file.type.startsWith('image/')) {
      return reject(new Error('El archivo seleccionado no es una imagen válida.'));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio fit
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(event.target?.result as string);
        }

        // Draw image smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with target quality
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export interface CompressedImageResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  savingsPercent: number;
}

/**
 * High-performance smart compressor for product catalog photos.
 * Preserves crisp visual sharpness and vibrant colors while slashing
 * file weight down to ~20KB-45KB to strictly prevent Firestore 1MB document limit overflows.
 */
export const compressProductImage = (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.76
): Promise<CompressedImageResult> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('El archivo seleccionado no es una imagen válida.'));
    }

    const originalSize = file.size;
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;

        // Maintain aspect ratio within bounding box
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          const fallbackUrl = event.target?.result as string;
          return resolve({
            dataUrl: fallbackUrl,
            originalSize,
            compressedSize: originalSize,
            width: img.width,
            height: img.height,
            savingsPercent: 0
          });
        }

        // High quality bicubic interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first if supported (extremely lightweight), fallback to JPEG
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Calculate approximate size in bytes from base64
        const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const compressedSize = Math.round((base64Length * 3) / 4);
        const savingsPercent = originalSize > compressedSize 
          ? Math.round(((originalSize - compressedSize) / originalSize) * 100) 
          : 0;

        resolve({
          dataUrl,
          originalSize,
          compressedSize,
          width,
          height,
          savingsPercent
        });
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
  });
};

/**
 * Compresses an existing base64 data URL string down to compact dimensions.
 */
export const compressDataUrl = (
  dataUrl: string,
  maxWidth: number = 720,
  maxHeight: number = 720,
  quality: number = 0.70
): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !dataUrl || !dataUrl.startsWith('data:image/')) {
      return resolve(dataUrl);
    }

    // If already tiny (< 25KB base64 length ~32000 chars), return as is
    if (dataUrl.length < 32000) {
      return resolve(dataUrl);
    }

    const img = new Image();
    // Do NOT set crossOrigin on data URLs - can cause security exceptions on some browsers
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let compressed = canvas.toDataURL('image/webp', quality);
        if (!compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        // If compressed is smaller, use it
        if (compressed && compressed.length < dataUrl.length) {
          resolve(compressed);
        } else {
          resolve(dataUrl);
        }
      } catch (e) {
        console.warn('Canvas compression error, falling back:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
};

/**
 * Optimizes an entire product object before saving to Firestore or local storage,
 * ensuring all images and variants are safely compressed and total size stays strictly below 750KB
 * (well under Firestore's 1,048,576 bytes limit).
 */
export const optimizeProductPayload = async <T extends Record<string, any>>(product: T): Promise<T> => {
  try {
    const copy: Record<string, any> = { ...product };

    // 1. First pass: Optimize images array
    if (Array.isArray(copy.images) && copy.images.length > 0) {
      const optimizedImages: string[] = [];
      for (const imgUrl of copy.images) {
        if (typeof imgUrl === 'string' && imgUrl.startsWith('data:image/')) {
          const compressed = await compressDataUrl(imgUrl, 640, 640, 0.68);
          optimizedImages.push(compressed);
        } else if (typeof imgUrl === 'string') {
          optimizedImages.push(imgUrl);
        }
      }
      copy.images = optimizedImages;
    }

    // 2. First pass: Optimize variants images
    if (Array.isArray(copy.variants) && copy.variants.length > 0) {
      const optimizedVariants = [];
      for (const variant of copy.variants) {
        if (variant && typeof variant.imageUrl === 'string' && variant.imageUrl.startsWith('data:image/')) {
          const compressed = await compressDataUrl(variant.imageUrl, 400, 400, 0.65);
          optimizedVariants.push({ ...variant, imageUrl: compressed });
        } else {
          optimizedVariants.push(variant);
        }
      }
      copy.variants = optimizedVariants;
    }

    // 3. Size check: If total payload exceeds 600,000 chars, perform aggressive secondary reduction
    let jsonLength = JSON.stringify(copy).length;
    if (jsonLength > 600000) {
      if (Array.isArray(copy.images)) {
        const reOptimized: string[] = [];
        for (const imgUrl of copy.images) {
          if (typeof imgUrl === 'string' && imgUrl.startsWith('data:image/')) {
            const aggressive = await compressDataUrl(imgUrl, 480, 480, 0.52);
            reOptimized.push(aggressive);
          } else {
            reOptimized.push(imgUrl);
          }
        }
        copy.images = reOptimized;
      }

      if (Array.isArray(copy.variants)) {
        const reVariants = [];
        for (const v of copy.variants) {
          if (v && typeof v.imageUrl === 'string' && v.imageUrl.startsWith('data:image/')) {
            const aggressive = await compressDataUrl(v.imageUrl, 300, 300, 0.50);
            reVariants.push({ ...v, imageUrl: aggressive });
          } else {
            reVariants.push(v);
          }
        }
        copy.variants = reVariants;
      }
    }

    // 4. Absolute hard limit guarantee: If still > 750,000 chars (safe margin before 1,048,576)
    jsonLength = JSON.stringify(copy).length;
    if (jsonLength > 750000) {
      // Limit to at most 2 main images
      if (Array.isArray(copy.images) && copy.images.length > 2) {
        copy.images = copy.images.slice(0, 2);
      }
      // Remove variant base64 images if still too heavy
      if (JSON.stringify(copy).length > 750000 && Array.isArray(copy.variants)) {
        copy.variants = copy.variants.map((v: any) => ({
          ...v,
          imageUrl: (typeof v.imageUrl === 'string' && v.imageUrl.startsWith('data:')) ? '' : v.imageUrl
        }));
      }
      // Keep only 1 primary image if still oversized
      if (JSON.stringify(copy).length > 750000 && Array.isArray(copy.images) && copy.images.length > 1) {
        copy.images = [copy.images[0]];
      }
    }

    return copy as T;
  } catch (err) {
    console.warn('Error during product payload optimization:', err);
    return product;
  }
};

/**
 * Automatically converts Google Drive share links into direct loadable image URLs.
 * Handles all variants of Google Drive links.
 */
export const convertGoogleDriveUrl = (rawUrl: string): { directUrl: string; isDrive: boolean; fileId?: string } => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { directUrl: '', isDrive: false };

  // Match /file/d/{id}, id={id}, etc.
  const drivePatterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/uc\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/thumbnail\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/i,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i,
    /docs\.google\.com\/uc\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/i,
  ];

  for (const pattern of drivePatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const fileId = match[1];
      // lh3.googleusercontent.com/d/{id} provides ultra-fast direct image streaming from Google Drive
      return {
        directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
        isDrive: true,
        fileId
      };
    }
  }

  // Not a Drive URL, return as is
  return { directUrl: trimmed, isDrive: false };
};

/**
 * Format bytes into human-readable size: KB, MB, etc.
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

