import { AppNotification, Product } from '../types';
import { PushNotificationPayload } from './pushNotifications';

const DAILY_OFFER_DATE_KEY = 'vondro_daily_offer_date_v1';
const SEEN_PROMO_IDS_KEY = 'vondro_seen_promo_ids_v1';
const READ_NOTIF_IDS_KEY = 'vondro_read_notif_ids_v1';
const SEEN_ORDER_STATUSES_KEY = 'vondro_seen_order_statuses_v1';

/**
 * Returns YYYY-MM-DD in Argentina (Córdoba) timezone
 */
export function getArgentinaDateKey(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Cordoba',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export function getDayIndex(dateKey: string): number {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) {
    return Math.floor(Date.now() / 86400000);
  }
  const utcMs = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  return Math.floor(utcMs / 86400000);
}

export function getProductOfferDetails(p: Product) {
  const salePrice = Number(p.salePrice || 0);
  const origPrice = Number(p.originalPrice || 0);
  const computedPct =
    origPrice > salePrice && origPrice > 0
      ? Math.round(((origPrice - salePrice) / origPrice) * 100)
      : Number(p.discountPercentage || 0);
  const pct = Math.max(0, Math.min(90, computedPct));
  const badges = Array.isArray(p.promoBadges) ? p.promoBadges : [];
  const nameLower = (p.name || '').toLowerCase();
  const isLiquidation =
    pct >= 30 ||
    badges.some(b => String(b).toUpperCase().includes('LIQUIDACION')) ||
    nameLower.includes('liquidacion') ||
    nameLower.includes('liquidación');
  const isFlash = Boolean(p.isFlashSale || badges.some(b => String(b).toUpperCase().includes('RELAMPAGO')));
  const isNewArrival = Boolean(p.isNew || p.isRestocked);
  const isPromo = pct >= 15 || isLiquidation || isFlash || isNewArrival;

  return {
    pct,
    origPrice: origPrice > salePrice ? origPrice : Math.round(salePrice / (1 - (pct || 20) / 100)),
    salePrice,
    isLiquidation,
    isFlash,
    isNewArrival,
    isPromo
  };
}

export function getDailyFeaturedDeals(products: Product[], limitCount: number = 12): Product[] {
  const inStock = (products || []).filter(
    p =>
      p &&
      p.id &&
      p.name &&
      p.stock > 0 &&
      !p.hideIfOutOfStock &&
      p.stockStatus !== 'out_of_stock' &&
      Number(p.salePrice) > 0 &&
      ((p.images && p.images.length > 0) || Boolean(p.image))
  );

  const scored = inStock
    .map(p => {
      const info = getProductOfferDetails(p);
      let score = info.pct * 2;
      if (info.isLiquidation) score += 35;
      if (info.isFlash) score += 25;
      if (info.isNewArrival) score += 20;
      if (p.featured) score += 10;
      return { p, score, info };
    })
    .filter(x => x.info.isPromo || x.score > 0);

  scored.sort((a, b) => b.score - a.score);

  const pool = scored.length > 0 ? scored.map(x => x.p) : inStock;
  if (pool.length <= limitCount) return pool;

  // Deterministic subtle daily rotation inside the top tier so offers feel fresh daily
  const dayOffset = getDayIndex(getArgentinaDateKey()) % Math.min(8, pool.length);
  const rotated = [...pool.slice(dayOffset), ...pool.slice(0, dayOffset)];
  return rotated.slice(0, limitCount);
}

/**
 * Generates one curated Daily Offer notification per calendar day in Argentina timezone.
 */
export function buildDailyOfferForToday(
  products: Product[],
  existingNotifications: AppNotification[]
): { notification: AppNotification; pushPayload: PushNotificationPayload } | null {
  if (!products || products.length === 0) return null;

  const todayAr = getArgentinaDateKey();
  const dailyId = `notif-daily-offer-${todayAr}`;

  if (existingNotifications.some(n => n.id === dailyId)) {
    return null;
  }

  try {
    const savedDate = localStorage.getItem(DAILY_OFFER_DATE_KEY);
    if (savedDate === todayAr) {
      return null;
    }
  } catch {
    // ignore storage errors
  }

  const candidates = getDailyFeaturedDeals(products, 24);
  if (candidates.length === 0) return null;

  const idx = getDayIndex(todayAr) % candidates.length;
  const deal = candidates[idx];
  const info = getProductOfferDetails(deal);
  const displayPct = info.pct >= 10 ? info.pct : 20;
  const thumb = deal.image || (deal.images && deal.images[0]) || '/icon-192.png';

  const label = info.isLiquidation
    ? 'Liquidación del día'
    : info.isNewArrival
      ? 'Nuevo ingreso en oferta'
      : 'Oferta del día VONDRO';

  const title = `🔥 ${label}: -${displayPct}% OFF`;
  const message = `${deal.name} hoy a $${deal.salePrice.toLocaleString('es-AR')} (antes $${info.origPrice.toLocaleString('es-AR')}). ¡Válido por hoy en Córdoba!`;

  const notification: AppNotification = {
    id: dailyId,
    targetAudience: 'customer',
    type: 'FLASH_OFFER',
    title,
    message,
    priority: 'high',
    entityType: 'product',
    entityId: deal.id,
    imageUrl: thumb,
    linkUrl: `/?product=${deal.id}`,
    actionText: 'Aprovechar oferta',
    read: false,
    createdAt: new Date().toISOString()
  };

  const pushPayload: PushNotificationPayload = {
    title,
    body: message,
    category: 'offer',
    actionText: 'Aprovechar Oferta',
    url: `/?product=${deal.id}`,
    icon: '/icon-192.png',
    image: thumb
  };

  try {
    localStorage.setItem(DAILY_OFFER_DATE_KEY, todayAr);
  } catch {
    // ignore
  }

  return { notification, pushPayload };
}

/**
 * Detects newly arrived or restocked products in promo / liquidation and creates a notification.
 */
export function detectNewPromoOrLiquidationArrivals(
  products: Product[],
  existingNotifications: AppNotification[]
): { notification: AppNotification; pushPayload: PushNotificationPayload; shouldPush: boolean } | null {
  if (!products || products.length === 0) return null;

  const promoProducts = products.filter(p => {
    if (!p || !p.id || p.stock <= 0 || p.hideIfOutOfStock || p.stockStatus === 'out_of_stock') return false;
    const info = getProductOfferDetails(p);
    return info.isLiquidation || info.isNewArrival || info.pct >= 20 || info.isFlash;
  });

  if (promoProducts.length === 0) return null;

  const currentIds = promoProducts.map(p => p.id);
  const todayAr = getArgentinaDateKey();

  let previousSeenIds: Set<string> | null = null;
  try {
    const raw = localStorage.getItem(SEEN_PROMO_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        previousSeenIds = new Set(parsed);
      }
    }
  } catch {
    previousSeenIds = null;
  }

  // Persist current set (cap at 500 IDs for compact storage)
  try {
    localStorage.setItem(SEEN_PROMO_IDS_KEY, JSON.stringify(currentIds.slice(0, 500)));
  } catch {
    // ignore
  }

  // First visit baseline: provide 1 curated promo/liquidation arrivals summary for today if none exists
  if (!previousSeenIds) {
    const welcomePromoId = `notif-promo-arrivals-${todayAr}`;
    if (existingNotifications.some(n => n.id === welcomePromoId)) {
      return null;
    }

    const spotlight = promoProducts
      .filter(p => getProductOfferDetails(p).isLiquidation || getProductOfferDetails(p).isNewArrival)
      .slice(0, 3);
    const featuredList = spotlight.length > 0 ? spotlight : promoProducts.slice(0, 3);
    const first = featuredList[0];
    const thumb = first.image || (first.images && first.images[0]) || '/icon-192.png';
    const namesPreview = featuredList.map(p => p.name).slice(0, 2).join(' · ');

    const notification: AppNotification = {
      id: welcomePromoId,
      targetAudience: 'customer',
      type: 'PRICE_DROP',
      title: `✨ ${promoProducts.length} productos en Promo y Liquidación`,
      message: `Ingresos destacados con descuento: ${namesPreview}. Tocá para ver todas las liquidaciones disponibles.`,
      priority: 'normal',
      entityType: 'product',
      entityId: first.id,
      imageUrl: thumb,
      linkUrl: '/?tab=search&filter=offers',
      actionText: 'Ver liquidaciones',
      read: false,
      createdAt: new Date(Date.now() - 60000).toISOString()
    };

    return {
      notification,
      pushPayload: {
        title: notification.title,
        body: notification.message,
        category: 'offer',
        actionText: 'Ver Ofertas',
        url: '/?tab=search&filter=offers',
        icon: '/icon-192.png',
        image: thumb
      },
      shouldPush: false // Daily offer push takes spotlight on initial boot
    };
  }

  // Compare against previous baseline to catch genuinely new promo/liquidation arrivals
  const newlyAddedPromos = promoProducts.filter(p => !previousSeenIds!.has(p.id));
  if (newlyAddedPromos.length === 0) return null;

  const firstNew = newlyAddedPromos[0];
  const info = getProductOfferDetails(firstNew);
  const thumb = firstNew.image || (firstNew.images && firstNew.images[0]) || '/icon-192.png';
  const notifId = `notif-promo-new-${todayAr}-${firstNew.id.slice(0, 12)}`;

  if (existingNotifications.some(n => n.id === notifId)) {
    return null;
  }

  const title =
    newlyAddedPromos.length === 1
      ? `🏷️ ¡Nuevo en Promo/Liquidación!`
      : `✨ ¡Llegaron ${newlyAddedPromos.length} productos en Promo y Liquidación!`;

  const message =
    newlyAddedPromos.length === 1
      ? `${firstNew.name} ingresó con ${info.pct >= 10 ? `${info.pct}% OFF ` : ''}a $${firstNew.salePrice.toLocaleString('es-AR')}.`
      : `Nuevos ingresos con descuento: ${newlyAddedPromos
          .slice(0, 2)
          .map(p => p.name)
          .join(', ')}. ¡Aprovechalos antes que se agoten!`;

  const url = newlyAddedPromos.length === 1 ? `/?product=${firstNew.id}` : '/?tab=search&filter=offers';

  const notification: AppNotification = {
    id: notifId,
    targetAudience: 'customer',
    type: 'PRICE_DROP',
    title,
    message,
    priority: 'high',
    entityType: 'product',
    entityId: firstNew.id,
    imageUrl: thumb,
    linkUrl: url,
    actionText: newlyAddedPromos.length === 1 ? 'Ver producto' : 'Ver promociones',
    read: false,
    createdAt: new Date().toISOString()
  };

  return {
    notification,
    pushPayload: {
      title,
      body: message,
      category: 'offer',
      actionText: 'Ver Novedades',
      url,
      icon: '/icon-192.png',
      image: thumb
    },
    shouldPush: true
  };
}

export function loadReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIF_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function persistReadNotificationIds(ids: string[]) {
  try {
    const existing = loadReadNotificationIds();
    ids.forEach(id => existing.add(id));
    localStorage.setItem(READ_NOTIF_IDS_KEY, JSON.stringify(Array.from(existing).slice(-300)));
  } catch {
    // ignore
  }
}

export function loadSeenOrderStatuses(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SEEN_ORDER_STATUSES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSeenOrderStatuses(map: Record<string, string>) {
  try {
    localStorage.setItem(SEEN_ORDER_STATUSES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}
