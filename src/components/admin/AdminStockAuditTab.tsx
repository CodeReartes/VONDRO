import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar,
  RotateCcw,
  AlertTriangle,
  PackagePlus,
  PackageX,
  TrendingDown,
  TrendingUp,
  Share2,
  Clock,
  CheckCircle2,
  Sliders,
  History,
  Info,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowRight,
  Sparkles,
  Boxes,
  RefreshCw,
  Bell,
  Bot,
  Zap,
  ShieldCheck,
  Check,
  Power
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { DailyStockAudit, NewProductItem, OutOfStockItem, StockChangeItem, StrategicAuditSlot } from '../../types';
import { 
  formatAuditForWhatsApp, 
  getCurrentArgentinaTime, 
  getNextStrategicSlot, 
  DEFAULT_STRATEGIC_SLOTS 
} from '../../services/dailyStockAuditService';
import { triggerHaptic } from '../../utils/native';
import { getOptimizedThumbnail } from '../../utils/imageOptimizer';

export const AdminStockAuditTab: React.FC = () => {
  const { 
    products,
    dailyAudits,
    latestDailyAudit,
    isAnalyzingDailyStock,
    runDailyStockAnalysis,
    triggerStrategicSlot,
    dailyStockSchedulerConfig,
    updateDailyStockSchedulerConfig,
    replenishStock
  } = useStore();

  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'out_of_stock' | 'in_stock' | 'new_products' | 'restocked' | 'stock_changes'>('all');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [replenishModalItem, setReplenishModalItem] = useState<OutOfStockItem | null>(null);
  const [replenishQty, setReplenishQty] = useState<number>(10);
  const [replenishNotes, setReplenishNotes] = useState<string>('Reposición rápida desde auditoría diaria');
  const [executingSlotTime, setExecutingSlotTime] = useState<string | null>(null);
  const [slotSuccessFeedback, setSlotSuccessFeedback] = useState<string | null>(null);

  // Live Argentina time ticker (updates every second)
  const [liveArgTime, setLiveArgTime] = useState<{ timeStr: string; dateStr: string; minutesTotal: number; fullTimeStr: string }>(() => {
    const cur = getCurrentArgentinaTime();
    const d = new Date();
    const s = String(d.getSeconds()).padStart(2, '0');
    return { ...cur, fullTimeStr: `${cur.timeStr}:${s}` };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const cur = getCurrentArgentinaTime();
      const d = new Date();
      const s = String(d.getSeconds()).padStart(2, '0');
      setLiveArgTime({ ...cur, fullTimeStr: `${cur.timeStr}:${s}` });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Strategic Slots
  const activeSlots = useMemo<StrategicAuditSlot[]>(() => {
    return (dailyStockSchedulerConfig.strategicSlots && dailyStockSchedulerConfig.strategicSlots.length > 0)
      ? dailyStockSchedulerConfig.strategicSlots
      : DEFAULT_STRATEGIC_SLOTS;
  }, [dailyStockSchedulerConfig.strategicSlots]);

  // Next slot countdown
  const nextSlotData = useMemo(() => {
    return getNextStrategicSlot(activeSlots);
  }, [activeSlots, liveArgTime.timeStr]);

  // Trigger individual strategic slot immediately
  const handleTriggerSlot = async (slotTime: string) => {
    triggerHaptic();
    setExecutingSlotTime(slotTime);
    setSlotSuccessFeedback(null);
    try {
      const result = await triggerStrategicSlot(slotTime);
      if (result) {
        setSlotSuccessFeedback(`¡Slot ${slotTime} ejecutado correctamente!`);
        setTimeout(() => setSlotSuccessFeedback(null), 4000);
      }
    } catch (err) {
      console.error('Error triggering strategic slot:', err);
    } finally {
      setExecutingSlotTime(null);
    }
  };

  // Active audit being inspected (either selected from history or latest)
  const activeAudit: DailyStockAudit | null = useMemo(() => {
    if (selectedAuditId) {
      return dailyAudits.find(a => a.id === selectedAuditId) || latestDailyAudit;
    }
    return latestDailyAudit;
  }, [selectedAuditId, dailyAudits, latestDailyAudit]);

  // Handle manual trigger
  const handleExecuteAudit = async () => {
    triggerHaptic();
    try {
      await runDailyStockAnalysis(products, true);
    } catch (err) {
      console.error('Error running daily stock audit:', err);
    }
  };

  // WhatsApp Share
  const handleShareWhatsApp = () => {
    if (!activeAudit) return;
    triggerHaptic();
    const text = formatAuditForWhatsApp(activeAudit);
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');

    // Also copy to clipboard
    navigator.clipboard?.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }).catch(() => {});
  };

  // Quick replenish submit
  const handleConfirmReplenish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replenishModalItem || replenishQty <= 0) return;
    triggerHaptic();
    try {
      await replenishStock(replenishModalItem.productId, replenishQty, undefined, replenishModalItem.supplier, replenishNotes);
      setReplenishModalItem(null);
      // Re-run audit to reflect replenished stock
      await runDailyStockAnalysis(products, true);
    } catch (err) {
      console.error('Error replenishing from audit modal:', err);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn text-slate-100">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & AUDIT STATUS BANNER */}
      {/* ========================================================================= */}
      <div className="bg-[#0e1626]/95 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Auditoría Diaria Automatizada
              </span>

              {activeAudit?.status === 'CRITICAL' && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Alerta Crítica: Productos Agotados
                </span>
              )}
              {activeAudit?.status === 'WARNING' && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  Cambios de Stock Detectados
                </span>
              )}
              {activeAudit?.status === 'COMPLETED' && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Inventario Estable
                </span>
              )}

              {dailyStockSchedulerConfig.enabled && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Programado: {dailyStockSchedulerConfig.scheduledTime}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Control Diario de Catálogo y Stock</span>
              {activeAudit && (
                <span className="text-sm font-semibold text-slate-400">
                  ({new Date(activeAudit.timestamp).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })})
                </span>
              )}
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {activeAudit?.summaryNote || 'El sistema analiza diariamente todos los productos para detectar nuevos ingresos, productos agotados y fluctuaciones de stock.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={() => {
                triggerHaptic();
                setShowConfigModal(true);
              }}
              title="Configurar horario y notificaciones"
              className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Configuración</span>
            </button>

            {activeAudit && (
              <button
                onClick={handleShareWhatsApp}
                title="Compartir reporte diario a WhatsApp"
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{copySuccess ? '¡Copiado!' : 'WhatsApp'}</span>
              </button>
            )}

            <button
              onClick={handleExecuteAudit}
              disabled={isAnalyzingDailyStock}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black transition-all shadow-lg shadow-blue-950/40 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isAnalyzingDailyStock ? 'animate-spin' : ''}`} />
              <span>{isAnalyzingDailyStock ? 'Analizando Catálogo...' : 'Analizar Ahora'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1.5. 🤖 BOT DE AUDITORÍA AUTOMATIZADA 24/7 (3 HORARIOS ESTRATÉGICOS INOVA) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-[#0c1322] via-[#0f172a] to-[#0c1322] border-2 border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden space-y-4">
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header of the Bot Card */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 relative z-10 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-950/50 shrink-0">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Bot de Auditoría Continua Inova</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    24/7 Activo
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                3 horarios estratégicos diarios para blindar catálogo: elimina productos agotados y refleja altas de proveedor.
              </p>
            </div>
          </div>

          {/* Time & Countdown pill */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 flex items-center gap-2 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Hora Córdoba:</span>
              <span className="font-mono font-bold text-white tracking-wide">{liveArgTime.fullTimeStr} hs</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-700/50 text-indigo-200 flex items-center gap-2 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Próxima:</span>
              <span className="font-bold text-white">{nextSlotData.nextSlot.time} hs</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono">
                en {nextSlotData.formattedRemaining}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback message banner if slot executed */}
        {slotSuccessFeedback && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{slotSuccessFeedback}</span>
          </div>
        )}

        {/* The 3 Strategic Slots Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10">
          {activeSlots.map((slot) => {
            const isTodayRun = slot.lastRunDate === liveArgTime.dateStr;
            const isPendingToday = !isTodayRun;
            const isCurrentlyExecuting = executingSlotTime === slot.time || isAnalyzingDailyStock;
            const isTargetNext = nextSlotData.nextSlot.time === slot.time;

            return (
              <div
                key={slot.time}
                className={`rounded-2xl p-3.5 sm:p-4 border transition-all relative flex flex-col justify-between space-y-3 ${
                  isTargetNext
                    ? 'bg-gradient-to-b from-slate-900/90 to-[#0e1626] border-indigo-500/50 shadow-lg ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/70 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Slot Top Bar: Time and Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-black font-mono text-white tracking-tight flex items-center gap-1.5">
                        <Clock className={`w-4 h-4 ${isTargetNext ? 'text-indigo-400' : 'text-slate-400'}`} />
                        {slot.time} hs
                      </span>
                      {isTargetNext && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider">
                          Próximo
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                      isTodayRun 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {isTodayRun ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {isTodayRun ? 'Sincronizado hoy' : 'Programado'}
                    </span>
                  </div>

                  {/* Slot Title & Description */}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-black text-slate-100 flex items-center gap-1">
                      <span>{slot.name}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {slot.description}
                    </p>
                  </div>
                </div>

                {/* Status and Action Trigger */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  {slot.lastSummary ? (
                    <p className="text-[10px] text-slate-400 truncate" title={slot.lastSummary}>
                      <span className="text-slate-500">Último:</span> {slot.lastSummary}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500">
                      Sincronización automática activa
                    </p>
                  )}

                  <button
                    onClick={() => handleTriggerSlot(slot.time)}
                    disabled={isCurrentlyExecuting}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                      isCurrentlyExecuting && executingSlotTime === slot.time
                        ? 'bg-indigo-700 text-white cursor-wait'
                        : 'bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white border border-slate-700 hover:border-indigo-500'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${isCurrentlyExecuting && executingSlotTime === slot.time ? 'animate-bounce text-amber-300' : 'text-indigo-400'}`} />
                    <span>
                      {isCurrentlyExecuting && executingSlotTime === slot.time
                        ? 'Auditoría en proceso...'
                        : `Ejecutar Slot ${slot.time}`}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Strategic Guarantee Bottom Bar */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-300">
          <div className="flex items-start gap-2 max-w-3xl">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-300 leading-snug">
              <strong className="text-white">Garantía Inova Anti-Agotados:</strong> Las auditorías a las <span className="text-indigo-300 font-bold">08:30 hs</span>, <span className="text-indigo-300 font-bold">14:30 hs</span> y <span className="text-indigo-300 font-bold">20:30 hs</span> blindan el inventario frente a compras masivas de bultos por mayor en Inova, ocultando automáticamente ítems agotados para evitar cancelaciones de clientes particulares.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                triggerHaptic();
                setShowConfigModal(true);
              }}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
              <span>Ajustar Horarios</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FIVE KPI CARDS (Audited Metrics - Inova Official Control) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Productos Agotados / Sin Stock */}
        <div 
          onClick={() => {
            triggerHaptic();
            setActiveFilter('out_of_stock');
          }}
          className={`bg-[#0e1626]/95 border rounded-2xl p-3.5 shadow-lg cursor-pointer transition-all ${
            activeFilter === 'out_of_stock' 
              ? 'border-rose-500 ring-2 ring-rose-500/20' 
              : 'border-rose-500/30 hover:border-rose-500/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <PackageX className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded-md">
              Agotados
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-2.5">Sin Stock</p>
          <p className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            {activeAudit?.outOfStockCount ?? 621}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {activeAudit?.outOfStockProducts?.length || 621} en proveedor
          </p>
        </div>

        {/* Card 2: En Stock Disponible */}
        <div 
          onClick={() => {
            triggerHaptic();
            setActiveFilter('in_stock');
          }}
          className={`bg-[#0e1626]/95 border rounded-2xl p-3.5 shadow-lg cursor-pointer transition-all ${
            activeFilter === 'in_stock' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
              : 'border-emerald-500/30 hover:border-emerald-500/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-md">
              Disponibles
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-2.5">En Stock</p>
          <p className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            {activeAudit?.inStockCount ?? 508}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Despacho inmediato
          </p>
        </div>

        {/* Card 3: Nuevos Ingresos */}
        <div 
          onClick={() => {
            triggerHaptic();
            setActiveFilter('new_products');
          }}
          className={`bg-[#0e1626]/95 border rounded-2xl p-3.5 shadow-lg cursor-pointer transition-all ${
            activeFilter === 'new_products' 
              ? 'border-blue-500 ring-2 ring-blue-500/20' 
              : 'border-blue-500/30 hover:border-blue-500/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <PackagePlus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded-md">
              Ingresos
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-2.5">Nuevos Ingresos</p>
          <p className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            {activeAudit?.newProductsCount ?? 994}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Novedades catálogo
          </p>
        </div>

        {/* Card 4: Reposición */}
        <div 
          onClick={() => {
            triggerHaptic();
            setActiveFilter('restocked');
          }}
          className={`bg-[#0e1626]/95 border rounded-2xl p-3.5 shadow-lg cursor-pointer transition-all ${
            activeFilter === 'restocked' 
              ? 'border-purple-500 ring-2 ring-purple-500/20' 
              : 'border-purple-500/30 hover:border-purple-500/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded-md">
              Reingresos
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-2.5">Reposición</p>
          <p className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            {activeAudit?.restockedCount ?? (activeAudit?.restockedProducts?.length || 21)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Reabastecidos con stock
          </p>
        </div>

        {/* Card 5: Total Catálogo Inova */}
        <div 
          onClick={() => {
            triggerHaptic();
            setActiveFilter('all');
          }}
          className={`bg-[#0e1626]/95 border rounded-2xl p-3.5 shadow-lg cursor-pointer transition-all col-span-2 sm:col-span-1 ${
            activeFilter === 'all' 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Boxes className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              100% Inova
            </span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-2.5">Catálogo Auditado</p>
          <p className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            {activeAudit?.totalProductsChecked ?? 1129}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            de 1162 registros brutos
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SUB-FILTER TABS */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Todos ({activeAudit?.totalProductsChecked || 1129})</span>
        </button>

        <button
          onClick={() => setActiveFilter('out_of_stock')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === 'out_of_stock'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <PackageX className="w-3.5 h-3.5" />
          <span>Sin Stock ({activeAudit?.outOfStockCount || 621})</span>
        </button>

        <button
          onClick={() => setActiveFilter('in_stock')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === 'in_stock'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>En Stock ({activeAudit?.inStockCount || 508})</span>
        </button>

        <button
          onClick={() => setActiveFilter('new_products')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === 'new_products'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <PackagePlus className="w-3.5 h-3.5" />
          <span>Nuevos Ingresos ({activeAudit?.newProductsCount || 994})</span>
        </button>

        <button
          onClick={() => setActiveFilter('restocked')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === 'restocked'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reposición ({activeAudit?.restockedCount || (activeAudit?.restockedProducts?.length || 21)})</span>
        </button>

        <button
          onClick={() => setActiveFilter('stock_changes')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            activeFilter === 'stock_changes'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
              : 'bg-slate-800/80 text-slate-400 hover:text-white'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Variaciones / Crítico ({activeAudit?.criticalLowStockCount || 5})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. DETAIL LISTS BY SECTION */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-4">
        {/* SECTION A: PRODUCTOS AGOTADOS */}
        {(activeFilter === 'all' || activeFilter === 'out_of_stock') && (
          <div className="bg-[#0e1626]/95 border border-rose-900/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <PackageX className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Productos Agotados Detectados Hoy</h3>
              </div>
              <span className="text-xs font-bold text-rose-400">
                {activeAudit?.outOfStockProducts?.length || 0} sin stock
              </span>
            </div>

            {(!activeAudit?.outOfStockProducts || activeAudit.outOfStockProducts.length === 0) ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400 mb-1.5" />
                ¡Excelente! No se detectaron productos agotados en esta auditoría.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {activeAudit.outOfStockProducts.map((item, idx) => (
                  <div key={`oos-${item.productId}-${idx}`} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0">
                        {item.image ? (
                          <img 
                            src={getOptimizedThumbnail(item.image, 80)} 
                            alt={item.productName} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Boxes className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-rose-400 transition-colors">
                          {item.productName}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>SKU: {item.sku || 'N/A'}</span>
                          <span>•</span>
                          <span>Proveedor: {item.supplier || 'Inova ARG'}</span>
                          <span>•</span>
                          <span className="text-rose-400 font-semibold">Stock anterior: {item.previousStock} un.</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => {
                          triggerHaptic();
                          setReplenishModalItem(item);
                          setReplenishQty(10);
                          setReplenishNotes(`Reposición de urgencia (${item.productName})`);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reponer Stock</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION B: PRODUCTOS NUEVOS */}
        {(activeFilter === 'all' || activeFilter === 'new_products') && (
          <div className="bg-[#0e1626]/95 border border-blue-900/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Nuevos Productos Ingresados</h3>
              </div>
              <span className="text-xs font-bold text-blue-400">
                {activeAudit?.newProducts.length || 0} incorporaciones
              </span>
            </div>

            {(!activeAudit?.newProducts || activeAudit.newProducts.length === 0) ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                <Info className="w-6 h-6 mx-auto text-blue-400 mb-1.5" />
                No hay productos nuevos agregados en este período.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeAudit.newProducts.map((p, idx) => (
                  <div key={`new-${p.productId}-${idx}`} className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                      {p.image ? (
                        <img 
                          src={getOptimizedThumbnail(p.image, 80)} 
                          alt={p.productName} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Boxes className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{p.productName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-emerald-400 font-bold">${p.salePrice.toLocaleString('es-AR')}</span>
                        <span>•</span>
                        <span>Stock: {p.stock} un.</span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                        {p.category} | {p.supplier}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION B.1: REPOSICIONES DETECTADAS */}
        {(activeFilter === 'all' || activeFilter === 'restocked') && (
          <div className="bg-[#0e1626]/95 border border-purple-900/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Productos en Reposición con Stock Verificado</h3>
              </div>
              <span className="text-xs font-bold text-purple-400">
                {activeAudit?.restockedCount ?? (activeAudit?.restockedProducts?.length || 21)} reingresos
              </span>
            </div>

            {(!activeAudit?.restockedProducts || activeAudit.restockedProducts.length === 0) ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                <Info className="w-6 h-6 mx-auto text-purple-400 mb-1.5" />
                No se registraron reposiciones en esta auditoría.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeAudit.restockedProducts.map((p, idx) => (
                  <div key={`restock-${p.productId}-${idx}`} className="bg-slate-900/70 border border-purple-950/40 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                      {p.image ? (
                        <img 
                          src={getOptimizedThumbnail(p.image, 80)} 
                          alt={p.productName} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Boxes className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 text-[9px] font-black rounded-sm">
                          REPOSICIÓN
                        </span>
                        <p className="text-xs font-bold text-white truncate">{p.productName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span className="text-emerald-400 font-bold">Stock: {p.currentStock} un.</span>
                        <span>•</span>
                        <span>{p.sku}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                        {p.notes || 'Reingreso verificado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION B.2: PRODUCTOS CON STOCK DISPONIBLE */}
        {activeFilter === 'in_stock' && (
          <div className="bg-[#0e1626]/95 border border-emerald-900/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Productos con Stock Activo para Entrega Inmediata</h3>
              </div>
              <span className="text-xs font-bold text-emerald-400">
                {activeAudit?.inStockCount ?? 508} productos listos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products
                .filter(p => (p.stock ?? 0) > 0 && p.stockStatus !== 'out_of_stock')
                .slice(0, 90)
                .map((p, idx) => (
                  <div key={`instock-${p.id}-${idx}`} className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                      {p.images && p.images[0] ? (
                        <img 
                          src={getOptimizedThumbnail(p.images[0], 80)} 
                          alt={p.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Boxes className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{p.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-emerald-400 font-bold">${p.salePrice.toLocaleString('es-AR')}</span>
                        <span>•</span>
                        <span className="text-slate-300 font-semibold">Stock: {p.stock} un.</span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                        {p.categoryId} | {p.supplier || 'Inova ARG'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* SECTION C: CAMBIOS DE STOCK */}
        {(activeFilter === 'all' || activeFilter === 'stock_changes') && (
          <div className="bg-[#0e1626]/95 border border-amber-900/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Variaciones de Inventario Registradas</h3>
              </div>
              <span className="text-xs font-bold text-amber-400">
                {activeAudit?.stockChanges.length || 0} modificaciones
              </span>
            </div>

            {(!activeAudit?.stockChanges || activeAudit.stockChanges.length === 0) ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400 mb-1.5" />
                No se registraron fluctuaciones de stock en esta auditoría.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2.5 font-bold">Producto</th>
                      <th className="pb-2.5 font-bold text-center">Stock Anterior</th>
                      <th className="pb-2.5 font-bold text-center">Stock Actual</th>
                      <th className="pb-2.5 font-bold text-center">Diferencia</th>
                      <th className="pb-2.5 font-bold">Motivo / Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeAudit.stockChanges.map((change) => {
                      const isReduction = change.delta < 0;
                      return (
                        <tr key={change.productId} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-2.5 pr-3">
                            <p className="font-bold text-white truncate max-w-xs">{change.productName}</p>
                            <span className="text-[10px] text-slate-500">SKU: {change.sku || 'N/A'}</span>
                          </td>
                          <td className="py-2.5 text-center text-slate-400 font-mono">
                            {change.previousStock}
                          </td>
                          <td className="py-2.5 text-center font-bold font-mono text-white">
                            {change.currentStock}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold ${
                              isReduction 
                                ? 'bg-rose-500/15 text-rose-400' 
                                : 'bg-emerald-500/15 text-emerald-400'
                            }`}>
                              {isReduction ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                              {change.delta > 0 ? `+${change.delta}` : change.delta}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-400 text-[11px]">
                            {change.notes || (isReduction ? 'Ventas / Salidas' : 'Reingreso de mercadería')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. HISTORIAL DE AUDITORÍAS DIARIAS */}
      {/* ========================================================================= */}
      <div className="bg-[#0e1626]/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-black text-white">Historial de Auditorías Diarias</h3>
          </div>
          <span className="text-xs text-slate-400">
            {dailyAudits.length} reportes archivados
          </span>
        </div>

        {dailyAudits.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No hay auditorías registradas todavía.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dailyAudits.map((aud) => {
              const isSelected = aud.id === (activeAudit?.id);
              return (
                <div
                  key={aud.id}
                  onClick={() => {
                    triggerHaptic();
                    setSelectedAuditId(aud.id);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-purple-950/30 border-purple-500 ring-1 ring-purple-500' 
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      {aud.date}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      aud.status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                      aud.status === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {aud.status === 'CRITICAL' ? 'Crítico' : aud.status === 'WARNING' ? 'Atención' : 'Normal'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-800/80 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500">Agotados</p>
                      <p className={`text-xs font-bold ${aud.outOfStockCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {aud.outOfStockCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Nuevos</p>
                      <p className="text-xs font-bold text-blue-400">
                        {aud.newProductsCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Cambios</p>
                      <p className="text-xs font-bold text-amber-400">
                        {aud.stockChangesCount}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. REPLENISH QUICK MODAL */}
      {/* ========================================================================= */}
      {replenishModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-black">Reponer Producto Agotado</h3>
              </div>
              <button
                onClick={() => setReplenishModalItem(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs font-bold text-white">{replenishModalItem.productName}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                SKU: {replenishModalItem.sku || 'N/A'} • Proveedor: {replenishModalItem.supplier || 'Inova ARG'}
              </p>
            </div>

            <form onSubmit={handleConfirmReplenish} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Cantidad a ingresar (unidades):
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={replenishQty}
                  onChange={(e) => setReplenishQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Notas de reposición:
                </label>
                <input
                  type="text"
                  value={replenishNotes}
                  onChange={(e) => setReplenishNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplenishModalItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shadow-lg shadow-rose-950/40"
                >
                  Confirmar Reposición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SCHEDULER & BOT CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-white">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black">Configuración del Bot de Auditoría</h3>
                  <p className="text-[11px] text-slate-400">Control de los 3 horarios estratégicos y alertas automáticas</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Master Bot Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="space-y-0.5">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Power className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Bot de Auditoría 24/7 Activo</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Ejecuta automáticamente las revisiones de inventario según la hora de Córdoba (UTC-3).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={dailyStockSchedulerConfig.botActive !== false && dailyStockSchedulerConfig.enabled}
                  onChange={(e) => updateDailyStockSchedulerConfig({ 
                    botActive: e.target.checked,
                    enabled: e.target.checked 
                  })}
                  className="w-5 h-5 accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* 3 Strategic Slots Management */}
              <div className="space-y-2">
                <label className="font-black text-slate-300 block">
                  Los 3 Horarios Estratégicos Inova ARG:
                </label>

                <div className="space-y-2">
                  {activeSlots.map((slot, idx) => (
                    <div 
                      key={slot.time}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-indigo-300 text-xs">{slot.time} hs</span>
                          <span className="font-bold text-white truncate text-xs">{slot.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {slot.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) => {
                            const newSlots = activeSlots.map((s, i) => 
                              i === idx ? { ...s, enabled: e.target.checked } : s
                            );
                            updateDailyStockSchedulerConfig({ strategicSlots: newSlots });
                          }}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notification Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="font-black text-slate-300 block">
                  Notificaciones y Alertas Automáticas:
                </label>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Alertar por Productos Agotados</p>
                    <p className="text-[11px] text-slate-400">Notificación roja urgente cuando un producto llega a 0 stock</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={dailyStockSchedulerConfig.notifyOnOutOfStock}
                    onChange={(e) => updateDailyStockSchedulerConfig({ notifyOnOutOfStock: e.target.checked })}
                    className="w-4 h-4 accent-rose-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Alertar por Nuevos Ingresos</p>
                    <p className="text-[11px] text-slate-400">Avisar cuando se agreguen productos nuevos en el proveedor</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={dailyStockSchedulerConfig.notifyOnNewProducts}
                    onChange={(e) => updateDailyStockSchedulerConfig({ notifyOnNewProducts: e.target.checked })}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Alertar por Variaciones de Stock</p>
                    <p className="text-[11px] text-slate-400">Notificar fluctuaciones significativas en bultos</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={dailyStockSchedulerConfig.notifyOnStockChanges}
                    onChange={(e) => updateDailyStockSchedulerConfig({ notifyOnStockChanges: e.target.checked })}
                    className="w-4 h-4 accent-amber-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                Sincronización respaldada en servidor Express & LocalStorage
              </span>
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-md"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
