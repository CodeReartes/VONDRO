import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, 
  ShoppingCart, 
  Truck, 
  ArrowRight, 
  X, 
  CheckCircle2, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';

export const CartSavedHeadsUp: React.FC = () => {
  const { 
    cart, 
    cartSubtotal, 
    freeShippingThreshold, 
    isFreeShipping, 
    amountForFreeShipping, 
    progressToFreeShipping,
    activeTab, 
    setActiveTab,
    setIsCartPillVisible
  } = useStore();

  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [lastAddedItemName, setLastAddedItemName] = useState<string>('');
  const prevCartLengthRef = useRef<number>(cart.length);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger heads-up popup whenever a new item is added or cart increases
  useEffect(() => {
    if (cart.length > prevCartLengthRef.current) {
      const latestItem = cart[cart.length - 1];
      if (latestItem?.product?.name) {
        setLastAddedItemName(latestItem.product.name);
      }
      setIsVisible(true);
      setIsMinimized(false);
      triggerHaptic('success');

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      // Auto-minimize after 7 seconds so it doesn't block the screen
      hideTimerRef.current = setTimeout(() => {
        setIsMinimized(true);
      }, 7000);
    } else if (cart.length === 0) {
      setIsVisible(false);
      setIsMinimized(false);
    }
    prevCartLengthRef.current = cart.length;
  }, [cart]);

  // Don't show inside cart, checkout, admin or login
  const isHiddenView = activeTab === 'cart' || activeTab === 'checkout' || activeTab === 'admin' || activeTab === 'login';

  // Sync pill visibility to global store so AI Assistant bot can adaptively elevate
  useEffect(() => {
    const isPillActive = Boolean(isMinimized && isVisible && !isHiddenView && cart.length > 0);
    setIsCartPillVisible(isPillActive);

    return () => {
      setIsCartPillVisible(false);
    };
  }, [isMinimized, isVisible, isHiddenView, cart.length, setIsCartPillVisible]);

  if (isHiddenView || cart.length === 0 || !isVisible) {
    return null;
  }

  const handleOpenCart = () => {
    triggerHaptic('medium');
    setIsVisible(false);
    setIsMinimized(false);
    setIsCartPillVisible(false);
    setActiveTab('cart');
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setIsMinimized(true);
  };

  const handleCloseCompletely = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    setIsVisible(false);
    setIsMinimized(false);
    setIsCartPillVisible(false);
  };

  // Minimized floating floating pill above bottom nav
  if (isMinimized) {
    return (
      <div 
        onClick={handleOpenCart}
        className="fixed bottom-20 right-3 z-40 animate-bounce-subtle cursor-pointer group"
      >
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 text-white px-3.5 py-2 rounded-full shadow-xl border border-purple-400/40 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
          <div className="relative">
            <ShoppingCart className="w-4 h-4 text-amber-300" />
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          </div>
          <div className="text-left">
            <span className="text-[10px] font-black text-white block leading-tight">
              ${cartSubtotal.toLocaleString('es-AR')}
            </span>
            <span className="text-[8.5px] text-purple-200 block leading-none font-bold">
              {isFreeShipping ? 'Envío Gratis 🎉' : `Faltan $${amountForFreeShipping.toLocaleString('es-AR')}`}
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-purple-300 group-hover:translate-x-0.5 transition-transform" />
          <button
            type="button"
            onClick={handleCloseCompletely}
            className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center -mr-1 transition-colors cursor-pointer"
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
          >
            <X className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>
      </div>
    );
  }

  // Full Smart Heads-up Top Banner
  return (
    <div className="fixed top-2.5 sm:top-3.5 left-2.5 right-2.5 sm:left-auto sm:right-6 z-[99998] sm:max-w-md animate-in slide-in-from-top-4 duration-300">
      <div 
        onClick={handleOpenCart}
        className="bg-slate-950/95 backdrop-blur-md text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl border border-purple-500/40 cursor-pointer hover:border-purple-400 transition-all relative overflow-hidden group"
      >
        {/* Animated ambient glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3 relative z-10">
          {/* Left Icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shrink-0 shadow-md">
            <Flame className="w-5 h-5 text-white animate-pulse" />
          </div>

          {/* Center Info */}
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="bg-amber-400/20 text-amber-300 text-[9.5px] font-black uppercase px-2 py-0.2 rounded-full border border-amber-400/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>CARRITO GUARDADO</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {cart.reduce((a, b) => a + b.quantity, 0)} {cart.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-black text-white leading-tight">
              🔥 ¡Guardamos tu producto en el carrito!
            </h4>

            {/* Free Shipping Dynamic Calculator */}
            <div className="mt-1.5 space-y-1">
              {isFreeShipping ? (
                <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>¡Tenés Envío Gratis en Córdoba asegurado!</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-200">
                  Te faltan <strong className="text-amber-300 font-black">${amountForFreeShipping.toLocaleString('es-AR')}</strong> para el <span className="font-bold text-white">Envío Gratis a Córdoba 🚚</span>
                </div>
              )}

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isFreeShipping 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                      : 'bg-gradient-to-r from-amber-400 to-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(10, progressToFreeShipping))}%` }}
                />
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-black text-white">
                Total: <span className="text-amber-300 font-mono">${cartSubtotal.toLocaleString('es-AR')}</span>
              </span>

              <button
                type="button"
                onClick={handleOpenCart}
                className="bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-black px-3 py-1 rounded-lg flex items-center gap-1 shadow-xs group-hover:scale-102 transition-transform"
              >
                <span>Ver Carrito</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Close / Minimize Button */}
          <button
            type="button"
            onClick={handleDismiss}
            title="Minimizar aviso"
            className="absolute top-1 right-1 p-1 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
