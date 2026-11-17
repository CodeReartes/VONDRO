import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  AlertTriangle, 
  Truck, 
  Users, 
  ArrowLeftRight,
  Boxes, 
  ShieldCheck, 
  Calendar,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ClipboardList,
  Home,
  Tag,
  Settings,
  Zap,
  CreditCard,
  Plus,
  X,
  ArrowUpRight,
  Crown,
  Clock,
  Check,
  RotateCcw
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { triggerHaptic } from '../../utils/native';
import { Product, Order } from '../../types';
import { 
  exportOrdersAccountingCSV, 
  exportLogisticsSettlementCSV, 
  exportTaxVentasCSV 
} from '../../utils/accountingExport';
import {
  getEffectiveMetricsResetMs,
  isOrderAfterMetricsBaseline,
  isPendingOrderStatus
} from '../../utils/metricsBaseline';

interface AdminOverviewTabProps {
  onSelectTab: (tab: any) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({ onSelectTab }) => {
  const { 
    products, 
    orders, 
    settings, 
    suppliers, 
    stockMovements, 
    notifications, 
    updateProduct,
    latestDailyAudit,
    fetchDailyStockAuditsList,
    resetAllSalesAndReviewsToZero
  } = useStore();

  useEffect(() => {
    if (!latestDailyAudit || (latestDailyAudit.totalProductsChecked || 0) < 100) {
      fetchDailyStockAuditsList().catch(() => {});
    }
  }, [latestDailyAudit?.totalProductsChecked, fetchDailyStockAuditsList]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isResettingMetrics, setIsResettingMetrics] = useState(false);
  const [replenishModalProduct, setReplenishModalProduct] = useState<Product | null>(null);
  const [replenishAmount, setReplenishAmount] = useState<number>(10);
  const [replenishSuccess, setReplenishSuccess] = useState(false);

  // Sanitized order number helper
  const formatOrderNum = (num: string | number | undefined) => {
    if (!num) return '#1001';
    const str = String(num);
    return str.startsWith('#') ? str : `#${str}`;
  };

  const metricsResetMs = useMemo(() => getEffectiveMetricsResetMs(settings), [settings?.metricsResetAt]);

  const activeMetricOrders = useMemo(
    () => orders.filter(o => isOrderAfterMetricsBaseline(o, metricsResetMs)),
    [orders, metricsResetMs]
  );

  // Single-pass critical stock count & preview slice
  const { criticalStockCount, criticalStockList, topSellingList } = useMemo(() => {
    let critCount = 0;
    const critPreview: Product[] = [];
    let top1: Product | null = null;
    let top2: Product | null = null;
    let top3: Product | null = null;
    let s1 = -1;
    let s2 = -1;
    let s3 = -1;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p) continue;
      if (p.stock <= (p.minimumStock || 3) || p.stockStatus === 'out_of_stock') {
        critCount++;
        if (critPreview.length < 4) critPreview.push(p);
      }
      const sales = p.unitsSold || p.salesCount || 0;
      if (sales > s1) {
        top3 = top2; s3 = s2;
        top2 = top1; s2 = s1;
        top1 = p; s1 = sales;
      } else if (sales > s2) {
        top3 = top2; s3 = s2;
        top2 = p; s2 = sales;
      } else if (sales > s3) {
        top3 = p; s3 = sales;
      }
    }

    const tops = [top1, top2, top3].filter((p): p is Product => Boolean(p));
    return {
      criticalStockCount: critCount,
      criticalStockList: critPreview,
      topSellingList: tops.map((prod, idx) => ({
        product: prod,
        rank: idx + 1,
        units: prod.unitsSold || prod.salesCount || 0,
        defaultName: prod.name
      }))
    };
  }, [products]);

  // KPI Calculations (strictly excludes cancelled orders and pre-reset historical test orders)
  const { todaySales, totalProfit, pendingOrdersCount } = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let calcTodaySales = 0;
    let calcProfit = 0;
    let pendingCount = 0;

    for (let i = 0; i < activeMetricOrders.length; i++) {
      const o = activeMetricOrders[i];
      const statusStr = String(o.status || '').toLowerCase();
      const isCancelled = statusStr === 'cancelled' || statusStr === 'cancelado';

      if (!isCancelled) {
        calcProfit += (o.total || 0) * 0.30;
        try {
          const d = new Date(o.createdAt).toISOString().split('T')[0];
          if (d === todayStr) calcTodaySales += (o.total || 0);
        } catch {}
      }
      if (isPendingOrderStatus(o.status)) {
        pendingCount++;
      }
    }

    return {
      todaySales: calcTodaySales,
      totalProfit: Math.round(calcProfit),
      pendingOrdersCount: pendingCount
    };
  }, [activeMetricOrders]);

  // Pending orders for "Pedidos para preparar"
  const ordersToPrepare = useMemo(() => {
    const list = activeMetricOrders.filter(o => 
      o.status === 'payment_received' || 
      o.status === 'pending_payment' || 
      o.status === 'preparing'
    );
    
    return list.slice(0, 5).map(o => ({
      id: o.id,
      orderNumber: String(o.orderNumber || '1001'),
      createdAt: o.createdAt,
      itemsCount: o.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1,
      total: o.total || 0,
      statusText: o.status === 'delivered' ? 'Listo' : o.status === 'preparing' ? 'En preparación' : 'Pendiente',
      statusType: o.status === 'delivered' ? 'ready' : o.status === 'preparing' ? 'preparing' : 'pending',
      image: o.items?.[0]?.image || products[0]?.images?.[0] || 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&q=80'
    }));
  }, [activeMetricOrders, products]);

  // Weekly sales bar chart data (Lun to Dom) based on active test/live orders
  const weeklySalesData = useMemo(() => {
    const days = [
      { key: 1, day: 'Lun' },
      { key: 2, day: 'Mar' },
      { key: 3, day: 'Mié' },
      { key: 4, day: 'Jue' },
      { key: 5, day: 'Vie' },
      { key: 6, day: 'Sáb' },
      { key: 0, day: 'Dom' },
    ];

    const dayTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    activeMetricOrders.forEach(o => {
      const s = String(o.status || '').toLowerCase();
      if (s === 'cancelled' || s === 'cancelado') return;
      try {
        const d = new Date(o.createdAt).getDay();
        dayTotals[d] = (dayTotals[d] || 0) + (o.total || 0);
      } catch (_) {}
    });

    const maxVal = Math.max(...Object.values(dayTotals), 1);
    return days.map(d => {
      const amt = dayTotals[d.key] || 0;
      const pct = amt > 0 ? Math.max(12, Math.round((amt / maxVal) * 100)) : 8;
      return {
        day: d.day,
        heightPct: pct,
        amount: `$${amt.toLocaleString('es-AR')}`
      };
    });
  }, [activeMetricOrders]);

  // Quick replenish handler
  const handleExecuteReplenish = async () => {
    if (!replenishModalProduct) return;
    try {
      triggerHaptic();
      const currentStock = replenishModalProduct.stock || 0;
      const newStock = currentStock + Number(replenishAmount);
      await updateProduct(replenishModalProduct.id, {
        stock: newStock,
        stockStatus: newStock > (replenishModalProduct.minimumStock || 3) ? 'available' : 'low_stock'
      });
      setReplenishSuccess(true);
      setTimeout(() => {
        setReplenishSuccess(false);
        setReplenishModalProduct(null);
      }, 1000);
    } catch (err) {
      console.error('Error replenishing stock:', err);
    }
  };

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();

    const matchedProducts = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.categoryId?.toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedOrders = orders.filter(o => 
      String(o.orderNumber).includes(q) || 
      o.customer?.fullName?.toLowerCase().includes(q) ||
      o.customer?.phone?.includes(q)
    ).slice(0, 4);

    return {
      products: matchedProducts,
      orders: matchedOrders
    };
  }, [searchQuery, products, orders]);

  return (
    <div className="space-y-4 pb-20 animate-fadeIn text-slate-100">
      {/* ========================================================================= */}
      {/* 0. ACCOUNTING & EXPORT TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-[#0e1626]/95 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Gestión Financiera y Fiscal VONDRO</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                Excel / CSV
              </span>
            </h3>
            <p className="text-xs text-slate-400">Descarga de libros contables, liquidación de cadetes y reportes para el contador</p>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isResettingMetrics}
            onClick={async () => {
              if (!window.confirm('¿Reiniciar Ganancia, Ventas hoy y Pedidos pendientes a 0 para comenzar pruebas limpias?')) return;
              triggerHaptic('medium');
              setIsResettingMetrics(true);
              try {
                await resetAllSalesAndReviewsToZero();
              } finally {
                setIsResettingMetrics(false);
              }
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/20 border border-slate-700 hover:border-rose-500/40 text-slate-200 hover:text-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Establecer ganancia y pedidos pendientes en 0 para pruebas"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResettingMetrics ? 'animate-spin' : ''}`} />
            <span>{isResettingMetrics ? 'Reiniciando...' : 'Reiniciar a $0'}</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setShowExportMenu(!showExportMenu);
            }}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Reportes Contables</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-90' : ''}`} />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 space-y-1 backdrop-blur-md animate-fadeIn">
              <button
                onClick={() => {
                  triggerHaptic();
                  exportOrdersAccountingCSV(orders, products);
                  setShowExportMenu(false);
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-purple-500/10 hover:border-purple-500/30 border border-transparent transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100 group-hover:text-purple-300">
                    📊 Ventas y Facturación Completa
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">.CSV</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Detalle de pedidos, clientes, montos, costos y márgenes brutos.
                </p>
              </button>

              <button
                onClick={() => {
                  triggerHaptic();
                  exportLogisticsSettlementCSV(orders);
                  setShowExportMenu(false);
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-500/30 border border-transparent transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100 group-hover:text-indigo-300">
                    🛵 Liquidación de Cadetería / Logística
                  </span>
                  <span className="text-[10px] text-indigo-400 font-mono">.CSV</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Desglose por zonas de Córdoba, PIN de entrega y efectivo a rendir.
                </p>
              </button>

              <button
                onClick={() => {
                  triggerHaptic();
                  exportTaxVentasCSV(orders);
                  setShowExportMenu(false);
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/30 border border-transparent transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100 group-hover:text-emerald-300">
                    📑 Libro IVA Ventas (Fiscal)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">.CSV</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Base imponible gravada al 21% e IVA débito fiscal para AFIP/Rentas.
                </p>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP 4 KPI CARDS (2x2 Grid) matching flyer design */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Ventas hoy */}
        <div className="bg-[#0e1626]/95 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-emerald-950/20 relative overflow-hidden group hover:border-emerald-500/60 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="text-emerald-400 font-bold text-[11px] sm:text-xs flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              +12%
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-medium text-slate-400 mt-2.5">Ventas hoy</p>
          <p className="text-lg sm:text-2xl font-black text-white tracking-tight mt-0.5">
            ${(todaySales ?? 0).toLocaleString('es-AR')}
          </p>
        </div>

        {/* Card 2: Ganancia */}
        <div className="bg-[#0e1626]/95 border border-purple-500/30 rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-purple-950/20 relative overflow-hidden group hover:border-purple-500/60 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="text-emerald-400 font-bold text-[11px] sm:text-xs flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              +18%
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-medium text-slate-400 mt-2.5">Ganancia</p>
          <p className="text-lg sm:text-2xl font-black text-white tracking-tight mt-0.5">
            ${(totalProfit ?? 0).toLocaleString('es-AR')}
          </p>
        </div>

        {/* Card 3: Pedidos pendientes */}
        <div 
          onClick={() => {
            triggerHaptic();
            onSelectTab('orders');
          }}
          className="bg-[#0e1626]/95 border border-amber-500/30 rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-amber-950/20 relative overflow-hidden group hover:border-amber-500/60 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Package className="w-4 h-4" />
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400" />
          </div>
          <p className="text-[11px] sm:text-xs font-medium text-slate-400 mt-2.5">Pedidos pendientes</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {pendingOrdersCount}
            </p>
          </div>
        </div>

        {/* Card 4: Stock crítico */}
        <div 
          onClick={() => {
            triggerHaptic();
            onSelectTab('stock');
          }}
          className="bg-[#0e1626]/95 border border-rose-500/30 rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-rose-950/20 relative overflow-hidden group hover:border-rose-500/60 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500" />
          </div>
          <p className="text-[11px] sm:text-xs font-medium text-slate-400 mt-2.5">Stock crítico</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {criticalStockCount}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DAILY STOCK AUDIT SUMMARY BANNER */}
      {/* ========================================================================= */}
      <div 
        onClick={() => {
          triggerHaptic();
          onSelectTab('stock-audit');
        }}
        className="bg-[#0e1626]/95 border border-slate-800/90 hover:border-blue-500/50 rounded-2xl p-3 sm:p-4 shadow-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                Auditoría Diaria de Stock
              </span>
              {latestDailyAudit && latestDailyAudit.outOfStockCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {latestDailyAudit.outOfStockCount} agotados
                </span>
              ) : null}
              {latestDailyAudit && latestDailyAudit.newProductsCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {latestDailyAudit.newProductsCount} nuevos
                </span>
              ) : null}
              {latestDailyAudit && latestDailyAudit.stockChangesCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {latestDailyAudit.stockChangesCount} cambios
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {latestDailyAudit ? (
                <>Análisis del día: <strong className="text-slate-300">{latestDailyAudit.date}</strong> ({latestDailyAudit.totalProductsChecked} productos auditados automáticamente)</>
              ) : (
                'Análisis diario activo: detecta nuevos ingresos, productos que se agotaron y cambios de stock.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-blue-600/20 group-hover:bg-blue-600 text-blue-300 group-hover:text-white border border-blue-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs">
            <span>Ver Reporte</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH BAR with Filter Icon */}
      {/* ========================================================================= */}
      <div className="relative">
        <div className="w-full bg-[#0d1424]/90 border border-slate-800/90 rounded-2xl p-2 sm:p-2.5 px-3.5 sm:px-4 flex items-center gap-2.5 shadow-md focus-within:border-purple-500/70 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos, pedidos, clientes..."
            className="w-full bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden"
          />
          {searchQuery ? (
            <button 
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800/60 transition-colors"
              title="Filtros rápidos"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {searchResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c1222]/98 border border-slate-700/80 rounded-2xl p-3 shadow-2xl z-40 backdrop-blur-xl max-h-80 overflow-y-auto divide-y divide-slate-800">
            {searchResults.products.length === 0 && searchResults.orders.length === 0 ? (
              <p className="text-center py-4 text-xs text-slate-400">
                No se encontraron resultados para &quot;{searchQuery}&quot;
              </p>
            ) : (
              <>
                {searchResults.products.length > 0 && (
                  <div className="pb-2 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400 px-2 py-1">
                      Productos ({searchResults.products.length})
                    </p>
                    {searchResults.products.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSearchQuery('');
                          onSelectTab('products');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img src={p.images[0]} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                          <div>
                            <p className="text-xs font-semibold text-white">{p.name}</p>
                            <p className="text-[10px] text-slate-400">Stock: {p.stock} • ${(p.salePrice ?? 0).toLocaleString('es-AR')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.orders.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-2 py-1">
                      Pedidos ({searchResults.orders.length})
                    </p>
                    {searchResults.orders.map(o => (
                      <div
                        key={o.id}
                        onClick={() => {
                          setSearchQuery('');
                          onSelectTab('orders');
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="text-xs font-semibold text-white">Pedido #{o.orderNumber}</p>
                          <p className="text-[10px] text-slate-400">{o.customer?.fullName || 'Cliente'} • ${(o.total ?? 0).toLocaleString('es-AR')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. ROW OF 4 QUICK SHORTCUTS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {/* Shortcut 1: Pedidos */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('orders');
          }}
          className="bg-purple-950/25 border border-purple-500/40 hover:border-purple-400 hover:bg-purple-900/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-center gap-1.5 text-xs font-bold text-purple-200 transition-all cursor-pointer shadow-sm shadow-purple-950/20"
        >
          <ClipboardList className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="truncate">Pedidos</span>
          <span className="text-[10px] text-purple-300 font-extrabold hidden sm:inline">({pendingOrdersCount})</span>
        </button>

        {/* Shortcut 2: Productos */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('products');
          }}
          className="bg-blue-950/25 border border-blue-500/40 hover:border-blue-400 hover:bg-blue-900/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-center gap-1.5 text-xs font-bold text-blue-200 transition-all cursor-pointer shadow-sm shadow-blue-950/20"
        >
          <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate">Productos</span>
        </button>

        {/* Shortcut 3: Stock */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('stock');
          }}
          className="bg-emerald-950/25 border border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-900/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-200 transition-all cursor-pointer shadow-sm shadow-emerald-950/20"
        >
          <Boxes className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">Stock</span>
        </button>

        {/* Shortcut 4: Transferencias */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('transfers');
          }}
          className="bg-sky-950/25 border border-sky-500/40 hover:border-sky-400 hover:bg-sky-900/30 rounded-xl p-2.5 sm:p-3 flex items-center justify-center gap-1.5 text-xs font-bold text-sky-200 transition-all cursor-pointer shadow-sm shadow-sky-950/20"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">Transf.</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. 10 MAIN NAVIGATION MODULES (2-Column Grid with Chevron >) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Module 1: Dashboard */}
        <div className="bg-purple-950/30 border border-purple-500/60 ring-1 ring-purple-500/30 rounded-xl p-3 sm:p-3.5 flex items-center justify-between shadow-md shadow-purple-950/30 transition-all">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Dashboard</p>
              <p className="text-[10px] text-purple-300 font-medium">Vista general</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-purple-400" />
        </div>

        {/* Module 2: Pedidos */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('orders');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-cyan-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Pedidos</p>
              <p className="text-[10px] text-slate-400">Gestionar</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 3: Catálogo */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('products');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-purple-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Catálogo</p>
              <p className="text-[10px] text-slate-400">Productos</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 4: Inventario */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('stock');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-amber-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Inventario</p>
              <p className="text-[10px] text-slate-400">Stock y depósitos</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 5: Proveedores */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('suppliers');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-sky-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Proveedores</p>
              <p className="text-[10px] text-slate-400">Compras</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 6: Envíos */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('logistics');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-blue-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Envíos</p>
              <p className="text-[10px] text-slate-400">Rastreo y despachos</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 7: Clientes */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('users');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-violet-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Clientes</p>
              <p className="text-[10px] text-slate-400">Gestión</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 8: Finanzas */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('transfers');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-emerald-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Finanzas</p>
              <p className="text-[10px] text-slate-400">Pagos y cobros</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 9: Promociones */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('flash-deals');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-pink-500/50 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Promociones</p>
              <p className="text-[10px] text-slate-400">Ofertas y descuentos</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        {/* Module 10: Configuración */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('settings');
          }}
          className="bg-[#0e1626]/90 border border-slate-800/90 hover:border-slate-600 hover:bg-slate-900 rounded-xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700/30 border border-slate-700 flex items-center justify-center text-slate-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-white leading-tight">Configuración</p>
              <p className="text-[10px] text-slate-400">Tienda y cuenta</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 5. PEDIDOS PARA PREPARAR SECTION */}
      {/* ========================================================================= */}
      <div className="bg-[#0d1424]/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-purple-400" />
            <h3 className="font-extrabold text-sm sm:text-base text-white">Pedidos para preparar</h3>
          </div>
          <button
            onClick={() => {
              triggerHaptic();
              onSelectTab('preparation');
            }}
            className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
          >
            <span>Ver todos</span>
            <span>→</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {ordersToPrepare.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#080d1a]/50 border border-dashed border-slate-800 text-center space-y-1">
              <p className="text-xs font-bold text-slate-300">No hay pedidos pendientes de preparación</p>
              <p className="text-[11px] text-slate-500">Los nuevos pedidos listos para empaquetar aparecerán aquí en tiempo real.</p>
            </div>
          ) : (
            ordersToPrepare.map((ord) => (
              <div
                key={ord.id}
                onClick={() => {
                  triggerHaptic();
                  onSelectTab('preparation');
                }}
                className="bg-[#080d1a]/85 border border-slate-800/80 hover:border-purple-500/50 rounded-xl p-3 flex items-center justify-between gap-3 transition-all cursor-pointer"
              >
                {/* Left Info */}
                <div className="min-w-0 flex items-center gap-3">
                  <img
                    src={ord.image}
                    alt="Producto"
                    className="w-11 h-11 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/60"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-white">{formatOrderNum(ord.orderNumber)}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ord.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{ord.itemsCount} productos</span>
                      <span className="text-xs font-extrabold text-white">${(ord.total ?? 0).toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                </div>

                {/* Right Status Badge & Chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                    ord.statusType === 'ready'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : ord.statusType === 'preparing'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  }`}>
                    {ord.statusType === 'ready' && <Check className="w-3 h-3" />}
                    {ord.statusText}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Big Gradient Action Button */}
        <button
          onClick={() => {
            triggerHaptic();
            onSelectTab('preparation');
          }}
          className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 transition-all cursor-pointer"
        >
          <Package className="w-4 h-4" />
          <span>Preparar pedidos ({ordersToPrepare.length})</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 6. SPLIT 2-COLUMN GRID (Stock Crítico + Ventas de la Semana) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Stock Crítico */}
        <div className="bg-[#0d1424]/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h3 className="font-extrabold text-sm sm:text-base text-white">Stock crítico</h3>
            </div>
            <button
              onClick={() => {
                triggerHaptic();
                onSelectTab('stock');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
            >
              <span>Ver todos</span>
              <span>→</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {criticalStockList.map((prod) => (
              <div
                key={prod.id}
                className="bg-[#080d1a]/85 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={prod.images[0]}
                    alt={prod.name}
                    className="w-11 h-11 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/60"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                      {prod.name}
                    </p>
                    <span className="mt-1 inline-block px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold">
                      {prod.stock} un.
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    triggerHaptic();
                    setReplenishModalProduct(prod);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[11px] shadow-sm shadow-purple-900/30 transition-all shrink-0 cursor-pointer"
                >
                  Reponer
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Ventas de la semana & Productos más vendidos */}
        <div id="admin-weekly-sales-card" className="bg-[#0d1424]/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="font-extrabold text-sm sm:text-base text-white">Ventas de la semana</h3>
            </div>
            <span className="text-emerald-400 text-xs font-extrabold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              +18%
            </span>
          </div>

          {/* Mini Bar Chart */}
          <div className="bg-[#080d1a]/85 border border-slate-800/80 rounded-xl p-3 pt-4">
            <div className="flex items-end justify-between h-24 gap-2 px-1">
              {weeklySalesData.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 bg-slate-900 text-[9px] font-bold text-purple-300 py-0.5 px-1.5 rounded border border-purple-500/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    {bar.amount}
                  </div>
                  {/* Bar */}
                  <div className="w-full bg-slate-800/50 rounded-t-md h-full flex items-end">
                    <div
                      style={{ height: `${bar.heightPct}%` }}
                      className="w-full rounded-t-md bg-gradient-to-t from-purple-700 via-purple-600 to-indigo-500 group-hover:brightness-125 transition-all shadow-xs"
                    />
                  </div>
                  {/* Label */}
                  <span className="text-[10px] font-semibold text-slate-400 group-hover:text-purple-300">
                    {bar.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sub-section: Productos más vendidos */}
          <div className="pt-2 border-t border-slate-800/80">
            <p className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5 mb-2.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Productos más vendidos</span>
            </p>

            <div className="space-y-2">
              {topSellingList.map((item) => (
                <div
                  key={item.rank}
                  className="flex items-center justify-between p-2 rounded-xl bg-[#080d1a]/60 border border-slate-800/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-black text-[10px] flex items-center justify-center shrink-0 border border-purple-500/30">
                      {item.rank}
                    </span>
                    <img
                      src={item.product?.images?.[0] || 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&q=80'}
                      alt="Producto"
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <p className="text-xs font-semibold text-slate-200 truncate max-w-[150px] sm:max-w-[200px]">
                      {item.product?.name || item.defaultName}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-amber-400 shrink-0">
                    {item.units} u.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. ACTIVIDAD RECIENTE SECTION */}
      {/* ========================================================================= */}
      <div className="bg-[#0d1424]/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-sm sm:text-base text-white">Actividad reciente</h3>
          </div>
          <button
            onClick={() => {
              triggerHaptic();
              onSelectTab('alerts');
            }}
            className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
          >
            <span>Ver todo</span>
            <span>→</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Card 1: Nuevo pedido */}
          <div className="bg-[#080d1a]/85 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Nuevo pedido {formatOrderNum(orders[0]?.orderNumber || '1025')}</p>
              <p className="text-[10px] text-slate-400">hace 5 min</p>
            </div>
          </div>

          {/* Card 2: Pago recibido */}
          <div className="bg-[#080d1a]/85 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Pago recibido</p>
              <p className="text-[10px] text-emerald-400 font-extrabold">${(orders[0]?.total || 48990).toLocaleString('es-AR')}</p>
            </div>
          </div>

          {/* Card 3: Stock actualizado */}
          <div className="bg-[#080d1a]/85 border border-slate-800/80 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Stock actualizado</p>
              <p className="text-[10px] text-slate-400">Productos: {products.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUICK REPLENISH MODAL */}
      {/* ========================================================================= */}
      {replenishModalProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Reponer Stock</h4>
              </div>
              <button
                onClick={() => setReplenishModalProduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={replenishModalProduct.images[0]}
                alt={replenishModalProduct.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div>
                <p className="text-xs font-bold text-white">{replenishModalProduct.name}</p>
                <p className="text-[11px] text-slate-400">Stock actual: <strong className="text-rose-400">{replenishModalProduct.stock}</strong> unidades</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Unidades a ingresar:
              </label>
              <div className="flex items-center gap-2 mb-2">
                {[5, 10, 20, 50].map((qty) => (
                  <button
                    key={qty}
                    onClick={() => setReplenishAmount(qty)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      replenishAmount === qty
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    +{qty}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                value={replenishAmount}
                onChange={(e) => setReplenishAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-hidden focus:border-purple-500"
              />
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => setReplenishModalProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteReplenish}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/40"
              >
                {replenishSuccess ? '✓ Actualizado!' : 'Confirmar Ingreso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
