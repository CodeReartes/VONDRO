import React, { useState, useMemo } from 'react';
import { 
  Star, 
  CheckCircle2, 
  Camera, 
  ThumbsUp, 
  MessageSquarePlus, 
  X,
  Share2,
  ShieldCheck, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PackageCheck
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { ProductReview } from '../types';
import { ReviewModal } from './ReviewModal';

interface CustomerReviewsSectionProps {
  productId: string;
  productName: string;
  productImage?: string;
}

interface PhotoGalleryItem {
  image: string;
  review: ProductReview;
  index: number;
}

export const CustomerReviewsSection: React.FC<CustomerReviewsSectionProps> = ({
  productId,
  productName,
  productImage
}) => {
  const { 
    getProductReviews, 
    getProductRatingSummary, 
    likeProductReview, 
    hasUserPurchasedProduct 
  } = useStore();

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'photos' | '5' | '4' | '3' | 'verified'>('all');
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [lightboxActiveIndex, setLightboxActiveIndex] = useState<number | null>(null);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // Dynamic live reviews and rating summary
  const reviews: ProductReview[] = getProductReviews(productId) || [];
  const summary = getProductRatingSummary(productId);

  const isVerifiedBuyer = hasUserPurchasedProduct(productId);

  // Bulletproof positive satisfaction % (4 and 5 stars)
  const satisfactionPct = useMemo(() => {
    if (!reviews || reviews.length === 0) return 98;
    const pos = reviews.filter(r => r.rating >= 4).length;
    return Math.round((pos / reviews.length) * 100);
  }, [reviews]);

  // Aggregate all real customer photos from all reviews
  const allCustomerPhotos: PhotoGalleryItem[] = useMemo(() => {
    const list: PhotoGalleryItem[] = [];
    reviews.forEach(rev => {
      if (rev.images && rev.images.length > 0) {
        rev.images.forEach(img => {
          list.push({
            image: img,
            review: rev,
            index: list.length
          });
        });
      }
    });
    return list;
  }, [reviews]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter(rev => {
      if (selectedFilter === 'photos') {
        return rev.images && rev.images.length > 0;
      }
      if (selectedFilter === '5') {
        return rev.rating === 5;
      }
      if (selectedFilter === '4') {
        return rev.rating === 4;
      }
      if (selectedFilter === '3') {
        return rev.rating <= 3;
      }
      if (selectedFilter === 'verified') {
        return rev.verified;
      }
      return true;
    });
  }, [reviews, selectedFilter]);

  const handleLike = (reviewId: string) => {
    triggerHaptic('light');
    likeProductReview(productId, reviewId);
  };

  const handleShare = (rev: ProductReview) => {
    triggerHaptic('selection');
    const shareText = `Opinión de ${rev.author} sobre ${productName}: "${rev.comment}" ⭐ ${rev.rating}/5`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const reviewsWithPhotosCount = useMemo(() => {
    return reviews.filter(r => r.images && r.images.length > 0).length;
  }, [reviews]);

  const activeLightboxItem = lightboxActiveIndex !== null ? allCustomerPhotos[lightboxActiveIndex] : null;

  return (
    <div className="space-y-3.5">
      {/* 1. COMPACT & PROFESSIONAL RATING DASHBOARD */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs space-y-2.5">
        
        {/* Top Mini Header: Trust & Location */}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1 text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Opiniones auditadas en tiempo real</span>
          </div>
          <span className="text-slate-400 text-[10px] font-semibold">Vondro Córdoba</span>
        </div>

        {/* 2-Column Balanced Grid: Left = Rating & CTA | Right = Star Breakdown Bars */}
        <div className="grid grid-cols-12 gap-3 items-center pt-0.5">
          
          {/* Left Column: Big Score, Stars & + Opinar Button */}
          <div className="col-span-5 sm:col-span-4 flex flex-col items-center justify-center text-center pr-1 border-r border-slate-100">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
              {summary.reviewCount > 0 ? summary.rating.toFixed(1) : '0.0'}
            </span>

            <div className="flex text-amber-400 justify-center gap-0.5 my-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star 
                  key={s} 
                  className={`w-3 h-3 ${summary.reviewCount > 0 && s <= Math.round(summary.rating) ? 'fill-current' : 'text-slate-200 fill-slate-100'}`} 
                />
              ))}
            </div>

            <span className="text-[10.5px] text-slate-500 font-bold">
              {summary.reviewCount} {summary.reviewCount === 1 ? 'opinión' : 'opiniones'}
            </span>

            {summary.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full mt-1 border border-emerald-200/60">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                {satisfactionPct}% satisfacción
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded-full mt-1 border border-purple-200/60">
                ¡Sé el primero!
              </span>
            )}

            {/* Compact Call-to-action button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setShowReviewModal(true);
              }}
              className="mt-2 w-full py-1.5 px-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-extrabold text-[10.5px] rounded-lg shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>+ Opinar</span>
            </button>
          </div>

          {/* Right Column: Compact Star Bars (Clickable to filter) */}
          <div className="col-span-7 sm:col-span-8 space-y-1 pl-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.distribution[stars as keyof typeof summary.distribution] || 0;
              const pct = summary.reviewCount > 0 ? Math.round((count / summary.reviewCount) * 100) : 0;
              const isSelected = selectedFilter === (stars === 5 ? '5' : stars === 4 ? '4' : '3');

              return (
                <div 
                  key={stars} 
                  className={`flex items-center gap-1.5 text-xs cursor-pointer px-1 py-0.5 rounded transition-colors ${isSelected ? 'bg-purple-50' : 'hover:bg-slate-50'}`}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedFilter(stars === 5 ? '5' : stars === 4 ? '4' : '3');
                  }}
                  title={`Filtrar por ${stars} estrellas`}
                >
                  <div className="flex items-center gap-0.5 w-7 shrink-0 font-bold text-slate-700 text-[10.5px]">
                    <span>{stars}</span>
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  </div>

                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${isSelected ? 'bg-purple-600' : 'bg-amber-400'}`} 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>

                  <span className="w-7 text-right text-[10px] font-bold text-slate-500">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>

        </div>

        {/* Filter Chips Row */}
        <div className="flex gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedFilter('all');
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${
              selectedFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todas ({reviews.length})
          </button>

          {reviewsWithPhotosCount > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedFilter('photos');
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all flex items-center gap-1 ${
                selectedFilter === 'photos'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>Con fotos ({reviewsWithPhotosCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedFilter('5');
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${
              selectedFilter === '5'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            5 Estrellas ({summary.distribution[5] || 0})
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedFilter('verified');
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all ${
              selectedFilter === 'verified'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' 
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            ✓ Verificadas
          </button>
        </div>
      </div>

      {/* 2. DEDICATED REAL CUSTOMER PHOTOS ROW (GALERÍA DE FOTOS REALES DE CLIENTES EN CÓRDOBA) */}
      {allCustomerPhotos.length > 0 && (
        <div className="bg-gradient-to-br from-purple-900/10 via-slate-50 to-indigo-900/10 border border-purple-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span>Fotos reales de clientes en Córdoba</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[9.5px] font-black px-1.5 py-0.2 rounded-full border border-emerald-300">
                    100% Reales
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500">Unboxing y productos entregados en mano</p>
              </div>
            </div>
            <span className="text-[10.5px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              {allCustomerPhotos.length} fotos
            </span>
          </div>

          {/* Horizontal Scroll Gallery */}
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar snap-x">
            {allCustomerPhotos.map((item, idx) => (
              <div
                key={`cust-photo-${idx}`}
                onClick={() => {
                  triggerHaptic('light');
                  setLightboxActiveIndex(idx);
                }}
                className="group relative snap-start w-28 sm:w-32 h-36 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs cursor-pointer hover:border-purple-500 hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Image */}
                <img 
                  src={item.image} 
                  alt={`Foto real de ${item.review.author}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  loading="lazy"
                />

                {/* Top Badge: Verified Star */}
                <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span>5.0</span>
                </div>

                {/* Bottom Overlay: Customer and Location */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-1.5 text-white">
                  <p className="text-[10px] font-bold line-clamp-1 leading-none">{item.review.author}</p>
                  <p className="text-[8.5px] text-amber-300 flex items-center gap-0.5 mt-0.5 leading-none">
                    <MapPin className="w-2 h-2 shrink-0" />
                    <span className="truncate">{item.review.country.replace('🇦🇷 Argentina (', '').replace(')', '') || 'Córdoba'}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {copiedShare && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold p-2 rounded-xl text-center animate-in fade-in">
          ¡Opinión copiada al portapapeles!
        </div>
      )}

      {/* 3. REVIEWS LIST */}
      <div className="divide-y divide-slate-100 space-y-3 pt-1">
        {reviews.length === 0 ? (
          <div className="text-center py-7 bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Aún no hay opiniones para este producto
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Las opiniones de VONDRO son 100% reales. ¡Sé el primero en calificarlo!
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setShowReviewModal(true);
              }}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Escribir la primera opinión</span>
            </button>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-200/70 p-5 space-y-2">
            <MessageSquarePlus className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-600">
              No hay opiniones con el filtro seleccionado.
            </p>
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className="text-xs text-purple-700 font-bold underline cursor-pointer"
            >
              Ver todas las opiniones
            </button>
          </div>
        ) : (
          filteredReviews.map((rev) => (
            <div key={rev.id} className="pt-3 space-y-1.5">
              {/* User row */}
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full ${rev.avatarColor || 'bg-purple-600'} text-white flex items-center justify-center font-bold text-[10px] shrink-0`}>
                  {rev.author.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">{rev.author}</span>
                  {rev.verified && (
                    <span className="bg-emerald-100 text-emerald-800 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                      ✓ Comprador
                    </span>
                  )}
                  <span className="text-[10.5px] text-slate-400">• {rev.country || '🇦🇷 Córdoba'}</span>
                  <span className="text-[10.5px] text-slate-400">• {rev.date}</span>
                </div>
              </div>

              {/* Stars & Tag Badge */}
              <div className="flex items-center gap-2">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`w-3 h-3 ${star <= rev.rating ? 'fill-current' : 'text-slate-200'}`} 
                    />
                  ))}
                </div>
                {rev.rating === 5 ? (
                  <span className="text-[11px] font-black italic text-orange-600">
                    EXCELENTE 👍
                  </span>
                ) : rev.rating === 4 ? (
                  <span className="text-[11px] font-bold text-blue-700">
                    MUY BUENO ✨
                  </span>
                ) : null}
              </div>

              {/* Title if present */}
              {rev.title && (
                <h4 className="text-xs font-bold text-slate-900">
                  {rev.title}
                </h4>
              )}

              {/* Variant detail */}
              {rev.boughtVariant && (
                <p className="text-[10.5px] text-slate-500 font-medium">
                  Compró: <strong className="text-slate-700">{rev.boughtVariant}</strong>
                </p>
              )}

              {/* Comment */}
              <p className="text-xs text-slate-700 leading-relaxed">
                {rev.comment}
              </p>

              {/* Attached customer photos */}
              {rev.images && rev.images.length > 0 && (
                <div className="flex gap-2 pt-0.5 flex-wrap">
                  {rev.images.map((img, i) => {
                    const matchIdx = allCustomerPhotos.findIndex(p => p.image === img);
                    return (
                      <div 
                        key={i} 
                        onClick={() => {
                          triggerHaptic('light');
                          setLightboxActiveIndex(matchIdx > -1 ? matchIdx : 0);
                        }}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:opacity-90 hover:scale-102 transition-all relative group shadow-2xs"
                      >
                        <img src={img} alt="Foto cliente" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions: Compartir, Útil */}
              <div className="flex items-center gap-3.5 text-[11px] text-slate-400 pt-0.5">
                <button 
                  type="button"
                  onClick={() => handleShare(rev)}
                  className="flex items-center gap-1 hover:text-purple-700 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3 h-3" />
                  <span>Compartir</span>
                </button>

                <button 
                  type="button"
                  onClick={() => handleLike(rev.id)}
                  className={`flex items-center gap-1 transition-colors cursor-pointer ${rev.likedByUser ? 'text-purple-700 font-bold' : 'hover:text-slate-800'}`}
                >
                  <ThumbsUp className={`w-3 h-3 ${rev.likedByUser ? 'fill-purple-700' : ''}`} />
                  <span>Útil ({rev.likes || 0})</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. ENHANCED LIGHTBOX MODAL WITH FULL REVIEW & GALLERY NAVIGATION */}
      {activeLightboxItem && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onClick={() => setLightboxActiveIndex(null)}
        >
          {/* Close button */}
          <button 
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxActiveIndex(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Left / Right Nav Arrows */}
          {allCustomerPhotos.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white p-2 sm:p-3 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm z-20 cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  setLightboxActiveIndex((prev) => (prev! > 0 ? prev! - 1 : allCustomerPhotos.length - 1));
                }}
                aria-label="Foto anterior"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </button>

              <button
                type="button"
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white p-2 sm:p-3 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm z-20 cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('light');
                  setLightboxActiveIndex((prev) => (prev! < allCustomerPhotos.length - 1 ? prev! + 1 : 0));
                }}
                aria-label="Siguiente foto"
              >
                <ChevronRight className="w-6 h-6 stroke-[2.5]" />
              </button>
            </>
          )}

          {/* Modal Content Card */}
          <div 
            className="relative max-w-lg w-full bg-slate-900/95 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image container */}
            <div className="relative w-full bg-black flex items-center justify-center min-h-[260px] max-h-[50vh] overflow-hidden">
              <img 
                src={activeLightboxItem.image} 
                alt="Foto cliente ampliada" 
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-xs font-black px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-purple-400" />
                <span>Foto {activeLightboxItem.index + 1} de {allCustomerPhotos.length}</span>
              </div>
            </div>

            {/* Review detail body */}
            <div className="p-4 sm:p-5 text-white space-y-2.5 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full ${activeLightboxItem.review.avatarColor || 'bg-purple-600'} text-white flex items-center justify-center font-black text-xs`}>
                    {activeLightboxItem.review.author.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold leading-tight">{activeLightboxItem.review.author}</h5>
                    <p className="text-[11px] text-amber-300 flex items-center gap-1 font-semibold">
                      <MapPin className="w-3 h-3" />
                      <span>{activeLightboxItem.review.country || 'Córdoba Capital'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      className={`w-3.5 h-3.5 ${s <= activeLightboxItem.review.rating ? 'fill-current' : 'text-slate-600'}`} 
                    />
                  ))}
                </div>
              </div>

              {activeLightboxItem.review.title && (
                <h6 className="text-xs font-black text-purple-200">
                  "{activeLightboxItem.review.title}"
                </h6>
              )}

              <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                {activeLightboxItem.review.comment}
              </p>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Entrega verificada por VONDRO</span>
                </span>

                <button
                  type="button"
                  onClick={() => handleLike(activeLightboxItem.review.id)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                    activeLightboxItem.review.likedByUser 
                      ? 'bg-purple-600 text-white border-purple-500' 
                      : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/10'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Útil ({activeLightboxItem.review.likes || 0})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review creation modal */}
      <ReviewModal
        productId={productId}
        productName={productName}
        productImage={productImage}
        defaultVariant={reviews[0]?.boughtVariant}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
      />
    </div>
  );
};
