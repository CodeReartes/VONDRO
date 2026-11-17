import React, { useMemo, useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Clock, 
  Zap,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  Check,
  Truck,
  Heart,
  ShoppingCart,
  Sparkles,
  Award,
  Loader2,
  Gift
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { triggerHaptic } from '../utils/native';
import { useActiveFlashDealConfig, useFlashCountdown } from '../utils/flashDealTimer';
import { useProductsList } from '../hooks/useProductsList';
import { ProductGridSkeleton, ProductGridError } from './ProductGridSkeleton';
import { Product } from '../types';
import { getNewArrivalsAndRestockedProducts } from '../utils/productSorting';

const FlashCountdownText: React.FC = () => {
  const { formatted } = useFlashCountdown();
  return <span className="tracking-tight whitespace-nowrap">{formatted}</span>;
};

export const HomeView: React.FC = () => {
  const { 
    products, 
    categories, 
    setActiveTab, 
    selectedCategoryFilter, 
    setSelectedCategoryFilter, 
    setSearchOnlyOffers,
    setSearchOnlySeasonal,
    setSearchSortBy,
    openProductDetail,
    settings,
    addToCart,
    toggleFavorite,
    isFavorite,
    cart,
    recentBrowsingCategories,
    recommendationRefreshTrigger
  } = useStore();

  const [isRefreshingFeed, setIsRefreshingFeed] = useState<boolean>(false);

  // Persistent global flash config without 1-second full-page re-renders
  const timer = useActiveFlashDealConfig();

  // Optimized cursor-based pagination directly from Firestore with dynamic recommendations & rotation
  const {
    products: paginatedProducts,
    loading: isLoadingProducts,
    loadingMore: isLoadingMore,
    hasMore,
    error: productsError,
    loadMore,
    refresh,
    totalLoaded,
    setSentinelRef
  } = useProductsList({
    categoryId: selectedCategoryFilter,
    batchSize: 20,
    recentCategories: recentBrowsingCategories,
    refreshKey: recommendationRefreshTrigger,
    fallbackCatalog: products
  });

  const handleRefreshFeed = async () => {
    triggerHaptic('light');
    setIsRefreshingFeed(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setIsRefreshingFeed(false), 500);
    }
  };

  // Filter products memoized for under 3999 banner
  const visibleProducts = useMemo(() => {
    return (products || []).filter(p => p && (!p.hideIfOutOfStock || p.stock > 0));
  }, [products]);

  const under3999Products = useMemo(() => {
    return visibleProducts.filter(p => p.salePrice <= 6500).slice(0, 4);
  }, [visibleProducts]);

  // Top New Arrivals & Restocked products (with verified stock > 0)
  const newAndRestockedProducts = useMemo(() => {
    return getNewArrivalsAndRestockedProducts(products || [], 20);
  }, [products]);

  // 100 Rotating Flash Deal Products (prioritizing low stock <= 10 with dynamic rotation)
  const flashDealProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    
    const productMap = new Map<string, Product>((products || []).map(p => [p.id, p]));
    const activeFromIds = (timer.activeProductIds || [])
      .map(id => productMap.get(id))
      .filter((p): p is Product => Boolean(p && (p as Product).stock > 0 && !(p as Product).hideIfOutOfStock));

    const baseList = activeFromIds.length >= 10 ? activeFromIds : products.filter(p => p && p.stock > 0 && !p.hideIfOutOfStock);

    // Group low-stock products (<= 10 units) and regular stock
    const lowStock = baseList.filter(p => p.stock > 0 && p.stock <= 10);
    const regularStock = baseList.filter(p => p.stock > 10);

    // Rotated low-stock items lead the reel, followed by other offers (reel only displays 8)
    return [...lowStock, ...regularStock].slice(0, 12);
  }, [products, timer.activeProductIds]);

  return (
    <div className="pb-24 w-full max-w-7xl mx-auto space-y-4 pt-1.5 overflow-x-clip">
      
      {/* 1. BANNER PRINCIPAL (Hero Banner con CTA no truncable) */}
      <section className="px-3">
        <div 
          onClick={() => {
            triggerHaptic('light');
            setSelectedCategoryFilter(null);
            setSearchOnlyOffers(true);
            setActiveTab('search');
          }}
          className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-md cursor-pointer group overflow-hidden"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-tight text-amber-100 mb-1">
              <span>🌸</span>
              <span>OFERTAS DE TEMPORADA</span>
              <span className="hidden sm:inline-block">• Córdoba Capital</span>
            </div>
            <h2 className="text-sm sm:text-base md:text-lg font-black leading-tight text-white line-clamp-2">
              Hasta 50% de descuento en productos seleccionados
            </h2>
          </div>

          {/* CTA Button: flex-shrink-0, whitespace-nowrap, min-w-max to strictly prevent "Ver tod" truncation */}
          <button
            id="btn-banner-ver-todo"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('medium');
              setSelectedCategoryFilter(null);
              setSearchOnlySeasonal(true);
              setSearchOnlyOffers(false);
              setActiveTab('search');
            }}
            className="shrink-0 whitespace-nowrap min-w-max bg-white text-orange-600 hover:bg-orange-50 font-black text-xs sm:text-sm px-4 py-2 rounded-full shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            aria-label="Ver todas las ofertas de temporada"
          >
            <span className="whitespace-nowrap">Ver temporada</span>
            <ChevronRight className="w-4 h-4 stroke-[3] shrink-0" />
          </button>
        </div>
      </section>

      {/* 2. PRODUCTOS DESTACADOS / OFERTAS RELÁMPAGO */}
      <section className="px-3">
        <div className="bg-slate-950 text-white rounded-2xl p-3 sm:p-3.5 shadow-md border border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <button
              id="btn-goto-flash-deals"
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                setSelectedCategoryFilter(null);
                setSearchOnlyOffers(true);
                setSearchOnlySeasonal(false);
                setSearchSortBy('featured');
                setActiveTab('search');
              }}
              className="flex items-center gap-2 min-w-0 group hover:opacity-95 text-left cursor-pointer transition-all"
              title="Ver los 100 artículos en oferta relámpago"
            >
              <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                <Zap className="w-3 h-3 fill-current" />
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-white whitespace-nowrap tracking-tight group-hover:text-amber-300">
                  Ofertas relámpago
                </h3>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400 stroke-[3] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>
            </button>

            {/* Countdown timer & Ver 100 CTA */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setSelectedCategoryFilter(null);
                  setSearchOnlyOffers(true);
                  setSearchOnlySeasonal(false);
                  setSearchSortBy('featured');
                  setActiveTab('search');
                }}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-300 hover:text-white bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
              >
                <span>Ver los 100</span>
                <ChevronRight className="w-3 h-3 stroke-[3]" />
              </button>

              <div 
                onClick={() => {
                  triggerHaptic('medium');
                  setSelectedCategoryFilter(null);
                  setSearchOnlyOffers(true);
                  setSearchOnlySeasonal(false);
                  setSearchSortBy('featured');
                  setActiveTab('search');
                }}
                className="flex items-center gap-1.5 bg-[#ef4444] hover:bg-red-600 border border-red-400/40 px-2.5 py-0.5 rounded-lg text-[10.5px] sm:text-xs font-mono font-black text-white shadow-xs shrink-0 cursor-pointer transition-colors"
                title="Ver los 100 artículos en oferta relámpago"
              >
                <Clock className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-white shrink-0" />
                <FlashCountdownText />
              </div>
            </div>
          </div>

          {/* Horizontal reel */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 no-scrollbar snap-x items-stretch">
            {flashDealProducts.slice(0, 8).map((product, idx) => (
              <div key={`flash-${product.id}`} className="snap-start flex">
                <ProductCard product={product} layout="compact" priority={idx < 2} />
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* 3. MAIN CONTINUOUS 2-COLUMN PRODUCT FEED */}
      <section className="px-3 pt-1">
        <div className="flex flex-row items-center justify-between mb-3 w-full">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
              {selectedCategoryFilter 
                ? categories.find(c => c.id === selectedCategoryFilter)?.name || 'Catálogo'
                : 'Recomendados para ti'}
            </h3>
            {!selectedCategoryFilter && (
              <button
                id="btn-refresh-recommendations"
                type="button"
                onClick={handleRefreshFeed}
                disabled={isRefreshingFeed || isLoadingProducts}
                title="Actualizar y rotar recomendaciones"
                aria-label="Actualizar y rotar recomendaciones"
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 hover:bg-purple-100/90 active:bg-purple-200 text-purple-700 active:scale-95 rounded-full border border-purple-200/80 transition-all duration-200 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              >
                <RotateCw 
                  className={`w-3.5 h-3.5 text-purple-600 transition-transform duration-500 ${
                    isRefreshingFeed || (isLoadingProducts && paginatedProducts.length > 0) 
                      ? 'animate-spin text-purple-700' 
                      : 'group-hover:rotate-180'
                  }`} 
                />
                <span className="text-[11px] font-bold text-purple-800 select-none">
                  {isRefreshingFeed ? 'Actualizando...' : 'Actualizar'}
                </span>
              </button>
            )}
          </div>
          <div className="location-badge flex flex-row items-center gap-[6px] text-[11px] sm:text-xs text-slate-600 font-semibold bg-slate-100/90 px-2.5 py-1 rounded-full shrink-0 leading-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Córdoba Capital</span>
          </div>
        </div>

        {/* Initial Skeleton Loader */}
        {isLoadingProducts && paginatedProducts.length === 0 ? (
          <ProductGridSkeleton count={8} />
        ) : productsError && paginatedProducts.length === 0 ? (
          <ProductGridError message={productsError} onRetry={refresh} />
        ) : (
          <>
            {/* 2-column Mobile / Multi-column Tablet & Desktop Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5">
              {paginatedProducts.map((product, idx) => (
                <ProductCard key={product.id} product={product} priority={idx < 6} />
              ))}
            </div>

            {/* Continuous Scroll Sentinel & Progressive Loading Indicator */}
            {hasMore && (
              <div 
                ref={setSentinelRef} 
                className="pt-4 pb-2 flex flex-col items-center justify-center gap-2"
              >
                {isLoadingMore ? (
                  <div className="w-full pt-2">
                    <ProductGridSkeleton count={4} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-full shadow-2xs">
                    <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                    <span>Deslizá para cargar más productos...</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    loadMore();
                  }}
                  className="text-xs text-purple-700 font-bold hover:underline py-1"
                >
                  Cargar más ahora
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 5. BENEFICIOS Y GARANTÍAS (Envío / Garantía VONDRO) */}
      <section className="px-3 pt-2">
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-700">
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 leading-tight">Envío Gratis en Córdoba</p>
                <p className="text-[10px] text-slate-500 truncate">Desde ${(settings?.freeShippingThreshold ?? 100000).toLocaleString('es-AR')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 leading-tight">Garantía VONDRO 6 Puntos</p>
                <p className="text-[10px] text-slate-500 truncate">Pagos 100% protegidos y seguros</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 leading-tight">Devolución Fácil</p>
                <p className="text-[10px] text-slate-500 truncate">Cambio o crédito garantizado</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
