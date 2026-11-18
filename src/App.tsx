/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { BottomNavigation } from './components/BottomNavigation';
import { HomeView } from './components/HomeView';
import { NotificationHeadsUp } from './components/NotificationHeadsUp';
import { CartSavedHeadsUp } from './components/CartSavedHeadsUp';
import { 
  setupNativeStatusBar, 
  setupHardwareBackButton, 
  listenToNetworkStatus, 
  triggerHaptic 
} from './utils/native';
import { scrollToTop } from './utils/scrollHelper';
import { WifiOff, CheckCircle2, Gift, Loader2 } from 'lucide-react';

function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const delays = [250, 600, 1200];
    let lastError: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
    }

    // If all retries failed (e.g., stale hashed chunk after deploy), perform a single safe reload
    try {
      const lastReload = Number(sessionStorage.getItem('vondro_chunk_reload_at') || '0');
      if (Date.now() - lastReload > 30000) {
        sessionStorage.setItem('vondro_chunk_reload_at', String(Date.now()));
        window.location.reload();
        return await new Promise<{ default: T }>(() => {});
      }
    } catch {
      // ignore storage errors
    }

    throw lastError;
  });
}

const ProductDetailView = lazyWithRetry(() => import('./components/ProductDetailView').then(m => ({ default: m.ProductDetailView })));
const CartView = lazyWithRetry(() => import('./components/CartView').then(m => ({ default: m.CartView })));
const CheckoutView = lazyWithRetry(() => import('./components/CheckoutView').then(m => ({ default: m.CheckoutView })));
const CategoriesView = lazyWithRetry(() => import('./components/CategoriesView').then(m => ({ default: m.CategoriesView })));
const SearchView = lazyWithRetry(() => import('./components/SearchView').then(m => ({ default: m.SearchView })));
const FavoritesView = lazyWithRetry(() => import('./components/FavoritesView').then(m => ({ default: m.FavoritesView })));
const ProfileView = lazyWithRetry(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const SecurityView = lazyWithRetry(() => import('./components/SecurityView').then(m => ({ default: m.SecurityView })));
const LegalPoliciesView = lazyWithRetry(() => import('./components/LegalPoliciesView').then(m => ({ default: m.LegalPoliciesView })));
const HelpCenterView = lazyWithRetry(() => import('./components/HelpCenterView').then(m => ({ default: m.HelpCenterView })));
const PersonalDataView = lazyWithRetry(() => import('./components/PersonalDataView').then(m => ({ default: m.PersonalDataView })));
const PWAInstallBanner = lazyWithRetry(() => import('./components/PWAInstallBanner').then(m => ({ default: m.PWAInstallBanner })));
const LoginView = lazyWithRetry(() => import('./components/LoginView').then(m => ({ default: m.LoginView })));
const OrdersView = lazyWithRetry(() => import('./components/OrdersView').then(m => ({ default: m.OrdersView })));
const OrderDetailView = lazyWithRetry(() => import('./components/OrderDetailView').then(m => ({ default: m.OrderDetailView })));
const PaymentResultView = lazyWithRetry(() => import('./components/PaymentResultView').then(m => ({ default: m.PaymentResultView })));
const AdminDashboard = lazyWithRetry(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AssistantChat = lazyWithRetry(() => import('./components/Assistant/AssistantChat').then(m => ({ default: m.AssistantChat })));
const DrawerMenu = lazyWithRetry(() => import('./components/DrawerMenu').then(m => ({ default: m.DrawerMenu })));

const ViewFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[45vh] w-full text-slate-400">
    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
  </div>
);

const PRESERVED_BROWSE_TABS = new Set(['home', 'search', 'favorites', 'categories']);

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, previousTab, closeProductDetail, redeemReferralCode } = useStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showNetworkToast, setShowNetworkToast] = useState<boolean>(false);
  const [referralToastMsg, setReferralToastMsg] = useState<string | null>(null);
  const handledUrlRefCode = useRef<string | null>(null);
  const prevActiveTabRef = useRef(activeTab);

  // Auto-detect invitation referral link (?ref=CODE or ?invitacion=CODE)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref') || params.get('invitacion');
    if (!refCode) return;

    const code = refCode.trim().toUpperCase();
    if (!code || handledUrlRefCode.current === code) return;
    handledUrlRefCode.current = code;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      localStorage.setItem('vondro_referred_by', code);
      redeemReferralCode(code).then((res) => {
        if (res.success) {
          setReferralToastMsg(`🎁 ${res.message}`);
          triggerHaptic('success');
          timer = setTimeout(() => setReferralToastMsg(null), 6000);
        } else if (res.message) {
          setReferralToastMsg(`🎁 Invitación ${code} registrada. ${res.message}`);
          timer = setTimeout(() => setReferralToastMsg(null), 6000);
        }
      }).catch((err) => {
        console.warn('Referral auto-redeem notice:', err);
      });
    } catch (err) {
      console.warn('Referral detection notice:', err);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [redeemReferralCode]);

  // Initialize Native Android Status Bar and Network Listeners
  useEffect(() => {
    setupNativeStatusBar();

    const cleanupNetwork = listenToNetworkStatus((status) => {
      setIsOnline(status.connected);
      setShowNetworkToast(true);
      if (!status.connected) {
        triggerHaptic('warning');
      } else {
        triggerHaptic('light');
        const timer = setTimeout(() => setShowNetworkToast(false), 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      cleanupNetwork();
    };
  }, []);

  // Configure Android Hardware Back Button Handling
  useEffect(() => {
    const cleanupBack = setupHardwareBackButton(() => {
      // 1. If side drawer is open, close drawer
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return true;
      }

      // 2. If inside product detail, return to previous view preserving scroll position
      if (activeTab === 'product-detail') {
        if (closeProductDetail) {
          closeProductDetail();
        } else {
          setActiveTab('home');
        }
        return true;
      }
      if (activeTab === 'order-detail' || activeTab === 'security' || activeTab === 'legal' || activeTab === 'help' || activeTab === 'personal-data') {
        scrollToTop();
        setActiveTab('profile');
        return true;
      }
      if (activeTab === 'checkout') {
        scrollToTop();
        setActiveTab('cart');
        return true;
      }

      // 3. If in secondary tab, go back to home
      if (activeTab !== 'home') {
        scrollToTop();
        setActiveTab('home');
        return true;
      }

      // 4. Return false to let Capacitor exit the app naturally
      return false;
    });

    return () => {
      cleanupBack();
    };
  }, [isDrawerOpen, activeTab, setActiveTab]);

  // Ensure view transitions start cleanly from (0, 0), EXCEPT when returning from product-detail
  // back to the browse feed (home/search/favorites/categories), where closeProductDetail restores exact scrollY.
  useEffect(() => {
    const prevTab = prevActiveTabRef.current;
    prevActiveTabRef.current = activeTab;
    if (prevTab === 'product-detail' && activeTab !== 'product-detail') {
      return;
    }
    if (activeTab === 'product-detail') {
      return;
    }
    scrollToTop();
  }, [activeTab]);

  const renderViewForTab = (tab: string) => {
    switch (tab) {
      case 'home':
        return <HomeView />;
      case 'categories':
        return <CategoriesView />;
      case 'search':
        return <SearchView />;
      case 'favorites':
        return <FavoritesView />;
      case 'cart':
        return <CartView />;
      case 'checkout':
        return <CheckoutView />;
      case 'profile':
        return <ProfileView />;
      case 'security':
        return (
          <SecurityView
            onBack={() => {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              setActiveTab('profile');
            }}
          />
        );
      case 'legal':
        return (
          <LegalPoliciesView
            onBack={() => {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              setActiveTab('profile');
            }}
          />
        );
      case 'help':
        return (
          <HelpCenterView
            onBack={() => {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              setActiveTab('profile');
            }}
          />
        );
      case 'personal-data':
        return (
          <PersonalDataView
            onBack={() => {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              setActiveTab('profile');
            }}
          />
        );
      case 'login':
        return <LoginView />;
      case 'orders':
        return <OrdersView />;
      case 'order-detail':
        return <OrderDetailView />;
      case 'payment-result':
        return <PaymentResultView />;
      case 'product-detail':
        return <ProductDetailView />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return <HomeView />;
    }
  };

  const preservedBgTab =
    activeTab === 'product-detail' && previousTab && PRESERVED_BROWSE_TABS.has(previousTab)
      ? previousTab
      : null;

  const renderActiveView = () => (
    <>
      {preservedBgTab && (
        <div className="hidden" aria-hidden="true">
          {renderViewForTab(preservedBgTab)}
        </div>
      )}
      {renderViewForTab(activeTab)}
    </>
  );

  // Prefetch frequently visited views (Search, Categories, ProductDetail) during idle time
  useEffect(() => {
    const prefetch = () => {
      import('./components/SearchView');
      import('./components/CategoriesView');
      import('./components/ProductDetailView');
    };
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(prefetch, { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetch, 600);
    return () => clearTimeout(t);
  }, []);

  const isFullAdmin = activeTab === 'admin';
  const isLoginScreen = activeTab === 'login';
  const isProfile = activeTab === 'profile';

  return (
    <div className={`${isLoginScreen ? 'h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none bg-white sm:bg-slate-100' : 'min-h-screen bg-slate-50 overflow-x-clip'} text-slate-900 flex flex-col font-sans antialiased selection:bg-purple-200 selection:text-purple-900 w-full max-w-full`}>
      {/* Heads-up Push Notification Floating Banner (WhatsApp/Temu style) */}
      <NotificationHeadsUp />

      {/* Heads-up Smart Saved Cart Floating Banner with Free Shipping Calculator */}
      <CartSavedHeadsUp />

      {/* Network Offline / Online Alert Toast */}
      {showNetworkToast && (
        <div 
          className={`fixed top-2 left-4 right-4 z-50 p-2.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold shadow-lg transition-all animate-fadeIn ${
            !isOnline 
              ? 'bg-rose-600 text-white shadow-rose-600/30' 
              : 'bg-emerald-600 text-white shadow-emerald-600/30'
          }`}
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Sin conexión a internet. Mostrando catálogo guardado.</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Conexión restaurada con éxito.</span>
            </>
          )}
        </div>
      )}

      {/* Referral Welcome Toast */}
      {referralToastMsg && (
        <div className="fixed top-14 left-4 right-4 z-50 p-3 bg-gradient-to-r from-purple-800 to-indigo-900 text-white rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-xl border border-amber-300/40 animate-slideDown max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4" />
            </div>
            <span>{referralToastMsg}</span>
          </div>
          <button
            onClick={() => setReferralToastMsg(null)}
            className="text-white/70 hover:text-white text-sm font-black p-1 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header - Fixed/Sticky on all user store views (hidden in profile interface) */}
      {!isFullAdmin && !isLoginScreen && !isProfile && (
        <Header onOpenDrawer={() => setIsDrawerOpen(true)} />
      )}

      {/* Side Slide Drawer */}
      <Suspense fallback={null}>
        <DrawerMenu isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </Suspense>

      {/* Main Content View */}
      <main className={`flex-1 w-full max-w-7xl mx-auto min-w-0 ${isLoginScreen ? 'h-full overflow-hidden' : ''}`}>
        <Suspense fallback={<ViewFallback />}>
          {renderActiveView()}
        </Suspense>
      </main>

      {/* Floating Intelligent Assistant VONDRO - Hidden on login screen */}
      {!isLoginScreen && (
        <Suspense fallback={null}>
          <AssistantChat />
        </Suspense>
      )}

      {/* PWA In-App Install Prompt Banner */}
      <Suspense fallback={null}>
        <PWAInstallBanner />
      </Suspense>

      {/* Mobile-first bottom navigation bar */}
      {!isFullAdmin && !isLoginScreen && activeTab !== 'product-detail' && <BottomNavigation />}
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}

