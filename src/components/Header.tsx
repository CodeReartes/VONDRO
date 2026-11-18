import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  ShoppingCart, 
  X,
  Sparkles,
  Camera,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Menu,
  Bell,
  History,
  TrendingUp,
  Sun,
  Zap
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { VondroLogo } from './VondroLogo';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';
import { formatCategoryName } from '../utils/textUtils';
import { getSortedCategoriesWithStats } from '../utils/categorySorting';
import { CustomerNotificationsModal } from './CustomerNotificationsModal';
import { checkIsAdminEmail } from '../lib/authService';

interface HeaderProps {
  onOpenDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDrawer }) => {
  const { 
    activeTab, 
    setActiveTab, 
    cartCount, 
    searchQuery, 
    setSearchQuery, 
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    setSearchOnlySeasonal,
    setSearchOnlyOffers,
    settings,
    isAdmin,
    user,
    products,
    categories,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    selectedProduct,
    openProductDetail,
    notifications
  } = useStore();

  const [showVisualSearchModal, setShowVisualSearchModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      const inMobile = searchDropdownRef.current && searchDropdownRef.current.contains(target);
      const inDesktop = desktopSearchRef.current && desktopSearchRef.current.contains(target);
      if (!inMobile && !inDesktop) {
        setIsSearchDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const customerUnreadCount = useMemo(() => {
    return (notifications || []).filter(n => !n.read && (
      n.type === 'FLASH_OFFER' || 
      n.type === 'PRICE_DROP' || 
      n.type === 'CUSTOM_PROMO' ||
      n.type === 'ORDER_CREATED' ||
      n.type === 'ORDER_PREPARING_PENDING' ||
      n.type === 'ORDER_SHIPPED' || 
      n.type === 'ORDER_OUT_FOR_DELIVERY' || 
      n.type === 'ORDER_DELIVERED' || 
      n.type === 'ORDER_ARRIVED_TODAY' ||
      n.type === 'PAYMENT_APPROVED' || 
      n.targetAudience === 'customer' || 
      n.targetAudience === 'all'
    )).length;
  }, [notifications]);

  // Monitor window scroll to apply elevation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 4);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Smart dynamic sorting for category tabs
  const dynamicCategoriesData = useMemo(() => {
    return getSortedCategoriesWithStats(categories || [], products || []);
  }, [categories, products]);

  // Auto-close modal whenever user navigates or selects product
  useEffect(() => {
    if (showVisualSearchModal) {
      setShowVisualSearchModal(false);
    }
  }, [activeTab, selectedProduct]);

  const handleVisualSearch = (keyword?: string) => {
    triggerHaptic('medium');
    setShowVisualSearchModal(false);
    const term = keyword || 'Auriculares';
    setSearchQuery(term);
    addRecentSearch(term);
    setActiveTab('search');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic('selection');
    setIsAnalyzingImage(true);

    setTimeout(() => {
      setIsAnalyzingImage(false);
      setShowVisualSearchModal(false);
      // Set search query based on random popular tag or image name
      const term = 'Lámpara LED';
      setSearchQuery(term);
      addRecentSearch(term);
      setActiveTab('search');
      triggerHaptic('success');
    }, 900);
  };

  return (
    <header 
      className={`sticky top-0 ${isSearchDropdownOpen ? 'z-50' : 'z-40'} w-full bg-white/95 backdrop-blur-md border-b transition-all duration-200 ${
        isScrolled 
          ? 'shadow-[0_2px_8px_rgba(0,0,0,0.08)] border-slate-200/90' 
          : 'border-slate-100/80 shadow-none'
      }`}
    >
      {/* Header Principal: Isologo VONDRO + Buscador Integrado (Desktop) + Notificaciones y Carrito */}
      <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 py-1.5 flex items-center justify-between sm:justify-start gap-2 sm:gap-3 min-w-0">
        {/* Left: Drawer Toggle & Brand Logo */}
        <div className="flex items-center gap-1 shrink-0">
          {onOpenDrawer && (
            <button
              id="btn-header-drawer-toggle"
              onClick={() => {
                triggerHaptic('light');
                onOpenDrawer();
              }}
              className="p-1 -ml-1 text-slate-700 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Abrir categorías y menú"
              title="Categorías y Menú"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <button
            id="btn-header-logo"
            onClick={() => {
              scrollToTop();
              setActiveTab('home');
            }}
            className="flex items-center group transition-transform active:scale-95 shrink-0 cursor-pointer"
          >
            <VondroLogo variant="horizontal" size="sm" />
          </button>
          {isAdmin && user && (user.role === 'admin' || checkIsAdminEmail(user.email)) && (
            <button 
              onClick={() => setActiveTab('admin')} 
              className="text-[9px] bg-amber-400 text-amber-950 font-extrabold px-1.5 py-0.5 rounded-full hover:bg-amber-300 transition-colors shrink-0 ml-1 cursor-pointer"
              title="Ir a panel de administración"
            >
              Admin
            </button>
          )}
        </div>

        {/* Center: Integrated Inline Search Bar (Desktop: sm:flex) */}
        <div className="hidden sm:flex flex-1 min-w-0 max-w-xl mx-2 relative" ref={desktopSearchRef}>
          <div className="relative w-full flex items-center bg-slate-100/90 rounded-full border border-slate-200/90 focus-within:border-purple-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100 transition-all p-0.5">
            <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
            <input
              id="input-header-search-desktop"
              type="text"
              placeholder="Buscar productos, marcas, ofertas en Córdoba..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim().length > 0) {
                  setIsSearchDropdownOpen(false);
                }
                if (activeTab !== 'search') {
                  setActiveTab('search');
                }
              }}
              onFocus={() => {
                if (!searchQuery.trim()) {
                  setIsSearchDropdownOpen(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchQuery.trim().length >= 2) {
                    addRecentSearch(searchQuery.trim());
                  }
                  triggerHaptic('light');
                  setIsSearchDropdownOpen(false);
                  if (activeTab !== 'search') {
                    setActiveTab('search');
                  }
                }
              }}
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 pl-2 pr-16 py-1.5 outline-none"
            />

            <div className="absolute right-1 flex items-center gap-0.5">
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setShowVisualSearchModal(true);
                  }}
                  className="p-1 text-purple-700 hover:text-purple-900 active:scale-95 transition-transform cursor-pointer"
                  title="Búsqueda por Foto / Cámara"
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              )}

              <button
                onClick={() => {
                  triggerHaptic('light');
                  if (searchQuery.trim().length >= 2) {
                    addRecentSearch(searchQuery.trim());
                  }
                  setIsSearchDropdownOpen(false);
                  setActiveTab('search');
                }}
                className="w-7 h-7 rounded-full bg-slate-950 hover:bg-purple-700 text-white flex items-center justify-center transition-colors shadow-xs shrink-0 cursor-pointer"
                title="Buscar"
              >
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Actions: Notifications & Cart */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            id="btn-header-notifications"
            onClick={() => {
              triggerHaptic('light');
              setShowNotificationsModal(true);
            }}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95 transition-all relative shrink-0 cursor-pointer"
            aria-label="Avisos y Ofertas"
            title="Avisos y Ofertas"
          >
            <div className="relative">
              <Bell className="w-5 h-5 text-slate-800" />
              {customerUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-3.5 h-3.5 px-1 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs animate-bounce">
                  {customerUnreadCount > 9 ? '9+' : customerUnreadCount}
                </span>
              )}
            </div>
          </button>

          <button
            id="btn-header-cart"
            onClick={() => setActiveTab('cart')}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95 transition-all relative shrink-0 cursor-pointer"
            aria-label="Ver carrito"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 text-slate-800" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-purple-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs animate-scaleIn">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Nivel 3 (Mobile only): Full-width spacious Search Bar */}
      <div className="sm:hidden w-full px-2.5 pb-2 pt-0.5 relative min-w-0 z-50" ref={searchDropdownRef}>
        <div className="relative z-50 flex items-center bg-slate-100 rounded-xl border border-slate-200/90 focus-within:border-purple-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100 transition-all p-0.5 shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
          <input
            id="input-header-search"
            type="text"
            placeholder="Buscar productos, marcas, ofertas..."
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim().length > 0) {
                setIsSearchDropdownOpen(false);
              } else {
                setIsSearchDropdownOpen(true);
              }
              if (activeTab !== 'search') {
                setActiveTab('search');
              }
            }}
            onFocus={() => {
              if (!searchQuery.trim()) {
                setIsSearchDropdownOpen(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (searchQuery.trim().length >= 2) {
                  addRecentSearch(searchQuery.trim());
                }
                triggerHaptic('light');
                setIsSearchDropdownOpen(false);
                if (activeTab !== 'search') {
                  setActiveTab('search');
                }
              }
            }}
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 pl-2 pr-16 py-2 outline-none"
          />

          <div className="absolute right-1 flex items-center gap-1">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowVisualSearchModal(true);
                }}
                className="p-1.5 text-purple-700 hover:text-purple-900 active:scale-95 transition-transform cursor-pointer"
                title="Búsqueda por Foto / Cámara"
              >
                <Camera className="w-4 h-4 stroke-[2]" />
              </button>
            )}

            <button
              onClick={() => {
                triggerHaptic('light');
                if (searchQuery.trim().length >= 2) {
                  addRecentSearch(searchQuery.trim());
                }
                setIsSearchDropdownOpen(false);
                setActiveTab('search');
              }}
              className="w-7 h-7 rounded-lg bg-slate-950 hover:bg-purple-700 text-white flex items-center justify-center transition-colors shadow-xs shrink-0 cursor-pointer"
              title="Buscar"
            >
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Search Helper Dropdown for Mobile */}
        {isSearchDropdownOpen && (
          <>
            {/* Backdrop portal mounted BELOW header (z-40 vs header z-50) so search input stays 100% crisp, focused & clickable */}
            {typeof document !== 'undefined' && createPortal(
              <div 
                className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] transition-opacity sm:hidden"
                onClick={() => setIsSearchDropdownOpen(false)}
                onTouchStart={() => setIsSearchDropdownOpen(false)}
                aria-hidden="true"
              />,
              document.body
            )}

            <div className="absolute top-full left-2.5 right-2.5 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 space-y-2.5 animate-fadeIn">
              {/* Header with Title and explicit Close 'X' Button */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-purple-600" />
                  Sugerencias de búsqueda
                </span>
                <button
                  type="button"
                  id="btn-close-search-dropdown"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setIsSearchDropdownOpen(false);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 text-[11px] font-bold transition-all cursor-pointer"
                  title="Cerrar sugerencias"
                >
                  <span>Cerrar</span>
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>

              {recentSearches.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                  <span className="flex items-center gap-1 text-slate-700">
                    <History className="w-3.5 h-3.5 text-purple-600" />
                    Búsquedas recientes
                  </span>
                  <button
                    onClick={() => clearRecentSearches()}
                    className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                  >
                    Borrar historial
                  </button>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 w-full">
                  {recentSearches.map(term => (
                    <div
                      key={term}
                      onClick={() => {
                        triggerHaptic('light');
                        setSearchQuery(term);
                        setIsSearchDropdownOpen(false);
                        setActiveTab('search');
                      }}
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-800 text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-colors shrink-0 whitespace-nowrap"
                    >
                      <span className="truncate max-w-[165px]">{term}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(term);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-0.5 rounded-full shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                Consultas sugeridas
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSearchOnlySeasonal(true);
                    setSearchOnlyOffers(false);
                    setIsSearchDropdownOpen(false);
                    setActiveTab('search');
                  }}
                  className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 font-bold text-xs px-2.5 py-1 rounded-full hover:bg-orange-100 cursor-pointer"
                >
                  <Sun className="w-3 h-3 text-orange-600 fill-current" />
                  <span>🌸 Ofertas de Temporada</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSearchOnlyOffers(true);
                    setSearchOnlySeasonal(false);
                    setIsSearchDropdownOpen(false);
                    setActiveTab('search');
                  }}
                  className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs px-2.5 py-1 rounded-full hover:bg-amber-100 cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-amber-600 fill-current" />
                  <span>⚡ Ofertas Relámpago</span>
                </button>
                {['Termos y Mates', 'Vasos Quencher', 'Ventiladores', 'Auriculares'].map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSearchQuery(item);
                      setIsSearchDropdownOpen(false);
                      setActiveTab('search');
                    }}
                    className="inline-flex items-center bg-slate-50 border border-slate-200/80 text-slate-700 text-xs px-2.5 py-1 rounded-full hover:bg-purple-50 hover:text-purple-700 cursor-pointer"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Horizontal Category Chips Bar (Directly beneath search) */}
      {activeTab === 'home' && (
        <div className="w-full max-w-full border-t border-slate-100/80 bg-white px-3 py-2 overflow-x-auto no-scrollbar scroll-smooth">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-max text-xs">
            {/* Chip "Todos" */}
            <button
              id="chip-cat-home-all"
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setSelectedCategoryFilter(null);
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

            {/* Chips de categorías */}
            {dynamicCategoriesData.categories.map((cat) => {
              const isSelected = selectedCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`chip-cat-home-${cat.id}`}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    if (isSelected) {
                      setSelectedCategoryFilter(null);
                    } else {
                      setSelectedCategoryFilter(cat.id);
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
        </div>
      )}

      {/* Visual Search Modal mounted at document.body level via React Portal to prevent clipping */}
      {showVisualSearchModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          {/* Backdrop Click */}
          <div 
            className="absolute inset-0 cursor-pointer"
            onClick={() => {
              triggerHaptic('light');
              setShowVisualSearchModal(false);
            }}
          />

          {/* Modal Container */}
          <div 
            className="relative w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 z-10 space-y-4 animate-scaleIn max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-inner">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                    <span>Búsqueda por Foto</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  </h3>
                  <p className="text-[11px] text-slate-500">Encontrá productos por imagen</p>
                </div>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowVisualSearchModal(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hidden native inputs */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Dos opciones claras: Galería y Cámara directa */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Opción 1: Subir de Galería / Descargas / Capturas */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  galleryInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-600 bg-purple-50/70 hover:bg-purple-100/60 active:scale-95 transition-all text-center group cursor-pointer shadow-2xs"
              >
                <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-purple-950 block leading-tight">
                  Elegir de Galería
                </span>
                <span className="text-[10px] text-purple-700/80 mt-0.5">
                  Fotos o capturas web
                </span>
              </button>

              {/* Opción 2: Tomar Foto con la Cámara */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  cameraInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/60 active:scale-95 transition-all text-center group cursor-pointer shadow-2xs"
              >
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-xs">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-indigo-950 block leading-tight">
                  Tomar Foto
                </span>
                <span className="text-[10px] text-indigo-700/80 mt-0.5">
                  Cámara en vivo
                </span>
              </button>
            </div>

            {/* Analysis Loading State */}
            {isAnalyzingImage && (
              <div className="p-3 bg-purple-900 text-white rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>Analizando imagen con IA...</span>
              </div>
            )}

            {/* Sample Images Suggestions */}
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2">O probá buscando por imágenes ejemplo:</p>
              <div className="grid grid-cols-3 gap-2">
                {(products || []).slice(0, 3).map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      triggerHaptic('selection');
                      setShowVisualSearchModal(false);
                      openProductDetail(p);
                    }}
                    className="group flex flex-col items-stretch bg-slate-50 hover:bg-purple-50/40 border border-slate-200 rounded-xl overflow-hidden hover:border-purple-500 transition-all active:scale-95 text-center cursor-pointer shadow-2xs"
                  >
                    {/* Fixed Height Image Container */}
                    <div className="w-full h-[70px] bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border-b border-slate-100">
                      <img 
                        src={p.images[0]} 
                        alt={p.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    </div>
                    {/* Dedicated Text Container Below Image */}
                    <div className="px-1.5 py-1 flex items-center justify-center min-h-[36px] bg-white">
                      <p className="text-[11px] font-bold text-slate-800 text-center leading-[1.2] line-clamp-2 overflow-hidden w-full">
                        {p.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Customer Notifications Drawer / Modal */}
      <CustomerNotificationsModal 
        isOpen={showNotificationsModal} 
        onClose={() => setShowNotificationsModal(false)} 
      />
    </header>
  );
};

