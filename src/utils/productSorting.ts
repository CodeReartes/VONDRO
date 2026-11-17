import { Product } from '../types';

/**
 * Determines whether a product is considered a "New Arrival" or "Recently Restocked".
 */
export function isProductNewOrRestocked(product: Product): boolean {
  if (!product || (product.stock ?? 0) <= 0) return false;
  if (product.stockStatus === 'out_of_stock' || product.stockStatus === 'hidden') return false;

  if (product.isNew) return true;
  if ((product as any).isRestocked) return true;
  if (product.promoBadges?.includes('NOVEDAD' as any) || product.promoBadges?.includes('REPOSICION' as any)) return true;
  if (product.tags?.some(t => {
    const norm = t.toUpperCase();
    return norm.includes('NUEVO') || norm.includes('REPOSIC') || norm.includes('INGRESO');
  })) return true;

  if (product.lastStockUpdate) {
    const diffDays = (Date.now() - new Date(product.lastStockUpdate).getTime()) / (1000 * 60 * 60 * 24);
    if (!isNaN(diffDays) && diffDays <= 14) return true;
  }

  return false;
}

/**
 * Calculates a sorting priority score for catalog listing.
 * Higher score appears first:
 * - In-stock newly uploaded products (createdAt / isNew): 80,000 - 100,000+
 * - In-stock restocked & promo new arrivals: 20,000 - 45,000
 * - In-stock standard active products: 1,000 - 5,000
 * - Out of stock items: -10,000 (sent to the bottom)
 */
export function getProductPriorityScore(product: Product): number {
  if (!product) return -99999;

  const stock = product.stock ?? 0;
  const isOut = stock <= 0 || product.stockStatus === 'out_of_stock';

  if (isOut) {
    // Out of stock goes to the bottom
    return -10000 + (product.salesCount || 0);
  }

  let score = 2000;

  // 1. Newly uploaded products (explicit createdAt timestamp) get absolute top tier
  if (product.createdAt) {
    const createdTime = new Date(product.createdAt).getTime();
    if (!isNaN(createdTime) && createdTime > 0) {
      const daysAgo = Math.max(0, (Date.now() - createdTime) / (1000 * 60 * 60 * 24));
      if (daysAgo <= 45) {
        // Boost up to 100,000 points so newest uploads strictly lead search and category feeds
        score += 80000 + Math.max(0, 20000 - daysAgo * 400);
      }
    }
  }

  // New arrivals flag with available stock
  if (product.isNew) {
    score += 25000;
  }

  // Restocked items get top tier
  if ((product as any).isRestocked) {
    score += 20000;
  }

  // Promo badges or tags for new/restock
  if (product.promoBadges?.includes('NOVEDAD' as any) || product.promoBadges?.includes('REPOSICION' as any)) {
    score += 10000;
  }
  if (product.tags?.some(t => t.toUpperCase().includes('NUEVO') || t.toUpperCase().includes('REPOSIC') || t.toUpperCase().includes('INGRESO'))) {
    score += 8000;
  }

  // Recency bonus from lastStockUpdate or lastUpdated
  if (product.lastStockUpdate) {
    const updateTime = new Date(product.lastStockUpdate).getTime();
    if (!isNaN(updateTime)) {
      const hoursAgo = Math.max(0, (Date.now() - updateTime) / (1000 * 60 * 60));
      // Boost up to 3000 points depending on how recent
      score += Math.max(0, 3000 - hoursAgo * 5);
    }
  }

  // Boost for healthy stock
  if (stock >= 10) {
    score += 300;
  } else if (stock > 0) {
    score += 150;
  }

  // Modest influence of popularity & rating
  score += Math.min(500, (product.salesCount || 0) * 2);
  score += Math.min(200, (product.rating || 4.5) * 40);

  return score;
}

/**
 * Sorts an array of products placing new arrivals, restocked items,
 * and recently updated in-stock items first, and out-of-stock items at the end.
 */
export function sortProductsWithNewAndRestockedFirst(products: Product[]): Product[] {
  if (!Array.isArray(products) || products.length === 0) return [];

  return [...products].sort((a, b) => {
    const scoreA = getProductPriorityScore(a);
    const scoreB = getProductPriorityScore(b);
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    // If scores are tied, sort strictly by createdAt descending (newest uploads first)
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return (b.salesCount || 0) - (a.salesCount || 0);
  });
}

/**
 * Extracts the top new arrivals and restocked items that have stock available.
 */
export function getNewArrivalsAndRestockedProducts(products: Product[], limit: number = 20): Product[] {
  if (!Array.isArray(products) || products.length === 0) return [];

  const candidates = products.filter(p => isProductNewOrRestocked(p) && (p.stock ?? 0) > 0);
  const sorted = sortProductsWithNewAndRestockedFirst(candidates);
  return sorted.slice(0, limit);
}

export type ProductBadgeInfo = 
  | { type: 'NEW'; label: string; bgClass: string; textClass: string }
  | { type: 'RESTOCKED'; label: string; bgClass: string; textClass: string }
  | { type: 'UPDATED_STOCK'; label: string; bgClass: string; textClass: string }
  | null;

/**
 * Returns the badge metadata to display on product cards for new / restocked items.
 */
export function getProductStatusBadge(product: Product): ProductBadgeInfo {
  if (!product || (product.stock ?? 0) <= 0) return null;

  if ((product as any).isRestocked) {
    return {
      type: 'RESTOCKED',
      label: 'REPOSICIÓN',
      bgClass: 'bg-gradient-to-r from-emerald-600 to-teal-600',
      textClass: 'text-white'
    };
  }

  if (product.isNew) {
    return {
      type: 'NEW',
      label: 'NUEVO INGRESO',
      bgClass: 'bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600',
      textClass: 'text-white'
    };
  }

  if (product.tags?.some(t => t.toUpperCase().includes('REPOSIC'))) {
    return {
      type: 'RESTOCKED',
      label: 'REPOSICIÓN',
      bgClass: 'bg-gradient-to-r from-emerald-600 to-teal-600',
      textClass: 'text-white'
    };
  }

  if (product.tags?.some(t => t.toUpperCase().includes('NUEVO') || t.toUpperCase().includes('INGRESO'))) {
    return {
      type: 'NEW',
      label: 'NUEVO INGRESO',
      bgClass: 'bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600',
      textClass: 'text-white'
    };
  }

  return null;
}
