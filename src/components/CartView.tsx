import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Truck, 
  Sparkles, 
  Tag, 
  ChevronRight, 
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  Check,
  Zap,
  Info,
  ChevronDown
} from 'lucide-react';
import { useStore, getCartItemKey } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { triggerHaptic } from '../utils/native';
import { triggerCelebrationConfetti } from '../utils/confetti';
import { decodeHtmlEntities } from '../utils/imageOptimizer';

export const CartView: React.FC = () => {
  const {
    cart,
    selectedCartItemKeys,
    selectedCartItems,
    toggleCartItemSelection,
    toggleSelectAllCartItems,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    freeShippingThreshold,
    shippingZones,
    selectedZoneId,
    setSelectedZoneId,
    currentShippingCost,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    discountAmount,
    setActiveTab,
    previousTab,
    products,
    openProductDetail
  } = useStore();

  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showShippingDrawer, setShowShippingDrawer] = useState<boolean>(false);
  const [couponInput, setCouponInput] = useState<string>('');
  const [couponFeedback, setCouponFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [showCouponInput, setShowCouponInput] = useState<boolean>(false);

  // Filter selected cart items from shared StoreContext
  const activeSelectedItems = selectedCartItems;
  
  // Calculate dynamic totals based on selected items
  const activeSubtotal = activeSelectedItems.reduce(
    (acc, item) => {
      const price = (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : (item.product.salePrice || 0);
      return acc + (price * (item.quantity || 0));
    }, 
    0
  );

  // Original list price total for discount percentage display
  const activeOriginalTotal = activeSelectedItems.reduce(
    (acc, item) => {
      const price = (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : (item.product.salePrice || 0);
      const orig = item.product.originalPrice && item.product.originalPrice > price
        ? item.product.originalPrice
        : Math.round(price * 1.35);
      return acc + (orig * item.quantity);
    },
    0
  );

  const totalDiscountPercentage = activeOriginalTotal > 0 && activeOriginalTotal > activeSubtotal
    ? Math.round(((activeOriginalTotal - activeSubtotal) / activeOriginalTotal) * 100)
    : 0;

  const threshold = freeShippingThreshold ?? 100000;
  const isFreeShipEligible = activeSubtotal >= threshold;
  const remainingForFreeShip = Math.max(0, threshold - activeSubtotal);
  const shippingProgress = Math.min(100, Math.round((activeSubtotal / threshold) * 100));

  const effectiveShippingCost = isFreeShipEligible ? 0 : (currentShippingCost || 3000);
  const finalTotal = Math.max(0, activeSubtotal - (discountAmount || 0) + effectiveShippingCost);

  const validCartItems = cart.filter(item => item && item.product);
  const isAllSelected = validCartItems.length > 0 && validCartItems.every(item => selectedCartItemKeys.includes(getCartItemKey(item)));

  const toggleSelectAll = () => {
    triggerHaptic('light');
    toggleSelectAllCartItems();
  };

  const toggleSelectItem = (key: string) => {
    triggerHaptic('light');
    toggleCartItemSelection(key);
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const res = applyCoupon(couponInput);
    setCouponFeedback(res);
    if (res.success) {
      setCouponInput('');
      setShowCouponInput(false);
    }
  };

  // Recommendations: products to discover
  const recommendedAddons = products
    .filter(p => p && !cart.some(c => c?.product?.id === p.id) && p.stock > 0)
    .slice(0, 6);

  if (cart.length === 0) {
    return (
      <div className="pb-28 max-w-lg mx-auto px-4 pt-8 text-center space-y-4">
        <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
          <ShoppingBag className="w-8 h-8 stroke-[1.75]" />
        </div>
        <h2 className="text-lg font-black text-slate-800">Tu carrito está vacío</h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          Explorá miles de ofertas virales con envío gratis en Córdoba desde ${(threshold).toLocaleString('es-AR')}.
        </p>
        <div className="pt-2">
          <button
            id="btn-empty-cart-explore"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('home');
            }}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-full shadow-md shadow-orange-500/20 active:scale-95 transition-all"
          >
            Explorar ofertas
          </button>
        </div>

        {/* Featured suggestions when empty */}
        <div className="pt-6 border-t border-slate-100 text-left space-y-3">
          <h3 className="text-xs font-bold text-slate-700">Te podría interesar:</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {products.slice(0, 6).map(prod => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 max-w-lg mx-auto bg-slate-50 min-h-screen text-slate-800">
      
      {/* 1. TOP COMPACT HEADER (Temu style: Back, Select All checkbox, Cart Title & Count, Options) */}
      <div className="relative z-10 bg-white border-b border-slate-100 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab(previousTab || 'home');
            }}
            className="p-1 -ml-1 text-slate-700 hover:bg-slate-100 rounded-full active:scale-90"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Select All Checkbox */}
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-800 active:scale-95 transition-all"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
              isAllSelected ? 'bg-black text-white' : 'border-2 border-slate-300 bg-white'
            }`}>
              {isAllSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
            <span className="text-xs">Todos</span>
          </button>
        </div>

        {/* Title */}
        <h1 className="text-sm font-black text-slate-900 tracking-tight">
          Carrito ({cart.reduce((sum, item) => sum + item.quantity, 0)})
        </h1>

        {/* Options Menu */}
        <div className="relative">
          <button
            onClick={() => setShowClearConfirm(!showClearConfirm)}
            className="p-1 text-slate-500 hover:text-slate-800 rounded-full"
            aria-label="Opciones"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showClearConfirm && (
            <div className="absolute right-0 top-8 w-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-40 animate-scaleIn">
              <button
                onClick={() => {
                  triggerHaptic('warning');
                  clearCart();
                  setShowClearConfirm(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar carrito</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. INFORMATIVE DELIVERY BANNER (Cadetería por Distancia y Envío Gratis > $100.000) */}
      <div className={`border-b px-3.5 py-2.5 transition-colors ${
        isFreeShipEligible 
          ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-950' 
          : 'bg-purple-50/80 border-purple-100 text-slate-800'
      }`}>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${
              isFreeShipEligible ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'
            }`}>
              {isFreeShipEligible ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Truck className="w-3 h-3" />}
            </div>
            <div className="min-w-0">
              {isFreeShipEligible ? (
                <span className="text-xs font-black text-emerald-800 tracking-tight block">
                  ¡Alcanzaste el <span className="underline decoration-emerald-400">ENVÍO GRATIS</span>!
                </span>
              ) : (
                <span className="text-xs text-slate-800 font-bold block leading-tight">
                  Te faltan <strong className="text-purple-700 font-black">${remainingForFreeShip.toLocaleString('es-AR')}</strong> para <strong className="text-emerald-700 font-extrabold">Envío Gratis</strong>
                </span>
              )}
              <span className="text-[10px] text-slate-500 block truncate">
                📍 Centro de Despacho VONDRO (Córdoba Capital)
              </span>
            </div>
          </div>

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
            isFreeShipEligible 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
              : 'bg-purple-100 text-purple-800 border border-purple-200'
          }`}>
            {isFreeShipEligible ? 'Envío $0 Bonificado' : 'Meta: $100.000'}
          </span>
        </div>

        {/* Minimalist Progress Line */}
        <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ${
              isFreeShipEligible ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-purple-600'
            }`}
            style={{ width: `${shippingProgress}%` }}
          />
        </div>
      </div>

      {/* 3. CART PRODUCT ITEMS (Temu-style ultra compact cards with Checkbox, Thumbnail, Variant Badge, Stepper & Trash) */}
      <div className="relative z-10 bg-white divide-y divide-slate-100 border-b border-slate-200">
        {cart.filter(item => item && item.product).map((item) => {
          const itemKey = getCartItemKey(item);
          const isSelected = selectedCartItemKeys.includes(itemKey);
          const currentUnitPrice = (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : (item.product.salePrice || 0);
          const hasRealOriginalPrice = Boolean(
            item.product.originalPrice && 
            typeof item.product.originalPrice === 'number' && 
            item.product.originalPrice > currentUnitPrice
          );
          const discountPercent = hasRealOriginalPrice && item.product.originalPrice
            ? Math.round(((item.product.originalPrice - currentUnitPrice) / item.product.originalPrice) * 100)
            : (typeof item.product.discountPercentage === 'number' && item.product.discountPercentage > 0 
                ? Math.round(item.product.discountPercentage) 
                : 0);
          const hasDiscount = discountPercent > 0;

          const origPrice = hasRealOriginalPrice
            ? item.product.originalPrice!
            : (hasDiscount 
                ? Math.round(currentUnitPrice / (1 - (discountPercent / 100)))
                : 0);

          return (
            <div 
              key={itemKey}
              className={`p-3 flex items-start transition-colors ${
                !isSelected ? 'opacity-60 bg-slate-50/50' : 'bg-white'
              }`}
            >
              {/* Checkbox with 12px margin right to image */}
              <button
                type="button"
                onClick={() => toggleSelectItem(itemKey)}
                className="mt-6 shrink-0 text-slate-800 mr-3"
                aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                  isSelected ? 'bg-black text-white' : 'border-2 border-slate-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

              {/* Product Thumbnail with Low Stock Tag */}
              <div 
                onClick={() => {
                  triggerHaptic('light');
                  openProductDetail(item.product);
                }}
                className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-slate-100 shrink-0 cursor-pointer border border-slate-100"
              >
                <img
                  src={item.product.images?.[0] || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&auto=format&fit=crop&q=75'}
                  alt={item.product.name}
                  className="w-full h-full object-cover"
                />
                {item.product.stock <= 5 && item.product.stock > 0 && (
                  <div className="absolute bottom-0 inset-x-0 bg-orange-600/90 backdrop-blur-2xs text-white text-[8px] font-black text-center py-0.5 tracking-tighter uppercase">
                    Solo queda(n) {item.product.stock}
                  </div>
                )}
              </div>

              {/* Product Info & Controls */}
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch ml-2.5">
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <h3 
                      onClick={() => {
                        triggerHaptic('light');
                        openProductDetail(item.product);
                      }}
                      className="text-xs font-medium text-slate-800 line-clamp-2 leading-tight cursor-pointer hover:text-purple-700"
                    >
                      {item.product.isFlashSale && (
                        <span className="inline-block bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded mr-1 align-middle">
                          OFERTA
                        </span>
                      )}
                      {decodeHtmlEntities(item.product.name)}
                    </h3>

                    {/* Quick Delete */}
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        removeFromCart(item.product.id, itemKey);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-md shrink-0 active:scale-90 cursor-pointer"
                      aria-label="Eliminar del carrito"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Size, Color & Variant Badges */}
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {item.selectedSize && (
                      <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                        <span>Tamaño: {item.selectedSize}</span>
                      </span>
                    )}
                    {item.selectedColor && (
                      <span className="inline-flex items-center gap-1 bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                        <span>Color: {item.selectedColor}</span>
                      </span>
                    )}
                    {!item.selectedColor && item.selectedVariant && (
                      <div className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-medium">
                        <span>{item.selectedVariant}</span>
                      </div>
                    )}
                  </div>

                  {/* Custom Specification Box if provided */}
                  {item.customSpecification && (
                    <div className="mt-1.5 p-1.5 rounded-lg bg-amber-50/90 border border-amber-200/90 text-[10px] text-amber-900 leading-snug">
                      <span className="font-extrabold text-amber-950">Especificación: </span>
                      <span className="italic">"{item.customSpecification}"</span>
                    </div>
                  )}
                </div>

                {/* Unit Price Row */}
                <div className="flex items-baseline gap-1.5 flex-wrap mt-2 pt-1">
                  {origPrice > 0 && (
                    <span className="text-[10px] text-slate-400 line-through font-mono">
                      ${origPrice.toLocaleString('es-AR')}
                    </span>
                  )}
                  {hasDiscount ? (
                    <span className="text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1 rounded">
                      -{discountPercent}%
                    </span>
                  ) : null}
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                    ARS${currentUnitPrice.toLocaleString('es-AR')}
                    <span className="text-[10px] font-normal text-slate-500 ml-1">c/u</span>
                  </span>
                </div>

                {/* Subtotal & Stepper Row: Standardized height & Perfect Vertical Centering */}
                <div className="flex items-center justify-between gap-2.5 sm:gap-3 mt-1.5">
                  {/* Consistent Subtotal Pill for all quantities (1, 2, etc.) */}
                  <div className="flex flex-col justify-center h-8 bg-purple-50/90 border border-purple-200/80 rounded-lg px-2.5 py-0.5 w-fit max-w-full shrink-0">
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-none whitespace-nowrap">
                      Subtotal ({item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'})
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-purple-700 font-mono leading-none mt-0.5 whitespace-nowrap">
                      ARS$ {(currentUnitPrice * item.quantity).toLocaleString('es-AR')}
                    </span>
                  </div>

                  {/* Temu-style Compact Stepper with matching standardized height */}
                  <div className="flex items-center border border-slate-300 rounded-lg bg-white shadow-2xs h-8 shrink-0 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        updateCartQuantity(item.product.id, item.quantity - 1, itemKey);
                      }}
                      className="w-7 h-full flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
                      aria-label="Restar 1"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-slate-800 select-none font-mono">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        updateCartQuantity(item.product.id, item.quantity + 1, itemKey);
                      }}
                      disabled={item.quantity >= (item.product.stock || 99)}
                      className="w-7 h-full flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Sumar 1"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. VOUCHER / COUPON & SHIPPING COLLAPSIBLE BAR */}
      <div className="p-3 bg-white border-y border-slate-200 mt-2 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowCouponInput(!showCouponInput)}
            className="flex items-center gap-1.5 font-bold text-purple-700 hover:text-purple-800"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{appliedCoupon ? `Cupón: ${appliedCoupon.code} aplicado` : '¿Tenés un cupón de descuento?'}</span>
          </button>
          {appliedCoupon && (
            <button
              onClick={() => {
                triggerHaptic('light');
                removeCoupon();
              }}
              className="text-[11px] font-bold text-rose-600 hover:underline"
            >
              Quitar
            </button>
          )}
        </div>

        {showCouponInput && !appliedCoupon && (
          <form onSubmit={handleApplyCoupon} className="flex gap-2 pt-1 animate-fadeIn">
            <input
              type="text"
              placeholder="Ej. BIENVENIDA"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs uppercase font-semibold focus:ring-1 focus:ring-purple-600 outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
            >
              Aplicar
            </button>
          </form>
        )}

        {couponFeedback && !appliedCoupon && (
          <p className={`text-[10px] font-medium ${couponFeedback.success ? 'text-emerald-600' : 'text-rose-500'}`}>
            {couponFeedback.message}
          </p>
        )}
      </div>

      {/* 6. TEMU STYLE INFORMATIVE LEGAL DISCLAIMER */}
      <div className="px-4 py-2.5 text-[11px] text-slate-400 flex items-start gap-1.5 leading-tight">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
        <span>La disponibilidad y el precio de los artículos en tu carrito no están garantizados hasta que se finalice el pago.</span>
      </div>

      {/* 7. DISCOVER RECOMMENDATIONS (Temu style 2-column grid at bottom) */}
      {recommendedAddons.length > 0 && (
        <div className="pt-2 px-3 space-y-2 pb-6">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>También te podría interesar:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recommendedAddons.map(prod => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      )}

      {/* 8. TEMU STYLE FIXED BOTTOM CHECKOUT DOCK (Compact Total + Orange Action Button) */}
      <div 
        id="cart-fixed-bottom-bar"
        className="fixed bottom-16 inset-x-0 z-30 bg-white/98 backdrop-blur-md border-t border-slate-200 px-3.5 py-2.5 shadow-xl max-w-lg mx-auto flex items-center justify-between gap-3"
      >
        {/* Left Side: Summary & Price with Subtotal/Shipping Breakdown */}
        <div className="flex flex-col min-w-0 shrink-0">
          {!isFreeShipEligible ? (
            <div className="text-[10px] text-slate-500 font-medium leading-tight flex items-center gap-1.5 flex-wrap">
              <span>Sub: <strong className="text-slate-700 font-bold font-mono">${activeSubtotal.toLocaleString('es-AR')}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Envío: <strong className="text-slate-700 font-bold font-mono">${effectiveShippingCost.toLocaleString('es-AR')}</strong></span>
            </div>
          ) : (
            activeOriginalTotal > activeSubtotal && (
              <div className="text-[10px] text-slate-400 line-through font-mono leading-none">
                ARS${activeOriginalTotal.toLocaleString('es-AR')}
              </div>
            )
          )}

          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-sm sm:text-base font-black text-orange-600 font-mono whitespace-nowrap">
              ARS${finalTotal.toLocaleString('es-AR')}
            </span>
            {discountAmount > 0 && (
              <span className="text-[9px] text-emerald-600 font-bold whitespace-nowrap">
                (-${discountAmount.toLocaleString('es-AR')})
              </span>
            )}
          </div>

          <span className="text-[9px] font-medium leading-none whitespace-nowrap">
            {isFreeShipEligible ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-2.5 h-2.5 stroke-[3]" /> Envío GRATIS Córdoba
              </span>
            ) : (
              <span className="text-slate-500">
                Total (+ Envío Córdoba)
              </span>
            )}
          </span>
        </div>

        {/* Right Side: Primary Orange/Theme Checkout Button */}
        <button
          id="btn-go-to-checkout"
          onClick={() => {
            triggerHaptic('medium');
            if (activeSelectedItems.length === 0) {
              return;
            }
            setActiveTab('checkout');
          }}
          disabled={activeSelectedItems.length === 0}
          className="shrink-0 py-3 px-4 sm:px-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/30 active:scale-98 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          <span>Pagar ({activeSelectedItems.reduce((acc, i) => acc + i.quantity, 0)})</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

    </div>
  );
};
