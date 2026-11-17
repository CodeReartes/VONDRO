import { Product } from '../types';
import { cleanBrandingText } from './brandingSanitizer';

/**
 * Deterministic integer hash from string to ensure stable, repeatable values per product.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Calculates a natural, realistic, and varied discount distribution across the catalog
 * so that users do not see repetitive "-26%" on every card.
 */
export function getVariedDiscountForProduct(product: Product): { discountPercentage: number; originalPrice?: number } {
  if (!product || typeof product.salePrice !== 'number' || product.salePrice <= 0) {
    return { discountPercentage: 0, originalPrice: undefined };
  }

  const hashKey = `${product.id}-${product.sku || ''}-${product.categoryId || ''}`;
  const hash = hashString(hashKey);

  let targetDiscount = 0;
  const isLowStock = product.stock > 0 && product.stock <= 6;
  const isFlash = product.isFlashSale || product.promoBadges?.includes('OFERTA_RELAMPAGO') || isLowStock;

  if (product.stock > 0 && product.stock <= 2) {
    // Ultra clearance deals for last 1-2 units (35% to 50% OFF)
    const clearanceOptions = [35, 38, 40, 42, 45, 48, 50];
    targetDiscount = clearanceOptions[hash % clearanceOptions.length];
  } else if (product.stock > 2 && product.stock <= 6) {
    // Low stock clearance (25% to 35% OFF)
    const lowStockOptions = [25, 28, 30, 32, 35];
    targetDiscount = lowStockOptions[hash % lowStockOptions.length];
  } else if (isFlash) {
    // Flash Sale active options (22% to 45% OFF)
    const flashOptions = [22, 25, 28, 30, 32, 35, 38, 40, 45];
    targetDiscount = flashOptions[hash % flashOptions.length];
  } else {
    // Standard catalog varied distribution:
    const roll = hash % 100;
    if (roll < 12) {
      // 12% of items have NO discount (regular clean price / new arrival)
      targetDiscount = 0;
    } else if (roll < 28) {
      // 16% of items have light discount (8% - 15%)
      const lightOptions = [8, 10, 12, 14, 15];
      targetDiscount = lightOptions[hash % lightOptions.length];
    } else if (roll < 58) {
      // 30% of items have moderate discount (18% - 25%)
      const modOptions = [18, 20, 22, 24, 25];
      targetDiscount = modOptions[hash % modOptions.length];
    } else if (roll < 86) {
      // 28% of items have great promo discount (28% - 38%)
      const promoOptions = [28, 30, 32, 34, 35, 38];
      targetDiscount = promoOptions[hash % promoOptions.length];
    } else {
      // 14% of items have super bargain deal (40% - 50%)
      const superOptions = [40, 42, 45, 48, 50];
      targetDiscount = superOptions[hash % superOptions.length];
    }
  }

  if (targetDiscount <= 0) {
    return {
      discountPercentage: 0,
      originalPrice: undefined
    };
  }

  // Calculate matching clean strikethrough originalPrice
  const rawOriginal = product.salePrice / (1 - targetDiscount / 100);
  const step = rawOriginal >= 10000 ? 100 : 50;
  const originalPrice = Math.round(rawOriginal / step) * step;

  // Recalculate true discount percentage based on rounded originalPrice
  const discountPercentage = Math.max(1, Math.round(((originalPrice - product.salePrice) / originalPrice) * 100));

  return {
    discountPercentage,
    originalPrice
  };
}

/**
 * Calculates a wholesale-to-retail sale price with competitive low margins (Temu/China model),
 * ensuring the store covers packaging, admin expenses, and customer acquisition while staying ultra-affordable.
 * e.g. Cost $4.500 -> Sale $5.500 (+$1.000 profit).
 */
export function calculateWholesaleToRetailPrice(costPrice: number): number {
  if (!costPrice || costPrice <= 0) return 1000;
  
  // Specific user requested anchor: $4.500 cost -> $5.500 sale
  if (costPrice === 4500) return 5500;

  let markupRate = 0.2222;
  if (costPrice <= 2500) {
    markupRate = 0.28;
  } else if (costPrice <= 5500) {
    markupRate = 0.2222;
  } else if (costPrice <= 15000) {
    markupRate = 0.20;
  } else if (costPrice <= 30000) {
    markupRate = 0.18;
  } else if (costPrice <= 60000) {
    markupRate = 0.16;
  } else {
    markupRate = 0.14;
  }

  const rawSale = costPrice * (1 + markupRate);
  let step = 50;
  if (rawSale >= 15000) step = 100;
  if (rawSale >= 50000) step = 500;

  return Math.round(rawSale / step) * step;
}

/**
 * Sanitizes a product object ensuring its discount and originalPrice are realistic, varied,
 * and mathematically synchronized. Also ensures salePrice has a healthy margin over costPrice.
 */
export function normalizeProductPricing(product: Product): Product {
  if (!product) return product;

  // Clean branding on description and tags
  const cleanDesc = product.description ? cleanBrandingText(product.description) : product.description;
  const cleanTags = Array.isArray(product.tags) 
    ? product.tags.map(t => cleanBrandingText(t)) 
    : product.tags;

  // Ensure costPrice is set
  const cost = product.costPrice || (product.salePrice ? Math.round(product.salePrice * 0.8) : 4500);

  // If salePrice is missing, equal to cost, or lower than cost (0% profit), apply competitive retail price
  let salePrice = product.salePrice;
  if (!salePrice || salePrice <= cost || (product.costPrice && salePrice === product.costPrice)) {
    salePrice = calculateWholesaleToRetailPrice(cost);
  }

  const productWithCleanPrice: Product = {
    ...product,
    costPrice: cost,
    salePrice: salePrice,
    description: cleanDesc,
    tags: cleanTags
  };

  // If the product has a legacy uniform 26% discount or is missing originalPrice,
  // apply the rich varied discount model.
  const hasUniform26 = productWithCleanPrice.discountPercentage === 26 || (productWithCleanPrice.discountPercentage === undefined && productWithCleanPrice.originalPrice !== undefined);
  
  if (hasUniform26 || productWithCleanPrice.discountPercentage === undefined || !productWithCleanPrice.originalPrice || productWithCleanPrice.originalPrice <= productWithCleanPrice.salePrice) {
    const varied = getVariedDiscountForProduct(productWithCleanPrice);
    return {
      ...productWithCleanPrice,
      discountPercentage: varied.discountPercentage,
      originalPrice: varied.originalPrice || Math.round((salePrice * 1.35) / 100) * 100
    };
  }

  // If product already has an explicit custom discount, ensure originalPrice is consistent
  if (productWithCleanPrice.discountPercentage && productWithCleanPrice.discountPercentage > 0) {
    if (!productWithCleanPrice.originalPrice || productWithCleanPrice.originalPrice <= productWithCleanPrice.salePrice) {
      const rawOriginal = productWithCleanPrice.salePrice / (1 - productWithCleanPrice.discountPercentage / 100);
      const step = rawOriginal >= 10000 ? 100 : 50;
      const originalPrice = Math.round(rawOriginal / step) * step;
      return {
        ...productWithCleanPrice,
        originalPrice
      };
    }
  }

  return productWithCleanPrice;
}

/**
 * Batch normalizes a list of products with varied discounts.
 */
export function normalizeProductsPricingList(products: Product[]): Product[] {
  if (!Array.isArray(products)) return [];
  return products.map(normalizeProductPricing);
}
