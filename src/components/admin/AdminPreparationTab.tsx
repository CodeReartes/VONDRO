import React, { useState } from 'react';
import { 
  Package, 
  CheckSquare, 
  Square, 
  MessageCircle, 
  Truck, 
  Phone, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Search,
  Filter,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types';
import { triggerHaptic } from '../../utils/native';
import { ThermalLabelModal } from './ThermalLabelModal';

export const AdminPreparationTab: React.FC = () => {
  const { orders, updateOrderStatus, updateOrderPreparation, products } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<Order | null>(null);

  const getCustomerName = (c: any) => c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Cliente';
  const getCustomerAddress = (c: any) => c.address || `${c.street || ''} ${c.number || ''}`.trim() || 'Domicilio Córdoba';

  // Filter orders that need operational preparation or shipping
  const preparationOrders = orders.filter(o => {
    if (o.status === 'cancelled' || o.status === 'delivered') return false;
    const name = getCustomerName(o.customer);
    const matchesSearch = 
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer.phone.includes(searchTerm);
    const matchesZone = filterZone === 'all' || o.shippingZoneId === filterZone;
    return matchesSearch && matchesZone;
  });

  const handleToggleItemCheck = (order: Order, itemKey: string, itemIndex: number) => {
    triggerHaptic();
    const currentChecks: Record<string, boolean> = {};
    order.items.forEach((it, idx) => {
      const key = it.productId || `item-${idx}`;
      currentChecks[key] = !!it.prepared;
      currentChecks[`idx-${idx}`] = !!it.prepared;
      if (it.productId) currentChecks[it.productId] = !!it.prepared;
    });

    const isCurrent = currentChecks[itemKey] ?? currentChecks[`idx-${itemIndex}`] ?? false;
    const nextVal = !isCurrent;

    currentChecks[itemKey] = nextVal;
    currentChecks[`idx-${itemIndex}`] = nextVal;
    if (order.items[itemIndex]?.productId) {
      currentChecks[order.items[itemIndex].productId] = nextVal;
    }

    const allChecked = order.items.every((it, idx) => {
      const key = it.productId || `item-${idx}`;
      return !!currentChecks[key] || !!currentChecks[`idx-${idx}`];
    });

    updateOrderPreparation(order.id, currentChecks, allChecked);
  };

  const handleCheckAllItems = (order: Order) => {
    triggerHaptic();
    const currentChecks: Record<string, boolean> = {};
    order.items.forEach((it, idx) => {
      const key = it.productId || `item-${idx}`;
      currentChecks[key] = true;
      currentChecks[`idx-${idx}`] = true;
      if (it.productId) currentChecks[it.productId] = true;
    });
    updateOrderPreparation(order.id, currentChecks, true);
  };

  const handleSendWhatsAppPrepared = (order: Order) => {
    triggerHaptic();
    const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('549') ? cleanPhone : cleanPhone.startsWith('54') ? `549${cleanPhone.slice(2)}` : `549${cleanPhone}`;
    const itemsList = order.items.map(it => `• ${it.quantity}x ${it.name}`).join('\n');
    const name = getCustomerName(order.customer);
    const address = getCustomerAddress(order.customer);
    
    const message = `¡Hola ${name}! 👋 Te escribimos desde *VONDRO Córdoba*.\n\n📦 Tu pedido *#${order.orderNumber}* ya está embalado y listo para su despacho.\n\n*Detalle de tu compra:*\n${itemsList}\n\n📍 *Destino:* ${address}, ${order.customer.neighborhood || 'Córdoba Capital'}.\n\nEn breve nuestro repartidor iniciará el recorrido para entregártelo. ¡Muchas gracias por confiar en VONDRO!`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSendWhatsAppShipped = (order: Order) => {
    triggerHaptic();
    const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('549') ? cleanPhone : cleanPhone.startsWith('54') ? `549${cleanPhone.slice(2)}` : `549${cleanPhone}`;
    const name = getCustomerName(order.customer);
    const address = getCustomerAddress(order.customer);
    
    const message = `¡Hola ${name}! 🚚 Tu pedido *#${order.orderNumber}* de *VONDRO* está en camino a tu domicilio en ${address}.\n\nPor favor ten a mano tu DNI al momento de recibir el paquete. ¡Que lo disfrutes!`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-400" />
              Depósito y Logística Córdoba
            </span>
            <span className="text-xs text-slate-400">• {preparationOrders.length} pedidos activos</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Centro de Preparación y Despacho</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Verifica el empaque de cada producto, imprime la hoja de ruta y notifica al cliente por WhatsApp en un toque.
          </p>
        </div>

        {/* Search & Zone Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por # o cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {preparationOrders.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3 opacity-90" />
          <h3 className="text-base font-semibold text-white">¡No hay pedidos pendientes de empaque!</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Todos los pedidos han sido despachados o entregados. Los nuevos pedidos con pago confirmado aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {preparationOrders.map((order) => {
            const allItemsChecked = order.items.every(it => it.prepared);
            const totalItemsCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

            return (
              <div 
                key={order.id} 
                className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all ${
                  allItemsChecked ? 'border-emerald-500/50 bg-slate-900/90' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Order Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-base text-white">Pedido #{order.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.paymentStatus === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        order.paymentStatus === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {order.paymentStatus === 'approved' ? '✓ Pago Confirmado' : '🔒 Espera Confirmación Pago'}
                      </span>
                      {(() => {
                        const isAfter12Hs = new Date(order.createdAt).getHours() >= 12;
                        return isAfter12Hs ? (
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            🌙 Post 12hs · Prep. Mañana
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ☀️ Antes 12hs · Despacho Hoy
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(order.createdAt).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold text-purple-400">${(order.total ?? 0).toLocaleString('es-AR')}</span>
                    <p className="text-[10px] text-slate-400">{order.paymentMethod === 'mercadopago' ? 'Mercado Pago' : ((order.paymentMethod as string) === 'transfer' || order.paymentMethod === 'bank_transfer') ? 'Transferencia' : 'Efectivo'}</p>
                  </div>
                </div>

                {/* Customer and Delivery Info */}
                <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{getCustomerName(order.customer)}</span>
                    <span className="text-indigo-300 font-medium">{order.shippingZoneName || 'Córdoba Capital'}</span>
                  </div>
                  <p className="text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    {getCustomerAddress(order.customer)} {order.customer.neighborhood ? `(${order.customer.neighborhood})` : ''}
                  </p>
                  {order.customer.reference && (
                    <p className="text-[11px] text-amber-300/90 italic bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                      Ref: "{order.customer.reference}"
                    </p>
                  )}
                </div>

                {/* Stock Issue Special Resolution Bar (FASE 8) */}
                {(order.status === 'STOCK_ISSUE' || order.status === 'checking_stock') && (
                  <div className="mt-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                        <span>⚠️ Problema o Verificación de Stock</span>
                      </span>
                      <span className="text-[10px] text-amber-200/80">Opciones Comerciales</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => {
                          triggerHaptic();
                          window.open(`https://inova.com.ar/search?q=${encodeURIComponent(order.items[0]?.name || '')}`, '_blank');
                        }}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold border border-slate-700 flex items-center gap-1 justify-center"
                      >
                        <ExternalLink className="w-3 h-3 text-purple-400" />
                        <span>Ver en Inova</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic();
                          const message = encodeURIComponent(`Hola ${getCustomerName(order.customer)}, te contactamos de VONDRO por tu pedido #${order.orderNumber}. Queremos coordinar el stock del producto ${order.items[0]?.name}. ¿Podemos ofrecerte una alternativa similar o confirmar tiempo de despacho?`);
                          window.open(`https://wa.me/${order.customer.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
                        }}
                        className="p-2 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 text-[11px] font-semibold border border-emerald-700 flex items-center gap-1 justify-center"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-400" />
                        <span>Contactar Cliente</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic();
                          updateOrderStatus(order.id, 'checking_stock', 'En espera de restock del proveedor Inova ARG');
                        }}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-200 text-[11px] font-semibold border border-slate-700 flex items-center gap-1 justify-center"
                      >
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Esperar Restock</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic();
                          updateOrderStatus(order.id, 'preparing', 'Producto reemplazado coordinado con el cliente');
                        }}
                        className="p-2 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 text-[11px] font-semibold border border-indigo-700 flex items-center gap-1 justify-center"
                      >
                        <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                        <span>Reemplazar</span>
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic();
                          updateOrderStatus(order.id, 'cancelled', 'Cancelado y reembolsado por falta de stock');
                        }}
                        className="p-2 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-200 text-[11px] font-semibold border border-rose-800 flex items-center gap-1 justify-center col-span-2 sm:col-span-1"
                      >
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        <span>Cancelar/Reembolsar</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Checklist of Items to Pack */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-200">
                      Lista de Empaque ({totalItemsCount} unidades):
                    </span>
                    <button
                      onClick={() => handleCheckAllItems(order)}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-medium"
                    >
                      Marcar todo preparado
                    </button>
                  </div>

                  <div className="space-y-2">
                    {order.items.map((item, idx) => {
                      const isPrepared = !!item.prepared;
                      const productInCatalog = (products || []).find(p => p?.id === item?.productId);
                      const itemKey = item.productId || `item-${idx}`;

                      return (
                        <div
                          key={itemKey}
                          onClick={() => handleToggleItemCheck(order, itemKey, idx)}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                            isPrepared 
                              ? 'bg-emerald-950/40 border-emerald-500/50 text-slate-100 shadow-sm' 
                              : 'bg-slate-950/60 border-slate-700/80 text-slate-200 hover:border-purple-400 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleItemCheck(order, itemKey, idx);
                              }}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                isPrepared 
                                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/40' 
                                  : 'border-2 border-slate-500 hover:border-purple-400 bg-slate-800'
                              }`}
                              title={isPrepared ? 'Desmarcar' : 'Marcar preparado'}
                            >
                              {isPrepared ? <CheckCircle2 className="w-4 h-4" /> : null}
                            </button>
                            <div>
                              <p className={`font-semibold text-xs ${isPrepared ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                                {item.name}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                SKU: {productInCatalog?.sku || 'VND-PROD'} • Stock actual en depósito: {productInCatalog?.stock ?? 'N/D'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-bold text-white text-xs">
                              x{item.quantity}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        triggerHaptic();
                        setSelectedPrintOrder(order);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                      title="Imprimir etiqueta térmica autoadhesiva"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-400" />
                      <span>Etiqueta Térmica</span>
                    </button>

                    <button
                      onClick={() => handleSendWhatsAppPrepared(order)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Embalado</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    {(order.status === 'payment_received' || order.status === 'PAGO_APROBADO') && (
                      <button
                        onClick={() => {
                          triggerHaptic();
                          const isAfter12Hs = new Date(order.createdAt).getHours() >= 12;
                          updateOrderStatus(
                            order.id, 
                            'preparing', 
                            isAfter12Hs 
                              ? 'Preparación iniciada en depósito (programada tanda siguiente día).' 
                              : 'Preparación iniciada en depósito para despacho hoy.'
                          );
                        }}
                        className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-orange-600/20 transition-all cursor-pointer"
                      >
                        <Package className="w-4 h-4" />
                        <span>Poner en Preparación</span>
                      </button>
                    )}

                    {(order.status === 'preparing' || order.status === 'PREPARANDO' || order.status === 'ready_to_ship' || order.status === 'stock_confirmed') && (
                      <button
                        onClick={() => {
                          triggerHaptic();
                          updateOrderStatus(order.id, 'shipped', 'Pedido completamente embalado y en camino con el repartidor.');
                          handleSendWhatsAppShipped(order);
                        }}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Marcar En Camino</span>
                      </button>
                    )}

                    {(order.status === 'shipped' || order.status === 'ENVIADO' || order.status === 'out_for_delivery' || order.status === 'EN_CAMINO') && (
                      <button
                        onClick={() => {
                          triggerHaptic();
                          const enteredPin = prompt(`Ingrese el código PIN de entrega del cliente para la orden #${order.orderNumber} (PIN del cliente: ${order.deliveryConfirmationCode || '4829'}):`);
                          if (!enteredPin) return;
                          if (order.deliveryConfirmationCode && enteredPin.trim() !== order.deliveryConfirmationCode.trim()) {
                            alert('El código PIN no coincide con el registrado en el pedido.');
                            return;
                          }
                          updateOrderStatus(order.id, 'delivered', 'Pedido entregado exitosamente y validado con PIN.');
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Marcar Entregado (Con PIN)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Thermal Print Modal */}
      {selectedPrintOrder && (
        <ThermalLabelModal
          order={selectedPrintOrder}
          onClose={() => setSelectedPrintOrder(null)}
        />
      )}
    </div>
  );
};
