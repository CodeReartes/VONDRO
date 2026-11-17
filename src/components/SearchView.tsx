import React, { useState, useMemo, useDeferredValue } from 'react';
import { 
  Search, 
  X, 
  Flame, 
  Check, 
  ArrowUpDown,
  Zap,
  Clock,
  ChevronDown,
  Loader2,
  Sparkles,
  History,
  Trash2,
  Sun
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { useActiveFlashDealConfig, useFlashCountdown, isProductInFlashDeal } from '../utils/flashDealTimer';
import { triggerHaptic } from '../utils/native';
import { formatCategoryName } from '../utils/textUtils';
import { getSortedCategoriesWithStats, getSortedSubcategoriesWithStats } from '../utils/categorySorting';
import { useProgressivePagination } from '../hooks/useProgressivePagination';
import { Product } from '../types';
import { getProductPriorityScore } from '../utils/productSorting';

export function isSeasonalProduct(product: Product): boolean {
  if (!product || product.stock <= 0 || product.hideIfOutOfStock || product.stockStatus === 'out_of_stock' || product.stockStatus === 'hidden') {
    return false;
  }
  if (product.categoryId === 'verano' || product.categoryId === 'reventon-de-quencher') return true;
  const sub = (product.subcategoryId || '').toLowerCase();
  if (['elec-clima', 'mar-bolsos-termicos', 'vas-quencher', 'vas-botellas-sport', 'ilu-exterior-solar', 'ver-playa', 'ter-termos-acero'].includes(sub)) {
    return true;
  }
  const text = `${product.name} ${product.description || ''} ${(product.shortFeatures || []).join(' ')} ${(product.tags || []).join(' ')}`.toLowerCase();
  const keywords = [
    'verano', 'temporada', 'primavera', 'pileta', 'piscina', 'inflable', 'playa', 'calor', 
    'ventilador', 'climatizador', 'quencher', 'conservadora', 'bolso termico', 'solar', 
    'sombrilla', 'reposera', 'botella termica', 'hidratacion', 'repelente', 'antimosquito', 'parrilla', 'camping'
  ];
  return keywords.some(k => text.includes(k));
}

const sortOptions: { id: 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'discount' | 'rating'; label: string }[] = [
  { id: 'featured', label: 'Relevancia' },
  { id: 'newest', label: '⚡ Ofertas Relámpago' },
  { id: 'price-asc', label: 'Menor precio' },
  { id: 'price-desc', label: 'Mayor precio' },
  { id: 'discount', label: 'Mayor descuento' },
  { id: 'rating', label: 'Mejor valorados' },
];

const SearchFlashBanner: React.FC<{ count: number }> = ({ count }) => {
  const countdown = useFlashCountdown();
  return (
    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950 text-white rounded-2xl p-2.5 sm:p-3 shadow-sm border border-slate-800 space-y-1.5 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
            <Zap className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-amber-400">
                ⚡ Ofertas Relámpago por Lote
              </h3>
            </div>
          </div>
        </div>

        {/* Countdown Badge */}
        <div className="shrink-0 flex items-center gap-1 bg-slate-800/95 border border-slate-700 px-2 py-1 rounded-lg shadow-inner">
          <Clock className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
          <div className="font-mono text-[11px] font-black tracking-wider text-white">
            <span>{String(countdown.hours).padStart(2, '0')}</span>:
            <span>{String(countdown.minutes).padStart(2, '0')}</span>:
            <span className="text-amber-400">{String(countdown.seconds).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-0.5">
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-400 to-rose-500 h-full rounded-full transition-all duration-1000"
            style={{ width: `${countdown.progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[9px] text-slate-400">
          <span>🔥 {countdown.progressPercent}% del tiempo transcurrido</span>
          <span>{count} productos en este lote</span>
        </div>
      </div>
    </div>
  );
};

export const SearchView: React.FC = () => {
  const { 
    products, 
    categories, 
    searchQuery, 
    setSearchQuery,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    selectedCategoryFilter, 
    setSelectedCategoryFilter,
    selectedSubcategoryFilter,
    setSelectedSubcategoryFilter,
    searchSortBy,
    setSearchSortBy,
    searchOnlyInStock,
    setSearchOnlyInStock,
    searchOnlyOffers,
    setSearchOnlyOffers,
    searchOnlySeasonal,
    setSearchOnlySeasonal,
    resetSearchFilters
  } = useStore();

  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

  const { activeProductIds } = useActiveFlashDealConfig(products);

  // Defer search term to keep keystrokes buttery smooth on low/mid-end devices
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Fast category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name.toLowerCase()));
    return map;
  }, [categories]);

  // Memoized dynamic categories calculation & smart sorting
  const dynamicCategoriesData = useMemo(() => {
    return getSortedCategoriesWithStats(categories, products);
  }, [categories, products]);

  // Memoized dynamic subcategories calculation & sorting for the selected category
  const dynamicSubcategoriesData = useMemo(() => {
    if (!selectedCategoryFilter) return null;
    const currentCat = categories.find(c => c.id === selectedCategoryFilter);
    if (!currentCat?.subcategories || currentCat.subcategories.length === 0) return null;

    const sortedSub = getSortedSubcategoriesWithStats(currentCat, products);

    return {
      currentCat,
      totalCount: sortedSub.totalAvailableCount,
      subcategories: sortedSub.subcategories
    };
  }, [selectedCategoryFilter, categories, products]);

  // Check if any filters or sorting are actively applied
  const hasActiveFilters = Boolean(
    selectedCategoryFilter !== null || 
    selectedSubcategoryFilter !== null || 
    deferredSearchQuery.trim() !== '' || 
    searchOnlyInStock || 
    searchOnlyOffers || 
    searchOnlySeasonal ||
    searchSortBy !== 'featured'
  );

  // Pre-index catalog once per catalog/category update so keystroke filtering & sorting take <2ms
  const indexedProducts = useMemo(() => {
    return products
      .filter(product =>
        Boolean(
          product &&
          product.images &&
          product.images.length > 0 &&
          product.images.some(img => typeof img === 'string' && img.trim().length > 0) &&
          !(product.hideIfOutOfStock && product.stock <= 0) &&
          product.stockStatus !== 'hidden'
        )
      )
      .map(product => {
        const stock = product.stock ?? 0;
        const inStock = stock > 0 && product.stockStatus !== 'out_of_stock';
        const catName = categoryMap.get(product.categoryId) || '';
        const searchText = `${product.name || ''} ${product.sku || ''} ${product.description || ''} ${catName}`.toLowerCase();
        return {
          product,
          searchText,
          subLower: (product.subcategoryId || '').toLowerCase().trim(),
          inStock,
          isSeasonal: isSeasonalProduct(product),
          priorityScore: getProductPriorityScore(product),
          createdAtMs: product.createdAt ? new Date(product.createdAt).getTime() || 0 : 0,
        };
      });
  }, [products, categoryMap]);

  // Memoized fast filter & sort pipeline using precomputed index
  const filtered = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase().trim();
    const activeFlashSet = searchOnlyOffers && activeProductIds.length > 0 ? new Set(activeProductIds) : null;

    let targetSlug = '';
    const targetSub = selectedSubcategoryFilter ? selectedSubcategoryFilter.toLowerCase().trim() : '';
    if (selectedSubcategoryFilter) {
      const currentCat = categories.find(c => c.id === selectedCategoryFilter);
      const subObj = currentCat?.subcategories?.find(s => s.id === selectedSubcategoryFilter);
      targetSlug = (subObj?.slug || '').toLowerCase().trim();
    }

    const matched = indexedProducts.filter(entry => {
      const { product } = entry;
      if (selectedCategoryFilter && product.categoryId !== selectedCategoryFilter) return false;
      if (targetSub && entry.subLower !== targetSub && (!targetSlug || entry.subLower !== targetSlug)) return false;
      if (searchOnlyInStock && !entry.inStock) return false;
      if (searchOnlyOffers) {
        if (activeFlashSet) {
          if (!entry.inStock || !activeFlashSet.has(product.id)) return false;
        } else if (!isProductInFlashDeal(product, activeProductIds)) {
          return false;
        }
      }
      if (searchOnlySeasonal && !entry.isSeasonal) return false;
      if (q && !entry.searchText.includes(q)) return false;
      return true;
    });

    matched.sort((a, b) => {
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

      switch (searchSortBy) {
        case 'newest': {
          const scoreDiff = b.priorityScore - a.priorityScore;
          if (scoreDiff !== 0) return scoreDiff;
          return b.createdAtMs - a.createdAtMs;
        }
        case 'price-asc':
          return a.product.salePrice - b.product.salePrice;
        case 'price-desc':
          return b.product.salePrice - a.product.salePrice;
        case 'discount':
          return (b.product.discountPercentage || 0) - (a.product.discountPercentage || 0);
        case 'rating':
          return b.product.rating - a.product.rating;
        case 'featured':
        default: {
          const scoreDiff = b.priorityScore - a.priorityScore;
          if (scoreDiff !== 0) return scoreDiff;
          return b.createdAtMs - a.createdAtMs;
        }
      }
    });

    return matched.map(entry => entry.product);
  }, [
    indexedProducts,
    categories,
    deferredSearchQuery,
    selectedCategoryFilter,
    selectedSubcategoryFilter,
    searchOnlyInStock,
    searchOnlyOffers,
    searchOnlySeasonal,
    searchSortBy,
    activeProductIds
  ]);

  // Progressive pagination for search results
  const {
    displayedItems: paginatedFiltered,
    hasMore,
    loadMore,
    totalCount,
    loadedCount,
    setSentinelRef
  } = useProgressivePagination<Product>(filtered, { batchSize: 30 });

  const currentSortLabel = sortOptions.find(o => o.id === searchSortBy)?.label || 'Relevancia';

  return (
    <div className="pb-24 w-full max-w-7xl mx-auto px-3 sm:px-4 pt-1 space-y-2 overflow-x-clip">
      {/* Category Pills Bar (Horizontal Scroll) */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar items-center text-xs w-full max-w-full">
        <button
          type="button"
          id="chip-cat-search-all"
          onClick={() => {
            triggerHaptic('selection');
            setSelectedCategoryFilter(null);
            setSelectedSubcategoryFilter(null);
          }}
          className={`px-[12px] py-[6px] rounded-[20px] text-xs shrink-0 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap leading-none ${
            selectedCategoryFilter === null
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className={`font-semibold ${selectedCategoryFilter === null ? 'text-white' : 'text-[#333333]'}`}>
            Todos
          </span>
          <span className={`text-[0.85em] font-normal ${selectedCategoryFilter === null ? 'text-white' : 'text-[#71717A]'}`}>
            ({dynamicCategoriesData.totalAvailableCount})
          </span>
        </button>

        {dynamicCategoriesData.categories.map((cat) => {
          const isSelected = selectedCategoryFilter === cat.id;

          return (
            <button
              key={cat.id}
              id={`chip-cat-search-${cat.id}`}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                if (isSelected) {
                  setSelectedCategoryFilter(null);
                  setSelectedSubcategoryFilter(null);
                } else {
                  setSelectedCategoryFilter(cat.id);
                  setSelectedSubcategoryFilter(null);
                }
              }}
              title={`${formatCategoryName(cat.name)} (${cat.productCount} disponibles)`}
              className={`px-[12px] py-[6px] rounded-[20px] text-xs shrink-0 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap leading-none ${
                isSelected
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span className={`font-semibold ${isSelected ? 'text-white' : 'text-[#333333]'}`}>
                {formatCategoryName(cat.name)}
              </span>
              <span className={`text-[0.85em] font-normal ${isSelected ? 'text-white' : 'text-[#71717A]'}`}>
                ({cat.productCount})
              </span>
            </button>
          );
        })}
      </div>

      {/* Subcategory Pills if category selected and has subcategories */}
      {dynamicSubcategoriesData && (
        <div className="flex gap-1.5 overflow-x-auto px-2.5 no-scrollbar items-center bg-purple-50/70 py-1.5 rounded-xl border border-purple-100/80 w-full max-w-full">
          <span className="text-[10px] uppercase font-bold text-purple-700 shrink-0 pl-1">
            Subcategorías:
          </span>

          {/* Opción "Todas" con cantidad total */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setSelectedSubcategoryFilter(null);
            }}
            className={`px-[10px] py-[5px] rounded-[20px] text-[11px] shrink-0 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap leading-none ${
              selectedSubcategoryFilter === null
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white border border-purple-200 hover:bg-purple-100/70'
            }`}
          >
            <span className={`font-semibold ${selectedSubcategoryFilter === null ? 'text-white' : 'text-[#333333]'}`}>
              Todas
            </span>
            <span className={`text-[0.85em] font-normal ${selectedSubcategoryFilter === null ? 'text-white' : 'text-[#71717A]'}`}>
              ({dynamicSubcategoriesData.totalCount})
            </span>
          </button>

          {/* Subcategorías ordenadas: con stock (>0) de mayor a menor, seguidas de las sin stock (===0) al final */}
          {dynamicSubcategoriesData.subcategories.map(sub => {
            const isSelected = selectedSubcategoryFilter === sub.id;
            const hasStock = sub.productCount > 0;

            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedSubcategoryFilter(isSelected ? null : sub.id);
                }}
                title={hasStock ? `${formatCategoryName(sub.name)} (${sub.productCount} disponibles)` : `${formatCategoryName(sub.name)} (Sin stock actualmente)`}
                className={`px-[10px] py-[5px] rounded-[20px] text-[11px] shrink-0 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap leading-none ${
                  !hasStock ? 'opacity-50 hover:opacity-75' : ''
                } ${
                  isSelected
                    ? 'bg-purple-700 text-white shadow-xs'
                    : hasStock
                      ? 'bg-white border border-purple-200/90 hover:bg-purple-100/70'
                      : 'bg-slate-100 border border-slate-200'
                }`}
              >
                <span className={`font-semibold ${isSelected ? 'text-white' : 'text-[#333333]'}`}>
                  {formatCategoryName(sub.name)}
                </span>
                <span className={`text-[0.85em] font-normal ${isSelected ? 'text-white' : 'text-[#71717A]'}`}>
                  ({sub.productCount})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter and Sort Action Bar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              triggerHaptic('light');
              const next = !searchOnlySeasonal;
              setSearchOnlySeasonal(next);
              if (next) setSearchOnlyOffers(false);
            }}
            className={`px-3 py-1 rounded-lg font-black flex items-center gap-1 transition-all text-[11px] sm:text-xs whitespace-nowrap shrink-0 cursor-pointer ${
              searchOnlySeasonal
                ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold'
            }`}
          >
            <Sun className="w-3.5 h-3.5 fill-current text-amber-200" />
            <span>Temporada</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              const next = !searchOnlyOffers;
              setSearchOnlyOffers(next);
              if (next) setSearchOnlySeasonal(false);
            }}
            className={`px-3 py-1 rounded-lg font-black flex items-center gap-1 transition-all text-[11px] sm:text-xs whitespace-nowrap shrink-0 cursor-pointer ${
              searchOnlyOffers
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
            <span>Relámpago</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setSearchOnlyInStock(!searchOnlyInStock);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all text-[11px] sm:text-xs whitespace-nowrap shrink-0 cursor-pointer ${
              searchOnlyInStock
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
            <span>En stock</span>
          </button>
        </div>

        {/* Custom Clean Sort Trigger Button */}
        <button
          onClick={() => {
            triggerHaptic('light');
            setIsSortSheetOpen(true);
          }}
          className="flex items-center gap-1.5 shrink-0 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold text-slate-700 transition-all active:scale-95 cursor-pointer"
        >
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
          <span>{currentSortLabel}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* Active filter summary tag - Only shown when filters/sorting are active */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between bg-purple-50/80 border border-purple-100 px-2.5 py-1 rounded-lg text-[11px] text-purple-900 font-medium animate-fadeIn">
          <span>
            Mostrando <strong>{filtered.length}</strong> {filtered.length === 1 ? 'producto encontrado' : 'productos encontrados'}
          </span>
          <button
            onClick={() => {
              triggerHaptic('light');
              resetSearchFilters();
            }}
            className="font-bold text-purple-700 hover:underline cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Sección: Últimas 5 Búsquedas Realizadas Localmente */}
      {recentSearches.length > 0 && (
        <section 
          id="section-recent-searches"
          aria-label="Búsquedas recientes"
          className="bg-white rounded-2xl border border-slate-200/90 p-2 sm:p-2.5 shadow-2xs space-y-1.5 animate-fadeIn overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-800">
              <History className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <h4 className="text-xs font-bold tracking-tight text-slate-900">
                Búsquedas recientes
              </h4>
              <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded-full leading-tight">
                {recentSearches.length}
              </span>
            </div>

            <button
              type="button"
              id="btn-clear-recent-searches"
              onClick={() => {
                triggerHaptic('light');
                clearRecentSearches();
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer select-none"
              title="Borrar historial local de búsquedas"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Borrar historial</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 w-full max-w-full">
            {recentSearches.map((term, idx) => {
              const isActive = deferredSearchQuery.trim().toLowerCase() === term.toLowerCase();

              return (
                <div
                  key={`recent-${term}-${idx}`}
                  onClick={() => {
                    triggerHaptic('selection');
                    setSearchQuery(term);
                    addRecentSearch(term);
                  }}
                  className={`group inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] shrink-0 whitespace-nowrap transition-all border cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                      : 'bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-900 border-slate-200/90 hover:border-purple-200 font-medium'
                  }`}
                  title={`Buscar "${term}"`}
                >
                  <Search className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-purple-600'}`} />
                  <span className="truncate max-w-[165px] sm:max-w-[220px]">{term}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      removeRecentSearch(term);
                    }}
                    className={`p-0.5 rounded-full transition-colors shrink-0 ${
                      isActive 
                        ? 'text-white/80 hover:text-white hover:bg-purple-800' 
                        : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200'
                    }`}
                    title={`Eliminar "${term}" de búsquedas recientes`}
                    aria-label={`Eliminar "${term}"`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Ofertas de Temporada Banner - Compacto, profesional y elegante */}
      {searchOnlySeasonal && filtered.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-rose-500/10 border border-orange-200/90 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sun className="w-3 h-3 fill-current" />
            </div>
            <span className="text-xs font-black text-slate-800 truncate">
              🌸 Temporada Primavera / Verano 2026
            </span>
            <span className="hidden sm:inline-block text-[10px] font-bold text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded-md">
              Hasta 50% OFF
            </span>
          </div>
          <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
            {filtered.length} productos
          </span>
        </div>
      )}

      {/* Ofertas Relámpago Banner (solo cuando el filtro Ofertas está activo Y hay productos) */}
      {searchOnlyOffers && filtered.length > 0 && (
        <SearchFlashBanner count={filtered.length} />
      )}

      {/* Products Results Grid or Clean Empty State positioned right below filters */}
      {filtered.length === 0 ? (
        <div className="py-8 sm:py-10 text-center space-y-2.5 bg-white rounded-2xl border border-slate-100/90 p-6 shadow-2xs mt-1 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-inner">
            <Search className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No encontramos productos con esos filtros</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Probá buscando términos más generales como "organizador", "luz", "cargador" o eliminá los filtros activos.
          </p>
          <div className="pt-1 flex flex-col items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('light');
                resetSearchFilters();
              }}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <span>Restablecer búsqueda</span>
            </button>

            {recentSearches.length > 0 && (
              <div className="pt-3 border-t border-slate-100 w-full max-w-sm">
                <p className="text-[11px] font-semibold text-slate-500 mb-2">
                  O probá con una de tus búsquedas recientes:
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {recentSearches.map((term, idx) => (
                    <button
                      key={`empty-rec-${term}-${idx}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setSearchQuery(term);
                        addRecentSearch(term);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-medium transition-all active:scale-95 cursor-pointer"
                    >
                      <Search className="w-3 h-3 text-purple-600" />
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Adaptive Results Layout: Proportional centering when 1 product, clean responsive grid when multiple */}
          {paginatedFiltered.length === 1 ? (
            <div className="flex justify-center py-2">
              <div className="w-full max-w-[240px] sm:max-w-[260px]">
                <ProductCard product={paginatedFiltered[0]} priority={true} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {paginatedFiltered.map((product, idx) => (
                <ProductCard key={product.id} product={product} priority={idx < 6} />
              ))}
            </div>
          )}

          {/* Continuous Scroll Sentinel & Progressive Loading Indicator */}
          {hasMore && (
            <div 
              ref={setSentinelRef} 
              className="pt-5 pb-3 flex flex-col items-center justify-center gap-2"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-full shadow-2xs">
                <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                <span>Cargando más productos ({loadedCount} de {totalCount})...</span>
              </div>
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
        </div>
      )}

      {/* Clean Bottom Sheet Modal for Sorting */}
      {isSortSheetOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSortSheetOpen(false)}
          />

          {/* Bottom Sheet Container */}
          <div className="relative w-full max-w-lg bg-white rounded-t-[20px] p-4 pb-8 shadow-2xl z-10 animate-slideUp">
            {/* Drag handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#1E1E1E]">Ordenar por</h3>
              <button
                onClick={() => setIsSortSheetOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="divide-y divide-slate-100 mt-1">
              {sortOptions.map((opt) => {
                const isSelected = searchSortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSearchSortBy(opt.id);
                      setIsSortSheetOpen(false);
                    }}
                    className="w-full flex items-center justify-between py-3.5 text-left text-sm font-semibold text-[#1E1E1E] hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>{opt.label}</span>

                    {/* Radio Button with VONDRO Purple Accent */}
                    <div 
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-purple-700 bg-white' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-700 animate-scaleIn" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
