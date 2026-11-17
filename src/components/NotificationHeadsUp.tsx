import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Truck, 
  Flame, 
  CheckCircle2, 
  ChevronRight,
  PackageCheck
} from 'lucide-react';
import { PushNotificationPayload } from '../utils/pushNotifications';
import { triggerHaptic } from '../utils/native';
import { useStore } from '../context/StoreContext';

export const NotificationHeadsUp: React.FC = () => {
  const { products, openProductDetail, setActiveTab } = useStore();
  const [currentNotif, setCurrentNotif] = useState<PushNotificationPayload | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handlePushEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PushNotificationPayload>;
      if (customEvent.detail) {
        setCurrentNotif(customEvent.detail);
        setIsVisible(true);
        triggerHaptic('success');
      }
    };

    window.addEventListener('vondro-push-received', handlePushEvent);
    return () => {
      window.removeEventListener('vondro-push-received', handlePushEvent);
    };
  }, []);

  // Auto-dismiss after 6.5 seconds
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 6500);
    return () => clearTimeout(timer);
  }, [isVisible, currentNotif]);

  if (!isVisible || !currentNotif) return null;

  const handleActionClick = () => {
    triggerHaptic('medium');
    setIsVisible(false);

    if (currentNotif.url) {
      try {
        const urlObj = new URL(currentNotif.url, window.location.origin);
        const prodId = urlObj.searchParams.get('product') || urlObj.searchParams.get('p');
        if (prodId) {
          const matched = products.find(p => p.id === prodId);
          if (matched) {
            openProductDetail(matched);
            return;
          }
        }
      } catch {
        // fallback
      }
    }

    if (currentNotif.category === 'order' || currentNotif.category === 'shipping') {
      setActiveTab('orders');
    } else if (currentNotif.category === 'offer') {
      setActiveTab('home');
    }
  };

  const getCategoryBadge = () => {
    switch (currentNotif.category) {
      case 'offer':
        return {
          icon: <Flame className="w-3 h-3 text-orange-500" />,
          label: 'OFERTA FLASH',
          bg: 'bg-orange-50 text-orange-700 border-orange-200'
        };
      case 'shipping':
        return {
          icon: <Truck className="w-3 h-3 text-blue-600" />,
          label: 'EN REPARTO HOY',
          bg: 'bg-blue-50 text-blue-700 border-blue-200'
        };
      case 'order':
        return {
          icon: <PackageCheck className="w-3 h-3 text-emerald-600" />,
          label: 'ESTADO DE PEDIDO',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      default:
        return {
          icon: <Bell className="w-3 h-3 text-purple-600" />,
          label: 'VONDRO CÓRDOBA',
          bg: 'bg-purple-50 text-purple-700 border-purple-200'
        };
    }
  };

  const badge = getCategoryBadge();

  return (
    <div className="fixed top-2 sm:top-3 left-2.5 right-2.5 sm:left-auto sm:right-4 z-[99999] sm:w-[380px] animate-in slide-in-from-top-4 duration-300">
      <div 
        onClick={handleActionClick}
        className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-slate-700/80 cursor-pointer hover:bg-slate-900 transition-all flex items-start gap-2.5 relative group"
      >
        {/* App Mini Logo */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
          <span className="font-black text-white text-xs">V</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border flex items-center gap-1 ${badge.bg}`}>
              {badge.icon}
              {badge.label}
            </span>
            <span className="text-[10px] text-slate-400">ahora</span>
          </div>

          <h4 className="text-xs font-bold text-white line-clamp-1">
            {currentNotif.title}
          </h4>
          <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight mt-0.5">
            {currentNotif.body}
          </p>

          {/* Quick CTA */}
          <div className="mt-1.5 flex items-center gap-1 text-[10px] font-extrabold text-purple-300 group-hover:text-purple-200">
            <span>{currentNotif.actionText || 'Tocar para ver'}</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Optional Image thumbnail */}
        {currentNotif.image && (
          <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
            <img src={currentNotif.image} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
          }}
          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          aria-label="Cerrar notificación"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
