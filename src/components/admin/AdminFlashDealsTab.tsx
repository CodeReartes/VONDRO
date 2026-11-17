import React, { useState } from 'react';
import { 
  Zap, 
  Clock, 
  RotateCcw, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Check, 
  Sparkles, 
  Search, 
  Flame, 
  Eye, 
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { useActiveFlashDealConfig, useFlashCountdown, rotateFlashDeals, saveFlashDealConfig } from '../../utils/flashDealTimer';
import { triggerHaptic } from '../../utils/native';

const AdminFlashCountdownText: React.FC = () => {
  const { formatted } = useFlashCountdown();
  return (
    <div className="font-mono text-xl sm:text-2xl font-black text-amber-400 tracking-wider">
      {formatted}
    </div>
  );
};

export const AdminFlashDealsTab: React.FC = () => {
  const { products } = useStore();
  const timer = useActiveFlashDealConfig(products);
  
  const [selectedAddActiveId, setSelectedAddActiveId] = useState<string>('');
  const [selectedAddNextId, setSelectedAddNextId] = useState<string>('');
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const activeProducts = products.filter(p => timer.activeProductIds.includes(p.id));
  const nextProducts = products.filter(p => timer.nextProductIds.includes(p.id));
  const availableForActive = products.filter(p => !timer.activeProductIds.includes(p.id));
  const availableForNext = products.filter(p => !timer.nextProductIds.includes(p.id));

  // Handler: Remove product from active batch
  const handleRemoveFromActive = (id: string) => {
    triggerHaptic('medium');
    const newActive = timer.activeProductIds.filter(pid => pid !== id);
    timer.updateConfig({ activeProductIds: newActive });
    showToast('Producto removido del lote activo');
  };

  // Handler: Remove product from next batch
  const handleRemoveFromNext = (id: string) => {
    triggerHaptic('medium');
    const newNext = timer.nextProductIds.filter(pid => pid !== id);
    timer.updateConfig({ nextProductIds: newNext });
    showToast('Producto removido del próximo lote');
  };

  // Handler: Add product to active batch
  const handleAddToActive = () => {
    if (!selectedAddActiveId) return;
    triggerHaptic('success');
    const newActive = Array.from(new Set([...timer.activeProductIds, selectedAddActiveId]));
    timer.updateConfig({ activeProductIds: newActive });
    setSelectedAddActiveId('');
    showToast('¡Producto agregado al lote de oferta actual!');
  };

  // Handler: Add product to next batch
  const handleAddToNext = () => {
    if (!selectedAddNextId) return;
    triggerHaptic('success');
    const newNext = Array.from(new Set([...timer.nextProductIds, selectedAddNextId]));
    timer.updateConfig({ nextProductIds: newNext });
    setSelectedAddNextId('');
    showToast('¡Producto agregado al próximo lote de ofertas!');
  };

  // Handler: Force rotation immediately
  const handleForceRotation = () => {
    triggerHaptic('heavy');
    rotateFlashDeals(products);
    showToast('⚡ ¡Lote rotado con éxito! El próximo lote ahora está activo.');
  };

  // Handler: Change duration
  const handleChangeDuration = (hours: number) => {
    triggerHaptic('light');
    const newEndTime = Date.now() + hours * 3600 * 1000;
    timer.updateConfig({ durationHours: hours, endTime: newEndTime });
    showToast(`Duración configurada a ${hours} horas`);
  };

  // Handler: Toggle auto-rotate
  const handleToggleAutoRotate = () => {
    triggerHaptic('medium');
    timer.updateConfig({ autoRotate: !timer.autoRotate });
    showToast(timer.autoRotate ? 'Rotación automática desactivada' : 'Rotación automática activada');
  };

  // Auto-fill next batch
  const handleAutoFillNext = () => {
    triggerHaptic('light');
    const candidates = products
      .filter(p => !timer.activeProductIds.includes(p.id))
      .sort(() => 0.5 - Math.random())
      .slice(0, 4)
      .map(p => p.id);
    timer.updateConfig({ nextProductIds: candidates });
    showToast('Próximo lote generado automáticamente');
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner with Live State */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-purple-500/30 rounded-2xl p-4 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg">
              <Zap className="w-7 h-7 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">
                  Gestor de Ofertas Relámpago y Lotes Rotativos
                </h2>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                  ROTACIÓN AUTOMÁTICA
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Controlá qué productos tienen descuento flash ahora y cuáles entrarán automáticamente al terminar el contador.
              </p>
            </div>
          </div>

          {/* Live Timer Counter Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center gap-4 shrink-0">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                Tiempo restante del lote
              </div>
              <AdminFlashCountdownText />
            </div>

            <button
              onClick={handleForceRotation}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rotar ahora</span>
            </button>
          </div>
        </div>

        {/* Global Controls & Cycle duration */}
        <div className="mt-5 pt-4 border-t border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold">Duración de cada ciclo:</span>
            <div className="flex gap-1">
              {[1, 2, 4, 6, 12, 24].map((hours) => (
                <button
                  key={hours}
                  onClick={() => handleChangeDuration(hours)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    timer.durationHours === hours
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={timer.autoRotate}
                onChange={handleToggleAutoRotate}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
              />
              <span className="text-slate-200 font-bold">
                Rotación automática al llegar a cero ({timer.autoRotate ? 'Activada' : 'Pausada'})
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Lote Actual vs Próximo Lote */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COL 1: Lote Actual (Ofertas Activas) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🔥 Lote Actual (En Vivo)</span>
                <span className="text-xs font-normal text-slate-400">({activeProducts.length} productos)</span>
              </h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
              Visibles en App
            </span>
          </div>

          {/* Add product to current batch */}
          <div className="flex gap-2">
            <select
              value={selectedAddActiveId}
              onChange={(e) => setSelectedAddActiveId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500"
            >
              <option value="">-- Seleccionar producto para agregar a Oferta Actual --</option>
              {availableForActive.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (ARS ${p.salePrice.toLocaleString('es-AR')})
                </option>
              ))}
            </select>
            <button
              onClick={handleAddToActive}
              disabled={!selectedAddActiveId}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                selectedAddActiveId 
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs' 
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>

          {/* Active Products List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {activeProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No hay productos en el lote actual. Seleccioná uno arriba para añadirlo.
              </div>
            ) : (
              activeProducts.map((p) => (
                <div 
                  key={p.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img 
                      src={p.images[0]} 
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0" 
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 truncate">{p.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="text-amber-400 font-extrabold">
                          ARS ${p.salePrice.toLocaleString('es-AR')}
                        </span>
                        {p.originalPrice && (
                          <span className="line-through">${p.originalPrice.toLocaleString('es-AR')}</span>
                        )}
                        {p.discountPercentage && (
                          <span className="bg-rose-500/20 text-rose-300 font-bold px-1 rounded">
                            -{p.discountPercentage}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFromActive(p.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
                    title="Quitar de este lote"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COL 2: Próximo Lote (En Cola para Rotación) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>⏱ Próximo Lote (En Espera)</span>
                <span className="text-xs font-normal text-slate-400">({nextProducts.length} productos)</span>
              </h3>
            </div>
            <button
              onClick={handleAutoFillNext}
              className="text-[11px] font-bold text-purple-400 hover:text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Generar al azar</span>
            </button>
          </div>

          {/* Add product to next batch */}
          <div className="flex gap-2">
            <select
              value={selectedAddNextId}
              onChange={(e) => setSelectedAddNextId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500"
            >
              <option value="">-- Elegir producto para el PRÓXIMO turno --</option>
              {availableForNext.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (ARS ${p.salePrice.toLocaleString('es-AR')})
                </option>
              ))}
            </select>
            <button
              onClick={handleAddToNext}
              disabled={!selectedAddNextId}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                selectedAddNextId 
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-600 shadow-xs' 
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Encolar</span>
            </button>
          </div>

          {/* Next Products List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {nextProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No hay productos en cola. Podés seleccionarlos o hacer clic en "Generar al azar".
              </div>
            ) : (
              nextProducts.map((p) => (
                <div 
                  key={p.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img 
                      src={p.images[0]} 
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0" 
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 truncate">{p.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="text-amber-400 font-extrabold">
                          ARS ${p.salePrice.toLocaleString('es-AR')}
                        </span>
                        {p.originalPrice && (
                          <span className="line-through">${p.originalPrice.toLocaleString('es-AR')}</span>
                        )}
                        {p.discountPercentage && (
                          <span className="bg-amber-500/20 text-amber-300 font-bold px-1 rounded">
                            -{p.discountPercentage}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFromNext(p.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
                    title="Quitar de la cola"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Information Box */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h5 className="font-bold text-slate-200">¿Cómo funciona la rotación de Ofertas Relámpago?</h5>
          <p>
            El reloj de cuenta regresiva es sincronizado y persistente en toda la app (Inicio, Búsqueda, Favoritos, Carrito). Cuando el temporizador llega a cero (00:00:00), el sistema promueve automáticamente el <strong>Próximo Lote</strong> a <strong>Lote Actual</strong> y el reloj vuelve a comenzar por la cantidad de horas elegida.
          </p>
        </div>
      </div>
    </div>
  );
};
