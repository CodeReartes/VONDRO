import React, { useState, useEffect } from 'react';
import { X, Sparkles, Trophy, Gift, ArrowRight, Check, Clock, Zap } from 'lucide-react';
import { triggerHaptic } from '../utils/native';
import { triggerCelebrationConfetti } from '../utils/confetti';
import { useStore } from '../context/StoreContext';

interface SpinWheelModalProps {
  onClose: () => void;
}

const PRIZES = [
  { label: '$5.000 OFF', code: 'PACK5000', color: '#9333ea', text: '#ffffff', desc: 'Pack de Bienvenida $5.000' },
  { label: '15% OFF', code: 'PROMO15', color: '#f59e0b', text: '#000000', desc: '15% Extra en tu compra' },
  { label: '$3.000 OFF', code: 'REGALO3000', color: '#ec4899', text: '#ffffff', desc: 'Bono directo de regalo' },
  { label: 'Envío Gratis', code: 'ENVIOGRATIS', color: '#10b981', text: '#ffffff', desc: 'Envío Gratis a Córdoba' },
  { label: '20% OFF', code: 'VIP20', color: '#6366f1', text: '#ffffff', desc: 'Super Descuento VIP' },
  { label: '$2.500 OFF', code: 'BIENVENIDO', color: '#ef4444', text: '#ffffff', desc: 'Cupón Bienvenida Express' },
];

export const SpinWheelModal: React.FC<SpinWheelModalProps> = ({ onClose }) => {
  const { applyCoupon, setActiveTab } = useStore();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<{ label: string; code: string; desc?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15:00 countdown timer

  // Urgency countdown timer once won
  useEffect(() => {
    if (!wonPrize) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [wonPrize]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const spin = () => {
    if (isSpinning || wonPrize) return;
    triggerHaptic('heavy');
    setIsSpinning(true);

    // Guaranteed top winning prize: $5.000 OFF (index 0) or 15% OFF (index 1) or $3.000 OFF (index 2)
    const possibleWinningIndices = [0, 0, 1, 2, 0]; // High probability of $5.000 Pack
    const targetPrizeIndex = possibleWinningIndices[Math.floor(Math.random() * possibleWinningIndices.length)];
    
    const segmentAngle = 360 / PRIZES.length;
    const extraSpins = 6 * 360; // 6 full rotations for excitement
    const targetAngle = extraSpins + (360 - (targetPrizeIndex * segmentAngle + segmentAngle / 2));

    setRotation(targetAngle);

    // Simulate clicking ticks during spin
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      tickCount++;
      triggerHaptic('selection');
      if (tickCount > 25) clearInterval(tickInterval);
    }, 150);

    setTimeout(() => {
      clearInterval(tickInterval);
      setIsSpinning(false);
      const selected = PRIZES[targetPrizeIndex];
      setWonPrize(selected);
      triggerHaptic('success');
      triggerCelebrationConfetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 }
      });
      localStorage.setItem('vondro_wheel_spun', 'true');
      localStorage.setItem('vondro_won_coupon', JSON.stringify(selected));
      
      if (applyCoupon) {
        applyCoupon(selected.code);
      }
    }, 4000);
  };

  const handleCopyCode = () => {
    if (!wonPrize) return;
    navigator.clipboard.writeText(wonPrize.code);
    setCopied(true);
    triggerHaptic('light');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseNow = () => {
    onClose();
    setActiveTab('home');
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="relative bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 border border-purple-500/40 rounded-3xl p-5 sm:p-6 max-w-sm w-full text-white shadow-2xl text-center space-y-4 overflow-hidden">
        
        {/* Ambient Top Light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer z-20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-black border border-amber-400/40 shadow-xs animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>RULETA DE BIENVENIDA VONDRO</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            ¡Girá y Ganá hasta $5.000!
          </h3>
          <p className="text-xs text-purple-200">
            {wonPrize ? '¡Premio desbloqueado y aplicado a tu compra!' : 'Premios exclusivos garantizados para clientes de Córdoba'}
          </p>
        </div>

        {/* Wheel Container */}
        <div className="relative flex items-center justify-center py-2">
          {/* Wheel Pointer */}
          <div className="absolute top-0 z-30 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-amber-400 drop-shadow-[0_4px_8px_rgba(251,191,36,0.5)]" />

          {/* Rotating Wheel */}
          <div
            className="w-60 h-60 rounded-full border-4 border-amber-400 shadow-[0_0_30px_rgba(168,85,247,0.4)] relative overflow-hidden transition-transform duration-[4000ms] ease-out select-none"
            style={{
              transform: `rotate(${rotation}deg)`,
              background: 'conic-gradient(#9333ea 0deg 60deg, #f59e0b 60deg 120deg, #ec4899 120deg 180deg, #10b981 180deg 240deg, #6366f1 240deg 300deg, #ef4444 300deg 360deg)'
            }}
          >
            {PRIZES.map((prize, index) => {
              const angle = (index * 60) + 30;
              return (
                <div
                  key={index}
                  className="absolute w-full h-full flex items-start justify-center pt-3 text-[11px] font-black tracking-tight"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    color: prize.text
                  }}
                >
                  <span className="drop-shadow-md">{prize.label}</span>
                </div>
              );
            })}

            {/* Center Circle Pin */}
            <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 font-black text-lg flex items-center justify-center shadow-xl border-2 border-white">
              🎁
            </div>
          </div>
        </div>

        {/* Prize Notification / Spin Button */}
        {wonPrize ? (
          <div className="bg-white/10 border border-emerald-400/60 rounded-2xl p-4 space-y-3 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-center gap-2 text-emerald-300 font-black text-sm sm:text-base">
              <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
              <span>¡Ganaste: {wonPrize.label}!</span>
            </div>

            <p className="text-[11px] text-purple-200">
              {wonPrize.desc || 'Descuento aplicado automáticamente en tu carrito'}
            </p>

            {/* Code Box */}
            <div className="flex items-center justify-between bg-slate-950/80 rounded-xl px-3.5 py-2.5 border border-purple-400/40">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block text-left">Código activado</span>
                <span className="font-mono text-sm font-black text-amber-300 tracking-wider">
                  {wonPrize.code}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[11px] font-bold px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            {/* Countdown Urgency */}
            <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-amber-300 bg-amber-500/10 py-1 rounded-lg border border-amber-500/20">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Válido por los próximos {formatTimer(timeLeft)}</span>
            </div>

            <button
              type="button"
              onClick={handleUseNow}
              className="w-full bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 hover:from-amber-500 hover:to-purple-700 text-slate-950 font-black text-xs sm:text-sm py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Aprovechar Descuento y Comprar</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={spin}
              disabled={isSpinning}
              className={`w-full py-3.5 rounded-2xl font-black text-sm sm:text-base transition-all shadow-xl cursor-pointer ${
                isSpinning
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 hover:opacity-95 text-slate-950 active:scale-95 shadow-purple-500/30'
              }`}
            >
              {isSpinning ? '¡Girando la ruleta...!' : '🎰 ¡TOCÁ PARA GIRAR AHORA!'}
            </button>
            <p className="text-[10px] text-slate-400">1 tiro gratis por usuario • 100% de premio asegurado</p>
          </div>
        )}
      </div>
    </div>
  );
};
