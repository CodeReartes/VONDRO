import React, { useState } from 'react';
import { X, Check, ShoppingCart, ShieldCheck } from 'lucide-react';
import { Product, ProductVariant } from '../types/index';
import { triggerHaptic } from '../utils/native';

interface QuickVariantBottomSheetProps {
  product: Product;
  isOpen?: boolean;
  onClose: () => void;
  onAddToCart: (variant: ProductVariant, quantity: number) => void;
}

export const QuickVariantBottomSheet: React.FC<QuickVariantBottomSheetProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  const variants = product.variants || [];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(variants[0] || {
    id: 'default',
    name: 'Estándar',
    color: '#8b5cf6',
    inStock: true
  });
  const [quantity, setQuantity] = useState(1);

  const handleConfirm = () => {
    triggerHaptic('medium');
    onAddToCart(selectedVariant, quantity);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-100 animate-slideUp sm:animate-scaleIn"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              <img 
                src={selectedVariant.imageUrl || product.images[0]} 
                alt={product.name} 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-black text-rose-600">
                ARS${product.salePrice.toLocaleString('es-AR')}
              </p>
              <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{product.name}</h4>
              <p className="text-[10px] text-slate-500 font-semibold">
                Variante seleccionada: <span className="text-purple-700 font-bold">{selectedVariant.name}</span>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Variants List */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700">Elegí tu Color / Opción:</label>
          <div className="grid grid-cols-2 gap-2">
            {variants.map((v) => {
              const isSelected = selectedVariant.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    triggerHaptic('selection');
                    setSelectedVariant(v);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/70 ring-1 ring-purple-600 text-purple-950 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {v.color && (
                    <span 
                      className="w-4 h-4 rounded-full border border-slate-300 shrink-0 shadow-xs" 
                      style={{ backgroundColor: v.color }} 
                    />
                  )}
                  <span className="text-xs truncate flex-1">{v.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-purple-700 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold text-slate-700">Cantidad:</span>
          <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-xl">
            <button
              onClick={() => {
                if (quantity > 1) {
                  triggerHaptic('selection');
                  setQuantity(q => q - 1);
                }
              }}
              className="font-black text-slate-600 hover:text-slate-900 w-5 text-center"
            >
              -
            </button>
            <span className="text-xs font-bold text-slate-900 w-4 text-center">{quantity}</span>
            <button
              onClick={() => {
                triggerHaptic('selection');
                setQuantity(q => q + 1);
              }}
              className="font-black text-slate-600 hover:text-slate-900 w-5 text-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Add Button */}
        <button
          onClick={handleConfirm}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs py-3 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Agregar al Carrito • ARS${(product.salePrice * quantity).toLocaleString('es-AR')}</span>
        </button>
      </div>
    </div>
  );
};
