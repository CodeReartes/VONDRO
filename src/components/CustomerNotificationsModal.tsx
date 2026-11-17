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
  ShoppingBag
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestPushPermission, 
  sendPushNotification 
} from '../utils/pushNotifications';

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
    applyCoupon,
    isAdmin
  } = useStore();

  const [activeSegment, setActiveSegment] = useState<'notifs' | 'benefits' | 'deals'>('notifs');
  const [permissionStatus, setPermissionStatus] = useState(() => getNotificationPermission());
  const [isRequesting, setIsRequesting] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  // Filter notifications relevant to customers
  const customerNotifs = useMemo(() => {
    return notifications.filter(n => {
      const isOffer = n.type === 'FLASH_OFFER' || n.type === 'PRICE_DROP' || n.type === 'CUSTOM_PROMO';
      const isOrder = n.type === 'ORDER_CREATED' || n.type === 'PAYMENT_APPROVED' || 
                      n.type === 'ORDER_SHIPPED' || n.type === 'ORDER_OUT_FOR_DELIVERY' || 
                      n.type === 'ORDER_DELIVERED' || n.type === 'ORDER_ARRIVED_TODAY';

      return isOffer || isOrder || n.targetAudience === 'customer' || n.targetAudience === 'all';
    });
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return customerNotifs.filter(n => !n.read).length;
  }, [customerNotifs]);

  // Featured flash deals from catalog to showcase in the deals tab (2 items max to keep compact)
  const featuredOfferProducts = useMemo(() => {
    return (products || [])
      .filter(p => p.salePrice && p.stock > 0 && !p.hideIfOutOfStock)
      .slice(0, 2);
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

    if (notif.entityType === 'product' && notif.entityId) {
      const prod = products.find(p => p.id === notif.entityId);
      if (prod) {
        openProductDetail(prod);
        onClose();
        return;
      }
    }

    if (notif.entityType === 'order') {
      setActiveTab('orders');
      onClose();
      return;
    }

    if (notif.type === 'FLASH_OFFER' || notif.type === 'PRICE_DROP') {
      setActiveTab('home');
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
    const randomProd = products.find(p => p.salePrice) || products[0];
    const discount = 35;
    sendPushNotification({
      title: `🔥 ¡Oferta Relámpago VONDRO!`,
      body: `¡${discount}% OFF en ${randomProd?.name || 'Mixer Licuadora'}! A solo ARS$${(randomProd?.salePrice ? Math.round(randomProd.salePrice * 0.65) : 32000).toLocaleString('es-AR')}. ¡Quedan pocas unidades!`,
      category: 'offer',
      url: randomProd ? `/?product=${randomProd.id}` : '/',
      image: randomProd?.image || (randomProd?.images && randomProd.images[0]),
      actionText: 'Aprovechar Oferta'
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[10005] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-[420px] rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Compacto Profesional */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#1E0E45] via-[#2D1463] to-[#4C1D95] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-200 shadow-inner shrink-0">
              <Bell className="w-4 h-4 text-purple-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-white tracking-tight truncate">
                  Notificaciones
                </h3>
                {unreadCount > 0 ? (
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-rose-500 text-white shrink-0">
                    {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    Al día
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-purple-200/80 leading-tight truncate">
                Alertas en tiempo real y promociones VONDRO
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/90 hover:text-white transition-colors shrink-0 cursor-pointer ml-2"
            aria-label="Cerrar notificaciones"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra Compacta de Alertas Push (Inline 32px) */}
        {isNotificationSupported() && permissionStatus !== 'granted' ? (
          <div className="px-3.5 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Volume2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-[11px] font-semibold text-purple-950 truncate">
                ¿Avisarte al despachar el pedido?
              </span>
            </div>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isRequesting}
              className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-extrabold text-[10px] rounded-lg shadow-2xs shrink-0 transition-all cursor-pointer whitespace-nowrap"
            >
              {isRequesting ? '...' : 'Activar'}
            </button>
          </div>
        ) : null}

        {/* Pestañas Segmentadas Compactas (Sin scroleo) */}
        <div className="px-3 pt-2.5 pb-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="grid grid-cols-3 gap-1 w-full bg-slate-200/70 p-0.5 rounded-xl text-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveSegment('notifs');
              }}
              className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeSegment === 'notifs'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3 h-3 text-purple-600" />
              <span>Avisos ({customerNotifs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveSegment('benefits');
              }}
              className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeSegment === 'benefits'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gift className="w-3 h-3 text-pink-600" />
              <span>Beneficios</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveSegment('deals');
              }}
              className={`py-1.5 text-[11px] font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeSegment === 'deals'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3 h-3 text-orange-500" />
              <span>Ofertas</span>
            </button>
          </div>
        </div>

        {/* Contenedor Fijo sin Scroleo (Todo cabe perfecto en pantalla) */}
        <div className="p-3.5 flex flex-col justify-center min-h-[220px]">
          {/* TAB 1: AVISOS Y PEDIDOS */}
          {activeSegment === 'notifs' && (
            <div className="space-y-2.5">
              {customerNotifs.length > 0 ? (
                <>
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Recientes
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          markAllNotificationsRead();
                        }}
                        className="text-[10px] font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
                      >
                        Marcar todas leídas
                      </button>
                    )}
                  </div>

                  {customerNotifs.slice(0, 2).map((notif) => {
                    const isOffer = notif.type === 'FLASH_OFFER' || notif.type === 'PRICE_DROP';
                    const isShipping = notif.type === 'ORDER_SHIPPED' || notif.type === 'ORDER_OUT_FOR_DELIVERY';

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          notif.read 
                            ? 'bg-slate-50/80 border-slate-200 hover:border-purple-300' 
                            : 'bg-purple-50/70 border-purple-300 shadow-2xs'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs text-white ${
                          isOffer 
                            ? 'bg-gradient-to-tr from-orange-500 to-amber-500' 
                            : isShipping 
                            ? 'bg-gradient-to-tr from-blue-600 to-cyan-500' 
                            : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                        }`}>
                          {isOffer ? <Flame className="w-4 h-4" /> : isShipping ? <Truck className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-[11.5px] font-extrabold text-slate-900 truncate">
                              {notif.title}
                            </h4>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-purple-600 ring-2 ring-purple-100 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-200/60">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-purple-700 font-bold flex items-center">
                              Ver <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-4 px-2 space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">¡Todo al día!</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 max-w-[260px] mx-auto leading-tight">
                      Acá verás avisos cuando tus paquetes salgan a reparto o haya novedades de tu compra.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setActiveTab('orders');
                      onClose();
                    }}
                    className="mt-1 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-xl active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Ver mis compras</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BENEFICIOS Y CUPONES */}
          {activeSegment === 'benefits' && (
            <div className="space-y-2.5">
              {/* Cupón $2.000 OFF */}
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50/50 to-indigo-50 border border-purple-200 flex items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] font-black text-slate-900 truncate">Cupón $2.000 OFF</span>
                      <span className="text-[9px] font-extrabold bg-purple-200 text-purple-900 px-1 py-0.2 rounded-sm">VONDRO</span>
                    </div>
                    <p className="text-[10.5px] text-slate-600 mt-0.5 truncate">
                      Código: <strong className="text-purple-700 font-extrabold">AMIGO2000</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyCoupon('AMIGO2000')}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-[10.5px] font-black shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copiedCoupon === 'AMIGO2000' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      ¡Aplicado!
                    </>
                  ) : (
                    'Copiar'
                  )}
                </button>
              </div>

              {/* Envío Gratis */}
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-blue-50 to-cyan-50/60 border border-blue-200 flex items-center justify-between gap-2.5 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-black text-slate-900 block truncate">Envío Gratis Córdoba</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5 truncate">
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
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[10.5px] font-black shrink-0 transition-all cursor-pointer"
                >
                  Ver catálogo
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: OFERTAS FLASH COMPACTAS */}
          {activeSegment === 'deals' && (
            <div className="space-y-2">
              {featuredOfferProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    triggerHaptic('light');
                    openProductDetail(p);
                    onClose();
                  }}
                  className="p-2 rounded-2xl bg-slate-50/90 border border-slate-200 hover:border-orange-400 flex items-center gap-2.5 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-white overflow-hidden shrink-0 flex items-center justify-center border border-slate-200/80">
                    <img 
                      src={p.image || (p.images && p.images[0])} 
                      alt={p.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h6 className="text-[11.5px] font-bold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
                      {p.name}
                    </h6>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-black text-orange-600">
                        ${p.salePrice.toLocaleString('es-AR')}
                      </span>
                      {p.originalPrice && p.originalPrice > p.salePrice && (
                        <span className="text-[10px] text-slate-400 line-through">
                          ${p.originalPrice.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-orange-500 text-white font-extrabold text-[10px] group-hover:bg-orange-600 transition-colors shrink-0 flex items-center gap-0.5">
                    Ver <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('home');
                  onClose();
                }}
                className="w-full py-1.5 text-center text-[11px] font-extrabold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
              >
                Ver todas las ofertas relámpago →
              </button>
            </div>
          )}
        </div>

        {/* Footer Ultra Compacto */}
        <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Notificaciones verificadas VONDRO</span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={handleTestNotification}
              className="text-[10px] font-extrabold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
              title="Prueba de notificación"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              Probar push
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
