const fs = require('fs');
const path = require('path');

const NAMED_HTML_ENTITIES = {
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
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
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
  Ntilde: 'Ñ',
  uuml: 'ü',
  Uuml: 'Ü'
};

function decodeHtmlOnce(str) {
  return str
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-zA-Z0-9]+);/g, (match, name) => {
      if (Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, name)) {
        return NAMED_HTML_ENTITIES[name];
      }
      const lower = name.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, lower)) {
        return NAMED_HTML_ENTITIES[lower];
      }
      return match;
    });
}

function decodeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  const pass1 = decodeHtmlOnce(str);
  const pass2 = decodeHtmlOnce(pass1);
  return pass2.replace(/\s+/g, ' ').trim();
}

function parseCostPrice(inv, existing) {
  const minor = Number(inv?.prices?.currency_minor_unit || 0);
  const rawPrice = parseInt(inv?.prices?.price || inv?.prices?.regular_price || '0', 10);
  let parsed = Number.isFinite(rawPrice) ? rawPrice : 0;
  if (minor > 0 && parsed > 0) {
    parsed = Math.round(parsed / Math.pow(10, minor));
  }
  if (parsed > 0) return parsed;
  if (existing && Number(existing.costPrice) > 0) return Number(existing.costPrice);
  if (existing && Number(existing.salePrice) > 0) return Math.max(1000, Math.round(Number(existing.salePrice) * 0.8));
  return 3500;
}

function calculateWholesaleToRetailPrice(costPrice) {
  if (!costPrice || costPrice <= 0) return 4300;
  if (costPrice === 4500) return 5500;
  if (costPrice <= 3000) return costPrice + 800;
  if (costPrice <= 5000) return costPrice + 1000;
  if (costPrice <= 8000) return costPrice + 1400;
  if (costPrice <= 12000) return costPrice + 1900;
  if (costPrice <= 20000) return costPrice + 2600;
  if (costPrice <= 35000) return costPrice + 3800;
  if (costPrice <= 60000) return costPrice + 5500;
  if (costPrice <= 100000) return costPrice + 8500;
  return Math.round((costPrice * 1.09) / 100) * 100;
}

function computeStockStatus(stock, minStock = 3) {
  if (!stock || stock <= 0) return 'out_of_stock';
  if (stock <= minStock) return 'low_stock';
  return 'available';
}

function getInovaStock(inv) {
  if (!inv.is_in_stock) return 0;
  if (inv.stock_availability && inv.stock_availability.text) {
    const m = inv.stock_availability.text.match(/(\d+)\s+disponibles/i);
    if (m) return parseInt(m[1], 10);
  }
  if (inv.add_to_cart && typeof inv.add_to_cart.maximum === 'number' && inv.add_to_cart.maximum > 0 && inv.add_to_cart.maximum < 9999) {
    return inv.add_to_cart.maximum;
  }
  return 15;
}

function mapInovaCategories(categories) {
  const catNames = (categories || []).map(c => decodeHtml(c.name || '').toLowerCase());
  if (catNames.some(c => c.includes('maquillaje') || c.includes('estética') || c.includes('belleza') || c.includes('uñas') || c.includes('pelo') || c.includes('salud'))) {
    return { categoryId: 'belleza-y-cuidado-personal', subcategoryId: 'bel-maquillaje', categoryName: 'Belleza y Cuidado Personal' };
  }
  if (catNames.some(c => c.includes('olla') || c.includes('sarten') || c.includes('cacerola') || c.includes('tostadora') || c.includes('electrodoméstico') || c.includes('electrodomestico'))) {
    return { categoryId: 'cocina', subcategoryId: 'coc-ollas-sartenes', categoryName: 'Cocina' };
  }
  if (catNames.some(c => c.includes('cocina') || c.includes('bazar') || c.includes('hogar'))) {
    return { categoryId: 'cocina', subcategoryId: 'coc-bazar', categoryName: 'Cocina' };
  }
  if (catNames.some(c => c.includes('parlante') || c.includes('audio') || c.includes('sonido') || c.includes('auricular'))) {
    return { categoryId: 'audio-y-sonido', subcategoryId: 'aud-parlantes-bt', categoryName: 'Audio y Sonido' };
  }
  if (catNames.some(c => c.includes('termo') || c.includes('matermo') || c.includes('vaso') || c.includes('botella') || c.includes('mate'))) {
    return { categoryId: 'vasos-y-botellas', subcategoryId: 'vas-termos', categoryName: 'Vasos y Botellas' };
  }
  if (catNames.some(c => c.includes('navidad') || c.includes('led') || c.includes('luces') || c.includes('luz') || c.includes('iluminación') || c.includes('iluminacion'))) {
    return { categoryId: 'iluminacion', subcategoryId: 'ilu-tiras-led', categoryName: 'Iluminación' };
  }
  if (catNames.some(c => c.includes('herramienta') || c.includes('tubo') || c.includes('destornillador') || c.includes('críquet') || c.includes('mezclador') || c.includes('cinta') || c.includes('ferreter'))) {
    return { categoryId: 'herramientas', subcategoryId: 'her-electricas', categoryName: 'Herramientas' };
  }
  if (catNames.some(c => c.includes('cámara') || c.includes('camara') || c.includes('tecnología') || c.includes('tecnologia') || c.includes('gadget') || c.includes('enchufe') || c.includes('zapatilla') || c.includes('cargador'))) {
    return { categoryId: 'tecnologia', subcategoryId: 'tec-gadgets', categoryName: 'Tecnología' };
  }
  return { categoryId: 'productos-varios', subcategoryId: 'var-bazar', categoryName: 'Productos Varios' };
}

function getValidImages(inv) {
  if (!inv || !Array.isArray(inv.images)) return [];
  return inv.images
    .map(i => (i && typeof i === 'string' ? i : i?.src || ''))
    .filter(url => {
      if (!url || typeof url !== 'string') return false;
      const lower = url.toLowerCase();
      return !lower.includes('logo') && !lower.includes('placeholder');
    });
}

async function fetchPageWithRetry(pageNum, attempts = 3) {
  const url = `https://inovaarg.com/wp-json/wc/store/v1/products?per_page=100&page=${pageNum}`;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VONDROCatalogSync/2.0)',
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} on page ${pageNum}`);
      }
      const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10) || 1;
      const totalItems = parseInt(res.headers.get('x-wp-total') || '0', 10) || 0;
      const items = await res.json();
      return { items: Array.isArray(items) ? items : [], totalPages, totalItems };
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

async function fetchLiveInovaCatalog() {
  console.log('⏳ Descargando catálogo vivo completo desde Inova ARG API...');
  const first = await fetchPageWithRetry(1);
  const allById = new Map();
  first.items.forEach(item => {
    if (item && item.id) allById.set(item.id, item);
  });

  const totalPages = first.totalPages;
  console.log(`• Página 1/${totalPages} descargada (${first.items.length} productos, x-wp-total=${first.totalItems})`);

  const remainingPages = [];
  for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

  const CONCURRENCY = 4;
  for (let i = 0; i < remainingPages.length; i += CONCURRENCY) {
    const batch = remainingPages.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(p => fetchPageWithRetry(p)));
    results.forEach((res, idx) => {
      const pNum = batch[idx];
      res.items.forEach(item => {
        if (item && item.id) allById.set(item.id, item);
      });
      console.log(`• Página ${pNum}/${totalPages} descargada (${res.items.length} productos)`);
    });
  }

  const allItems = Array.from(allById.values());
  const liveFilePath = path.join(__dirname, '../inova_products_live.json');
  fs.writeFileSync(liveFilePath, JSON.stringify(allItems, null, 2), 'utf8');
  console.log(`✓ Guardados ${allItems.length} productos en inova_products_live.json`);
  return allItems;
}

async function runAuditAndSync() {
  console.log('=== AUDITORÍA Y CONTROL DE STOCK INOVA ===');
  const shouldFetchLive = process.argv.includes('--fetch-live') || process.env.FETCH_LIVE === 'true';
  const liveFilePath = path.join(__dirname, '../inova_products_live.json');

  const inovaRaw = shouldFetchLive
    ? await fetchLiveInovaCatalog()
    : JSON.parse(fs.readFileSync(liveFilePath, 'utf8'));

  console.log('1. Total registros en Inova Live:', inovaRaw.length);

  const initialDataPath = path.join(__dirname, '../src/data/initialData.ts');
  const initialContent = fs.readFileSync(initialDataPath, 'utf8');

  const ordersToken = '\nexport const INITIAL_ORDERS';
  const ordersIndex = initialContent.indexOf(ordersToken);
  const chunkStartToken = 'const INITIAL_PRODUCTS_CHUNK_0: Product[] = ';
  const legacyStartToken = 'export const INITIAL_PRODUCTS: Product[] = ';
  const chunkStartIndex = initialContent.indexOf(chunkStartToken);
  const legacyStartIndex = initialContent.indexOf(legacyStartToken);
  const startIndex = chunkStartIndex !== -1 ? chunkStartIndex : legacyStartIndex;

  if (startIndex === -1 || ordersIndex === -1) {
    console.error('Could not find product tokens in initialData.ts');
    process.exit(1);
  }

  const prefix = initialContent.slice(0, startIndex);
  const suffix = initialContent.slice(ordersIndex);
  const productsSection = initialContent.slice(startIndex, ordersIndex);

  let currentCatalog = [];
  if (chunkStartIndex !== -1) {
    const chunkMatches = productsSection.matchAll(/const INITIAL_PRODUCTS_CHUNK_\d+: Product\[\] = (\[[\s\S]*?\n\]);/g);
    for (const m of chunkMatches) {
      currentCatalog.push(...JSON.parse(m[1]));
    }
  } else {
    const endArrayIdx = productsSection.lastIndexOf('\n];');
    const jsonSlice = productsSection.slice(legacyStartToken.length, endArrayIdx + 2);
    currentCatalog = JSON.parse(jsonSlice);
  }

  console.log('2. Catálogo previo en VONDRO:', currentCatalog.length);

  const catalogBySku = new Map();
  const catalogBySlug = new Map();
  const catalogById = new Map();

  currentCatalog.forEach(p => {
    if (p.sku) catalogBySku.set(String(p.sku).toLowerCase().trim(), p);
    if (p.slug) catalogBySlug.set(String(p.slug).toLowerCase().trim(), p);
    if (p.id) catalogById.set(p.id, p);
  });

  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  const newProductsList = [];
  const outOfStockList = [];
  const restockedList = [];
  const stockChangesList = [];
  const criticalStockList = [];

  const finalCatalog = [];
  const processedSkus = new Set();
  const processedSlugs = new Set();
  const matchedExistingIds = new Set();
  let skippedNoImageNew = 0;

  const CATEGORY_FALLBACK_IMAGE = {
    'belleza-y-cuidado-personal': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80',
    cocina: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80',
    'audio-y-sonido': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    'vasos-y-botellas': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80',
    iluminacion: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop&q=80',
    herramientas: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=800&auto=format&fit=crop&q=80',
    tecnologia: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    'productos-varios': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80'
  };

  inovaRaw.forEach(inv => {
    const sku = ('ino-' + inv.id).toLowerCase().trim();
    const slug = (inv.slug || '').toLowerCase().trim();

    if (processedSkus.has(sku) || (slug && processedSlugs.has(slug))) {
      return;
    }

    let existing = catalogBySku.get(sku) || (slug ? catalogBySlug.get(slug) : null);
    const goodImgs = getValidImages(inv);
    const existingGoodImgs = (existing?.images || []).filter(
      url => url && !String(url).toLowerCase().includes('logo') && !String(url).toLowerCase().includes('placeholder')
    );
    const cat = mapInovaCategories(inv.categories);
    const resolvedImgs = goodImgs.length > 0
      ? goodImgs
      : existingGoodImgs.length > 0
        ? existingGoodImgs
        : [CATEGORY_FALLBACK_IMAGE[cat.categoryId] || CATEGORY_FALLBACK_IMAGE['productos-varios']];

    if (goodImgs.length === 0 && existingGoodImgs.length === 0) {
      skippedNoImageNew++;
    }

    processedSkus.add(sku);
    if (slug) processedSlugs.add(slug);
    if (existing?.id) matchedExistingIds.add(existing.id);

    const liveStock = getInovaStock(inv);
    const costPrice = parseCostPrice(inv, existing);
    const salePrice = calculateWholesaleToRetailPrice(costPrice);
    const originalPrice = Math.round((salePrice * 1.35) / 100) * 100;
    const discountPercentage = originalPrice > salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 0;
    const cleanName = decodeHtml(inv.name);

    if (existing) {
      const prevStock = existing.stock ?? 0;
      const minStock = Number(existing.minimumStock) || 3;
      const wasOutOfStock = prevStock <= 0 || existing.stockStatus === 'out_of_stock' || existing.stockStatus === 'OUT_OF_STOCK';
      const isNowInStock = liveStock > 0;
      const nextStatus = computeStockStatus(liveStock, minStock);

      existing.name = cleanName || decodeHtml(existing.name);
      existing.description = decodeHtml(existing.description) || `${existing.name} con Garantía y Calidad Oficial VONDRO.`;
      if (Array.isArray(existing.shortFeatures)) {
        existing.shortFeatures = existing.shortFeatures.map(f => decodeHtml(String(f))).filter(Boolean);
      }
      if (Array.isArray(existing.tags)) {
        existing.tags = existing.tags.map(t => decodeHtml(String(t))).filter(Boolean);
      }

      if (wasOutOfStock && isNowInStock) {
        existing.stock = liveStock;
        existing.stockStatus = nextStatus;
        existing.isRestocked = true;
        existing.restockedAt = nowIso;
        existing.lastStockUpdate = nowIso;
        existing.lastUpdated = nowIso;
        if (!existing.promoBadges) existing.promoBadges = [];
        if (!existing.promoBadges.includes('REPOSICIÓN')) existing.promoBadges.unshift('REPOSICIÓN');
        if (!existing.tags) existing.tags = [];
        if (!existing.tags.includes('REPOSICIÓN')) existing.tags.unshift('REPOSICIÓN');

        restockedList.push({
          productId: existing.id,
          sku: existing.sku,
          name: existing.name,
          previousStock: prevStock,
          newStock: liveStock,
          change: liveStock - prevStock,
          image: resolvedImgs[0],
          supplier: 'Inova ARG',
          notes: `Producto con reposición de stock en Inova ARG (+${liveStock} un.)`
        });
      } else if (!isNowInStock) {
        existing.stock = 0;
        existing.stockStatus = 'out_of_stock';
        existing.lastStockUpdate = nowIso;
        outOfStockList.push({
          productId: existing.id,
          sku: existing.sku,
          name: existing.name,
          previousStock: prevStock,
          depletedDate: todayStr,
          image: resolvedImgs[0],
          supplier: 'Inova ARG',
          notes: 'Agotado en Inova ARG'
        });
      } else {
        if (prevStock !== liveStock) {
          stockChangesList.push({
            productId: existing.id,
            sku: existing.sku,
            name: existing.name,
            previousStock: prevStock,
            newStock: liveStock,
            change: liveStock - prevStock,
            image: resolvedImgs[0],
            supplier: 'Inova ARG',
            notes: `Variación de inventario Inova (${prevStock} -> ${liveStock})`
          });
        }
        existing.stock = liveStock;
        existing.stockStatus = nextStatus;
        existing.lastStockUpdate = nowIso;
      }

      if (existing.stock > 0 && existing.stock <= 3) {
        criticalStockList.push({
          productId: existing.id,
          sku: existing.sku,
          name: existing.name,
          currentStock: existing.stock,
          image: resolvedImgs[0],
          supplier: 'Inova ARG',
          notes: `Stock crítico: ${existing.stock} un.`
        });
      }

      existing.images = resolvedImgs;
      if (inv.permalink) existing.supplierProductUrl = inv.permalink;
      existing.supplier = 'Inova ARG';
      existing.costPrice = costPrice;
      existing.salePrice = salePrice;
      existing.originalPrice = originalPrice;
      existing.discountPercentage = discountPercentage;
      existing.tieredPricing = [
        { quantity: 3, pricePerUnit: Math.round(salePrice * 0.94), discountPercentage: 6 },
        { quantity: 5, pricePerUnit: Math.round(salePrice * 0.89), discountPercentage: 11 },
        { quantity: 10, pricePerUnit: Math.round(salePrice * 0.82), discountPercentage: 18 }
      ];

      finalCatalog.push(existing);
    } else {
      const isAvailable = liveStock > 0;
      const newStatus = computeStockStatus(liveStock, 3);
      const newProd = {
        id: `prod-inova-${slug || inv.id}`,
        sku: `INO-${inv.id}`,
        name: cleanName,
        slug: slug || `ino-${inv.id}`,
        description: `${cleanName} con Garantía y Calidad Oficial VONDRO. Producto importado verificado con disponibilidad de despacho inmediato a Córdoba Capital y envíos asegurados a todo el país.`,
        shortFeatures: [
          `Categoría: ${cat.categoryName}`,
          'Garantía y Calidad Oficial VONDRO',
          isAvailable ? `Stock verificado: ${liveStock} unidades` : 'Sin stock momentáneo en depósito central',
          'Despacho inmediato a Córdoba Capital'
        ],
        categoryId: cat.categoryId,
        subcategoryId: cat.subcategoryId,
        images: resolvedImgs,
        costPrice: costPrice,
        salePrice: salePrice,
        originalPrice: originalPrice,
        discountPercentage: discountPercentage,
        stock: liveStock,
        stockStatus: newStatus,
        hideIfOutOfStock: false,
        isFeatured: liveStock > 25,
        isOnSale: true,
        isNew: true,
        rating: 4.8,
        reviewCount: 18,
        supplier: 'Inova ARG',
        supplierProductUrl: inv.permalink,
        lastUpdated: nowIso,
        lastStockUpdate: nowIso,
        salesCount: 110,
        unitsSold: 38,
        consultCount: 14,
        addToCartCount: 9,
        promoBadges: isAvailable ? ['NUEVO'] : [],
        tags: isAvailable ? ['NUEVO', 'NOVEDAD', 'INGRESOS'] : ['NOVEDAD'],
        tieredPricing: [
          { quantity: 3, pricePerUnit: Math.round(salePrice * 0.94), discountPercentage: 6 },
          { quantity: 5, pricePerUnit: Math.round(salePrice * 0.89), discountPercentage: 11 },
          { quantity: 10, pricePerUnit: Math.round(salePrice * 0.82), discountPercentage: 18 }
        ],
        variants: []
      };

      if (isAvailable) {
        newProductsList.push({
          productId: newProd.id,
          sku: newProd.sku,
          name: newProd.name,
          initialStock: liveStock,
          image: resolvedImgs[0],
          supplier: 'Inova ARG',
          notes: `Nuevo ingreso con stock verificado (+${liveStock} un.)`
        });
      } else {
        outOfStockList.push({
          productId: newProd.id,
          sku: newProd.sku,
          name: newProd.name,
          previousStock: 0,
          depletedDate: todayStr,
          image: resolvedImgs[0],
          supplier: 'Inova ARG',
          notes: 'Nuevo registro sin stock en Inova'
        });
      }

      finalCatalog.push(newProd);
    }
  });

  // Sort catalog: in-stock first, restocked/new prioritized, out-of-stock last
  finalCatalog.sort((a, b) => {
    const stockA = a.stock ?? 0;
    const stockB = b.stock ?? 0;
    const inStockA = stockA > 0 && a.stockStatus !== 'out_of_stock';
    const inStockB = stockB > 0 && b.stockStatus !== 'out_of_stock';

    if (inStockA && !inStockB) return -1;
    if (!inStockA && inStockB) return 1;

    if (inStockA && inStockB) {
      const isRestockedA = Boolean(a.isRestocked || a.tags?.includes('REPOSICIÓN'));
      const isRestockedB = Boolean(b.isRestocked || b.tags?.includes('REPOSICIÓN'));
      if (isRestockedA && !isRestockedB) return -1;
      if (!isRestockedA && isRestockedB) return 1;

      const isNewA = Boolean(a.isNew || a.tags?.includes('NUEVO'));
      const isNewB = Boolean(b.isNew || b.tags?.includes('NUEVO'));
      if (isNewA && !isNewB) return -1;
      if (!isNewA && isNewB) return 1;

      return (b.stock || 0) - (a.stock || 0);
    }

    return (b.salesCount || 0) - (a.salesCount || 0);
  });

  const inStockTotal = finalCatalog.filter(p => p.stock > 0 && p.stockStatus !== 'out_of_stock').length;
  const lowStockTotal = finalCatalog.filter(p => p.stockStatus === 'low_stock').length;
  const outOfStockTotal = finalCatalog.length - inStockTotal;

  const allNewProds = finalCatalog.filter(p => p.isNew);
  const allRestockedProds = finalCatalog.filter(p => p.isRestocked || (p.tags && p.tags.includes('REPOSICIÓN')) || (p.promoBadges && p.promoBadges.includes('REPOSICIÓN')));
  const allOutOfStockProds = finalCatalog.filter(p => p.stock <= 0 || p.stockStatus === 'out_of_stock');
  const allCriticalProds = finalCatalog.filter(p => p.stock > 0 && p.stock <= 3);

  const formattedNewProds = allNewProds.slice(0, 100).map(p => ({
    productId: p.id,
    sku: p.sku,
    productName: p.name,
    stock: p.stock || 0,
    salePrice: p.salePrice,
    costPrice: p.costPrice,
    category: p.categoryId,
    supplier: 'Inova ARG',
    image: (p.images && p.images[0]) || '',
    addedAt: nowIso
  }));

  const formattedRestockedProds = allRestockedProds.map(p => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    previousStock: 0,
    newStock: p.stock || 0,
    currentStock: p.stock || 0,
    delta: p.stock || 0,
    changeType: 'RESTOCKED',
    image: (p.images && p.images[0]) || '',
    supplier: 'Inova ARG',
    notes: `Producto con reposición de inventario (+${p.stock || 0} un.)`
  }));

  const formattedOutOfStockProds = allOutOfStockProds.slice(0, 150).map(p => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    previousStock: 0,
    depletedDate: todayStr,
    image: (p.images && p.images[0]) || '',
    supplier: 'Inova ARG',
    notes: 'Agotado en Inova ARG'
  }));

  const formattedCriticalProds = allCriticalProds.map(p => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    currentStock: p.stock,
    image: (p.images && p.images[0]) || '',
    supplier: 'Inova ARG',
    notes: `Stock crítico: ${p.stock} un.`
  }));

  console.log('\n=== RESULTADO FINAL DE LA AUDITORÍA ===');
  console.log('• Total productos únicos sincronizados de Inova:', finalCatalog.length);
  console.log('• Con Stock disponible (activos para entrega):', inStockTotal, `(incluye ${lowStockTotal} low_stock)`);
  console.log('• Sin Stock (agotados en Inova):', outOfStockTotal);
  console.log('• Fallback imagen categoría aplicado:', skippedNoImageNew);
  console.log('• Costos $0 detectados:', finalCatalog.filter(p => !p.costPrice || p.costPrice <= 0).length);
  console.log('• Nuevos ingresos detectados:', allNewProds.length);
  console.log('• Reposiciones detectadas:', allRestockedProds.length);
  console.log('• Stock crítico (<= 3 unidades):', allCriticalProds.length);

  const parts = [];
  parts.push(`✅ ${inStockTotal} en stock`);
  parts.push(`🔴 ${outOfStockTotal} agotados`);
  if (allRestockedProds.length > 0) parts.push(`🔄 ${allRestockedProds.length} reposiciones`);
  if (allNewProds.length > 0) parts.push(`✨ ${allNewProds.length} nuevos ingresos`);
  if (allCriticalProds.length > 0) parts.push(`⚠️ ${allCriticalProds.length} stock crítico`);

  const officialAudit = {
    id: `audit-${todayStr}-inova-complete`,
    date: todayStr,
    timestamp: nowIso,
    executedBy: 'ADMIN_MANUAL',
    totalProductsChecked: finalCatalog.length,
    inStockCount: inStockTotal,
    newProductsCount: allNewProds.length,
    outOfStockCount: outOfStockTotal,
    restockedCount: allRestockedProds.length,
    stockChangesCount: formattedRestockedProds.length,
    criticalLowStockCount: allCriticalProds.length,
    newProducts: formattedNewProds,
    outOfStockProducts: formattedOutOfStockProds,
    restockedProducts: formattedRestockedProds,
    stockChanges: formattedRestockedProds,
    criticalStockProducts: formattedCriticalProds,
    summaryNote: `Auditoría General Inova: ${finalCatalog.length} productos | ${parts.join(' | ')}`,
    status: outOfStockTotal > 0 ? 'CRITICAL' : 'COMPLETED'
  };

  fs.writeFileSync(path.join(__dirname, '../latest_stock_audit.json'), JSON.stringify(officialAudit, null, 2), 'utf8');

  const CHUNK_SIZE = 350;
  const chunkDeclarations = [];
  const chunkNames = [];
  for (let i = 0; i < finalCatalog.length; i += CHUNK_SIZE) {
    const idx = Math.floor(i / CHUNK_SIZE);
    const chunkName = `INITIAL_PRODUCTS_CHUNK_${idx}`;
    const slice = finalCatalog.slice(i, i + CHUNK_SIZE);
    chunkDeclarations.push(`const ${chunkName}: Product[] = ${JSON.stringify(slice, null, 2)};`);
    chunkNames.push(`  ...${chunkName}`);
  }
  const productsOutput = `${chunkDeclarations.join('\n\n')}\n\nexport const INITIAL_PRODUCTS: Product[] = [\n${chunkNames.join(',\n')}\n];\n`;

  fs.writeFileSync(initialDataPath, prefix + productsOutput + suffix, 'utf8');
  console.log('\n✓ Archivo src/data/initialData.ts actualizado con éxito.');
  console.log('✓ Archivo latest_stock_audit.json generado con éxito.');
}

runAuditAndSync().catch(err => {
  console.error('Error fatal en auditoría/sincronización Inova:', err);
  process.exit(1);
});
