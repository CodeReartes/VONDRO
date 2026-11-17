import React, { useState } from 'react';
import { 
  Truck, 
  MapPin, 
  Package, 
  UserCheck, 
  Phone, 
  Plus, 
  Edit3, 
  Check, 
  AlertTriangle, 
  Clock, 
  Search, 
  Filter, 
  ExternalLink, 
  Printer, 
  DollarSign, 
  ShieldCheck, 
  Share2, 
  TrendingUp, 
  FileText, 
  X,
  Navigation,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Hash,
  Compass
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Order, ShippingStatus, Courier, LogisticsProvider, ShippingExpense } from '../../types';
import { triggerHaptic } from '../../utils/native';
import { ThermalLabelModal } from './ThermalLabelModal';
import { CadeteTripModal } from './CadeteTripModal';
import { getCadeteGoogleMapsNavigationUrl, getCadeteWazeNavigationUrl, calculateTripDistanceKm, estimateTripDurationMinutes, LLANQUELEN_4741_COORDS } from '../../utils/cordobaShipping';
import { exportLogisticsSettlementCSV } from '../../utils/accountingExport';

const getGoogleMapsSearchUrl = (customer: { address?: string; neighborhood?: string; reference?: string; city?: string }) => {
  const addr = (customer?.address || '').trim();
  const isGenericAddress = !addr || /^\(?otro\)?$/i.test(addr) || /^\(?sin direcc/i.test(addr) || addr.length < 3;
  
  const parts: string[] = [];
  if (!isGenericAddress) {
    parts.push(addr);
  }
  if (customer?.reference) {
    parts.push(customer.reference);
  }
  if (customer?.neighborhood) {
    parts.push(customer.neighborhood);
  }
  parts.push(customer?.city || 'Córdoba');
  parts.push('Argentina');

  const query = parts.filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const LogisticsDashboard: React.FC = () => {
  const { 
    orders, 
    couriers, 
    logisticsProviders, 
    shippingExpenses,
    shippingZones,
    settings,
    updateShippingStatus,
    updateOrderPackageInfo,
    assignCourierToOrder,
    addCourier,
    updateCourier,
    deleteCourier,
    addLogisticsProvider,
    updateLogisticsProvider,
    addShippingExpense,
    updateShippingZone,
    updateSettings
  } = useStore();

  const [subTab, setSubTab] = useState<'shipments' | 'map' | 'couriers' | 'zones' | 'providers' | 'expenses' | 'route'>('shipments');
  const [shippingFilter, setShippingFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [mapSearchTerm, setMapSearchTerm] = useState<string>('');
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>('ALL');

  // Modals state
  const [selectedOrderForPackage, setSelectedOrderForPackage] = useState<Order | null>(null);
  const [selectedOrderForTrip, setSelectedOrderForTrip] = useState<Order | null>(null);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [isCreatingCourier, setIsCreatingCourier] = useState<boolean>(false);
  const [isAddingExpense, setIsAddingExpense] = useState<boolean>(false);
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<Order | null>(null);

  // Form states
  const [courierForm, setCourierForm] = useState<{
    name: string;
    phone: string;
    email: string;
    vehicleType: 'MOTO' | 'AUTO' | 'UTILITARIO' | 'BICICLETA' | 'A_PIE';
    notes: string;
    active: boolean;
  }>({
    name: '',
    phone: '',
    email: '',
    vehicleType: 'MOTO',
    notes: '',
    active: true
  });

  const [packageForm, setPackageForm] = useState({
    packageCount: 1,
    packageWeight: 1.0,
    packageSize: 'Mediano (30x20x15 cm)',
    packageNotes: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    orderId: '',
    amount: 1500,
    type: 'COURIER_FEE' as ShippingExpense['type'],
    description: ''
  });

  // Pin verification state per order
  const [inputPin, setInputPin] = useState<Record<string, string>>({});
  const [pinStatus, setPinStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  // Route selector
  const [selectedRouteCourier, setSelectedRouteCourier] = useState<string>(couriers[0]?.id || 'courier-diego');

  // KPI Calculations
  const outForDeliveryOrders = orders.filter(o => o.shippingStatus === 'OUT_FOR_DELIVERY');
  const todayDelivered = orders.filter(o => {
    if (o.shippingStatus !== 'DELIVERED') return false;
    if (!o.deliveredAt) return true;
    const delDate = new Date(o.deliveredAt).toDateString();
    return delDate === new Date().toDateString();
  });
  const activeCouriersCount = couriers.filter(c => c.active).length;
  
  const totalShippingRevenue = orders.reduce((acc, o) => acc + (o.shippingCost || 0), 0);
  const totalShippingCosts = shippingExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netLogisticsProfit = totalShippingRevenue - totalShippingCosts;

  const totalDelivered = orders.filter(o => o.shippingStatus === 'DELIVERED').length;
  const totalFailed = orders.filter(o => o.shippingStatus === 'DELIVERY_FAILED').length;
  const deliverySuccessRate = (totalDelivered + totalFailed) > 0 
    ? Math.round((totalDelivered / (totalDelivered + totalFailed)) * 100) 
    : 100;

  // Filtered shipments
  const filteredOrders = (orders || []).filter(order => {
    if (!order || !order.customer) return false;
    const matchesSearch = 
      (order.orderNumber && order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer.name && order.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer.neighborhood && order.customer.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.trackingCode && order.trackingCode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = shippingFilter === 'ALL' || order.shippingStatus === shippingFilter;
    const matchesCourier = selectedCourierFilter === 'ALL' || order.assignedCourierId === selectedCourierFilter;

    return matchesSearch && matchesStatus && matchesCourier;
  });

  // Courier Route orders
  const courierRouteOrders = orders.filter(o => o.assignedCourierId === selectedRouteCourier && o.shippingStatus !== 'CANCELLED');

  // Status badges mapping
  const shippingStatusBadges: Record<ShippingStatus, { label: string; color: string }> = {
    PENDING: { label: 'Pendiente Envío', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    PREPARING: { label: 'En Preparación', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    READY_TO_SHIP: { label: 'Listo p/ Despacho', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
    OUT_FOR_DELIVERY: { label: 'En Reparto / Camino', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
    DELIVERED: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
    DELIVERY_FAILED: { label: 'Intento Fallido', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
    CANCELLED: { label: 'Envío Cancelado', color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
    RETURNED: { label: 'Devuelto a Depósito', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' }
  };

  const handleOpenCourierModal = (courier?: Courier) => {
    triggerHaptic();
    if (courier) {
      setEditingCourier(courier);
      setCourierForm({
        name: courier.name,
        phone: courier.phone,
        email: courier.email || '',
        vehicleType: courier.vehicleType || 'MOTO',
        notes: courier.notes || '',
        active: courier.active
      });
      setIsCreatingCourier(false);
    } else {
      setEditingCourier(null);
      setCourierForm({
        name: '',
        phone: '+549351',
        email: '',
        vehicleType: 'MOTO',
        notes: '',
        active: true
      });
      setIsCreatingCourier(true);
    }
  };

  const handleSaveCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    if (isCreatingCourier) {
      await addCourier(courierForm);
    } else if (editingCourier) {
      await updateCourier(editingCourier.id, courierForm);
    }
    setEditingCourier(null);
    setIsCreatingCourier(false);
  };

  const handleOpenPackageModal = (order: Order) => {
    triggerHaptic();
    setSelectedOrderForPackage(order);
    setPackageForm({
      packageCount: order.packageCount || 1,
      packageWeight: order.packageWeight || 1.0,
      packageSize: order.packageSize || 'Mediano (30x20x15 cm)',
      packageNotes: order.packageNotes || ''
    });
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    if (selectedOrderForPackage) {
      await updateOrderPackageInfo(selectedOrderForPackage.id, packageForm);
      setSelectedOrderForPackage(null);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    await addShippingExpense(expenseForm);
    setIsAddingExpense(false);
    setExpenseForm({ orderId: '', amount: 1500, type: 'COURIER_FEE', description: '' });
  };

  const handleVerifyPin = (order: Order) => {
    triggerHaptic();
    const pin = inputPin[order.id];
    if (pin && order.deliveryConfirmationCode && pin.trim() === order.deliveryConfirmationCode.trim()) {
      setPinStatus({ ...pinStatus, [order.id]: 'success' });
      updateShippingStatus(order.id, 'DELIVERED', 'Entrega verificada mediante PIN de seguridad.');
    } else {
      setPinStatus({ ...pinStatus, [order.id]: 'error' });
    }
  };

  const handlePrintRoute = () => {
    triggerHaptic();
    window.print();
  };

  const handleShareRouteWhatsApp = () => {
    triggerHaptic();
    const courier = (couriers || []).find(c => c?.id === selectedRouteCourier);
    if (!courier) return;

    let text = `🚚 *HOJA DE RUTA VONDRO - REPARTIDOR: ${(courier.name || 'REPARTIDOR').toUpperCase()}*\n`;
    text += `📅 Fecha: ${new Date().toLocaleDateString('es-AR')}\n\n`;

    courierRouteOrders.forEach((ord, index) => {
      text += `*${index + 1}. Pedido ${ord.orderNumber}* (${ord.customer.name})\n`;
      text += `📍 Direc: ${ord.customer.address}, ${ord.customer.neighborhood || ''}\n`;
      text += `📞 Tel: ${ord.customer.phone}\n`;
      text += `💵 Cobro: ${ord.paymentMethod === 'cash_delivery' ? `$${(ord.total ?? 0).toLocaleString()} (Efectivo contra entrega)` : 'PAGADO OK'}\n`;
      text += `🔑 PIN Entrega: ${ord.deliveryConfirmationCode || 'N/A'}\n\n`;
    });

    text += `Cualquier novedad avisar por este medio. ¡Buen viaje!`;

    const cleanPhone = courier.phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* HEADER & LOGISTICS KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600" />
            <h2 className="text-2xl font-black text-slate-900">Logística & Envíos Córdoba</h2>
          </div>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            Gestión integral de despachos, reparto urbano, cadetería y seguimiento en tiempo real
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenCourierModal()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cadete</span>
          </button>
          <button
            onClick={() => setIsAddingExpense(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            <span>Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* TOP KPI METRICS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-bold text-slate-900">En Reparto Hoy</span>
            <Truck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 my-1">
            {outForDeliveryOrders.length}
          </div>
          <span className="text-[11px] text-purple-700 font-bold">Pedidos en camino</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-bold text-slate-900">Entregas de Hoy</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 my-1">
            {todayDelivered.length}
          </div>
          <span className="text-[11px] text-emerald-700 font-bold">Completados</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-bold text-slate-900">Cadetes Activos</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 my-1">
            {activeCouriersCount}
          </div>
          <span className="text-[11px] text-blue-700 font-bold">Repartidores listos</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-bold text-slate-900">Efectividad</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 my-1">
            {deliverySuccessRate}%
          </div>
          <span className="text-[11px] text-slate-600 font-bold">Entregas exitosas</span>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-xs font-bold text-slate-900">Margen Envío</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className={`text-2xl font-black my-1 ${netLogisticsProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ${(netLogisticsProfit ?? 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-600 font-bold">Recaudado - Gastos</span>
        </div>
      </div>

      {/* LOGISTICS NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b-2 border-slate-200 pb-1.5 no-scrollbar">
        {[
          { id: 'shipments', label: 'Gestión de Despachos', icon: Package },
          { id: 'map', label: '🗺️ Mapa de Viajes & Despacho', icon: Navigation },
          { id: 'route', label: 'Hoja de Ruta Cadete', icon: Compass || Navigation },
          { id: 'couriers', label: 'Repartidores / Cadetes', icon: UserCheck },
          { id: 'zones', label: 'Zonas y Tarifas', icon: MapPin },
          { id: 'providers', label: 'Proveedores Logísticos', icon: Layers },
          { id: 'expenses', label: 'Gastos de Envío', icon: DollarSign },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic();
                setSubTab(tab.id as any);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: GESTIÓN DE DESPACHOS */}
      {subTab === 'shipments' && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por #pedido, cliente, barrio o código tracking..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <select
                value={shippingFilter}
                onChange={e => setShippingFilter(e.target.value)}
                className="text-xs bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDING">Pendiente Envío</option>
                <option value="PREPARING">En Preparación</option>
                <option value="READY_TO_SHIP">Listo p/ Despacho</option>
                <option value="OUT_FOR_DELIVERY">En Reparto</option>
                <option value="DELIVERED">Entregado</option>
                <option value="DELIVERY_FAILED">Intento Fallido</option>
                <option value="RETURNED">Devuelto</option>
              </select>

              <select
                value={selectedCourierFilter}
                onChange={e => setSelectedCourierFilter(e.target.value)}
                className="text-xs bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-600"
              >
                <option value="ALL">Todos los Cadetes</option>
                {couriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  triggerHaptic();
                  exportLogisticsSettlementCSV(orders);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl whitespace-nowrap transition-all shadow-xs"
                title="Descargar liquidación de cadetería y despachos en Excel / CSV"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* SHIPMENTS LIST */}
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border-2 border-slate-200 shadow-sm">
                <Truck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-black text-slate-900">No se encontraron envíos</p>
                <p className="text-xs text-slate-600 mt-1 font-semibold">Intenta ajustando los filtros de búsqueda</p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const badge = shippingStatusBadges[order.shippingStatus || 'PENDING'];
                const googleMapsUrl = getGoogleMapsSearchUrl(order.customer);
                const cleanPhone = order.customer.phone.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${order.customer.name}, te escribimos de VONDRO por tu pedido ${order.orderNumber}.`)}`;

                return (
                  <div 
                    key={order.id}
                    className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm hover:border-emerald-500 transition-all space-y-3"
                  >
                    {/* CARD TOP ROW */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-slate-900 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-lg">
                          {order.orderNumber}
                        </span>
                        <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${badge.color}`}>
                          {badge.label}
                        </span>
                        {order.trackingCode && (
                          <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300">
                            {order.trackingCode}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            triggerHaptic();
                            setSelectedOrderForTrip(order);
                          }}
                          className="flex items-center gap-1.5 text-[11px] font-black text-white bg-slate-900 hover:bg-black px-2.5 py-1 rounded-lg border border-slate-700 shadow-2xs transition-colors"
                          title="Abrir viaje interactivo del cadete desde Centro de Distribución VONDRO"
                        >
                          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ver Viaje & Mapa</span>
                        </button>

                        <button
                          onClick={() => handleOpenPackageModal(order)}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-800 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 transition-colors"
                        >
                          <Package className="w-3.5 h-3.5" />
                          <span>Embalaje ({order.packageCount || 1} bulto)</span>
                        </button>

                        <button
                          onClick={() => setSelectedOrderForLabel(order)}
                          className="flex items-center gap-1 text-[11px] font-bold text-slate-800 hover:text-blue-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Etiqueta</span>
                        </button>
                      </div>
                    </div>

                    {/* CARD BODY: CUSTOMER & ADDRESS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* DESTINO & MAPS */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Destino & Cliente</div>
                        <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{order.customer.name}</span>
                          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-800">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <div className="text-slate-800 font-semibold flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{order.customer.address} {order.customer.neighborhood ? `(${order.customer.neighborhood})` : ''}</span>
                        </div>
                        {order.customer.reference && (
                          <div className="text-[11px] text-amber-900 bg-amber-100 p-1.5 rounded-lg border border-amber-300 font-bold">
                            Ref: {order.customer.reference}
                          </div>
                        )}
                        <div className="pt-1 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic();
                              setSelectedOrderForTrip(order);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg shadow-2xs transition-colors"
                          >
                            <Navigation className="w-3 h-3 text-emerald-100" />
                            <span>Abrir Viaje Cadete</span>
                          </button>
                          <a 
                            href={getCadeteGoogleMapsNavigationUrl(order.customer)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-300 transition-colors"
                            title="Ruta GPS en tiempo real"
                          >
                            <span>GPS Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* DETALLES DE ENVÍO Y CADETE */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Asignación Logística</div>
                        <div>
                          <label className="text-[11px] text-slate-800 font-bold block mb-0.5">Cadete / Repartidor:</label>
                          <select
                            value={order.assignedCourierId || ''}
                            onChange={e => assignCourierToOrder(order.id, e.target.value || null)}
                            className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold"
                          >
                            <option value="">Sin asignar (Seleccionar cadete)</option>
                            {couriers.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.vehicleType || 'Moto'})</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-700 font-semibold pt-1">
                          <span>Zona: <strong className="text-slate-950 font-black">{order.shippingZoneName || 'Córdoba Capital'}</strong></span>
                          <span>Costo: <strong className="text-slate-950 font-black">${(order.shippingCost || 0).toLocaleString()}</strong></span>
                        </div>
                      </div>

                      {/* ACTUALIZACIÓN DE ESTADO Y PIN */}
                      <div className="space-y-2 bg-slate-100 p-3 rounded-xl border-2 border-slate-200">
                        <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Cambiar Estado de Envío</div>
                        <select
                          value={order.shippingStatus || 'PENDING'}
                          onChange={e => updateShippingStatus(order.id, e.target.value as ShippingStatus)}
                          className="w-full bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-black"
                        >
                          <option value="PENDING">1. Pendiente de Envío</option>
                          <option value="PREPARING">2. En Preparación</option>
                          <option value="READY_TO_SHIP">3. Listo p/ Despacho</option>
                          <option value="OUT_FOR_DELIVERY">4. En Reparto / Camino</option>
                          <option value="DELIVERED">5. Entregado Exitoso</option>
                          <option value="DELIVERY_FAILED">6. Intento Fallido / Reagendado</option>
                          <option value="RETURNED">7. Devuelto a Depósito</option>
                        </select>

                        {/* PIN VERIFICATION */}
                        {order.shippingStatus === 'OUT_FOR_DELIVERY' && (
                          <div className="pt-1">
                            <label className="text-[10px] font-black text-slate-800 block mb-1">
                              Validar PIN de Entrega (Clave: {order.deliveryConfirmationCode || '4829'}):
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="Ingresar PIN"
                                value={inputPin[order.id] || ''}
                                onChange={e => setInputPin({ ...inputPin, [order.id]: e.target.value })}
                                className="w-24 text-xs bg-white border-2 border-slate-400 rounded-lg px-2 py-1 text-center font-mono font-black text-slate-900"
                              />
                              <button
                                onClick={() => handleVerifyPin(order)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg transition-colors shadow-xs"
                              >
                                Validar
                              </button>
                            </div>
                            {pinStatus[order.id] === 'error' && (
                              <span className="text-[10px] text-rose-700 font-black block mt-1">PIN incorrecto</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: MAPA DE VIAJES & DESPACHO EN TIEMPO REAL */}
      {subTab === 'map' && (
        <div className="space-y-4">
          {/* BASE DE OPERACIONES BANNER */}
          <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-2xl shadow-sm border border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/40">
                    SISTEMA TIPO UBER / CADETERÍA
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">• Despachos en Vivo</span>
                </div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-emerald-400" />
                  Base de Salida: Centro de Distribución VONDRO (Córdoba Capital)
                </h3>
                <p className="text-xs text-slate-300">
                  Coordenadas GPS: <span className="font-mono text-emerald-300 font-bold">-31.4340, -64.2530</span> • Córdoba Capital.
                  Buscá cualquier pedido para abrir su ruta interactiva y despacharlo al instante.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=-31.4340,-64.2530"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Ver Base en Maps</span>
                </a>
              </div>
            </div>
          </div>

          {/* SEARCH & DISPATCH BAR */}
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar pedido por número #VON..., cliente, calle o barrio para abrir automáticamente el viaje en el mapa..."
                value={mapSearchTerm}
                onChange={e => setMapSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
              />
              {mapSearchTerm && (
                <button
                  onClick={() => setMapSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-black text-slate-600 mr-1">Filtrar:</span>
                {[
                  { id: 'ALL', label: 'Todos los Pedidos' },
                  { id: 'OUT_FOR_DELIVERY', label: 'En Reparto / Ruta' },
                  { id: 'READY_TO_SHIP', label: 'Listos p/ Despacho' },
                  { id: 'PREPARING', label: 'En Preparación' },
                  { id: 'DELIVERED', label: 'Entregados' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      triggerHaptic();
                      setShippingFilter(f.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      shippingFilter === f.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-slate-600">
                Mostrando <strong className="text-slate-900">{
                  orders.filter(o => {
                    const matchesFilter = shippingFilter === 'ALL' || o.shippingStatus === shippingFilter;
                    const q = mapSearchTerm.toLowerCase();
                    const matchesSearch = !q || 
                      (o.orderNumber || '').toLowerCase().includes(q) ||
                      (o.customer?.name || '').toLowerCase().includes(q) ||
                      (o.customer?.address || '').toLowerCase().includes(q) ||
                      (o.customer?.neighborhood || '').toLowerCase().includes(q);
                    return matchesFilter && matchesSearch;
                  }).length
                }</strong> pedidos
              </div>
            </div>
          </div>

          {/* ORDERS FOR TRIPS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders
              .filter(o => {
                const matchesFilter = shippingFilter === 'ALL' || o.shippingStatus === shippingFilter;
                const q = mapSearchTerm.toLowerCase();
                const matchesSearch = !q || 
                  (o.orderNumber || '').toLowerCase().includes(q) ||
                  (o.customer?.name || '').toLowerCase().includes(q) ||
                  (o.customer?.address || '').toLowerCase().includes(q) ||
                  (o.customer?.neighborhood || '').toLowerCase().includes(q);
                return matchesFilter && matchesSearch;
              })
              .map(order => {
                const courier = couriers.find(c => c.id === order.assignedCourierId);
                const subtotal = order.subtotal ?? (order.total - (order.shippingCost || 0));
                const isFreeShipping = subtotal >= 100000;
                const customerCoords = order.customer?.coordinates || { lat: -31.4201, lng: -64.1888 };
                const distanceKm = calculateTripDistanceKm(LLANQUELEN_4741_COORDS, customerCoords);
                const durationMin = estimateTripDurationMinutes(distanceKm);
                const googleMapsUrl = getCadeteGoogleMapsNavigationUrl(order.customer);
                const wazeUrl = getCadeteWazeNavigationUrl(order.customer);

                return (
                  <div 
                    key={order.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-4 hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* CARD TOP: STATUS & ORDER # */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-slate-900 text-xs">
                            {order.orderNumber}
                          </span>
                          {order.deliveryConfirmationCode && (
                            <span className="text-[10px] font-mono font-black bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded border border-purple-200">
                              PIN: {order.deliveryConfirmationCode}
                            </span>
                          )}
                        </div>

                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          order.shippingStatus === 'DELIVERED' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : order.shippingStatus === 'OUT_FOR_DELIVERY'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.shippingStatus === 'DELIVERED' ? '✓ Entregado' : order.shippingStatus === 'OUT_FOR_DELIVERY' ? '🚚 En Viaje' : 'Listo p/ Enviar'}
                        </span>
                      </div>

                      {/* CLIENT & ADDRESS */}
                      <div className="pt-2 space-y-1">
                        <h4 className="text-sm font-black text-slate-900 flex items-center justify-between">
                          <span>{order.customer.name}</span>
                          <span className="text-xs font-mono font-bold text-slate-500">{order.customer.phone}</span>
                        </h4>
                        <div className="text-xs text-slate-700 font-semibold flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {order.customer.address} {order.customer.neighborhood ? `(${order.customer.neighborhood})` : ''}
                          </span>
                        </div>
                        {order.customer.reference && (
                          <p className="text-[10px] text-amber-800 bg-amber-50 p-1 rounded font-bold">
                            Ref: {order.customer.reference}
                          </p>
                        )}
                      </div>

                      {/* DISTANCE & UBER-LIKE METRICS */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-bold flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-emerald-600" />
                            Distancia desde base:
                          </span>
                          <span className="font-mono font-black text-slate-900">
                            ~{distanceKm} km
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Tiempo estimado viaje:
                          </span>
                          <span className="font-mono font-black text-emerald-700">
                            ~{durationMin} min
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                          <span className="text-slate-600 font-bold">Cobro de envío:</span>
                          <span className={`font-black ${isFreeShipping ? 'text-emerald-700' : 'text-slate-900'}`}>
                            {isFreeShipping ? 'GRATIS (> $100.000)' : `$${(order.shippingCost || 3000).toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      {/* COURIER */}
                      <div className="mt-2 text-xs flex items-center justify-between text-slate-700">
                        <span className="text-[11px] font-bold">Cadete asignado:</span>
                        <span className="text-xs font-black text-slate-900">
                          {courier ? `${courier.name} (${courier.vehicleType})` : '⚠️ Sin asignar'}
                        </span>
                      </div>
                    </div>

                    {/* CARD ACTIONS */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <button
                        onClick={() => {
                          triggerHaptic();
                          setSelectedOrderForTrip(order);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        <Navigation className="w-4 h-4 text-emerald-400" />
                        <span>Abrir Viaje en Mapa Interactivo</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold text-center flex items-center justify-center gap-1 transition-colors"
                        >
                          <span>Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={wazeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-[11px] font-bold text-center flex items-center justify-center gap-1 transition-colors"
                        >
                          <span>Waze GPS</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {orders.length === 0 && (
            <div className="bg-white p-12 text-center rounded-2xl border-2 border-slate-200">
              <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-700 font-bold text-sm">No hay pedidos disponibles para despachar en este momento.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: HOJA DE RUTA CADETE */}
      {subTab === 'route' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <div>
              <h3 className="text-base font-black text-slate-900">Hoja de Ruta Digital & Imprimible</h3>
              <p className="text-xs text-slate-700 font-semibold">Selecciona el cadete para generar su itinerario de entregas</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedRouteCourier}
                onChange={e => setSelectedRouteCourier(e.target.value)}
                className="text-xs bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
              >
                {couriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.vehicleType || 'Moto'})</option>
                ))}
              </select>

              <button
                onClick={handleShareRouteWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Enviar p/ WhatsApp</span>
              </button>

              <button
                onClick={handlePrintRoute}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-opacity"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir Hoja</span>
              </button>
            </div>
          </div>

          {/* ROUTE ORDERS TABLE */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
            {courierRouteOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-700">
                <Navigation className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-black text-slate-900">Sin pedidos asignados a este cadete</p>
              </div>
            ) : (
              <div className="divide-y-2 divide-slate-100">
                {courierRouteOrders.map((ord, idx) => {
                  const googleMapsUrl = getGoogleMapsSearchUrl(ord.customer);
                  const isCash = ord.paymentMethod === 'cash_delivery';

                  return (
                    <div key={ord.id} className="p-4 hover:bg-slate-50 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 text-xs font-black flex items-center justify-center border border-emerald-300">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            Pedido {ord.orderNumber}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700">
                            ({ord.customer.name})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCash ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              Cobrar ${(ord.total ?? 0).toLocaleString()} (Efectivo)
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Pagado
                            </span>
                          )}

                          <button
                            onClick={() => {
                              triggerHaptic();
                              setSelectedOrderForTrip(ord);
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-black text-white text-[11px] font-black rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                            title="Abrir mapa interactivo del viaje"
                          >
                            <Navigation className="w-3 h-3 text-emerald-400" />
                            <span>Ver Viaje</span>
                          </button>

                          <button
                            onClick={() => updateShippingStatus(ord.id, 'DELIVERED', 'Entregado desde Hoja de Ruta')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg transition-colors"
                          >
                            Marcar Entregado
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-800 font-medium grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        <div>
                          <strong className="text-slate-950 font-bold">Dirección:</strong> {ord.customer.address}, {ord.customer.neighborhood || ''}
                          <button
                            onClick={() => {
                              triggerHaptic();
                              setSelectedOrderForTrip(ord);
                            }}
                            className="ml-2 text-emerald-700 underline font-bold text-[11px]"
                          >
                            Ver Mapa & GPS
                          </button>
                        </div>
                        <div>
                          <strong className="text-slate-950 font-bold">Teléfono:</strong> {ord.customer.phone} | <strong className="text-slate-950 font-bold">PIN:</strong> <span className="font-mono font-black text-slate-900">{ord.deliveryConfirmationCode || '4829'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: REPARTIDORES / CADETES */}
      {subTab === 'couriers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <div>
              <h3 className="text-base font-black text-slate-900">Equipo de Repartidores & Cadetería</h3>
              <p className="text-xs text-slate-700 font-semibold">Administra los cadetes propios y de distribución externa</p>
            </div>
            <button
              onClick={() => handleOpenCourierModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Cadete</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {couriers.map(courier => {
              const assignedCount = orders.filter(o => o.assignedCourierId === courier.id && o.shippingStatus === 'OUT_FOR_DELIVERY').length;
              const cleanPhone = courier.phone.replace(/\D/g, '');

              return (
                <div 
                  key={courier.id}
                  className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-sm flex items-center justify-center">
                        {courier.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">{courier.name}</div>
                        <div className="text-[11px] text-slate-700 font-bold">{courier.vehicleType || 'Moto'}</div>
                      </div>
                    </div>

                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${courier.active ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-slate-200 text-slate-800'}`}>
                      {courier.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-800 space-y-1 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-bold text-slate-900">{courier.phone}</span>
                      <a href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline font-bold text-[11px] ml-auto">
                        WhatsApp
                      </a>
                    </div>
                    {courier.email && (
                      <div className="text-[11px] text-slate-600 font-semibold truncate">{courier.email}</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t-2 border-slate-100 text-xs">
                    <span className="text-slate-700 font-bold">Pedidos en camino: <strong className="text-purple-700 font-black">{assignedCount}</strong></span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenCourierModal(courier)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 hover:text-slate-900 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCourier(courier.id)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: ZONAS Y TARIFAS DE ENVÍO */}
      {subTab === 'zones' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-1">Configuración de Zonas de Envío en Córdoba</h3>
            <p className="text-xs text-slate-700 font-semibold">Define las tarifas y tiempos estimados de entrega por barrio y zona urbana</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shippingZones.map(zone => (
              <div key={zone.id} className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-black text-slate-900 text-sm">{zone.name}</div>
                  <span className="text-sm font-black text-emerald-700">${(zone.price ?? 0).toLocaleString()}</span>
                </div>

                <div className="text-xs text-slate-800 space-y-1 font-medium">
                  <div><strong className="font-bold text-slate-950">Demora Estimada:</strong> {zone.estimatedDelivery || '24-48 hs'}</div>
                  {zone.neighborhoods && zone.neighborhoods.length > 0 && (
                    <div><strong className="font-bold text-slate-950">Barrios:</strong> {zone.neighborhoods.join(', ')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: PROVEEDORES LOGÍSTICOS */}
      {subTab === 'providers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-1">Integraciones Logísticas</h3>
            <p className="text-xs text-slate-700 font-semibold">Servicios de paquetería express e integraciones para la distribución</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {logisticsProviders.map(provider => (
              <div key={provider.id} className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-sm">{provider.name}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${provider.active ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-slate-200 text-slate-800'}`}>
                    {provider.active ? 'Conectado' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 font-medium">{provider.notes || 'Distribución y paquetería'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 6: GASTOS LOGÍSTICOS Y RENTABILIDAD */}
      {subTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm">
            <div>
              <h3 className="text-base font-black text-slate-900">Libro de Gastos de Distribución</h3>
              <p className="text-xs text-slate-700 font-semibold">Registra pagos de cadetería, combustible y embalajes para controlar la rentabilidad</p>
            </div>
            <button
              onClick={() => setIsAddingExpense(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Gasto</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y-2 divide-slate-100">
              {shippingExpenses.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-600 font-bold">No hay gastos registrados</div>
              ) : (
                shippingExpenses.map(exp => (
                  <div key={exp.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-900">{exp.description}</div>
                      <div className="text-[11px] text-slate-600 font-semibold">{new Date(exp.createdAt).toLocaleDateString('es-AR')}</div>
                    </div>
                    <span className="font-black text-rose-700">-${(exp.amount ?? 0).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PACKAGE DETAILS */}
      {selectedOrderForPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 border-2 border-slate-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                Datos de Embalaje ({selectedOrderForPackage.orderNumber})
              </h3>
              <button onClick={() => setSelectedOrderForPackage(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-800 font-bold mb-1">Cantidad de Bultos:</label>
                <input
                  type="number"
                  min={1}
                  value={packageForm.packageCount}
                  onChange={e => setPackageForm({ ...packageForm, packageCount: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Peso Estimado (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={packageForm.packageWeight}
                  onChange={e => setPackageForm({ ...packageForm, packageWeight: parseFloat(e.target.value) || 0.1 })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Tamaño de Caja / Bulto:</label>
                <input
                  type="text"
                  value={packageForm.packageSize}
                  onChange={e => setPackageForm({ ...packageForm, packageSize: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Notas de Embalaje:</label>
                <textarea
                  rows={2}
                  value={packageForm.packageNotes}
                  onChange={e => setPackageForm({ ...packageForm, packageNotes: e.target.value })}
                  placeholder="Ej: Fragil, incluir bolsa de seguridad..."
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForPackage(null)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xs"
                >
                  Guardar Bulto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT COURIER */}
      {(isCreatingCourier || editingCourier) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 border-2 border-slate-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                {isCreatingCourier ? 'Nuevo Cadete / Repartidor' : 'Editar Repartidor'}
              </h3>
              <button onClick={() => { setIsCreatingCourier(false); setEditingCourier(null); }} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCourier} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-800 font-bold mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  required
                  value={courierForm.name}
                  onChange={e => setCourierForm({ ...courierForm, name: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Teléfono WhatsApp:</label>
                <input
                  type="text"
                  required
                  value={courierForm.phone}
                  onChange={e => setCourierForm({ ...courierForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Vehículo / Transporte:</label>
                <select
                  value={courierForm.vehicleType}
                  onChange={e => setCourierForm({ ...courierForm, vehicleType: e.target.value as any })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                >
                  <option value="MOTO">Moto Express</option>
                  <option value="UTILITARIO">Utilitario / Kangoo</option>
                  <option value="BICICLETA">Bicicleta / Bici cargo</option>
                  <option value="AUTO">Auto Particular</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsCreatingCourier(false); setEditingCourier(null); }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xs"
                >
                  Guardar Cadete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT SHIPPING LABEL VIEW */}
      {selectedOrderForLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 border-2 border-slate-300 print:m-0 print:p-0">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <span className="font-black text-sm uppercase tracking-wider text-emerald-800">Vista de Etiqueta de Bulto</span>
              <button onClick={() => setSelectedOrderForLabel(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PRINTABLE LABEL AREA */}
            <div className="p-4 border-2 border-dashed border-slate-900 rounded-xl space-y-3 font-sans">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                <div>
                  <h1 className="text-2xl font-black tracking-tight">VONDRO</h1>
                  <p className="text-[10px] font-bold tracking-widest text-slate-600">CORDOBA CAPITAL - ENVIO REPARTO</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black">{selectedOrderForLabel.orderNumber}</span>
                  <p className="text-[10px] font-mono">{selectedOrderForLabel.trackingCode || 'VON-TRK-001'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Destinatario:</div>
                <div className="text-lg font-black">{selectedOrderForLabel.customer.name}</div>
                <div className="text-sm font-bold text-slate-800">{selectedOrderForLabel.customer.address}</div>
                <div className="text-sm font-bold text-slate-800">Barrio: {selectedOrderForLabel.customer.neighborhood || 'Córdoba Capital'}</div>
                <div className="text-xs text-slate-600 font-bold">Tel: {selectedOrderForLabel.customer.phone}</div>
                {selectedOrderForLabel.customer.reference && (
                  <div className="text-xs italic bg-slate-100 p-1.5 rounded mt-1 font-semibold">Ref: {selectedOrderForLabel.customer.reference}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-900 pt-2 text-xs">
                <div>
                  <strong>Bultos:</strong> {selectedOrderForLabel.packageCount || 1}
                </div>
                <div>
                  <strong>PIN Confirmación:</strong> <span className="font-mono font-black text-sm">{selectedOrderForLabel.deliveryConfirmationCode || '4829'}</span>
                </div>
              </div>

              <div className="border-t border-slate-900 pt-2 text-center text-[10px] font-mono font-bold">
                DESPACHO VONDRO - CORDOBA CAPITAL
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Etiqueta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD LOGISTICS EXPENSE */}
      {isAddingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 border-2 border-slate-300 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900">Registrar Gasto de Distribución</h3>
              <button onClick={() => setIsAddingExpense(false)} className="text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-800 font-bold mb-1">Monto ($):</label>
                <input
                  type="number"
                  required
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Tipo de Gasto:</label>
                <select
                  value={expenseForm.type}
                  onChange={e => setExpenseForm({ ...expenseForm, type: e.target.value as any })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                >
                  <option value="COURIER_FEE">Pago a Cadete / Repartidor</option>
                  <option value="FUEL">Combustible / Nafta</option>
                  <option value="PACKAGING">Materiales de Embalaje / Cajas / Bolsas</option>
                  <option value="CARRIER_FEE">Flete Tercerizado</option>
                  <option value="OTHER">Otro Gasto Logístico</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Descripción / Notas:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de reparto 5 envíos Nueva Córdoba..."
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingExpense(false)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xs"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Thermal Label Modal */}
      {selectedOrderForLabel && (
        <ThermalLabelModal
          order={selectedOrderForLabel}
          onClose={() => setSelectedOrderForLabel(null)}
        />
      )}

      {/* Cadete Trip & Map Navigation Modal */}
      {selectedOrderForTrip && (
        <CadeteTripModal
          order={selectedOrderForTrip}
          onClose={() => setSelectedOrderForTrip(null)}
        />
      )}
    </div>
  );
};
