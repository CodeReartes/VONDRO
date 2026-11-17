import { 
  Product, 
  DailyStockAudit, 
  StockChangeItem, 
  NewProductItem, 
  OutOfStockItem,
  DailyStockSchedulerConfig,
  StrategicAuditSlot
} from '../types';

const AUDIT_STORAGE_KEY = 'vondro_daily_stock_audits';
const SNAPSHOT_STORAGE_KEY = 'vondro_previous_stock_snapshot';
const SCHEDULER_CONFIG_KEY = 'vondro_daily_stock_scheduler_config';

export const DEFAULT_STRATEGIC_SLOTS: StrategicAuditSlot[] = [
  {
    time: '08:30',
    name: 'Apertura comercial',
    description: 'Sincroniza altas y bajas ocurridas durante la noche antes de las primeras compras de la mañana.',
    enabled: true
  },
  {
    time: '14:30',
    name: 'Cierre de media jornada mayorista',
    description: 'Momento donde se concentran los retiros y ventas por bulto de la mañana en Inova.',
    enabled: true
  },
  {
    time: '20:30',
    name: 'Cierre de jornada y despacho',
    description: 'Deja el catálogo blindado y actualizado para el pico de compras nocturnas de los clientes particulares desde sus casas.',
    enabled: true
  }
];

export const DEFAULT_SCHEDULER_CONFIG: DailyStockSchedulerConfig = {
  enabled: true,
  scheduledTime: '08:30',
  intervalHours: 6,
  notifyOnOutOfStock: true,
  notifyOnStockChanges: true,
  notifyOnNewProducts: true,
  criticalStockThreshold: 3,
  botActive: true,
  botMode: 'THREE_STRATEGIC_SLOTS',
  strategicSlots: DEFAULT_STRATEGIC_SLOTS
};

/**
 * Gets current time in Argentina (America/Argentina/Cordoba, UTC-3)
 */
export function getCurrentArgentinaTime(): { timeStr: string; dateStr: string; minutesTotal: number } {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Cordoba',
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    const month = parts.find(p => p.type === 'month')?.value || '10';
    const day = parts.find(p => p.type === 'day')?.value || '20';

    const hNum = parseInt(hour, 10);
    const mNum = parseInt(minute, 10);
    return {
      timeStr: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      dateStr: `${year}-${month}-${day}`,
      minutesTotal: hNum * 60 + mNum
    };
  } catch {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    return {
      timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      dateStr: d.toISOString().split('T')[0],
      minutesTotal: h * 60 + m
    };
  }
}

/**
 * Calculates next strategic slot and remaining minutes
 */
export function getNextStrategicSlot(slots: StrategicAuditSlot[] = DEFAULT_STRATEGIC_SLOTS): {
  nextSlot: StrategicAuditSlot;
  minutesRemaining: number;
  formattedRemaining: string;
} {
  const current = getCurrentArgentinaTime();
  const activeSlots = (slots && slots.length > 0 ? slots : DEFAULT_STRATEGIC_SLOTS).filter(s => s.enabled);
  
  if (activeSlots.length === 0) {
    return {
      nextSlot: DEFAULT_STRATEGIC_SLOTS[0],
      minutesRemaining: 0,
      formattedRemaining: 'Sin slots activos'
    };
  }

  // Parse slot times into minutes from midnight
  const slotsWithMins = activeSlots.map(s => {
    const [hh, mm] = s.time.split(':').map(n => parseInt(n, 10));
    return {
      slot: s,
      mins: (hh || 0) * 60 + (mm || 0)
    };
  }).sort((a, b) => a.mins - b.mins);

  // Find next slot today
  let found = slotsWithMins.find(s => s.mins > current.minutesTotal);
  let diffMins = 0;

  if (found) {
    diffMins = found.mins - current.minutesTotal;
  } else {
    // Rolls over to first slot tomorrow
    found = slotsWithMins[0];
    diffMins = (24 * 60 - current.minutesTotal) + found.mins;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const formattedRemaining = hours > 0 
    ? `${hours}h ${mins}m` 
    : `${mins} min`;

  return {
    nextSlot: found.slot,
    minutesRemaining: diffMins,
    formattedRemaining
  };
}

interface ProductSnapshotRecord {
  id: string;
  name: string;
  sku: string;
  stock: number;
  salePrice: number;
  costPrice?: number;
  categoryId?: string;
  supplier?: string;
  image?: string;
  updatedAt: string;
}

/**
 * Gets cached previous product stock snapshot from LocalStorage
 */
export function getSavedStockSnapshot(): Record<string, ProductSnapshotRecord> {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves current stock snapshot to LocalStorage
 */
export function saveStockSnapshot(products: Product[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const snapshot: Record<string, ProductSnapshotRecord> = {};
    for (const p of products) {
      if (!p || !p.id) continue;
      snapshot[p.id] = {
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        stock: p.stock ?? 0,
        salePrice: p.salePrice || 0,
        costPrice: p.costPrice,
        categoryId: p.categoryId,
        supplier: p.supplier || 'Inova ARG',
        image: (p.images && p.images[0]) || '',
        updatedAt: new Date().toISOString()
      };
    }
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[StockAudit] Failed to save stock snapshot:', err);
  }
}

/**
 * Gets saved daily audits from LocalStorage
 */
export function getSavedDailyAudits(): DailyStockAudit[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves a daily audit locally
 */
export function saveDailyAuditLocally(audit: DailyStockAudit): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const existing = getSavedDailyAudits();
    const updated = [audit, ...existing.filter(a => a.id !== audit.id && a.date !== audit.date)].slice(0, 30);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[StockAudit] Failed to save audit locally:', err);
  }
}

/**
 * Analyzes products against previous snapshot to detect:
 * 1. New products added
 * 2. Depleted out-of-stock products
 * 3. Stock changes (increased, decreased, restocked)
 * 4. Critical low stock items
 */
export function computeDailyStockAudit(
  currentProducts: Product[],
  executedBy: 'AUTOMATIC_DAILY_SCHEDULER' | 'ADMIN_MANUAL' | string = 'ADMIN_MANUAL',
  customSnapshot?: Record<string, ProductSnapshotRecord>,
  slot?: { time: string; name: string }
): DailyStockAudit {
  const previousSnapshot = customSnapshot || getSavedStockSnapshot();
  const hasPreviousData = Object.keys(previousSnapshot).length > 0;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  const newProducts: NewProductItem[] = [];
  const outOfStockProducts: OutOfStockItem[] = [];
  const restockedProducts: StockChangeItem[] = [];
  const stockChanges: StockChangeItem[] = [];
  const criticalStockProducts: StockChangeItem[] = [];

  for (const product of currentProducts) {
    if (!product || !product.id) continue;

    const currentStock = product.stock ?? 0;
    const minStock = product.minimumStock || 3;
    const isSupplierAvailable = product.supplierAvailability === 'AVAILABLE' || product.supplierStockStatus === 'AVAILABLE';
    const isOutOfStock = (currentStock <= 0 || product.stockStatus === 'out_of_stock') && !isSupplierAvailable;
    const isCritical = currentStock > 0 && currentStock <= minStock && !isSupplierAvailable;
    const prev = previousSnapshot[product.id];
    const isRestockedItem = Boolean(
      (product as any).isRestocked || 
      (product as any).tags?.includes('REPOSICIÓN') || 
      (product as any).promoBadges?.includes('REPOSICIÓN') ||
      (prev && prev.stock === 0 && currentStock > 0)
    );

    // 1. PRODUCTOS NUEVOS
    if (product.isNew || !prev) {
      newProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        stock: currentStock,
        salePrice: product.salePrice,
        costPrice: product.costPrice,
        category: product.categoryId,
        supplier: product.supplier || 'Inova ARG',
        image: (product.images && product.images[0]) || '',
        addedAt: nowIso
      });
    }

    // 2. PRODUCTOS REPOSICIÓN
    if (isRestockedItem) {
      restockedProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev ? prev.stock : 0,
        currentStock: currentStock,
        delta: prev ? currentStock - prev.stock : currentStock,
        changeType: 'RESTOCKED',
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        image: (product.images && product.images[0]) || '',
        notes: `Producto con reposición de inventario (+${currentStock} un.)`
      });
    }

    // 3. PRODUCTOS AGOTADOS
    if (isOutOfStock) {
      outOfStockProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev ? prev.stock : currentStock,
        currentStock: 0,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        minimumStock: minStock,
        suggestedRestock: Math.max(10, minStock * 3),
        image: (product.images && product.images[0]) || '',
        costPrice: product.costPrice,
        salePrice: product.salePrice
      });
    }

    // 4. CAMBIOS EN EL STOCK
    if (prev && prev.stock !== currentStock) {
      const delta = currentStock - prev.stock;
      let changeType: StockChangeItem['changeType'] = delta > 0 ? 'INCREASED' : 'DECREASED';
      
      if (prev.stock === 0 && currentStock > 0) {
        changeType = 'RESTOCKED';
      } else if (currentStock === 0) {
        changeType = 'DEPLETED';
      } else if (isCritical) {
        changeType = 'CRITICAL';
      }

      stockChanges.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev.stock,
        currentStock: currentStock,
        delta,
        changeType,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        image: (product.images && product.images[0]) || '',
        notes: delta > 0 
          ? `Ingreso de mercadería (+${delta} un.)` 
          : `Salida por ventas / despacho (${delta} un.)`
      });
    }

    // 5. ALERTA STOCK CRÍTICO (por agotarse)
    if (isCritical) {
      criticalStockProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev ? prev.stock : currentStock,
        currentStock: currentStock,
        delta: prev ? currentStock - prev.stock : 0,
        changeType: 'CRITICAL',
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        image: (product.images && product.images[0]) || '',
        notes: `Quedan solo ${currentStock} unidades (mínimo: ${minStock})`
      });
    }
  }

  const inStockCount = currentProducts.filter(p => (p.stock ?? 0) > 0 && p.stockStatus !== 'out_of_stock').length;

  // Summary note generation
  const parts: string[] = [];
  if (slot) {
    parts.push(`🤖 [${slot.time} - ${slot.name}]`);
  }
  parts.push(`✅ ${inStockCount} en stock disponible`);
  if (outOfStockProducts.length > 0) {
    parts.push(`🔴 ${outOfStockProducts.length} agotados`);
  }
  if (restockedProducts.length > 0) {
    parts.push(`🔄 ${restockedProducts.length} reposiciones`);
  }
  if (newProducts.length > 0) {
    parts.push(`✨ ${newProducts.length} nuevos ingresos`);
  }
  if (criticalStockProducts.length > 0) {
    parts.push(`⚠️ ${criticalStockProducts.length} stock crítico`);
  }

  let status: DailyStockAudit['status'] = 'COMPLETED';
  if (outOfStockProducts.length > 0 || criticalStockProducts.length >= 5) {
    status = 'CRITICAL';
  } else if (stockChanges.length > 0 || criticalStockProducts.length > 0) {
    status = 'WARNING';
  }

  const audit: DailyStockAudit = {
    id: `audit-${todayStr}-${Date.now()}`,
    date: todayStr,
    timestamp: nowIso,
    executedBy,
    slotTime: slot ? slot.time : undefined,
    slotLabel: slot ? slot.name : undefined,
    totalProductsChecked: currentProducts.length,
    inStockCount,
    newProductsCount: newProducts.length,
    outOfStockCount: outOfStockProducts.length,
    restockedCount: restockedProducts.length,
    stockChangesCount: stockChanges.length,
    criticalLowStockCount: criticalStockProducts.length,
    newProducts,
    outOfStockProducts,
    restockedProducts,
    stockChanges,
    criticalStockProducts,
    summaryNote: parts.join(' | '),
    status
  };

  // Update snapshot for tomorrow's baseline
  saveStockSnapshot(currentProducts);
  saveDailyAuditLocally(audit);

  return audit;
}

/**
 * Formats daily audit report to WhatsApp / Plain text for immediate team sharing
 */
export function formatAuditForWhatsApp(audit: DailyStockAudit): string {
  let text = `📊 *AUDITORÍA DIARIA DE STOCK - VONDRO CÓRDOBA*\n`;
  text += `📅 Fecha: ${audit.date} (${new Date(audit.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs)\n`;
  text += `🔎 Total analizados: ${audit.totalProductsChecked} productos\n`;
  text += `──────────────────\n\n`;

  if (audit.outOfStockCount > 0) {
    text += `🚨 *PRODUCTOS AGOTADOS (${audit.outOfStockCount})*:\n`;
    audit.outOfStockProducts.slice(0, 10).forEach(p => {
      text += `• *${p.productName}* (SKU: ${p.sku}) | Proveedor: ${p.supplier || 'Inova ARG'}\n`;
    });
    if (audit.outOfStockCount > 10) {
      text += `_...y ${audit.outOfStockCount - 10} más._\n`;
    }
    text += `\n`;
  } else {
    text += `✅ *Sin productos agotados.*\n\n`;
  }

  if (audit.stockChangesCount > 0) {
    text += `📦 *CAMBIOS DE STOCK DETECTADOS (${audit.stockChangesCount})*:\n`;
    audit.stockChanges.slice(0, 10).forEach(p => {
      const sign = p.delta > 0 ? `+${p.delta}` : `${p.delta}`;
      text += `• ${p.productName}: ${p.previousStock} ➔ ${p.currentStock} (${sign} un.)\n`;
    });
    if (audit.stockChangesCount > 10) {
      text += `_...y ${audit.stockChangesCount - 10} cambios más._\n`;
    }
    text += `\n`;
  }

  if (audit.newProductsCount > 0) {
    text += `✨ *PRODUCTOS NUEVOS INCORPORADOS (${audit.newProductsCount})*:\n`;
    audit.newProducts.slice(0, 8).forEach(p => {
      text += `• ${p.productName} ($${p.salePrice.toLocaleString('es-AR')}) - Stock inicial: ${p.stock}\n`;
    });
    text += `\n`;
  }

  if (audit.criticalLowStockCount > 0) {
    text += `⚠️ *ALERTA STOCK CRÍTICO (${audit.criticalLowStockCount})*:\n`;
    audit.criticalStockProducts.slice(0, 6).forEach(p => {
      text += `• ${p.productName}: Quedan ${p.currentStock} un.\n`;
    });
    text += `\n`;
  }

  text += `📌 *Estado General*: ${audit.status === 'CRITICAL' ? '⚠️ ATENCIÓN REQUERIDA (Reponer stock)' : '✅ OPERATIVO'}\n`;
  text += `_Reporte generado automáticamente por VONDRO Sistema de Gestión._`;

  return text;
}
