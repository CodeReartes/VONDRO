import { Product } from '../types';
import { INSTANT_BOOT_PRODUCTS } from '../data/instantBootProducts';
import { normalizeProductsPricingList } from '../utils/pricingUtils';
import { isProductNewOrRestocked, sortProductsWithNewAndRestockedFirst } from '../utils/productSorting';

function deduplicateProductsList(products: Product[]): Product[] {
  const seen = new Set<string>();
  const result: Product[] = [];
  for (const p of products) {
    if (p && p.id && !seen.has(p.id)) {
      seen.add(p.id);
      result.push(p);
    }
  }
  return result;
}

const STORAGE_KEY_RECENT_CATEGORIES = 'vondro_recent_categories_v2';
const STORAGE_KEY_RECENT_PRODUCTS = 'vondro_recent_products_v2';
const MAX_HISTORY_LENGTH = 10;

// -------------------------------------------------------------
// 1. BROWSING HISTORY TRACKER
// -------------------------------------------------------------

/**
 * Retrieves the list of recently visited category IDs from local storage.
 */
export function getRecentBrowsingCategories(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT_CATEGORIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(id => typeof id === 'string' && id.trim().length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Records a category visit into browsing history (most recent first).
 */
export function recordCategoryVisit(categoryId: string): void {
  if (!categoryId || typeof categoryId !== 'string' || categoryId === 'all') return;
  try {
    const current = getRecentBrowsingCategories();
    const filtered = current.filter(id => id !== categoryId);
    const updated = [categoryId, ...filtered].slice(0, MAX_HISTORY_LENGTH);
    localStorage.setItem(STORAGE_KEY_RECENT_CATEGORIES, JSON.stringify(updated));
  } catch {
    // Non-blocking storage error fallback
  }
}

/**
 * Records a product detail view into browsing history.
 */
export function recordProductVisit(product: Product): void {
  if (!product) return;
  if (product.categoryId) {
    recordCategoryVisit(product.categoryId);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT_PRODUCTS);
    const current: string[] = raw ? JSON.parse(raw) : [];
    const filtered = current.filter(id => id !== product.id);
    const updated = [product.id, ...filtered].slice(0, MAX_HISTORY_LENGTH);
    localStorage.setItem(STORAGE_KEY_RECENT_PRODUCTS, JSON.stringify(updated));
  } catch {
    // Non-blocking storage error fallback
  }
}

// -------------------------------------------------------------
// 2. UNBIASED RANDOM SHUFFLE (FISHER-YATES)
// -------------------------------------------------------------
export function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = cloned[i];
    cloned[i] = cloned[j];
    cloned[j] = temp;
  }
  return cloned;
}

// -------------------------------------------------------------
// 3. CLIENT-SIDE FALLBACK ALGORITHM
// -------------------------------------------------------------
export function computeClientRecommendations(
  pool: Product[],
  recentCategories: string[],
  limitCount: number = 24,
  excludeIds: Set<string> = new Set()
): { products: Product[]; strategy: string } {
  const activePool = (pool && pool.length > 0 ? pool : INSTANT_BOOT_PRODUCTS).filter(
    p => !excludeIds.has(p.id) && (p.stock !== undefined ? p.stock > 0 : false)
  );

  if (recentCategories.length > 0) {
    // Personalized: Prioritize visited categories
    const categoryMatches = activePool.filter(p => recentCategories.includes(p.categoryId));
    const otherHighRated = activePool.filter(
      p => !recentCategories.includes(p.categoryId) && (p.rating !== undefined ? p.rating >= 4.5 : p.isFeatured)
    );

    const shuffledCategory = shuffleArray(categoryMatches);
    const shuffledDiscovery = shuffleArray(otherHighRated);

    const targetCategoryCount = Math.min(shuffledCategory.length, Math.ceil(limitCount * 0.65));
    const targetDiscoveryCount = limitCount - targetCategoryCount;

    const selectedCategory = shuffledCategory.slice(0, targetCategoryCount);
    const selectedDiscovery = shuffledDiscovery.slice(0, targetDiscoveryCount);

    const mixed = shuffleArray([...selectedCategory, ...selectedDiscovery]);

    if (mixed.length < limitCount) {
      const currentIds = new Set(mixed.map(p => p.id));
      const backfill = shuffleArray(activePool.filter(p => !currentIds.has(p.id))).slice(
        0,
        limitCount - mixed.length
      );
      mixed.push(...backfill);
    }

    return {
      products: deduplicateProductsList(normalizeProductsPricingList(mixed)),
      strategy: 'personalized_history'
    };
  }

  // New / Anonymous user: Random rotation over high-rated pool (rating >= 4.5), with new arrivals and restocked items prioritized FIRST
  const newAndRestocked = activePool.filter(p => isProductNewOrRestocked(p));
  const otherHighRated = activePool.filter(p => !isProductNewOrRestocked(p) && (p.rating !== undefined ? p.rating >= 4.5 : p.isFeatured));
  const otherPool = activePool.filter(p => !isProductNewOrRestocked(p));

  const shuffledNew = shuffleArray(newAndRestocked);
  const shuffledOthers = shuffleArray(otherHighRated.length >= limitCount ? otherHighRated : otherPool);

  // Take top new/restocked items first (up to half the batch) then discovery
  const targetNewCount = Math.min(shuffledNew.length, Math.ceil(limitCount * 0.45));
  const targetOtherCount = limitCount - targetNewCount;

  const topNew = shuffledNew.slice(0, targetNewCount);
  const chosenIds = new Set(topNew.map(p => p.id));
  const topOthers = shuffledOthers.filter(p => !chosenIds.has(p.id)).slice(0, targetOtherCount);

  const combinedFinal = [...topNew, ...topOthers];

  if (combinedFinal.length < limitCount) {
    const finalIds = new Set(combinedFinal.map(p => p.id));
    const backfill = shuffleArray(activePool.filter(p => !finalIds.has(p.id))).slice(0, limitCount - combinedFinal.length);
    combinedFinal.push(...backfill);
  }

  return {
    products: deduplicateProductsList(normalizeProductsPricingList(combinedFinal)),
    strategy: 'high_rated_anonymous'
  };
}

// -------------------------------------------------------------
// 4. MAIN DYNAMIC RECOMMENDATION FETCHER (API + RESILIENT LOCAL FALLBACK)
// -------------------------------------------------------------
export interface DynamicRecommendationsOptions {
  recentCategories?: string[];
  limit?: number;
  excludeIds?: string[];
  page?: number;
  seed?: string | number;
  fallbackCatalog?: Product[];
}

export interface DynamicRecommendationsResult {
  products: Product[];
  strategy: string;
  count: number;
  isFromApi: boolean;
}

export async function fetchDynamicRecommendations(
  options: DynamicRecommendationsOptions = {}
): Promise<DynamicRecommendationsResult> {
  const {
    recentCategories = getRecentBrowsingCategories(),
    limit = 24,
    excludeIds = [],
    page = 1,
    seed = Date.now(),
    fallbackCatalog = []
  } = options;

  const categoriesQuery = encodeURIComponent(recentCategories.join(','));
  const excludeQuery = encodeURIComponent(excludeIds.join(','));
  const url = `/api/products/recommendations?recentCategories=${categoriesQuery}&limit=${limit}&exclude=${excludeQuery}&page=${page}&seed=${seed}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.products) && data.products.length > 0) {
        const inStockProducts = data.products.filter((p: Product) => p && (p.stock !== undefined ? p.stock > 0 : false));
        if (inStockProducts.length > 0) {
          return {
            products: normalizeProductsPricingList(inStockProducts),
            strategy: data.strategy || 'high_rated_anonymous',
            count: inStockProducts.length,
            isFromApi: true
          };
        }
      }
    }
  } catch (err) {
    // Network or server timeout fallback to resilient client calculation
    console.info('[Recommendations] Falling back to client algorithm:', err);
  }

  // Client-side fallback execution
  const fallback = computeClientRecommendations(
    fallbackCatalog,
    recentCategories,
    limit,
    new Set(excludeIds)
  );

  return {
    products: fallback.products,
    strategy: fallback.strategy,
    count: fallback.products.length,
    isFromApi: false
  };
}
