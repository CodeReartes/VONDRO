import { AnalyticsEventType } from '../types';

export const trackEvent = (event: AnalyticsEventType, data?: Record<string, any>) => {
  try {
    const timestamp = new Date().toISOString();
    const eventPayload = {
      event,
      timestamp,
      data: data || {},
    };

    // Console logging with formatted style for auditing
    console.log(`%c[VONDRO Analytics: ${event}]`, 'color: #7C3AED; font-weight: bold;', eventPayload);

    // Save in sessionStorage/localStorage for telemetry & funnel conversion analysis
    const existingRaw = sessionStorage.getItem('vondro_analytics_events');
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(eventPayload);
    // Keep last 50 events in session
    if (existing.length > 50) existing.shift();
    sessionStorage.setItem('vondro_analytics_events', JSON.stringify(existing));
  } catch {
    // safe fallback
  }
};

export const logPaymentEvent = (
  eventType: 'payment_created' | 'payment_pending' | 'payment_approved' | 'payment_rejected' | 'payment_cancelled' | 'payment_webhook_received' | 'payment_webhook_processed' | 'payment_error',
  info: Record<string, any>
) => {
  const timestamp = new Date().toISOString();
  console.log(
    `%c[VONDRO Payment Log: ${eventType}]%c ${timestamp}`,
    'background: #1e1b4b; color: #a5b4fc; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    'color: #64748b; font-size: 10px;',
    info
  );
};
