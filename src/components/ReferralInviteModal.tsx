import React, { useState, useMemo } from 'react';
import { 
  Gift, 
  Copy, 
  Check, 
  Share2, 
  MessageCircle, 
  Users, 
  Award, 
  X, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Tag
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic, shareContent } from '../utils/native';
import { triggerCelebrationConfetti } from '../utils/confetti';

interface ReferralInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralInviteModal: React.FC<ReferralInviteModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserProfile, redeemReferralCode } = useStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputFriendCode, setInputFriendCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate unique and memorable referral code for the user
  const referralCode = useMemo(() => {
    if (user?.referralCode) return user.referralCode;
    if (user?.id) {
      const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
      return `VON-${cleanId}`;
    }
    if (user?.name) {
      const cleanName = user.name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
      return `VON-${cleanName || 'AMIGO'}26`;
    }
    return 'VON-INVITA';
  }, [user]);

  // Ensure referral code is saved to user profile if missing
  React.useEffect(() => {
    if (user && !user.referralCode && referralCode) {
      updateUserProfile({ referralCode });
    }
  }, [user, referralCode, updateUserProfile]);

  const referralUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vondro.com';
    return `${origin}/?ref=${referralCode}`;
  }, [referralCode]);

  // Referral stats
  const referralCount = user?.referralCount ?? 0;
  const referralEarnings = user?.referralEarnings ?? referralCount * 5000;
  const hasClaimedFriendDiscount = Boolean(user?.claimedReferralDiscount);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    triggerHaptic('medium');
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyLink = async () => {
    triggerHaptic('medium');
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    triggerHaptic('medium');
    const message = `¡Hola! Te regalo un descuento exclusivo de $5.000 en VONDRO Córdoba 🛍️.\n\nComprá bazar, tecnología y hogar con envíos rápidos en el día. Usá mi código de invitación *${referralCode}* al pagar o entrá directo acá:\n${referralUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleNativeShare = async () => {
    const res = await shareContent({
      title: 'Regalo de $5.000 en VONDRO Córdoba',
      text: `Te invito a comprar en VONDRO Córdoba con $5.000 OFF en tu primer pedido usando mi código ${referralCode}`,
      url: referralUrl,
    });
    if (res === 'copied') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else if (!res) {
      handleCopyLink();
    }
  };

  const handleRedeemFriendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemStatus(null);
    const code = inputFriendCode.trim().toUpperCase();

    if (!code) {
      setRedeemStatus({ type: 'error', message: 'Por favor ingresá un código de invitación válido.' });
      return;
    }

    if (code === referralCode) {
      setRedeemStatus({ type: 'error', message: 'No podés canjear tu propio código de invitación.' });
      return;
    }

    if (hasClaimedFriendDiscount) {
      setRedeemStatus({ type: 'error', message: 'Ya has canjeado un cupón de bienvenida de invitación en tu cuenta.' });
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('selection');

    try {
      const res = await redeemReferralCode(code);
      if (res.success) {
        triggerCelebrationConfetti();
        triggerHaptic('success');
        setRedeemStatus({ type: 'success', message: res.message });
        setInputFriendCode('');
      } else {
        triggerHaptic('error');
        setRedeemStatus({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setRedeemStatus({
        type: 'error',
        message: err?.message || 'Hubo un inconveniente al validar el código. Intentá nuevamente.'
      });
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 my-auto animate-scaleIn flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Card */}
        <div className="relative bg-gradient-to-br from-purple-800 via-purple-700 to-indigo-900 text-white p-5 sm:p-6 overflow-hidden shrink-0">
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Background decorative circles */}
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -top-10 w-36 h-36 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 backdrop-blur-xs text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Córdoba Capital
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
            ¡Invitá a tus amigos y ganá <span className="text-amber-300">$5.000 OFF</span>!
          </h2>
          <p className="text-xs sm:text-sm text-purple-100 mt-1.5 leading-relaxed">
            Compartí tu código. Tus amigos reciben <strong>$5.000 de descuento</strong> en su primera compra y vos ganás <strong>$5.000</strong> cuando se entregue su pedido.
          </p>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain">
          {/* User's Referral Code Card */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50/70 border-2 border-dashed border-purple-300 rounded-2xl p-4 text-center space-y-3">
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block">
              Tu Código de Invitación Exclusivo
            </span>

            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-black text-purple-950 tracking-widest bg-white px-4 py-2 rounded-xl shadow-xs border border-purple-200">
                {referralCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs transition-transform active:scale-90 cursor-pointer flex items-center justify-center shrink-0"
                title="Copiar código"
              >
                {copiedCode ? <Check className="w-5 h-5 text-emerald-300 stroke-[3]" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            {copiedCode && (
              <p className="text-xs font-bold text-emerald-700 animate-fadeIn">
                ✓ ¡Código copiado al portapapeles!
              </p>
            )}

            {/* Quick Share Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* WhatsApp direct share */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Enviar por WhatsApp</span>
              </button>

              {/* Copy Link or Native Share */}
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full py-2.5 px-3 bg-purple-100 hover:bg-purple-200 text-purple-900 font-black text-xs rounded-xl border border-purple-300 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>¡Enlace copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-purple-700" />
                    <span>Compartir enlace</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dashboard Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Amigos Invitados</span>
                <span className="text-lg font-black text-slate-900 leading-tight">
                  {referralCount}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Descuentos Ganados</span>
                <span className="text-lg font-black text-slate-900 leading-tight">
                  ${referralEarnings.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Canjear código de un amigo */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-700" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                ¿Tenés el código de un amigo?
              </h3>
            </div>
            <p className="text-[11px] text-slate-600">
              Ingresalo aquí para obtener de inmediato tu cupón de <strong>$5.000 OFF</strong> para tu compra.
            </p>

            <form onSubmit={handleRedeemFriendCode} className="flex gap-2">
              <input
                type="text"
                placeholder="Ej. VON-AMIGO26"
                value={inputFriendCode}
                onChange={(e) => setInputFriendCode(e.target.value)}
                disabled={hasClaimedFriendDiscount || isSubmitting}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={hasClaimedFriendDiscount || isSubmitting || !inputFriendCode.trim()}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                {isSubmitting ? 'Validando...' : hasClaimedFriendDiscount ? 'Canjeado ✓' : 'Canjear'}
              </button>
            </form>

            {redeemStatus && (
              <div className={`p-2.5 rounded-xl text-xs font-bold flex items-start gap-2 ${
                redeemStatus.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {redeemStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{redeemStatus.message}</span>
              </div>
            )}
          </div>

          {/* How it works steps */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
              <span>¿Cómo funciona el Programa de Invitaciones?</span>
            </h4>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-purple-700 text-white text-[11px] font-black flex items-center justify-center shrink-0">1</span>
                <div>
                  <span className="font-bold text-slate-800 block">Compartís tu código o link</span>
                  <span className="text-[11px] text-slate-500">Por WhatsApp, Instagram o redes con amigos de Córdoba.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-purple-700 text-white text-[11px] font-black flex items-center justify-center shrink-0">2</span>
                <div>
                  <span className="font-bold text-slate-800 block">Tu amigo ahorra $5.000</span>
                  <span className="text-[11px] text-slate-500">Recibe $5.000 OFF en su primera compra mayor a $20.000.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-purple-700 text-white text-[11px] font-black flex items-center justify-center shrink-0">3</span>
                <div>
                  <span className="font-bold text-slate-800 block">¡Vos ganás $5.000 OFF!</span>
                  <span className="text-[11px] text-slate-500">En cuanto su pedido sea entregado, tu cuenta recibe automáticamente un cupón de $5.000.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
