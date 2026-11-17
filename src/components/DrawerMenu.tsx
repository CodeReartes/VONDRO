import React, { useState, useMemo } from 'react';
import { 
  X, 
  Home, 
  Search, 
  Package, 
  LogOut, 
  ShieldCheck,
  ChevronRight, 
  ChevronDown,
  Truck,
  Sparkles,
  Headphones,
  Volume2,
  Zap,
  Smartphone,
  Cpu,
  Shirt,
  Wrench,
  Lightbulb,
  ChefHat,
  Boxes,
  Droplets,
  Scissors,
  BookOpen,
  Gamepad2,
  Coffee,
  Utensils,
  CupSoda,
  Briefcase,
  Baby,
  Globe,
  Tag,
  Sun,
  Star,
  Heart,
  Flame,
  Layers
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { VondroLogo } from './VondroLogo';
import { triggerHaptic } from '../utils/native';
import { formatCategoryName } from '../utils/textUtils';
import { getSortedCategoriesWithStats, getSortedSubcategoriesWithStats } from '../utils/categorySorting';
import { Category } from '../types';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icon mapper for categories
const getCategoryIcon = (name: string) => {
  const n = (name || '').toLowerCase().trim();
  if (n.includes('auricular')) return Headphones;
  if (n.includes('audio') || n.includes('sonido')) return Volume2;
  if (n.includes('cargador') || n.includes('cable') || n.includes('enchufe')) return Zap;
  if (n.includes('iphone') || n.includes('celular') || n.includes('telefono')) return Smartphone;
  if (n.includes('tecnolog') || n.includes('computac')) return Cpu;
  if (n.includes('indumentaria') || n.includes('ropa') || n.includes('blanquer')) return Shirt;
  if (n.includes('herramienta')) return Wrench;
  if (n.includes('iluminac') || n.includes('luz') || n.includes('lampara')) return Lightbulb;
  if (n.includes('cocina')) return ChefHat;
  if (n.includes('hogar')) return Home;
  if (n.includes('organizac')) return Boxes;
  if (n.includes('grifer') || n.includes('bano')) return Droplets;
  if (n.includes('estetica') || n.includes('belleza') || n.includes('cuidado')) return Scissors;
  if (n.includes('escolar') || n.includes('libreria')) return BookOpen;
  if (n.includes('entretenimiento') || n.includes('juego')) return Gamepad2;
  if (n.includes('termo') || n.includes('mate')) return Coffee;
  if (n.includes('vajilla')) return Utensils;
  if (n.includes('vaso') || n.includes('botella')) return CupSoda;
  if (n.includes('marroquiner') || n.includes('bolso') || n.includes('mochila')) return Briefcase;
  if (n.includes('infantil') || n.includes('nino') || n.includes('bebe') || n.includes('juguete')) return Baby;
  if (n.includes('importac')) return Globe;
  if (n.includes('oferta')) return Tag;
  if (n.includes('verano')) return Sun;
  if (n.includes('stitch')) return Star;
  if (n.includes('labubu')) return Sparkles;
  if (n.includes('capibara')) return Heart;
  if (n.includes('quencher')) return Flame;
  if (n.includes('varios') || n.includes('otro')) return Layers;
  if (n.includes('accesorio')) return Sparkles;
  return Package;
};

// Check if category is a specialized trend / character / season collection
const isTrendOrCollection = (name: string) => {
  const n = (name || '').toLowerCase().trim();
  return (
    n.includes('stitch') ||
    n.includes('labubu') ||
    n.includes('capibara') ||
    n.includes('quencher') ||
    n.includes('verano') ||
    n.includes('oferta') ||
    n.includes('novedad') ||
    n.includes('coleccion') ||
    n.includes('tendencia')
  );
};

export const DrawerMenu: React.FC<DrawerMenuProps> = ({ isOpen, onClose }) => {
  const { 
    categories, 
    products,
    setActiveTab, 
    setSelectedCategoryFilter, 
    setSelectedSubcategoryFilter, 
    settings, 
    user, 
    isAdmin, 
    setIsAdmin, 
    signOut
  } = useStore();

  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Memoized subcategories map with dynamic product count and sorting by category ID (only in-stock)
  const subcategoriesByCategory = useMemo(() => {
    const map = new Map<string, Array<any>>();
    (categories || []).forEach(cat => {
      if (!cat.subcategories || cat.subcategories.length === 0) return;
      const sortedSub = getSortedSubcategoriesWithStats(cat, products || [], true);
      if (sortedSub.subcategories.length > 0) {
        map.set(cat.id, sortedSub.subcategories);
      }
    });
    return map;
  }, [categories, products]);

  // Split categories into Main Categories vs Collections & Trends (only categories with available stock)
  const { categoriesStatsMap, sortedMainCategories, sortedCollectionCategories } = useMemo(() => {
    const { categories: sortedAll } = getSortedCategoriesWithStats(categories || [], products || [], true);
    const statsMap = new Map<string, (typeof sortedAll)[0]>();
    const main: typeof sortedAll = [];
    const collections: typeof sortedAll = [];

    sortedAll.forEach(cat => {
      statsMap.set(cat.id, cat);
      if (isTrendOrCollection(cat.name)) {
        collections.push(cat);
      } else {
        main.push(cat);
      }
    });

    return { 
      categoriesStatsMap: statsMap, 
      sortedMainCategories: main, 
      sortedCollectionCategories: collections 
    };
  }, [categories, products]);

  if (!isOpen) return null;

  const handleSelectCategory = (categoryId: string, subcategoryId?: string) => {
    triggerHaptic();
    setSelectedCategoryFilter(categoryId);
    if (setSelectedSubcategoryFilter) {
      setSelectedSubcategoryFilter(subcategoryId || null);
    }
    setActiveTab('search');
    onClose();
  };

  const handleNavigate = (tab: any) => {
    triggerHaptic();
    setActiveTab(tab);
    onClose();
  };

  const handleLogout = async () => {
    triggerHaptic();
    await signOut();
    onClose();
  };

  const isUserAdmin = isAdmin || user?.role === 'admin' || user?.email?.toLowerCase().trim() === 'reartes17diego@gmail.com';

  const renderCategoryItem = (cat: Category, isSpecial = false) => {
    const subcats = subcategoriesByCategory.get(cat.id) || [];
    const hasSub = subcats.length > 0;
    const isExpanded = expandedCategoryId === cat.id;
    const IconComponent = getCategoryIcon(cat.name);
    const catStats = categoriesStatsMap.get(cat.id);
    const count = catStats?.productCount ?? 0;
    const hasStock = count > 0;

    return (
      <div key={cat.id} className="rounded-xl overflow-hidden">
        <div className={`flex items-center justify-between w-full hover:bg-slate-50 transition-colors rounded-xl ${
          isSpecial ? 'hover:bg-purple-50/50' : ''
        } ${!hasStock ? 'opacity-55' : ''}`}>
          <button
            onClick={() => {
              if (hasSub) {
                setExpandedCategoryId(isExpanded ? null : cat.id);
              } else {
                handleSelectCategory(cat.id);
              }
            }}
            className="flex-1 px-3 py-3 text-xs font-bold text-slate-800 text-left flex items-center justify-between gap-2.5 active:scale-98 transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isSpecial 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                <IconComponent className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span className="truncate tracking-tight">{formatCategoryName(cat.name)}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ${
                  hasStock 
                    ? 'bg-purple-100/70 text-purple-700 font-semibold'
                    : 'bg-slate-200/80 text-slate-500'
                }`}>
                  ({count})
                </span>
              </div>
            </div>

            {hasSub ? (
              <div className="p-0.5 rounded-md text-slate-400 shrink-0">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-purple-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            )}
          </button>
        </div>

        {/* Subcategories Accordion */}
        {hasSub && isExpanded && (
          <div className="pl-4 pr-2 py-1.5 bg-purple-50/50 rounded-b-xl space-y-0.5 border-l-2 border-purple-500 ml-4 mb-1">
            <button
              onClick={() => handleSelectCategory(cat.id)}
              className="w-full px-2.5 py-2 text-left text-[11px] font-bold text-purple-700 hover:bg-purple-100/60 rounded-lg flex items-center justify-between cursor-pointer"
            >
              <span>Ver todo en {formatCategoryName(cat.name)}</span>
              <ChevronRight className="w-3 h-3 text-purple-500" />
            </button>
            {subcats.map((sub: any) => {
              const count = sub.productCount ?? 0;
              const hasStock = count > 0;

              return (
                <button
                  key={sub.id}
                  onClick={() => handleSelectCategory(cat.id, sub.id)}
                  className={`w-full px-2.5 py-2 text-left text-[11px] font-medium rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                    !hasStock 
                      ? 'opacity-50 text-slate-500 hover:text-slate-700' 
                      : 'text-slate-700 hover:text-purple-700 hover:bg-white'
                  }`}
                >
                  <span className="truncate">{formatCategoryName(sub.name)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-100/70 text-purple-700 font-semibold">
                      ({count})
                    </span>
                    <span className="text-[10px] text-slate-400">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Drawer */}
      <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl z-10 flex flex-col justify-between overflow-y-auto">
        <div>
          {/* Header */}
          <div className="p-4 pt-5 bg-gradient-to-r from-purple-800 to-indigo-900 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <VondroLogo variant="horizontal" size="sm" className="brightness-200 contrast-200" />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick links */}
          <div className="p-3 pt-3.5 border-b border-slate-100 space-y-1">
            <button
              onClick={() => handleNavigate('home')}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <Home className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span>Inicio</span>
            </button>

            <button
              onClick={() => {
                setSelectedCategoryFilter(null);
                handleNavigate('search');
              }}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <Search className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span>Catálogo completo</span>
            </button>

            <button
              onClick={() => handleNavigate('orders')}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span>Mis pedidos</span>
            </button>

            <button
              onClick={() => handleNavigate('help')}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3 transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span>Centro de Ayuda</span>
            </button>

            {/* Admin Switcher - Only visible if logged in with Admin credentials */}
            {isUserAdmin && (
              <button
                onClick={() => {
                  setIsAdmin(true);
                  handleNavigate('admin');
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold text-purple-900 bg-purple-100/70 hover:bg-purple-200/80 flex items-center justify-between transition-colors mt-1 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>Panel Administrador</span>
                </div>
                <span className="text-[9px] bg-purple-700 text-white font-extrabold px-1.5 py-0.5 rounded-md">
                  ADMIN
                </span>
              </button>
            )}
          </div>

          {/* Colecciones / Tendencias (Subgrupo 1) */}
          {sortedCollectionCategories.length > 0 && (
            <div className="p-3 pb-1 space-y-0.5 border-b border-slate-100">
              <div className="px-3 pb-1 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
                <span className="text-[10px] font-extrabold uppercase text-purple-900 tracking-wider">
                  Colecciones y Tendencias ({sortedCollectionCategories.length})
                </span>
              </div>
              {sortedCollectionCategories.map((cat) => renderCategoryItem(cat, true))}
            </div>
          )}

          {/* Categorías Principales (Subgrupo 2) */}
          <div className="p-3 space-y-0.5">
            <div className="px-3 pb-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                Categorías Principales ({sortedMainCategories.length})
              </span>
            </div>
            {sortedMainCategories.map((cat) => renderCategoryItem(cat, false))}
          </div>

          {/* Envíos Info Callout */}
          <div className="p-3">
            <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 text-xs text-purple-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Truck className="w-4 h-4 text-purple-700" />
                <span>Envíos en Córdoba Capital</span>
              </div>
              <p className="text-[11px] text-purple-700">
                ¡Envío gratis a partir de ${(settings?.freeShippingThreshold ?? 100000).toLocaleString('es-AR')}!
              </p>
            </div>
          </div>
        </div>

        {/* Footer with Cerrar sesión */}
        {user && (
          <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50">
            <div className="px-2 py-1 flex items-center justify-between">
              <div className="truncate">
                <span className="text-[11px] font-bold text-slate-800 block truncate">
                  {user.name || user.email}
                </span>
                <span className="text-[10px] text-slate-500 block truncate">
                  {user.email}
                </span>
              </div>
            </div>

            <button
              id="drawer-btn-logout"
              onClick={handleLogout}
              className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-rose-200/60 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
