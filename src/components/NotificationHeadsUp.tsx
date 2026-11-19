import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Truck, 
  Flame, 
  ChevronRight,
  PackageCheck
} from 'lucide-react';
import { PushNotificationPayload, VONDRO_NOTIFICATION_LOGO } from '../utils/pushNotifications';
import { triggerHaptic } from '../utils/native';
import { useStore } from '../context/StoreContext';
import { VondroLogo } from './VondroLogo';

export const NotificationHeadsUp: React.FC = () => {
  const { products, openProductDetail, setActiveTab, setSearchOnlyOffers, setSearchQuery } = useStore();
  const [currentNotif, setCurrentNotif] = useState<PushNotificationPayload | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [logoImgFailed, setLogoImgFailed] = useState(false);

  useEffect(() => {
    const handlePushEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PushNotificationPayload>;
      if (customEvent.detail) {
        setLogoImgFailed(false);
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
        const tabParam = urlObj.searchParams.get('tab');
        const filterParam = urlObj.searchParams.get('filter');
        if (tabParam === 'search' || filterParam === 'offers') {
          setSearchQuery('');
          setSearchOnlyOffers(true);
          setActiveTab('search');
          return;
        }
      } catch {
        // fallback below
      }
    }

    if (currentNotif.category === 'order' || currentNotif.category === 'shipping') {
      setActiveTab('orders');
    } else if (currentNotif.category === 'offer') {
      setSearchQuery('');
      setSearchOnlyOffers(true);
      setActiveTab('search');
    }
  };

  const getCategoryMeta = () => {
    switch (currentNotif.category) {
      case 'offer':
        return {
          icon: <Flame className="w-3 h-3 text-orange-400 shrink-0" />,
          label: 'Oferta del día'
        };
      case 'shipping':
        return {
          icon: <Truck className="w-3 h-3 text-sky-400 shrink-0" />,
          label: 'Envío en camino'
        };
      case 'order':
        return {
          icon: <PackageCheck className="w-3 h-3 text-emerald-400 shrink-0" />,
          label: 'Compra y pedido'
        };
      default:
        return {
          icon: <Bell className="w-3 h-3 text-purple-300 shrink-0" />,
          label: 'Notificación'
        };
    }
  };

  const meta = getCategoryMeta();

  return (
    <div className="fixed top-2 sm:top-3 left-2.5 right-2.5 sm:left-auto sm:right-4 z-[99999] sm:w-[390px] animate-in slide-in-from-top-4 duration-200">
      <div 
        onClick={handleActionClick}
        className="bg-slate-950/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-purple-500/35 cursor-pointer hover:bg-slate-900 transition-all flex items-start gap-3 relative group"
      >
        {/* Official VONDRO Bag Logo Only (no text) */}
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-md overflow-hidden border border-white/80 p-0.5">
          {!logoImgFailed ? (
            <img
              src={currentNotif.icon || VONDRO_NOTIFICATION_LOGO}
              alt="Logo"
              className="w-full h-full object-contain"
              onError={() => setLogoImgFailed(true)}
            />
          ) : (
            <VondroLogo variant="icon" size="sm" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-300 mb-0.5">
            <span className="inline-flex items-center gap-1 font-semibold text-purple-200 truncate">
              {meta.icon}
              <span>{meta.label}</span>
            </span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-slate-400 shrink-0">ahora</span>
          </div>

          <h4 className="text-xs font-extrabold text-white line-clamp-1 leading-snug">
            {currentNotif.title}
          </h4>
          <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug mt-0.5">
            {currentNotif.body}
          </p>

          {/* Quick CTA */}
          <div className="mt-1.5 flex items-center gap-1 text-[10.5px] font-bold text-purple-300 group-hover:text-purple-200">
            <span>{currentNotif.actionText || 'Tocar para ver'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Optional Product Image thumbnail */}
        {currentNotif.image && currentNotif.image !== VONDRO_NOTIFICATION_LOGO && (
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 self-center">
            <img src={currentNotif.image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
          }}
          className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Cerrar notificación"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
