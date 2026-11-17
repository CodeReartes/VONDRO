import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  DollarSign, 
  Truck, 
  Save, 
  X, 
  RotateCcw,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Sparkles,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product, StockMovement, StockStatus } from '../../types';
import { triggerHaptic } from '../../utils/native';
import { getOptimizedThumbnail, decodeHtmlEntities } from '../../utils/imageOptimizer';
import { AdminStockAuditTab } from './AdminStockAuditTab';

export const AdminStockTab: React.FC = () => {
  const { 
    products, 
    stockMovements, 
    suppliers, 
    replenishStock, 
    adjustStock, 
    updateProduct,
    latestDailyAudit
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'ledger' | 'daily-audit'>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'available' | 'low_stock' | 'out_of_stock'>('ALL');
  const [renderLimit, setRenderLimit] = useState(40);
  
  // Replenish Modal State
  const [replenishProduct, setReplenishProduct] = useState<Product | null>(null);
  const [replenishQty, setReplenishQty] = useState<number>(10);
  const [replenishCost, setReplenishCost] = useState<number>(0);
  const [replenishSupplierId, setReplenishSupplierId] = useState<string>('');
  const [replenishNotes, setReplenishNotes] = useState<string>('');
  const [isSubmittingReplenish, setIsSubmittingReplenish] = useState(false);

  // Manual Adjust Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustTargetStock, setAdjustTargetStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Ajuste de inventario físico');

  // Calculations memoized
  const { totalStockUnits, totalCostValuation, totalSaleValuation } = useMemo(() => {
    let units = 0;
    let cost = 0;
    let sale = 0;
    for (const p of products) {
      if (!p) continue;
      const st = p.stock || 0;
      units += st;
      cost += st * (p.costPrice || 0);
      sale += st * (p.salePrice || 0);
    }
    return { totalStockUnits: units, totalCostValuation: cost, totalSaleValuation: sale };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    return products.filter(p => {
      if (!p) return false;
      const matchesSearch = !s ||
        p.name.toLowerCase().includes(s) || 
        (p.sku && p.sku.toLowerCase().includes(s));

      if (!matchesSearch) return false;

      const minStock = p.minimumStock || 3;
      const isOut = p.stock === 0 || p.stockStatus === 'out_of_stock';
      const isLow = p.stock > 0 && p.stock <= minStock;
      const isGood = p.stock > minStock;

      if (statusFilter === 'out_of_stock') return isOut;
      if (statusFilter === 'low_stock') return isLow;
      if (statusFilter === 'available') return isGood;
      return true;
    });
  }, [products, searchTerm, statusFilter]);

  const paginatedInventory = useMemo(() => {
    return filteredProducts.slice(0, renderLimit);
  }, [filteredProducts, renderLimit]);

  const handleOpenReplenish = (product: Product) => {
    triggerHaptic();
    setReplenishProduct(product);
    setReplenishQty(10);
    setReplenishCost(product.costPrice || 0);
    setReplenishSupplierId(product.supplierId || suppliers[0]?.id || '');
    setReplenishNotes(`Ingreso de mercadería (${product.name})`);
  };

  const handleConfirmReplenish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishProduct || replenishQty <= 0) return;
    setIsSubmittingReplenish(true);
    triggerHaptic();

    try {
      await replenishStock(
        replenishProduct.id,
        replenishQty,
        replenishCost > 0 ? replenishCost : undefined,
        replenishSupplierId || undefined,
        replenishNotes
      );
      setReplenishProduct(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingReplenish(false);
    }
  };

  // Size-specific adjustments state
  const [sizeStockAdjustments, setSizeStockAdjustments] = useState<{ id: string; name: string; stock: number; inStock: boolean }[]>([]);

  const handleOpenAdjust = (product: Product) => {
    triggerHaptic();
    setAdjustingProduct(product);
    setAdjustTargetStock(product.stock || 0);
    setAdjustReason('Conteo físico de depósito');
    if (product.sizes && product.sizes.length > 0) {
      setSizeStockAdjustments(
        product.sizes.map(s => ({
          id: s.id,
          name: s.name,
          stock: s.stock !== undefined ? s.stock : (s.inStock === false ? 0 : product.stock || 0),
          inStock: s.inStock !== false && (s.stock === undefined || s.stock > 0)
        }))
      );
    } else {
      setSizeStockAdjustments([]);
    }
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    triggerHaptic();

    if (adjustingProduct.sizes && adjustingProduct.sizes.length > 0 && sizeStockAdjustments.length > 0) {
      const updatedSizes = adjustingProduct.sizes.map(s => {
        const match = sizeStockAdjustments.find(adj => adj.id === s.id);
        if (match) {
          return {
            ...s,
            stock: match.stock,
            inStock: match.stock > 0 && match.inStock
          };
        }
        return s;
      });
      const totalSizeStock = sizeStockAdjustments.reduce((acc, curr) => acc + (curr.inStock ? curr.stock : 0), 0);
      
      await updateProduct(adjustingProduct.id, {
        sizes: updatedSizes,
        stock: totalSizeStock,
        stockStatus: totalSizeStock === 0 ? 'out_of_stock' : totalSizeStock <= 5 ? 'low_stock' : 'available'
      });
      await adjustStock(adjustingProduct.id, totalSizeStock, `${adjustReason} (Ajuste por tamaños/variantes)`);
    } else {
      await adjustStock(adjustingProduct.id, adjustTargetStock, adjustReason);
    }
    setAdjustingProduct(null);
  };

  return (
    <div className="space-y-6">
      {/* Header and Sub-Tab Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-purple-400" />
              Gestión Inteligente de Inventario
            </span>
            <span className="text-xs text-slate-400">• {products.length} productos registrados</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Control de Stock y Trazabilidad</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Ingreso de mercadería con proveedores, ajustes manuales y libro mayor de movimientos.
          </p>
        </div>

        {/* SubTab Toggle */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            id="stock-subtab-daily-audit"
            onClick={() => {
              triggerHaptic();
              setActiveSubTab('daily-audit');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'daily-audit' 
                ? 'bg-blue-600 text-white shadow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Auditoría Diaria</span>
            {latestDailyAudit && latestDailyAudit.outOfStockCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
            )}
          </button>
          <button
            id="stock-subtab-inventory"
            onClick={() => {
              triggerHaptic();
              setActiveSubTab('inventory');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'inventory' 
                ? 'bg-purple-600 text-white shadow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inventario ({products.length})
          </button>
          <button
            id="stock-subtab-ledger"
            onClick={() => {
              triggerHaptic();
              setActiveSubTab('ledger');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSubTab === 'ledger' 
                ? 'bg-purple-600 text-white shadow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Libro de Movimientos</span>
          </button>
        </div>
      </div>

      {/* Financial Valuation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow">
          <span className="text-xs font-medium text-slate-400">Total Unidades Físicas</span>
          <h4 className="text-xl font-bold text-white mt-1">{totalStockUnits.toLocaleString('es-AR')} un.</h4>
          <p className="text-[11px] text-purple-400 mt-0.5">Disponibles en depósito Córdoba</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow">
          <span className="text-xs font-medium text-slate-400">Valoración al Costo</span>
          <h4 className="text-xl font-bold text-white mt-1">${(totalCostValuation ?? 0).toLocaleString('es-AR')}</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Capital invertido en mercadería</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow">
          <span className="text-xs font-medium text-slate-400">Valoración al Precio de Venta</span>
          <h4 className="text-xl font-bold text-emerald-400 mt-1">${(totalSaleValuation ?? 0).toLocaleString('es-AR')}</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Potencial bruto de facturación</p>
        </div>
      </div>

      {activeSubTab === 'daily-audit' ? (
        <AdminStockAuditTab />
      ) : activeSubTab === 'inventory' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'ALL' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Todos ({products.length})
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'available' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                En Stock
              </button>
              <button
                onClick={() => setStatusFilter('low_stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'low_stock' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Stock Bajo
              </button>
              <button
                onClick={() => setStatusFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === 'out_of_stock' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Agotados
              </button>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Proveedor</th>
                  <th className="py-3 px-3">Costo / Venta</th>
                  <th className="py-3 px-3 text-center">Mínimo</th>
                  <th className="py-3 px-3 text-center">Stock Actual</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      No se encontraron productos coincidentes.
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map(prod => {
                    const minStock = prod.minimumStock || 3;
                    const isOut = prod.stock === 0 || prod.stockStatus === 'out_of_stock';
                    const isLow = prod.stock > 0 && prod.stock <= minStock;
                    const supplierObj = (suppliers || []).find(s => s?.id === prod?.supplierId);

                    return (
                      <tr key={prod.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2.5">
                            <img 
                              src={getOptimizedThumbnail(prod.images?.[0] || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=100', 100, 60)} 
                              alt={prod.name}
                              loading="lazy"
                              decoding="async"
                              className="w-9 h-9 rounded-lg object-cover bg-slate-800 shrink-0"
                            />
                            <div>
                              <p className="font-semibold text-slate-200 line-clamp-1">{decodeHtmlEntities(prod.name)}</p>
                              <span className="text-[10px] text-slate-400 capitalize">{prod.categoryId}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                          {prod.sku || 'S/N'}
                        </td>

                        <td className="py-3 px-3 text-slate-300">
                          {supplierObj?.name || prod.supplier || 'Inova ARG'}
                        </td>

                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-200">${(prod.salePrice ?? 0).toLocaleString('es-AR')}</p>
                          <span className="text-[10px] text-slate-400">Costo: ${prod.costPrice ? prod.costPrice.toLocaleString('es-AR') : '0'}</span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={prod.minimumStock || 3}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              updateProduct(prod.id, { minimumStock: val });
                            }}
                            className="w-12 py-1 px-1.5 text-center bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:border-purple-500 focus:outline-none"
                            title="Umbral de alerta mínima"
                          />
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block font-mono text-sm font-bold px-2 py-0.5 rounded ${
                            isOut ? 'bg-rose-500/20 text-rose-300' :
                            isLow ? 'bg-amber-500/20 text-amber-300' :
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {prod.stock}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isOut ? 'bg-rose-500/20 text-rose-300' :
                            isLow ? 'bg-amber-500/20 text-amber-300' :
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {isOut ? 'Agotado' : isLow ? 'Stock Bajo' : 'Óptimo'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleOpenReplenish(prod)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white font-medium transition-colors flex items-center space-x-1"
                              title="Ingresar compra de mercadería"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Reponer</span>
                            </button>

                            <button
                              onClick={() => handleOpenAdjust(prod)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Ajuste manual directo"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {paginatedInventory.length < filteredProducts.length && (
            <div className="pt-3 pb-1 text-center border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRenderLimit(prev => prev + 50)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5"
              >
                <span>Cargar más ({paginatedInventory.length} de {filteredProducts.length} productos)</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Stock Ledger Tab */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-semibold text-sm text-slate-100">Libro Mayor de Movimientos de Inventario</h3>
              <p className="text-xs text-slate-400">Historial inmutable de compras, ventas, cancelaciones y ajustes.</p>
            </div>
            <span className="text-xs text-purple-400 font-semibold">{stockMovements.length} movimientos registrados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3">Fecha & Hora</th>
                  <th className="py-3 px-3">Producto</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3 text-center">Variación</th>
                  <th className="py-3 px-3 text-center">Stock Anterior → Nuevo</th>
                  <th className="py-3 px-3">Motivo / Factura</th>
                  <th className="py-3 px-3">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No hay movimientos de stock registrados todavía.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map(mov => (
                    <tr key={mov.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(mov.createdAt).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="py-3 px-3 font-semibold text-slate-200">
                        {mov.productName}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          mov.type === 'PURCHASE' ? 'bg-emerald-500/20 text-emerald-300' :
                          mov.type === 'SALE' ? 'bg-blue-500/20 text-blue-300' :
                          mov.type === 'CANCELLATION' || mov.type === 'RETURN' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {mov.type === 'PURCHASE' ? 'Compra / Ingreso' :
                           mov.type === 'SALE' ? 'Venta Despachada' :
                           mov.type === 'CANCELLATION' ? 'Reintegro Cancelación' :
                           mov.type === 'RETURN' ? 'Devolución Cliente' : 'Ajuste Manual'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold">
                        <span className={mov.quantity > 0 ? 'text-emerald-400' : mov.quantity < 0 ? 'text-rose-400' : 'text-slate-400'}>
                          {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                        {mov.previousStock} → <span className="font-bold text-slate-200">{mov.newStock}</span>
                      </td>

                      <td className="py-3 px-3 text-slate-300">
                        {mov.reason}
                      </td>

                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {mov.adminId}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPLENISH MODAL */}
      {replenishProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base text-white">Ingreso de Mercadería</h3>
              </div>
              <button 
                onClick={() => setReplenishProduct(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400">Producto seleccionado:</p>
              <h4 className="font-semibold text-slate-100 mt-0.5">{replenishProduct.name}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Stock actual: <span className="font-bold text-purple-400">{replenishProduct.stock} unidades</span></p>
            </div>

            <form onSubmit={handleConfirmReplenish} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cantidad a ingresar (unidades)*:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={replenishQty}
                  onChange={e => setReplenishQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                />
                <p className="text-[10px] text-emerald-400 mt-1">
                  Nuevo stock final resultante: {(replenishProduct.stock || 0) + replenishQty} un.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Precio de costo unitario ($ ARS):
                </label>
                <input
                  type="number"
                  min="0"
                  value={replenishCost}
                  onChange={e => setReplenishCost(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Proveedor Mayorista:
                </label>
                <select
                  value={replenishSupplierId}
                  onChange={e => setReplenishSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.location || 'Córdoba'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Comprobante / Notas internas:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Factura A-0004-9821 / Lote CBA-2026"
                  value={replenishNotes}
                  onChange={e => setReplenishNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setReplenishProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReplenish}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  {isSubmittingReplenish ? 'Guardando...' : 'Confirmar Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Ajuste Manual de Inventario</h3>
              </div>
              <button 
                onClick={() => setAdjustingProduct(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400">Producto:</p>
              <h4 className="font-semibold text-slate-100 mt-0.5">{adjustingProduct.name}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Stock en sistema: <span className="font-bold text-slate-200">{adjustingProduct.stock}</span></p>
            </div>

            <form onSubmit={handleConfirmAdjust} className="space-y-3.5">
              {sizeStockAdjustments.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">
                      Disponibilidad y Stock por Tamaño:
                    </label>
                    <span className="text-[11px] text-purple-400 font-mono">
                      Total: {sizeStockAdjustments.reduce((acc, curr) => acc + (curr.inStock ? curr.stock : 0), 0)} un.
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {sizeStockAdjustments.map((sizeItem, idx) => (
                      <div key={sizeItem.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">{sizeItem.name}</span>
                          <span className={`text-[10px] font-semibold ${sizeItem.stock > 0 && sizeItem.inStock ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {sizeItem.stock > 0 && sizeItem.inStock ? `${sizeItem.stock} disponibles` : 'Sin existencias (Agotado)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={sizeItem.stock}
                            onChange={(e) => {
                              const newStock = Math.max(0, parseInt(e.target.value) || 0);
                              setSizeStockAdjustments(prev => prev.map((item, i) => i === idx ? { ...item, stock: newStock, inStock: newStock > 0 } : item));
                            }}
                            className="w-20 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs text-right focus:border-purple-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSizeStockAdjustments(prev => prev.map((item, i) => i === idx ? { ...item, inStock: !item.inStock, stock: !item.inStock && item.stock === 0 ? 10 : item.stock } : item));
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              sizeItem.inStock && sizeItem.stock > 0
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {sizeItem.inStock && sizeItem.stock > 0 ? 'Disponible' : 'Agotado'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nuevo Stock Físico Real:
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={adjustTargetStock}
                    onChange={e => setAdjustTargetStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo del ajuste:
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
