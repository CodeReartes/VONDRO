import { Product } from '../types';

/**
 * Complementary category and affinity cluster mapping.
 * Connects related categories (e.g. Cocina/Bazar with Menaje/Hogar, Herramientas with Accesorios).
 */
const CATEGORY_CLUSTERS: Record<string, string[]> = {
  // Cocina & Bazar
  bazar: ['cocina', 'hogar', 'bazar', 'limpieza', 'electrodomesticos', 'mesa', 'vajilla'],
  cocina: ['bazar', 'hogar', 'electrodomesticos', 'accesorios-cocina', 'vajilla', 'menaje'],
  hogar: ['bazar', 'cocina', 'limpieza', 'decoracion', 'organizacion', 'iluminacion'],
  
  // Herramientas & Ferreteria
  herramientas: ['ferreteria', 'accesorios', 'electricidad', 'seguridad', 'automotor', 'construccion'],
  ferreteria: ['herramientas', 'electricidad', 'accesorios', 'pintureria', 'seguridad'],
  automotor: ['herramientas', 'accesorios', 'electricidad', 'seguridad'],
  
  // Belleza & Cuidado Personal
  belleza: ['cuidado-personal', 'salud', 'peluqueria', 'maquillaje', 'bienestar', 'perfumeria'],
  'cuidado-personal': ['belleza', 'salud', 'bienestar', 'peluqueria', 'higiene'],
  salud: ['cuidado-personal', 'belleza', 'bienestar', 'fitness'],
  
  // Audio, Computacion & Accesorios
  'audio-y-sonido': ['accesorios', 'computacion', 'gaming', 'celulares', 'tecnologia'],
  accesorios: ['audio-y-sonido', 'computacion', 'celulares', 'tecnologia', 'gaming'],
  computacion: ['accesorios', 'gaming', 'audio-y-sonido', 'tecnologia'],
  gaming: ['computacion', 'audio-y-sonido', 'accesorios', 'tecnologia'],
  celulares: ['accesorios', 'audio-y-sonido', 'tecnologia'],
  
  // Fitness, Deportes & Camping
  fitness: ['deportes', 'camping', 'salud', 'cuidado-personal'],
  deportes: ['fitness', 'camping', 'aire-libre', 'indumentaria'],
  camping: ['aire-libre', 'deportes', 'herramientas', 'iluminacion'],
  
  // Juguetes & Escolar
  juguetes: ['escolar', 'libreria', 'ninos', 'juegos', 'regalos'],
  libreria: ['escolar', 'juguetes', 'oficina', 'papeleria'],
  escolar: ['libreria', 'juguetes', 'organizacion']
};

/**
 * Keyword affinity mapping for domain-specific companion items.
 * Example: Cuchillos -> Platos, Tablas, Ollas, Afiladores, Cubiertos
 */
const KEYWORD_COMPANIONS: Record<string, string[]> = {
  cuchillo: ['plato', 'tabla', 'olla', 'sarten', 'cubierto', 'asado', 'afilador', 'cocina', 'bazar', 'tenedor'],
  cuchillos: ['platos', 'tablas', 'ollas', 'sartenes', 'cubiertos', 'asado', 'afilador', 'cocina', 'bazar'],
  plato: ['cuchillo', 'cubierto', 'taza', 'vaso', 'olla', 'bowl', 'fuente', 'cocina'],
  platos: ['cuchillos', 'cubiertos', 'tazas', 'vasos', 'ollas', 'bowls', 'fuentes', 'cocina'],
  olla: ['sarten', 'cuchillo', 'tapadera', 'espatula', 'bazar', 'cocina', 'bowl'],
  ollas: ['sartenes', 'cuchillos', 'espatulas', 'bazar', 'cocina', 'cacerola'],
  mixer: ['licuadora', 'procesadora', 'batidora', 'bowl', 'cocina', 'vaso', 'recipiente'],
  licuadora: ['mixer', 'procesadora', 'exprimidor', 'vaso', 'cocina', 'botella'],
  termo: ['mate', 'bombilla', 'matero', 'vaso', 'botella', 'termica', 'yerbera'],
  mate: ['termo', 'bombilla', 'yerbera', 'azucarera', 'matero', 'porta mate'],
  brocha: ['maquillaje', 'esponja', 'depiladora', 'belleza', 'facial', 'secador', 'cepillo'],
  brochas: ['maquillaje', 'esponjas', 'depiladora', 'belleza', 'facial', 'secador', 'cepillo'],
  depiladora: ['afeitadora', 'corta pelo', 'facial', 'belleza', 'brocha', 'secador'],
  secador: ['planchita', 'buclera', 'cepillo', 'peine', 'peluqueria', 'belleza'],
  destornillador: ['taladro', 'llave', 'pinza', 'cinta', 'nivel', 'tornillo', 'herramienta', 'bateria'],
  auricular: ['parlante', 'funda', 'cable', 'cargador', 'bluetooth', 'microfono', 'soporte'],
  auriculares: ['parlantes', 'fundas', 'cables', 'cargador', 'bluetooth', 'microfono', 'soporte'],
  parlante: ['auricular', 'microfono', 'cable', 'bluetooth', 'radio', 'sonido'],
  cargador: ['cable', 'adaptador', 'powerbank', 'soporte', 'celular', 'usb', 'tipo c'],
  adaptador: ['cable', 'cargador', 'enchufe', 'zapatilla', 'viajero', 'usb']
};

/**
 * Extracts normalized tokens from a product name/description/tags.
 */
function extractSearchTokens(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !['con', 'para', 'del', 'los', 'las', 'una', 'uno', 'por', 'que', 'set', 'kit', 'und', 'pcs'].includes(t));
}

/**
 * Computes highly relevant, category-matched, and complementary products for a given product.
 */
export function getRelatedAndComplementaryProducts(
  currentProduct: Product,
  allProducts: Product[],
  limit: number = 8
): Product[] {
  if (!currentProduct || !Array.isArray(allProducts) || allProducts.length === 0) {
    return [];
  }

  const currentId = currentProduct.id;
  const currentCatId = (currentProduct.categoryId || '').toLowerCase();
  const currentSubcatId = (currentProduct.subcategoryId || '').toLowerCase();
  const currentTokens = extractSearchTokens(`${currentProduct.name} ${currentProduct.description || ''} ${(currentProduct.tags || []).join(' ')}`);

  // Extract companions keywords based on current product tokens
  const companionKeywords: string[] = [];
  for (const token of currentTokens) {
    if (KEYWORD_COMPANIONS[token]) {
      companionKeywords.push(...KEYWORD_COMPANIONS[token]);
    }
  }

  // Get related category cluster IDs
  const clusterCategories = CATEGORY_CLUSTERS[currentCatId] || [currentCatId];

  // Filter valid candidate pool (exclude current product, exclude hidden)
  const candidatePool = allProducts.filter(p => {
    if (!p || p.id === currentId) return false;
    if (p.stockStatus === 'hidden') return false;
    return true;
  });

  // Score candidate products
  const scoredProducts = candidatePool.map(candidate => {
    let score = 0;
    const candCatId = (candidate.categoryId || '').toLowerCase();
    const candSubcatId = (candidate.subcategoryId || '').toLowerCase();
    const candStock = candidate.stock ?? 0;
    const isInStock = candStock > 0 && candidate.stockStatus !== 'out_of_stock';
    const candTokens = extractSearchTokens(`${candidate.name} ${candidate.description || ''} ${(candidate.tags || []).join(' ')}`);

    // 1. In-stock weight (must strongly favor in-stock products)
    if (isInStock) {
      score += 150;
    } else {
      score -= 500; // Deprioritize out-of-stock
    }

    // 2. Exact same Category match (Top Priority: knives -> pans/plates/cutlery in Bazar/Cocina)
    if (candCatId && candCatId === currentCatId) {
      score += 300;
    } else if (clusterCategories.includes(candCatId)) {
      score += 180;
    }

    // 3. Exact Subcategory match
    if (currentSubcatId && candSubcatId && currentSubcatId === candSubcatId) {
      score += 120;
    }

    // 4. Companion semantic match (e.g. Cuchillo -> Plato / Tabla)
    if (companionKeywords.length > 0) {
      for (const compWord of companionKeywords) {
        if (candTokens.includes(compWord) || candidate.name.toLowerCase().includes(compWord)) {
          score += 160;
        }
      }
    }

    // 5. Direct token overlap (shared keywords between title/description)
    let tokenMatches = 0;
    for (const t of currentTokens) {
      if (candTokens.includes(t)) {
        tokenMatches++;
      }
    }
    score += Math.min(tokenMatches * 35, 140);

    // 6. Tag overlap
    if (currentProduct.tags && candidate.tags) {
      const sharedTags = candidate.tags.filter(t => currentProduct.tags?.includes(t));
      score += sharedTags.length * 25;
    }

    // 7. Freshness & In-Stock New / Restocked boost
    if (candidate.isNew) score += 40;
    if ((candidate as any).isRestocked) score += 45;

    // 8. Deterministic tie-breaker pseudo-randomizer based on candidate ID + current product ID
    // ensures diverse distribution rather than identical static items
    let charHash = 0;
    for (let i = 0; i < candidate.id.length; i++) {
      charHash = (charHash * 31 + candidate.id.charCodeAt(i)) % 100;
    }
    score += (charHash % 25);

    return {
      product: candidate,
      score,
      isInStock,
      isSameCategory: candCatId === currentCatId
    };
  });

  // Sort by score descending
  scoredProducts.sort((a, b) => b.score - a.score);

  // Pick top scoring items
  const result: Product[] = [];
  const pickedIds = new Set<string>();

  for (const item of scoredProducts) {
    if (result.length >= limit) break;
    if (!pickedIds.has(item.product.id)) {
      pickedIds.add(item.product.id);
      result.push(item.product);
    }
  }

  // Fallback if very few products matched (e.g. very small store category)
  if (result.length < limit) {
    const otherInStock = candidatePool.filter(p => !pickedIds.has(p.id) && (p.stock ?? 0) > 0);
    for (const item of otherInStock) {
      if (result.length >= limit) break;
      pickedIds.add(item.id);
      result.push(item);
    }
  }

  return result;
}
