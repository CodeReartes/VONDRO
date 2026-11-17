import { Order, StoreSettings } from '../types';

// Baseline timestamp set right after the 18:40 ART pre-test orders so KPIs start at $0 / 0
// while any new test orders placed afterward are tracked immediately.
export const DEFAULT_METRICS_BASELINE_ISO = '2026-11-17T21:46:00.000Z';

export function getEffectiveMetricsResetMs(settings?: Partial<StoreSettings> | null): number {
  const customIso = settings?.metricsResetAt;
  const customMs = customIso ? Date.parse(customIso) : NaN;
  const defaultMs = Date.parse(DEFAULT_METRICS_BASELINE_ISO);
  if (Number.isFinite(customMs) && customMs > defaultMs) {
    return customMs;
  }
  return defaultMs;
}

export function isOrderAfterMetricsBaseline(order: Order | null | undefined, resetMs: number): boolean {
  if (!order) return false;
  if (!order.createdAt) return true;
  const createdMs = Date.parse(order.createdAt);
  if (!Number.isFinite(createdMs)) return true;
  return createdMs >= resetMs;
}

export function isPendingOrderStatus(status?: string): boolean {
  return (
    status === 'payment_received' ||
    status === 'pending_payment' ||
    status === 'preparing' ||
    status === 'checking_stock'
  );
}
