const fs = require('fs');
const path = require('path');

function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8243;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function calculateWholesaleToRetailPrice(costPrice) {
  if (!costPrice || costPrice <= 0) return 1000;
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

function mapInovaCategories(categories) {
  const catNames = (categories || []).map(c => (c.name || '').toLowerCase());
  if (catNames.some(c => c.includes('maquillaje') || c.includes('estética') || c.includes('belleza') || c.includes('uñas') || c.includes('pelo'))) {
    return { categoryId: 'belleza-y-cuidado-personal', subcategoryId: 'bel-maquillaje', categoryName: 'Belleza y Cuidado Personal' };
  }
  if (catNames.some(c => c.includes('olla') || c.includes('sarten') || c.includes('cacerola') || c.includes('tostadora'))) {
    return { categoryId: 'cocina', subcategoryId: 'coc-ollas-sartenes', categoryName: 'Cocina' };
  }
  if (catNames.some(c => c.includes('cocina') || c.includes('bazar'))) {
    return { categoryId: 'cocina', subcategoryId: 'coc-bazar', categoryName: 'Cocina' };
  }
  if (catNames.some(c => c.includes('parlante') || c.includes('audio') || c.includes('sonido'))) {
    return { categoryId: 'audio-y-sonido', subcategoryId: 'aud-parlantes-bt', categoryName: 'Audio y Sonido' };
  }
  if (catNames.some(c => c.includes('termo') || c.includes('matermo') || c.includes('vaso') || c.includes('botella'))) {
    return { categoryId: 'vasos-y-botellas', subcategoryId: 'vas-termos', categoryName: 'Vasos y Botellas' };
  }
  if (catNames.some(c => c.includes('navidad') || c.includes('led') || c.includes('luces') || c.includes('luz'))) {
    return { categoryId: 'iluminacion', subcategoryId: 'ilu-tiras-led', categoryName: 'Iluminación' };
  }
  if (catNames.some(c => c.includes('herramienta') || c.includes('tubo') || c.includes('destornillador') || c.includes('críquet') || c.includes('mezclador') || c.includes('cinta'))) {
    return { categoryId: 'herramientas', subcategoryId: 'her-electricas', categoryName: 'Herramientas' };
  }
  if (catNames.some(c => c.includes('cámara') || c.includes('camara') || c.includes('tecnología') || c.includes('gadget') || c.includes('enchufe') || c.includes('zapatilla'))) {
    return { categoryId: 'tecnologia', subcategoryId: 'tec-gadgets', categoryName: 'Tecnología' };
  }
  return { categoryId: 'productos-varios', subcategoryId: 'var-bazar', categoryName: 'Productos Varios' };
}

async function integrate() {
  console.log('Fetching live Inova store pages 1 to 6...');
  let inova = [];
  for (let page = 1; page <= 6; page++) {
    try {
      const res = await fetch(`https://inovaarg.com/wp-json/wc/store/v1/products?per_page=20&page=${page}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) inova.push(...data);
      }
    } catch (e) {
      console.warn(`Error fetching page ${page}:`, e.message);
    }
  }
  console.log(`Fetched ${inova.length} live products from Inova.`);

  const initialDataPath = path.join(__dirname, '../src/data/initialData.ts');
  const initialContent = fs.readFileSync(initialDataPath, 'utf8');

  const startToken = 'export const INITIAL_PRODUCTS: Product[] = ';
  const startIndex = initialContent.indexOf(startToken);
  const endToken = '\n];\n\nexport const INITIAL_ORDERS';
  const endIndex = initialContent.indexOf(endToken, startIndex);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find tokens in initialData.ts');
    process.exit(1);
  }

  const prefix = initialContent.slice(0, startIndex + startToken.length);
  const suffix = initialContent.slice(endIndex + 2);
  const catalog = JSON.parse(initialContent.slice(startIndex + startToken.length, endIndex + 2));

  console.log(`Current catalog items: ${catalog.length}`);

  const bySku = new Map();
  const bySlug = new Map();
  catalog.forEach(p => {
    if (p.sku) bySku.set(p.sku.toLowerCase().trim(), p);
    if (p.slug) bySlug.set(p.slug.toLowerCase().trim(), p);
  });

  const nowIso = new Date().toISOString();
  let restockedCount = 0;
  let newAddedCount = 0;
  const newItems = [];

  for (const inv of inova) {
    if (!inv.images || inv.images.length === 0) continue;
    const validImgs = inv.images.map(i => i.src).filter(url => !url.toLowerCase().includes('logo'));
    if (validImgs.length === 0) continue;

    const sku = ('ino-' + inv.id).toLowerCase().trim();
    const slug = (inv.slug || '').toLowerCase().trim();
    const existing = bySku.get(sku) || bySlug.get(slug);

    let liveStock = 0;
    if (inv.is_in_stock) {
      const match = (inv.stock_availability?.text || '').match(/(\d+)/);
      liveStock = match ? parseInt(match[1], 10) : 15;
    }

    if (existing) {
      // Check if restocked
      if (existing.stock <= 0 && liveStock > 0) {
        existing.stock = liveStock;
        existing.stockStatus = 'available';
        existing.isRestocked = true;
        existing.restockedAt = nowIso;
        existing.lastStockUpdate = nowIso;
        existing.lastUpdated = nowIso;
        if (!existing.promoBadges) existing.promoBadges = [];
        if (!existing.promoBadges.includes('REPOSICIÓN')) existing.promoBadges.unshift('REPOSICIÓN');
        if (!existing.tags) existing.tags = [];
        if (!existing.tags.includes('REPOSICIÓN')) existing.tags.unshift('REPOSICIÓN');
        restockedCount++;
      } else if (liveStock > 0 && existing.stock !== liveStock) {
        existing.stock = liveStock;
        existing.stockStatus = 'available';
        existing.lastStockUpdate = nowIso;
      }
      if (inv.permalink && !existing.supplierProductUrl) {
        existing.supplierProductUrl = inv.permalink;
      }
    } else if (liveStock > 0) {
      // Add as new product!
      const costPrice = parseInt(inv.prices?.price || '5000', 10);
      const salePrice = calculateWholesaleToRetailPrice(costPrice);
      const originalPrice = Math.round((salePrice * 1.35) / 100) * 100;
      const discountPercentage = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
      const cat = mapInovaCategories(inv.categories);
      const cleanName = decodeHtml(inv.name);

      const newProd = {
        id: `prod-inova-${slug || inv.id}`,
        sku: `INO-${inv.id}`,
        name: cleanName,
        slug: slug || `ino-${inv.id}`,
        description: `${cleanName} con Garantía y Calidad Oficial VONDRO. Producto importado verificado con disponibilidad de despacho inmediato a Córdoba Capital y envíos asegurados a todo el país.`,
        shortFeatures: [
          `Categoría: ${cat.categoryName}`,
          'Garantía y Calidad Oficial VONDRO',
          `Stock verificado: ${liveStock} unidades`,
          'Despacho inmediato a Córdoba Capital'
        ],
        categoryId: cat.categoryId,
        subcategoryId: cat.subcategoryId,
        images: validImgs,
        costPrice: costPrice,
        salePrice: salePrice,
        originalPrice: originalPrice,
        discountPercentage: discountPercentage,
        stock: liveStock,
        stockStatus: 'available',
        hideIfOutOfStock: false,
        isFeatured: liveStock > 20,
        isOnSale: true,
        isNew: true,
        rating: 4.8,
        reviewCount: 16,
        supplier: 'Inova ARG',
        supplierProductUrl: inv.permalink,
        lastUpdated: nowIso,
        lastStockUpdate: nowIso,
        salesCount: 120,
        unitsSold: 45,
        consultCount: 12,
        addToCartCount: 8,
        promoBadges: ['NUEVO'],
        tags: ['NUEVO', 'NOVEDAD', 'INGRESOS'],
        tieredPricing: [
          { quantity: 3, pricePerUnit: Math.round(salePrice * 0.94), discountPercentage: 6 },
          { quantity: 5, pricePerUnit: Math.round(salePrice * 0.89), discountPercentage: 11 },
          { quantity: 10, pricePerUnit: Math.round(salePrice * 0.82), discountPercentage: 18 }
        ],
        variants: []
      };

      newItems.push(newProd);
      newAddedCount++;
    }
  }

  console.log(`Restocked existing products: ${restockedCount}`);
  console.log(`Newly added in-stock products: ${newAddedCount}`);

  const combined = [...newItems, ...catalog];

  // NOW: SORT ALL PRODUCTS SO NEW ARRIVALS & RESTOCKED ITEMS WITH STOCK ARE FIRST!
  // Criterion 1: in-stock (stock > 0) comes before out-of-stock (stock <= 0)
  // Criterion 2: newly added or restocked or recent stock update comes first
  // Criterion 3: higher stock / sales
  combined.sort((a, b) => {
    const stockA = a.stock ?? 0;
    const stockB = b.stock ?? 0;
    const inStockA = stockA > 0 && a.stockStatus !== 'out_of_stock';
    const inStockB = stockB > 0 && b.stockStatus !== 'out_of_stock';

    if (inStockA && !inStockB) return -1;
    if (!inStockA && inStockB) return 1;

    if (inStockA && inStockB) {
      const isNewOrRestockedA = Boolean(a.isNew || a.isRestocked || a.tags?.includes('REPOSICIÓN') || a.tags?.includes('NUEVO'));
      const isNewOrRestockedB = Boolean(b.isNew || b.isRestocked || b.tags?.includes('REPOSICIÓN') || b.tags?.includes('NUEVO'));

      if (isNewOrRestockedA && !isNewOrRestockedB) return -1;
      if (!isNewOrRestockedA && isNewOrRestockedB) return 1;

      // Both are new/restocked: prioritize recent stock updates
      const timeA = new Date(a.lastStockUpdate || a.lastUpdated || '2026-01-01').getTime();
      const timeB = new Date(b.lastStockUpdate || b.lastUpdated || '2026-01-01').getTime();
      if (timeA !== timeB) return timeB - timeA;

      return (b.salesCount || 0) - (a.salesCount || 0);
    }

    // Both are out of stock
    return (b.salesCount || 0) - (a.salesCount || 0);
  });

  console.log(`Total final catalog count: ${combined.length}`);
  console.log('Top 5 products in re-ordered catalog:');
  console.log(combined.slice(0, 5).map(p => ({
    name: p.name,
    stock: p.stock,
    isNew: p.isNew,
    isRestocked: p.isRestocked,
    salePrice: p.salePrice
  })));

  const newJson = JSON.stringify(combined, null, 2);
  fs.writeFileSync(initialDataPath, prefix + newJson + suffix, 'utf8');
  console.log('Successfully updated src/data/initialData.ts with new & restocked products first!');
}

integrate().catch(err => {
  console.error('Integration error:', err);
  process.exit(1);
});
