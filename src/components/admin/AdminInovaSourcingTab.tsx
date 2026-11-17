import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  ShoppingBag, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  ExternalLink, 
  Plus, 
  DollarSign, 
  Percent, 
  Calculator, 
  Truck, 
  RotateCcw, 
  Eye, 
  Check, 
  X, 
  Send, 
  MessageCircle, 
  Package, 
  TrendingUp, 
  Layers, 
  Search, 
  Filter, 
  FileText,
  Boxes,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { 
  PurchaseOrder, 
  PurchaseOrderItem, 
  PurchaseOrderStatus, 
  SupplierAvailability, 
  SupplierCheck, 
  SupplierReturn, 
  Product 
} from '../../types';
import { triggerHaptic } from '../../utils/native';

type SourcingSubTab = 'inova-overview' | 'purchase-orders' | 'availability' | 'calculator' | 'returns' | 'history';

export const AdminInovaSourcingTab: React.FC = () => {
  const { 
    products, 
    orders, 
    settings, 
    updateSettings, 
    suppliers,
    supplierChecks,
    verifyProductAvailability,
    purchaseOrders,
    createPurchaseOrder,
    updatePurchaseOrder,
    receivePurchaseOrder,
    deletePurchaseOrder,
    generatePurchaseOrderFromPendingOrders,
    supplierReturns,
    addSupplierReturn,
    calculatePriceWithMargin,
    createNotification
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<SourcingSubTab>('inova-overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  // New PO Modal State
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('sup-inova');
  const [poNotes, setPoNotes] = useState('');
  const [poSelectedItems, setPoSelectedItems] = useState<{ productId: string; quantity: number; costPrice: number }[]>([]);

  // Receive PO Modal State
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receptionData, setReceptionData] = useState<{ productId: string; receivedQuantity: number; actualCostPrice: number }[]>([]);
  const [receptionNotes, setReceptionNotes] = useState('');

  // Quick Availability Check Modal State
  const [checkingProduct, setCheckingProduct] = useState<Product | null>(null);
  const [checkStatus, setCheckStatus] = useState<SupplierAvailability>('AVAILABLE');
  const [checkObservedCost, setCheckObservedCost] = useState<number>(0);
  const [checkNotes, setCheckNotes] = useState('');

  // Sourcing Margin Calculator State
  const [calcCost, setCalcCost] = useState<number>(12000);
  const [calcMarginPct, setCalcMarginPct] = useState<number>(settings.defaultTargetMargin || 35);
  const [calcRounding, setCalcRounding] = useState<number>(settings.defaultPriceRounding || 100);

  // Supplier Return Modal State
  const [isCreatingReturn, setIsCreatingReturn] = useState(false);
  const [returnFormData, setReturnFormData] = useState<Partial<SupplierReturn>>({
    supplierId: 'sup-inova',
    supplierName: 'Inova ARG',
    productId: '',
    productName: '',
    productSku: '',
    quantity: 1,
    reason: 'DEFECTIVE_PRODUCT',
    resolution: 'PENDING_SUPPLIER',
    notes: ''
  });

  // Target Inova Supplier
  const inovaSupplier = (suppliers || []).find(s => s?.id === 'sup-inova' || (s?.name && s.name.toLowerCase().includes('inova'))) || suppliers?.[0];
  const inovaMinOrder = settings?.supplierMinimumOrder || 80000;

  // Pending Customer Demand for Inova Products
  const pendingOrdersForSupplier = useMemo(() => {
    const activeOrders = (orders || []).filter(o => o && ['pending', 'paid', 'preparing', 'payment_received', 'pending_payment'].includes(o.status));
    const map = new Map<string, { product: Product; neededQty: number; ordersCount: number }>();

    activeOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const prod = (products || []).find(p => p?.id === item?.product?.id || p?.id === item?.productId);
        if (prod && (prod.supplierId === 'sup-inova' || prod.supplier === 'Inova ARG' || !prod.supplierId)) {
          const existing = map.get(prod.id) || { product: prod, neededQty: 0, ordersCount: 0 };
          existing.neededQty += (item.quantity || 0);
          existing.ordersCount += 1;
          map.set(prod.id, existing);
        }
      });
    });

    return Array.from(map.values());
  }, [orders, products]);

  const totalPendingCostDemand = useMemo(() => {
    return pendingOrdersForSupplier.reduce((sum, item) => {
      const cost = item.product.costPrice || item.product.supplierCostPrice || 0;
      return sum + (cost * item.neededQty);
    }, 0);
  }, [pendingOrdersForSupplier]);

  const minOrderProgressPct = Math.min(100, Math.round((totalPendingCostDemand / inovaMinOrder) * 100));

  // Products needing check (checks older than 3 days or requiresSupplierCheck = true)
  const productsNeedingCheck = useMemo(() => {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    return products.filter(p => {
      if (p.requiresSupplierCheck) return true;
      if (!p.supplierLastCheckedAt) return true;
      const checkedTime = new Date(p.supplierLastCheckedAt).getTime();
      return checkedTime < threeDaysAgo;
    });
  }, [products]);

  // Filtered Products for Availability view
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.supplierSku && p.supplierSku.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;
      if (filterAvailability === 'all') return true;
      if (filterAvailability === 'needs_check') {
        return p.requiresSupplierCheck || !p.supplierLastCheckedAt;
      }
      return p.supplierAvailability === filterAvailability;
    });
  }, [products, searchQuery, filterAvailability]);

  // Auto Generate PO Handler
  const handleAutoGeneratePO = async () => {
    triggerHaptic();
    const po = await generatePurchaseOrderFromPendingOrders(inovaSupplier?.id || 'sup-inova');
    if (po) {
      setActiveSubTab('purchase-orders');
    }
  };

  // Open Check Modal
  const handleOpenCheckModal = (product: Product) => {
    triggerHaptic();
    setCheckingProduct(product);
    setCheckStatus(product.supplierAvailability || 'AVAILABLE');
    setCheckObservedCost(product.costPrice || product.supplierCostPrice || 0);
    setCheckNotes('');
  };

  // Submit Check
  const handleSubmitCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkingProduct) return;
    triggerHaptic();

    await verifyProductAvailability(
      checkingProduct.id, 
      checkStatus, 
      checkObservedCost > 0 ? checkObservedCost : undefined,
      checkNotes || undefined
    );

    setCheckingProduct(null);
  };

  // Open Receive PO Modal
  const handleOpenReceiveModal = (po: PurchaseOrder) => {
    triggerHaptic();
    setReceivingPO(po);
    setReceptionData(po.items.map(item => ({
      productId: item.productId,
      receivedQuantity: item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity,
      actualCostPrice: item.actualCostPrice !== undefined ? item.actualCostPrice : item.estimatedCostPrice
    })));
    setReceptionNotes(po.notes || '');
  };

  // Submit Receive PO
  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;
    triggerHaptic();

    await receivePurchaseOrder(receivingPO.id, receptionData, receptionNotes);
    setReceivingPO(null);
  };

  // Send WhatsApp PO to Inova
  const handleSendPOWhatsApp = (po: PurchaseOrder) => {
    triggerHaptic();
    const supplier = (suppliers || []).find(s => s?.id === po?.supplierId) || inovaSupplier;
    const phone = supplier?.phone || '3515948952';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('549') ? cleanPhone : cleanPhone.startsWith('54') ? `549${cleanPhone.slice(2)}` : `549${cleanPhone}`;

    const itemsText = po.items.map(i => `• [${i.supplierSku || i.productSku}] ${i.productName} x ${i.quantity} u.`).join('\n');
    const message = `*VONDRO CÓRDOBA - ORDEN DE COMPRA ${po.orderNumber}*\n\nHola ${supplier?.contactName || 'Inova ARG'}, adjunto el pedido de mercadería mayorista:\n\n${itemsText}\n\n*Total Estimado:* $${(po.totalEstimatedCost ?? 0).toLocaleString('es-AR')}\n\nFavor de confirmar disponibilidad y número de cuenta para transferencia inmediata. Muchas gracias!`;

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Sourcing Calculation Result
  const marginCalcResult = useMemo(() => {
    return calculatePriceWithMargin(calcCost, calcMarginPct, calcRounding);
  }, [calcCost, calcMarginPct, calcRounding, calculatePriceWithMargin]);

  return (
    <div className="space-y-6">
      {/* Header with Title & Inova Quick Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">
                Pedido Mínimo Mayorista: ${(inovaMinOrder ?? 0).toLocaleString('es-AR')} ARS
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1.5">
              Gestión de Abastecimiento & Compras Mayoristas
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Consolidación de pedidos a proveedores, control de stock y costo mayorista, cálculo de márgenes netos y recepción automatizada con actualización directa de inventario.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoGeneratePO}
              disabled={pendingOrdersForSupplier.length === 0}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Consolidar Demanda ({pendingOrdersForSupplier.length})</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic();
                setIsCreatingPO(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4 text-purple-400" />
              <span>Nueva Orden (PO)</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto pb-1">
          <button
            onClick={() => { triggerHaptic(); setActiveSubTab('inova-overview'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all ${
              activeSubTab === 'inova-overview'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Panel de Control</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveSubTab('purchase-orders'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all ${
              activeSubTab === 'purchase-orders'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Órdenes de Compra ({purchaseOrders.length})</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveSubTab('availability'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all ${
              activeSubTab === 'availability'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Control de Stock Mayorista</span>
            {productsNeedingCheck.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-slate-950 font-black animate-pulse">
                {productsNeedingCheck.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveSubTab('calculator'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all ${
              activeSubTab === 'calculator'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Calculadora de Márgenes</span>
          </button>

          <button
            onClick={() => { triggerHaptic(); setActiveSubTab('returns'); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all ${
              activeSubTab === 'returns'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Devoluciones / RMA ({supplierReturns.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. INOVA OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'inova-overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Sourcing Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Demanda Consolidada</span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-2">
                ${(totalPendingCostDemand ?? 0).toLocaleString('es-AR')}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-400">Objetivo Inova:</span>
                <span className="font-bold text-purple-300">${(inovaMinOrder ?? 0).toLocaleString('es-AR')}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    minOrderProgressPct >= 100 ? 'bg-emerald-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${minOrderProgressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {minOrderProgressPct >= 100 ? '✅ Umbral mínimo alcanzado para enviar pedido' : `Faltan $${Math.max(0, inovaMinOrder - totalPendingCostDemand).toLocaleString('es-AR')} para el mínimo`}
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Items por Pedir</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {pendingOrdersForSupplier.reduce((s, i) => s + i.neededQty, 0)} <span className="text-sm font-normal text-slate-400">unidades</span>
              </p>
              <p className="text-xs text-slate-400 mt-3">
                Distribuidas en <strong>{pendingOrdersForSupplier.length}</strong> productos distintos de clientes con compra confirmada.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Órdenes en Tránsito</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {purchaseOrders.filter(po => ['SUBMITTED', 'SHIPPED', 'PARTIALLY_RECEIVED'].includes(po.status)).length} <span className="text-sm font-normal text-slate-400">activas</span>
              </p>
              <p className="text-xs text-slate-400 mt-3">
                {purchaseOrders.filter(po => po.status === 'RECEIVED').length} órdenes recibidas e ingresadas a stock histórico.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verificación de Stock</span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-2">
                {productsNeedingCheck.length} <span className="text-sm font-normal text-slate-400">a revisar</span>
              </p>
              <p className="text-xs text-slate-400 mt-3">
                Productos que requieren confirmación de stock o costo mayorista en la web de Inova ARG.
              </p>
            </div>
          </div>

          {/* Pending Demands Breakdown Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-purple-400" />
                  Demanda Pendiente de Clientes para Inova ARG
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Productos solicitados en pedidos activos que requieren reposición o compra al proveedor mayorista.
                </p>
              </div>

              <button
                onClick={handleAutoGeneratePO}
                disabled={pendingOrdersForSupplier.length === 0}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Generar Orden de Compra (PO)</span>
              </button>
            </div>

            {pendingOrdersForSupplier.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-white">No hay demanda pendiente de Inova ARG</p>
                <p className="text-xs text-slate-400 mt-1">Todos los pedidos activos cuentan con stock propio o no hay órdenes pendientes de abastecimiento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4">SKU Mayorista</th>
                      <th className="py-3 px-4 text-center">Unidades Demandadas</th>
                      <th className="py-3 px-4 text-right">Costo Unit. Estimado</th>
                      <th className="py-3 px-4 text-right">Subtotal Costo</th>
                      <th className="py-3 px-4 text-center">Enlace Inova</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pendingOrdersForSupplier.map(({ product, neededQty, ordersCount }) => {
                      const cost = product.costPrice || product.supplierCostPrice || 0;
                      const subtotal = cost * neededQty;

                      return (
                        <tr key={product.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={product.images[0]} 
                                alt={product.name} 
                                className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0" 
                              />
                              <div>
                                <p className="font-bold text-white line-clamp-1">{product.name}</p>
                                <p className="text-[11px] text-purple-300">En {ordersCount} pedido(s) de cliente</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {product.supplierSku || product.sku}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-white">
                            <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {neededQty} u.
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-200">
                            ${(cost ?? 0).toLocaleString('es-AR')}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-400">
                            ${(subtotal ?? 0).toLocaleString('es-AR')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {product.supplierProductUrl ? (
                              <a 
                                href={product.supplierProductUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 hover:underline"
                              >
                                <span>Ver en Inova</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Sin URL</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenCheckModal(product)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium"
                            >
                              Verificar Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PURCHASE ORDERS (ÓRDENES DE COMPRA) TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'purchase-orders' && (
        <div className="space-y-6 animate-fadeIn">
          {purchaseOrders.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <ShoppingBag className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-90" />
              <h3 className="text-base font-bold text-white">No hay órdenes de compra registradas</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Puedes consolidar automáticamente los pedidos pendientes de tus clientes o crear una nueva orden mayorista a mano.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={handleAutoGeneratePO}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg"
                >
                  Consolidar Demanda
                </button>
                <button
                  onClick={() => setIsCreatingPO(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  Crear Manualmente
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {purchaseOrders.map(po => {
                const isReceived = po.status === 'RECEIVED';
                const totalCost = po.totalActualCost || po.totalEstimatedCost;
                const progressPct = Math.min(100, Math.round((totalCost / inovaMinOrder) * 100));

                return (
                  <div 
                    key={po.id}
                    className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-3xl p-6 shadow-xl transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-extrabold text-base text-white tracking-wide">{po.orderNumber}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            po.status === 'RECEIVED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                            po.status === 'SHIPPED' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                            po.status === 'SUBMITTED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                            po.status === 'READY' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                            po.status === 'CANCELLED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                            'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {po.status === 'RECEIVED' ? 'RECIBIDA EN STOCK' :
                             po.status === 'SHIPPED' ? 'ENVIADA / EN TRÁNSITO' :
                             po.status === 'SUBMITTED' ? 'PEDIDA AL PROVEEDOR' :
                             po.status === 'READY' ? 'LISTA PARA ENVIAR' :
                             po.status === 'CANCELLED' ? 'CANCELADA' : 'BORRADOR'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Proveedor: <strong>{po.supplierName}</strong> • Creada: {new Date(po.createdAt).toLocaleDateString('es-AR')}
                        </p>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleSendPOWhatsApp(po)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                          title="Enviar pedido por WhatsApp a Inova"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>WhatsApp Inova</span>
                        </button>

                        {!isReceived && (
                          <button
                            onClick={() => handleOpenReceiveModal(po)}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                          >
                            <Check className="w-4 h-4" />
                            <span>Recibir Mercadería</span>
                          </button>
                        )}

                        <button
                          onClick={async () => {
                            if (window.confirm(`¿Eliminar orden ${po.orderNumber}?`)) {
                              await deletePurchaseOrder(po.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition-colors"
                          title="Eliminar orden"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress to minimum order bar */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs text-slate-400">Total de la Orden de Compra:</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-white">${(totalCost ?? 0).toLocaleString('es-AR')}</span>
                          <span className="text-xs text-slate-400">({po.items.reduce((s, i) => s + i.quantity, 0)} unidades)</span>
                        </div>
                      </div>

                      <div className="flex-1 max-w-xs">
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>Umbral mínimo $80.000:</span>
                          <span className="font-bold text-white">{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Items table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="text-[11px] uppercase bg-slate-950/40 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Producto</th>
                            <th className="py-2.5 px-3">SKU Inova</th>
                            <th className="py-2.5 px-3 text-center">Cant. Pedida</th>
                            <th className="py-2.5 px-3 text-center">Cant. Recibida</th>
                            <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {po.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/20">
                              <td className="py-2.5 px-3 font-semibold text-white">
                                {item.productName}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-400">
                                {item.supplierSku || item.productSku}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-white">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {item.receivedQuantity !== undefined ? (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold">
                                    {item.receivedQuantity}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                ${ ((item.actualCostPrice || item.estimatedCostPrice) || 0).toLocaleString('es-AR') }
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-purple-300">
                                ${ (((item.actualCostPrice || item.estimatedCostPrice) || 0) * ((item.receivedQuantity || item.quantity) || 0)).toLocaleString('es-AR') }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {po.notes && (
                      <p className="text-xs text-slate-400 italic bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                        Notas: {po.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. AVAILABILITY & STOCK CHECKS TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'availability' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filter and Search Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o código de proveedor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setFilterAvailability('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterAvailability === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Todos ({products.length})
              </button>
              <button
                onClick={() => setFilterAvailability('needs_check')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterAvailability === 'needs_check' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Revisar Urgente ({productsNeedingCheck.length})
              </button>
              <button
                onClick={() => setFilterAvailability('AVAILABLE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterAvailability === 'AVAILABLE' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Disponible
              </button>
              <button
                onClick={() => setFilterAvailability('OUT_OF_STOCK')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterAvailability === 'OUT_OF_STOCK' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Agotado
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">SKU Inova</th>
                  <th className="py-3 px-4 text-center">Estado Mayorista</th>
                  <th className="py-3 px-4 text-right">Costo Inova</th>
                  <th className="py-3 px-4 text-right">Precio Venta</th>
                  <th className="py-3 px-4 text-right">Margen Neto</th>
                  <th className="py-3 px-4 text-center">Último Chequeo</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map(product => {
                  const cost = product.costPrice || product.supplierCostPrice || 0;
                  const profit = product.salePrice - cost;
                  const marginPct = product.salePrice > 0 ? ((profit / product.salePrice) * 100).toFixed(1) : '0';

                  return (
                    <tr key={product.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={product.images[0]} 
                            alt={product.name} 
                            className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0" 
                          />
                          <div>
                            <p className="font-bold text-white line-clamp-1">{product.name}</p>
                            <p className="text-[11px] text-slate-400">{product.supplier || 'Inova ARG'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {product.supplierSku || product.sku}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          product.supplierAvailability === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          product.supplierAvailability === 'LOW_STOCK' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          product.supplierAvailability === 'OUT_OF_STOCK' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                          product.supplierAvailability === 'DISCONTINUED' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                          'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }`}>
                          {product.supplierAvailability === 'AVAILABLE' ? 'Disponible' :
                           product.supplierAvailability === 'LOW_STOCK' ? 'Poco Stock' :
                           product.supplierAvailability === 'OUT_OF_STOCK' ? 'Agotado' :
                           product.supplierAvailability === 'DISCONTINUED' ? 'Descontinuado' : 'Por Revisar'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-200">
                        ${(cost ?? 0).toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        ${(product.salePrice ?? 0).toLocaleString('es-AR')}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        {marginPct}% (${(profit ?? 0).toLocaleString('es-AR')})
                      </td>
                      <td className="py-3 px-4 text-center text-[11px] text-slate-400">
                        {product.supplierLastCheckedAt ? (
                          <span>{new Date(product.supplierLastCheckedAt).toLocaleDateString('es-AR')}</span>
                        ) : (
                          <span className="text-amber-400 font-bold">Nunca</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {product.supplierProductUrl && (
                            <a
                              href={product.supplierProductUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                              title="Ver en web de Inova"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleOpenCheckModal(product)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition-all"
                          >
                            Verificar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SOURCING MARGIN CALCULATOR TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 lg:col-span-1">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-400" />
                Parámetros de Sourcing
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulador de precios y márgenes netos para productos adquiridos a precio mayorista en Inova ARG.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Costo Mayorista Inova ARG ($):
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={calcCost}
                    onChange={e => setCalcCost(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Margen Objetivo sobre Costo (%):
                  </label>
                  <span className="text-xs font-extrabold text-purple-400">{calcMarginPct}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={calcMarginPct}
                  onChange={e => setCalcMarginPct(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>10% (Bajo)</span>
                  <span>35% (Estándar VONDRO)</span>
                  <span>75%+ (Premium)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Regla de Redondeo Comercial:
                </label>
                <select
                  value={calcRounding}
                  onChange={e => setCalcRounding(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                >
                  <option value={10}>Redondear a $10 más cercano</option>
                  <option value={50}>Redondear a $50 más cercano</option>
                  <option value={100}>Redondear a $100 más cercano ($12.900)</option>
                  <option value={500}>Redondear a $500 más cercano</option>
                  <option value={1000}>Redondear a $1.000 más cercano</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Display */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl lg:col-span-2 flex flex-col justify-between space-y-6">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Resultado de Rentabilidad Recomendada
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Precio Venta Final (PVP)</span>
                  <p className="text-2xl font-black text-white mt-1">
                    ${(marginCalcResult?.roundedPrice ?? 0).toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Redondeado con regla ${calcRounding}</p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Ganancia Bruta x Unidad</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    +${(marginCalcResult?.grossProfit ?? 0).toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Margen s/Venta: {marginCalcResult.marginOnSalePct}%</p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs text-slate-400 font-medium">Markup Aplicado</span>
                  <p className="text-2xl font-black text-purple-400 mt-1">
                    +{calcMarginPct}%
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">S/ Costo de Inova ARG</p>
                </div>
              </div>
            </div>

            {/* Application helper */}
            <div className="bg-purple-950/30 border border-purple-800/40 rounded-2xl p-4 text-xs text-purple-200">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Automatización en el Catálogo VONDRO:
              </p>
              <p className="mt-1 text-purple-300/90 leading-relaxed">
                Al verificar un producto con nuevo costo mayorista, el sistema recalculará automáticamente el PVP usando el margen configurado ({calcMarginPct}%) y registrará la auditoría en Firestore.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUPPLIER RETURNS / RMA TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'returns' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-purple-400" />
                Devoluciones y Garantías ante Proveedor (RMA Inova)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Registro y seguimiento de productos defectuosos devueltos a Inova ARG para nota de crédito o reemplazo.
              </p>
            </div>

            <button
              onClick={() => {
                triggerHaptic();
                setIsCreatingReturn(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Devolución</span>
            </button>
          </div>

          {supplierReturns.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
              <h3 className="text-base font-bold text-white">No hay devoluciones activas ante Inova ARG</h3>
              <p className="text-xs text-slate-400 mt-1">Todos los pedidos y productos recibidos se encuentran en orden.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-center">Cantidad</th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4 text-center">Estado Resolución</th>
                    <th className="py-3 px-4 text-right">Monto Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {supplierReturns.map(ret => (
                    <tr key={ret.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(ret.createdAt).toLocaleDateString('es-AR')}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {ret.productName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {ret.productSku}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-white">
                        {ret.quantity} u.
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {ret.reason === 'DEFECTIVE_PRODUCT' ? 'Falla de fábrica / Defectuoso' :
                         ret.reason === 'INCORRECT_ITEM' ? 'Producto incorrecto enviado' :
                         ret.reason === 'CUSTOMER_RETURN' ? 'Devolución de cliente' : 'Otro'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          ret.resolution === 'RESOLVED_REFUND' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                          ret.resolution === 'RESOLVED_REPLACEMENT' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                          ret.resolution === 'REJECTED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                          'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {ret.resolution === 'RESOLVED_REFUND' ? 'Reembolsado / N. Crédito' :
                           ret.resolution === 'RESOLVED_REPLACEMENT' ? 'Reemplazado' :
                           ret.resolution === 'REJECTED' ? 'Rechazado' : 'Pendiente Inova'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        {ret.refundAmount ? `$${(ret.refundAmount ?? 0).toLocaleString('es-AR')}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VERIFICAR DISPONIBILIDAD & COSTO */}
      {/* ========================================================================= */}
      {checkingProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base text-white">Verificar Stock en Inova ARG</h3>
              </div>
              <button 
                onClick={() => setCheckingProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <img src={checkingProduct.images[0]} alt={checkingProduct.name} className="w-12 h-12 rounded-xl object-cover" />
              <div>
                <h4 className="font-bold text-sm text-white">{checkingProduct.name}</h4>
                <p className="text-xs text-slate-400">SKU: {checkingProduct.supplierSku || checkingProduct.sku}</p>
              </div>
            </div>

            <form onSubmit={handleSubmitCheck} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Estado de Stock en Inova*:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckStatus('AVAILABLE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      checkStatus === 'AVAILABLE' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckStatus('LOW_STOCK')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      checkStatus === 'LOW_STOCK' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Poco Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckStatus('OUT_OF_STOCK')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      checkStatus === 'OUT_OF_STOCK' ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Agotado
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Costo Mayorista Observado ($ ARS):
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={checkObservedCost}
                  onChange={e => setCheckObservedCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:border-purple-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Si el costo varió, el precio de venta se recalculará automáticamente según el margen.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notas de Verificación (opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Stock confirmado telefónicamente con asesor Inova."
                  value={checkNotes}
                  onChange={e => setCheckNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCheckingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg"
                >
                  Guardar Verificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECEPCIÓN DE ORDEN DE COMPRA (PO) */}
      {/* ========================================================================= */}
      {receivingPO && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Recepción de Mercadería • {receivingPO.orderNumber}</h3>
              </div>
              <button 
                onClick={() => setReceivingPO(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Verifique las cantidades recibidas físicamente de <strong>{receivingPO.supplierName}</strong>. El inventario se incrementará automáticamente.
            </p>

            <form onSubmit={handleSubmitReceive} className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {receptionData.map((rec, idx) => {
                  const item = receivingPO.items.find(i => i.productId === rec.productId);
                  if (!item) return null;

                  return (
                    <div key={rec.productId} className="bg-slate-950 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-xs text-white">{item.productName}</p>
                        <p className="text-[11px] text-slate-400">Pedidas: <strong>{item.quantity}</strong> unidades</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400">Cant. Recibida:</label>
                          <input
                            type="number"
                            min="0"
                            value={rec.receivedQuantity}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setReceptionData(prev => prev.map(r => r.productId === rec.productId ? { ...r, receivedQuantity: val } : r));
                            }}
                            className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white text-center"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400">Costo Real ($):</label>
                          <input
                            type="number"
                            min="0"
                            value={rec.actualCostPrice}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setReceptionData(prev => prev.map(r => r.productId === rec.productId ? { ...r, actualCostPrice: val } : r));
                            }}
                            className="w-24 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-emerald-400 text-right"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Notas de recepción / Remito:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Remito Inova #48291 recibido conforme."
                  value={receptionNotes}
                  onChange={e => setReceptionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReceivingPO(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg"
                >
                  Confirmar Ingreso a Inventario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR DEVOLUCIÓN A PROVEEDOR */}
      {/* ========================================================================= */}
      {isCreatingReturn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base text-white">Registrar Devolución a Inova</h3>
              </div>
              <button 
                onClick={() => setIsCreatingReturn(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              triggerHaptic();
              const prod = (products || []).find(p => p?.id === returnFormData.productId);
              await addSupplierReturn({
                supplierId: inovaSupplier?.id || 'sup-inova',
                supplierName: inovaSupplier?.name || 'Inova ARG',
                productId: returnFormData.productId || products[0]?.id || '',
                productName: prod?.name || returnFormData.productName || 'Producto',
                productSku: prod?.sku || 'SKU',
                quantity: returnFormData.quantity || 1,
                reason: returnFormData.reason as any || 'DEFECTIVE_PRODUCT',
                status: 'PENDING',
                resolution: 'PENDING_SUPPLIER',
                notes: returnFormData.notes || ''
              });
              setIsCreatingReturn(false);
            }} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Producto*:</label>
                <select
                  required
                  value={returnFormData.productId}
                  onChange={e => {
                    const p = (products || []).find(prod => prod?.id === e.target.value);
                    setReturnFormData({
                      ...returnFormData,
                      productId: e.target.value,
                      productName: p?.name,
                      productSku: p?.sku
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Cantidad a Devolver*:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={returnFormData.quantity}
                  onChange={e => setReturnFormData({ ...returnFormData, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Motivo*:</label>
                <select
                  value={returnFormData.reason}
                  onChange={e => setReturnFormData({ ...returnFormData, reason: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                >
                  <option value="DEFECTIVE_PRODUCT">Falla de fábrica / No enciende</option>
                  <option value="INCORRECT_ITEM">Modelo o color incorrecto</option>
                  <option value="CUSTOMER_RETURN">Devolución / Rechazo del cliente</option>
                  <option value="OTHER">Otro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Detalle de la falla:</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el desperfecto..."
                  value={returnFormData.notes}
                  onChange={e => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingReturn(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md"
                >
                  Registrar RMA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
