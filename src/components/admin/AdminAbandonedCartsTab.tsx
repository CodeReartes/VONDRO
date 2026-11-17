import React, { useState } from 'react';
import { 
  ShoppingBag, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Search, 
  Filter, 
  DollarSign, 
  RefreshCw, 
  Tag, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  Phone
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { AbandonedCart } from '../../types';
import { triggerHaptic } from '../../utils/native';

export const AdminAbandonedCartsTab: React.FC = () => {
  const { abandonedCarts, recoverAbandonedCart, settings } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredCarts = abandonedCarts.filter(cart => {
    const matchesSearch = 
      cart.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cart.phone?.includes(searchQuery) ||
      cart.items.some(i => i.product.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && cart.recoveryStatus === filterStatus;
  });

  const totalAbandonedAmount = (abandonedCarts || []).reduce((sum, c) => sum + (Number(c?.totalAmount ?? c?.subtotal) || 0), 0);
  const recoveredCarts = (abandonedCarts || []).filter(c => c?.recoveryStatus === 'RECOVERED');
  const totalRecoveredAmount = recoveredCarts.reduce((sum, c) => sum + (Number(c?.totalAmount ?? c?.subtotal) || 0), 0);
  const pendingCartsCount = (abandonedCarts || []).filter(c => c?.recoveryStatus === 'PENDING').length;

  const handleSendWhatsAppRecovery = (cart: AbandonedCart) => {
    triggerHaptic();
    const phone = (cart.phone || cart.customerPhone || '').replace(/\D/g, '');
    const cleanPhone = phone.startsWith('549') ? phone : phone.startsWith('54') ? `549${phone.slice(2)}` : `549${phone}`;
    const itemsList = cart.items.map(i => `• ${i.product.name} (x${i.quantity})`).join('\n');
    
    const message = encodeURIComponent(
      `¡Hola ${cart.customerName}! 👋 Te escribimos de ${settings.storeName} Córdoba.\n\nNotamos que dejaste estos productos en tu carrito:\n${itemsList}\n\n*Total:* $${(cart.totalAmount ?? cart.subtotal ?? 0).toLocaleString('es-AR')}\n\n🎉 ¡Aprovechá un *10% OFF EXTRA* en tu compra usando el cupón *VONDRO10* al finalizar tu pedido!\n\n¿Te ayudamos a completarlo o tenés alguna duda sobre el envío en Córdoba?`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleMarkRecovered = async (cartId: string) => {
    triggerHaptic();
    await recoverAbandonedCart(cartId);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-slate-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">• VONDRO Córdoba</span>
            </div>
            <h2 className="text-2xl font-black mt-1 text-slate-100">Carritos Abandonados</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Monitoreo y recuperación activa de carritos no finalizados con mensajes de WhatsApp y cupones de conversión inmediata.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-center">
              <span className="text-xs text-slate-400 block">Total Oportunidad</span>
              <span className="text-base font-extrabold text-amber-400">
                ${(totalAbandonedAmount ?? 0).toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Carritos Pendientes</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{pendingCartsCount}</p>
          <p className="text-[11px] text-amber-400/90 mt-0.5">Requieren contacto por WhatsApp</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Recuperados Exitosos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{recoveredCarts.length}</p>
          <p className="text-[11px] text-emerald-400/90 mt-0.5">
            ${(totalRecoveredAmount ?? 0).toLocaleString('es-AR')} ventas rescatadas
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Tasa de Conversión</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">
            {abandonedCarts.length > 0 ? Math.round((recoveredCarts.length / abandonedCarts.length) * 100) : 0}%
          </p>
          <p className="text-[11px] text-purple-400/90 mt-0.5">Impulsado con cupón VONDRO10</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, teléfono o producto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'PENDING', 'CONTACTED', 'RECOVERED', 'DISCARDED'].map((st) => (
            <button
              key={st}
              onClick={() => { triggerHaptic(); setFilterStatus(st); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterStatus === st 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st === 'all' && 'Todos'}
              {st === 'PENDING' && 'Pendientes'}
              {st === 'CONTACTED' && 'Contactados'}
              {st === 'RECOVERED' && 'Recuperados'}
              {st === 'DISCARDED' && 'Descartados'}
            </button>
          ))}
        </div>
      </div>

      {/* Abandoned Carts Table / List */}
      <div className="space-y-4">
        {filteredCarts.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800">
            <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-bold text-sm">No se encontraron carritos abandonados</p>
            <p className="text-slate-500 text-xs mt-1">
              Todos los clientes han completado sus compras correctamente.
            </p>
          </div>
        ) : (
          filteredCarts.map((cart) => (
            <div 
              key={cart.id} 
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3 hover:border-slate-700 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <span>{cart.customerName}</span>
                      <span className="text-xs font-mono text-slate-400">({cart.phone || cart.customerPhone})</span>
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Fecha: {new Date(cart.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>• {cart.items.length} productos</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    cart.recoveryStatus === 'RECOVERED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : cart.recoveryStatus === 'CONTACTED'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {cart.recoveryStatus === 'RECOVERED' && '✓ Recuperado'}
                    {cart.recoveryStatus === 'CONTACTED' && '💬 Contactado'}
                    {cart.recoveryStatus === 'PENDING' && '⏳ Pendiente'}
                  </span>

                  <span className="text-lg font-black text-amber-400">
                    ${(cart.totalAmount ?? cart.subtotal ?? 0).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {/* Items in Cart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {cart.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                    <img 
                      src={item.product.images[0]} 
                      alt={item.product.name} 
                      className="w-10 h-10 object-cover rounded-lg"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-200 truncate">{item.product.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.quantity} x ${(item.product?.salePrice ?? 0).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-purple-400" />
                    <span>Sugerir cupón <strong>VONDRO10</strong> (10% OFF)</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {cart.recoveryStatus !== 'RECOVERED' && (
                    <button
                      onClick={() => handleMarkRecovered(cart.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Marcar Recuperado</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleSendWhatsAppRecovery(cart)}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>Recuperar por WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
