import { Order } from '../types';

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
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PushNotificationPayload>('vondro-push-received', { detail: payload }));
  }

  sendBrowserNotification(payload.title, {
    body: payload.body,
    icon: payload.icon || payload.image || '/adaptador-universal-viajero.jpg',
    data: {
      url: payload.url || '/orders',
      category: payload.category
    },
    ...(payload.image ? { image: payload.image } : {})
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
        body: 'Te avisaremos en tiempo real sobre el estado de tus pedidos, PIN de entrega y ofertas relámpago.',
        icon: '/adaptador-universal-viajero.jpg'
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
      sendBrowserNotification('🔔 Notificaciones activadas', {
        body: '¡Listo! Recibirás avisos de despacho y PIN de entrega de tus pedidos.',
        icon: '/adaptador-universal-viajero.jpg'
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
      icon: '/adaptador-universal-viajero.jpg',
      badge: '/adaptador-universal-viajero.jpg',
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
      sendBrowserNotification(`📦 Pedido #${orderNum} en preparación`, {
        body: 'Tu compra está siendo empaquetada en nuestro depósito de Córdoba Capital.',
        tag: `order-${order.id}`
      });
      break;

    case 'shipped':
      sendBrowserNotification(`🛵 ¡Tu pedido #${orderNum} está en camino!`, {
        body: `El repartidor va hacia tu domicilio. Tu PIN de recepción es: ${pin}. Téngalo listo al recibir.`,
        tag: `order-${order.id}`,
        requireInteraction: true
      });
      break;

    case 'delivered':
      sendBrowserNotification(`✅ ¡Pedido #${orderNum} entregado con éxito!`, {
        body: 'Esperamos que disfrutes tu compra en VONDRO. ¡Muchas gracias por confiar en nosotros!',
        tag: `order-${order.id}`
      });
      break;

    case 'payment_received':
      sendBrowserNotification(`💳 Pago confirmado para #${orderNum}`, {
        body: 'Hemos verificado tu pago. Tu pedido pasó a cola de empaque prioritaria.',
        tag: `order-${order.id}`
      });
      break;

    default:
      break;
  }
}
