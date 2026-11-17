import { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';
import { 
  fetchProductsPaginated, 
  FetchProductsOptions, 
  PaginatedProductsResult 
} from '../lib/firestoreService';
import { 
  fetchDynamicRecommendations, 
  computeClientRecommendations,
  getRecentBrowsingCategories 
} from '../lib/recommendationsService';
import { normalizeProductsPricingList } from '../utils/pricingUtils';
import { sortProductsWithNewAndRestockedFirst } from '../utils/productSorting';

export interface UseProductsListOptions {
  categoryId?: string | null;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'featured' | 'price-asc' | 'price-desc' | 'discount' | 'rating' | 'newest';
  onlyInStock?: boolean;
  onlyOffers?: boolean;
  searchQuery?: string;
  batchSize?: number;
  enableRecommendations?: boolean;
  recentCategories?: string[];
  refreshKey?: number | string;
  fallbackCatalog?: Product[];
}

export interface UseProductsListResult {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalLoaded: number;
  setSentinelRef: (node: HTMLDivElement | null) => void;
  recommendationStrategy?: string | null;
}

// Global in-memory list cache with timestamp to preserve scrolled feed state between view transitions
export const FEED_CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes TTL (30-60 min platform timeout)

export interface CachedFeedEntry {
  products: Product[];
  lastDoc: any;
  hasMore: boolean;
  recommendationStrategy: string | null;
  sessionSeed: number;
  recommendationPage: number;
  timestamp: number;
}

const feedCache = new Map<string, CachedFeedEntry>();

export const isFeedCacheValid = (cached?: CachedFeedEntry | null): cached is CachedFeedEntry => {
  if (!cached || !cached.products || cached.products.length === 0) return false;
  return (Date.now() - cached.timestamp) < FEED_CACHE_TTL_MS;
};

/**
 * Computes an instant, synchronous initial batch of products from in-memory fallbackCatalog or cache
 * to ensure 0-millisecond time-to-first-paint with newly uploaded products prioritized first.
 */
function computeInstantProducts(
  options: UseProductsListOptions,
  fallbackCatalog?: Product[],
  cached?: CachedFeedEntry
): Product[] {
  if (cached?.products && cached.products.length > 0) {
    return cached.products;
  }
  if (!fallbackCatalog || fallbackCatalog.length === 0) {
    return [];
  }

  const {
    categoryId,
    minPrice,
    maxPrice,
    onlyInStock = false,
    onlyOffers = false,
    searchQuery = '',
    batchSize = 20,
    sortBy = 'featured'
  } = options;

  let pool = fallbackCatalog.filter(p => 
    p && 
    (!p.hideIfOutOfStock || (p.stock ?? 0) > 0) &&
    p.images && p.images.length > 0 && p.images.some(img => typeof img === 'string' && img.trim().length > 0)
  );

  if (categoryId && categoryId !== 'all') {
    pool = pool.filter(p => p.categoryId === categoryId);
  }
  if (onlyInStock) {
    pool = pool.filter(p => (p.stock ?? 0) > 0 && p.stockStatus !== 'out_of_stock');
  }
  if (onlyOffers) {
    pool = pool.filter(p => (p.discountPercentage && p.discountPercentage > 0) || p.isFlashSale);
  }
  if (minPrice !== undefined) pool = pool.filter(p => p.salePrice >= minPrice);
  if (maxPrice !== undefined) pool = pool.filter(p => p.salePrice <= maxPrice);

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    pool = pool.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    );
  }

  // Recommendation mode on Home
  const isRec = Boolean(
    !categoryId &&
    !searchQuery.trim() &&
    !onlyOffers &&
    minPrice === undefined &&
    maxPrice === undefined &&
    sortBy === 'featured'
  );

  if (isRec) {
    const effectiveCategories = options.recentCategories && options.recentCategories.length > 0
      ? options.recentCategories
      : getRecentBrowsingCategories();
    const recs = computeClientRecommendations(pool, effectiveCategories, batchSize);
    return recs.products;
  }

  // Always prioritize newly uploaded and restocked products first
  const sorted = sortProductsWithNewAndRestockedFirst(normalizeProductsPricingList(pool));
  return sorted.slice(0, batchSize);
}

export function useProductsList(options: UseProductsListOptions = {}): UseProductsListResult {
  const {
    categoryId = null,
    minPrice,
    maxPrice,
    sortBy = 'featured',
    onlyInStock = false,
    onlyOffers = false,
    searchQuery = '',
    batchSize = 20,
    enableRecommendations = true,
    recentCategories,
    refreshKey,
    fallbackCatalog
  } = options;

  const cacheKey = `${categoryId || 'all'}-${minPrice || ''}-${maxPrice || ''}-${sortBy}-${onlyInStock}-${onlyOffers}-${searchQuery.trim()}-${enableRecommendations}`;
  const rawCached = feedCache.get(cacheKey);
  const cachedData = isFeedCacheValid(rawCached) ? rawCached : undefined;

  const initialInstant = computeInstantProducts(options, fallbackCatalog, cachedData);

  const [products, setProducts] = useState<Product[]>(() => initialInstant);
  const [loading, setLoading] = useState<boolean>(() => initialInstant.length === 0);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(() => cachedData ? cachedData.hasMore : true);
  const [error, setError] = useState<string | null>(null);
  const [recommendationStrategy, setRecommendationStrategy] = useState<string | null>(() => cachedData?.recommendationStrategy || null);

  // Recommendation session seed and pagination page ref
  const sessionSeedRef = useRef<number>(cachedData?.sessionSeed || Date.now());
  const recommendationPageRef = useRef<number>(cachedData?.recommendationPage || 1);

  // Firestore cursor & loading lock refs
  const lastDocRef = useRef<any>(cachedData?.lastDoc || null);
  const isFetchingRef = useRef<boolean>(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLDivElement | null>(null);
  const prevRefreshKeyRef = useRef<number | string | undefined>(refreshKey);
  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;
  const fallbackCatalogRef = useRef<Product[] | undefined>(fallbackCatalog);
  fallbackCatalogRef.current = fallbackCatalog;

  // Whether current query should use the dynamic recommendation engine
  const isRecommendationMode = Boolean(
    enableRecommendations &&
    !categoryId &&
    !searchQuery.trim() &&
    !onlyOffers &&
    minPrice === undefined &&
    maxPrice === undefined &&
    sortBy === 'featured'
  );

  // Save current state into cache
  const updateCache = useCallback((updatedProducts: Product[], hasMoreItems: boolean, strategy: string | null = null) => {
    feedCache.set(cacheKey, {
      products: updatedProducts,
      lastDoc: lastDocRef.current,
      hasMore: hasMoreItems,
      recommendationStrategy: strategy,
      sessionSeed: sessionSeedRef.current,
      recommendationPage: recommendationPageRef.current,
      timestamp: Date.now()
    });
  }, [cacheKey]);

  // Fetch initial batch (Page 1)
  const fetchInitialPage = useCallback(async (isRefresh: boolean = false) => {
    const existingCached = feedCache.get(cacheKey);
    // If we already have cached products and this is not an explicit refresh and cache is valid (< 45 min), skip re-fetching
    if (!isRefresh && isFeedCacheValid(existingCached)) {
      setProducts(existingCached.products);
      setHasMore(existingCached.hasMore);
      setRecommendationStrategy(existingCached.recommendationStrategy);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current && !isRefresh) return;
    isFetchingRef.current = true;

    // Only display blocking skeleton loader if there are no instant products already on screen
    if (products.length === 0) {
      setLoading(true);
    }
    setError(null);
    lastDocRef.current = null;

    if (isRefresh) {
      sessionSeedRef.current = Date.now();
      recommendationPageRef.current = 1;
    }

    try {
      if (isRecommendationMode) {
        // Use Dynamic Recommendations API with personal browsing history or random high-rated shuffle
        const effectiveCategories = recentCategories && recentCategories.length > 0
          ? recentCategories
          : getRecentBrowsingCategories();

        const result = await fetchDynamicRecommendations({
          recentCategories: effectiveCategories,
          limit: batchSize,
          page: 1,
          seed: sessionSeedRef.current,
          fallbackCatalog: (fallbackCatalogRef.current || []).filter(p => (p.stock !== undefined ? p.stock > 0 : false))
        });

        const rawRecs = result.products.filter(p => p && (p.stock !== undefined ? p.stock > 0 : false));
        const seenRecIds = new Set<string>();
        const inStockRecs = rawRecs.filter(p => {
          if (!p || !p.id || seenRecIds.has(p.id)) return false;
          seenRecIds.add(p.id);
          return true;
        });
        setProducts(inStockRecs);
        setRecommendationStrategy(result.strategy);
        recommendationPageRef.current = 1;
        const more = inStockRecs.length >= batchSize;
        setHasMore(more);
        updateCache(inStockRecs, more, result.strategy);
      } else {
        // Standard category / filter / search Firestore pagination
        setRecommendationStrategy(null);
        const fetchOpts: FetchProductsOptions = {
          categoryId,
          minPrice,
          maxPrice,
          sortBy,
          onlyInStock,
          onlyOffers,
          limitCount: batchSize,
          startAfterDoc: null,
          forceRefresh: isRefresh
        };

        const result: PaginatedProductsResult = await fetchProductsPaginated(fetchOpts);

        let items = normalizeProductsPricingList(result.products);
        // If client search query is present, filter items
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          items = items.filter(p => 
            p.name.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q)
          );
        }

        const seenItemIds = new Set<string>();
        const dedupedItems = items.filter(p => {
          if (!p || !p.id || seenItemIds.has(p.id)) return false;
          if (!p.images || p.images.length === 0 || !p.images.some(img => typeof img === 'string' && img.trim().length > 0)) return false;
          seenItemIds.add(p.id);
          return true;
        });

        setProducts(dedupedItems);
        lastDocRef.current = result.lastDoc;
        setHasMore(result.hasMore);
        updateCache(dedupedItems, result.hasMore, null);
      }
    } catch (err: any) {
      const msg = err?.message || 'Error al cargar productos.';
      setError(msg);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [
    cacheKey,
    updateCache,
    isRecommendationMode,
    recentCategories,
    batchSize,
    categoryId,
    minPrice,
    maxPrice,
    sortBy,
    onlyInStock,
    onlyOffers,
    searchQuery
  ]);

  // Load next cursor batch (Infinite Scroll)
  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingRef.current || loading || loadingMore) {
      return;
    }

    if (isRecommendationMode) {
      isFetchingRef.current = true;
      setLoadingMore(true);

      try {
        const nextPage = recommendationPageRef.current + 1;
        const currentIds = productsRef.current.map(p => p.id);
        const effectiveCategories = recentCategories && recentCategories.length > 0
          ? recentCategories
          : getRecentBrowsingCategories();

        const result = await fetchDynamicRecommendations({
          recentCategories: effectiveCategories,
          limit: batchSize,
          excludeIds: currentIds,
          page: nextPage,
          seed: sessionSeedRef.current,
          fallbackCatalog: (fallbackCatalogRef.current || []).filter(p => (p.stock !== undefined ? p.stock > 0 : false))
        });

        const inStockRecs = result.products.filter(p => p && (p.stock !== undefined ? p.stock > 0 : false));
        if (inStockRecs.length > 0) {
          const more = inStockRecs.length >= batchSize;
          recommendationPageRef.current = nextPage;
          setHasMore(more);
          setProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const fresh = inStockRecs.filter(p => !existingIds.has(p.id));
            const combined = [...prev, ...fresh];
            updateCache(combined, more, result.strategy);
            return combined;
          });
        } else {
          setHasMore(false);
          updateCache(products, false, result.strategy);
        }
      } catch (err) {
        console.warn('[useProductsList] Error loading more recommendations:', err);
      } finally {
        setLoadingMore(false);
        isFetchingRef.current = false;
      }
      return;
    }

    // Standard pagination loadMore
    if (!lastDocRef.current) return;

    isFetchingRef.current = true;
    setLoadingMore(true);

    try {
      const fetchOpts: FetchProductsOptions = {
        categoryId,
        minPrice,
        maxPrice,
        sortBy,
        onlyInStock,
        onlyOffers,
        limitCount: batchSize,
        startAfterDoc: lastDocRef.current
      };

      const result: PaginatedProductsResult = await fetchProductsPaginated(fetchOpts);

      let newItems = normalizeProductsPricingList(result.products);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        newItems = newItems.filter(p => 
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
        );
      }

      lastDocRef.current = result.lastDoc;
      const more = Boolean(result.hasMore && result.products.length > 0);
      setHasMore(more);
      setProducts(prev => {
        // Prevent duplicate IDs and require valid images when appending cursor batches
        const existingIds = new Set(prev.map(p => p.id));
        const filteredNew = newItems.filter(p => 
          !existingIds.has(p.id) && 
          p.images && p.images.length > 0 && 
          p.images.some(img => typeof img === 'string' && img.trim().length > 0)
        );
        const combined = [...prev, ...filteredNew];
        updateCache(combined, more, null);
        return combined;
      });
    } catch (err: any) {
      console.warn('[useProductsList] Error loading more products:', err);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [
    hasMore,
    loading,
    loadingMore,
    isRecommendationMode,
    recentCategories,
    batchSize,
    categoryId,
    minPrice,
    maxPrice,
    sortBy,
    onlyInStock,
    onlyOffers,
    searchQuery,
    updateCache
  ]);

  // Trigger initial fetch when query parameters change (will reuse valid cache if within 30-60 min TTL)
  useEffect(() => {
    fetchInitialPage(false);
  }, [fetchInitialPage]);

  // When external refreshKey changes (e.g. user login or explicit refresh button), refresh with new shuffle
  useEffect(() => {
    if (prevRefreshKeyRef.current !== undefined && prevRefreshKeyRef.current !== refreshKey && refreshKey !== undefined && refreshKey !== null) {
      prevRefreshKeyRef.current = refreshKey;
      fetchInitialPage(true);
    } else {
      prevRefreshKeyRef.current = refreshKey;
    }
  }, [refreshKey, fetchInitialPage]);

  // If user leaves the app/tab and returns after > 30-60 minutes, automatically invalidate and update
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const existing = feedCache.get(cacheKey);
        if (existing && (Date.now() - existing.timestamp) >= FEED_CACHE_TTL_MS) {
          fetchInitialPage(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [cacheKey, fetchInitialPage]);

  // Manual pull-to-refresh / invalidate
  const refresh = useCallback(async () => {
    await fetchInitialPage(true);
  }, [fetchInitialPage]);

  // IntersectionObserver for Infinite Scroll sentinel
  const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    sentinelNodeRef.current = node;

    if (node && hasMore && !loading) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            loadMore();
          }
        },
        {
          root: null,
          rootMargin: '800px', // Trigger well before reaching bottom during fast scroll
          threshold: 0.01
        }
      );

      observerRef.current.observe(node);
    }
  }, [hasMore, loading, loadMore]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    products,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    totalLoaded: products.length,
    setSentinelRef,
    recommendationStrategy
  };
}
