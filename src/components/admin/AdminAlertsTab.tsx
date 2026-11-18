import React, { useState } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Package, 
  Boxes, 
  DollarSign, 
  Filter, 
  Clock, 
  Trash2,
  Sparkles,
  ArrowUpRight,
  MessageSquare,
  Headphones,
  Bot,
  Flame,
  Truck,
  Send,
  Radio,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { AppNotification } from '../../types';
import { triggerHaptic } from '../../utils/native';
import { sendPushNotification } from '../../utils/pushNotifications';

interface AdminAlertsTabProps {
  onSelectTab: (tab: any) => void;
}

export const AdminAlertsTab: React.FC<AdminAlertsTabProps> = ({ onSelectTab }) => {
  const { 
    notifications, 
    unreadNotificationsCount, 
    markNotificationRead, 
    markAllNotificationsRead,
    conversations,
    setCurrentConversationId,
    products,
    orders,
    createNotification
  } = useStore();

  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');

  // Push Broadcast state
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState<'offer' | 'shipping' | 'custom'>('offer');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [discountPercent, setDiscountPercent] = useState<number>(35);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [shippingType, setShippingType] = useState<'shipped' | 'out_for_delivery' | 'delivered'>('out_for_delivery');
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  const filteredNotifications = notifications.filter(n => {
    if (priorityFilter !== 'ALL' && n.priority !== priorityFilter) return false;
    if (statusFilter === 'UNREAD' && n.read) return false;
    if (statusFilter === 'READ' && !n.read) return false;
    return true;
  });

  const isAdvisorNotification = (notif: AppNotification) => {
    const typeStr = (notif.type || '').toUpperCase();
    const titleStr = (notif.title || '').toLowerCase();
    const msgStr = (notif.message || '').toLowerCase();
    return (
      typeStr.includes('ASSISTANT') ||
      typeStr.includes('ADVISOR') ||
      typeStr.includes('AGENT') ||
      typeStr.includes('TICKET') ||
      notif.entityType === 'conversation' ||
      notif.entityType === 'ticket' ||
      titleStr.includes('asesor') ||
      titleStr.includes('chat') ||
      titleStr.includes('atención') ||
      msgStr.includes('asesor') ||
      msgStr.includes('chat')
    );
  };

  const handleOpenAdvisorChat = (notif: AppNotification) => {
    triggerHaptic();
    if (!notif.read) markNotificationRead(notif.id);

    // Find conversation ID
    if (notif.entityId) {
      setCurrentConversationId(notif.entityId);
    } else {
      // Find matching conversation by user name or Juan Pérez or fallback
      const matchingConv = (conversations || []).find(c => 
        (notif.message && notif.message.toLowerCase().includes(c.customerName?.toLowerCase() || '')) ||
        (notif.title && notif.title.toLowerCase().includes(c.customerName?.toLowerCase() || '')) ||
        c.customerName?.toLowerCase().includes('juan')
      );
      if (matchingConv) {
        setCurrentConversationId(matchingConv.id);
      } else if (conversations && conversations.length > 0) {
        setCurrentConversationId(conversations[0].id);
      }
    }

    onSelectTab('assistant');
  };

  const handleNotificationClick = (notif: AppNotification) => {
    triggerHaptic();
    if (!notif.read) markNotificationRead(notif.id);

    if (isAdvisorNotification(notif)) {
      handleOpenAdvisorChat(notif);
    } else if (notif.type.includes('STOCK')) {
      onSelectTab('stock');
    } else if (notif.type.includes('ORDER') || notif.type.includes('PAYMENT')) {
      onSelectTab('preparation');
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Crítica</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">Alta</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">Media</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">Informativa</span>;
    }
  };

  const getTypeIcon = (type: string, notif?: AppNotification) => {
    if (notif && isAdvisorNotification(notif)) return <Headphones className="w-4 h-4 text-purple-400" />;
    if (type.includes('STOCK')) return <Boxes className="w-4 h-4 text-amber-400" />;
    if (type.includes('PAYMENT')) return <DollarSign className="w-4 h-4 text-emerald-400" />;
    if (type.includes('ORDER')) return <Package className="w-4 h-4 text-indigo-400" />;
    return <Bell className="w-4 h-4 text-purple-400" />;
  };

  const handleSendBroadcast = async () => {
    triggerHaptic('success');
    let title = '';
    let body = '';
    let category: 'offer' | 'shipping' | 'system' = 'offer';
    let url = '/';
    let image: string | undefined = undefined;
    let notifType: any = 'FLASH_OFFER';
    let entityId: string | undefined = undefined;

    if (broadcastMode === 'offer') {
      const prod = products.find(p => p.id === selectedProductId) || products[0];
      if (!prod) return;
      const discountedPrice = Math.round(prod.salePrice * (1 - discountPercent / 100));
      title = `🔥 ¡Oferta Relámpago en VONDRO!`;
      body = `¡${discountPercent}% OFF en ${prod.name}! A solo ARS$${discountedPrice.toLocaleString('es-AR')}. ¡Quedan pocas unidades!`;
      category = 'offer';
      url = `/?product=${prod.id}`;
      image = prod.image || (prod.images && prod.images[0]);
      notifType = 'FLASH_OFFER';
      entityId = prod.id;
    } else if (broadcastMode === 'shipping') {
      const ord = orders.find(o => o.id === selectedOrderId) || orders[0];
      const orderNum = ord?.orderNumber || '1042';
      entityId = ord?.id;
      category = 'shipping';

      if (shippingType === 'out_for_delivery') {
        title = `📍 ¡Tu pedido #${orderNum} llega HOY!`;
        body = `El repartidor ya está en tu zona en Córdoba Capital. Tu paquete será entregado en el transcurso del día.`;
        notifType = 'ORDER_OUT_FOR_DELIVERY';
      } else if (shippingType === 'shipped') {
        title = `🚚 ¡Tu pedido #${orderNum} está en camino!`;
        body = `Tu paquete ya fue despachado desde nuestro depósito central.`;
        notifType = 'ORDER_SHIPPED';
      } else {
        title = `📦 ¡Pedido #${orderNum} entregado!`;
        body = `El paquete fue entregado con éxito en tu domicilio. ¡Que lo disfrutes!`;
        notifType = 'ORDER_DELIVERED';
      }
      url = '/orders';
    } else {
      if (!customTitle.trim() || !customBody.trim()) return;
      title = customTitle;
      body = customBody;
      category = 'system';
      notifType = 'CUSTOM_PROMO';
    }

    const targetOrd = broadcastMode === 'shipping'
      ? (orders.find(o => o.id === selectedOrderId) || orders[0])
      : undefined;

    // 1. Dispatch OS level / In-app Heads-up Push
    await sendPushNotification({
      title,
      body,
      category,
      url,
      image,
      actionText: broadcastMode === 'offer' ? 'Ver Oferta' : 'Ver Pedido'
    });

    // 2. Persist in notification database for all customers
    await createNotification({
      ...(targetOrd?.userId ? { userId: targetOrd.userId } : {}),
      title,
      message: body,
      type: notifType,
      priority: 'high',
      targetAudience: 'customer',
      entityType: broadcastMode === 'offer' ? 'product' : 'order',
      entityId,
      ...(image ? { imageUrl: image } : {}),
      linkUrl: url,
      read: false
    });

    setBroadcastSuccess(`¡Notificación enviada con éxito a los celulares!`);
    setTimeout(() => setBroadcastSuccess(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-rose-400" />
              Alertas y Centro Operativo
            </span>
            <span className="text-xs text-slate-400">• {unreadNotificationsCount} sin leer</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Notificaciones y Alertas en Tiempo Real</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Avisos de clientes solicitando asesor, stock crítico, nuevos pagos de Mercado Pago confirmados y eventos del sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic();
              setIsBroadcastOpen(!isBroadcastOpen);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all active:scale-95"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            <span>{isBroadcastOpen ? 'Ocultar Disparador Push' : 'Lanzar Push a Celulares (VONDRO / Envíos)'}</span>
            {isBroadcastOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>

          {unreadNotificationsCount > 0 && (
            <button
              onClick={() => {
                triggerHaptic();
                markAllNotificationsRead();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors self-start md:self-auto"
            >
              <CheckCheck className="w-4 h-4 text-purple-400" />
              <span>Marcar todas como leídas</span>
            </button>
          )}
        </div>
      </div>

      {/* PUSH BROADCAST CREATOR (VONDRO Style & Order Delivery) */}
      {isBroadcastOpen && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-purple-500/50 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  Disparador de Notificaciones Push a Clientes
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                    Directo & WhatsApp
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Aparece arriba en la barra de notificaciones del celular y en la campana de ofertas de la tienda.
                </p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setBroadcastMode('offer')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  broadcastMode === 'offer'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                Oferta VONDRO
              </button>
              <button
                type="button"
                onClick={() => setBroadcastMode('shipping')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  broadcastMode === 'shipping'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                Estado Envío
              </button>
              <button
                type="button"
                onClick={() => setBroadcastMode('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  broadcastMode === 'custom'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Mensaje Libre
              </button>
            </div>
          </div>

          {/* Form Content */}
          {broadcastMode === 'offer' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Elegir producto a promocionar</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ARS ${p.salePrice.toLocaleString('es-AR')} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">% Descuento a mostrar</label>
                <div className="flex items-center gap-2">
                  {[20, 35, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${
                        discountPercent === pct
                          ? 'bg-orange-600 border-orange-500 text-white shadow-xs'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pct}% OFF
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {broadcastMode === 'shipping' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Seleccionar Orden del Cliente</label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  {orders.length === 0 ? (
                    <option value="">No hay órdenes creadas aún (se usará orden demo #1042)</option>
                  ) : (
                    orders.map(o => (
                      <option key={o.id} value={o.id}>
                        Orden #{o.orderNumber || o.id.slice(0, 6)} - {o.customer.name} ({o.shippingZone?.name || 'Córdoba'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Etapa del Envío</label>
                <select
                  value={shippingType}
                  onChange={(e) => setShippingType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  <option value="shipped">🚚 Pedido despachado / en camino</option>
                  <option value="out_for_delivery">📍 En reparto HOY a domicilio</option>
                  <option value="delivered">📦 Pedido entregado en mano</option>
                </select>
              </div>
            </div>
          )}

          {broadcastMode === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Título de la Notificación</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ej: 🔥 ¡2x1 en toda la tienda este fin de semana!"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Mensaje</label>
                <input
                  type="text"
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="Ej: Solo por 24hs en Córdoba Capital con envío gratis desde $100.000."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            {broadcastSuccess ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400" />
                {broadcastSuccess}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                La notificación se enviará al navegador/celular del cliente con vibración y sonido.
              </span>
            )}

            <button
              type="button"
              onClick={handleSendBroadcast}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black flex items-center space-x-2 shadow-lg hover:shadow-purple-500/25 active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Disparar Notificación Push Ahora</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Todas ({notifications.length})
          </button>
          <button
            onClick={() => setStatusFilter('UNREAD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'UNREAD' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            No leídas ({unreadNotificationsCount})
          </button>
          <button
            onClick={() => setStatusFilter('READ')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'READ' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Leídas
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-400 self-center mr-1">Prioridad:</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                priorityFilter === p ? 'bg-slate-700 text-white font-bold' : 'bg-slate-950/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {p === 'ALL' ? 'Todas' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Check className="w-12 h-12 mx-auto text-emerald-400 mb-3 opacity-90" />
          <h3 className="text-base font-semibold text-white">No hay notificaciones en este filtro</h3>
          <p className="text-xs text-slate-400 mt-1">
            El sistema se encuentra funcionando sin alertas activas pendientes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const isAdvisor = isAdvisorNotification(notif);

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  notif.read 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700' 
                    : isAdvisor
                      ? 'bg-slate-900 border-purple-500/60 text-slate-100 shadow-lg shadow-purple-950/40 hover:border-purple-400 ring-1 ring-purple-500/20'
                      : 'bg-slate-900 border-purple-500/40 text-slate-100 shadow-lg shadow-purple-950/30 hover:border-purple-400'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      {getTypeIcon(notif.type, notif)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-slate-100">{notif.title}</h4>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.createdAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    {getPriorityBadge(notif.priority)}
                  </div>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-300 flex-1">{notif.message}</p>

                  <div className="flex items-center space-x-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {isAdvisor && (
                      <button
                        onClick={() => handleOpenAdvisorChat(notif)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple-600/30 transition-all active:scale-95"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Atender en Chat</span>
                        <ArrowUpRight className="w-3 h-3 ml-0.5 opacity-80" />
                      </button>
                    )}

                    {notif.type.includes('STOCK') && (
                      <button
                        onClick={() => {
                          if (!notif.read) markNotificationRead(notif.id);
                          onSelectTab('stock');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center space-x-1 transition-colors"
                      >
                        <span>Reponer Stock</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(notif.type.includes('ORDER') || notif.type.includes('PAYMENT')) && !isAdvisor && (
                      <button
                        onClick={() => {
                          if (!notif.read) markNotificationRead(notif.id);
                          onSelectTab('preparation');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center space-x-1 transition-colors"
                      >
                        <span>Ver Pedido</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!notif.read && (
                      <button
                        onClick={() => {
                          triggerHaptic();
                          markNotificationRead(notif.id);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Marcar leída"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
