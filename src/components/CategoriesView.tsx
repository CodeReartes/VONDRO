import React, { useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCategoryName } from '../utils/textUtils';
import { getOptimizedThumbnail } from '../utils/imageOptimizer';
import { triggerHaptic } from '../utils/native';
import { getSortedCategoriesWithStats } from '../utils/categorySorting';

export const CategoriesView: React.FC = () => {
  const { categories, products, setActiveTab, setSelectedCategoryFilter } = useStore();

  const activeCategories = useMemo(() => {
    const { categories: sorted } = getSortedCategoriesWithStats(categories || [], products || [], true);
    return sorted;
  }, [categories, products]);

  const handleSelectCategory = (categoryId: string) => {
    triggerHaptic('light');
    if (categoryId === 'ofertas') {
      setSelectedCategoryFilter(null);
    } else {
      setSelectedCategoryFilter(categoryId);
    }
    setActiveTab('search');
  };

  return (
    <div className="pb-28 max-w-xl mx-auto px-4 pt-2 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 py-2 border-b border-slate-100">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveTab('home');
          }}
          className="p-2 -ml-2 rounded-full text-slate-700 hover:bg-slate-100 active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-900">Categorías ({activeCategories.length})</h1>
          <p className="text-xs text-slate-400">Explorá nuestros productos con stock disponible</p>
        </div>
      </div>

      {/* Grid matching the 2-column image tiles in reference UI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {activeCategories.map((category) => (
          <div
            key={category.id}
            id={`category-tile-${category.id}`}
            onClick={() => handleSelectCategory(category.id)}
            className="group relative aspect-[4/3] rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer border border-slate-100 active:scale-98 bg-slate-100"
          >
            {/* Background Image */}
            <img
              src={getOptimizedThumbnail(category.imageUrl, 400, 75)}
              alt={category.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {/* Dark overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-4">
              <div className="w-full flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-white font-extrabold text-sm sm:text-base tracking-wide drop-shadow-md block truncate">
                    {formatCategoryName(category.name)}
                  </span>
                  <span className="text-[11px] text-white/80 font-medium block">
                    {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
                  </span>
                </div>
                <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-purple-600 transition-colors shrink-0">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
