const fs = require("fs");
const path = require("path");

function decodeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#8216;/g, "\x27")
    .replace(/&#8217;/g, "\x27")
    .replace(/&#8220;/g, "\"")
    .replace(/&#8221;/g, "\"")
    .replace(/&#8243;/g, "\"")
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "\x27")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getInovaStock(inv) {
  if (!inv.is_in_stock) return 0;
  if (inv.stock_availability && inv.stock_availability.text) {
    const m = inv.stock_availability.text.match(/(\d+)\s+disponibles/i);
    if (m) return parseInt(m[1], 10);
  }
  if (inv.add_to_cart && typeof inv.add_to_cart.maximum === "number" && inv.add_to_cart.maximum < 9999) {
    return inv.add_to_cart.maximum;
  }
  return 10;
}

function mapInovaCategories(categories) {
  const catNames = (categories || []).map(c => c.name.toLowerCase());
  if (catNames.some(c => c.includes("olla") || c.includes("sarten"))) return { categoryId: "cocina", subcategoryId: "coc-ollas-sartenes", categoryName: "Cocina" };
  if (catNames.some(c => c.includes("cocina"))) return { categoryId: "cocina", subcategoryId: "coc-bazar", categoryName: "Cocina" };
  if (catNames.some(c => c.includes("radio"))) return { categoryId: "audio-y-sonido", subcategoryId: "aud-radios", categoryName: "Audio y Sonido" };
  if (catNames.some(c => c.includes("parlante") || c.includes("audio"))) return { categoryId: "audio-y-sonido", subcategoryId: "aud-parlantes-bt", categoryName: "Audio y Sonido" };
  if (catNames.some(c => c.includes("navidad") || c.includes("decorat"))) return { categoryId: "hogar", subcategoryId: "hog-decoracion", categoryName: "Hogar y Decoración" };
  if (catNames.some(c => c.includes("cama") || c.includes("sabana") || c.includes("manta") || c.includes("invierno"))) return { categoryId: "indumentaria-y-blanqueria", subcategoryId: "ind-sabanas", categoryName: "Blanquería" };
  if (catNames.some(c => c.includes("linterna") || c.includes("iluminaci"))) return { categoryId: "iluminacion", subcategoryId: "ilu-sensor", categoryName: "Iluminación" };
  if (catNames.some(c => c.includes("inform") || c.includes("tv stick"))) return { categoryId: "tecnologia", subcategoryId: "tec-gadgets", categoryName: "Tecnología" };
  if (catNames.some(c => c.includes("jarro") || c.includes("termo") || c.includes("mate") || c.includes("botella"))) return { categoryId: "vasos-y-botellas", subcategoryId: "vas-quencher", categoryName: "Vasos y Botellas" };
  return { categoryId: "productos-varios", subcategoryId: "var-bazar", categoryName: "Productos Varios" };
}

function runSync() {
  console.log("Loading live Inova data...");
  const inova = JSON.parse(fs.readFileSync(path.join(__dirname, "../inova_products_live.json"), "utf8"));
  console.log("Inova live products:", inova.length);

  const initialDataPath = path.join(__dirname, "../src/data/initialData.ts");
  const initialDataContent = fs.readFileSync(initialDataPath, "utf8");

  const startToken = "export const INITIAL_PRODUCTS: Product[] = ";
  const startIndex = initialDataContent.indexOf(startToken);
  const endToken = "\n];\n\nexport const INITIAL_ORDERS";
  const endIndex = initialDataContent.indexOf(endToken, startIndex);

  const prefix = initialDataContent.slice(0, startIndex + startToken.length);
  const suffix = initialDataContent.slice(endIndex + 2); // includes \n];\n\nexport const INITIAL_ORDERS...

  const currentProducts = JSON.parse(initialDataContent.slice(startIndex + startToken.length, endIndex + 2));
  console.log("Current Vondro catalog items:", currentProducts.length);

  const inovaById = new Map();
  const inovaBySku = new Map();
  const inovaBySlug = new Map();
  inova.forEach(p => {
    inovaById.set(p.id.toString(), p);
    inovaBySku.set("ino-" + p.id, p);
    if (p.slug) inovaBySlug.set(p.slug.toLowerCase().trim(), p);
  });

  // 1. Filter existing products: eliminate any with logo or no images on Inova
  const updatedExisting = [];
  let removedBad = 0;

  currentProducts.forEach(p => {
    let inv = null;
    if (p.sku) inv = inovaBySku.get(p.sku.toLowerCase().trim()) || inovaById.get(p.sku.replace(/^INO-?/i, "").trim());
    if (!inv && p.slug) inv = inovaBySlug.get(p.slug.toLowerCase().trim());

    // Bad image conditions
    const hasBadImg = !p.images || p.images.length === 0 || p.images.some(img => 
      img.toLowerCase().includes("logo") ||
      img.toLowerCase().includes("cropped-logo") ||
      img.toLowerCase().includes("placeholder")
    );

    const inovaHasNoImg = inv && (!inv.images || inv.images.length === 0);

    if (hasBadImg || inovaHasNoImg) {
      removedBad++;
      return; // Do not add!
    }

    // Update stock and price with live Inova data
    if (inv) {
      const liveStock = getInovaStock(inv);
      p.stock = liveStock;
      p.stockStatus = liveStock > 0 ? "available" : "out_of_stock";

      if (inv.prices && inv.prices.price) {
        const livePrice = parseInt(inv.prices.price, 10);
        if (livePrice > 0) {
          p.costPrice = livePrice;
          p.salePrice = livePrice;
          p.originalPrice = Math.round((livePrice * 1.35) / 100) * 100;
          p.discountPercentage = Math.round(((p.originalPrice - p.salePrice) / p.originalPrice) * 100);
          
          if (p.tieredPricing && Array.isArray(p.tieredPricing)) {
            p.tieredPricing = [
              { quantity: 3, pricePerUnit: Math.round(livePrice * 0.94), discountPercentage: 6 },
              { quantity: 5, pricePerUnit: Math.round(livePrice * 0.89), discountPercentage: 11 },
              { quantity: 10, pricePerUnit: Math.round(livePrice * 0.82), discountPercentage: 18 }
            ];
          }
        }
      }

      // Filter Inova images: make sure NO logo is present
      const validInovaImgs = (inv.images || []).map(i => i.src).filter(url => !url.toLowerCase().includes("logo"));
      if (validInovaImgs.length > 0) {
        p.images = validInovaImgs;
      }
      p.lastUpdated = "2026-09-22";
    }

    p.name = decodeHtml(p.name);
    // Sanitize branding in descriptions
    if (p.description) {
      p.description = p.description.replace(/inova\s*arg/gi, "VONDRO").replace(/inova/gi, "VONDRO");
    }
    if (Array.isArray(p.shortFeatures)) {
      p.shortFeatures = p.shortFeatures.map(f => f.replace(/inova\s*arg/gi, "VONDRO").replace(/inova/gi, "VONDRO"));
    }

    updatedExisting.push(p);
  });

  console.log("Filtered existing products retained:", updatedExisting.length);
  console.log("Products removed due to missing images or logo:", removedBad);

  // 2. Identify new products from Inova
  const existingSkus = new Set(updatedExisting.map(p => (p.sku || "").toLowerCase().trim()));
  const existingSlugs = new Set(updatedExisting.map(p => (p.slug || "").toLowerCase().trim()));

  const addedNew = [];
  inova.forEach(inv => {
    if (!inv.images || inv.images.length === 0) return;
    const validImgs = inv.images.map(i => i.src).filter(url => !url.toLowerCase().includes("logo"));
    if (validImgs.length === 0) return;

    const sku = "ino-" + inv.id;
    const slug = (inv.slug || "").toLowerCase().trim();
    if (existingSkus.has(sku) || existingSlugs.has(slug)) return;

    const stock = getInovaStock(inv);
    const costPrice = parseInt(inv.prices.price, 10) || 5000;
    const salePrice = costPrice;
    const originalPrice = Math.round((costPrice * 1.35) / 100) * 100;
    const discountPercentage = Math.round(((originalPrice - salePrice) / originalPrice) * 100);
    const cat = mapInovaCategories(inv.categories);
    const cleanName = decodeHtml(inv.name);

    addedNew.push({
      id: "prod-inova-" + slug,
      sku: "INO-" + inv.id,
      name: cleanName,
      slug: slug,
      description: cleanName + " con Garantía y Calidad Oficial VONDRO. Producto importado verificado con disponibilidad para despacho inmediato a Córdoba Capital y envíos a todo el país.",
      shortFeatures: [
        "Categoría: " + cat.categoryName,
        "Garantía y Calidad Oficial VONDRO",
        stock > 0 ? "Stock verificado: " + stock + " unidades" : "Sin stock momentáneo en depósito central",
        "Despacho inmediato a Córdoba Capital"
      ],
      categoryId: cat.categoryId,
      subcategoryId: cat.subcategoryId,
      images: validImgs,
      costPrice: costPrice,
      salePrice: salePrice,
      originalPrice: originalPrice,
      discountPercentage: discountPercentage,
      stock: stock,
      stockStatus: stock > 0 ? "available" : "out_of_stock",
      hideIfOutOfStock: false,
      isFeatured: stock > 50,
      isOnSale: true,
      isNew: true,
      rating: 4.8,
      reviewCount: 14,
      supplier: "Inova ARG",
      supplierProductUrl: inv.permalink,
      lastUpdated: "2026-09-22",
      salesCount: 0,
      unitsSold: 0,
      consultCount: 0,
      addToCartCount: 0,
      promoBadges: stock > 0 ? ["NOVEDAD"] : [],
      tieredPricing: [
        { quantity: 3, pricePerUnit: Math.round(salePrice * 0.94), discountPercentage: 6 },
        { quantity: 5, pricePerUnit: Math.round(salePrice * 0.89), discountPercentage: 11 },
        { quantity: 10, pricePerUnit: Math.round(salePrice * 0.82), discountPercentage: 18 }
      ],
      variants: []
    });
  });

  console.log("Newly added Inova products:", addedNew.length);

  const finalCatalog = [...updatedExisting, ...addedNew];
  console.log("Final total catalog count:", finalCatalog.length);

  // Final check: ensure NO product has 0 images or logo in finalCatalog
  const safetyCheckBad = finalCatalog.filter(p => 
    !p.images || p.images.length === 0 || p.images.some(i => i.toLowerCase().includes("logo"))
  );
  if (safetyCheckBad.length > 0) {
    console.error("FATAL: safety check found bad products:", safetyCheckBad.length);
    process.exit(1);
  }

  console.log("Generating updated initialData.ts file...");
  const newProductsJson = JSON.stringify(finalCatalog, null, 2);
  const updatedFileContent = prefix + newProductsJson + suffix;

  fs.writeFileSync(initialDataPath, updatedFileContent, "utf8");
  console.log("Successfully wrote updated initialData.ts!");
}

runSync();
