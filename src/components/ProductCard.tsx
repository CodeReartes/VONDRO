import React, { useState, memo, useMemo, useEffect, useCallback, useRef } from 'react';
import { Heart, Plus, Star, Check, ShoppingCart, Zap, Package } from 'lucide-react';
import { Product, ProductVariant } from '../types/index';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { QuickVariantBottomSheet } from './QuickVariantBottomSheet';
import { 
  getOptimizedThumbnail, 
  getCategoryFallback,
  decodeHtmlEntities,
  isImageCached,
  markImageCached,
  isDataSaverActive
} from '../utils/imageOptimizer';
import { isProductInFlashDeal } from '../utils/flashDealTimer';

const priceFormatter = new Intl.NumberFormat('es-AR');

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'horizontal' | 'compact';
  priority?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = memo(({ 
  product, 
  layout = 'grid',
  priority = false
}) => {
  const { openProductDetail, addToCart, toggleFavorite, isFavorite, cart, getProductRatingSummary, activeFlashDealIds } = useStore();
  const favorite = product?.id ? isFavorite(product.id) : false;
  const cartItem = product?.id ? cart.find(item => item?.product?.id === product.id) : undefined;
  const activeFlashIds = activeFlashDealIds || [];
  const isOutOfStock = !product || product.stock <= 0 || product.stockStatus === 'out_of_stock';
  const isLowStock = Boolean(product && product.stock > 0 && product.stock <= 20);
  const [showVariantSheet, setShowVariantSheet] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const ratingSummary = useMemo(() => {
    if (!product?.id) return { rating: 0, reviewCount: 0 };
    return getProductRatingSummary 
      ? getProductRatingSummary(product.id) 
      : { rating: product.rating || 0, reviewCount: product.reviewCount || 0 };
  }, [product?.id, product?.rating, product?.reviewCount, getProductRatingSummary]);

  const currentRating = ratingSummary?.rating ?? product?.rating ?? 0;
  const reviewCount = ratingSummary?.reviewCount ?? product?.reviewCount ?? 0;

  // Clean decoded title
  const cleanName = useMemo(() => decodeHtmlEntities(product?.name || ''), [product?.name]);

  // Determine valid initial image URL (strictly excluding any supplier logo or placeholder)
  const allImages = useMemo(() => {
    if (!product) return [getCategoryFallback()];
    const list = Array.isArray(product.images) 
      ? product.images.filter(img => Boolean(img) && typeof img === 'string' && !img.toLowerCase().includes('logo'))
      : [];
    return list.length > 0 ? list : [getCategoryFallback(product.categoryId)];
  }, [product?.images, product?.categoryId]);

  const rawImageUrl = allImages[imageIndex] || getCategoryFallback(product?.categoryId);
  const targetWidth = layout === 'compact' ? 180 : 260;
  const targetQuality = layout === 'compact' ? 54 : 56;
  const mainImageUrl = useMemo(() => getOptimizedThumbnail(rawImageUrl, targetWidth, targetQuality), [rawImageUrl, targetWidth, targetQuality]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [imgSrc, setImgSrc] = useState(mainImageUrl);
  const [isImgLoaded, setIsImgLoaded] = useState(() => priority || isImageCached(mainImageUrl));
  const [shouldLoadImage, setShouldLoadImage] = useState(() => priority || isImageCached(mainImageUrl));

  useEffect(() => {
    setImgSrc(mainImageUrl);
    if (priority || isImageCached(mainImageUrl)) {
      setIsImgLoaded(true);
      setShouldLoadImage(true);
    }
  }, [mainImageUrl, priority]);

  // Mount and start fetching lightweight WebP image when card enters 700px (or 350px in data-saver)
  // lookahead zone so fast-scrolling users never stall on grey boxes while untouched items consume 0 bytes.
  useEffect(() => {
    if (shouldLoadImage) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShouldLoadImage(true);
      return;
    }

    const margin = isDataSaverActive() ? '350px 0px' : '700px 0px';
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          setShouldLoadImage(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: margin, threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLoadImage]);

  const handleImageLoad = useCallback(() => {
    setIsImgLoaded(true);
    markImageCached(imgSrc);
  }, [imgSrc]);

  const handleImageError = useCallback(() => {
    if (imgSrc.startsWith('/api/img') && rawImageUrl && rawImageUrl.startsWith('http') && imgSrc !== rawImageUrl) {
      setImgSrc(rawImageUrl);
      return;
    }
    if (imageIndex + 1 < allImages.length) {
      setImageIndex(prev => prev + 1);
    } else {
      setImgSrc(getCategoryFallback(product?.categoryId));
      setIsImgLoaded(true);
    }
  }, [imgSrc, rawImageUrl, imageIndex, allImages.length, product?.categoryId]);

  // Check if image is already loaded from browser cache upon element attach
  const imageRefCallback = useCallback((imgEl: HTMLImageElement | null) => {
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      setIsImgLoaded(true);
      markImageCached(imgEl.src);
    }
  }, []);

  if (!product) return null;

  // New arrivals and restocked items detection (only show badges when explicitly tagged or curated to avoid cluttering all 1000+ items)
  const isRestockedItem = Boolean(!isOutOfStock && ((product as any).isRestocked || product.promoBadges?.includes('REPOSICIÓN') || product.tags?.some(t => t.toUpperCase().includes('REPOSIC'))));
  const isExplicitNewTag = Boolean(product.promoBadges?.includes('NUEVO') || product.promoBadges?.includes('NOVEDAD') || product.tags?.some(t => t.toUpperCase().includes('NUEVO')));
  const isNewArrival = Boolean(!isOutOfStock && !isRestockedItem && isExplicitNewTag);

  // Flash sale active strictly if product is in current 100 active rotation batch
  const isFlashDealActive = isProductInFlashDeal(product, activeFlashIds);
  const effectiveDiscount = product.discountPercentage && product.discountPercentage > 0
    ? product.discountPercentage
    : isFlashDealActive
    ? (product.stock <= 2 ? 42 : product.stock <= 5 ? 35 : product.stock <= 10 ? 25 : 20)
    : 0;

  // Format real sales count (only show when salesCount > 0, otherwise 0)
  const salesCount = product.salesCount || 0;
  const hasSales = salesCount > 0;
  const salesCountFormatted = hasSales
    ? salesCount >= 1000 
      ? `${(salesCount / 1000).toFixed(1).replace('.', ',')}K+` 
      : `${salesCount}`
    : '0';

  const handleCardClick = useCallback(() => {
    if (!product) return;
    triggerHaptic('light');
    openProductDetail(product);
  }, [product, openProductDetail]);

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product || isOutOfStock) {
      triggerHaptic('warning');
      return;
    }

    if (product.variants && product.variants.length > 1) {
      triggerHaptic('light');
      setShowVariantSheet(true);
    } else {
      triggerHaptic('success');
      addToCart(product, 1);
    }
  }, [product, isOutOfStock, addToCart]);

  const handleVariantAddToCart = useCallback((_variant: ProductVariant, quantity: number) => {
    if (!product) return;
    triggerHaptic('success');
    addToCart(product, quantity);
    setShowVariantSheet(false);
  }, [product, addToCart]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product?.id) return;
    triggerHaptic('medium');
    toggleFavorite(product.id);
  }, [product?.id, toggleFavorite]);

  if (layout === 'compact') {
    return (
      <div 
        ref={cardRef}
        id={`product-card-${product.id}`}
        onClick={handleCardClick}
        className="w-[114px] sm:w-[136px] shrink-0 bg-white rounded-xl p-1.5 pb-2.5 border border-slate-100 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative h-auto select-none active:scale-[0.98]"
      >
        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-50 border border-slate-100/80 mb-1.5 flex items-center justify-center">
          {!isImgLoaded && (
            <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-slate-300" />
            </div>
          )}
          {shouldLoadImage && (
            <img
              ref={imageRefCallback}
              src={imgSrc}
              alt={cleanName}
              decoding="async"
              loading="eager"
              {...(priority ? { fetchPriority: 'high' } : {})}
              referrerPolicy="no-referrer"
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`w-full h-full object-cover group-hover:scale-105 transition-opacity duration-150 ${
                isImgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}
          
          <div className="absolute top-1 left-1 flex flex-col gap-0.5 items-start z-10 pointer-events-none">
            {isOutOfStock ? (
              <span className="bg-slate-900/90 text-white text-[7.5px] font-bold px-1 py-0.2 rounded shadow-xs">
                Agotado
              </span>
            ) : isFlashDealActive && effectiveDiscount > 0 ? (
              <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white text-[8px] sm:text-[8.5px] font-black px-1 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                <Zap className="w-2 h-2 fill-current" />
                -{effectiveDiscount}%
              </span>
            ) : effectiveDiscount > 0 ? (
              <span className="bg-rose-600 text-white text-[8px] font-black px-1 py-0.5 rounded shadow-xs">
                -{effectiveDiscount}%
              </span>
            ) : null}
          </div>

          <button
            id={`btn-fav-compact-${product.id}`}
            onClick={handleToggleFavorite}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-xs z-10"
            aria-label="Guardar en favoritos"
          >
            <Heart className={`w-3 h-3 ${favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col flex-1 justify-between">
          <div>
            {/* 1 or 2 line title */}
            <h4 className="text-[11px] font-semibold text-slate-800 line-clamp-1 mb-1 leading-tight group-hover:text-purple-700 transition-colors">
              {cleanName}
            </h4>
            <div className="flex flex-col gap-0.5 mb-1">
              <span className="text-[11.5px] sm:text-xs font-black text-orange-600 leading-none whitespace-nowrap">
                ARS${priceFormatter.format(product.salePrice ?? 0)}
              </span>
              <div className="flex items-center justify-between text-[9px] text-slate-400">
                {!!product.originalPrice ? (
                  <span className="line-through">
                    ${priceFormatter.format(product.originalPrice ?? 0)}
                  </span>
                ) : (
                  <span>Córdoba</span>
                )}
                {hasSales ? (
                  <span className="font-bold text-amber-600 text-[8.5px]">🔥 {salesCountFormatted} vtas</span>
                ) : (
                  <span className="text-slate-400 font-normal text-[8.5px]">0 vtas</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Stock Display & Quick Add */}
          <div className="mt-auto pt-1 border-t border-slate-100 flex items-center justify-between text-[9px]">
            {isOutOfStock ? (
              <span className="font-bold text-rose-600">0 disp.</span>
            ) : isLowStock ? (
              <span className="font-extrabold text-amber-600 flex items-center gap-0.5 leading-none">
                <Zap className="w-2 h-2 fill-current shrink-0" />
                ¡Últimas {product.stock}!
              </span>
            ) : (
              <span className="font-medium text-emerald-700 leading-none">
                {product.stock} disp.
              </span>
            )}

            <button
              id={`btn-add-cart-flash-${product.id}`}
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs transition-all active:scale-90 ${
                isOutOfStock
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : cartItem
                  ? 'bg-emerald-600 text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
              aria-label={cartItem ? `En carrito (${cartItem.quantity})` : 'Agregar al carrito'}
              title={isOutOfStock ? 'Sin stock' : 'Agregar al carrito (+)'}
            >
              {cartItem ? (
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              ) : (
                <Plus className="w-3 h-3 stroke-[3] text-white" />
              )}
            </button>
          </div>
        </div>

        {showVariantSheet && (
          <QuickVariantBottomSheet
            product={product}
            isOpen={showVariantSheet}
            onClose={() => setShowVariantSheet(false)}
            onAddToCart={handleVariantAddToCart}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      id={`product-card-${product.id}`}
      onClick={handleCardClick}
      className="w-full min-w-0 bg-white rounded-2xl p-2 sm:p-2.5 border border-slate-100 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
    >
      {/* Top Image Container: Fixed 1:1 Aspect Ratio with Neutral Background */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100/80 mb-2 flex items-center justify-center">
        {!isImgLoaded && (
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-slate-300" />
          </div>
        )}
        {shouldLoadImage && (
          <img
            ref={imageRefCallback}
            src={imgSrc}
            alt={cleanName}
            decoding="async"
            loading="eager"
            {...(priority ? { fetchPriority: 'high' } : {})}
            referrerPolicy="no-referrer"
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`w-full h-full object-cover group-hover:scale-105 transition-opacity duration-150 ${
              isImgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Discount / New / Restocked Badge on Image */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start z-10 pointer-events-none">
          {isOutOfStock ? (
            <span className="bg-slate-900/90 text-white text-[8px] sm:text-[8.5px] font-bold px-1.5 py-0.5 rounded shadow-2xs backdrop-blur-xs">
              Agotado
            </span>
          ) : (
            <>
              {isFlashDealActive && effectiveDiscount > 0 ? (
                <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-0.5">
                  <Zap className="w-2 h-2 fill-current" />
                  -{effectiveDiscount}%
                </span>
              ) : effectiveDiscount > 0 ? (
                <span className="bg-gradient-to-r from-rose-600 to-red-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded shadow-2xs">
                  -{effectiveDiscount}%
                </span>
              ) : null}
            </>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          id={`btn-fav-${product.id}`}
          onClick={handleToggleFavorite}
          className="absolute top-1.5 right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors shadow-2xs active:scale-90 z-10"
          aria-label="Guardar en favoritos"
        >
          <Heart className={`w-3.5 h-3.5 ${favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Floating Quick Add-To-Cart on Image */}
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`absolute bottom-1.5 right-1.5 h-7 sm:h-7.5 px-2 sm:px-2.5 rounded-lg flex items-center justify-center shadow-xs transition-all active:scale-90 z-10 ${
            isOutOfStock
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : cartItem
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
          }`}
          title="Agregar al carrito"
        >
          {cartItem ? (
            <span className="text-[10px] font-black flex items-center gap-0.5">
              <Check className="w-3 h-3" />
              {cartItem.quantity}
            </span>
          ) : (
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
          )}
        </button>
      </div>

      {/* Info Content */}
      <div className="flex-1 flex flex-col justify-between pt-0.5">
        <div>
          {/* Sales count & Rating */}
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] mb-0.5 text-slate-500">
            {hasSales ? (
              <span className="font-bold text-amber-600">🔥 {salesCountFormatted} ventas</span>
            ) : (
              <span className="text-slate-400 font-normal text-[9.5px]">0 ventas</span>
            )}
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-0.5 text-slate-700 font-bold">
              {reviewCount > 0 ? (
                <>
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-400" />
                  <span>{currentRating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal text-[9.5px]">({reviewCount})</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal text-[9.5px]">0 opiniones</span>
              )}
            </div>
          </div>

          {/* Name - Strict line-clamp-2 with fixed height for grid consistency */}
          <h3 className="text-xs sm:text-[13px] font-semibold text-slate-800 line-clamp-2 leading-snug h-8 sm:h-9 overflow-hidden group-hover:text-purple-700 transition-colors">
            {cleanName}
          </h3>
        </div>

        {/* Pricing Block */}
        <div className="pt-1 mt-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-sm sm:text-base font-black text-orange-600 whitespace-nowrap">
              ARS${priceFormatter.format(product.salePrice ?? 0)}
            </span>
            {!!product.originalPrice && (
              <span className="text-[10px] sm:text-[11px] text-slate-400 line-through whitespace-nowrap">
                ${priceFormatter.format(product.originalPrice ?? 0)}
              </span>
            )}
          </div>

          {/* Explicit Units Available Row */}
          <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-[11px]">
            {isOutOfStock ? (
              <span className="font-bold text-rose-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Sin stock (0 disponibles)
              </span>
            ) : isLowStock ? (
              <span className="font-extrabold text-amber-600 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span>¡Últimas <strong>{product.stock}</strong> unidades!</span>
              </span>
            ) : (
              <span className="font-medium text-emerald-700 flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3] text-emerald-600" />
                <span><strong>{product.stock}</strong> unidades disponibles</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {showVariantSheet && (
        <QuickVariantBottomSheet
          product={product}
          onClose={() => setShowVariantSheet(false)}
          onAddToCart={handleVariantAddToCart}
        />
      )}
    </div>
  );
});
