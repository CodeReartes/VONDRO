import { Order } from '../types';

export const VONDRO_NOTIFICATION_LOGO = '/icon-192.png';

export interface PushNotificationPayload {
  title: string;
  body: string;
  category?: string;
  actionText?: string;
  url?: string;
  icon?: string;
  image?: string;
}

/**
 * Helper to match StoreContext sendPushNotification signature
 */
export function sendPushNotification(payload: PushNotificationPayload) {
  const brandedPayload: PushNotificationPayload = {
    ...payload,
    icon: payload.icon || VONDRO_NOTIFICATION_LOGO
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PushNotificationPayload>('vondro-push-received', { detail: brandedPayload }));
  }

  sendBrowserNotification(brandedPayload.title, {
    body: brandedPayload.body,
    icon: brandedPayload.icon || VONDRO_NOTIFICATION_LOGO,
    badge: VONDRO_NOTIFICATION_LOGO,
    data: {
      url: brandedPayload.url || '/orders',
      category: brandedPayload.category
    },
    ...(brandedPayload.image ? { image: brandedPayload.image } : {})
  } as NotificationOptions);
}
export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}
export const isNotificationSupported = isPushNotificationSupported;

export function getPushNotificationPermission(): NotificationPermission {
  if (!isPushNotificationSupported()) return 'denied';
  return Notification.permission;
}
export const getNotificationPermission = getPushNotificationPermission;

/**
 * Requests permission from the user for browser notifications
 */
export async function requestPushNotificationPermission(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      sendBrowserNotification('🔔 Notificaciones de VONDRO activadas', {
        body: 'Te avisaremos en tiempo real sobre compras, envíos en camino y ofertas diarias.',
        icon: VONDRO_NOTIFICATION_LOGO,
        badge: VONDRO_NOTIFICATION_LOGO
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      sendBrowserNotification('🔔 Notificaciones VONDRO activadas', {
        body: '¡Listo! Recibirás avisos de tus pedidos en camino, compras confirmadas y ofertas de hoy.',
        icon: VONDRO_NOTIFICATION_LOGO,
        badge: VONDRO_NOTIFICATION_LOGO
      });
    }
    return permission;
  } catch {
    return 'denied';
  }
}

/**
 * Dispatches a native browser notification
 */
export function sendBrowserNotification(title: string, options?: NotificationOptions) {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') return;

  try {
    const defaultOptions: NotificationOptions = {
      icon: VONDRO_NOTIFICATION_LOGO,
      badge: VONDRO_NOTIFICATION_LOGO,
      tag: 'vondro-alert',
      ...options
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, defaultOptions);
      }).catch(() => {
        new Notification(title, defaultOptions);
      });
    } else {
      new Notification(title, defaultOptions);
    }
  } catch (err) {
    console.warn('Could not trigger browser notification:', err);
  }
}

/**
 * Triggers a contextual push notification when an order status is updated
 */
export function notifyOrderStatusChange(order: Order, newStatus: string) {
  const pin = order.deliveryConfirmationCode || order.deliveryPin || '4829';
  const orderNum = order.orderNumber || order.id;

  switch (newStatus) {
    case 'preparing':
    case 'PREPARANDO':
    case 'PREPARING':
      sendBrowserNotification(`📦 Pedido ${orderNum} en preparación`, {
        body: 'Tu compra está siendo empaquetada en nuestro depósito de Córdoba Capital.',
        tag: `order-${order.id}`,
        icon: VONDRO_NOTIFICATION_LOGO,
        badge: VONDRO_NOTIFICATION_LOGO
      });
      break;

    case 'shipped':
    case 'ENVIADO':
    case 'out_for_delivery':
    case 'EN_CAMINO':
    case 'OUT_FOR_DELIVERY':
      sendBrowserNotification(`🚚 ¡Tu pedido ${orderNum} está en camino!`, {
        body: `El repartidor va hacia tu domicilio. Tu PIN de recepción es: ${pin}. Tenelo listo al recibir.`,
        tag: `order-${order.id}`,
        icon: VONDRO_NOTIFICATION_LOGO,
        badge: VONDRO_NOTIFICATION_LOGO,
        requireInteraction: true
      });
      break;

    case 'delivered':
    case 'ENTREGADO':
    case 'DELIVERED':
    case 'completed':
    case 'FINALIZADO':
      sendBrowserNotification(`✅ ¡Pedido ${orderNum} entregado con éxito!`, {
        body: 'Esperamos que disfrutes tu compra en VONDRO. ¡Muchas gracias por confiar en nosotros!',
        tag: `order-${order.id}`,
        icon: VONDRO_NOTIFICATION_LOGO,
        badge: VONDRO_NOTIFICATION_LOGO
      });
      break;

    case 'payment_received':
    case 'PAGO_APROBADO':
      sendBrowserNotification(`💳 Pago confirmado para ${orderNum}`, {
        body: 'Hemos verificado tu pago. Tu pedido pasó a cola de empaque prioritaria.',
        tag: `order-${order.id}`,
        icon: VONDRO_NOTIFICATION_LOGO,
        badge: VONDRO_NOTIFICATION_LOGO
      });
      break;

    default:
      break;
  }
}
