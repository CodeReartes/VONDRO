import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '../utils/native';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Don't show immediately if dismissed previously in current session
      const dismissed = sessionStorage.getItem('vondro_pwa_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    triggerHaptic('medium');
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    triggerHaptic('light');
    setShowBanner(false);
    sessionStorage.setItem('vondro_pwa_dismissed', 'true');
  };

  if (isInstalled || !showBanner) return null;

  return (
    <div className="fixed bottom-18 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-40 bg-purple-900 text-white rounded-2xl p-3.5 shadow-xl border border-purple-700/60 flex items-center justify-between gap-3 animate-slideUp">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-purple-700 flex items-center justify-center shrink-0 border border-purple-500/40">
          <Smartphone className="w-5 h-5 text-purple-200" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-black truncate flex items-center gap-1 text-purple-100">
            <span>Instalar VONDRO App</span>
            <Sparkles className="w-3 h-3 text-amber-300" />
          </h4>
          <p className="text-[11px] text-purple-200 line-clamp-1">
            Acceso rápido, notificaciones y ofertas exclusivas
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3 py-1.5 bg-white hover:bg-purple-50 active:scale-95 text-purple-950 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-purple-300 hover:text-white rounded-lg transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
