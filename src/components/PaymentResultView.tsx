import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  RotateCcw, 
  MessageCircle, 
  Package, 
  ShoppingBag, 
  FileText,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

import { formatWhatsAppPhone } from '../utils/phoneUtils';

export const PaymentResultView: React.FC = () => {
  const { 
    lastPaymentResult, 
    setActiveTab, 
    openOrderDetail, 
    settings 
  } = useStore();

  if (!lastPaymentResult || !lastPaymentResult.order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">No hay información de pago reciente</h2>
        <p className="text-xs text-slate-500 max-w-xs mt-1 mb-6">
          Puedes revisar el estado de tus compras en la sección de mis pedidos.
        </p>
        <button
          onClick={() => setActiveTab('home')}
          className="px-5 py-2.5 bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          Volver a la tienda
        </button>
      </div>
    );
  }

  const { status = 'pending', order, detail, paymentId } = lastPaymentResult;

  const cleanPhone = formatWhatsAppPhone(settings?.whatsappNumber || '3515948952');
  const safeStatus = (status || 'pending').toUpperCase();
  const waText = encodeURIComponent(
    `¡Hola ${settings.storeName}! Consulto por mi pedido ${order.orderNumber} (Estado de pago: ${safeStatus}). Nombre: ${order.customer?.firstName || ''} ${order.customer?.lastName || ''}.`
  );

  return (
    <div className="pb-28 max-w-lg mx-auto px-4 pt-4 space-y-5 animate-fadeIn">
      {/* 1. Header Hero Badge based on status */}
      <div className="text-center pt-2 space-y-3">
        {status === 'approved' && (
          <>
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm ring-8 ring-emerald-50">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                Pago confirmado • Mercado Pago
              </span>
              <h1 className="text-2xl font-black text-slate-900 pt-2">
                ¡Tu compra fue confirmada!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto">
                Hemos recibido el pago de tu pedido <strong className="text-purple-700">{order.orderNumber}</strong>. Estamos preparando tu envío en Córdoba Capital.
              </p>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-sm ring-8 ring-amber-50">
              <Clock className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Pago en proceso • Mercado Pago
              </span>
              <h1 className="text-2xl font-black text-slate-900 pt-2">
                Pago pendiente de acreditación
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto">
                Tu pedido <strong className="text-purple-700">{order.orderNumber}</strong> fue registrado. En cuanto Mercado Pago confirme la acreditación, comenzaremos a preparar tu paquete.
              </p>
            </div>
          </>
        )}

        {status === 'rejected' && (
          <>
            <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm ring-8 ring-rose-50">
              <XCircle className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                Pago no procesado
              </span>
              <h1 className="text-2xl font-black text-slate-900 pt-2">
                No pudimos procesar tu pago
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto">
                {detail || 'La entidad emisora o Mercado Pago no autorizó la transacción. Tu carrito sigue guardado para que puedas reintentar con otro medio de pago.'}
              </p>
            </div>
          </>
        )}

        {status === 'cancelled' && (
          <>
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto shadow-sm ring-8 ring-slate-50">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                Operación cancelada
              </span>
              <h1 className="text-2xl font-black text-slate-900 pt-2">
                El proceso de pago fue cancelado
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto">
                No se realizó ningún cobro. Tus productos continúan en el carrito para cuando desees completar la compra.
              </p>
            </div>
          </>
        )}
      </div>

      {/* 2. Order Details Box */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-500">N° de pedido:</span>
          <span className="text-sm font-black text-purple-700 font-mono">{order.orderNumber}</span>
        </div>

        {paymentId && (
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
            <span className="text-slate-500 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              ID de Transacción MP:
            </span>
            <span className="font-mono text-slate-700 font-medium">{paymentId}</span>
          </div>
        )}

        <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
          <span className="text-slate-500">Destinatario:</span>
          <span className="font-bold text-slate-800">{order.customer.firstName} {order.customer.lastName}</span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
          <span className="text-slate-500">Dirección de entrega:</span>
          <span className="font-medium text-slate-800 text-right">
            {order.customer.street} {order.customer.number}, {order.customer.neighborhood} (Córdoba)
          </span>
        </div>

        <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
          <span className="text-slate-500">Zona de envío:</span>
          <span className="font-bold text-slate-800">{order.shippingZoneName || 'Córdoba Capital'}</span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold text-slate-600">Total:</span>
          <span className="text-xl font-black text-slate-900">${(order?.total ?? 0).toLocaleString('es-AR')}</span>
        </div>
      </div>

      {/* 3. Items Summary */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Resumen de artículos ({order.items.reduce((acc, i) => acc + i.quantity, 0)})
        </h3>
        <div className="space-y-2.5">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <img
                src={item.image}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0 bg-slate-50"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-500">Cant: {item.quantity} × ${(item.salePrice ?? 0).toLocaleString('es-AR')}</p>
              </div>
              <span className="text-xs font-black text-slate-800 shrink-0">
                ${(item.subtotal ?? 0).toLocaleString('es-AR')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="space-y-2.5 pt-2">
        {status === 'approved' || status === 'pending' ? (
          <>
            <button
              id="btn-view-order-tracking"
              onClick={() => openOrderDetail(order)}
              className="w-full py-3.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-700/20 active:scale-98 transition-all"
            >
              <Package className="w-4 h-4" />
              <span>Ver seguimiento en Mis Pedidos</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <a
              id="btn-whatsapp-coordination"
              href={`https://wa.me/${cleanPhone}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Coordinar entrega por WhatsApp</span>
            </a>

            <button
              onClick={() => setActiveTab('home')}
              className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Seguir explorando el catálogo
            </button>
          </>
        ) : (
          <>
            <button
              id="btn-retry-payment"
              onClick={() => setActiveTab('checkout')}
              className="w-full py-3.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-700/20 active:scale-98 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reintentar con otro medio de pago</span>
            </button>

            <button
              onClick={() => setActiveTab('cart')}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-sm active:scale-98 transition-all"
            >
              Volver al Carrito
            </button>

            <a
              href={`https://wa.me/${cleanPhone}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 text-xs font-semibold text-emerald-700 flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span>¿Necesitas ayuda? Escribinos por WhatsApp</span>
            </a>
          </>
        )}
      </div>

      <div className="pt-2 text-center">
        <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Transacción protegida por VONDRO & Mercado Pago
        </span>
      </div>
    </div>
  );
};
