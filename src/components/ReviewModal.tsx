import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Star, 
  X, 
  Camera, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { decodeHtmlEntities, getCategoryFallback, getOptimizedThumbnail } from '../utils/imageOptimizer';

interface ReviewModalProps {
  productId: string;
  productName: string;
  productImage?: string;
  orderId?: string;
  defaultVariant?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: '¡Excelente! Lo recomiendo 100%', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  4: { label: 'Muy Bueno, cumplió todo', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  3: { label: 'Bueno, aceptable', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  2: { label: 'Regular, puede mejorar', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  1: { label: 'Malo, no fue lo esperado', color: 'text-rose-700 bg-rose-50 border-rose-200' }
};

export const ReviewModal: React.FC<ReviewModalProps> = ({
  productId,
  productName,
  productImage,
  orderId,
  defaultVariant,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, addProductReview, hasUserPurchasedProduct } = useStore();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [author, setAuthor] = useState<string>(() => user?.name || '');
  const [variant, setVariant] = useState<string>(defaultVariant || 'Estándar / Original');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isVerifiedBuyer = hasUserPurchasedProduct(productId) || !!orderId;
  const activeRating = hoverRating || rating;
  const cleanTitle = decodeHtmlEntities(productName);
  const displayThumb = productImage ? getOptimizedThumbnail(productImage, 100) : getCategoryFallback();

  const handleStarClick = (starValue: number) => {
    triggerHaptic('selection');
    setRating(starValue);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedImages.length >= 3) {
      setFeedbackError('Máximo 3 imágenes por opinión');
      return;
    }

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      setFeedbackError('La imagen no debe superar los 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedImages(prev => [...prev.slice(0, 2), reader.result as string]);
        setFeedbackError(null);
        triggerHaptic('light');
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    triggerHaptic('selection');
    setUploadedImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setFeedbackError('Por favor escribe tu opinión sobre el producto');
      return;
    }

    setIsSubmitting(true);
    setFeedbackError(null);

    const result = await addProductReview(productId, {
      rating,
      title: title.trim() || undefined,
      comment: comment.trim(),
      author: author.trim() || user?.name || 'Cliente Verificado',
      boughtVariant: variant.trim() || 'Estándar',
      images: uploadedImages,
      orderId
    });

    setIsSubmitting(false);

    if (result.success) {
      triggerHaptic('success');
      onSuccess?.();
      onClose();
    } else {
      setFeedbackError(result.message || 'Ocurrió un error al enviar tu calificación');
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0">
              <img 
                src={displayThumb} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getCategoryFallback();
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-purple-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Calificar Producto
                </span>
                {isVerifiedBuyer ? (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Comprador Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full">
                    <ShieldCheck className="w-2.5 h-2.5 text-slate-500" /> Reseña segura
                  </span>
                )}
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {cleanTitle}
              </h3>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {feedbackError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{feedbackError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Compact Star Rating Section */}
          <div className="bg-slate-50/90 py-2.5 px-3 rounded-xl border border-slate-200/80 flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-[11px] font-bold text-slate-700">
              ¿Qué puntuación le das a este producto?
            </span>

            <div className="flex items-center justify-center gap-1.5 py-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 hover:scale-115 transition-transform focus:outline-hidden"
                  aria-label={`${star} estrellas`}
                >
                  <Star 
                    className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${
                      star <= activeRating 
                        ? 'fill-amber-400 text-amber-400 drop-shadow-xs' 
                        : 'text-slate-200 fill-slate-100 hover:text-amber-200'
                    }`} 
                  />
                </button>
              ))}
            </div>

            {RATING_LABELS[activeRating] && (
              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border ${RATING_LABELS[activeRating].color}`}>
                {RATING_LABELS[activeRating].label}
              </span>
            )}
          </div>

          {/* 2-Column Responsive Row: Author & Variant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                Tu Nombre / Apodo
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ej. Lucas M."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
                Variante / Color
              </label>
              <input
                type="text"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="Ej. Negro, Estándar"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all outline-hidden"
              />
            </div>
          </div>

          {/* Optional Title */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
              Título de tu reseña <span className="text-slate-400 font-normal text-[10px]">(Opcional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Excelente calidad, llegó súper rápido"
              maxLength={80}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all outline-hidden"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-0.5">
              Tu opinión detallada <span className="text-purple-600">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="¿Qué tal la calidad, funcionamiento y envío? Contanos tu experiencia..."
              required
              rows={2}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all outline-hidden resize-none leading-relaxed"
            />
          </div>

          {/* Compact Photo Attachments Row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              {uploadedImages.map((img, idx) => (
                <div key={idx} className="relative w-11 h-11 rounded-lg overflow-hidden border border-purple-300 bg-slate-100 group">
                  <img src={img} alt="Foto subida" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {uploadedImages.length < 3 && (
                <label className="w-11 h-11 rounded-lg border border-dashed border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-purple-600 cursor-pointer transition-all shrink-0">
                  <Camera className="w-4 h-4" />
                  <span className="text-[8px] font-bold mt-0.5">+ Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <span className="text-[10px] text-slate-400 font-medium">
              Fotos del producto <strong className="text-purple-700">({uploadedImages.length}/3)</strong>
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !comment.trim()}
              className="flex-1 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <span>Publicando...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Publicar Opinión</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
