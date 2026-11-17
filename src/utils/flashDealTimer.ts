import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';

const TIMER_STORAGE_KEY = 'vondro_flash_deal_end_time';
const DURATION_STORAGE_KEY = 'vondro_flash_deal_duration_hours';
const ACTIVE_IDS_KEY = 'vondro_flash_deal_active_ids_v4';
const NEXT_IDS_KEY = 'vondro_flash_deal_next_ids_v4';
const AUTO_ROTATE_KEY = 'vondro_flash_deal_auto_rotate';
const ROTATION_OFFSET_KEY = 'vondro_flash_deal_rotation_offset_v4';

export const FLASH_DEALS_EVENT = 'vondro_flash_deals_updated';
export const FLASH_DEAL_TARGET_COUNT = 100;

export interface FlashDealConfig {
  endTime: number;
  durationHours: number;
  activeProductIds: string[];
  nextProductIds: string[];
  autoRotate: boolean;
  rotationOffset: number;
}

/**
 * Prioritizes low stock items (<= 10 units, e.g. 1, 2, 3, 5, 8, 9, 10 units)
 * with dynamic rotation/shuffling so different products take turns at the front,
 * then fills up to `count` items from the remaining catalog.
 */
export function selectFlashDealProducts(
  products: Product[] = [],
  count: number = FLASH_DEAL_TARGET_COUNT,
  offset: number = 0,
  excludeIds: string[] = []
): { ids: string[]; newOffset: number } {
  if (!products || products.length === 0) {
    return { ids: [], newOffset: 0 };
  }

  // Filter products that have stock and are not hidden
  const validProducts = products.filter(p => p && p.stock > 0 && !p.hideIfOutOfStock);
  if (validProducts.length === 0) {
    return { ids: products.slice(0, count).map(p => p.id), newOffset: 0 };
  }

  // 1. High priority: Products with low stock (<= 20 units) or low_stock status
  const lowStockProducts = validProducts.filter(
    p => (p.stock > 0 && p.stock <= 20) || p.stockStatus === 'low_stock' || p.promoBadges?.includes('OFERTA_RELAMPAGO')
  );

  // Dynamic shuffle/rotation of low stock items based on offset:
  // We rotate low-stock items with a prime shift so that items with 3, 5, 8, 9, 10 units
  // rotate to the front on each cycle/tap rather than always the same 2 products!
  const lowLen = lowStockProducts.length;
  const rotatedLowStock: Product[] = [];
  
  if (lowLen > 0) {
    const shift = ((offset || 0) * 7) % lowLen;
    const shifted = [...lowStockProducts.slice(shift), ...lowStockProducts.slice(0, shift)];
    rotatedLowStock.push(...shifted);
  }

  const lowStockIds = Array.from(new Set(rotatedLowStock.map(p => p.id)));

  // 2. Normal stock products pool for rotation
  const otherProducts = validProducts.filter(p => !lowStockIds.includes(p.id));

  // Exclude current batch if possible to ensure rotation
  const availableOthers = otherProducts.filter(p => !excludeIds.includes(p.id));
  const poolToUse = availableOthers.length >= count - lowStockIds.length ? availableOthers : otherProducts;

  const neededFromPool = Math.max(0, count - lowStockIds.length);
  const selectedFromPool: string[] = [];

  const poolLen = poolToUse.length;
  if (poolLen > 0) {
    const normalizedOffset = offset % poolLen;
    for (let i = 0; i < neededFromPool && i < poolLen; i++) {
      const idx = (normalizedOffset + i) % poolLen;
      selectedFromPool.push(poolToUse[idx].id);
    }
  }

  // Combine low stock first, then rotated products
  const combined = Array.from(new Set([...lowStockIds, ...selectedFromPool])).slice(0, count);
  const nextOffset = (offset + Math.max(7, Math.floor(lowLen / 2))) % Math.max(1, poolLen || 100);

  return { ids: combined, newOffset: nextOffset };
}

export function getFlashDealConfig(availableProducts?: Product[]): FlashDealConfig {
  if (typeof window === 'undefined') {
    return {
      endTime: Date.now() + 4 * 3600 * 1000,
      durationHours: 4,
      activeProductIds: [],
      nextProductIds: [],
      autoRotate: true,
      rotationOffset: 0,
    };
  }

  const durationStr = localStorage.getItem(DURATION_STORAGE_KEY);
  const durationHours = durationStr ? Math.max(1, parseInt(durationStr, 10)) : 4;

  const autoRotateStr = localStorage.getItem(AUTO_ROTATE_KEY);
  const autoRotate = autoRotateStr !== null ? autoRotateStr === 'true' : true;

  const offsetStr = localStorage.getItem(ROTATION_OFFSET_KEY);
  let rotationOffset = offsetStr ? parseInt(offsetStr, 10) : 0;
  if (isNaN(rotationOffset)) rotationOffset = 0;

  let activeProductIds: string[] = [];
  try {
    const rawActive = localStorage.getItem(ACTIVE_IDS_KEY);
    if (rawActive) {
      const parsed = JSON.parse(rawActive);
      if (Array.isArray(parsed) && parsed.length > 0) {
        activeProductIds = parsed;
      }
    }
  } catch {}

  let nextProductIds: string[] = [];
  try {
    const rawNext = localStorage.getItem(NEXT_IDS_KEY);
    if (rawNext) {
      const parsed = JSON.parse(rawNext);
      if (Array.isArray(parsed) && parsed.length > 0) {
        nextProductIds = parsed;
      }
    }
  } catch {}

  // Sanitize active and next product IDs: strictly exclude out-of-stock, hidden, or zero-stock products
  if (availableProducts && availableProducts.length > 0) {
    const validInStockIds = new Set(
      availableProducts
        .filter(p => p && p.stock > 0 && !p.hideIfOutOfStock && p.stockStatus !== 'out_of_stock' && p.stockStatus !== 'hidden')
        .map(p => p.id)
    );
    const sanitizedActive = activeProductIds.filter(id => validInStockIds.has(id));
    const sanitizedNext = nextProductIds.filter(id => validInStockIds.has(id));

    if (sanitizedActive.length !== activeProductIds.length) {
      activeProductIds = sanitizedActive;
      localStorage.setItem(ACTIVE_IDS_KEY, JSON.stringify(activeProductIds));
    }
    if (sanitizedNext.length !== nextProductIds.length) {
      nextProductIds = sanitizedNext;
      localStorage.setItem(NEXT_IDS_KEY, JSON.stringify(nextProductIds));
    }
  }

  // If active items are fewer than requested and products are provided, generate 100 items
  if (availableProducts && availableProducts.length > 0 && activeProductIds.length < 20) {
    const activeSelection = selectFlashDealProducts(availableProducts, FLASH_DEAL_TARGET_COUNT, rotationOffset);
    activeProductIds = activeSelection.ids;
    
    const nextSelection = selectFlashDealProducts(
      availableProducts, 
      FLASH_DEAL_TARGET_COUNT, 
      activeSelection.newOffset, 
      activeProductIds
    );
    nextProductIds = nextSelection.ids;
    rotationOffset = nextSelection.newOffset;

    localStorage.setItem(ACTIVE_IDS_KEY, JSON.stringify(activeProductIds));
    localStorage.setItem(NEXT_IDS_KEY, JSON.stringify(nextProductIds));
    localStorage.setItem(ROTATION_OFFSET_KEY, rotationOffset.toString());
  }

  const storedTime = localStorage.getItem(TIMER_STORAGE_KEY);
  let endTime = storedTime ? parseInt(storedTime, 10) : 0;
  const now = Date.now();

  if (isNaN(endTime) || endTime <= now) {
    endTime = now + (durationHours * 3600 + 42 * 60 + 15) * 1000;
    localStorage.setItem(TIMER_STORAGE_KEY, endTime.toString());
  }

  return {
    endTime,
    durationHours,
    activeProductIds,
    nextProductIds,
    autoRotate,
    rotationOffset,
  };
}

export function saveFlashDealConfig(config: Partial<FlashDealConfig>) {
  if (typeof window === 'undefined') return;

  if (config.endTime !== undefined) {
    localStorage.setItem(TIMER_STORAGE_KEY, config.endTime.toString());
  }
  if (config.durationHours !== undefined) {
    localStorage.setItem(DURATION_STORAGE_KEY, config.durationHours.toString());
  }
  if (config.activeProductIds !== undefined) {
    localStorage.setItem(ACTIVE_IDS_KEY, JSON.stringify(config.activeProductIds));
  }
  if (config.nextProductIds !== undefined) {
    localStorage.setItem(NEXT_IDS_KEY, JSON.stringify(config.nextProductIds));
  }
  if (config.autoRotate !== undefined) {
    localStorage.setItem(AUTO_ROTATE_KEY, config.autoRotate.toString());
  }
  if (config.rotationOffset !== undefined) {
    localStorage.setItem(ROTATION_OFFSET_KEY, config.rotationOffset.toString());
  }

  window.dispatchEvent(new CustomEvent(FLASH_DEALS_EVENT, { detail: config }));
}

/**
 * Rotates the flash deals immediately:
 * Promotes nextProductIds (100 items) to activeProductIds,
 * and dynamically calculates the next 100 items from the remaining catalog.
 */
export function rotateFlashDeals(availableProducts?: Product[]) {
  if (typeof window === 'undefined') return;

  const current = getFlashDealConfig(availableProducts);
  let newActive = current.nextProductIds;
  const advanceOffset = (current.rotationOffset + 13) % 997;

  // If next batch was empty or too small, calculate freshly from available products
  if (!newActive || newActive.length < 20) {
    if (availableProducts && availableProducts.length > 0) {
      const gen = selectFlashDealProducts(availableProducts, FLASH_DEAL_TARGET_COUNT, advanceOffset);
      newActive = gen.ids;
    } else {
      newActive = current.activeProductIds;
    }
  }

  // Calculate next 100 items excluding the new active batch
  let newNext: string[] = [];
  let newOffset = advanceOffset;

  if (availableProducts && availableProducts.length > 0) {
    const nextGen = selectFlashDealProducts(
      availableProducts, 
      FLASH_DEAL_TARGET_COUNT, 
      advanceOffset + FLASH_DEAL_TARGET_COUNT, 
      newActive
    );
    newNext = nextGen.ids;
    newOffset = nextGen.newOffset;
  }

  const newEndTime = Date.now() + current.durationHours * 3600 * 1000;

  saveFlashDealConfig({
    endTime: newEndTime,
    activeProductIds: newActive,
    nextProductIds: newNext,
    rotationOffset: newOffset,
  });
}

/**
 * Returns whether a product is currently in Flash Sale (Oferta Relámpago):
 * Strictly checks if the product is in the active 100 flash deal batch during rotation.
 */
export function isProductInFlashDeal(product: Product, activeIds: string[] = []): boolean {
  if (!product) return false;
  if (product.stock <= 0 || product.stockStatus === 'out_of_stock' || product.hideIfOutOfStock || product.stockStatus === 'hidden') return false;

  // If activeIds is populated (e.g. 100 items), ONLY products in activeIds get the Flash Sale status!
  if (activeIds && activeIds.length > 0) {
    return activeIds.includes(product.id);
  }

  // Fallback if activeIds is empty
  if (product.isFlashSale || product.promoBadges?.includes('OFERTA_RELAMPAGO')) return true;
  if (product.stock <= 20 || product.stockStatus === 'low_stock') return true;

  return false;
}

/**
 * Dynamic discount for Flash Sale:
 * Gives higher urgency discounts for low-stock products to attract fast purchases!
 */
export function getFlashDealDiscount(product: Product): number {
  if (product.discountPercentage && product.discountPercentage > 0) {
    return product.discountPercentage;
  }
  if (product.stock <= 2) return 42;
  if (product.stock <= 4) return 35;
  if (product.stock <= 6) return 30;
  if (product.stock <= 8) return 25;
  if (product.stock <= 10) return 20;
  return 15;
}

export interface FlashTimerState {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  progressPercent: number; // 0 to 100%
  isExpired: boolean;
  activeProductIds: string[];
  nextProductIds: string[];
  durationHours: number;
  autoRotate: boolean;
  rotateNow: (products?: Product[]) => void;
  updateConfig: (newConfig: Partial<FlashDealConfig>) => void;
}

export interface FlashDealConfigState {
  activeProductIds: string[];
  nextProductIds: string[];
  durationHours: number;
  autoRotate: boolean;
  endTime: number;
  rotateNow: (products?: Product[]) => void;
  updateConfig: (newConfig: Partial<FlashDealConfig>) => void;
}

/**
 * Subscribes ONLY to flash deal product batch changes & config updates (zero 1-second re-renders).
 * Automatically rotates batches only when `endTime` expires via a single scheduled timeout.
 */
export function useActiveFlashDealConfig(availableProducts?: Product[]): FlashDealConfigState {
  const [config, setConfig] = useState<FlashDealConfig>(() => getFlashDealConfig(availableProducts));

  const refreshConfig = useCallback(() => {
    setConfig(getFlashDealConfig(availableProducts));
  }, [availableProducts]);

  useEffect(() => {
    if (availableProducts && availableProducts.length > 0 && config.activeProductIds.length < 20) {
      setConfig(getFlashDealConfig(availableProducts));
    }
  }, [availableProducts, config.activeProductIds.length]);

  useEffect(() => {
    const handleUpdate = () => {
      refreshConfig();
    };

    window.addEventListener(FLASH_DEALS_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(FLASH_DEALS_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshConfig]);

  // Single expiration timeout instead of ticking 1x/second across the whole tree
  useEffect(() => {
    const msUntilEnd = config.endTime - Date.now();
    if (msUntilEnd <= 0) {
      if (config.autoRotate) {
        rotateFlashDeals(availableProducts);
      } else {
        saveFlashDealConfig({ endTime: Date.now() + config.durationHours * 3600 * 1000 });
      }
      return;
    }

    const delay = Math.min(msUntilEnd + 50, 2147483000);
    const timeoutId = setTimeout(() => {
      if (config.autoRotate) {
        rotateFlashDeals(availableProducts);
      } else {
        saveFlashDealConfig({ endTime: Date.now() + config.durationHours * 3600 * 1000 });
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [config.endTime, config.durationHours, config.autoRotate, availableProducts]);

  const rotateNow = useCallback(
    (prods?: Product[]) => rotateFlashDeals(prods || availableProducts),
    [availableProducts]
  );

  const updateConfig = useCallback((newCfg: Partial<FlashDealConfig>) => {
    saveFlashDealConfig(newCfg);
  }, []);

  return {
    activeProductIds: config.activeProductIds,
    nextProductIds: config.nextProductIds,
    durationHours: config.durationHours,
    autoRotate: config.autoRotate,
    endTime: config.endTime,
    rotateNow,
    updateConfig,
  };
}

export interface FlashCountdownState {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  progressPercent: number;
  isExpired: boolean;
}

/**
 * Lightweight 1-second countdown hook meant ONLY for small leaf timer UI components.
 */
export function useFlashCountdown(): FlashCountdownState {
  const readTiming = useCallback(() => {
    if (typeof window === 'undefined') {
      return { endTime: Date.now() + 4 * 3600 * 1000, durationHours: 4, autoRotate: true };
    }
    const storedTime = localStorage.getItem(TIMER_STORAGE_KEY);
    const durationStr = localStorage.getItem(DURATION_STORAGE_KEY);
    const autoRotateStr = localStorage.getItem(AUTO_ROTATE_KEY);
    const durationHours = durationStr ? Math.max(1, parseInt(durationStr, 10) || 4) : 4;
    let endTime = storedTime ? parseInt(storedTime, 10) : 0;
    if (!Number.isFinite(endTime) || endTime <= Date.now()) {
      endTime = Date.now() + (durationHours * 3600 + 42 * 60 + 15) * 1000;
    }
    return {
      endTime,
      durationHours,
      autoRotate: autoRotateStr !== null ? autoRotateStr === 'true' : true,
    };
  }, []);

  const computeTimeLeft = useCallback(() => {
    const { endTime, durationHours } = readTiming();
    const diff = Math.max(0, endTime - Date.now());
    const totalSeconds = Math.max(0, Math.floor(diff / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const totalDuration = Math.max(1, durationHours * 3600);
    const progressPercent = Math.min(
      100,
      Math.max(10, Math.round(((totalDuration - totalSeconds) / totalDuration) * 100))
    );
    return {
      hours,
      minutes,
      seconds,
      progressPercent,
      isExpired: totalSeconds <= 0,
    };
  }, [readTiming]);

  const [timeLeft, setTimeLeft] = useState(computeTimeLeft);

  useEffect(() => {
    const sync = () => setTimeLeft(computeTimeLeft());
    sync();
    const interval = setInterval(sync, 1000);
    window.addEventListener(FLASH_DEALS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      clearInterval(interval);
      window.removeEventListener(FLASH_DEALS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [computeTimeLeft]);

  const hStr = String(timeLeft.hours).padStart(2, '0');
  const mStr = String(timeLeft.minutes).padStart(2, '0');
  const sStr = String(timeLeft.seconds).padStart(2, '0');

  return {
    ...timeLeft,
    formatted: `${hStr}:${mStr}:${sStr}`,
  };
}

export function useGlobalFlashTimer(availableProducts?: Product[]): FlashTimerState {
  const cfg = useActiveFlashDealConfig(availableProducts);
  const countdown = useFlashCountdown();

  return {
    ...countdown,
    activeProductIds: cfg.activeProductIds,
    nextProductIds: cfg.nextProductIds,
    durationHours: cfg.durationHours,
    autoRotate: cfg.autoRotate,
    rotateNow: cfg.rotateNow,
    updateConfig: cfg.updateConfig,
  };
}
