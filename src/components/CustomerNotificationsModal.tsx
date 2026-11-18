import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, 
  X, 
  Flame, 
  Truck, 
  Sparkles, 
  PackageCheck,
  ChevronRight,
  ShieldCheck,
  Tag,
  Gift,
  Clock,
  Check,
  Volume2,
  ShoppingBag,
  CheckCircle2,
  ChevronUp
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestPushPermission, 
  sendPushNotification,
  VONDRO_NOTIFICATION_LOGO
} from '../utils/pushNotifications';
import { getDailyFeaturedDeals, getProductOfferDetails } from '../utils/dailyOffersNotifications';
import { VondroLogo } from './VondroLogo';

interface CustomerNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerNotificationsModal: React.FC<CustomerNotificationsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead, 
    products, 
    openProductDetail, 
    setActiveTab,
    setSearchOnlyOffers,
    setSearchQuery,
    applyCoupon,
    isAdmin
  } = useStore();

  const [activeSegment, setActiveSegment] = useState<'notifs' | 'deals' | 'benefits'>('notifs');
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<'all' | 'orders' | 'offers'>('all');
  const [permissionStatus, setPermissionStatus] = useState(() => getNotificationPermission());
  const [isRequesting, setIsRequesting] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  // All customer-facing notifications (sorted newest first, zero truncation)
  const customerNotifs = useMemo(() => {
    return (notifications || [])
      .filter(n => {
        const isOffer = n.type === 'FLASH_OFFER' || n.type === 'PRICE_DROP' || n.type === 'CUSTOM_PROMO';
        const isOrder = n.type === 'ORDER_CREATED' || n.type === 'PAYMENT_APPROVED' || 
                        n.type === 'ORDER_PREPARING_PENDING' ||
                        n.type === 'ORDER_SHIPPED' || n.type === 'ORDER_OUT_FOR_DELIVERY' || 
                        n.type === 'ORDER_DELIVERED' || n.type === 'ORDER_ARRIVED_TODAY';

        return isOffer || isOrder || n.targetAudience === 'customer' || n.targetAudience === 'all';
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications]);

  const filteredNotifs = useMemo(() => {
    if (notifCategoryFilter === 'all') return customerNotifs;
    if (notifCategoryFilter === 'orders') {
      return customerNotifs.filter(n => n.entityType === 'order' || n.type.includes('ORDER') || n.type.includes('PAYMENT'));
    }
    return customerNotifs.filter(n => n.type === 'FLASH_OFFER' || n.type === 'PRICE_DROP' || n.type === 'CUSTOM_PROMO' || n.entityType === 'product');
  }, [customerNotifs, notifCategoryFilter]);

  const unreadCount = useMemo(() => {
    return customerNotifs.filter(n => !n.read).length;
  }, [customerNotifs]);

  // Curated daily promos, liquidations & new arrivals (scrollable list up to 12 items)
  const featuredOfferProducts = useMemo(() => {
    return getDailyFeaturedDeals(products || [], 12);
  }, [products]);

  const handleEnablePush = async () => {
    setIsRequesting(true);
    triggerHaptic('selection');
    const res = await requestPushPermission();
    setPermissionStatus(res);
    setIsRequesting(false);
  };

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    triggerHaptic('light');
    if (!notif.read) {
      markNotificationRead(notif.id);
    }

    if (notif.linkUrl && notif.linkUrl.includes('filter=offers')) {
      setSearchQuery('');
      setSearchOnlyOffers(true);
      setActiveTab('search');
      onClose();
      return;
    }

    if (notif.entityType === 'product' && notif.entityId) {
      const prod = products.find(p => p.id === notif.entityId);
      if (prod) {
        openProductDetail(prod);
        onClose();
        return;
      }
    }

    if (notif.entityType === 'order' || notif.type.includes('ORDER') || notif.type.includes('PAYMENT')) {
      setActiveTab('orders');
      onClose();
      return;
    }

    if (notif.type === 'FLASH_OFFER' || notif.type === 'PRICE_DROP' || notif.type === 'CUSTOM_PROMO') {
      setSearchQuery('');
      setSearchOnlyOffers(true);
      setActiveTab('search');
      onClose();
    }
  };

  const handleCopyCoupon = (code: string) => {
    triggerHaptic('selection');
    navigator.clipboard?.writeText(code);
    applyCoupon(code);
    setCopiedCoupon(code);
    setTimeout(() => setCopiedCoupon(null), 3000);
  };

  const handleTestNotification = () => {
    const dealList = getDailyFeaturedDeals(products || [], 5);
    const sampleProd = dealList[0] || products[0];
    const info = sampleProd ? getProductOfferDetails(sampleProd) : null;
    const discount = info && info.pct >= 10 ? info.pct : 35;
    const thumb = sampleProd?.image || (sampleProd?.images && sampleProd.images[0]);

    sendPushNotification({
      title: `🔥 ¡Oferta del día VONDRO! -${discount}% OFF`,
      body: `${sampleProd?.name || 'Oferta destacada'} hoy a $${(sampleProd?.salePrice || 32000).toLocaleString('es-AR')}. ¡Stock limitado!`,
      category: 'offer',
      url: sampleProd ? `/?product=${sampleProd.id}` : '/?tab=search&filter=offers',
      icon: VONDRO_NOTIFICATION_LOGO,
      image: thumb,
      actionText: 'Aprovechar Oferta'
    });
  };

  const formatNotifTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      if (sameDay) return `Hoy · ${timeStr}`;
      return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} · ${timeStr}`;
    } catch {
      return '';
    }
  };

  const getNotifVisualMeta = (notif: typeof notifications[0]) => {
    if (notif.type === 'ORDER_SHIPPED' || notif.type === 'ORDER_OUT_FOR_DELIVERY' || notif.type === 'ORDER_ARRIVED_TODAY') {
      return {
        categoryLabel: 'En camino',
        iconBg: 'bg-blue-600',
        icon: <Truck className="w-4 h-4 text-white" />,
        actionLabel: 'Rastrear pedido'
      };
    }
    if (notif.type === 'ORDER_DELIVERED') {
      return {
        categoryLabel: 'Entregado',
        iconBg: 'bg-teal-600',
        icon: <PackageCheck className="w-4 h-4 text-white" />,
        actionLabel: 'Ver compra'
      };
    }
    if (notif.type === 'ORDER_CREATED' || notif.type === 'PAYMENT_APPROVED' || notif.type === 'ORDER_PREPARING_PENDING') {
      return {
        categoryLabel: notif.type === 'PAYMENT_APPROVED' ? 'Pago acreditado' : notif.type === 'ORDER_PREPARING_PENDING' ? 'En preparación' : 'Compra realizada',
        iconBg: 'bg-emerald-600',
        icon: <ShoppingBag className="w-4 h-4 text-white" />,
        actionLabel: 'Ver pedido'
      };
    }
    if (notif.type === 'PRICE_DROP') {
      return {
        categoryLabel: 'Promo y Liquidación',
        iconBg: 'bg-amber-600',
        icon: <Tag className="w-4 h-4 text-white" />,
        actionLabel: notif.actionText || 'Ver liquidación'
      };
    }
    return {
      categoryLabel: 'Oferta del día',
      iconBg: 'bg-orange-600',
      icon: <Flame className="w-4 h-4 text-white" />,
      actionLabel: notif.actionText || 'Ver oferta'
    };
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[10005] bg-slate-950/60 backdrop-blur-[2px] flex items-start justify-center sm:pt-14 sm:px-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top-Anchored Slide-Down Panel */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Centro de Notificaciones VONDRO"
        className="bg-white w-full sm:max-w-[460px] rounded-b-3xl sm:rounded-3xl shadow-2xl border-b sm:border border-slate-200/90 flex flex-col overflow-hidden max-h-[86vh] animate-in slide-in-from-top-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Branded Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#1E0E45] via-[#2D1463] to-[#4C1D95] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img 
                src={VONDRO_NOTIFICATION_LOGO} 
                alt="VONDRO" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white tracking-tight truncate">
                Notificaciones VONDRO
              </h3>
              <p className="text-[11px] text-purple-200/90 leading-tight truncate tabular-nums">
                {unreadCount > 0 
                  ? `${unreadCount} sin leer · Pedidos, envíos y ofertas`
                  : 'Todo al día · Pedidos, envíos y ofertas diarias'}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="min-w-[44px] min-h-[44px] -mr-2 rounded-full hover:bg-white/15 active:scale-95 flex items-center justify-center text-white/90 hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Cerrar notificaciones"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optional Push Activation Strip */}
        {isNotificationSupported() && permissionStatus !== 'granted' && (
          <div className="px-4 py-2.5 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Volume2 className="w-4 h-4 text-purple-700 shrink-0" />
              <span className="text-[11.5px] font-semibold text-purple-950 leading-tight">
                Activá avisos para pedidos en camino y ofertas del día
              </span>
            </div>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isRequesting}
              className="px-3.5 py-2 min-h-[36px] bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-extrabold text-[11px] rounded-xl shadow-2xs shrink-0 transition-all cursor-pointer whitespace-nowrap"
            >
              {isRequesting ? '...' : 'Activar'}
            </button>
          </div>
        )}

        {/* Primary Segmented Control */}
        <div className="px-3.5 pt-2.5 pb-2 bg-slate-50 border-b border-slate-100 shrink-0 space-y-2">
          <div className="grid grid-cols-3 gap-1 w-full bg-slate-200/75 p-1 rounded-xl text-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveSegment('notifs');
              }}
              className={`py-2 min-h-[38px] text-[11.5px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap tabular-nums ${
                activeSegment === 'notifs'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Avisos ({customerNotifs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveSegment('deals');
              }}
              className={`py-2 min-h-[38px] text-[11.5px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap tabular-nums ${
                activeSegment === 'deals'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>Ofertas ({featuredOfferProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveSegment('benefits');
              }}
              className={`py-2 min-h-[38px] text-[11.5px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                activeSegment === 'benefits'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gift className="w-3.5 h-3.5 text-pink-600 shrink-0" />
              <span>Beneficios</span>
            </button>
          </div>

          {/* Sub-filter controls inside Avisos */}
          {activeSegment === 'notifs' && customerNotifs.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'orders', label: 'Compras y envíos' },
                  { id: 'offers', label: 'Promos' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setNotifCategoryFilter(tab.id as any);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      notifCategoryFilter === tab.id
                        ? 'bg-purple-700 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    markAllNotificationsRead();
                  }}
                  className="text-[11px] font-extrabold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Marcar leídas</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Content Area (Shows ALL notifications cleanly) */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-2.5 min-h-[220px]">
          {/* TAB 1: ALL NOTIFICATIONS */}
          {activeSegment === 'notifs' && (
            <>
              {filteredNotifs.length > 0 ? (
                <div className="space-y-2">
                  {filteredNotifs.map((notif) => {
                    const meta = getNotifVisualMeta(notif);

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                          notif.read 
                            ? 'bg-slate-50/80 border-slate-200 hover:border-purple-300' 
                            : 'bg-purple-50/70 border-purple-300 shadow-2xs'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${meta.iconBg}`}>
                          {meta.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-500">
                            <span className="font-bold text-slate-700 truncate">
                              {meta.categoryLabel}
                              {!notif.read && (
                                <span className="text-purple-700 font-extrabold"> · Nueva</span>
                              )}
                            </span>
                            <span className="flex items-center gap-1 shrink-0 tabular-nums">
                              <Clock className="w-3 h-3" />
                              {formatNotifTimestamp(notif.createdAt)}
                            </span>
                          </div>

                          <h4 className="text-xs font-extrabold text-slate-900 mt-0.5 leading-snug">
                            {notif.title}
                          </h4>
                          <p className="text-[11.5px] text-slate-600 line-clamp-3 mt-0.5 leading-snug">
                            {notif.message}
                          </p>

                          <div className="flex items-center justify-end mt-1.5">
                            <span className="text-[11px] text-purple-700 font-extrabold inline-flex items-center gap-0.5">
                              {meta.actionLabel} <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>

                        {notif.imageUrl && notif.imageUrl !== VONDRO_NOTIFICATION_LOGO && (
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 self-center">
                            <img 
                              src={notif.imageUrl} 
                              alt="" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 px-3 space-y-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      {notifCategoryFilter === 'orders'
                        ? 'Sin novedades de pedidos todavía'
                        : '¡Todo al día!'}
                    </h4>
                    <p className="text-[11.5px] text-slate-500 mt-1 max-w-[280px] mx-auto leading-snug">
                      Acá vas a ver confirmación de compras hechas, cuando tu pedido salga en camino, nuevos ingresos en liquidación y las ofertas diarias.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setActiveTab('orders');
                        onClose();
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-xl active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>Ver mis compras</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setActiveSegment('deals');
                      }}
                      className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold rounded-xl active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Ofertas de hoy</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: DAILY OFFERS & LIQUIDATIONS */}
          {activeSegment === 'deals' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 pb-0.5">
                <span className="font-bold text-slate-700">Selección diaria y liquidaciones</span>
                <span className="tabular-nums">{featuredOfferProducts.length} activas hoy</span>
              </div>

              {featuredOfferProducts.map((p) => {
                const info = getProductOfferDetails(p);
                const thumb = p.image || (p.images && p.images[0]);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      triggerHaptic('light');
                      openProductDetail(p);
                      onClose();
                    }}
                    className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-200 hover:border-orange-400 flex items-center gap-2.5 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white overflow-hidden shrink-0 flex items-center justify-center border border-slate-200/80">
                      {thumb ? (
                        <img 
                          src={thumb} 
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        {info.pct >= 10 && (
                          <span className="text-orange-600 font-extrabold tabular-nums">-{info.pct}% OFF</span>
                        )}
                        {info.isLiquidation && (
                          <span>{info.pct >= 10 ? '· ' : ''}Liquidación</span>
                        )}
                        {!info.isLiquidation && info.isNewArrival && (
                          <span>{info.pct >= 10 ? '· ' : ''}Nuevo ingreso</span>
                        )}
                      </div>
                      <h6 className="text-xs font-bold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                        {p.name}
                      </h6>
                      <div className="flex items-center gap-1.5 mt-0.5 tabular-nums">
                        <span className="text-xs font-black text-orange-600">
                          ${p.salePrice.toLocaleString('es-AR')}
                        </span>
                        {info.origPrice > p.salePrice && (
                          <span className="text-[10.5px] text-slate-400 line-through">
                            ${info.origPrice.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="px-2.5 py-1.5 rounded-xl bg-orange-500 text-white font-extrabold text-[10.5px] group-hover:bg-orange-600 transition-colors shrink-0 flex items-center gap-0.5">
                      Ver <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSearchQuery('');
                  setSearchOnlyOffers(true);
                  setActiveTab('search');
                  onClose();
                }}
                className="w-full py-2.5 mt-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-center text-xs font-extrabold text-purple-800 transition-colors cursor-pointer"
              >
                Explorar todas las ofertas y liquidaciones →
              </button>
            </div>
          )}

          {/* TAB 3: BENEFITS & COUPONS */}
          {activeSegment === 'benefits' && (
            <div className="space-y-2.5">
              {/* Cupón $2.000 OFF */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50/50 to-indigo-50 border border-purple-200 flex items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">Cupón $2.000 OFF · VONDRO</span>
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                      Código: <strong className="text-purple-700 font-extrabold">AMIGO2000</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyCoupon('AMIGO2000')}
                  className="px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-[11px] font-black shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copiedCoupon === 'AMIGO2000' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      ¡Aplicado!
                    </>
                  ) : (
                    'Copiar'
                  )}
                </button>
              </div>

              {/* Envío Gratis */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50/60 border border-blue-200 flex items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-900 block truncate">Envío Gratis Córdoba</span>
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                      En todas tus compras desde $100.000
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('home');
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] font-black shrink-0 transition-all cursor-pointer"
                >
                  Ver catálogo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Pull-up Handle */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium min-w-0">
            <VondroLogo variant="icon" size="sm" />
            <span className="truncate">Avisos oficiales VONDRO</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={handleTestNotification}
                className="text-[11px] font-extrabold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                title="Prueba de notificación push"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Probar push
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer"
            >
              <span>Subir</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
