import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowRight,
  Heart, 
  Star, 
  Plus, 
  Minus, 
  Truck, 
  ShieldCheck, 
  CheckCircle2, 
  MessageCircle, 
  Sparkles,
  MapPin,
  Check,
  Share2,
  ChevronRight,
  ChevronLeft,
  Clock,
  HelpCircle,
  Award,
  Zap,
  ShoppingCart,
  Users,
  Image as ImageIcon,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Sliders,
  Edit3,
  Palette,
  Ruler,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { CustomerReviewsSection } from './CustomerReviewsSection';
import { triggerHaptic, shareContent } from '../utils/native';
import { formatWhatsAppPhone } from '../utils/phoneUtils';
import { useActiveFlashDealConfig, useFlashCountdown, isProductInFlashDeal, getFlashDealDiscount } from '../utils/flashDealTimer';
import { ProductVariant, ProductSize, ProductColor } from '../types/index';
import { getOptimizedHighRes, decodeHtmlEntities, getCategoryFallback } from '../utils/imageOptimizer';
import { cleanBrandingText } from '../utils/brandingSanitizer';
import { getRelatedAndComplementaryProducts } from '../utils/productRecommendations';

const ProductDetailFlashBar: React.FC = () => {
  const countdown = useFlashCountdown();
  return (
    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-xl p-2.5 flex items-center justify-between shadow-xs animate-fadeIn">
      <div className="flex items-center gap-2">
        <span className="font-black italic text-xs uppercase tracking-wide text-amber-100">Mega oferta</span>
        <div className="w-16 h-2 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-200 rounded-full transition-all"
            style={{ width: `${countdown.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs font-black">
        <Clock className="w-3.5 h-3.5 text-amber-200 animate-spin" style={{ animationDuration: '6s' }} />
        <span>Termina en {countdown.formatted}</span>
        <ChevronRight className="w-4 h-4 text-white/80" />
      </div>
    </div>
  );
};

export const ProductDetailView: React.FC = () => {
  const { 
    selectedProduct, 
    setActiveTab,
    closeProductDetail,
    previousTab,
    addToCart, 
    toggleFavorite, 
    isFavorite, 
    cart, 
    products, 
    categories,
    settings,
    isFreeShipping,
    applyCoupon,
    getProductRatingSummary,
    setSelectedCategoryFilter
  } = useStore();

  const ratingSummary = selectedProduct?.id && getProductRatingSummary 
    ? getProductRatingSummary(selectedProduct.id) 
    : { rating: selectedProduct?.rating || 0, reviewCount: selectedProduct?.reviewCount || 0 };

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [addedAnimation, setAddedAnimation] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [activeTabSection, setActiveTabSection] = useState<'details' | 'reviews'>('details');

  // Fullscreen interactive gallery viewer
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);

  // Track manual touch swipe to auto-hide navigation arrows after first manual swipe
  const [hasManualSwiped, setHasManualSwiped] = useState<boolean>(false);

  // Touch Swipe Gesture State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  // Flash deal batch check without 1-second parent re-renders
  const timer = useActiveFlashDealConfig();
  const activeFlashIds = timer.activeProductIds;

  // Size and Color variant states for sheet, bedding, or variant-enabled products
  const productSizes: ProductSize[] = useMemo(() => {
    if (!selectedProduct) return [];
    if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
      return selectedProduct.sizes;
    }
    const nameLower = (selectedProduct.name || '').toLowerCase();
    const isBedding = selectedProduct.subcategoryId === 'ind-sabanas' || nameLower.includes('sabana') || nameLower.includes('sábana');
    if (isBedding) {
      if (nameLower.includes('full') || nameLower.includes('2 plaza') || nameLower.includes('2 plazas')) {
        return [
          { id: 'full', name: 'FULL', price: selectedProduct.salePrice, dimensions: 'Para colchón de 1.40m x 1.90m + 30cm alto', inStock: true }
        ];
      }
      if (nameLower.includes('1 1/2') || nameLower.includes('1.5') || nameLower.includes('1 plaza') || nameLower.includes('1.5 plazas')) {
        return [
          { id: '1 plaza', name: '1 ½ PLAZA', price: selectedProduct.salePrice, dimensions: 'Para colchón de 0.90m x 1.90m + 25cm alto', inStock: true }
        ];
      }
      if (nameLower.includes('queen') && !nameLower.includes('king')) {
        return [
          { id: 'queen', name: 'QUEEN', price: selectedProduct.salePrice, dimensions: 'Para colchón hasta 1.60m x 2.00m + 30cm alto', inStock: true }
        ];
      }
      if (nameLower.includes('king') && !nameLower.includes('queen')) {
        return [
          { id: 'king', name: 'KING', price: selectedProduct.salePrice, dimensions: 'Para colchón hasta 2.00m x 2.00m + 35cm alto', inStock: true }
        ];
      }
      return [
        { id: 'full', name: 'FULL', price: selectedProduct.salePrice, dimensions: 'Para colchón de 1.40m x 1.90m + 30cm alto', inStock: true },
        { id: 'queen', name: 'QUEEN', price: Math.round(selectedProduct.salePrice * 1.08), dimensions: 'Para colchón hasta 1.60m x 2.00m + 30cm alto', inStock: true },
        { id: 'king', name: 'KING', price: Math.round(selectedProduct.salePrice * 1.15), dimensions: 'Para colchón hasta 2.00m x 2.00m + 35cm alto', inStock: true }
      ];
    }
    return [];
  }, [selectedProduct]);

  const productColors: ProductColor[] = useMemo(() => {
    if (!selectedProduct) return [];
    if (selectedProduct.colors && selectedProduct.colors.length > 0) {
      return selectedProduct.colors;
    }
    const nameLower = (selectedProduct.name || '').toLowerCase();
    const isBedding = selectedProduct.subcategoryId === 'ind-sabanas' || nameLower.includes('sabana') || nameLower.includes('sábana');
    if (isBedding) {
      return [
        { id: 'rosa', name: 'Rosa', hex: '#f472b6' },
        { id: 'blanco', name: 'Blanco', hex: '#f8fafc' },
        { id: 'celeste', name: 'Celeste', hex: '#38bdf8' },
        { id: 'gris', name: 'Gris', hex: '#94a3b8' },
        { id: 'beige', name: 'Beige', hex: '#fef3c7' },
        { id: 'negro', name: 'Negro', hex: '#1e293b' },
      ];
    }
    if (selectedProduct.variants && selectedProduct.variants.length > 0) {
      return selectedProduct.variants.map((v, i) => ({
        id: v.id || `var-${i}`,
        name: v.name,
        hex: '#cbd5e1',
        imageUrl: v.imageUrl
      }));
    }
    return [];
  }, [selectedProduct]);

  const shouldAllowCustomSpec = useMemo(() => {
    if (!selectedProduct) return false;
    if (selectedProduct.allowCustomSpecification !== undefined) {
      return selectedProduct.allowCustomSpecification;
    }
    const nameLower = (selectedProduct.name || '').toLowerCase();
    return productSizes.length > 0 || productColors.length > 0 || nameLower.includes('sabana') || nameLower.includes('sábana') || selectedProduct.subcategoryId === 'ind-blanqueria' || selectedProduct.subcategoryId === 'ind-sabanas';
  }, [selectedProduct, productSizes, productColors]);

  const [selectedSize, setSelectedSize] = useState<string>(() => productSizes[0]?.name || '');
  const [selectedColor, setSelectedColor] = useState<string>(() => productColors[0]?.name || '');
  const [customSpecification, setCustomSpecification] = useState<string>('');
  const [isSizeModalOpen, setIsSizeModalOpen] = useState<boolean>(false);

  // Sync state when switching product
  useEffect(() => {
    setSelectedSize(productSizes[0]?.name || '');
    setSelectedColor(productColors[0]?.name || '');
    setCustomSpecification('');
    setIsSizeModalOpen(false);
  }, [selectedProduct?.id, productSizes, productColors]);

  // Reset image index and swipe indicator when switching product
  useEffect(() => {
    setSelectedImageIndex(0);
    setHasManualSwiped(false);
  }, [selectedProduct?.id]);

  // Handle escape key and lock body scroll when lightbox is open
  useEffect(() => {
    if (!isLightboxOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxZoom(1);
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen]);

  const favorite = selectedProduct?.id ? isFavorite(selectedProduct.id) : false;
  const isOutOfStock = !selectedProduct || selectedProduct.stock <= 0 || selectedProduct.stockStatus === 'out_of_stock';
  const isLowStock = Boolean(selectedProduct && selectedProduct.stock > 0 && selectedProduct.stock <= 6);
  const isFlashDealActive = Boolean(selectedProduct && isProductInFlashDeal(selectedProduct, activeFlashIds));
  const totalCartCount = cart.reduce((acc, item) => acc + (item?.quantity || 0), 0);

  // Dynamic category ranking
  const categoryRankInfo = useMemo(() => {
    if (!selectedProduct) return null;
    const cat = (categories || []).find(c => c.id === selectedProduct.categoryId || c.slug === selectedProduct.categoryId);
    const catName = cat?.name || selectedProduct.category || 'su categoría';

    // Filter and sort products in the same category
    const categoryProducts = (products || [])
      .filter(p => p && (p.categoryId === selectedProduct.categoryId || (!selectedProduct.categoryId && !p.categoryId)))
      .sort((a, b) => {
        const scoreA = (a.salesCount || 0) * 10 + (a.rating || 0) * 5 + (a.reviewCount || 0);
        const scoreB = (b.salesCount || 0) * 10 + (b.rating || 0) * 5 + (b.reviewCount || 0);
        return scoreB - scoreA;
      });

    const rankIndex = categoryProducts.findIndex(p => p.id === selectedProduct.id);
    const rank = rankIndex !== -1 ? rankIndex + 1 : null;

    if (rank === 1) {
      return { 
        icon: '🏆',
        label: `#1 MÁS VENDIDO`, 
        categoryName: catName, 
        badgeClass: 'bg-emerald-700 text-white border border-emerald-600' 
      };
    } else if (rank && rank <= 3) {
      return { 
        icon: '🏆',
        label: `#${rank} MÁS VENDIDO`, 
        categoryName: catName, 
        badgeClass: 'bg-emerald-700 text-white border border-emerald-600' 
      };
    } else if (rank && rank <= 10) {
      return { 
        icon: '🔥',
        label: `TOP 10 MÁS VENDIDO`, 
        categoryName: catName, 
        badgeClass: 'bg-orange-600 text-white border border-orange-500' 
      };
    } else if (selectedProduct.isFeatured || (selectedProduct.rating && selectedProduct.rating >= 4.8)) {
      return { 
        icon: '⭐',
        label: `DESTACADO`, 
        categoryName: catName, 
        badgeClass: 'bg-purple-700 text-white border border-purple-600' 
      };
    } else {
      return { 
        icon: '✨',
        label: `TENDENCIA`, 
        categoryName: catName, 
        badgeClass: 'bg-slate-700 text-white border border-slate-600' 
      };
    }
  }, [categories, products, selectedProduct]);

  const [imageError, setImageError] = useState<boolean>(false);

  const cleanName = useMemo(() => decodeHtmlEntities(selectedProduct.name), [selectedProduct.name]);

  const rawImages = useMemo(() => {
    const valid = (selectedProduct.images && Array.isArray(selectedProduct.images))
      ? selectedProduct.images.filter(img => Boolean(img) && typeof img === 'string' && !img.toLowerCase().includes('logo'))
      : [];
    return valid.length > 0 ? valid : [getCategoryFallback(selectedProduct.categoryId)];
  }, [selectedProduct.images, selectedProduct.categoryId]);

  const imagesList = useMemo(() => {
    return rawImages.map(img => getOptimizedHighRes(img, 900, 85));
  }, [rawImages]);

  const handleNextImage = () => {
    if (imagesList.length <= 1) return;
    triggerHaptic('light');
    setSelectedImageIndex(prev => (prev + 1) % imagesList.length);
  };

  const handlePrevImage = () => {
    if (imagesList.length <= 1) return;
    triggerHaptic('light');
    setSelectedImageIndex(prev => (prev - 1 + imagesList.length) % imagesList.length);
  };

  // Touch handlers for finger slide/swipe gestures
  const minSwipeDistance = 35;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchEndY(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null || imagesList.length <= 1) return;
    const distanceX = touchStartX - touchEndX;
    const distanceY = (touchStartY !== null && touchEndY !== null) ? Math.abs(touchStartY - touchEndY) : 0;
    
    // Check if horizontal swipe was intentional (more horizontal than vertical)
    if (Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceX) > distanceY) {
      setHasManualSwiped(true);
      if (distanceX > 0) {
        // Swiped left -> Go to Next Photo (e.g., 1/2 to 2/2)
        handleNextImage();
      } else {
        // Swiped right -> Go to Previous Photo
        handlePrevImage();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchEndX(null);
    setTouchEndY(null);
  };

  // Use only genuine variants defined for the product (never force defaults)
  const variants = selectedProduct?.variants && selectedProduct.variants.length > 0 
    ? selectedProduct.variants 
    : [];

  const currentVariant = selectedVariant || (variants.length > 0 ? variants[0] : null);

  const [recommendedCount, setRecommendedCount] = useState<number>(8);

  // Reset limit when product changes
  useEffect(() => {
    setRecommendedCount(8);
  }, [selectedProduct?.id]);

  const allRelatedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return getRelatedAndComplementaryProducts(selectedProduct, products, 24);
  }, [products, selectedProduct]);

  const displayedRelatedProducts = useMemo(() => {
    return allRelatedProducts.slice(0, recommendedCount);
  }, [allRelatedProducts, recommendedCount]);

  const hasMoreRelated = allRelatedProducts.length > recommendedCount;

  const currentCategory = useMemo(() => {
    if (!selectedProduct?.categoryId) return null;
    return categories.find(c => c.id === selectedProduct.categoryId) || null;
  }, [categories, selectedProduct?.categoryId]);

  // Active unit price based on selected size
  const activeUnitPrice = useMemo(() => {
    if (selectedSize && productSizes.length > 0) {
      const matched = productSizes.find(s => s.name.toLowerCase() === selectedSize.toLowerCase() || s.id.toLowerCase() === selectedSize.toLowerCase());
      if (matched && matched.price) {
        return matched.price;
      }
    }
    return selectedProduct.salePrice;
  }, [selectedSize, productSizes, selectedProduct.salePrice]);

  const currentSelectedSizeObj = useMemo(() => {
    if (!selectedSize || !productSizes.length) return null;
    return productSizes.find(s => s.name.toLowerCase() === selectedSize.toLowerCase() || s.id.toLowerCase() === selectedSize.toLowerCase()) || null;
  }, [selectedSize, productSizes]);

  const isSelectedSizeOutOfStock = useMemo(() => {
    if (!currentSelectedSizeObj) {
      if (productSizes.length > 0) {
        const hasAny = productSizes.some(s => s.inStock !== false && (s.stock === undefined || s.stock > 0));
        return !hasAny;
      }
      return selectedProduct.stockStatus === 'out_of_stock' || selectedProduct.stock === 0;
    }
    if (currentSelectedSizeObj.inStock === false) return true;
    if (currentSelectedSizeObj.stock !== undefined && currentSelectedSizeObj.stock <= 0) return true;
    return false;
  }, [currentSelectedSizeObj, productSizes, selectedProduct]);

  const activeStock = useMemo(() => {
    if (currentSelectedSizeObj) {
      if (currentSelectedSizeObj.stock !== undefined) return currentSelectedSizeObj.stock;
      if (currentSelectedSizeObj.inStock === false) return 0;
      return selectedProduct.stock || 0;
    }
    if (productSizes.length > 0) {
      const totalAvailable = productSizes.reduce((acc, s) => {
        if (s.inStock === false) return acc;
        return acc + (s.stock !== undefined ? s.stock : 0);
      }, 0);
      if (totalAvailable > 0) return totalAvailable;
    }
    return selectedProduct.stock || 0;
  }, [currentSelectedSizeObj, productSizes, selectedProduct.stock]);

  const isEffectiveOutOfStock = useMemo(() => {
    if (productSizes.length > 0) {
      if (selectedSize) return isSelectedSizeOutOfStock;
      return productSizes.every(s => s.inStock === false || (s.stock !== undefined && s.stock <= 0));
    }
    return isOutOfStock;
  }, [productSizes, selectedSize, isSelectedSizeOutOfStock, isOutOfStock]);

  const handleAddToCart = () => {
    if (isEffectiveOutOfStock) return;
    if (productSizes.length > 0 && !selectedSize) {
      setIsSizeModalOpen(true);
      return;
    }
    triggerHaptic('success');
    addToCart(selectedProduct, quantity, {
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined,
      selectedVariant: currentVariant?.name || undefined,
      customSpecification: customSpecification.trim() || undefined,
      unitPrice: activeUnitPrice
    });
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const handleShareProduct = async () => {
    const cleanProductName = decodeHtmlEntities(selectedProduct.name);
    const productUrl = `${window.location.origin}/?product=${selectedProduct.id}`;
    const res = await shareContent({
      title: `${cleanProductName} - ${settings.storeName}`,
      text: `¡Mirá esta oferta en VONDRO! ${cleanProductName} a solo ARS$${selectedProduct.salePrice.toLocaleString('es-AR')}`,
      url: productUrl,
    });
    if (res === 'copied') {
      setShareToast('¡Enlace copiado al portapapeles!');
      setTimeout(() => setShareToast(null), 2500);
    }
  };

  const handleShareWhatsAppDiscount = () => {
    triggerHaptic('success');
    applyCoupon('AMIGO2000');
    const msg = encodeURIComponent(
      `¡Hola! Mirá esta super oferta en VONDRO Córdoba: "${selectedProduct.name}" a solo ARS$${selectedProduct.salePrice.toLocaleString('es-AR')}. Si entrás con mi cupón AMIGO2000 tenés $2.000 OFF extra: ${window.location.origin}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
    setShareToast('¡Cupón AMIGO2000 aplicado en tu carrito!');
    setTimeout(() => setShareToast(null), 3000);
  };

  const discountVal = (selectedProduct && (isFlashDealActive || isLowStock))
    ? getFlashDealDiscount(selectedProduct)
    : (selectedProduct?.discountPercentage ?? 0);

  if (!selectedProduct) {
    return (
      <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center">
        <p className="text-slate-500 mb-4 font-semibold">No se ha seleccionado ningún producto.</p>
        <button
          onClick={() => setActiveTab('home')}
          className="px-5 py-2.5 bg-purple-700 text-white rounded-xl text-sm font-bold shadow-xs active:scale-95 transition-all"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-2xl mx-auto bg-white min-h-screen relative">
      
      {/* 1. TOP HEADER */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-3 sm:px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-1.5 sm:gap-3">
        <button
          id="btn-back-from-product"
          onClick={() => {
            triggerHaptic('light');
            if (closeProductDetail) {
              closeProductDetail();
            } else {
              setActiveTab(previousTab || 'home');
            }
          }}
          className="p-1.5 -ml-1 rounded-full text-slate-800 hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-1 shrink-0"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
          <span className="text-xs font-bold text-slate-700 hidden sm:inline">Atrás</span>
        </button>

        {/* Tab switcher: Descripción / Reseñas */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-bold min-w-0">
          <button 
            onClick={() => setActiveTabSection('details')}
            className={`pb-1 border-b-2 transition-colors whitespace-nowrap text-xs ${activeTabSection === 'details' ? 'border-purple-600 text-purple-900 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Descripción
          </button>
          <button 
            onClick={() => setActiveTabSection('reviews')}
            className={`pb-1 border-b-2 transition-colors whitespace-nowrap text-xs ${activeTabSection === 'reviews' ? 'border-purple-600 text-purple-900 font-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Opiniones ({ratingSummary.reviewCount})
          </button>
        </div>

        {/* Actions: Share & Favorite */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="btn-share-product"
            onClick={handleShareProduct}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-700 hover:text-purple-700 active:scale-95 transition-all"
            aria-label="Compartir"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            id="btn-fav-detail"
            onClick={() => {
              triggerHaptic('medium');
              toggleFavorite(selectedProduct.id);
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 hover:text-rose-500 active:scale-95 transition-all"
            aria-label="Favorito"
          >
            <Heart 
              className={`w-4 h-4 transition-colors ${
                isFavorite(selectedProduct.id) 
                  ? 'fill-rose-500 text-rose-500' 
                  : 'text-slate-400'
              }`} 
            />
          </button>
        </div>
      </div>

      {shareToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl">
          {shareToast}
        </div>
      )}

      {/* Main Image Container with Touch Swipe Gesture & Fullscreen Trigger (Compact Height for Above-The-Fold Visibility) */}
      <div 
        className="relative w-full h-[45vh] sm:h-[48vh] max-h-[440px] bg-slate-100 flex items-center justify-center overflow-hidden select-none cursor-pointer group"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setIsLightboxOpen(true)}
      >
        {imageError ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <ImageIcon className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
            <p className="text-xs font-semibold">Imagen del producto</p>
          </div>
        ) : (
          <img
            src={imagesList[selectedImageIndex] || imagesList[0]}
            alt={selectedProduct.name}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain sm:object-cover transition-transform duration-300 pointer-events-none"
            draggable={false}
          />
        )}

        {/* Previous / Next Arrow buttons with enhanced contrast - hidden on touch screens for 100% swipe navigation */}
        {imagesList.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevImage();
              }}
              className="hidden sm:flex absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/80 hover:bg-slate-950 text-white shadow-xl shadow-black/30 backdrop-blur-md border border-white/30 items-center justify-center active:scale-90 transition-all duration-300 z-10 opacity-90 hover:opacity-100 scale-100"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNextImage();
              }}
              className="hidden sm:flex absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/80 hover:bg-slate-950 text-white shadow-xl shadow-black/30 backdrop-blur-md border border-white/30 items-center justify-center active:scale-90 transition-all duration-300 z-10 opacity-90 hover:opacity-100 scale-100"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Zoom / Fullscreen icon hint on top right */}
        <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-xs text-white p-1.5 rounded-full opacity-70 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-4 h-4" />
        </div>

        {/* 1/X Photo Counter Badge on bottom right of image */}
        {imagesList.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs font-mono font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
            <span>{selectedImageIndex + 1}/{imagesList.length}</span>
          </div>
        )}

        {/* Dots indicator for mobile gallery */}
        {imagesList.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/30 backdrop-blur-xs">
            {imagesList.map((_, idx) => (
              <span
                key={idx}
                className={`transition-all rounded-full ${
                  idx === selectedImageIndex 
                    ? 'w-3 h-1.5 bg-white' 
                    : 'w-1.5 h-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inline PDP Thumbnail Carousel with lateral padding & snap-center */}
      {imagesList.length > 1 && (
        <div 
          className="w-full bg-slate-50/50 px-4 py-2 flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar border-b border-slate-100"
          style={{ paddingLeft: '16px', paddingRight: '16px', scrollPadding: '16px', scrollPaddingLeft: '16px', scrollPaddingRight: '16px' }}
        >
          {imagesList.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedImageIndex(idx);
              }}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 snap-center focus:outline-hidden ${
                selectedImageIndex === idx 
                  ? 'border-orange-500 ring-2 ring-orange-500/30 scale-105 shadow-xs opacity-100' 
                  : 'border-slate-200 opacity-70 hover:opacity-100'
              }`}
              style={{ scrollSnapAlign: 'center' }}
              aria-label={`Ver foto ${idx + 1}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover pointer-events-none" />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Interactive Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          id="product-image-lightbox-modal"
          className="fixed inset-0 z-[99999] bg-black/95 flex flex-col justify-between p-3 sm:p-5 pb-3 sm:pb-4 animate-in fade-in duration-200 select-none cursor-pointer"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            setLightboxZoom(1);
            setIsLightboxOpen(false);
          }}
        >
          {/* Top Bar with counter, zoom controls & explicit X close button */}
          <div 
            className="flex items-center justify-between text-white z-20 shrink-0 cursor-default pt-1 sm:pt-2 px-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-mono font-bold text-white shadow-sm border border-white/20">
              {selectedImageIndex + 1} / {imagesList.length}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                id="lightbox-zoom-btn"
                onClick={() => setLightboxZoom(prev => prev > 1 ? 1 : 1.75)}
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer shadow-md"
                aria-label="Zoom"
                title="Zoom"
              >
                {lightboxZoom > 1 ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
              </button>

              {/* Explicit Prominent Close Button with X */}
              <button
                type="button"
                id="lightbox-close-header-btn"
                onClick={() => {
                  setLightboxZoom(1);
                  setIsLightboxOpen(false);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs backdrop-blur-md border border-red-400/40 shadow-xl transition-all cursor-pointer"
                aria-label="Cerrar visor"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4 stroke-[3]" />
                <span className="tracking-wide uppercase text-[11px] font-extrabold">Cerrar</span>
              </button>
            </div>
          </div>

          {/* Center Image Container (max-height: 70vh) with swipe & zoom */}
          <div 
            className="relative flex-1 w-full max-h-[70vh] sm:max-h-[72vh] flex items-center justify-center overflow-hidden my-auto py-1"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setLightboxZoom(1);
                setIsLightboxOpen(false);
              }
            }}
          >
            <img
              src={imagesList[selectedImageIndex] || imagesList[0]}
              alt={selectedProduct.name}
              style={{ transform: `scale(${lightboxZoom})` }}
              className="max-h-[70vh] sm:max-h-[72vh] max-w-full w-auto h-auto object-contain transition-transform duration-200 select-none shadow-2xl"
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Side arrows hidden on touch screens for 100% swipe navigation, visible on desktop */}
            {imagesList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevImage();
                  }}
                  className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-black/90 text-white items-center justify-center active:scale-90 transition-all border border-white/20 shadow-xl"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 hover:bg-black/90 text-white items-center justify-center active:scale-90 transition-all border border-white/20 shadow-xl"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight className="w-6 h-6 stroke-[2.5]" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnail Strip - with lateral padding & snap-center to prevent clipping */}
          {imagesList.length > 1 && (
            <div 
              className="w-full overflow-x-auto snap-x snap-mandatory scroll-smooth px-4 pt-1 pb-1 z-20 shrink-0 cursor-default flex items-center justify-start sm:justify-center gap-2.5 no-scrollbar"
              style={{ paddingLeft: '16px', paddingRight: '16px', scrollPadding: '16px', scrollPaddingLeft: '16px', scrollPaddingRight: '16px' }}
              onClick={(e) => e.stopPropagation()}
            >
              {imagesList.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedImageIndex(idx);
                  }}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 snap-center focus:outline-hidden ${
                    selectedImageIndex === idx 
                      ? 'border-orange-500 ring-2 ring-orange-500/50 scale-105 opacity-100 shadow-md' 
                      : 'border-white/30 opacity-60 hover:opacity-100 hover:border-white/60'
                  }`}
                  style={{ scrollSnapAlign: 'center' }}
                  aria-label={`Ver foto ${idx + 1}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover pointer-events-none" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTabSection === 'reviews' ? (
        <div className="p-4 space-y-6">
          <CustomerReviewsSection
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            productImage={imagesList[0]}
          />
        </div>
      ) : (
        <div className="p-3.5 space-y-3">

          {/* 1. PRODUCT TITLE + SKU + RATING */}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {cleanName}
            </h1>

            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span className="text-[11px] text-emerald-800 font-extrabold bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                Garantía VONDRO
              </span>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTabSection('reviews');
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-purple-700 transition-colors group cursor-pointer"
              >
                {ratingSummary.reviewCount > 0 ? (
                  <>
                    <span>{ratingSummary.rating.toFixed(1)}</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-purple-600 underline font-semibold group-hover:text-purple-800">
                      ({ratingSummary.reviewCount} {ratingSummary.reviewCount === 1 ? 'opinión' : 'opiniones'})
                    </span>
                  </>
                ) : (
                  <>
                    <Star className="w-3.5 h-3.5 text-slate-300" />
                    <span className="text-purple-600 underline font-semibold group-hover:text-purple-800">
                      (0 opiniones • Opinar)
                    </span>
                  </>
                )}

                {selectedProduct.salesCount && selectedProduct.salesCount > 0 ? (
                  <span className="text-slate-500 no-underline font-normal">
                    | {selectedProduct.salesCount >= 1000 ? (selectedProduct.salesCount / 1000).toFixed(1).replace('.', ',') + 'K+' : selectedProduct.salesCount} ventas
                  </span>
                ) : (
                  <span className="text-slate-400 no-underline font-normal">
                    | 0 ventas
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 2. PRICING BOX WITH BADGES & STOCK BADGE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                {productSizes.length > 1 ? (
                  <div className="text-xl sm:text-2xl font-black text-purple-700 tracking-tight leading-tight">
                    <span>$ {productSizes[0].price.toLocaleString('es-AR')}</span>
                    <span className="mx-1.5 text-purple-700 font-bold">-</span>
                    <br className="sm:hidden" />
                    <span>$ {productSizes[productSizes.length - 1].price.toLocaleString('es-AR')}</span>
                  </div>
                ) : (
                  <span className="text-2xl sm:text-3xl font-black text-orange-600 tracking-tight">
                    ARS${activeUnitPrice.toLocaleString('es-AR')}
                  </span>
                )}
                {selectedProduct.originalPrice && selectedProduct.originalPrice > activeUnitPrice && (
                  <span className="text-xs text-slate-400 line-through font-semibold block mt-0.5">
                    ${selectedProduct.originalPrice.toLocaleString('es-AR')}
                  </span>
                )}
              </div>

              {/* Stock badge */}
              <div>
                {isSelectedSizeOutOfStock ? (
                  <div className="border border-rose-400 bg-rose-50/40 rounded-xl px-3 sm:px-4 py-2 flex items-center gap-2 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
                      Sin existencias
                    </span>
                  </div>
                ) : (
                  <div className="border border-emerald-500 bg-emerald-50/20 rounded-xl px-3 sm:px-4 py-2 flex items-center gap-2 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
                      {activeStock} disponibles
                    </span>
                  </div>
                )}
              </div>
            </div>

            {discountVal > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="bg-orange-600 text-white text-[11px] sm:text-xs font-black px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 shadow-2xs">
                  -{discountVal}% OFF
                </span>
                <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                  Stock verificado VONDRO • Despacho inmediato
                </span>
              </div>
            )}
          </div>

          {/* 3. MEGA OFERTA COUNTDOWN TIMER BAR (Only shown when product is in current Flash Deal rotation!) */}
          {isFlashDealActive && <ProductDetailFlashBar />}

          {/* 4. SELECTOR DE TAMAÑO, COLOR & ESPECIFICACIÓN PERSONALIZADA */}
          
          {/* 4.A TAMAÑO DE SÁBANA / PRODUCTO */}
          {productSizes.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black text-slate-800 tracking-wider">
                  TAMAÑO:
                </span>

                {/* Dropdown selector matching Inova screenshot */}
                <div className="relative inline-block min-w-[130px]">
                  <select
                    value={selectedSize}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setSelectedSize(e.target.value);
                    }}
                    className="w-full appearance-none bg-white border border-slate-300 hover:border-purple-500 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 text-xs sm:text-sm font-bold text-slate-800 py-1.5 pl-3 pr-8 rounded-xl transition-all cursor-pointer shadow-2xs"
                  >
                    <option value="">Elegir una opción</option>
                    {productSizes.map((s) => {
                      const isOutOfStockSize = s.inStock === false || (s.stock !== undefined && s.stock <= 0);
                      return (
                        <option key={s.id} value={s.name}>
                          {s.name} {isOutOfStockSize ? '(Sin existencias)' : s.stock !== undefined ? `(${s.stock} disp.)` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* ✕ Limpiar button (exact from screenshots!) */}
                {selectedSize && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedSize('');
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors px-1 py-1"
                  >
                    <span>✕</span>
                    <span>Limpiar</span>
                  </button>
                )}

                {/* Button to open visual size modal */}
                <button
                  type="button"
                  onClick={() => setIsSizeModalOpen(true)}
                  className="text-[11px] font-bold text-purple-700 hover:text-purple-900 ml-auto flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Ver medidas</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* Out of stock warning for selected size if unavailable */}
              {selectedSize && isSelectedSizeOutOfStock && (
                <div className="pt-0.5">
                  <div className="mt-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>El tamaño <strong>{selectedSize}</strong> no tiene existencias disponibles en este momento.</span>
                  </div>
                </div>
              )}

              {/* Quick Select Buttons for Sizes */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {productSizes.map((size) => {
                  const isSelected = selectedSize.toLowerCase() === size.name.toLowerCase() || selectedSize === size.id;
                  const isOut = size.inStock === false || (size.stock !== undefined && size.stock <= 0);
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedSize(size.name);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? isOut
                            ? 'border-rose-400 bg-rose-50/70 ring-2 ring-rose-400/20'
                            : 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-500/20 shadow-xs'
                          : isOut
                          ? 'border-slate-200 bg-slate-50/60 opacity-80'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${isSelected ? (isOut ? 'text-rose-800' : 'text-purple-900') : (isOut ? 'text-slate-600' : 'text-slate-800')}`}>
                          {size.name}
                        </span>
                        {isOut ? (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-md">
                            Sin existencias
                          </span>
                        ) : isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : size.stock !== undefined ? (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                            {size.stock} disp.
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className={`text-[11px] font-mono font-bold ${isOut ? 'text-slate-400' : 'text-slate-900'}`}>
                          $ {size.price.toLocaleString('es-AR')}
                        </span>
                        {size.dimensions && (
                          <span className="text-[9px] text-slate-500 truncate ml-1">
                            {size.dimensions.replace('Para colchón hasta ', '')}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4.B SELECTOR DE COLOR */}
          {productColors.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-pink-600" />
                  <span>COLOR:</span>
                  <strong className="text-pink-700 font-black">{selectedColor || 'Elige tu color'}</strong>
                </span>
                <span className="text-[10px] text-slate-500">
                  {productColors.length} disponibles
                </span>
              </div>

              {/* Color Swatch / Pills */}
              <div className="flex flex-wrap gap-2">
                {productColors.map((color, idx) => {
                  const isSelected = selectedColor.toLowerCase() === color.name.toLowerCase() || selectedColor === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedColor(color.name);
                        if (color.imageUrl) {
                          const matchedIdx = imagesList.findIndex(img => img.includes(color.imageUrl!) || color.imageUrl!.includes(img));
                          if (matchedIdx !== -1) {
                            setSelectedImageIndex(matchedIdx);
                          }
                        } else if (imagesList[idx]) {
                          setSelectedImageIndex(idx);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-pink-500 bg-pink-50/80 ring-2 ring-pink-400/20 text-pink-950 font-bold shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 font-medium'
                      }`}
                    >
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0 shadow-2xs"
                        style={{ backgroundColor: color.hex || '#cbd5e1' }}
                      />
                      <span className="text-xs">{color.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-pink-600 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4.C CAMPO DE ESPECIFICACIÓN MANUAL (Escribir color o detalles) */}
          {shouldAllowCustomSpec && (
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                <span>Dejanos tu especificación para este producto:</span>
              </label>

              <textarea
                value={customSpecification}
                onChange={(e) => setCustomSpecification(e.target.value)}
                placeholder={selectedProduct.specificationPlaceholder || "Ej: 1 color rosa y 1 color celeste, o preferencia de combinación."}
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-amber-300/80 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-hidden bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs"
              />

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-amber-800 font-semibold">Sugerencias rápidas:</span>
                {['1 Rosa y 1 Celeste', '2 en color Gris', 'Color Beige', 'Colores surtidos'].map(sug => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setCustomSpecification(prev => prev ? `${prev} + ${sug}` : sug);
                    }}
                    className="text-[10px] bg-white border border-amber-300 hover:border-amber-400 text-amber-900 px-2 py-0.5 rounded-lg shadow-2xs cursor-pointer active:scale-95"
                  >
                    + {sug}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-amber-800/90 leading-tight">
                💡 Escribí acá tu preferencia de colores o combinaciones (ej. si llevás 2 o más unidades). Nuestro equipo de depósito en Córdoba lo armará exactamente según tu indicación.
              </p>
            </div>
          )}

          {/* 4.D VARIANTES ADICIONALES POR FOTO (Si existían miniaturas previas) */}
          {variants.length > 0 && currentVariant && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Variante por foto: <strong className="text-slate-950 font-extrabold">【{currentVariant.name}】</strong></span>
              </div>

              {/* Thumbnail mini cards */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {variants.map((variant, idx) => (
                  <button
                    key={variant.id}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedVariant(variant);
                      if (selectedProduct.images[idx]) {
                        setSelectedImageIndex(idx);
                      }
                    }}
                    className={`relative min-w-[4rem] h-14 rounded-xl overflow-hidden border-2 transition-all p-0.5 bg-slate-50 flex items-center justify-center cursor-pointer ${
                      currentVariant.id === variant.id 
                        ? 'border-orange-500 ring-2 ring-orange-200' 
                        : 'border-slate-200 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {variant.imageUrl || selectedProduct.images[idx] || selectedProduct.images[0] ? (
                      <img 
                        src={variant.imageUrl || selectedProduct.images[idx] || selectedProduct.images[0]} 
                        alt={variant.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="text-[11px] font-bold text-slate-700 px-1 text-center truncate">
                        {variant.name}
                      </span>
                    )}
                    {idx === 0 && (
                      <span className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-orange-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. QUANTITY STEPPER */}
          <div className="flex items-center justify-between py-1 border-y border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-700 block">Cantidad</span>
              <span className="text-[10px] text-slate-500 font-medium">
                {selectedProduct.stock > 0 
                  ? `(Máximo ${selectedProduct.stock} disponibles)` 
                  : '(Sin stock)'}
              </span>
            </div>
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1 || isOutOfStock}
                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200 disabled:opacity-30"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-black text-slate-900">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                disabled={quantity >= selectedProduct.stock || isOutOfStock}
                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-200 disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 6. UNIFIED LOGISTICS, DELIVERY & 6 GUARANTEES CARD */}
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border border-emerald-200/90 space-y-2 text-xs shadow-2xs">
            <div className="flex items-center justify-between gap-1.5 font-bold text-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-800 min-w-0">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-extrabold text-[11.5px] sm:text-xs text-emerald-950 whitespace-nowrap">
                  Envío GRATIS a Córdoba en 24 a 48 hs
                </span>
              </div>
              <span className="text-[9px] bg-emerald-700 text-white font-extrabold px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                Oficial VONDRO
              </span>
            </div>
            
            <p className="text-slate-600 text-[11px] leading-tight">
              Método de envío: <strong>A domicilio y puntos de retiro</strong> • Despacho rápido y asegurado
            </p>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <span className="bg-emerald-100/90 text-emerald-900 text-[9.5px] sm:text-[10px] font-bold py-1 px-1 rounded-md border border-emerald-200/90 flex items-center justify-center gap-1 text-center whitespace-nowrap">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">Devolución gratis</span>
              </span>
              <span className="bg-emerald-100/90 text-emerald-900 text-[9.5px] sm:text-[10px] font-bold py-1 px-1 rounded-md border border-emerald-200/90 flex items-center justify-center text-center whitespace-nowrap">
                <span className="truncate">$2.100 x retraso</span>
              </span>
              <span className="bg-emerald-100/90 text-emerald-900 text-[9.5px] sm:text-[10px] font-bold py-1 px-1 rounded-md border border-emerald-200/90 flex items-center justify-center text-center whitespace-nowrap">
                <span className="truncate">Reembolso seguro</span>
              </span>
            </div>
          </div>

          {/* 7. VIRAL WHATSAPP DISCOUNT (COMPRA CON UN AMIGO) */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-emerald-950 truncate">¿Querés $2.000 OFF extra?</p>
                <p className="text-[10px] text-emerald-700 font-semibold truncate">Compartí por WhatsApp y desbloquealo</p>
              </div>
            </div>
            <button
              onClick={handleShareWhatsAppDiscount}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs shrink-0 active:scale-95 transition-all"
            >
              Desbloquear
            </button>
          </div>

          {/* Description */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Descripción del producto
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {cleanBrandingText(selectedProduct.description)}
            </p>
          </div>

          {/* Related products */}
          {displayedRelatedProducts.length > 0 && (
            <div className="pt-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🛍️</span> Productos Recomendados
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {currentCategory ? `Artículos relacionados de ${currentCategory.name}` : 'Relacionados con tu selección'}
                  </p>
                </div>
                {currentCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedCategoryFilter(currentCategory.id);
                      setActiveTab('search');
                      closeProductDetail();
                    }}
                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Ver todos</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {displayedRelatedProducts.map(prod => (
                  <ProductCard key={prod.id} product={prod} />
                ))}
              </div>

              {/* Controles para ver más recomendaciones o explorar categoría completa */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2 pb-6">
                {hasMoreRelated && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setRecommendedCount(prev => Math.min(prev + 8, allRelatedProducts.length));
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cargar más recomendados (+8)</span>
                  </button>
                )}

                {currentCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedCategoryFilter(currentCategory.id);
                      setActiveTab('search');
                      closeProductDetail();
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200/80 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Explorar toda la categoría {currentCategory.name}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 13. STICKY BOTTOM BUY BAR (Temu & Inova exact styling) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-2xl max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Original price strikethrough + Sale Price in ARS + selected variant pill */}
        <div className="pl-1">
          {selectedProduct.originalPrice && (
            <p className="text-[11px] text-slate-400 line-through font-semibold">
              ${(selectedProduct.originalPrice * quantity).toLocaleString('es-AR')}
            </p>
          )}
          <p className="text-lg font-black text-orange-600 leading-none">
            ARS${(activeUnitPrice * quantity).toLocaleString('es-AR')}
          </p>
          {(selectedSize || selectedColor) && (
            <p className="text-[10px] text-slate-500 font-bold truncate max-w-[120px] mt-0.5">
              {[selectedSize, selectedColor].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>

        {/* Right: Big Orange Buy CTA Button */}
        <button
          id="btn-add-to-cart-detail"
          onClick={handleAddToCart}
          disabled={isEffectiveOutOfStock}
          className={`flex-1 py-3 px-4 rounded-full text-xs sm:text-sm font-black text-white shadow-lg active:scale-95 transition-all uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer ${
            isEffectiveOutOfStock
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-90'
              : addedAnimation
              ? 'bg-emerald-600'
              : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/25'
          }`}
        >
          {isEffectiveOutOfStock ? (
            isSelectedSizeOutOfStock && selectedSize
              ? `Sin existencias en ${selectedSize}`
              : 'Producto Agotado'
          ) : addedAnimation ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>¡Agregado al Carrito!</span>
            </>
          ) : (
            <span>¡Agregar al carrito! {selectedSize ? `(${selectedSize})` : ''}</span>
          )}
        </button>
      </div>

      {/* 14. MODAL / BOTTOM SHEET: OPCIONES DE TAMAÑO (Estilo Inova Screenshot 4) */}
      {isSizeModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsSizeModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-purple-700" />
                <h3 className="text-base font-black text-slate-900">Opciones de tamaño y disponibilidad</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSizeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sizes List */}
            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-slate-500">
                Selecciona la medida correspondiente para ver precio y existencias en tiempo real:
              </p>

              {productSizes.map((size) => {
                const isSelected = selectedSize.toLowerCase() === size.name.toLowerCase() || selectedSize === size.id;
                const isOutSize = size.inStock === false || (size.stock !== undefined && size.stock <= 0);
                return (
                  <div
                    key={size.id}
                    onClick={() => {
                      triggerHaptic('medium');
                      setSelectedSize(size.name);
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? isOutSize
                          ? 'border-rose-400 bg-rose-50/70 shadow-sm'
                          : 'border-purple-600 bg-purple-50/70 shadow-sm'
                        : isOutSize
                        ? 'border-slate-200 bg-slate-50/80 opacity-80 hover:border-slate-300'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected 
                          ? isOutSize ? 'border-rose-600 bg-rose-600 text-white' : 'border-purple-600 bg-purple-600 text-white' 
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900">
                            {size.name}
                          </h4>
                          {isOutSize ? (
                            <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
                              Sin existencias
                            </span>
                          ) : size.stock !== undefined ? (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                              {size.stock} disponibles
                            </span>
                          ) : null}
                          {isSelected && (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white ${isOutSize ? 'bg-rose-600' : 'bg-purple-600'}`}>
                              Seleccionado
                            </span>
                          )}
                        </div>
                        {size.dimensions && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {size.dimensions}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-sm font-black font-mono ${isOutSize ? 'text-slate-400' : 'text-purple-700'}`}>
                        ARS${size.price.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer button */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80">
              <button
                type="button"
                disabled={isSelectedSizeOutOfStock}
                onClick={() => {
                  triggerHaptic('success');
                  setIsSizeModalOpen(false);
                }}
                className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-colors cursor-pointer ${
                  isSelectedSizeOutOfStock
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-700 hover:bg-purple-800 text-white'
                }`}
              >
                {isSelectedSizeOutOfStock
                  ? `Tamaño ${selectedSize} sin existencias`
                  : `Confirmar tamaño (${selectedSize} - ARS$${activeUnitPrice.toLocaleString('es-AR')})`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
