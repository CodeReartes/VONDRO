/**
 * High-Performance Image Optimizer & Cache for VONDRO
 * Optimizes image loading for 1000+ catalog items with low data usage and zero scroll lag.
 */

// Global in-memory cache to remember loaded image URLs during the session
const loadedImageUrls = new Set<string>();

export const DEFAULT_FALLBACK_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none"><rect width="400" height="400" fill="%23F8FAFC"/><rect x="1" y="1" width="398" height="398" rx="16" stroke="%23E2E8F0" stroke-width="2"/><g transform="translate(140, 130)" stroke="%237C3AED" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M20 35 L60 15 L100 35 L60 55 Z" fill="%23EDE9FE"/><path d="M20 35 L20 80 L60 100 L60 55 Z" fill="%23DDD6FE"/><path d="M100 35 L100 80 L60 100 L60 55 Z" fill="%23EDE9FE"/><path d="M40 25 L80 45"/></g><text x="200" y="265" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="900" fill="%236D28D9" text-anchor="middle" letter-spacing="1">VONDRO</text><text x="200" y="288" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="%2394A3B8" text-anchor="middle">Foto en preparación</text></svg>';

// Category-specific high-resolution fallbacks
export const CATEGORY_FALLBACKS: Record<string, string> = {
  hogar: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=75',
  audio: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&auto=format&fit=crop&q=75',
  auriculares: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=75',
  cocina: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&auto=format&fit=crop&q=75',
  accesorios: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&auto=format&fit=crop&q=75',
  tecnologia: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&auto=format&fit=crop&q=75',
  belleza: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop&q=75',
  juguetes: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&auto=format&fit=crop&q=75',
  infantil: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&auto=format&fit=crop&q=75',
  gamer: 'https://images.unsplash.com/photo-1612287233215-625d30325dcf?w=400&auto=format&fit=crop&q=75',
  quencher: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=400&auto=format&fit=crop&q=75',
  vaso: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=400&auto=format&fit=crop&q=75',
  botella: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&auto=format&fit=crop&q=75',
  termos: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400&auto=format&fit=crop&q=75',
  asado: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&auto=format&fit=crop&q=75',
  parrilla: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&auto=format&fit=crop&q=75'
};

export function getCategoryFallback(categoryId?: string): string {
  if (!categoryId) return DEFAULT_FALLBACK_IMG;
  const key = categoryId.toLowerCase();
  for (const [catKey, url] of Object.entries(CATEGORY_FALLBACKS)) {
    if (key.includes(catKey)) return url;
  }
  return DEFAULT_FALLBACK_IMG;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  times: '×',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  deg: '°',
  reg: '®',
  copy: '©',
  trade: '™',
  plusmn: '±',
  eacute: 'é',
  aacute: 'á',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  Eacute: 'É',
  Aacute: 'Á',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ'
};

function decodeHtmlOnce(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-zA-Z0-9]+);/g, (match, name) => {
      return NAMED_HTML_ENTITIES[name] ?? NAMED_HTML_ENTITIES[name.toLowerCase()] ?? match;
    });
}

/**
 * Decodes HTML entities like &#8211;, &#215;, &#8243;, &amp;, &quot; in product titles and descriptions
 */
export function decodeHtmlEntities(text?: string): string {
  if (!text) return '';
  return decodeHtmlOnce(decodeHtmlOnce(text)).replace(/\s+/g, ' ').trim();
}

export function isDataSaverActive(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!conn) return false;
  return Boolean(conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g');
}

/**
 * Returns an ultra-fast, low-data WebP thumbnail URL (~6-14 KB) for grid feeds and list views.
 * External catalog images are resized & compressed via /api/img with memory/disk/SW caching.
 */
export function getOptimizedThumbnail(url?: string, width: number = 260, quality: number = 56): string {
  if (!url) return DEFAULT_FALLBACK_IMG;

  // Return data URLs, blob URLs, local assets, and already-proxied /api/img URLs directly
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/') || !url.startsWith('http')) {
    return url;
  }

  const saveData = isDataSaverActive();
  const effectiveW = saveData ? Math.min(width, 200) : width;
  const effectiveQ = saveData ? Math.min(quality, 48) : quality;

  try {
    const parsed = new URL(url);

    // 1. Unsplash CDN native optimizer
    if (parsed.hostname.includes('unsplash.com')) {
      parsed.searchParams.set('w', effectiveW.toString());
      parsed.searchParams.set('q', effectiveQ.toString());
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }

    // 2. Cloudinary CDN native optimizer
    if (parsed.hostname.includes('cloudinary.com')) {
      if (parsed.pathname.includes('/upload/') && !parsed.pathname.includes('/upload/w_')) {
        return url.replace('/upload/', `/upload/w_${effectiveW},q_${effectiveQ},f_auto,c_limit/`);
      }
      return url;
    }

    // 3. Inova ARG and external catalog hosts: resize & compress to lightweight WebP on our server proxy
    return `/api/img?url=${encodeURIComponent(url)}&w=${effectiveW}&q=${effectiveQ}`;
  } catch {
    return url;
  }
}

/**
 * Returns a crisp high-resolution image URL (~25-45 KB WebP) for the Product Detail and Lightbox views.
 */
export function getOptimizedHighRes(url?: string, width: number = 640, quality: number = 72): string {
  if (!url) return DEFAULT_FALLBACK_IMG;

  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/') || !url.startsWith('http')) {
    return url;
  }

  const saveData = isDataSaverActive();
  const effectiveW = saveData ? Math.min(width, 480) : width;
  const effectiveQ = saveData ? Math.min(quality, 62) : quality;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('unsplash.com')) {
      parsed.searchParams.set('w', effectiveW.toString());
      parsed.searchParams.set('q', effectiveQ.toString());
      parsed.searchParams.set('auto', 'format');
      return parsed.toString();
    }

    if (parsed.hostname.includes('cloudinary.com')) {
      if (parsed.pathname.includes('/upload/') && !parsed.pathname.includes('/upload/w_')) {
        return url.replace('/upload/', `/upload/w_${effectiveW},q_${effectiveQ},f_auto/`);
      }
      return url;
    }

    return `/api/img?url=${encodeURIComponent(url)}&w=${effectiveW}&q=${effectiveQ}`;
  } catch {
    return url;
  }
}

/**
 * Checks if an image has already been loaded in this browser session
 */
export function isImageCached(url?: string): boolean {
  if (!url) return false;
  return loadedImageUrls.has(url);
}

/**
 * Marks an image URL as cached/loaded
 */
export function markImageCached(url?: string): void {
  if (url) {
    loadedImageUrls.add(url);
  }
}

/**
 * Preloads an image in the background (no-op in data-saver mode to avoid consuming user bandwidth)
 */
export function preloadImage(url?: string, priority: boolean = false): void {
  // Disabled to prevent unwanted mobile data consumption
}

/**
 * Preloads a batch of image URLs (disabled to preserve mobile bandwidth)
 */
export function preloadImagesBatch(urls: (string | undefined)[], maxCount: number = 10): void {
  // Disabled to prevent background data usage
}

/**
 * Compresses an uploaded transfer receipt image on mobile/desktop browsers.
 * Resizes large camera photos to max 1000px and 70% JPEG quality (~50KB),
 * preventing LocalStorage quota overflow and Firestore 1MB document limit rejections.
 */
export function compressReceiptImage(file: File, maxDim = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = reject;

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (err) {
        // Fallback to original image data url if canvas fails
        resolve(img.src);
      }
    };

    img.onerror = () => {
      resolve(reader.result as string || '');
    };

    reader.readAsDataURL(file);
  });
}
