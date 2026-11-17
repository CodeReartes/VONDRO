import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Package, 
  ChevronRight, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  ShoppingBag,
  FileText,
  Check,
  Timer,
  RotateCcw,
  Sparkles,
  Trash2
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus, Product } from '../types';
import { decodeHtmlEntities, getCategoryFallback, getOptimizedThumbnail } from '../utils/imageOptimizer';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';
import { checkIsAdminEmail } from '../lib/authService';

export const getStatusBadge = (status: OrderStatus, order?: Order) => {
  const isCancelledStatus = status === 'cancelled' || status === 'CANCELADO';

  if (!isCancelledStatus && order?.paymentMethod === 'bank_transfer' && order?.paymentStatus === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300 shadow-xs whitespace-nowrap shrink-0">
        <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
        <span>Comprobante rechazado</span>
      </span>
    );
  }

  if (!isCancelledStatus && order?.paymentMethod === 'bank_transfer' && (order?.paymentStatus === 'pending' || (order as any).paymentStatus === 'pending_verification')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-xs whitespace-nowrap shrink-0">
        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
        <span>Comprobante en revisión</span>
      </span>
    );
  }

  switch (status) {
    case 'pending_payment':
    case 'PENDIENTE_PAGO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 shadow-xs whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3 text-purple-600 shrink-0" />
          <span>Pendiente de pago</span>
        </span>
      );
    case 'payment_received':
    case 'PAGO_APROBADO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 shadow-xs whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3 text-sky-600 shrink-0" />
          <span>Pago aprobado</span>
        </span>
      );
    case 'checking_stock':
    case 'VERIFICANDO_STOCK':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-xs whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Verificando stock</span>
        </span>
      );
    case 'stock_confirmed':
    case 'STOCK_CONFIRMADO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60 shadow-xs whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3 text-teal-600 shrink-0" />
          <span>Stock confirmado</span>
        </span>
      );
    case 'preparing':
    case 'PREPARANDO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200/60 shadow-xs whitespace-nowrap shrink-0">
          <Package className="w-3 h-3 text-orange-600 shrink-0" />
          <span>Preparando</span>
        </span>
      );
    case 'ready_to_ship':
    case 'LISTO_PARA_ENVIAR':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs whitespace-nowrap shrink-0">
          <Package className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>Listo p/ enviar</span>
        </span>
      );
    case 'shipped':
    case 'ENVIADO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 shadow-xs whitespace-nowrap shrink-0">
          <Truck className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Enviado</span>
        </span>
      );
    case 'out_for_delivery':
    case 'EN_CAMINO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs whitespace-nowrap shrink-0">
          <Truck className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>En camino</span>
        </span>
      );
    case 'delivered':
    case 'ENTREGADO':
    case 'completed':
    case 'FINALIZADO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Entregado</span>
        </span>
      );
    case 'cancelled':
    case 'CANCELADO':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 shadow-xs whitespace-nowrap shrink-0">
          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Cancelado</span>
        </span>
      );
    case 'STOCK_ISSUE':
    case 'PROBLEMA_DE_STOCK':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-xs whitespace-nowrap shrink-0">
          <AlertCircle className="w-3 h-3 text-amber-700 shrink-0" />
          <span>Problema de stock</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200/60 shadow-xs whitespace-nowrap shrink-0">
          <span>{status}</span>
        </span>
      );
  }
};

// Helper to determine status step index for 4-step flyer progress
export const getOrderStatusStep = (status: OrderStatus, order?: Order): number => {
  // If payment is pending confirmation or receipt in review, ALWAYS stay at step 0!
  if (order) {
    const isPaymentPending = order.paymentStatus === 'pending' || 
      (order as any).paymentStatus === 'pending_verification' || 
      (order.paymentMethod === 'bank_transfer' && order.paymentStatus !== 'approved');
    if (isPaymentPending) {
      return 0;
    }
  }

  const s = String(status || '').toLowerCase().trim();
  switch (s) {
    case 'pending_payment':
    case 'pendiente_pago':
      return 0;
    case 'payment_received':
    case 'pago_aprobado':
    case 'checking_stock':
    case 'verificando_stock':
    case 'stock_confirmed':
    case 'stock_confirmado':
    case 'preparing':
    case 'preparando':
    case 'ready_to_ship':
    case 'listo_para_enviar':
      return 1;
    case 'shipped':
    case 'enviado':
    case 'out_for_delivery':
    case 'en_camino':
      return 2;
    case 'delivered':
    case 'entregado':
    case 'completed':
    case 'finalizado':
      return 3;
    default:
      return 0;
  }
};

// 4-Step Stepper Component matching the flyer (compact)
export const OrderProgressBar: React.FC<{ status: OrderStatus; createdAt: string; order?: Order }> = ({ 
  status, 
  createdAt,
  order 
}) => {
  const currentStep = getOrderStatusStep(status, order);
  const isCancelled = status === 'cancelled' || status === 'CANCELADO' || (order && ((order.status as any) === 'cancelled' || (order.status as any) === 'CANCELADO'));

  if (isCancelled) return null;

  const dateObj = new Date(createdAt);
  const dayMonth = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
  
  // Cutoff calculation: before 12:00 hs vs after 12:00 hs
  const purchaseHour = dateObj.getHours();
  const isAfterMidday = purchaseHour >= 12;

  const isPendingVerification = order && (
    order.paymentStatus === 'pending' || 
    (order as any).paymentStatus === 'pending_verification' || 
    (order.paymentMethod === 'bank_transfer' && order.paymentStatus !== 'approved')
  );

  const steps = [
    { 
      label: 'Pedido recibido', 
      date: isPendingVerification ? 'En espera de confirmación' : dayMonth 
    },
    { 
      label: 'Preparando', 
      date: currentStep >= 1 ? (isAfterMidday ? 'Próx. día' : dayMonth) : '' 
    },
    { label: 'En camino', date: currentStep >= 2 ? 'En ruta' : '' },
    { label: 'Entregado', date: currentStep >= 3 ? 'Recibido' : '' },
  ];

  return (
    <div className="w-full pt-1 pb-0.5 space-y-1.5">
      <div className="relative flex items-center justify-between">
        {/* Background Connecting Line */}
        <div className="absolute left-3 right-3 top-2 h-[2px] bg-slate-100 -z-0" />
        
        {/* Active Progress Line */}
        <div 
          className="absolute left-3 top-2 h-[2px] bg-[#7C3AED] transition-all duration-500 -z-0"
          style={{ 
            width: currentStep === 0 ? '0%' : currentStep === 1 ? '33.3%' : currentStep === 2 ? '66.6%' : 'calc(100% - 24px)' 
          }}
        />

        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div key={idx} className="flex flex-col items-center relative z-10">
              {/* Step Circle Icon */}
              <div 
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-[#7C3AED] text-white'
                    : isCurrent
                    ? 'bg-[#7C3AED] text-white ring-3 ring-purple-100 shadow-xs'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                ) : isCurrent ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                )}
              </div>

              {/* Step Label */}
              <span className={`text-[9px] mt-1 font-medium text-center whitespace-nowrap ${
                isCurrent 
                  ? 'text-[#7C3AED] font-bold' 
                  : isCompleted 
                  ? 'text-slate-700 font-semibold' 
                  : 'text-slate-400'
              }`}>
                {step.label}
              </span>

              {/* Step Date if present */}
              {step.date && (
                <span className={`text-[7.5px] leading-none mt-0.5 max-w-[85px] text-center ${
                  isCurrent ? 'text-purple-600 font-semibold' : 'text-slate-400'
                }`}>
                  {step.date}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Midday schedule info callout banner */}
      {isAfterMidday && currentStep <= 1 && !isCancelled && (
        <div className="bg-purple-50/70 border border-purple-200/60 rounded-lg px-2 py-1 text-[9.5px] text-purple-900 flex items-center justify-center gap-1 font-medium">
          <Clock className="w-2.5 h-2.5 text-purple-600 shrink-0" />
          <span>Compra después de las 12:00 hs · Preparación programada para el día siguiente</span>
        </div>
      )}
    </div>
  );
};

export const OrdersView: React.FC = () => {
  const { user, orders, openOrderDetail, setActiveTab, products, addToCart, deleteOrder, deletedOrderIds } = useStore();
  const [activeFilter, setActiveFilter] = useState<'all' | 'in_progress' | 'delivered' | 'cancelled'>('all');
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);

  const handleDeleteOrder = (orderId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    triggerHaptic('medium');
    setOrderToDeleteId(orderId);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDeleteId) return;
    triggerHaptic('success');
    const idToDelete = orderToDeleteId;
    setOrderToDeleteId(null);
    await deleteOrder(idToDelete);
    setReorderSuccessMsg('Pedido cancelado eliminado de tu historial');
    setTimeout(() => setReorderSuccessMsg(null), 3000);
  };

  // Guarantee OrdersView starts at top
  React.useEffect(() => {
    scrollToTop();
  }, []);

  const userOrders = useMemo(() => {
    const list = orders || [];
    const currentDeleted = deletedOrderIds || new Set<string>();

    // 1. Exclude any order in deletedOrderIds
    const activeList = list.filter(o => o && o.id && !currentDeleted.has(o.id));

    // 2. If no user profile loaded yet or guest mode, show all local orders on this device
    if (!user) {
      return activeList;
    }

    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id;
    const isUserAdmin = user.role === 'admin' || checkIsAdminEmail(user.email);

    // 3. Admin sees all active orders
    if (isUserAdmin) {
      return activeList;
    }

    // 4. Customer: matches email, matches userId, or was placed as guest/locally on this device
    return activeList.filter(o => {
      const custEmail = (o.customer?.email || '').toLowerCase().trim();
      const orderUserId = o.userId;
      const matchesEmail = Boolean(userEmail && custEmail && custEmail === userEmail);
      const matchesUserId = Boolean(userId && orderUserId && orderUserId === userId);
      const isGuestOrLocal = o.isGuest === true || !orderUserId;
      return matchesEmail || matchesUserId || isGuestOrLocal;
    });
  }, [user, orders, deletedOrderIds]);

  const handleReorder = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('success');
    let addedCount = 0;
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        // Find existing product in catalog
        const productMatch = products.find(p => p.id === item.productId || p.sku === (item as any).sku);
        if (productMatch) {
          addToCart(productMatch, item.quantity || 1);
          addedCount += item.quantity || 1;
        } else {
          // Construct fallback product object if item still valid
          const fallbackProduct: Product = {
            id: item.productId || `prod-${Date.now()}`,
            sku: (item as any).sku || `SKU-${Date.now()}`,
            name: item.name,
            slug: item.name.toLowerCase().replace(/\s+/g, '-'),
            description: item.name,
            shortFeatures: [],
            categoryId: 'hogar',
            images: [item.image || '/adaptador-universal-viajero.jpg'],
            costPrice: Math.round((item.salePrice || item.price || 0) * 0.65),
            salePrice: item.salePrice || item.price || 0,
            stock: 99,
            stockStatus: 'available',
            hideIfOutOfStock: false,
            isFeatured: false,
            isOnSale: false,
            isNew: false,
            rating: 5,
            reviewCount: 1,
            salesCount: 1,
            lastUpdated: new Date().toISOString(),
            supplier: 'Inova ARG'
          };
          addToCart(fallbackProduct, item.quantity || 1);
          addedCount += item.quantity || 1;
        }
      });
    }
    setReorderSuccessMsg(`¡${addedCount} producto${addedCount === 1 ? '' : 's'} agregado${addedCount === 1 ? '' : 's'} al carrito!`);
    setTimeout(() => {
      setActiveTab('cart');
    }, 600);
  };

  const inProgressOrders = useMemo(() => {
    return (userOrders || []).filter(o => {
      const s = String(o?.status || '').toLowerCase().trim();
      return (
        s !== 'delivered' && 
        s !== 'entregado' && 
        s !== 'completed' && 
        s !== 'finalizado' && 
        s !== 'cancelled' && 
        s !== 'cancelado'
      );
    });
  }, [userOrders]);

  const deliveredOrders = useMemo(() => {
    return (userOrders || []).filter(o => {
      const s = String(o?.status || '').toLowerCase().trim();
      return (
        s === 'delivered' || 
        s === 'entregado' || 
        s === 'completed' || 
        s === 'finalizado'
      );
    });
  }, [userOrders]);

  const cancelledOrders = useMemo(() => {
    return (userOrders || []).filter(o => {
      const s = String(o?.status || '').toLowerCase().trim();
      return (
        s === 'cancelled' || 
        s === 'cancelado'
      );
    });
  }, [userOrders]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'in_progress') return inProgressOrders;
    if (activeFilter === 'delivered') return deliveredOrders;
    if (activeFilter === 'cancelled') return cancelledOrders;
    return userOrders || [];
  }, [activeFilter, userOrders, inProgressOrders, deliveredOrders, cancelledOrders]);

  const handleSelectFilter = (filter: 'all' | 'in_progress' | 'delivered' | 'cancelled') => {
    triggerHaptic('selection');
    setActiveFilter(filter);
  };

  const handleOpenDetail = (order: Order, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    triggerHaptic('selection');
    openOrderDetail(order);
  };

  return (
    <div className="pb-24 max-w-xl mx-auto px-3 sm:px-4 pt-1 space-y-2.5">
      {/* 1. Top Header with Back Arrow (Flyer Style) */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              scrollToTop();
              setActiveTab('profile');
            }}
            className="p-1.5 -ml-1 rounded-full text-slate-800 hover:bg-slate-100 active:scale-95 transition-colors cursor-pointer"
            aria-label="Volver al perfil"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Mis pedidos
          </h1>
        </div>
      </div>

      {/* 2. Filter Pills Tabs (Flyer Style: Todos, En curso, Entregados, Cancelados) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
        <button
          type="button"
          id="btn-filter-all-orders"
          onClick={() => handleSelectFilter('all')}
          className={`px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap active:scale-95 flex items-center justify-center ${
            activeFilter === 'all'
              ? 'bg-[#7C3AED] text-white shadow-md shadow-purple-900/25 ring-2 ring-purple-400/40'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Todos ({(userOrders || []).length})
        </button>

        <button
          type="button"
          id="btn-filter-in-progress-orders"
          onClick={() => handleSelectFilter('in_progress')}
          className={`px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap active:scale-95 flex items-center justify-center ${
            activeFilter === 'in_progress'
              ? 'bg-[#7C3AED] text-white shadow-md shadow-purple-900/25 ring-2 ring-purple-400/40'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          En curso ({inProgressOrders.length})
        </button>

        <button
          type="button"
          id="btn-filter-delivered-orders"
          onClick={() => handleSelectFilter('delivered')}
          className={`px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap active:scale-95 flex items-center justify-center ${
            activeFilter === 'delivered'
              ? 'bg-[#7C3AED] text-white shadow-md shadow-purple-900/25 ring-2 ring-purple-400/40'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Entregados ({deliveredOrders.length})
        </button>

        <button
          type="button"
          id="btn-filter-cancelled-orders"
          onClick={() => handleSelectFilter('cancelled')}
          className={`px-3.5 py-2 min-h-[38px] rounded-full text-xs font-bold transition-all cursor-pointer select-none whitespace-nowrap active:scale-95 flex items-center justify-center ${
            activeFilter === 'cancelled'
              ? 'bg-[#7C3AED] text-white shadow-md shadow-purple-900/25 ring-2 ring-purple-400/40'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Cancelados ({cancelledOrders.length})
        </button>
      </div>

      {/* 3. Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-xs space-y-2.5 mt-2">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {!user 
              ? 'Inicia sesión para ver tus pedidos'
              : activeFilter === 'in_progress' 
              ? 'No tienes pedidos en curso' 
              : activeFilter === 'delivered' 
              ? 'Aún no tienes pedidos entregados' 
              : activeFilter === 'cancelled'
              ? 'No tienes pedidos cancelados'
              : 'Aún no tienes pedidos registrados'}
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {!user
              ? 'Si ya compraste o tienes una cuenta en VONDRO, ingresa para consultar el estado de tus envíos en tiempo real.'
              : activeFilter === 'cancelled'
              ? 'Aquí figurarán los pedidos que hayan sido cancelados o dados de baja.'
              : 'Seguí el estado de tus compras, consultá tus detalles y recibí todo a tiempo en Córdoba.'}
          </p>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab(!user ? 'profile' : 'home');
            }}
            className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full text-xs font-bold shadow-sm shadow-purple-900/20 transition-all active:scale-95 cursor-pointer"
          >
            {!user ? 'Ir a Mi Perfil para Iniciar Sesión' : 'Explorar catálogo'}
          </button>
        </div>
      ) : (
        /* 4. Compact Order Cards Feed (Anti-Scroll & Optimized Spacing) */
        <div className="space-y-2.5">
          {filteredOrders.filter(order => order && order.id).map((order) => {
            const dateObj = new Date(order.createdAt);
            const dateStr = dateObj.toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            const primaryItem = order.items && order.items.length > 0 ? order.items[0] : null;
            const primaryImg = primaryItem?.image 
              ? getOptimizedThumbnail(primaryItem.image, 160) 
              : getCategoryFallback();

            const isPendingPayment = order.status === 'pending_payment' || order.status === 'PENDIENTE_PAGO';
            const totalProductsCount = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || order.items?.length || 1;

            return (
              <div
                key={order.id}
                id={`order-card-${order.id}`}
                onClick={(e) => handleOpenDetail(order, e)}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all cursor-pointer space-y-2.5 active:scale-[0.99] relative overflow-hidden"
              >
                {/* Header: Pedido #XXXX | Fecha · N productos | Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight whitespace-nowrap block">
                        Pedido #{order.orderNumber.replace('#', '')}
                      </span>
                      <span className="text-[10.5px] sm:text-[11px] font-medium text-slate-400 block whitespace-nowrap">
                        {dateStr} · {totalProductsCount} {totalProductsCount === 1 ? 'producto' : 'productos'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1">
                      {getStatusBadge(order.status, order)}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </div>
                    {isPendingPayment && (
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Timer className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        <span>Vence en 24 hs</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Primary Item Preview & Total Price */}
                {primaryItem && (
                  <div className="flex items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 p-0.5 border border-slate-100 shrink-0 overflow-hidden shadow-2xs">
                        <img 
                          src={primaryImg} 
                          alt={primaryItem.name} 
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getCategoryFallback();
                          }}
                        />
                      </div>
                      <div className="min-w-0 truncate">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {decodeHtmlEntities(primaryItem.name)}
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                          Cantidad: x{primaryItem.quantity || 1}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm sm:text-base font-black text-[#7C3AED]">
                        ${(order.total ?? 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stepper for Orders (Flyer Timeline) */}
                {order.status !== 'cancelled' && order.status !== 'CANCELADO' && (
                  <div className="pt-2 border-t border-slate-50">
                    <OrderProgressBar status={order.status} createdAt={order.createdAt} order={order} />
                  </div>
                )}

                {/* Cancelled section banner if order is cancelled */}
                {(order.status === 'cancelled' || order.status === 'CANCELADO' || (order as any).status === 'cancelado') && (
                  <div className="pt-2 border-t border-rose-100">
                    <div className="bg-rose-50 border border-rose-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-rose-800 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-rose-900 block leading-tight">Pedido Cancelado</span>
                          <span className="text-[10.5px] text-rose-600 font-medium truncate block">Esta orden fue dada de baja y no se entregará</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          id={`btn-delete-cancelled-${order.id}`}
                          onClick={(e) => handleDeleteOrder(order.id, e)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                          title="Eliminar este pedido cancelado de tu historial"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white shrink-0" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Action Footer: Clean Side-by-Side Button Bar */}
                {order.status === 'cancelled' || order.status === 'CANCELADO' || (order as any).status === 'cancelado' ? (
                  <div className="pt-2.5 border-t border-slate-100/80 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id={`btn-reorder-${order.id}`}
                      onClick={(e) => handleReorder(order, e)}
                      className="w-full py-2 px-3 bg-slate-50 hover:bg-purple-50 text-purple-900 border border-slate-200 hover:border-purple-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                      title="Agregar todos los productos de este pedido al carrito"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span className="truncate">Comprar de nuevo</span>
                    </button>

                    <button
                      type="button"
                      id={`btn-delete-order-${order.id}`}
                      onClick={(e) => handleDeleteOrder(order.id, e)}
                      className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                      title="Eliminar este pedido cancelado de tu historial"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span className="truncate">Eliminar pedido</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2.5 border-t border-slate-100/80 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id={`btn-reorder-${order.id}`}
                      onClick={(e) => handleReorder(order, e)}
                      className="w-full py-2 px-3 bg-slate-50 hover:bg-purple-50 text-purple-900 border border-slate-200 hover:border-purple-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                      title="Agregar todos los productos de este pedido al carrito"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span className="truncate">Comprar de nuevo</span>
                    </button>

                    <button 
                      type="button"
                      id={`btn-view-order-${order.id}`}
                      onClick={(e) => handleOpenDetail(order, e)}
                      className="w-full py-2 px-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <span>Ver detalles</span>
                      <span className="text-xs leading-none">→</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Re-Order Success Notification Toast */}
      {reorderSuccessMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce border border-purple-500/40">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{reorderSuccessMsg}</span>
        </div>
      )}

      {/* Deletion Confirmation Modal for Cancelled Orders */}
      {orderToDeleteId && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">¿Eliminar pedido cancelado?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta acción quitará el pedido cancelado de tu historial de compras permanentemente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDeleteId(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Conservar
              </button>
              <button
                type="button"
                id="btn-confirm-delete-order"
                onClick={confirmDeleteOrder}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer active:scale-95"
              >
                Eliminar ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

