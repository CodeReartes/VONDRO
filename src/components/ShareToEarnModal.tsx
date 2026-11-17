import React, { useState } from 'react';
import { X, Check, Users, MessageCircle, Copy, Sparkles, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { triggerHaptic } from '../utils/native';
import { useStore } from '../context/StoreContext';

interface ShareToEarnModalProps {
  product: Product;
  onClose: () => void;
}

export const ShareToEarnModal: React.FC<ShareToEarnModalProps> = ({ product, onClose }) => {
  const { applyCoupon } = useStore();
  const [unlocked, setUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);

  const referralCode = 'AMIGO2000';
  const shareText = `¡Mirá esta oferta en VONDRO Córdoba! ${product.name} a solo ARS$${product.salePrice.toLocaleString('es-AR')}. Si entrás con mi cupón ${referralCode} tenés $2.000 de descuento extra: https://vondro.com/p/${product.id}`;

  const handleShareWhatsApp = () => {
    triggerHaptic('success');
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
    
    // Unlock coupon immediately for the user
    setTimeout(() => {
      setUnlocked(true);
      if (applyCoupon) {
        applyCoupon(referralCode);
      }
    }, 1500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    triggerHaptic('light');
    setTimeout(() => {
      setCopied(false);
      setUnlocked(true);
      if (applyCoupon) {
        applyCoupon(referralCode);
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center animate-scaleIn">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
            <Users className="w-3.5 h-3.5" />
            <span>COMPRA CON UN AMIGO</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Preview */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-left">
          <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-xl object-cover" />
          <div>
            <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{product.name}</h4>
            <p className="text-xs font-black text-rose-600">ARS${product.salePrice.toLocaleString('es-AR')}</p>
          </div>
        </div>

        {/* Reward Value */}
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900">
            ¡Desbloqueá $2.000 OFF Inmediatos!
          </h3>
          <p className="text-xs text-slate-500">
            Compartí este producto con 1 amigo por WhatsApp y ambos reciben $2.000 de descuento en su pedido.
          </p>
        </div>

        {unlocked ? (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-2.5 animate-scaleIn">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-black text-xs">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>¡Cupón Desbloqueado y Aplicado!</span>
            </div>
            <div className="bg-white rounded-xl py-2 font-mono font-black text-emerald-950 text-sm tracking-widest border border-emerald-200">
              {referralCode}
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Continuar Comprando</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <button
              onClick={handleShareWhatsApp}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Compartir por WhatsApp</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Enlace copiado!' : 'Copiar enlace directo'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
