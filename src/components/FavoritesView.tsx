import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  ShoppingBag, 
  ArrowLeft, 
  Loader2, 
  ShoppingCart, 
  Trash2, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { useProgressivePagination } from '../hooks/useProgressivePagination';
import { triggerHaptic } from '../utils/native';
import { Product } from '../types';

interface ToastState {
  id: string;
  type: 'removed' | 'added_to_cart' | 'cleared';
  message: string;
  product?: Product;
  actionLabel?: string;
  onAction?: () => void;
}

export const FavoritesView: React.FC = () => {
  const { 
    favorites, 
    products, 
    toggleFavorite, 
    clearFavorites, 
    addToCart, 
    setActiveTab 
  } = useStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const prevFavoritesRef = useRef<string[]>(favorites || []);

  const favoriteProducts = useMemo(() => {
    const favSet = new Set(favorites || []);
    return (products || []).filter(p => p && p.id && favSet.has(p.id));
  }, [favorites, products]);

  // Monitor favorite removals to trigger Undo Toast
  useEffect(() => {
    const prev = prevFavoritesRef.current;
    const current = favorites || [];

    if (prev.length > current.length) {
      const removedId = prev.find(id => !current.includes(id));
      if (removedId) {
        const removedProd = products.find(p => p.id === removedId);
        if (removedProd) {
          showUndoToast(removedProd);
        }
      }
    }
    prevFavoritesRef.current = current;
  }, [favorites, products]);

  const showUndoToast = (product: Product) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({
      id: `toast-${Date.now()}`,
      type: 'removed',
      message: 'Producto eliminado de tus favoritos',
      product,
      actionLabel: 'Deshacer',
      onAction: () => {
        triggerHaptic('success');
        toggleFavorite(product.id);
        setToast(null);
      }
    });

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const showCartSuccessToast = (count: number) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast({
      id: `toast-${Date.now()}`,
      type: 'added_to_cart',
      message: `${count} ${count === 1 ? 'producto movido' : 'productos movidos'} al carrito`,
      actionLabel: 'Ver carrito',
      onAction: () => {
        triggerHaptic('light');
        setActiveTab('cart');
        setToast(null);
      }
    });

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Mass action: Move all available favorite products to cart
  const handleMoveAllToCart = () => {
    triggerHaptic('medium');
    const available = favoriteProducts.filter(p => p.stock > 0 && p.stockStatus !== 'out_of_stock');
    
    if (available.length === 0) {
      triggerHaptic('warning');
      setToast({
        id: `toast-${Date.now()}`,
        type: 'removed',
        message: 'No hay productos con stock disponible para mover al carrito.'
      });
      return;
    }

    available.forEach(p => {
      addToCart(p, 1);
    });

    triggerHaptic('success');
    showCartSuccessToast(available.length);
  };

  // Mass action: Clear all favorites
  const handleConfirmClearFavorites = () => {
    triggerHaptic('warning');
    const count = favoriteProducts.length;
    clearFavorites();
    setShowClearConfirm(false);
    
    setToast({
      id: `toast-${Date.now()}`,
      type: 'cleared',
      message: `Se vaciaron ${count} productos de tu lista de favoritos.`
    });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const {
    displayedItems: paginatedFavorites,
    hasMore,
    loadMore,
    totalCount,
    loadedCount,
    setSentinelRef
  } = useProgressivePagination<Product>(favoriteProducts, { batchSize: 24 });

  return (
    <div className="pb-28 max-w-7xl mx-auto px-3 sm:px-4 pt-2 space-y-3 relative">
      {/* Compact Single-Row Header Toolbar */}
      <div className="flex items-center justify-between py-2 border-b border-slate-100">
        {/* Left: Back button, Title and Count Badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className="p-1.5 -ml-1 rounded-full text-slate-700 hover:bg-slate-100 active:scale-95 transition-transform cursor-pointer"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-slate-900 leading-none">Mis favoritos</h1>
            <span className="text-xs font-bold bg-purple-100/80 text-purple-700 px-2 py-0.5 rounded-full">
              {favoriteProducts.length}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons ("Al carrito" + Clear Trash) */}
        {favoriteProducts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              id="btn-favorites-move-all-cart"
              onClick={handleMoveAllToCart}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Mover todos los productos en stock al carrito"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Al carrito</span>
            </button>

            <button
              id="btn-favorites-clear-all"
              onClick={() => {
                triggerHaptic('light');
                setShowClearConfirm(true);
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 rounded-xl transition-colors active:scale-95 cursor-pointer"
              title="Vaciar todos los favoritos"
              aria-label="Vaciar lista"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {favoriteProducts.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-slate-100 p-8 shadow-2xs">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
            <Heart className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Aún no guardaste favoritos</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Toca el corazón ❤️ en cualquier producto para guardarlo y no perder de vista las mejores ofertas y promociones.
          </p>
          <button
            onClick={() => setActiveTab('home')}
            className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-700/20 active:scale-95 cursor-pointer inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Explorar catálogo</span>
          </button>
        </div>
      ) : (
        <div>
          {/* Animated Product Grid with AnimatePresence */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            <AnimatePresence mode="popLayout">
              {paginatedFavorites.map((product, idx) => (
                <motion.div
                  key={`${product.id}-${idx}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85, y: 12 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Continuous Scroll Sentinel & Progressive Loading Indicator */}
          {hasMore && (
            <div 
              ref={setSentinelRef} 
              className="pt-5 pb-3 flex flex-col items-center justify-center gap-2"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-full shadow-2xs">
                <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                <span>Cargando más favoritos ({loadedCount} de {totalCount})...</span>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  loadMore();
                }}
                className="text-xs text-purple-700 font-bold hover:underline py-1 cursor-pointer"
              >
                Cargar más ahora
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Toast / Snackbar for Undo Removal or Bulk Action Confirmation */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-[110] bg-slate-950 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === 'removed' && (
                <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
              )}
              {toast.type === 'added_to_cart' && (
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              {toast.type === 'cleared' && (
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
              )}

              <span className="text-xs font-medium text-slate-100 truncate">
                {toast.message}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {toast.onAction && toast.actionLabel && (
                <button
                  onClick={toast.onAction}
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  {toast.type === 'removed' && <RotateCcw className="w-3 h-3" />}
                  <span>{toast.actionLabel}</span>
                </button>
              )}
              <button
                onClick={() => setToast(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Clearing Favorites */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fadeIn">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowClearConfirm(false)}
          />
          <div className="relative bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl z-10 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">¿Vaciar todos tus favoritos?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta acción eliminará los <strong>{favoriteProducts.length}</strong> productos guardados de tu lista.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClearFavorites}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs shadow-rose-600/20"
              >
                Sí, vaciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
