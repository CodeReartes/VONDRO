import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Share } from '@capacitor/share';

/**
 * Checks if the current runtime is a native Capacitor container (Android / iOS)
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = (): string => {
  return Capacitor.getPlatform();
};

/**
 * Trigger subtle haptic feedback for mobile interactions
 */
export const triggerHaptic = async (
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light'
) => {
  try {
    if (isNativePlatform()) {
      if (type === 'selection') {
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
      } else if (type === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === 'warning') {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (type === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      } else {
        const styleMap = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy,
        };
        await Haptics.impact({ style: styleMap[type] || ImpactStyle.Light });
      }
    } else if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      // Web vibration fallback for Android Chrome / PWA
      const durations = {
        light: 10,
        medium: 25,
        heavy: 45,
        selection: 8,
        success: [15, 50, 20],
        warning: [30, 60, 30],
        error: [50, 100, 50],
      };
      navigator.vibrate(durations[type] || 15);
    }
  } catch {
    // Fail silently on unsupported devices/browsers
  }
};

/**
 * Configure native status bar & splash screen for Android
 */
export const setupNativeStatusBar = async () => {
  if (!isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#6D28D9' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn('Status bar configuration error:', err);
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Ignore if already hidden
  }
};

/**
 * Handle Android Hardware Back Button
 */
export const setupHardwareBackButton = (
  onBackAction: () => boolean // Return true if back action was handled, false if app should exit
) => {
  if (!isNativePlatform()) return () => {};

  const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
    const handled = onBackAction();
    if (!handled) {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    }
  });

  return () => {
    listenerPromise.then(handle => handle.remove()).catch(() => {});
  };
};

/**
 * Monitor network status
 */
export const listenToNetworkStatus = (
  onStatusChange: (status: ConnectionStatus) => void
) => {
  if (isNativePlatform()) {
    const listenerPromise = Network.addListener('networkStatusChange', onStatusChange);
    Network.getStatus().then(onStatusChange).catch(() => {});
    return () => {
      listenerPromise.then(handle => handle.remove()).catch(() => {});
    };
  } else {
    const handleOnline = () => onStatusChange({ connected: true, connectionType: 'wifi' });
    const handleOffline = () => onStatusChange({ connected: false, connectionType: 'none' });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    onStatusChange({ connected: navigator.onLine, connectionType: 'unknown' });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
};

/**
 * Native or Web Share helper for products & orders
 */
export const shareContent = async (data: { title: string; text: string; url?: string }) => {
  triggerHaptic('light');
  if (isNativePlatform()) {
    try {
      await Share.share({
        title: data.title,
        text: data.text,
        url: data.url,
        dialogTitle: data.title,
      });
      return true;
    } catch (err: any) {
      if (String(err?.message || '').toLowerCase().includes('cancel')) {
        return false;
      }
    }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch {
      return false;
    }
  }
  // Fallback: Copy to clipboard
  try {
    const textToCopy = `${data.title}\n${data.text}${data.url ? `\n${data.url}` : ''}`;
    await navigator.clipboard.writeText(textToCopy);
    return 'copied';
  } catch {
    return false;
  }
};
