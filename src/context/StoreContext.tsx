import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, startTransition } from 'react';
import { deleteUser } from 'firebase/auth';
import { triggerCelebrationConfetti } from '../utils/confetti';
import { 
  generateRealisticInitialReviews, 
  calculateProductRatingSummary 
} from '../utils/reviewsData';
import { 
  recordCategoryVisit, 
  recordProductVisit, 
  getRecentBrowsingCategories 
} from '../lib/recommendationsService';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_COUPONS, 
  INITIAL_COURIERS,
  INITIAL_LOGISTICS_PROVIDERS,
  INITIAL_ORDERS, 
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SUPPLIER_CHECKS,
  INITIAL_SUPPLIER_RETURNS, 
  INITIAL_SETTINGS, 
  INITIAL_SHIPPING_EXPENSES,
  INITIAL_SUPPLIERS,
  INITIAL_USER,
  INITIAL_FAQS,
  INITIAL_ASSISTANT_CONVERSATIONS,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_UNRESOLVED_QUERIES,
  INITIAL_ABANDONED_CARTS
} from '../data/initialMetadata';
import { INSTANT_BOOT_PRODUCTS } from '../data/instantBootProducts';

const BOOT_PRODUCTS_CACHE_KEY = 'vondro_products_boot_v1';
const ACTIVE_TAB_SESSION_KEY = 'vondro_active_tab_session';
const ADMIN_TAB_SESSION_KEY = 'vondro_admin_tab_session';
let cachedFullInitialCatalog: Product[] | null = null;
async function getFullInitialProducts(): Promise<Product[]> {
  if (cachedFullInitialCatalog) return cachedFullInitialCatalog;
  const mod = await import('../data/initialData');
  cachedFullInitialCatalog = mod.INITIAL_PRODUCTS;
  return cachedFullInitialCatalog;
}
import { 
  AbandonedCart,
  AddToCartOptions,
  AdminAction,
  AppNotification,
  AssistantConversation,
  AssistantConversationStatus,
  AssistantMessage,
  CartItem, 
  Category, 
  Coupon, 
  Courier,
  CustomerData, 
  FAQItem,
  LogisticsProvider, 
  Order, 
  OrderReturn,
  OrderStatus, 
  PaymentMethodType, 
  PaymentStatus,
  Product, 
  ProductReview,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  SupplierAvailability,
  SupplierCheck,
  SupplierReturn,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketReason,
  SupportTicketStatus,
  ShippingExpense,
  ShippingStatus,
  ShippingZone, 
  StockMovement,
  StockStatus,
  StoreSettings, 
  Supplier, 
  UnresolvedQuery,
  UserAccount,
  DailyStockAudit,
  DailyStockSchedulerConfig
} from '../types';
import { 
  trackEvent, 
  logPaymentEvent 
} from '../utils/analytics';
import { sendPushNotification } from '../utils/pushNotifications';
import { 
  subscribeToProducts, 
  subscribeToCategories, 
  subscribeToOrders, 
  subscribeToSettings, 
  subscribeToUsers,
  subscribeToSuppliers,
  subscribeToStockMovements,
  subscribeToNotifications,
  subscribeToAdminActions,
  subscribeToOrderReturns,
  subscribeToCouriers,
  subscribeToLogisticsProviders,
  subscribeToShippingExpenses,
  subscribeToSupplierChecks,
  subscribeToPurchaseOrders,
  subscribeToSupplierReturns,
  subscribeToAssistantConversations,
  saveAssistantConversationToFirestore,
  deleteAssistantConversationFromFirestore,
  subscribeToAssistantMessages,
  saveAssistantMessageToFirestore,
  subscribeToSupportTickets,
  saveSupportTicketToFirestore,
  subscribeToFAQs,
  saveFAQToFirestore,
  deleteFAQFromFirestore,
  subscribeToUnresolvedQueries,
  saveUnresolvedQueryToFirestore,
  saveProductToFirestore, 
  updateProductStockInFirestore, 
  deleteProductFromFirestore, 
  purgeOldProductsFromFirestore,
  saveCategoryToFirestore, 
  deleteCategoryFromFirestore, 
  createOrderInFirestore, 
  updateOrderStatusInFirestore,
  updateOrderPaymentInFirestore,
  deleteOrderFromFirestore, 
  saveSettingsToFirestore, 
  seedDatabaseIfEmpty,
  saveUserToFirestore,
  deleteUserFromFirestore,
  subscribeToCoupons,
  saveCouponToFirestore,
  deleteCouponFromFirestore,
  saveSupplierToFirestore,
  deleteSupplierFromFirestore,
  saveCourierToFirestore,
  deleteCourierFromFirestore,
  saveLogisticsProviderToFirestore,
  saveShippingExpenseToFirestore,
  updateOrderShippingInFirestore,
  recordStockMovementInFirestore,
  createNotificationInFirestore,
  markNotificationReadInFirestore,
  markAllNotificationsReadInFirestore,
  recordAdminActionInFirestore,
  registerOrderReturnInFirestore,
  replenishProductStockInFirestore,
  cancelOrderAndRestoreStockInFirestore,
  updateOrderPreparationInFirestore,
  saveSupplierCheckToFirestore,
  savePurchaseOrderToFirestore,
  deletePurchaseOrderFromFirestore,
  saveSupplierReturnToFirestore,
  subscribeToDailyStockAudits,
  saveDailyStockAuditToFirestore,
  saveDailyStockSchedulerToFirestore,
  fetchDailyStockAudits,
  fetchFirestoreProductsSnapshotMap,
  batchSyncProductsToFirestore
} from '../lib/firestoreService';
import {
  computeDailyStockAudit,
  DEFAULT_SCHEDULER_CONFIG,
  DEFAULT_STRATEGIC_SLOTS,
  getCurrentArgentinaTime,
  getSavedDailyAudits,
  saveDailyAuditLocally
} from '../services/dailyStockAuditService';
import { formatCategoryName } from '../utils/textUtils';
import { 
  processNaturalLanguageQuery, 
  searchProducts, 
  checkStock, 
  getShippingCost, 
  getOrderStatus, 
  DEFAULT_QUICK_REPLIES 
} from '../utils/assistantEngine';
import { 
  subscribeToAuth, 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  loginWithFacebook,
  loginWithApple,
  logOutUser, 
  resetPassword,
  checkIsAdminEmail 
} from '../lib/authService';
import { auth } from '../lib/firebase';
import { normalizeProductPricing, normalizeProductsPricingList } from '../utils/pricingUtils';
import { sortProductsWithNewAndRestockedFirst } from '../utils/productSorting';
import { useActiveFlashDealConfig } from '../utils/flashDealTimer';
import { getEffectiveMetricsResetMs, isOrderAfterMetricsBaseline } from '../utils/metricsBaseline';

export type ActiveTab = 
  | 'home' 
  | 'search' 
  | 'categories' 
  | 'favorites' 
  | 'cart' 
  | 'profile' 
  | 'admin' 
  | 'product-detail' 
  | 'order-detail' 
  | 'checkout' 
  | 'payment-result' 
  | 'login' 
  | 'orders'
  | 'security'
  | 'legal'
  | 'help'
  | 'personal-data';

export interface PaymentResultData {
  status: 'approved' | 'pending' | 'rejected' | 'cancelled';
  order: Order;
  paymentId?: string;
  detail?: string;
}

export const getCartItemKey = (item: Pick<CartItem, 'product' | 'selectedSize' | 'selectedColor' | 'selectedVariant' | 'customSpecification' | 'itemKey'>): string => {
  return item.itemKey || `${item?.product?.id || ''}__${item.selectedSize || ''}__${item.selectedColor || ''}__${item.selectedVariant || ''}__${(item.customSpecification || '').trim()}`;
};

interface StoreContextType {
  // Navigation
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  previousTab: ActiveTab;
  selectedProduct: Product | null;
  openProductDetail: (product: Product) => void;
  closeProductDetail: () => void;
  selectedOrder: Order | null;
  openOrderDetail: (order: Order) => void;
  selectedCategoryFilter: string | null;
  setSelectedCategoryFilter: (catId: string | null) => void;
  selectedSubcategoryFilter: string | null;
  setSelectedSubcategoryFilter: (subId: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  searchSortBy: 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'discount' | 'rating';
  setSearchSortBy: (sort: 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'discount' | 'rating') => void;
  searchOnlyInStock: boolean;
  setSearchOnlyInStock: (val: boolean) => void;
  searchOnlyOffers: boolean;
  setSearchOnlyOffers: (val: boolean) => void;
  searchOnlySeasonal: boolean;
  setSearchOnlySeasonal: (val: boolean) => void;
  resetSearchFilters: () => void;
  activeFlashDealIds: string[];

  // Products & Categories
  products: Product[];
  categories: Category[];
  addProduct: (product: Omit<Product, 'id' | 'lastUpdated'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateStock: (id: string, newStock: number) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  syncCategoriesWithInovaCatalog: () => Promise<void>;

  // Cart
  cart: CartItem[];
  selectedCartItemKeys: string[];
  selectedCartItems: CartItem[];
  toggleCartItemSelection: (key: string) => void;
  toggleSelectAllCartItems: () => void;
  removeCartItemsByKeys: (keys: string[]) => void;
  addToCart: (product: Product, quantity?: number, options?: AddToCartOptions) => void;
  removeFromCart: (productId: string, itemKey?: string) => void;
  updateCartQuantity: (productId: string, quantity: number, itemKey?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  freeShippingThreshold: number;
  isFreeShipping: boolean;
  amountForFreeShipping: number;
  progressToFreeShipping: number; // 0 to 100%

  // Favorites
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  clearFavorites: () => void;

  // Coupons & Referrals
  coupons: Coupon[];
  appliedCoupon: Coupon | null;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  discountAmount: number;
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usedCount'>) => void;
  toggleCouponStatus: (id: string) => void;
  deleteCoupon: (id: string) => void;
  redeemReferralCode: (code: string) => Promise<{ success: boolean; message: string; couponCode?: string }>;

  // Shipping & Zones
  shippingZones: ShippingZone[];
  selectedZoneId: string;
  setSelectedZoneId: (zoneId: string) => void;
  currentShippingCost: number;
  updateShippingZone: (zoneId: string, updated: Partial<ShippingZone>) => void;
  addShippingZone: (zone: Omit<ShippingZone, 'id'>) => void;
  deleteShippingZone: (zoneId: string) => void;

  // Orders & Mercado Pago Payments
  orders: Order[];
  createOrder: (
    customer: CustomerData, 
    paymentMethod: PaymentMethodType, 
    shippingZoneId: string, 
    notes?: string,
    transferReceiptImage?: string
  ) => Promise<{ success: boolean; order?: Order; error?: string }>;
  createMercadoPagoPreference: (
    customer: CustomerData,
    shippingZoneId: string,
    notes?: string
  ) => Promise<{ success: boolean; order?: Order; preferenceId?: string; initPoint?: string; isSimulated?: boolean; error?: string }>;
  processPaymentResult: (
    orderId: string,
    simulatedStatus: 'approved' | 'pending' | 'rejected' | 'cancelled'
  ) => Promise<{ success: boolean; order?: Order }>;
  lastPaymentResult: PaymentResultData | null;
  setLastPaymentResult: React.Dispatch<React.SetStateAction<PaymentResultData | null>>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string, extraFields?: { paymentStatus?: PaymentStatus }) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  deletedOrderIds: Set<string>;

  // Settings & Admin
  settings: StoreSettings;
  storeSettings: StoreSettings;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  
  // User Profile & Authentication
  user: UserAccount | null;
  registeredUsers: UserAccount[];
  setUser: (user: UserAccount | null) => void;
  updateUserProfile: (data: Partial<UserAccount>) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<UserAccount>;
  signUpWithEmail: (email: string, pass: string, name: string, phone?: string, dni?: string) => Promise<UserAccount>;
  signInGoogle: () => Promise<UserAccount>;
  signInFacebook: () => Promise<UserAccount>;
  signInApple: () => Promise<UserAccount>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; requiresRecentLogin?: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<void>;
  isFirebaseSynced: boolean;
  syncDatabaseToFirestore: () => Promise<{ seeded: boolean; count: number }>;
  isCartPillVisible: boolean;
  setIsCartPillVisible: (v: boolean) => void;

  // Reset to sample data / Clean Launch
  resetAllData: () => void;
  resetAllSalesAndReviewsToZero: () => Promise<void>;

  // Product Reviews & Dynamic Ratings
  reviewsMap: Record<string, ProductReview[]>;
  addProductReview: (productId: string, review: {
    rating: number;
    comment: string;
    author: string;
    title?: string;
    boughtVariant?: string;
    images?: string[];
    orderId?: string;
  }) => Promise<{ success: boolean; message: string }>;
  likeProductReview: (productId: string, reviewId: string) => void;
  getProductReviews: (productId: string) => ProductReview[];
  getProductRatingSummary: (productId: string) => ReturnType<typeof calculateProductRatingSummary>;
  hasUserPurchasedProduct: (productId: string) => boolean;

  // FASE 5: Suppliers
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSupplier: (id: string, updated: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // FASE 5: Stock Ledger & Replenishment
  stockMovements: StockMovement[];
  replenishStock: (productId: string, quantityToAdd: number, unitCost?: number, supplierId?: string, notes?: string) => Promise<void>;
  adjustStock: (productId: string, newStock: number, reason: string) => Promise<void>;

  // FASE 5: Notifications & Operational Alerts
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  createNotification: (notification: Omit<AppNotification, 'id' | 'createdAt'>) => Promise<string>;
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // FASE 5: Audit Actions & Order Returns
  adminActions: AdminAction[];
  orderReturns: OrderReturn[];
  registerOrderReturn: (returnData: Omit<OrderReturn, 'id' | 'createdAt'>) => Promise<string>;

  // FASE 5: Bulk Operations & CSV Import
  bulkUpdateProducts: (updates: { id: string; priceMultiplier?: number; stockDelta?: number; supplierId?: string; status?: StockStatus }[]) => Promise<void>;
  importProductsCSV: (parsedItems: any[]) => Promise<{ added: number; updated: number; errors: string[] }>;

  // FASE 5: Order Preparation & Cancellations
  cancelOrderWithStockRefund: (order: Order, reason: string) => Promise<void>;
  updateOrderPreparation: (orderId: string, itemChecks: Record<string, boolean>, allPrepared: boolean) => Promise<void>;

  // FASE 6: Logistics, Shipping & Couriers
  couriers: Courier[];
  addCourier: (courier: Omit<Courier, 'id' | 'createdAt'>) => Promise<string>;
  updateCourier: (id: string, updated: Partial<Courier>) => Promise<void>;
  deleteCourier: (id: string) => Promise<void>;

  logisticsProviders: LogisticsProvider[];
  addLogisticsProvider: (provider: Omit<LogisticsProvider, 'id' | 'createdAt'>) => Promise<string>;
  updateLogisticsProvider: (id: string, updated: Partial<LogisticsProvider>) => Promise<void>;

  shippingExpenses: ShippingExpense[];
  addShippingExpense: (expense: Omit<ShippingExpense, 'id' | 'createdAt'>) => Promise<string>;

  updateShippingStatus: (orderId: string, newShippingStatus: ShippingStatus, note?: string, extraFields?: Partial<Order>) => Promise<void>;
  updateOrderPackageInfo: (orderId: string, info: { packageCount?: number; packageWeight?: number; packageSize?: string; packageNotes?: string }) => Promise<void>;
  assignCourierToOrder: (orderId: string, courierId: string | null) => Promise<void>;

  // FASE 7: Inova ARG Supplier & Sourcing Management
  supplierChecks: SupplierCheck[];
  addSupplierCheck: (check: Omit<SupplierCheck, 'id' | 'checkedAt'>) => Promise<string>;
  verifyProductAvailability: (productId: string, availability: SupplierAvailability, observedCost?: number, notes?: string) => Promise<void>;

  purchaseOrders: PurchaseOrder[];
  createPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePurchaseOrder: (id: string, updated: Partial<PurchaseOrder>) => Promise<void>;
  receivePurchaseOrder: (id: string, receivedItems: { productId: string; receivedQuantity: number; actualCostPrice?: number }[], notes?: string) => Promise<void>;
  deletePurchaseOrder: (id: string) => Promise<void>;
  generatePurchaseOrderFromPendingOrders: (supplierId: string) => Promise<PurchaseOrder | null>;

  supplierReturns: SupplierReturn[];
  addSupplierReturn: (ret: Omit<SupplierReturn, 'id' | 'createdAt'>) => Promise<string>;

  calculatePriceWithMargin: (costPrice: number, targetMarginPct: number, rounding?: number) => {
    suggestedPrice: number;
    roundedPrice: number;
    grossProfit: number;
    markupPct: number;
    marginOnSalePct: number;
  };

  // FASE 7.5: Assistant & Omnichannel Support
  conversations: AssistantConversation[];
  currentConversationId: string;
  setCurrentConversationId: (id: string) => void;
  conversationMessages: AssistantMessage[];
  supportTickets: SupportTicket[];
  faqs: FAQItem[];
  unresolvedQueries: UnresolvedQuery[];
  isAssistantOpen: boolean;
  setIsAssistantOpen: (open: boolean) => void;
  toggleAssistant: () => void;
  unreadAssistantMessagesCount: number;
  sendAssistantUserMessage: (text: string, quickActionData?: { actionType?: AssistantMessage['actionType']; actionData?: any }) => Promise<void>;
  sendAssistantAdminMessage: (conversationId: string, text: string) => Promise<void>;
  setConversationAiPaused: (conversationId: string, isPaused: boolean) => Promise<void>;
  updateConversationStatus: (conversationId: string, status: AssistantConversationStatus) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearAssistantChat: () => void;
  createSupportTicket: (ticketData: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt'>) => Promise<SupportTicket>;
  updateTicketStatus: (ticketId: string, status: SupportTicketStatus, adminNotes?: string, resolutionNotes?: string) => Promise<void>;
  addOrUpdateFAQ: (faq: Partial<FAQItem> & { question: string; answer: string; category: FAQItem['category'] }) => Promise<void>;
  deleteFAQ: (faqId: string) => Promise<void>;
  resolveUnresolvedQuery: (queryId: string, adminAnswer?: string, createFaq?: boolean) => Promise<void>;
  quickOpenAssistantWithPrompt: (promptText: string) => void;
  // FASE 8: Abandoned Carts & Recovery
  abandonedCarts: AbandonedCart[];
  recordAbandonedCart: (cartItems: CartItem[], customerName?: string, phone?: string, email?: string) => Promise<string>;
  recoverAbandonedCart: (cartId: string) => Promise<void>;
  resolveStockIssue: (orderId: string, action: 'CONTACT_CLIENT' | 'WAIT_RESTOCK' | 'REPLACE_PRODUCT' | 'CANCEL_ORDER' | 'REFUND', notes?: string) => Promise<void>;
  confirmOrderStock: (orderId: string, isAvailable: boolean) => Promise<void>;
  // FASE 9: Dynamic Recommendations & Browsing History
  recentBrowsingCategories: string[];
  recommendationRefreshTrigger: number;
  refreshRecommendationsFeed: () => void;
  recordCategoryVisit: (categoryId: string) => void;

  // FASE 10: Daily Stock & Catalog Audit
  dailyAudits: DailyStockAudit[];
  latestDailyAudit: DailyStockAudit | null;
  isAnalyzingDailyStock: boolean;
  isSyncingFirestoreStock: boolean;
  lastFirestoreStockSyncAt: string | null;
  lastFirestoreStockSyncCount: number;
  dailyStockSchedulerConfig: DailyStockSchedulerConfig;
  runDailyStockAnalysis: (customProducts?: Product[], force?: boolean, slot?: { time: string; name: string }) => Promise<DailyStockAudit | null>;
  triggerStrategicSlot: (slotTime: string) => Promise<DailyStockAudit | null>;
  updateDailyStockSchedulerConfig: (newConfig: Partial<DailyStockSchedulerConfig>) => Promise<void>;
  fetchDailyStockAuditsList: () => Promise<void>;
  syncInovaAndApiProductsToFirestore: (options?: { forceInovaRefresh?: boolean; silent?: boolean }) => Promise<{ syncedCount: number; liveSynced: boolean; skipped?: boolean; error?: string }>;

  // Gamification: Spin Wheel & Welcome Pack
  isSpinWheelOpen: boolean;
  openSpinWheel: () => void;
  closeSpinWheel: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const LOCAL_STORAGE_KEYS = {
  PRODUCTS: 'vondro_products_v2',
  CATEGORIES: 'vondro_categories_v2',
  CART: 'vondro_cart_v2',
  FAVORITES: 'vondro_favorites_v2',
  ORDERS: 'vondro_orders_v2',
  COUPONS: 'vondro_coupons_v2',
  SETTINGS: 'vondro_settings_v2',
  USER: 'vondro_user_v2',
  ZONE_ID: 'vondro_selected_zone_v2',
  IS_ADMIN: 'vondro_is_admin_v2',
  SUPPLIERS: 'vondro_suppliers_v2',
  STOCK_MOVEMENTS: 'vondro_stock_movements_v2',
  NOTIFICATIONS: 'vondro_notifications_v2',
  ADMIN_ACTIONS: 'vondro_admin_actions_v2',
  RETURNS: 'vondro_returns_v2',
  COURIERS: 'vondro_couriers_v2',
  LOGISTICS_PROVIDERS: 'vondro_logistics_providers_v2',
  SHIPPING_EXPENSES: 'vondro_shipping_expenses_v2',
  SUPPLIER_CHECKS: 'vondro_supplier_checks_v2',
  PURCHASE_ORDERS: 'vondro_purchase_orders_v2',
  SUPPLIER_RETURNS: 'vondro_supplier_returns_v2',
  ASSISTANT_CONVERSATIONS: 'vondro_assistant_conversations_v2',
  ASSISTANT_CURRENT_CONVERSATION_ID: 'vondro_assistant_current_conv_id_v2',
  SUPPORT_TICKETS: 'vondro_support_tickets_v2',
  FAQS: 'vondro_faqs_v2',
  UNRESOLVED_QUERIES: 'vondro_unresolved_queries_v2',
  ABANDONED_CARTS: 'vondro_abandoned_carts_v2',
  REVIEWS: 'vondro_product_reviews_v2',
  RECENT_SEARCHES: 'vondro_recent_searches_v1'
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation State (persist active tab across soft reloads within same browser session)
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => {
    try {
      const savedUserRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
      if (!savedUserRaw) return 'login';
      const savedUser = JSON.parse(savedUserRaw);
      const savedTab = sessionStorage.getItem(ACTIVE_TAB_SESSION_KEY) as ActiveTab | null;
      const nonRestorable: ActiveTab[] = ['product-detail', 'order-detail', 'payment-result', 'login'];
      if (savedTab && !nonRestorable.includes(savedTab)) {
        if (savedTab === 'admin') {
          const canRestoreAdmin = Boolean(
            savedUser && (savedUser.role === 'admin' || checkIsAdminEmail(savedUser.email))
          );
          return canRestoreAdmin ? 'admin' : 'home';
        }
        return savedTab;
      }
      return 'home';
    } catch {
      return 'login';
    }
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [previousTab, setPreviousTab] = useState<ActiveTab>('home');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSortBy, setSearchSortBy] = useState<'featured' | 'newest' | 'price-asc' | 'price-desc' | 'discount' | 'rating'>('featured');
  const [searchOnlyInStock, setSearchOnlyInStock] = useState<boolean>(false);
  const [searchOnlyOffers, setSearchOnlyOffers] = useState<boolean>(false);
  const [searchOnlySeasonal, setSearchOnlySeasonal] = useState<boolean>(false);

  // Local Search History (Last 5 searches)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.RECENT_SEARCHES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(s => typeof s === 'string' && s.trim().length > 0).slice(0, 5);
        }
      }
    } catch (_) {}
    return [];
  });

  const addRecentSearch = useCallback((query: string) => {
    const clean = query.trim();
    if (!clean || clean.length < 2) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    const clean = query.trim().toLowerCase();
    setRecentSearches(prev => {
      const updated = prev.filter(s => s.toLowerCase() !== clean);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.RECENT_SEARCHES);
    } catch (_) {}
  }, []);

  // Debounced auto-save for search query so typed searches get remembered
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timeout = setTimeout(() => {
      addRecentSearch(trimmed);
    }, 1200);
    return () => clearTimeout(timeout);
  }, [searchQuery, addRecentSearch]);

  // Recommendations & Browsing History State
  const [recentBrowsingCategories, setRecentBrowsingCategories] = useState<string[]>(() => getRecentBrowsingCategories());
  const [recommendationRefreshTrigger, setRecommendationRefreshTrigger] = useState<number>(0);

  const refreshRecommendationsFeed = () => {
    setRecommendationRefreshTrigger(prev => prev + 1);
  };

  const setActiveTab = useCallback((tabOrUpdater: ActiveTab | ((prev: ActiveTab) => ActiveTab)) => {
    setActiveTabState(current => {
      const nextTab = typeof tabOrUpdater === 'function' ? tabOrUpdater(current) : tabOrUpdater;
      if (nextTab === 'home') {
        setRecommendationRefreshTrigger(prev => prev + 1);
      }
      setPreviousTab(current);
      try {
        const transientTabs: ActiveTab[] = ['product-detail', 'order-detail', 'payment-result'];
        if (!transientTabs.includes(nextTab)) {
          sessionStorage.setItem(ACTIVE_TAB_SESSION_KEY, nextTab);
        }
      } catch {}
      return nextTab;
    });
  }, []);

  const handleRecordCategoryVisit = (catId: string) => {
    if (!catId) return;
    recordCategoryVisit(catId);
    setRecentBrowsingCategories(getRecentBrowsingCategories());
  };

  const resetSearchFilters = () => {
    setSearchQuery('');
    setSelectedCategoryFilter(null);
    setSelectedSubcategoryFilter(null);
    setSearchSortBy('featured');
    setSearchOnlyInStock(false);
    setSearchOnlyOffers(false);
    setSearchOnlySeasonal(false);
  };
  const [isFirebaseSynced, setIsFirebaseSynced] = useState<boolean>(false);

  // User state
  const [user, setUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Admin Mode state strictly derived from verified user account (only true for admin role or admin email)
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return Boolean(user.role === 'admin' || checkIsAdminEmail(user.email));
  }, [user]);

  const setIsAdmin = (val: boolean) => {
    try {
      if (val && user && (user.role === 'admin' || checkIsAdminEmail(user.email))) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.IS_ADMIN, 'true');
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.IS_ADMIN);
      }
    } catch {
      // safe
    }
  };

  // Ensure stale localStorage admin flags are wiped if not an admin account
  useEffect(() => {
    try {
      const isRealAdmin = Boolean(user && (user.role === 'admin' || checkIsAdminEmail(user.email)));
      if (!isRealAdmin) {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.IS_ADMIN);
      }
    } catch {}
  }, [user]);

  // Gamification: Spin Wheel & Welcome Pack
  const [isSpinWheelOpen, setIsSpinWheelOpen] = useState<boolean>(false);
  const openSpinWheel = () => setIsSpinWheelOpen(true);
  const closeSpinWheel = () => setIsSpinWheelOpen(false);

  // Core Data loaded from localStorage or initialData
  const CURRENT_CATALOG_VERSION = 'vondro_catalog_2026_10_22_quencher_images_fixed_v10';
  const sanitizeDepletedProducts = (list: Product[]): Product[] => {
    return list.map(p => {
      if (p.id === 'prod-inova-soldadora-inverter-or-200wd' || p.stock <= 0) {
        return {
          ...p,
          stock: 0,
          stockStatus: 'out_of_stock' as const,
          hideIfOutOfStock: true,
          isFeatured: false,
          isOnSale: false,
          isFlashSale: false
        };
      }
      if (p.id === 'prod-inova-10029783') {
        return {
          ...p,
          images: [
            "https://inovaarg.com/wp-content/uploads/2026/02/WhatsApp-Image-2025-11-22-at-13.39.25-1.webp",
            "https://inovaarg.com/wp-content/uploads/2026/02/WhatsApp-Image-2025-11-22-at-13.39.25.webp",
            "https://inovaarg.com/wp-content/uploads/2026/02/WhatsApp-Image-2025-11-22-at-13.39.24.webp"
          ]
        };
      }
      if (p.id === 'prod-inova-10029781') {
        return {
          ...p,
          images: [
            "https://inovaarg.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-08-22-at-3.02.43-PM.jpeg",
            "https://inovaarg.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-08-22-at-3.02.43-PM-1.jpeg",
            "https://inovaarg.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-08-22-at-3.02.43-PM-2.jpeg"
          ]
        };
      }
      if (p.id === 'prod-inova-10029778') {
        return {
          ...p,
          images: [
            "https://inovaarg.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-08-22-at-3.32.54-PM-1.jpeg",
            "https://inovaarg.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-08-22-at-3.32.54-PM-2.jpeg",
            "https://inovaarg.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-08-22-at-3.32.55-PM.jpeg"
          ]
        };
      }
      return p;
    });
  };

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const savedVersion = localStorage.getItem('vondro_catalog_sync_version');
      const bootSaved = localStorage.getItem(BOOT_PRODUCTS_CACHE_KEY);

      if (bootSaved && savedVersion === CURRENT_CATALOG_VERSION) {
        const parsedBoot: Product[] = JSON.parse(bootSaved);
        if (Array.isArray(parsedBoot) && parsedBoot.length > 0) {
          return parsedBoot;
        }
      }

      // Instant 0ms startup with curated 40-item shell (no 3.8MB blocking JSON parse/sort)
      const sanitizedBoot = normalizeProductsPricingList(sanitizeDepletedProducts(INSTANT_BOOT_PRODUCTS));
      try {
        localStorage.setItem('vondro_catalog_sync_version', CURRENT_CATALOG_VERSION);
        localStorage.setItem(BOOT_PRODUCTS_CACHE_KEY, JSON.stringify(sanitizedBoot));
      } catch (_) {}
      return sanitizedBoot;
    } catch {
      return normalizeProductsPricingList(sanitizeDepletedProducts(INSTANT_BOOT_PRODUCTS));
    }
  });

  // Deferred background hydration of full 1,700+ catalog after initial paint
  const hasRemoteProductsSnapshotRef = useRef<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    const hydrateFullCatalog = async () => {
      try {
        // Remove legacy 3MB product blob if present so mobile storage & startup stay fast
        try { localStorage.removeItem(LOCAL_STORAGE_KEYS.PRODUCTS); } catch (_) {}

        const initialFull = await getFullInitialProducts();
        const fullList = sortProductsWithNewAndRestockedFirst(
          normalizeProductsPricingList(sanitizeDepletedProducts(initialFull))
        );
        try {
          localStorage.setItem('vondro_catalog_sync_version', CURRENT_CATALOG_VERSION);
        } catch (_) {}

        if (cancelled || hasRemoteProductsSnapshotRef.current || !fullList) return;
        const hydrated = fullList;
        startTransition(() => {
          setProducts(prev => (prev.length >= hydrated.length ? prev : hydrated));
        });
      } catch (err) {
        console.warn('[StoreContext] Deferred catalog hydration notice:', err);
      }
    };

    const timer = setTimeout(() => {
      const w = window as any;
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(() => { if (!cancelled) hydrateFullCatalog(); }, { timeout: 600 });
      } else {
        hydrateFullCatalog();
      }
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Product Reviews Map state (starts clean for launch, stores real customer reviews)
  const [reviewsMap, setReviewsMap] = useState<Record<string, ProductReview[]>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.REVIEWS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return {};
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.CATEGORIES);
      if (saved) {
        const parsed: Category[] = JSON.parse(saved);
        const map = new Map<string, Category>();
        INITIAL_CATEGORIES.forEach(c => map.set(c.id, c));
        parsed.forEach(c => {
          const init = map.get(c.id);
          if (init) {
            map.set(c.id, {
              ...init,
              ...c,
              name: init.name, // Guarantee exact official Inova category naming
              subcategories: (c.subcategories && c.subcategories.length > 0) ? c.subcategories : init.subcategories,
              order: c.order !== undefined ? c.order : init.order
            });
          } else {
            map.set(c.id, c);
          }
        });
        const merged = Array.from(map.values()).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(merged));
        } catch (_) {}
        return merged;
      }
      return INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.CART);
      if (saved) {
        const parsed: CartItem[] = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter(item => item && item.product && item.product.id) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  const [selectedCartItemKeys, setSelectedCartItemKeys] = useState<string[]>(() =>
    cart.filter(item => item && item.product).map(getCartItemKey)
  );

  // Sync selected keys when cart items are added or removed
  useEffect(() => {
    setSelectedCartItemKeys(prev => {
      const currentKeys = cart.filter(item => item && item.product).map(getCartItemKey);
      const existing = prev.filter(k => currentKeys.includes(k));
      const newlyAdded = currentKeys.filter(k => !prev.includes(k));
      const next = [...existing, ...newlyAdded];
      if (next.length === prev.length && next.every((k, idx) => k === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [cart]);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.FAVORITES);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(id => typeof id === 'string' && id.trim().length > 0);
          return filtered.length > 0 ? filtered : ['prod-inova-adaptador-universal'];
        }
      }
      return ['prod-inova-adaptador-universal'];
    } catch {
      return ['prod-inova-adaptador-universal'];
    }
  });

  // Track explicitly deleted cancelled orders so they never get restored by stale snapshots
  const [deletedOrderIds, setDeletedOrderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('vondro_deleted_order_ids_v2');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const persistDeletedOrderId = useCallback((id: string) => {
    setDeletedOrderIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('vondro_deleted_order_ids_v2', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
  }, []);

  const safeSaveOrdersToLocalStorage = useCallback((orderList: Order[]) => {
    try {
      const savedDeleted = localStorage.getItem('vondro_deleted_order_ids_v2');
      const delSet = savedDeleted ? new Set<string>(JSON.parse(savedDeleted)) : deletedOrderIds;
      const filtered = orderList.filter(o => o && o.id && !delSet.has(o.id));
      localStorage.setItem(LOCAL_STORAGE_KEYS.ORDERS, JSON.stringify(filtered));
    } catch (err) {
      console.warn('LocalStorage quota warning for orders, storing lightweight version:', err);
      try {
        const savedDeleted = localStorage.getItem('vondro_deleted_order_ids_v2');
        const delSet = savedDeleted ? new Set<string>(JSON.parse(savedDeleted)) : deletedOrderIds;
        const lightweight = orderList
          .filter(o => o && o.id && !delSet.has(o.id))
          .map(o => {
            if (o.transferReceiptImage && o.transferReceiptImage.length > 20000) {
              return {
                ...o,
                transferReceiptImage: o.transferReceiptImage.slice(0, 100) + '...[compact]'
              };
            }
            return o;
          });
        localStorage.setItem(LOCAL_STORAGE_KEYS.ORDERS, JSON.stringify(lightweight));
      } catch (_) {}
    }
  }, [deletedOrderIds]);

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const savedDeleted = localStorage.getItem('vondro_deleted_order_ids_v2');
      const delSet = savedDeleted ? new Set<string>(JSON.parse(savedDeleted)) : new Set<string>();
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.ORDERS);
      if (saved) {
        const parsed: Order[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(o => o && o.id && !delSet.has(o.id));
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.COUPONS);
      return saved ? JSON.parse(saved) : INITIAL_COUPONS;
    } catch {
      return INITIAL_COUPONS;
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // FASE 5: Suppliers, Stock Movements, Notifications, Audit, Returns
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPPLIERS);
      return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.NOTIFICATIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [adminActions, setAdminActions] = useState<AdminAction[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_ACTIONS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orderReturns, setOrderReturns] = useState<OrderReturn[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.RETURNS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // FASE 6: Couriers, Logistics Providers & Shipping Expenses
  const [couriers, setCouriers] = useState<Courier[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.COURIERS);
      return saved ? JSON.parse(saved) : INITIAL_COURIERS;
    } catch {
      return INITIAL_COURIERS;
    }
  });

  const [logisticsProviders, setLogisticsProviders] = useState<LogisticsProvider[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LOGISTICS_PROVIDERS);
      return saved ? JSON.parse(saved) : INITIAL_LOGISTICS_PROVIDERS;
    } catch {
      return INITIAL_LOGISTICS_PROVIDERS;
    }
  });

  const [shippingExpenses, setShippingExpenses] = useState<ShippingExpense[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SHIPPING_EXPENSES);
      return saved ? JSON.parse(saved) : INITIAL_SHIPPING_EXPENSES;
    } catch {
      return INITIAL_SHIPPING_EXPENSES;
    }
  });

  const [supplierChecks, setSupplierChecks] = useState<SupplierCheck[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPPLIER_CHECKS);
      return saved ? JSON.parse(saved) : INITIAL_SUPPLIER_CHECKS;
    } catch {
      return INITIAL_SUPPLIER_CHECKS;
    }
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.PURCHASE_ORDERS);
      return saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
    } catch {
      return INITIAL_PURCHASE_ORDERS;
    }
  });

  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPPLIER_RETURNS);
      return saved ? JSON.parse(saved) : INITIAL_SUPPLIER_RETURNS;
    } catch {
      return INITIAL_SUPPLIER_RETURNS;
    }
  });

  // FASE 7.5: Assistant State with strong persistence across reloads
  const [conversations, setConversations] = useState<AssistantConversation[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.ASSISTANT_CONVERSATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return INITIAL_ASSISTANT_CONVERSATIONS;
  });

  const [currentConversationId, setCurrentConversationId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(LOCAL_STORAGE_KEYS.ASSISTANT_CURRENT_CONVERSATION_ID);
      if (savedId) return savedId;
    } catch {}
    return conversations[0]?.id || 'conv-main';
  });

  const [conversationMessages, setConversationMessages] = useState<AssistantMessage[]>(() => {
    try {
      const savedId = localStorage.getItem(LOCAL_STORAGE_KEYS.ASSISTANT_CURRENT_CONVERSATION_ID);
      const targetId = savedId || conversations[0]?.id || 'conv-main';
      const currentConv = conversations.find(c => c?.id === targetId);
      if (currentConv?.messages && currentConv.messages.length > 0) {
        return currentConv.messages;
      }
    } catch {}
    return conversations[0]?.messages || [];
  });

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SUPPORT_TICKETS);
      return saved ? JSON.parse(saved) : INITIAL_SUPPORT_TICKETS;
    } catch {
      return INITIAL_SUPPORT_TICKETS;
    }
  });

  const [faqs, setFaqs] = useState<FAQItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.FAQS);
      return saved ? JSON.parse(saved) : INITIAL_FAQS;
    } catch {
      return INITIAL_FAQS;
    }
  });

  const [unresolvedQueries, setUnresolvedQueries] = useState<UnresolvedQuery[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.UNRESOLVED_QUERIES);
      return saved ? JSON.parse(saved) : INITIAL_UNRESOLVED_QUERIES;
    } catch {
      return INITIAL_UNRESOLVED_QUERIES;
    }
  });

  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.ABANDONED_CARTS);
      return saved ? JSON.parse(saved) : INITIAL_ABANDONED_CARTS;
    } catch {
      return INITIAL_ABANDONED_CARTS;
    }
  });

  // FASE 10: Daily Stock & Catalog Audit State
  const [dailyAudits, setDailyAudits] = useState<DailyStockAudit[]>(() => getSavedDailyAudits());
  const [latestDailyAudit, setLatestDailyAudit] = useState<DailyStockAudit | null>(() => getSavedDailyAudits()[0] || null);
  const [isAnalyzingDailyStock, setIsAnalyzingDailyStock] = useState<boolean>(false);
  const [isSyncingFirestoreStock, setIsSyncingFirestoreStock] = useState<boolean>(false);
  const [lastFirestoreStockSyncAt, setLastFirestoreStockSyncAt] = useState<string | null>(null);
  const [lastFirestoreStockSyncCount, setLastFirestoreStockSyncCount] = useState<number>(0);
  const [hasRemoteProductsSnapshot, setHasRemoteProductsSnapshot] = useState<boolean>(false);
  const firestoreRemoteProductsRef = useRef<Map<string, Product>>(new Map());
  const serverLiveCatalogRef = useRef<Map<string, Product>>(new Map());
  const isSyncingFirestoreStockRef = useRef<boolean>(false);
  const lastFirestoreSyncAttemptMsRef = useRef<number>(0);
  const [dailyStockSchedulerConfig, setDailyStockSchedulerConfig] = useState<DailyStockSchedulerConfig>(() => {
    try {
      const saved = localStorage.getItem('vondro_daily_stock_scheduler_config');
      return saved ? JSON.parse(saved) : DEFAULT_SCHEDULER_CONFIG;
    } catch {
      return DEFAULT_SCHEDULER_CONFIG;
    }
  });

  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const unreadAssistantMessagesCount = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCountAdmin || 0), 0),
    [conversations]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const trackEvent = (event: string, data?: any) => {
    console.log(`[VONDRO Analytics: ${event}]`, data);
  };

  const logPaymentEvent = (event: string, data?: any) => {
    console.log(`[VONDRO Payment Event: ${event}]`, data);
  };

  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_SETTINGS,
          ...parsed,
          address: 'Centro de Distribución VONDRO, Córdoba Capital',
          freeShippingThreshold: parsed.freeShippingThreshold || INITIAL_SETTINGS.freeShippingThreshold,
          zones: INITIAL_SETTINGS.zones
        };
      }
      return INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('vondro_registered_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedZoneId, setSelectedZoneId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.ZONE_ID);
      return saved || (settings?.zones?.[0]?.id || 'zona-1');
    } catch {
      return 'zona-1';
    }
  });

  const [lastPaymentResult, setLastPaymentResult] = useState<PaymentResultData | null>(null);
  const [isCartPillVisible, setIsCartPillVisible] = useState<boolean>(false);
  const globalFlashTimer = useActiveFlashDealConfig(products);

  useEffect(() => {
    try {
      localStorage.setItem('vondro_registered_users', JSON.stringify(registeredUsers));
    } catch (err) {
      console.warn('Error saving registered users:', err);
    }
  }, [registeredUsers]);

  // Check URL query parameters for payment return callbacks or product deep links
  useEffect(() => {
    if (!window.location.search) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentResultParam = urlParams.get('payment_result') as 'approved' | 'pending' | 'rejected' | null;
      const orderIdParam = urlParams.get('order_id');
      const orderNumberParam = urlParams.get('order_number');

      if (paymentResultParam && (orderIdParam || orderNumberParam)) {
        const foundOrder = orders.find(o => o.id === orderIdParam || o.orderNumber === orderNumberParam);
        if (foundOrder) {
          setLastPaymentResult({
            status: paymentResultParam,
            order: foundOrder,
            detail: paymentResultParam === 'approved' 
              ? 'Pago confirmado vía Mercado Pago' 
              : paymentResultParam === 'pending'
              ? 'Aguardando confirmación de Mercado Pago'
              : 'El pago no pudo ser procesado'
          });
          setActiveTab('payment-result');
        }
      }

      // Check URL query parameters for product deep links (?product=xxx or ?p=xxx)
      const productIdParam = urlParams.get('product') || urlParams.get('p');
      if (productIdParam && products.length > 0) {
        const matched = products.find(p => p.id === productIdParam);
        if (matched) {
          setSelectedProduct(matched);
          setActiveTab('product-detail');
        }
      }
    } catch {
      // safe
    }
  }, [orders, products, setActiveTab]);


  // Persist only lightweight 40-item boot shell to localStorage (never serialize full 3MB catalog on main thread)
  useEffect(() => {
    if (!products || products.length === 0) return;
    const persistTimer = setTimeout(() => {
      const writeCaches = () => {
        try {
          const bootSlice = products.filter(p => p && p.stock > 0 && !p.hideIfOutOfStock).slice(0, 40);
          if (bootSlice.length > 0) {
            localStorage.setItem(BOOT_PRODUCTS_CACHE_KEY, JSON.stringify(bootSlice));
          }
        } catch (e) {}
      };
      const w = window as any;
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(writeCaches, { timeout: 2000 });
      } else {
        writeCaches();
      }
    }, 1200);
    return () => clearTimeout(persistTimer);
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {}
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CART, JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  useEffect(() => {
    safeSaveOrdersToLocalStorage(orders);
  }, [orders, safeSaveOrdersToLocalStorage]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
    } catch (e) {}
  }, [coupons]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {}
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ZONE_ID, selectedZoneId);
    } catch (e) {}
  }, [selectedZoneId]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    } catch (e) {}
  }, [suppliers]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify(stockMovements));
    } catch (e) {}
  }, [stockMovements]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch (e) {}
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ADMIN_ACTIONS, JSON.stringify(adminActions));
    } catch (e) {}
  }, [adminActions]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.RETURNS, JSON.stringify(orderReturns));
    } catch (e) {}
  }, [orderReturns]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.COURIERS, JSON.stringify(couriers));
    } catch (e) {}
  }, [couriers]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.LOGISTICS_PROVIDERS, JSON.stringify(logisticsProviders));
    } catch (e) {}
  }, [logisticsProviders]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SHIPPING_EXPENSES, JSON.stringify(shippingExpenses));
    } catch (e) {}
  }, [shippingExpenses]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SUPPLIER_CHECKS, JSON.stringify(supplierChecks));
    } catch (e) {}
  }, [supplierChecks]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PURCHASE_ORDERS, JSON.stringify(purchaseOrders));
    } catch (e) {}
  }, [purchaseOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SUPPLIER_RETURNS, JSON.stringify(supplierReturns));
    } catch (e) {}
  }, [supplierReturns]);

  // One-shot startup verification for low-stock flash flags (avoids recurring 30s full-catalog scans)
  useEffect(() => {
    const verifyStockLevels = () => {
      setProducts(prevProducts => {
        let changed = false;
        const updated = prevProducts.map(prod => {
          const isLow = prod.stock > 0 && prod.stock <= 10;
          if (isLow && (!prod.isFlashSale || prod.stockStatus !== 'low_stock')) {
            changed = true;
            return {
              ...prod,
              isFlashSale: true,
              stockStatus: 'low_stock' as const,
              promoBadges: Array.from(new Set([...(prod.promoBadges || []), 'OFERTA_RELAMPAGO'])) as any
            };
          }
          return prod;
        });
        return changed ? updated : prevProducts;
      });
    };

    const bootDelay = setTimeout(verifyStockLevels, 2500);
    return () => {
      clearTimeout(bootDelay);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ASSISTANT_CONVERSATIONS, JSON.stringify(conversations));
    } catch (e) {}
  }, [conversations]);

  useEffect(() => {
    try {
      if (currentConversationId) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ASSISTANT_CURRENT_CONVERSATION_ID, currentConversationId);
      }
    } catch (e) {}
  }, [currentConversationId]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SUPPORT_TICKETS, JSON.stringify(supportTickets));
    } catch (e) {}
  }, [supportTickets]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.FAQS, JSON.stringify(faqs));
    } catch (e) {}
  }, [faqs]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.UNRESOLVED_QUERIES, JSON.stringify(unresolvedQueries));
    } catch (e) {}
  }, [unresolvedQueries]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ABANDONED_CARTS, JSON.stringify(abandonedCarts));
    } catch (e) {}
  }, [abandonedCarts]);

  // -------------------------------------------------------------
  // FIREBASE REAL-TIME SYNC & AUTH SUBSCRIPTION
  // -------------------------------------------------------------
  useEffect(() => {
    setIsFirebaseSynced(true);

    // Helper to compare freshness timestamps cleanly
    const getFreshnessMs = (p?: Partial<Product> | null): number => {
      if (!p) return 0;
      const raw = p.lastStockUpdate || p.lastUpdated || p.createdAt;
      if (!raw) return 0;
      const t = Date.parse(String(raw));
      return Number.isFinite(t) ? t : 0;
    };

    const overlayNewerServerStock = (prod: Product): Product => {
      const srv = serverLiveCatalogRef.current.get(prod.id);
      if (!srv) return prod;
      if (getFreshnessMs(srv) > getFreshnessMs(prod) + 5000) {
        const srvCost = Number(srv.costPrice || prod.costPrice || 0);
        const keepCustomSale = Number(prod.salePrice || 0) > srvCost && Number(prod.costPrice || 0) === srvCost;
        return {
          ...prod,
          stock: srv.stock ?? 0,
          stockStatus: srv.stockStatus || (srv.stock <= 0 ? 'out_of_stock' : 'available'),
          costPrice: srv.costPrice ?? prod.costPrice,
          salePrice: keepCustomSale ? prod.salePrice : (srv.salePrice ?? prod.salePrice),
          originalPrice: keepCustomSale ? prod.originalPrice : (srv.originalPrice ?? prod.originalPrice),
          discountPercentage: keepCustomSale ? prod.discountPercentage : (srv.discountPercentage ?? prod.discountPercentage),
          lastStockUpdate: srv.lastStockUpdate || prod.lastStockUpdate,
          lastUpdated: srv.lastUpdated || prod.lastUpdated,
        };
      }
      return prod;
    };

    // 0. Non-blocking storefront hydration of live /api/products?mode=stock_overlay (compact ~15 KB gzipped vs 3.15 MB)
    fetch('/api/products?mode=stock_overlay')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelledProductsSub || !data) return;
        const srvMap = new Map<string, Product>();

        if (Array.isArray(data.patches)) {
          data.patches.forEach((tuple: any) => {
            if (!Array.isArray(tuple) || !tuple[0]) return;
            const [id, stock, stockStatus, costPrice, salePrice, originalPrice, discountPercentage, lastStockUpdate, lastUpdated] = tuple;
            srvMap.set(id, {
              id,
              stock: Number(stock ?? 0),
              stockStatus: (stockStatus || (Number(stock ?? 0) <= 0 ? 'out_of_stock' : 'available')) as any,
              costPrice: Number(costPrice ?? 0),
              salePrice: Number(salePrice ?? 0),
              originalPrice: Number(originalPrice ?? 0),
              discountPercentage: Number(discountPercentage ?? 0),
              lastStockUpdate: lastStockUpdate || undefined,
              lastUpdated: lastUpdated || undefined,
            } as Product);
          });
        }

        const newProductsList: Product[] = Array.isArray(data.newProducts) ? data.newProducts : [];
        newProductsList.forEach((p: Product) => {
          if (p?.id) srvMap.set(p.id, p);
        });

        if (Array.isArray(data.products)) {
          data.products.forEach((p: Product) => {
            if (p?.id) srvMap.set(p.id, p);
          });
        }

        if (srvMap.size === 0) return;
        serverLiveCatalogRef.current = srvMap;

        setProducts(prev => {
          let changed = false;
          const nextMap = new Map<string, Product>();
          prev.forEach(p => {
            const overlaid = overlayNewerServerStock(p);
            if (overlaid !== p) changed = true;
            nextMap.set(overlaid.id, overlaid);
          });
          // Add any newly discovered server Inova products not yet in local state
          const extraProducts = newProductsList.length > 0 ? newProductsList : (Array.isArray(data.products) ? data.products : []);
          extraProducts.forEach((srvP: Product) => {
            if (srvP?.id && srvP.name && !nextMap.has(srvP.id)) {
              nextMap.set(srvP.id, srvP);
              changed = true;
            }
          });
          if (!changed) return prev;
          return sortProductsWithNewAndRestockedFirst(normalizeProductsPricingList(Array.from(nextMap.values())));
        });
      })
      .catch(() => {});

    // 1. Real-time Products listener with trailing debounce so multi-chunk updates merge smoothly
    let unsubProducts: () => void = () => {};
    let cancelledProductsSub = false;
    let snapshotDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const productsSubTimer = setTimeout(() => {
      if (cancelledProductsSub) return;
      unsubProducts = subscribeToProducts((remoteProducts) => {
        if (cancelledProductsSub || !remoteProducts || remoteProducts.length === 0) return;
        hasRemoteProductsSnapshotRef.current = true;
        const remoteMap = new Map<string, Product>();
        remoteProducts.forEach(p => remoteMap.set(p.id, p));
        firestoreRemoteProductsRef.current = remoteMap;

        if (snapshotDebounceTimer) clearTimeout(snapshotDebounceTimer);
        const delayMs = isSyncingFirestoreStockRef.current ? 700 : 350;
        snapshotDebounceTimer = setTimeout(async () => {
          if (cancelledProductsSub) return;
          setHasRemoteProductsSnapshot(true);
          const baseCatalog = await getFullInitialProducts().catch(() => INSTANT_BOOT_PRODUCTS);
          if (cancelledProductsSub) return;

          const latestRemoteMap = firestoreRemoteProductsRef.current;
          const mergedIds = new Set<string>();
          const merged = baseCatalog.map(initP => {
            mergedIds.add(initP.id);
            const remoteP = latestRemoteMap.get(initP.id);
            if (remoteP) {
              return overlayNewerServerStock({
                ...remoteP,
                categoryId: initP.categoryId,
                subcategoryId: initP.subcategoryId,
                sizes: remoteP.sizes || initP.sizes,
                colors: remoteP.colors || initP.colors,
                variants: (remoteP.variants && remoteP.variants.length > 0) ? remoteP.variants : initP.variants,
                allowCustomSpecification: remoteP.allowCustomSpecification !== undefined ? remoteP.allowCustomSpecification : initP.allowCustomSpecification,
                specificationPlaceholder: remoteP.specificationPlaceholder || initP.specificationPlaceholder,
                priceRange: remoteP.priceRange || initP.priceRange,
              });
            }
            return overlayNewerServerStock(initP);
          });

          // Append custom products added in Firestore/Admin in O(1) per item via Set lookup
          latestRemoteMap.forEach(remoteP => {
            if (!mergedIds.has(remoteP.id)) {
              mergedIds.add(remoteP.id);
              merged.push(overlayNewerServerStock(remoteP));
            }
          });

          serverLiveCatalogRef.current.forEach((srvP, srvId) => {
            if (!mergedIds.has(srvId) && Boolean((srvP as any)?.name)) {
              mergedIds.add(srvId);
              merged.push(srvP);
            }
          });

          const normalized = sortProductsWithNewAndRestockedFirst(normalizeProductsPricingList(merged));
          startTransition(() => {
            setProducts(normalized);
          });
        }, delayMs);
      });
    }, 200);

    // 2. Real-time Categories listener (read-only on storefront mount)
    const unsubCategories = subscribeToCategories((remoteCategories) => {
      if (remoteCategories && remoteCategories.length > 0) {
        const map = new Map<string, Category>();
        INITIAL_CATEGORIES.forEach(c => map.set(c.id, {
          ...c,
          name: formatCategoryName(c.name),
          subcategories: (c.subcategories || []).map(s => ({ ...s, name: formatCategoryName(s.name) }))
        }));
        remoteCategories.forEach(c => {
          const init = map.get(c.id);
          const sanitizedName = formatCategoryName(c.name || init?.name || '');
          const rawSubs = (c.subcategories && c.subcategories.length > 0) ? c.subcategories : (init?.subcategories || []);
          const sanitizedSubs = rawSubs.map(s => ({ ...s, name: formatCategoryName(s.name) }));
          if (init) {
            map.set(c.id, {
              ...init,
              ...c,
              name: sanitizedName,
              subcategories: sanitizedSubs,
              order: c.order !== undefined ? c.order : init.order
            });
          } else {
            map.set(c.id, {
              ...c,
              name: sanitizedName,
              subcategories: sanitizedSubs
            });
          }
        });
        const merged = Array.from(map.values()).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        setCategories(merged);
      } else {
        setCategories(INITIAL_CATEGORIES.map(c => ({
          ...c,
          name: formatCategoryName(c.name),
          subcategories: (c.subcategories || []).map(s => ({ ...s, name: formatCategoryName(s.name) }))
        })));
      }
    });

    // 3. Real-time Settings listener (public read; threshold comes directly from Firestore)
    const unsubSettings = subscribeToSettings((remoteSettings) => {
      if (remoteSettings) {
        setSettings(prev => ({
          ...prev,
          ...remoteSettings,
          freeShippingThreshold: remoteSettings.freeShippingThreshold || prev.freeShippingThreshold || INITIAL_SETTINGS.freeShippingThreshold
        }));
      }
    });

    // 4. Real-time FAQs & Coupons (public read)
    const unsubFAQs = subscribeToFAQs((remoteFaqs) => {
      if (remoteFaqs && remoteFaqs.length > 0) {
        setFaqs(remoteFaqs);
      }
    });

    const unsubCoupons = subscribeToCoupons((remoteCoupons) => {
      if (remoteCoupons && remoteCoupons.length > 0) {
        setCoupons(prev => {
          const map = new Map<string, Coupon>();
          INITIAL_COUPONS.forEach(c => map.set(c.id, c));
          remoteCoupons.forEach(c => map.set(c.id, c));
          prev.forEach(c => {
            if (!map.has(c.id)) {
              map.set(c.id, c);
            }
          });
          return Array.from(map.values());
        });
      }
    });

    // 5. Real-time Auth listener (preserve object identity when unchanged to avoid resetting Firestore listeners)
    const unsubAuth = subscribeToAuth((authUser) => {
      if (authUser) {
        let wasLoggedOut = false;
        setUser(prev => {
          if (!prev) wasLoggedOut = true;
          if (
            prev &&
            prev.id === authUser.id &&
            prev.email === authUser.email &&
            prev.role === authUser.role &&
            prev.name === authUser.name &&
            prev.isVerified === authUser.isVerified &&
            prev.dni === authUser.dni &&
            prev.phone === authUser.phone &&
            (prev.addresses?.length || 0) === (authUser.addresses?.length || 0)
          ) {
            return prev;
          }
          return authUser;
        });
        setIsAdmin(authUser.role === 'admin');
        if (wasLoggedOut) {
          setRecommendationRefreshTrigger(prev => prev + 1);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      cancelledProductsSub = true;
      clearTimeout(productsSubTimer);
      if (snapshotDebounceTimer) clearTimeout(snapshotDebounceTimer);
      if (unsubProducts) unsubProducts();
      if (unsubCategories) unsubCategories();
      if (unsubSettings) unsubSettings();
      if (unsubFAQs) unsubFAQs();
      if (unsubCoupons) unsubCoupons();
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Sync admin mode strictly with verified admin role
  useEffect(() => {
    const isVerifiedAdmin = Boolean(
      user?.role === 'admin' &&
      auth.currentUser?.emailVerified &&
      checkIsAdminEmail(auth.currentUser?.email || user?.email)
    );
    setIsAdmin(isVerifiedAdmin);
  }, [user]);

  // Real-time Orders, Notifications, Assistant & Support Tickets (strictly scoped to authenticated user or admin)
  useEffect(() => {
    const isUserAdmin = Boolean(
      isAdmin &&
      auth.currentUser?.emailVerified &&
      checkIsAdminEmail(auth.currentUser?.email || user?.email)
    );
    const activeUid = auth.currentUser?.uid || user?.id || null;

    if (!auth.currentUser || !activeUid) {
      return;
    }

    // Subscribe to orders safely scoped to current user or admin
    const unsubOrders = subscribeToOrders((remoteOrders) => {
      if (remoteOrders) {
        setOrders(prev => {
          const savedDeleted = localStorage.getItem('vondro_deleted_order_ids_v2');
          const currentDeleted = savedDeleted ? new Set<string>(JSON.parse(savedDeleted)) : deletedOrderIds;
          const map = new Map<string, Order>();
          remoteOrders.forEach(o => {
            if (o && o.id && !currentDeleted.has(o.id)) {
              map.set(o.id, o);
            }
          });
          (prev || []).forEach(o => {
            if (o && o.id && !currentDeleted.has(o.id) && !map.has(o.id)) {
              map.set(o.id, o);
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    }, activeUid, isUserAdmin);

    const unsubNotifs = subscribeToNotifications((remoteNotifs) => {
      if (remoteNotifs) {
        setNotifications(remoteNotifs);
      }
    }, activeUid, isUserAdmin);

    const unsubConversations = subscribeToAssistantConversations((remoteConvs) => {
      if (remoteConvs && remoteConvs.length > 0) {
        setConversations(prev => {
          const map = new Map<string, AssistantConversation>();
          prev.forEach(c => map.set(c.id, c));
          remoteConvs.forEach(rc => {
            const local = map.get(rc.id);
            if (!local || !local.messages || local.messages.length === 0) {
              map.set(rc.id, rc);
            } else if (rc.messages && rc.messages.length >= local.messages.length) {
              map.set(rc.id, rc);
            }
          });
          return Array.from(map.values()).sort((a, b) => new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime());
        });
      }
    }, activeUid, isUserAdmin);

    const unsubTickets = subscribeToSupportTickets((remoteTickets) => {
      if (remoteTickets && remoteTickets.length > 0) {
        setSupportTickets(remoteTickets);
      }
    }, activeUid, isUserAdmin);

    const unsubUnres = subscribeToUnresolvedQueries((remoteQueries) => {
      if (remoteQueries && remoteQueries.length > 0) {
        setUnresolvedQueries(remoteQueries);
      }
    }, activeUid, isUserAdmin);

    return () => {
      if (unsubOrders) unsubOrders();
      if (unsubNotifs) unsubNotifs();
      if (unsubConversations) unsubConversations();
      if (unsubTickets) unsubTickets();
      if (unsubUnres) unsubUnres();
    };
  }, [user?.id, user?.email, isAdmin]);

  // Real-time Admin-only collections listener (strictly when user has verified admin role)
  useEffect(() => {
    const isUserAdmin = Boolean(
      isAdmin &&
      auth.currentUser?.emailVerified &&
      checkIsAdminEmail(auth.currentUser?.email || user?.email)
    );
    if (!isUserAdmin) {
      return;
    }

    seedDatabaseIfEmpty().then((res) => {
      if (res.seeded) {
        console.log(`Firestore seeded successfully with ${res.count} products.`);
      }
    }).catch(() => {});

    const unsubSuppliers = subscribeToSuppliers((remoteSuppliers) => {
      if (remoteSuppliers && remoteSuppliers.length > 0) {
        setSuppliers(remoteSuppliers);
      }
    });

    const unsubMovements = subscribeToStockMovements((remoteMovements) => {
      if (remoteMovements && remoteMovements.length > 0) {
        setStockMovements(remoteMovements);
      }
    });

    const unsubActions = subscribeToAdminActions((remoteActions) => {
      if (remoteActions) {
        setAdminActions(remoteActions);
      }
    });

    const unsubReturns = subscribeToOrderReturns((remoteReturns) => {
      if (remoteReturns) {
        setOrderReturns(remoteReturns);
      }
    });

    const unsubCouriers = subscribeToCouriers((remoteCouriers) => {
      if (remoteCouriers && remoteCouriers.length > 0) {
        setCouriers(remoteCouriers);
      }
    });

    const unsubProviders = subscribeToLogisticsProviders((remoteProviders) => {
      if (remoteProviders && remoteProviders.length > 0) {
        setLogisticsProviders(remoteProviders);
      }
    });

    const unsubExpenses = subscribeToShippingExpenses((remoteExpenses) => {
      if (remoteExpenses && remoteExpenses.length > 0) {
        setShippingExpenses(remoteExpenses);
      }
    });

    const unsubChecks = subscribeToSupplierChecks((remoteChecks) => {
      if (remoteChecks && remoteChecks.length > 0) {
        setSupplierChecks(remoteChecks);
      }
    });

    const unsubPOs = subscribeToPurchaseOrders((remotePOs) => {
      if (remotePOs && remotePOs.length > 0) {
        setPurchaseOrders(remotePOs);
      }
    });

    const unsubSupReturns = subscribeToSupplierReturns((remoteReturns) => {
      if (remoteReturns && remoteReturns.length > 0) {
        setSupplierReturns(remoteReturns);
      }
    });

    const unsubUsers = subscribeToUsers((usersList) => {
      if (usersList && usersList.length > 0) {
        setRegisteredUsers(usersList);
      }
    });

    return () => {
      if (unsubSuppliers) unsubSuppliers();
      if (unsubMovements) unsubMovements();
      if (unsubActions) unsubActions();
      if (unsubReturns) unsubReturns();
      if (unsubCouriers) unsubCouriers();
      if (unsubProviders) unsubProviders();
      if (unsubExpenses) unsubExpenses();
      if (unsubChecks) unsubChecks();
      if (unsubPOs) unsubPOs();
      if (unsubSupReturns) unsubSupReturns();
      if (unsubUsers) unsubUsers();
    };
  }, [isAdmin, user?.email]);

  // Calculations (CartView / CheckoutView operate strictly on selectedCartItems)
  const selectedCartItems = useMemo(
    () => cart.filter(item => item && item.product && selectedCartItemKeys.includes(getCartItemKey(item))),
    [cart, selectedCartItemKeys]
  );

  const toggleCartItemSelection = useCallback((key: string) => {
    setSelectedCartItemKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const toggleSelectAllCartItems = useCallback(() => {
    const allKeys = cart.filter(item => item && item.product).map(getCartItemKey);
    setSelectedCartItemKeys(prev => (allKeys.length > 0 && prev.length === allKeys.length ? [] : allKeys));
  }, [cart]);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + (item?.quantity || 0), 0),
    [cart]
  );
  const cartSubtotal = useMemo(
    () => selectedCartItems.reduce((acc, item) => {
      const unitPrice = (item?.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : (item?.product?.salePrice || 0);
      return acc + (unitPrice * (item?.quantity || 0));
    }, 0),
    [selectedCartItems]
  );
  const freeShippingThreshold = settings?.freeShippingThreshold || INITIAL_SETTINGS.freeShippingThreshold;
  const isFreeShipping = cartSubtotal >= freeShippingThreshold;
  const amountForFreeShipping = Math.max(0, freeShippingThreshold - cartSubtotal);
  const progressToFreeShipping = Math.min(100, Math.round((cartSubtotal / freeShippingThreshold) * 100));

  // Shipping cost: calculado por zona/distancia (bonificado $0 SOLO si supera los $100.000)
  const selectedZone = useMemo(
    () => settings?.zones?.find(z => z?.id === selectedZoneId) || settings?.zones?.[0] || INITIAL_SETTINGS.zones[0],
    [settings?.zones, selectedZoneId]
  );
  const currentShippingCost = isFreeShipping ? 0 : (selectedZone?.price || 3000);

  // Discount calculation
  const discountAmount = useMemo(() => {
    if (appliedCoupon && appliedCoupon.active && cartSubtotal >= appliedCoupon.minPurchaseAmount) {
      if (appliedCoupon.discountType === 'percentage') {
        return Math.round((cartSubtotal * appliedCoupon.value) / 100);
      }
      return Math.min(cartSubtotal, appliedCoupon.value);
    }
    return 0;
  }, [appliedCoupon, cartSubtotal]);

  // Navigation helpers & scroll memory
  const savedScrollPositionRef = useRef<number>(0);

  const openProductDetail = (product: Product) => {
    if (product) {
      recordProductVisit(product);
      setRecentBrowsingCategories(getRecentBrowsingCategories());
    }
    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;

    setActiveTab(prev => {
      if (prev !== 'product-detail') {
        // Store scroll position of the catalog list only when leaving a list view (not when hopping related products)
        savedScrollPositionRef.current = currentScrollY;
        setPreviousTab(prev);
      }
      return 'product-detail';
    });
    setSelectedProduct(product);
    // Instant reset to top for product detail with 0 scroll animation
    window.scrollTo(0, 0);
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
    const targetTab = previousTab || 'home';
    setActiveTab(targetTab);
    const savedY = savedScrollPositionRef.current;
    // Multi-phase scroll restoration to guarantee returning exactly where the user left off
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
      });
      setTimeout(() => {
        window.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
      }, 40);
    });
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setActiveTab('order-detail');
    window.scrollTo(0, 0);
  };

  // Cart operations
  const addToCart = (product: Product, quantity = 1, options?: AddToCartOptions) => {
    if (!product) return;
    if (product.stock <= 0 || product.stockStatus === 'out_of_stock') {
      alert('Lo sentimos, este producto se encuentra agotado.');
      return;
    }

    // Determine unit price with size offset / override if available
    let calculatedUnitPrice = product.salePrice;
    if (options?.unitPrice !== undefined && options.unitPrice > 0) {
      calculatedUnitPrice = options.unitPrice;
    } else if (options?.selectedSize && product.sizes && product.sizes.length > 0) {
      const matchedSize = product.sizes.find(s => s.name.toLowerCase() === options.selectedSize?.toLowerCase() || s.id === options.selectedSize);
      if (matchedSize && matchedSize.price) {
        calculatedUnitPrice = matchedSize.price;
      }
    }

    const itemKey = `${product.id}__${options?.selectedSize || ''}__${options?.selectedColor || ''}__${options?.selectedVariant || ''}__${(options?.customSpecification || '').trim()}`;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => {
        const k = item.itemKey || `${item?.product?.id}__${item.selectedSize || ''}__${item.selectedColor || ''}__${item.selectedVariant || ''}__${(item.customSpecification || '').trim()}`;
        return k === itemKey;
      });

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = Math.min(product.stock, existing.quantity + quantity);
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: newQty, unitPrice: calculatedUnitPrice } : item
        );
      }

      return [
        ...prev,
        {
          product,
          quantity: Math.min(product.stock, quantity),
          selectedSize: options?.selectedSize,
          selectedColor: options?.selectedColor,
          selectedVariant: options?.selectedVariant,
          customSpecification: options?.customSpecification?.trim() || undefined,
          unitPrice: calculatedUnitPrice,
          itemKey
        }
      ];
    });
  };

  const removeFromCart = (productId: string, itemKey?: string) => {
    setCart(prev => prev.filter(item => {
      if (itemKey) {
        const k = item.itemKey || `${item?.product?.id}__${item.selectedSize || ''}__${item.selectedColor || ''}__${item.selectedVariant || ''}__${(item.customSpecification || '').trim()}`;
        return k !== itemKey;
      }
      return item?.product?.id !== productId;
    }));
  };

  const updateCartQuantity = (productId: string, quantity: number, itemKey?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, itemKey);
      return;
    }
    const product = products.find(p => p?.id === productId);
    const maxStock = product ? product.stock : 999;
    const finalQty = Math.min(maxStock, quantity);

    setCart(prev =>
      prev.map(item => {
        const k = item.itemKey || `${item?.product?.id}__${item.selectedSize || ''}__${item.selectedColor || ''}__${item.selectedVariant || ''}__${(item.customSpecification || '').trim()}`;
        const isTarget = itemKey ? k === itemKey : item?.product?.id === productId;
        return isTarget ? { ...item, quantity: finalQty } : item;
      })
    );
  };

  const removeCartItemsByKeys = useCallback((keys: string[]) => {
    const keySet = new Set(keys);
    setCart(prev => prev.filter(item => !keySet.has(getCartItemKey(item))));
    setAppliedCoupon(null);
  }, []);

  const clearCart = () => {
    setCart([]);
    setSelectedCartItemKeys([]);
    setAppliedCoupon(null);
  };

  // Favorites
  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const updated = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      
      // Update user doc in Firestore if logged in
      if (user) {
        saveUserToFirestore({ ...user, favorites: updated }).catch(console.warn);
      }
      return updated;
    });
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  const clearFavorites = () => {
    setFavorites([]);
    if (user) {
      saveUserToFirestore({ ...user, favorites: [] }).catch(console.warn);
    }
  };

  // Coupons & Referrals
  const applyCoupon = (code: string) => {
    const cleanCode = (code || '').trim().toUpperCase();
    const found = coupons.find(c => c && c.code && c.code.toUpperCase() === cleanCode && c.active);

    if (!found) {
      return { success: false, message: 'Cupón no válido o vencido.' };
    }

    if (cartSubtotal < found.minPurchaseAmount) {
      return {
        success: false,
        message: `El cupón requiere una compra mínima de $${(found.minPurchaseAmount ?? 0).toLocaleString('es-AR')}.`,
      };
    }

    setAppliedCoupon(found);
    return { success: true, message: `¡Cupón ${found.code} aplicado con éxito!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const addCoupon = (couponData: Omit<Coupon, 'id' | 'usedCount'>) => {
    const newCoupon: Coupon = {
      ...couponData,
      id: `coup-${Date.now()}`,
      usedCount: 0,
      createdAt: new Date().toISOString()
    };
    setCoupons(prev => [newCoupon, ...prev]);
    if (isAdmin) {
      saveCouponToFirestore(newCoupon).catch(console.warn);
    }
  };

  const toggleCouponStatus = (id: string) => {
    let toggled: Coupon | undefined;
    setCoupons(prev =>
      prev.map(c => {
        if (c.id === id) {
          toggled = { ...c, active: !c.active };
          return toggled;
        }
        return c;
      })
    );
    if (toggled && isAdmin) {
      saveCouponToFirestore(toggled).catch(console.warn);
    }
  };

  const deleteCoupon = (id: string) => {
    setCoupons(prev => prev.filter(c => c.id !== id));
    if (appliedCoupon?.id === id) {
      setAppliedCoupon(null);
    }
    if (isAdmin) {
      deleteCouponFromFirestore(id).catch(console.warn);
    }
  };

  const redeemReferralCode = useCallback(async (rawCode: string): Promise<{ success: boolean; message: string; couponCode?: string }> => {
    const cleanCode = (rawCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Por favor ingresá un código de invitación válido.' };
    }

    if (user?.referralCode && user.referralCode.toUpperCase() === cleanCode) {
      return { success: false, message: 'No podés canjear tu propio código de invitación.' };
    }

    if (user?.claimedReferralDiscount) {
      return { success: false, message: 'Ya has canjeado un cupón de bienvenida de invitación en tu cuenta.' };
    }

    const derivedCode = cleanCode.startsWith('AMIGO-') ? cleanCode : `AMIGO-${cleanCode.replace(/^VON-/, '')}`;

    // If visitor is not signed in yet, store the referral code so it activates automatically upon login
    if (!user || !auth.currentUser) {
      try {
        localStorage.setItem('vondro_referred_by', cleanCode);
      } catch (_) {}

      const pendingCoupon: Coupon = {
        id: `coup-pending-${cleanCode}`,
        code: derivedCode,
        discountType: 'fixed',
        value: 5000,
        minPurchaseAmount: 20000,
        usedCount: 0,
        maxUses: 1,
        active: true,
        description: `Descuento exclusivo de $5.000 por invitación de amigo (${cleanCode})`
      };
      setCoupons(prev => prev.some(c => c.code === derivedCode) ? prev : [pendingCoupon, ...prev]);
      if (cartSubtotal >= 20000) {
        setAppliedCoupon(pendingCoupon);
      }
      return {
        success: true,
        couponCode: derivedCode,
        message: `¡Invitación guardada! Al iniciar sesión se acreditará tu cupón ${derivedCode} de $5.000 OFF.`
      };
    }

    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/referrals/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ referralCode: cleanCode })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.error || 'No se pudo validar el código de invitación.'
        };
      }

      const issuedCoupon: Coupon = data.coupon || {
        id: `coup-ref-${Date.now()}`,
        code: derivedCode,
        discountType: 'fixed',
        value: 5000,
        minPurchaseAmount: 20000,
        usedCount: 0,
        maxUses: 1,
        active: true,
        ownerUserId: user.id,
        description: `Descuento exclusivo de $5.000 por invitación de amigo (${cleanCode})`
      };

      setCoupons(prev => [issuedCoupon, ...prev.filter(c => c.code !== issuedCoupon.code)]);
      if (cartSubtotal >= issuedCoupon.minPurchaseAmount) {
        setAppliedCoupon(issuedCoupon);
      }

      const updatedProfile: UserAccount = {
        ...user,
        claimedReferralDiscount: true,
        referredBy: cleanCode,
        ...(data.referrerUserId ? { referredByUserId: data.referrerUserId } : {})
      };
      setUser(updatedProfile);
      if (!data.serverPersisted) {
        saveUserToFirestore(updatedProfile).catch(() => {});
      }
      try {
        localStorage.removeItem('vondro_referred_by');
      } catch (_) {}

      return {
        success: true,
        couponCode: issuedCoupon.code,
        message: `¡Excelente! Se aplicó tu cupón de $5.000 OFF (${issuedCoupon.code}) para compras desde $20.000.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Hubo un inconveniente al validar el código. Intentá nuevamente.'
      };
    }
  }, [user, cartSubtotal]);

  // Automatically redeem stored ?ref=CODE once user logs in
  const pendingRefProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !auth.currentUser || user.claimedReferralDiscount) return;
    try {
      const pendingCode = localStorage.getItem('vondro_referred_by');
      if (pendingCode && pendingRefProcessedRef.current !== `${user.id}:${pendingCode}`) {
        pendingRefProcessedRef.current = `${user.id}:${pendingCode}`;
        redeemReferralCode(pendingCode).catch(() => {});
      }
    } catch (_) {}
  }, [user, redeemReferralCode]);

  // Product Operations
  const addProduct = async (productData: Omit<Product, 'id' | 'lastUpdated'>) => {
    // Strict requirement: Never upload or create a product without a valid image
    const validImages = (productData.images || []).filter(img => typeof img === 'string' && img.trim().length > 0);
    if (validImages.length === 0) {
      const errMsg = 'No se puede subir el producto: es obligatorio contar con al menos una imagen válida.';
      console.error(errMsg);
      throw new Error(errMsg);
    }

    const newId = `prod-${Date.now()}`;
    const rawProduct: Product = {
      ...productData,
      images: validImages,
      id: newId,
      createdAt: new Date().toISOString(),
      lastStockUpdate: new Date().toISOString(),
      isNew: true,
      lastUpdated: new Date().toISOString().split('T')[0],
    };

    // Auto-register category or subcategory if new
    if (rawProduct.categoryId) {
      setCategories(prevCats => {
        const catExists = prevCats.some(c => c.id.toLowerCase() === rawProduct.categoryId.toLowerCase());
        if (!catExists) {
          const newCat: Category = {
            id: rawProduct.categoryId,
            name: rawProduct.categoryId.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
            slug: rawProduct.categoryId,
            icon: 'Package',
            badgeColor: 'bg-purple-100 text-purple-800',
            order: prevCats.length + 1,
            subcategories: rawProduct.subcategoryId ? [{
              id: rawProduct.subcategoryId,
              name: rawProduct.subcategoryId.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
              slug: rawProduct.subcategoryId
            }] : []
          };
          const updated = [...prevCats, newCat];
          try { localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(updated)); } catch (_) {}
          return updated;
        }

        if (rawProduct.subcategoryId) {
          const targetCat = prevCats.find(c => c.id.toLowerCase() === rawProduct.categoryId.toLowerCase());
          if (targetCat) {
            const subExists = targetCat.subcategories?.some(s => s.id.toLowerCase() === rawProduct.subcategoryId!.toLowerCase());
            if (!subExists) {
              const updated = prevCats.map(c => {
                if (c.id.toLowerCase() === rawProduct.categoryId.toLowerCase()) {
                  const newSub = {
                    id: rawProduct.subcategoryId!,
                    name: rawProduct.subcategoryId!.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
                    slug: rawProduct.subcategoryId!
                  };
                  return {
                    ...c,
                    subcategories: [...(c.subcategories || []), newSub]
                  };
                }
                return c;
              });
              try { localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(updated)); } catch (_) {}
              return updated;
            }
          }
        }
        return prevCats;
      });
    }

    const newProduct = normalizeProductPricing(rawProduct);
    // Optimistic local update placing new product strictly at top
    setProducts(prev => sortProductsWithNewAndRestockedFirst([newProduct, ...prev]));

    // Save to Firestore
    try {
      await saveProductToFirestore(newProduct, newId);
    } catch (err) {
      console.warn('Error saving product to Firestore:', err);
    }
  };

  const updateProduct = async (id: string, updated: Partial<Product>) => {
    let finalUpdatedProduct: Product | null = null;
    setProducts(prev => {
      const updatedList = prev.map(p => {
        if (p.id === id) {
          const merged = { ...p, ...updated, lastUpdated: new Date().toISOString().split('T')[0] };
          if (updated.stock !== undefined) {
            if (updated.stock <= 0) {
              merged.stockStatus = 'out_of_stock';
            } else if (updated.stock <= 5) {
              merged.stockStatus = 'low_stock';
            } else if (merged.stockStatus === 'out_of_stock' || merged.stockStatus === 'low_stock') {
              merged.stockStatus = 'available';
            }
          }
          const normalized = normalizeProductPricing(merged);
          finalUpdatedProduct = normalized;
          return normalized;
        }
        return p;
      });
      return sortProductsWithNewAndRestockedFirst(updatedList);
    });

    if (selectedProduct?.id === id) {
      setSelectedProduct(prev => prev ? normalizeProductPricing({ ...prev, ...updated }) : null);
    }

    try {
      const existing = products.find(p => p.id === id);
      if (existing && finalUpdatedProduct) {
        await saveProductToFirestore(finalUpdatedProduct, id);
      }
    } catch (err) {
      console.warn('Error updating product in Firestore:', err);
    }
  };

  const updateStock = async (id: string, newStock: number) => {
    const validStock = Math.max(0, newStock);
    let newStatus: Product['stockStatus'] = 'available';
    const isLow = validStock > 0 && validStock <= 6;
    if (validStock === 0) newStatus = 'out_of_stock';
    else if (isLow) newStatus = 'low_stock';

    const current = products.find(p => p.id === id);
    const wasOutOfStock = !current || current.stock <= 0;
    const isRestocked = wasOutOfStock && validStock > 0;

    const updates: Partial<Product> = { 
      stock: validStock, 
      stockStatus: newStatus,
      lastStockUpdate: new Date().toISOString(),
      ...(isRestocked ? {
        isRestocked: true,
        restockedAt: new Date().toISOString(),
        promoBadges: ['REPOSICIÓN'],
        tags: Array.from(new Set([...(current?.tags || []), 'REPOSICIÓN']))
      } : {})
    };

    // Low-stock clearance trigger: automatically offer in flash deals
    if (isLow) {
      updates.isFlashSale = true;
      updates.promoBadges = ['OFERTA_RELAMPAGO'];
      if (!current?.discountPercentage || current.discountPercentage < 20) {
        updates.discountPercentage = validStock <= 2 ? 35 : validStock <= 4 ? 25 : 20;
      }
    }

    await updateProduct(id, updates);
    try {
      await updateProductStockInFirestore(id, validStock);
    } catch (err) {
      console.warn('Error updating stock in Firestore:', err);
    }
  };

  const deleteProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    removeFromCart(id);
    try {
      await deleteProductFromFirestore(id);
    } catch (err) {
      console.warn('Error deleting product from Firestore:', err);
    }
  };

  // Product Reviews & Dynamic Ratings
  const hasUserPurchasedProduct = (productId: string): boolean => {
    if (!orders || orders.length === 0) return false;
    return orders.some(o => 
      o.items && o.items.some(item => item.productId === productId || (item as any).id === productId)
    );
  };

  const getProductReviews = (productId: string): ProductReview[] => {
    if (reviewsMap[productId] && reviewsMap[productId].length > 0) {
      return reviewsMap[productId];
    }
    return [];
  };

  const getProductRatingSummary = (productId: string) => {
    const list = getProductReviews(productId);
    const foundProd = products.find(p => p.id === productId);
    return calculateProductRatingSummary(list, foundProd?.rating || 0);
  };

  const likeProductReview = (productId: string, reviewId: string) => {
    setReviewsMap(prev => {
      const list = prev[productId] || [];
      const updated = list.map(r => {
        if (r.id === reviewId) {
          const isLiked = !r.likedByUser;
          return {
            ...r,
            likedByUser: isLiked,
            likes: isLiked ? (r.likes || 0) + 1 : Math.max(0, (r.likes || 0) - 1)
          };
        }
        return r;
      });
      const nextMap = { ...prev, [productId]: updated };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.REVIEWS, JSON.stringify(nextMap));
      } catch (_) {}
      return nextMap;
    });
  };

  const addProductReview = async (productId: string, reviewInput: {
    rating: number;
    comment: string;
    author: string;
    title?: string;
    boughtVariant?: string;
    images?: string[];
    orderId?: string;
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const isPurchased = hasUserPurchasedProduct(productId) || !!reviewInput.orderId;
      const avatarColors = ['bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-pink-600', 'bg-amber-600', 'bg-teal-600'];
      const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

      const newReview: ProductReview = {
        id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId,
        orderId: reviewInput.orderId,
        author: reviewInput.author.trim() || (user?.name || 'Cliente Verificado'),
        avatarColor: randomColor,
        country: '🇦🇷 Argentina (Córdoba)',
        date: 'Hoy',
        rating: Math.min(5, Math.max(1, reviewInput.rating)),
        title: reviewInput.title?.trim() || undefined,
        comment: reviewInput.comment.trim(),
        boughtVariant: reviewInput.boughtVariant || 'Estándar',
        verified: isPurchased,
        images: reviewInput.images && reviewInput.images.length > 0 ? reviewInput.images : undefined,
        likes: 0,
        likedByUser: false,
        createdAt: new Date().toISOString()
      };

      const currentList = reviewsMap[productId] || [];
      const updatedList = [newReview, ...currentList];
      const nextMap = { ...reviewsMap, [productId]: updatedList };

      setReviewsMap(nextMap);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.REVIEWS, JSON.stringify(nextMap));
      } catch (_) {}

      // Recalculate average rating & review count for product
      const summary = calculateProductRatingSummary(updatedList, 0);

      // Update product rating in products list
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, rating: summary.rating, reviewCount: summary.reviewCount }
            : p
        )
      );

      // Update selectedProduct if currently viewing this product
      setSelectedProduct(prev => {
        if (prev && prev.id === productId) {
          return {
            ...prev,
            rating: summary.rating,
            reviewCount: summary.reviewCount
          };
        }
        return prev;
      });

      triggerCelebrationConfetti();
      return { success: true, message: '¡Opinión publicada con éxito!' };
    } catch (err: any) {
      console.error('Error adding review:', err);
      return { success: false, message: 'Error al publicar la opinión' };
    }
  };

  // Categories
  const addCategory = async (categoryData: Omit<Category, 'id'>) => {
    const newId = categoryData.slug || `cat-${Date.now()}`;
    const sanitizedSubs = (categoryData.subcategories || []).map(s => ({
      ...s,
      name: formatCategoryName(s.name)
    }));
    const newCat: Category = {
      ...categoryData,
      name: formatCategoryName(categoryData.name),
      subcategories: sanitizedSubs,
      id: newId,
    };
    setCategories(prev => [...prev, newCat]);
    try {
      await saveCategoryToFirestore(newCat, newId);
    } catch (err) {
      console.warn('Error saving category to Firestore:', err);
    }
  };

  const updateCategory = async (id: string, updated: Partial<Category>) => {
    const sanitizedUpdated: Partial<Category> = {
      ...updated,
      ...(updated.name ? { name: formatCategoryName(updated.name) } : {}),
      ...(updated.subcategories ? { subcategories: updated.subcategories.map(s => ({ ...s, name: formatCategoryName(s.name) })) } : {})
    };
    setCategories(prev =>
      prev.map(c => (c.id === id ? { ...c, ...sanitizedUpdated } : c))
    );
    try {
      const existing = categories.find(c => c.id === id);
      if (existing) {
        await saveCategoryToFirestore({ ...existing, ...sanitizedUpdated }, id);
      }
    } catch (err) {
      console.warn('Error updating category in Firestore:', err);
    }
  };

  const deleteCategory = async (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    try {
      await deleteCategoryFromFirestore(id);
    } catch (err) {
      console.warn('Error deleting category from Firestore:', err);
    }
  };

  const syncCategoriesWithInovaCatalog = async () => {
    const map = new Map<string, Category>();
    INITIAL_CATEGORIES.forEach(c => map.set(c.id, c));
    categories.forEach(c => {
      const init = map.get(c.id);
      if (init) {
        map.set(c.id, {
          ...init,
          ...c,
          name: init.name,
          subcategories: (c.subcategories && c.subcategories.length > 0) ? c.subcategories : init.subcategories,
          order: c.order !== undefined ? c.order : init.order
        });
      } else {
        map.set(c.id, c);
      }
    });
    const fullList = Array.from(map.values()).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    setCategories(fullList);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CATEGORIES, JSON.stringify(fullList));
      for (const cat of fullList) {
        await saveCategoryToFirestore(cat, cat.id);
      }
    } catch (err) {
      console.warn('Error syncing Inova categories:', err);
    }
  };

  // Shipping Zones
  const updateShippingZone = (zoneId: string, updated: Partial<ShippingZone>) => {
    const zonesList = settings?.zones || INITIAL_SETTINGS.zones;
    const updatedZones = zonesList.map(z => (z?.id === zoneId ? { ...z, ...updated } : z));
    const newSettings = { ...settings, zones: updatedZones };
    setSettings(newSettings);
    saveSettingsToFirestore(newSettings).catch(console.warn);
  };

  const addShippingZone = (zoneData: Omit<ShippingZone, 'id'>) => {
    const newZone: ShippingZone = {
      ...zoneData,
      id: `zona-${Date.now()}`,
    };
    const zonesList = settings?.zones || INITIAL_SETTINGS.zones;
    const newSettings = { ...settings, zones: [...zonesList, newZone] };
    setSettings(newSettings);
    saveSettingsToFirestore(newSettings).catch(console.warn);
  };

  const deleteShippingZone = (zoneId: string) => {
    const zonesList = settings?.zones || INITIAL_SETTINGS.zones;
    const newSettings = { ...settings, zones: zonesList.filter(z => z?.id !== zoneId) };
    setSettings(newSettings);
    saveSettingsToFirestore(newSettings).catch(console.warn);
  };

  // Orders (Server-Validated Atomic Checkout via Firebase Admin / Bearer Auth)
  const createOrder = async (
    customer: CustomerData,
    paymentMethod: PaymentMethodType,
    shippingZoneId: string,
    notes?: string,
    transferReceiptImage?: string
  ): Promise<{ success: boolean; order?: Order; error?: string }> => {
    if (!user || !auth.currentUser) {
      return {
        success: false,
        error: 'Debés iniciar sesión o registrarte para realizar el pedido. Tu compra requiere una cuenta activa en VONDRO.',
      };
    }

    if (paymentMethod === 'bank_transfer' && !transferReceiptImage) {
      return {
        success: false,
        error: 'Es obligatorio adjuntar el comprobante de transferencia antes de confirmar el pedido.',
      };
    }

    const checkoutItems = selectedCartItems.filter(i => i?.product);
    if (checkoutItems.length === 0) {
      return {
        success: false,
        error: 'Seleccioná al menos un producto del carrito para confirmar tu pedido.',
      };
    }

    for (const item of checkoutItems) {
      if (!item?.product) continue;
      const currentProd = products.find(p => p.id === item.product.id);
      if (!currentProd || currentProd.stock < item.quantity || currentProd.stockStatus === 'out_of_stock') {
        return {
          success: false,
          error: `El producto "${item.product.name}" no tiene suficiente stock disponible (${currentProd?.stock ?? 0} disponibles). Por favor actualiza tu carrito.`,
        };
      }
    }

    const fullCustomerName = (customer.fullName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || user.name || 'Cliente VONDRO').trim();
    const formattedCustomerAddress = (customer.address || `${customer.street || ''} ${customer.number || ''}${customer.floorApartment ? ', ' + customer.floorApartment : ''}`.trim()).trim();
    const normalizedCustomer: CustomerData = {
      ...customer,
      name: fullCustomerName,
      fullName: fullCustomerName,
      address: formattedCustomerAddress || customer.neighborhood || 'Córdoba Capital',
    };

    const checkoutSubtotal = checkoutItems.reduce((acc, item) => {
      const unitPrice = (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : item.product.salePrice;
      return acc + unitPrice * item.quantity;
    }, 0);
    const zone = settings.zones?.find(z => z.id === shippingZoneId) || settings.zones?.[0] || INITIAL_SETTINGS.zones[0];
    const effectiveThreshold = settings?.freeShippingThreshold || INITIAL_SETTINGS.freeShippingThreshold;
    const isOrderFree = checkoutSubtotal >= effectiveThreshold;
    const shipping = isOrderFree ? 0 : (zone?.price || 3000);
    const finalTotal = Math.max(0, checkoutSubtotal - discountAmount + shipping);
    const uniqueOrderDigits = `${Date.now().toString().slice(-5)}${Math.floor(100 + Math.random() * 900)}`;
    const nowStr = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const purchasedItemKeys = checkoutItems.map(getCartItemKey);

    const draftOrder: Order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderNumber: `#VON-${uniqueOrderDigits}`,
      createdAt: nowStr,
      updatedAt: nowStr,
      customer: normalizedCustomer,
      items: checkoutItems.map(item => {
        const itemPrice = (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : item.product.salePrice;
        return {
          productId: item.product.id,
          name: item.product.name,
          image: item.product.images[0] || '',
          salePrice: itemPrice,
          costPrice: item.product.costPrice,
          quantity: item.quantity,
          subtotal: itemPrice * item.quantity,
          selectedSize: item.selectedSize,
          selectedColor: item.selectedColor,
          selectedVariant: item.selectedVariant,
          customSpecification: item.customSpecification,
        };
      }),
      subtotal: checkoutSubtotal,
      shippingZoneId: zone.id,
      shippingZoneName: zone.name,
      shippingCost: shipping,
      isFreeShipping: isOrderFree,
      couponCode: appliedCoupon?.code,
      discountAmount,
      total: finalTotal,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'pending_payment',
      timeline: [
        {
          status: 'pending_payment',
          title: 'Pedido recibido',
          description: 'Tu pedido ha sido registrado con éxito en VONDRO.',
          timestamp: formattedDate,
        }
      ],
      adminNotes: notes,
      transferReceiptImage: transferReceiptImage || undefined,
      userId: auth.currentUser.uid,
      isGuest: false,
      purchasedItemKeys,
      shippingStatus: 'PENDING',
      trackingCode: `VON-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      deliveryConfirmationCode: Math.floor(1000 + Math.random() * 9000).toString(),
      deliveryAttempts: 0,
    };

    let finalOrder = draftOrder;
    let serverHandledTransaction = false;

    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          orderId: draftOrder.id,
          orderNumber: draftOrder.orderNumber,
          customer: normalizedCustomer,
          paymentMethod,
          shippingZoneId: zone.id,
          couponCode: appliedCoupon?.code,
          notes,
          transferReceiptImage,
          items: checkoutItems.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            salePrice: (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : item.product.salePrice,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
            selectedVariant: item.selectedVariant,
            customSpecification: item.customSpecification
          }))
        })
      });

      const serverData = await response.json();
      if (!response.ok || !serverData.success) {
        return {
          success: false,
          error: serverData.error || 'No se pudo validar tu pedido en el servidor.'
        };
      }

      if (serverData.order) {
        finalOrder = {
          ...draftOrder,
          ...serverData.order,
          userId: auth.currentUser.uid,
          isGuest: false,
          purchasedItemKeys
        };
      }
      serverHandledTransaction = Boolean(serverData.serverHandledTransaction);
    } catch (serverErr: any) {
      console.warn('Backend order validation fallback note:', serverErr?.message || serverErr);
    }

    if (!serverHandledTransaction) {
      try {
        const res = await createOrderInFirestore(finalOrder);
        if (!res.success && res.error?.includes('Stock insuficiente')) {
          return { success: false, error: res.error };
        }
      } catch (err) {
        console.warn('Firestore createOrder exception:', err);
      }
    }

    // Decrement stock & increment salesCount locally
    checkoutItems.forEach(item => {
      if (!item?.product?.id) return;
      const current = products.find(p => p.id === item.product.id);
      if (current) {
        const newStock = Math.max(0, current.stock - item.quantity);
        const newSalesCount = (current.salesCount || 0) + item.quantity;
        const newUnitsSold = (current.unitsSold || 0) + item.quantity;
        updateProduct(item.product.id, {
          stock: newStock,
          salesCount: newSalesCount,
          unitsSold: newUnitsSold,
          lastSoldAt: new Date().toISOString()
        });
      }
    });

    setOrders(prev => {
      const updated = [finalOrder, ...prev.filter(o => o.id !== finalOrder.id)];
      safeSaveOrdersToLocalStorage(updated);
      return updated;
    });

    if (appliedCoupon) {
      setCoupons(prev =>
        prev.map(c =>
          c.id === appliedCoupon.id ? { ...c, usedCount: c.usedCount + 1 } : c
        )
      );
    }

    removeCartItemsByKeys(purchasedItemKeys);

    triggerCelebrationConfetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });

    return { success: true, order: finalOrder };
  };

  // Mercado Pago Preference creation via secure Backend
  const createMercadoPagoPreference = async (
    customer: CustomerData,
    shippingZoneId: string,
    notes?: string
  ): Promise<{ success: boolean; order?: Order; preferenceId?: string; initPoint?: string; isSimulated?: boolean; error?: string }> => {
    if (!user || !auth.currentUser) {
      return {
        success: false,
        error: 'Debés iniciar sesión o registrarte para realizar el pedido con Mercado Pago.',
      };
    }

    const checkoutItems = selectedCartItems.filter(i => i?.product);
    if (checkoutItems.length === 0) {
      return {
        success: false,
        error: 'Seleccioná al menos un producto del carrito para pagar.',
      };
    }

    for (const item of checkoutItems) {
      if (!item?.product) continue;
      const currentProd = products.find(p => p.id === item.product.id);
      if (!currentProd || currentProd.stock < item.quantity || currentProd.stockStatus === 'out_of_stock') {
        return {
          success: false,
          error: `El producto "${item.product.name}" no tiene suficiente stock disponible (${currentProd?.stock ?? 0} disponibles).`,
        };
      }
    }

    const fullCustomerName = (customer.fullName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || user.name || 'Cliente VONDRO').trim();
    const formattedCustomerAddress = (customer.address || `${customer.street || ''} ${customer.number || ''}${customer.floorApartment ? ', ' + customer.floorApartment : ''}`.trim()).trim();
    const normalizedCustomer: CustomerData = {
      ...customer,
      name: fullCustomerName,
      fullName: fullCustomerName,
      address: formattedCustomerAddress || customer.neighborhood || 'Córdoba Capital',
    };

    const checkoutSubtotal = checkoutItems.reduce((acc, item) => {
      const unitPrice = (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : item.product.salePrice;
      return acc + unitPrice * item.quantity;
    }, 0);
    const zone = settings.zones?.find(z => z.id === shippingZoneId) || settings.zones?.[0] || INITIAL_SETTINGS.zones[0];
    const effectiveThreshold = settings?.freeShippingThreshold || INITIAL_SETTINGS.freeShippingThreshold;
    const isOrderFree = checkoutSubtotal >= effectiveThreshold;
    const shipping = isOrderFree ? 0 : (zone?.price || 3000);
    const finalTotal = Math.max(0, checkoutSubtotal - discountAmount + shipping);

    const uniqueOrderDigits = `${Date.now().toString().slice(-5)}${Math.floor(100 + Math.random() * 900)}`;
    const nowStr = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = `#VON-${uniqueOrderDigits}`;
    const purchasedItemKeys = checkoutItems.map(getCartItemKey);

    trackEvent('begin_checkout', {
      orderId,
      subtotal: checkoutSubtotal,
      total: finalTotal,
      itemsCount: checkoutItems.length
    });

    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/mercadopago/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          items: checkoutItems.map(i => ({
            productId: i.product.id,
            quantity: i.quantity,
            salePrice: (i.unitPrice !== undefined && i.unitPrice > 0) ? i.unitPrice : i.product.salePrice,
            selectedSize: i.selectedSize,
            selectedColor: i.selectedColor,
            selectedVariant: i.selectedVariant,
            customSpecification: i.customSpecification
          })),
          customer: normalizedCustomer,
          shippingZoneId: zone.id,
          couponCode: appliedCoupon?.code,
          orderId,
          orderNumber,
          notes
        })
      });

      const data = await response.json();

      if (!data.success && !data.initPoint && !data.isSimulated) {
        return {
          success: false,
          error: data.error || 'Error al conectar con Mercado Pago.'
        };
      }

      const authoritativeSubtotal = typeof data.calculatedSubtotal === 'number' ? data.calculatedSubtotal : checkoutSubtotal;
      const authoritativeShipping = typeof data.calculatedShipping === 'number' ? data.calculatedShipping : shipping;
      const authoritativeDiscount = typeof data.discountAmount === 'number' ? data.discountAmount : discountAmount;
      const authoritativeTotal = typeof data.calculatedTotal === 'number' ? data.calculatedTotal : finalTotal;
      const authoritativeFreeShipping = typeof data.isFreeShipping === 'boolean' ? data.isFreeShipping : (authoritativeShipping === 0);

      const newOrder: Order = {
        id: orderId,
        orderNumber,
        createdAt: nowStr,
        updatedAt: nowStr,
        customer: normalizedCustomer,
        items: checkoutItems.map(item => {
          const itemPrice = (item.unitPrice !== undefined && item.unitPrice > 0) ? item.unitPrice : item.product.salePrice;
          return {
            productId: item.product.id,
            name: item.product.name,
            image: item.product.images[0] || '',
            salePrice: itemPrice,
            costPrice: item.product.costPrice,
            quantity: item.quantity,
            subtotal: itemPrice * item.quantity,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
            selectedVariant: item.selectedVariant,
            customSpecification: item.customSpecification,
          };
        }),
        subtotal: authoritativeSubtotal,
        shippingZoneId: zone.id,
        shippingZoneName: zone.name,
        shippingCost: authoritativeShipping,
        isFreeShipping: authoritativeFreeShipping,
        couponCode: appliedCoupon?.code,
        discountAmount: authoritativeDiscount,
        total: authoritativeTotal,
        paymentMethod: 'mercadopago',
        paymentStatus: 'pending',
        preferenceId: data.preferenceId,
        status: 'pending_payment',
        timeline: [
          {
            status: 'pending_payment',
            title: 'Pedido iniciado',
            description: 'Iniciando proceso de pago en Mercado Pago.',
            timestamp: formattedDate,
          }
        ],
        orderStatusHistory: [
          {
            status: 'pending_payment',
            changedBy: normalizedCustomer.email || 'customer',
            timestamp: formattedDate,
            note: 'Preferencia de pago generada en Mercado Pago.'
          }
        ],
        adminNotes: notes,
        userId: auth.currentUser.uid,
        isGuest: false,
        purchasedItemKeys,
        shippingStatus: 'PENDING',
        trackingCode: `VON-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
        deliveryConfirmationCode: Math.floor(1000 + Math.random() * 9000).toString(),
        deliveryAttempts: 0,
      };

      // Decrement stock tentatively locally
      checkoutItems.forEach(item => {
        const current = products.find(p => p.id === item.product.id);
        if (current) {
          const newStock = Math.max(0, current.stock - item.quantity);
          updateStock(item.product.id, newStock);
        }
      });

      setOrders(prev => {
        const updated = [newOrder, ...prev.filter(o => o.id !== newOrder.id)];
        safeSaveOrdersToLocalStorage(updated);
        return updated;
      });
      if (!data.serverHandledTransaction) {
        createOrderInFirestore(newOrder).catch(console.warn);
      }

      logPaymentEvent('payment_started', {
        orderId,
        preferenceId: data.preferenceId,
        isSimulated: !!data.isSimulated
      });

      return {
        success: true,
        order: newOrder,
        preferenceId: data.preferenceId,
        initPoint: data.initPoint,
        isSimulated: data.isSimulated
      };

    } catch (err: any) {
      console.error('Error creating MP preference:', err);
      return {
        success: false,
        error: err.message || 'Error de conexión con el servidor de pagos.'
      };
    }
  };

  // Process payment outcome (live confirmation, return URL, or simulated test)
  const processPaymentResult = async (
    orderId: string,
    simulatedStatus: 'approved' | 'pending' | 'rejected' | 'cancelled'
  ): Promise<{ success: boolean; order?: Order }> => {
    const formattedDate = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) {
      return { success: false };
    }

    let nextOrderStatus: OrderStatus = 'pending_payment';
    let timelineTitle = 'Aguardando pago';
    let timelineDesc = 'El pago se encuentra pendiente de acreditación.';
    let isApproved = false;

    if (simulatedStatus === 'approved') {
      nextOrderStatus = 'payment_received';
      timelineTitle = 'Pago confirmado';
      timelineDesc = 'Pago aprobado exitosamente mediante Mercado Pago.';
      isApproved = true;
    } else if (simulatedStatus === 'pending') {
      nextOrderStatus = 'pending_payment';
      timelineTitle = 'Pago pendiente';
      timelineDesc = 'Mercado Pago está procesando la acreditación del pago.';
    } else if (simulatedStatus === 'rejected') {
      nextOrderStatus = 'cancelled';
      timelineTitle = 'Pago rechazado';
      timelineDesc = 'El pago fue rechazado por la entidad emisora o Mercado Pago.';
    } else if (simulatedStatus === 'cancelled') {
      nextOrderStatus = 'cancelled';
      timelineTitle = 'Pago cancelado';
      timelineDesc = 'La operación de pago fue cancelada por el usuario.';
    }

    const updatedTimeline = [
      ...targetOrder.timeline,
      {
        status: nextOrderStatus,
        title: timelineTitle,
        description: timelineDesc,
        timestamp: formattedDate,
      }
    ];

    const updatedHistory = [
      ...(targetOrder.orderStatusHistory || []),
      {
        status: nextOrderStatus,
        previousStatus: targetOrder.status,
        changedBy: 'mercadopago_system',
        timestamp: formattedDate,
        note: `Estado del pago actualizado a "${simulatedStatus}".`
      }
    ];

    const generatedPaymentId = targetOrder.paymentId || `mp-pay-${Date.now()}`;
    const updatedOrder: Order = {
      ...targetOrder,
      paymentStatus: simulatedStatus,
      status: nextOrderStatus,
      updatedAt: new Date().toISOString(),
      timeline: updatedTimeline,
      orderStatusHistory: updatedHistory,
      paymentId: generatedPaymentId
    };

    let serverConfirmed = false;
    try {
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        const confirmRes = await fetch('/api/mercadopago/confirm-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            orderId,
            status: simulatedStatus,
            paymentId: generatedPaymentId,
            timeline: updatedTimeline,
            orderStatusHistory: updatedHistory
          })
        });
        const confirmData = await confirmRes.json().catch(() => ({}));
        serverConfirmed = Boolean(confirmData?.serverHandledTransaction);
      }
    } catch (serverConfirmErr) {
      console.warn('Error confirming payment on server:', serverConfirmErr);
    }

    if (!serverConfirmed && isAdmin) {
      try {
        await updateOrderPaymentInFirestore(orderId, {
          paymentStatus: simulatedStatus,
          paymentId: updatedOrder.paymentId,
          status: nextOrderStatus,
          timeline: updatedTimeline,
          orderStatusHistory: updatedHistory
        });
      } catch (err) {
        console.warn('Error updating payment in firestore:', err);
      }
    }

    setOrders(prev => {
      const updated = prev.map(o => o.id === orderId ? updatedOrder : o);
      safeSaveOrdersToLocalStorage(updated);
      return updated;
    });

    if (selectedOrder?.id === orderId) {
      setSelectedOrder(updatedOrder);
    }

    if (isApproved) {
      if (targetOrder.purchasedItemKeys && targetOrder.purchasedItemKeys.length > 0) {
        removeCartItemsByKeys(targetOrder.purchasedItemKeys);
      } else {
        removeCartItemsByKeys(selectedCartItemKeys);
      }
      if (appliedCoupon) {
        setCoupons(prev =>
          prev.map(c =>
            c.id === appliedCoupon.id ? { ...c, usedCount: c.usedCount + 1 } : c
          )
        );
      }
      triggerCelebrationConfetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      trackEvent('purchase', {
        orderId,
        total: updatedOrder.total,
        paymentMethod: 'mercadopago'
      });
      logPaymentEvent('payment_approved', {
        orderId,
        total: updatedOrder.total
      });
    } else if (simulatedStatus === 'rejected' || simulatedStatus === 'cancelled') {
      targetOrder.items.forEach(item => {
        const current = products.find(p => p.id === item.productId);
        if (current) {
          updateStock(item.productId, current.stock + item.quantity);
        }
      });

      logPaymentEvent(
        simulatedStatus === 'rejected' ? 'payment_rejected' : 'payment_cancelled',
        { orderId }
      );
    }

    setLastPaymentResult({
      status: simulatedStatus,
      order: updatedOrder,
      detail: timelineDesc,
      paymentId: updatedOrder.paymentId
    });

    return { success: true, order: updatedOrder };
  };

  const updateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    note?: string,
    extraFields?: { paymentStatus?: PaymentStatus }
  ) => {
    const formattedDate = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const statusTitles: Partial<Record<OrderStatus, string>> = {
      pending_payment: 'Pedido recibido',
      payment_received: 'Pago confirmado',
      checking_stock: 'Verificando stock con depósito',
      preparing: 'Pedido preparado',
      shipped: 'Pedido enviado',
      delivered: 'Pedido entregado',
      cancelled: 'Pedido cancelado',
      STOCK_ISSUE: 'Stock en revisión / faltante',
    };

    const statusDescriptions: Partial<Record<OrderStatus, string>> = {
      pending_payment: 'Aguardando confirmación de pago.',
      payment_received: 'El pago ha sido acreditado exitosamente.',
      checking_stock: 'Confirmando disponibilidad de los productos con mayorista.',
      preparing: 'Tu paquete está siendo embalado y preparado para su entrega en Córdoba.',
      shipped: 'El paquete se encuentra en camino a tu domicilio en Córdoba.',
      delivered: 'El paquete fue entregado en mano satisfactoriamente.',
      cancelled: 'El pedido fue cancelado.',
      STOCK_ISSUE: 'Se detectó una discrepancia de stock que está siendo revisada por el equipo.',
    };

    let updatedTimeline: any[] = [];
    let updatedHistory: any[] = [];
    let resolvedPaymentStatus: PaymentStatus | undefined = extraFields?.paymentStatus;
    let resolvedShippingStatus: ShippingStatus | undefined;
    let resolvedDeliveredAt: string | undefined;

    const isPaymentApproved = newStatus === 'payment_received' || newStatus === 'PAGO_APROBADO' || newStatus === 'preparing' || newStatus === 'PREPARANDO' || newStatus === 'shipped' || newStatus === 'ENVIADO' || newStatus === 'delivered' || newStatus === 'ENTREGADO' || newStatus === 'completed' || newStatus === 'FINALIZADO' || newStatus === 'out_for_delivery' || newStatus === 'EN_CAMINO';
    const isDeliveredStatus = newStatus === 'delivered' || newStatus === 'ENTREGADO' || newStatus === 'completed' || newStatus === 'FINALIZADO';
    const isCancelledStatus = newStatus === 'cancelled' || newStatus === 'CANCELADO';

    setOrders(prev =>
      prev.map(order => {
        if (order.id === orderId) {
          updatedTimeline = [
            ...order.timeline,
            {
              status: newStatus,
              title: statusTitles[newStatus] || 'Estado actualizado',
              description: note || statusDescriptions[newStatus] || 'Actualización del pedido.',
              timestamp: formattedDate,
            },
          ];

          updatedHistory = [
            ...(order.orderStatusHistory || []),
            {
              status: newStatus,
              previousStatus: order.status,
              changedBy: user?.email || 'admin@vondro.com',
              timestamp: formattedDate,
              note: note || `Estado actualizado a "${statusTitles[newStatus] || newStatus}"`
            }
          ];

          resolvedPaymentStatus = extraFields?.paymentStatus || (
            isPaymentApproved
              ? 'approved'
              : isCancelledStatus
              ? 'cancelled'
              : order.paymentStatus
          );

          resolvedShippingStatus = isDeliveredStatus
            ? 'DELIVERED'
            : (newStatus === 'shipped' || newStatus === 'ENVIADO' || newStatus === 'out_for_delivery' || newStatus === 'EN_CAMINO')
            ? 'OUT_FOR_DELIVERY'
            : (newStatus === 'preparing' || newStatus === 'PREPARANDO')
            ? 'PREPARING'
            : isCancelledStatus
            ? 'CANCELLED'
            : order.shippingStatus;

          resolvedDeliveredAt = isDeliveredStatus ? new Date().toISOString() : order.deliveredAt || undefined;

          return {
            ...order,
            status: newStatus,
            paymentStatus: resolvedPaymentStatus,
            shippingStatus: resolvedShippingStatus,
            deliveredAt: resolvedDeliveredAt,
            updatedAt: new Date().toISOString(),
            timeline: updatedTimeline,
            orderStatusHistory: updatedHistory
          };
        }
        return order;
      })
    );

    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => {
        if (!prev) return null;
        const nextPay = extraFields?.paymentStatus || (
          isPaymentApproved ? 'approved' : isCancelledStatus ? 'cancelled' : prev.paymentStatus
        );
        const nextShip = isDeliveredStatus
          ? 'DELIVERED'
          : (newStatus === 'shipped' || newStatus === 'ENVIADO' || newStatus === 'out_for_delivery' || newStatus === 'EN_CAMINO')
          ? 'OUT_FOR_DELIVERY'
          : (newStatus === 'preparing' || newStatus === 'PREPARANDO')
          ? 'PREPARING'
          : isCancelledStatus
          ? 'CANCELLED'
          : prev.shippingStatus;
        return {
          ...prev,
          status: newStatus,
          paymentStatus: nextPay,
          shippingStatus: nextShip,
          deliveredAt: isDeliveredStatus ? new Date().toISOString() : prev.deliveredAt,
          timeline: updatedTimeline,
          orderStatusHistory: updatedHistory
        };
      });
    }

    try {
      await updateOrderStatusInFirestore(orderId, newStatus, updatedTimeline, updatedHistory, {
        paymentStatus: resolvedPaymentStatus,
        shippingStatus: resolvedShippingStatus,
        deliveredAt: resolvedDeliveredAt
      });
    } catch (err) {
      console.warn('Error updating order status in Firestore:', err);
    }

    // Credit mutual referral reward to referrer once referred friend's order is delivered
    if (isDeliveredStatus && auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        const refRes = await fetch('/api/referrals/credit-reward', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ orderId })
        });
        const refData = await refRes.json().catch(() => ({}));
        if (refData?.credited && refData?.rewardCoupon) {
          setCoupons(prev => [refData.rewardCoupon, ...prev.filter(c => c.id !== refData.rewardCoupon.id)]);
          if (user && user.id === refData.referrerId) {
            setUser(prev => prev ? {
              ...prev,
              referralCount: (prev.referralCount || 0) + 1,
              referralEarnings: (prev.referralEarnings || 0) + 5000
            } : prev);
          }
        }
      } catch (_) {}
    }

    // Auto trigger push notifications & in-app alerts based on status change
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const orderNum = targetOrder?.orderNumber || orderId.slice(0, 6);

      if (newStatus === 'shipped') {
        sendPushNotification({
          title: `🚚 ¡Tu pedido #${orderNum} está en camino!`,
          body: `Tu paquete ya fue despachado y se dirige a tu domicilio en Córdoba.`,
          category: 'shipping',
          actionText: 'Rastrear Envío',
          url: '/orders'
        });
        createNotification({
          title: `🚚 Pedido #${orderNum} en camino`,
          message: `El paquete fue despachado y está en viaje hacia tu dirección.`,
          type: 'ORDER_SHIPPED',
          priority: 'high',
          targetAudience: 'all',
          entityType: 'order',
          entityId: orderId,
          read: false
        }).catch(console.warn);
      } else if (newStatus === 'delivered') {
        sendPushNotification({
          title: `📦 ¡Tu pedido #${orderNum} fue entregado!`,
          body: `Tu paquete fue entregado con éxito. ¡Esperamos que disfrutes tu compra en VONDRO!`,
          category: 'order',
          actionText: 'Ver Pedido',
          url: '/orders'
        });
        createNotification({
          title: `📦 Pedido #${orderNum} entregado`,
          message: `El pedido fue entregado en mano satisfactoriamente.`,
          type: 'ORDER_DELIVERED',
          priority: 'normal',
          targetAudience: 'all',
          entityType: 'order',
          entityId: orderId,
          read: false
        }).catch(console.warn);
      } else if (newStatus === 'payment_received') {
        sendPushNotification({
          title: `✅ ¡Pago acreditado - Pedido #${orderNum}!`,
          body: `Acreditación exitosa. Comenzamos con el empaquetado de tus productos en depósito.`,
          category: 'order',
          actionText: 'Ver Estado',
          url: '/orders'
        });
        createNotification({
          title: `✅ Pago confirmado - #${orderNum}`,
          message: `El pago ha sido acreditado exitosamente.`,
          type: 'PAYMENT_APPROVED',
          priority: 'high',
          targetAudience: 'all',
          entityType: 'order',
          entityId: orderId,
          read: false
        }).catch(console.warn);
      }
    } catch {
      // safe
    }
  };

  const deleteOrder = async (orderId: string) => {
    persistDeletedOrderId(orderId);
    setOrders(prev => {
      const updated = prev.filter(o => o.id !== orderId);
      safeSaveOrdersToLocalStorage(updated);
      return updated;
    });
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(null);
    }
    try {
      await deleteOrderFromFirestore(orderId);
    } catch (err) {
      console.warn('Error deleting order in Firestore:', err);
    }
  };

  // Settings
  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      await saveSettingsToFirestore(merged);
    } catch (err) {
      console.warn('Error saving settings to Firestore:', err);
    }
  };

  // Helper to sync and save user profile across registered users
  const syncAndSaveUserAccount = (newUser: UserAccount): UserAccount => {
    const existing = registeredUsers.find(
      u => (u.email && newUser.email && u.email.toLowerCase().trim() === newUser.email.toLowerCase().trim()) || u.id === newUser.id
    );
    const mergedUser: UserAccount = existing ? {
      ...existing,
      ...newUser,
      name: newUser.name && newUser.name !== 'Usuario' && newUser.name !== 'Usuario VONDRO' ? newUser.name : (existing.name || newUser.name),
      phone: newUser.phone || existing.phone || '',
      dni: newUser.dni || existing.dni,
      isVerified: newUser.isVerified ?? existing.isVerified,
      addresses: (newUser.addresses && newUser.addresses.length > 0) ? newUser.addresses : (existing.addresses || []),
      defaultAddress: newUser.defaultAddress || existing.defaultAddress,
    } : newUser;

    setUser(mergedUser);
    setRegisteredUsers(prev => {
      const idx = prev.findIndex(u => (u.email && mergedUser.email && u.email.toLowerCase().trim() === mergedUser.email.toLowerCase().trim()) || u.id === mergedUser.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = mergedUser;
        return copy;
      }
      return [...prev, mergedUser];
    });
    return mergedUser;
  };

  // User
  const updateUserProfile = async (data: Partial<UserAccount>) => {
    const baseUser: UserAccount = user || {
      id: 'usr_' + Date.now(),
      email: data.email || 'cliente@vondro.app',
      name: data.name || 'Cliente VONDRO',
      phone: data.phone || '',
      role: 'customer',
      addresses: [],
      favorites: [],
      createdAt: new Date().toISOString()
    };
    const cleanDni = data.dni !== undefined ? (data.dni || '').trim() : (baseUser.dni || '');
    const updated: UserAccount = {
      ...baseUser,
      ...data,
      dni: cleanDni || undefined,
      isVerified: Boolean(cleanDni && cleanDni.length >= 7)
    };
    syncAndSaveUserAccount(updated);
    try {
      await saveUserToFirestore(updated);
    } catch (err) {
      console.warn('Error saving user profile to Firestore:', err);
    }
  };

  // Auth Methods
  const signInWithEmail = async (email: string, pass: string): Promise<UserAccount> => {
    const u = await loginWithEmail(email, pass);
    const finalUser = syncAndSaveUserAccount(u);
    if (finalUser.role === 'admin' || checkIsAdminEmail(finalUser.email)) {
      setIsAdmin(true);
    }
    setRecommendationRefreshTrigger(prev => prev + 1);
    return finalUser;
  };

  const signUpWithEmail = async (email: string, pass: string, name: string, phone?: string, dni?: string): Promise<UserAccount> => {
    const u = await registerWithEmail(email, pass, name, phone, dni);
    const cleanDni = (dni || u.dni || '').trim();
    const finalUser = syncAndSaveUserAccount({
      ...u,
      name: name || u.name,
      phone: phone || u.phone || '',
      dni: cleanDni || undefined,
      isVerified: Boolean(cleanDni && cleanDni.length >= 7)
    });
    if (finalUser.role === 'admin' || checkIsAdminEmail(finalUser.email)) {
      setIsAdmin(true);
    }
    setRecommendationRefreshTrigger(prev => prev + 1);
    return finalUser;
  };

  const signInGoogle = async (): Promise<UserAccount> => {
    const u = await loginWithGoogle();
    const finalUser = syncAndSaveUserAccount(u);
    if (finalUser.role === 'admin' || checkIsAdminEmail(finalUser.email)) {
      setIsAdmin(true);
    }
    setRecommendationRefreshTrigger(prev => prev + 1);
    return finalUser;
  };

  const signInFacebook = async (): Promise<UserAccount> => {
    const u = await loginWithFacebook();
    const finalUser = syncAndSaveUserAccount(u);
    if (finalUser.role === 'admin' || checkIsAdminEmail(finalUser.email)) {
      setIsAdmin(true);
    }
    setRecommendationRefreshTrigger(prev => prev + 1);
    return finalUser;
  };

  const signInApple = async (): Promise<UserAccount> => {
    const u = await loginWithApple();
    const finalUser = syncAndSaveUserAccount(u);
    if (finalUser.role === 'admin' || checkIsAdminEmail(finalUser.email)) {
      setIsAdmin(true);
    }
    setRecommendationRefreshTrigger(prev => prev + 1);
    return finalUser;
  };

  const signOut = async () => {
    try {
      sessionStorage.removeItem(ACTIVE_TAB_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
    } catch {}
    await logOutUser();
    setUser(null);
    setIsAdmin(false);
    setActiveTab('login');
    setConversations(prev => prev.map(c => c.id === 'conv-guest' ? { ...c, messages: [], lastMessagePreview: '' } : c));
  };

  const deleteAccount = async (): Promise<{ success: boolean; requiresRecentLogin?: boolean; error?: string }> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return {
        success: false,
        error: 'No hay una sesión activa para eliminar.'
      };
    }

    let serverDeletedProfile = false;
    let serverDeletedAuth = false;

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        serverDeletedProfile = Boolean(data?.serverDeletedProfile);
        serverDeletedAuth = Boolean(data?.serverDeletedAuth);
      }
    } catch (serverErr) {
      console.warn('Server account delete notice:', serverErr);
    }

    // Delete Firestore user profile from client if server Admin SDK did not handle it
    if (!serverDeletedProfile) {
      try {
        await deleteUserFromFirestore(firebaseUser.uid);
      } catch (profileErr) {
        console.warn('Client Firestore user profile delete warning:', profileErr);
      }
    }

    // Delete Firebase Auth account from client if server Admin SDK did not handle it
    if (!serverDeletedAuth && auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch (authErr: any) {
        const code = String(authErr?.code || '');
        if (code === 'auth/requires-recent-login') {
          return {
            success: false,
            requiresRecentLogin: true,
            error: 'Por tu seguridad, cerrá sesión y volvé a iniciar sesión recientemente antes de eliminar definitivamente tu cuenta.'
          };
        }
        return {
          success: false,
          error: authErr?.message || 'No se pudo eliminar la cuenta de autenticación en Firebase.'
        };
      }
    }

    await logOutUser().catch(() => {});

    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ORDERS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.FAVORITES);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CART);
      localStorage.removeItem('vondro_referred_by');
    } catch (_) {}

    setUser(null);
    setIsAdmin(false);
    setOrders([]);
    setFavorites([]);
    clearCart();
    setSelectedOrder(null);
    setActiveTab('home');

    return { success: true };
  };

  const sendPasswordReset = async (email: string) => {
    await resetPassword(email);
  };

  const syncDatabaseToFirestore = async () => {
    return await seedDatabaseIfEmpty();
  };

  // -------------------------------------------------------------
  // FASE 5: SUPPLIERS, STOCK, NOTIFICATIONS, AUDIT & RETURNS
  // -------------------------------------------------------------

  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const newId = `sup-${Date.now()}`;
    const now = new Date().toISOString();
    const newSupplier: Supplier = {
      ...supplierData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    setSuppliers(prev => [newSupplier, ...prev]);
    try {
      await saveSupplierToFirestore(newSupplier, newId, user?.email);
    } catch (err) {
      console.warn('Error saving supplier to Firestore:', err);
    }
    return newId;
  };

  const updateSupplier = async (id: string, updated: Partial<Supplier>) => {
    setSuppliers(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updated, updatedAt: new Date().toISOString() } : s))
    );
    try {
      const existing = suppliers.find(s => s.id === id);
      if (existing) {
        await saveSupplierToFirestore({ ...existing, ...updated }, id, user?.email);
      }
    } catch (err) {
      console.warn('Error updating supplier in Firestore:', err);
    }
  };

  const deleteSupplier = async (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    try {
      await deleteSupplierFromFirestore(id, user?.email);
    } catch (err) {
      console.warn('Error deleting supplier from Firestore:', err);
    }
  };

  const replenishStock = async (
    productId: string, 
    quantityToAdd: number, 
    unitCost?: number, 
    supplierId?: string, 
    notes?: string
  ) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const currentStock = product.stock || 0;
    const newStock = currentStock + quantityToAdd;
    const minStock = product.minimumStock || 3;
    const newStockStatus: StockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';

    // Optimistic local update
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            stock: newStock,
            stockStatus: newStockStatus,
            costPrice: unitCost !== undefined && unitCost > 0 ? unitCost : p.costPrice,
            supplierId: supplierId || p.supplierId,
            lastStockUpdate: new Date().toISOString(),
            lastUpdated: new Date().toISOString().split('T')[0]
          };
        }
        return p;
      })
    );

    // Record local stock movement
    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId,
      productName: product.name,
      productSku: product.sku || '',
      type: 'PURCHASE',
      quantity: quantityToAdd,
      previousStock: currentStock,
      newStock,
      reason: notes || `Reposición de stock (+${quantityToAdd} un.)`,
      adminId: user?.id || 'admin',
      createdAt: new Date().toISOString()
    };
    setStockMovements(prev => [movement, ...prev]);

    // Push to Firestore
    try {
      await replenishProductStockInFirestore(productId, quantityToAdd, unitCost, supplierId, notes, user?.email);
    } catch (err) {
      console.warn('Error replenishing stock in Firestore:', err);
    }
  };

  const adjustStock = async (productId: string, newStock: number, reason: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const currentStock = product.stock || 0;
    const validStock = Math.max(0, newStock);
    const minStock = product.minimumStock || 3;
    const newStockStatus: StockStatus = validStock === 0 ? 'out_of_stock' : validStock <= minStock ? 'low_stock' : 'available';
    const delta = validStock - currentStock;

    // Optimistic update
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, stock: validStock, stockStatus: newStockStatus, lastStockUpdate: new Date().toISOString() } : p))
    );

    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId,
      productName: product.name,
      productSku: product.sku || '',
      type: 'ADJUSTMENT',
      quantity: delta,
      previousStock: currentStock,
      newStock: validStock,
      reason: reason || 'Ajuste manual de inventario',
      adminId: user?.id || 'admin',
      createdAt: new Date().toISOString()
    };
    setStockMovements(prev => [movement, ...prev]);

    // If stock dropped to critical, create low stock notification
    if (validStock <= minStock) {
      const notif: Omit<AppNotification, 'id' | 'createdAt'> = {
        type: validStock === 0 ? 'OUT_OF_STOCK' : 'STOCK_LOW',
        title: validStock === 0 ? '¡Producto Agotado!' : 'Alerta de Stock Mínimo',
        message: `El producto "${product.name}" quedó en ${validStock} unidades (mínimo configurado: ${minStock}).`,
        priority: validStock === 0 ? 'CRITICAL' : 'HIGH',
        entityType: 'product',
        entityId: productId,
        read: false
      };
      createNotification(notif).catch(console.warn);
    }

    try {
      await updateProductStockInFirestore(productId, validStock);
      await recordStockMovementInFirestore(movement);
      if (user?.email) {
        await recordAdminActionInFirestore({
          adminId: user.id || 'admin',
          adminEmail: user.email,
          action: 'PRODUCT_STOCK_CHANGED',
          entity: 'product',
          entityId: productId,
          previousValue: { stock: currentStock },
          newValue: { stock: validStock },
          notes: `Ajuste manual: ${reason}`
        });
      }
    } catch (err) {
      console.warn('Error adjusting stock in Firestore:', err);
    }
  };

  const createNotification = async (notifData: Omit<AppNotification, 'id' | 'createdAt'>): Promise<string> => {
    const newId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newNotif: AppNotification = {
      ...notifData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    setNotifications(prev => [newNotif, ...prev]);
    try {
      await createNotificationInFirestore(notifData);
    } catch (err) {
      console.warn('Error creating notification in Firestore:', err);
    }
    return newId;
  };

  const markNotificationRead = async (notifId: string) => {
    setNotifications(prev => prev.map(n => (n.id === notifId ? { ...n, read: true } : n)));
    try {
      await markNotificationReadInFirestore(notifId, true);
    } catch (err) {
      console.warn('Error marking notification read in Firestore:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await markAllNotificationsReadInFirestore(notifications);
    } catch (err) {
      console.warn('Error marking all notifications read in Firestore:', err);
    }
  };

  const registerOrderReturn = async (returnData: Omit<OrderReturn, 'id' | 'createdAt'>): Promise<string> => {
    const newId = `ret-${Date.now()}`;
    const newReturn: OrderReturn = {
      ...returnData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    setOrderReturns(prev => [newReturn, ...prev]);

    // If stock reimbursement requested, increment stock locally
    if (returnData.refundStock && returnData.quantity > 0) {
      const prod = products.find(p => p.id === returnData.productId);
      if (prod) {
        const newStock = prod.stock + returnData.quantity;
        const minStock = prod.minimumStock || 3;
        const newStockStatus: StockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';
        setProducts(prev =>
          prev.map(p => (p.id === returnData.productId ? { ...p, stock: newStock, stockStatus: newStockStatus } : p))
        );
      }
    }

    try {
      await registerOrderReturnInFirestore(returnData, user?.email || 'admin@vondro.com');
    } catch (err) {
      console.warn('Error registering return in Firestore:', err);
    }
    return newId;
  };

  const bulkUpdateProducts = async (
    updates: { id: string; priceMultiplier?: number; stockDelta?: number; supplierId?: string; status?: StockStatus }[]
  ) => {
    const now = new Date().toISOString();
    setProducts(prev =>
      prev.map(prod => {
        const updateItem = updates.find(u => u.id === prod.id);
        if (!updateItem) return prod;

        let newSalePrice = prod.salePrice;
        let newOriginalPrice = prod.originalPrice;
        if (updateItem.priceMultiplier && updateItem.priceMultiplier > 0) {
          newSalePrice = Math.round(prod.salePrice * updateItem.priceMultiplier);
          if (prod.originalPrice) {
            newOriginalPrice = Math.round(prod.originalPrice * updateItem.priceMultiplier);
          }
        }

        let newStock = prod.stock;
        if (updateItem.stockDelta !== undefined) {
          newStock = Math.max(0, prod.stock + updateItem.stockDelta);
        }

        const minStock = prod.minimumStock || 3;
        const newStatus: StockStatus = updateItem.status 
          ? updateItem.status 
          : newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';

        const merged: Product = {
          ...prod,
          salePrice: newSalePrice,
          originalPrice: newOriginalPrice,
          stock: newStock,
          stockStatus: newStatus,
          supplierId: updateItem.supplierId || prod.supplierId,
          lastUpdated: now.split('T')[0],
          lastStockUpdate: updateItem.stockDelta !== undefined ? now : prod.lastStockUpdate,
        };

        // Save to Firestore asynchronously
        saveProductToFirestore(merged, prod.id).catch(console.warn);
        return merged;
      })
    );

    if (user?.email) {
      recordAdminActionInFirestore({
        adminId: user.id || 'admin',
        adminEmail: user.email,
        action: 'PRODUCT_PRICE_CHANGED',
        entity: 'product',
        entityId: 'bulk',
        notes: `Actualización masiva aplicada sobre ${updates.length} productos.`
      }).catch(console.warn);
    }
  };

  const importProductsCSV = async (parsedItems: any[]): Promise<{ added: number; updated: number; errors: string[] }> => {
    let addedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const item of parsedItems) {
      try {
        if (!item.name || !item.salePrice) {
          errors.push(`Fila omitida por falta de nombre o precio: ${JSON.stringify(item.name || 'Sin nombre')}`);
          continue;
        }

        const cleanSku = (item.sku || '').trim();
        const existingProd = products.find(p => (cleanSku && p.sku === cleanSku) || (item.id && p.id === item.id));

        if (existingProd) {
          const updatedProd: Product = {
            ...existingProd,
            name: item.name || existingProd.name,
            costPrice: item.costPrice !== undefined ? Number(item.costPrice) : existingProd.costPrice,
            salePrice: Number(item.salePrice),
            originalPrice: item.originalPrice ? Number(item.originalPrice) : existingProd.originalPrice,
            stock: item.stock !== undefined ? Number(item.stock) : existingProd.stock,
            minimumStock: item.minimumStock !== undefined ? Number(item.minimumStock) : existingProd.minimumStock,
            supplier: item.supplier || existingProd.supplier,
            supplierId: item.supplierId || existingProd.supplierId,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
          await saveProductToFirestore(updatedProd, existingProd.id);
          updatedCount++;
        } else {
          // Strict requirement: Never upload or create a product without an image
          const itemImages = (Array.isArray(item.images) ? item.images : item.image ? [item.image] : [])
            .filter((img: any) => typeof img === 'string' && img.trim().length > 0);

          if (itemImages.length === 0) {
            errors.push(`Fila omitida para "${item.name}": no se subirá el producto porque no tiene imagen.`);
            continue;
          }

          const newId = item.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newProd: Product = {
            id: newId,
            sku: cleanSku || `INO-IMP-${Date.now().toString().slice(-4)}`,
            name: item.name,
            slug: (item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: item.description || item.name,
            shortFeatures: item.shortFeatures || ['Producto importado', 'Calidad VONDRO'],
            categoryId: item.categoryId || 'hogar',
            images: itemImages,
            costPrice: item.costPrice ? Number(item.costPrice) : 4000,
            salePrice: Number(item.salePrice),
            originalPrice: item.originalPrice ? Number(item.originalPrice) : Math.round(Number(item.salePrice) * 1.3),
            stock: item.stock ? Number(item.stock) : 10,
            minimumStock: item.minimumStock ? Number(item.minimumStock) : 3,
            stockStatus: Number(item.stock || 10) === 0 ? 'out_of_stock' : Number(item.stock || 10) <= 3 ? 'low_stock' : 'available',
            hideIfOutOfStock: false,
            supplier: item.supplier || 'Inova ARG',
            supplierId: item.supplierId || 'sup-inova',
            isFeatured: false,
            isOnSale: true,
            isNew: true,
            rating: 5.0,
            reviewCount: 0,
            salesCount: 0,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
          await saveProductToFirestore(newProd, newId);
          addedCount++;
        }
      } catch (err: any) {
        errors.push(`Error en fila "${item.name}": ${err.message}`);
      }
    }

    if (user?.email) {
      recordAdminActionInFirestore({
        adminId: user.id || 'admin',
        adminEmail: user.email,
        action: 'PRODUCT_CREATED',
        entity: 'product',
        entityId: 'csv-import',
        notes: `Importación CSV: ${addedCount} productos agregados, ${updatedCount} actualizados.`
      }).catch(console.warn);
    }

    return { added: addedCount, updated: updatedCount, errors };
  };

  const cancelOrderWithStockRefund = async (order: Order, reason: string) => {
    // 1. Local optimistic update of order status
    const now = new Date().toISOString();
    const formattedDate = new Date().toLocaleString('es-AR');

    setOrders(prev =>
      prev.map(o => {
        if (o.id === order.id) {
          return {
            ...o,
            status: 'cancelled',
            paymentStatus: o.paymentStatus === 'approved' ? 'refunded' : 'cancelled',
            timeline: [
              ...o.timeline,
              {
                status: 'cancelled',
                title: 'Pedido cancelado',
                description: `Cancelado: ${reason}`,
                timestamp: formattedDate
              }
            ],
            orderStatusHistory: [
              ...(o.orderStatusHistory || []),
              {
                status: 'cancelled',
                changedBy: user?.email || 'admin',
                timestamp: now,
                note: `Cancelación con reintegro de stock: ${reason}`
              }
            ]
          };
        }
        return o;
      })
    );

    // 2. Restore stock in local products
    setProducts(prev =>
      prev.map(prod => {
        const orderItem = order.items.find(it => it.productId === prod.id);
        if (orderItem) {
          const newStock = prod.stock + orderItem.quantity;
          const minStock = prod.minimumStock || 3;
          const newStatus: StockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';
          return {
            ...prod,
            stock: newStock,
            stockStatus: newStatus,
            lastStockUpdate: now
          };
        }
        return prod;
      })
    );

    // 3. Call Firestore handler
    try {
      await cancelOrderAndRestoreStockInFirestore(order, reason, user?.email || 'admin@vondro.com');
    } catch (err) {
      console.warn('Error in cancelOrderAndRestoreStockInFirestore:', err);
    }
  };

  const updateOrderPreparation = async (
    orderId: string, 
    itemChecks: Record<string, boolean>, 
    allPrepared: boolean
  ) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const preparationStatus = allPrepared ? 'ready_for_shipping' : 'in_preparation';
    const now = new Date().toISOString();

    const updatedItems = order.items.map((it, idx) => {
      const pId = it.productId || `item-${idx}`;
      const checkedVal = 
        itemChecks[pId] !== undefined ? itemChecks[pId] :
        itemChecks[it.productId] !== undefined ? itemChecks[it.productId] :
        itemChecks[`idx-${idx}`] !== undefined ? itemChecks[`idx-${idx}`] :
        !!it.prepared;

      return {
        ...it,
        prepared: !!checkedVal
      };
    });

    const isActuallyAllPrepared = allPrepared || updatedItems.every(it => it.prepared);

    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const updated = {
            ...o,
            items: updatedItems,
            preparationStatus,
            allPrepared: isActuallyAllPrepared,
            status: isActuallyAllPrepared && (o.status === 'pending_payment' || o.status === 'payment_received' || o.status === 'checking_stock' || o.status === 'stock_confirmed') ? 'preparing' : o.status,
            updatedAt: now
          } as Order;

          if (isActuallyAllPrepared && o.status !== 'preparing' && o.status !== 'shipped' && o.status !== 'delivered') {
            updated.timeline = [
              ...(o.timeline || []),
              {
                status: 'preparing',
                title: 'Pedido embalado y listo para despacho',
                description: 'Todos los productos fueron verificados en depósito.',
                timestamp: new Date().toLocaleString('es-AR')
              }
            ];
          }
          return updated;
        }
        return o;
      })
    );

    try {
      await updateOrderPreparationInFirestore(orderId, preparationStatus, isActuallyAllPrepared, updatedItems);
    } catch (err) {
      console.warn('Error updating order preparation:', err);
    }
  };

  // FASE 6 Methods
  const addCourier = async (courierData: Omit<Courier, 'id' | 'createdAt'>): Promise<string> => {
    const id = `courier-${Date.now()}`;
    const newCourier: Courier = {
      ...courierData,
      id,
      createdAt: new Date().toISOString()
    };
    setCouriers(prev => [newCourier, ...prev]);
    try {
      await saveCourierToFirestore(newCourier);
    } catch (e) {
      console.warn('Error saving courier to firestore:', e);
    }
    return id;
  };

  const updateCourier = async (id: string, updated: Partial<Courier>) => {
    setCouriers(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    const target = couriers.find(c => c.id === id);
    if (target) {
      try {
        await saveCourierToFirestore({ ...target, ...updated });
      } catch (e) {
        console.warn('Error updating courier in firestore:', e);
      }
    }
  };

  const deleteCourier = async (id: string) => {
    setCouriers(prev => prev.filter(c => c.id !== id));
    try {
      await deleteCourierFromFirestore(id);
    } catch (e) {
      console.warn('Error deleting courier in firestore:', e);
    }
  };

  const addLogisticsProvider = async (providerData: Omit<LogisticsProvider, 'id' | 'createdAt'>): Promise<string> => {
    const id = `log-${Date.now()}`;
    const newProvider: LogisticsProvider = {
      ...providerData,
      id,
      createdAt: new Date().toISOString()
    };
    setLogisticsProviders(prev => [newProvider, ...prev]);
    try {
      await saveLogisticsProviderToFirestore(newProvider);
    } catch (e) {
      console.warn('Error saving logistics provider:', e);
    }
    return id;
  };

  const updateLogisticsProvider = async (id: string, updated: Partial<LogisticsProvider>) => {
    setLogisticsProviders(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    const target = logisticsProviders.find(p => p.id === id);
    if (target) {
      try {
        await saveLogisticsProviderToFirestore({ ...target, ...updated });
      } catch (e) {
        console.warn('Error updating logistics provider:', e);
      }
    }
  };

  const addShippingExpense = async (expenseData: Omit<ShippingExpense, 'id' | 'createdAt'>): Promise<string> => {
    const id = `exp-${Date.now()}`;
    const newExpense: ShippingExpense = {
      ...expenseData,
      id,
      createdAt: new Date().toISOString()
    };
    setShippingExpenses(prev => [newExpense, ...prev]);
    try {
      await saveShippingExpenseToFirestore(newExpense);
    } catch (e) {
      console.warn('Error saving shipping expense:', e);
    }
    return id;
  };

  const updateShippingStatus = async (
    orderId: string, 
    newShippingStatus: ShippingStatus, 
    note?: string,
    extraFields?: Partial<Order>
  ) => {
    const formattedDate = new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const isoNow = new Date().toISOString();

    const shippingStatusTitles: Record<ShippingStatus, string> = {
      PENDING: 'Pedido registrado en envío',
      PREPARING: 'Preparando paquete para despacho',
      READY_TO_SHIP: 'Paquete listo para envío',
      OUT_FOR_DELIVERY: 'En camino / En reparto',
      DELIVERED: 'Pedido entregado en domicilio',
      DELIVERY_FAILED: 'Intento de entrega fallido',
      CANCELLED: 'Envío cancelado',
      RETURNED: 'Paquete devuelto a depósito'
    };

    const shippingStatusDescriptions: Record<ShippingStatus, string> = {
      PENDING: 'Pedido cargado en sistema de distribución VONDRO.',
      PREPARING: 'Verificando empaque, embalaje y etiqueta de entrega.',
      READY_TO_SHIP: 'Paquete asignado y listo en zona de despacho.',
      OUT_FOR_DELIVERY: 'El cadete o repartidor asignado está en camino con el pedido.',
      DELIVERED: 'El pedido fue recibido en el domicilio exitosamente.',
      DELIVERY_FAILED: 'No se pudo completar la entrega. Se reprogramará un nuevo intento.',
      CANCELLED: 'El proceso de envío ha sido cancelado.',
      RETURNED: 'El paquete regresó a la central de VONDRO Córdoba.'
    };

    let mappedOrderStatus: OrderStatus | undefined;
    if (newShippingStatus === 'PREPARING') mappedOrderStatus = 'preparing';
    if (newShippingStatus === 'OUT_FOR_DELIVERY') mappedOrderStatus = 'shipped';
    if (newShippingStatus === 'DELIVERED') mappedOrderStatus = 'delivered';
    if (newShippingStatus === 'CANCELLED') mappedOrderStatus = 'cancelled';

    let updatedOrderObj: Order | null = null;

    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const currentAttempts = extraFields?.deliveryAttempts !== undefined 
            ? extraFields.deliveryAttempts 
            : (newShippingStatus === 'DELIVERY_FAILED' ? (o.deliveryAttempts || 0) + 1 : o.deliveryAttempts || 0);

          const updatedHistoryItem = {
            id: `hist-${Date.now()}`,
            orderId,
            status: newShippingStatus,
            note: note || shippingStatusDescriptions[newShippingStatus],
            changedBy: user?.email || 'admin@vondro.com',
            createdAt: isoNow
          };

          const updatedTimelineItem = {
            status: mappedOrderStatus || o.status,
            title: shippingStatusTitles[newShippingStatus],
            description: note || shippingStatusDescriptions[newShippingStatus],
            timestamp: formattedDate
          };

          const isDelivered = newShippingStatus === 'DELIVERED';
          const isShipped = newShippingStatus === 'OUT_FOR_DELIVERY';

          updatedOrderObj = {
            ...o,
            ...extraFields,
            shippingStatus: newShippingStatus,
            status: mappedOrderStatus || o.status,
            deliveryAttempts: currentAttempts,
            shippedAt: isShipped ? (o.shippedAt || isoNow) : o.shippedAt,
            deliveredAt: isDelivered ? (o.deliveredAt || isoNow) : o.deliveredAt,
            updatedAt: isoNow,
            timeline: [...o.timeline, updatedTimelineItem],
            shippingStatusHistory: [...(o.shippingStatusHistory || []), updatedHistoryItem]
          };

          return updatedOrderObj;
        }
        return o;
      })
    );

    if (selectedOrder?.id === orderId && updatedOrderObj) {
      setSelectedOrder(updatedOrderObj);
    }

    try {
      await updateOrderShippingInFirestore(orderId, {
        shippingStatus: newShippingStatus,
        status: mappedOrderStatus || undefined,
        ...(extraFields || {}),
        shippedAt: newShippingStatus === 'OUT_FOR_DELIVERY' ? isoNow : undefined,
        deliveredAt: newShippingStatus === 'DELIVERED' ? isoNow : undefined,
        updatedAt: isoNow
      });
    } catch (e) {
      console.warn('Error updating shipping status in firestore:', e);
    }
  };

  const updateOrderPackageInfo = async (
    orderId: string, 
    info: { packageCount?: number; packageWeight?: number; packageSize?: string; packageNotes?: string }
  ) => {
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, ...info, updatedAt: new Date().toISOString() } : o)
    );
    try {
      await updateOrderShippingInFirestore(orderId, info);
    } catch (e) {
      console.warn('Error updating package info in firestore:', e);
    }
  };

  const assignCourierToOrder = async (orderId: string, courierId: string | null) => {
    const courierObj = couriers.find(c => c.id === courierId);
    const courierName = courierObj ? courierObj.name : undefined;

    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            assignedCourierId: courierId,
            assignedCourierName: courierName,
            updatedAt: new Date().toISOString()
          };
        }
        return o;
      })
    );

    try {
      await updateOrderShippingInFirestore(orderId, {
        assignedCourierId: courierId,
        assignedCourierName: courierName
      });
    } catch (e) {
      console.warn('Error assigning courier in firestore:', e);
    }
  };

  // =============================================================
  // FASE 7: Inova ARG & Sourcing Logic
  // =============================================================

  const calculatePriceWithMargin = (costPrice: number, targetMarginPct: number, rounding: number = 100) => {
    const rawPrice = costPrice * (1 + targetMarginPct / 100);
    const roundedPrice = rounding > 0 ? Math.ceil(rawPrice / rounding) * rounding : Math.round(rawPrice);
    const grossProfit = roundedPrice - costPrice;
    const marginOnSalePct = roundedPrice > 0 ? (grossProfit / roundedPrice) * 100 : 0;
    return {
      suggestedPrice: Math.round(rawPrice),
      roundedPrice,
      grossProfit,
      markupPct: targetMarginPct,
      marginOnSalePct: Math.round(marginOnSalePct * 10) / 10
    };
  };

  const addSupplierCheck = async (checkData: Omit<SupplierCheck, 'id' | 'checkedAt'>): Promise<string> => {
    const newCheck: SupplierCheck = {
      ...checkData,
      id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      checkedAt: new Date().toISOString()
    };

    setSupplierChecks(prev => [newCheck, ...prev]);

    try {
      await saveSupplierCheckToFirestore(newCheck);
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'SUPPLIER_CHECKED',
        entity: 'product',
        entityId: checkData.productId,
        newValue: { availability: checkData.availability, costPriceObserved: checkData.costPriceObserved },
        notes: `Verificación de disponibilidad en ${checkData.supplierName}: ${checkData.availability}`
      });
    } catch (e) {
      console.warn('Error saving supplier check to firestore:', e);
    }

    return newCheck.id;
  };

  const verifyProductAvailability = async (
    productId: string, 
    availability: SupplierAvailability, 
    observedCost?: number, 
    notes?: string
  ) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const isoNow = new Date().toISOString();
    const adminName = user?.name || 'Diego (Admin)';
    const costChanged = observedCost !== undefined && observedCost > 0 && observedCost !== prod.costPrice;

    const isAvailableInSupplier = availability === 'AVAILABLE' || availability === 'LOW_STOCK';
    const isOutOfStockInSupplier = availability === 'OUT_OF_STOCK';

    let updatedProduct: Product = {
      ...prod,
      supplierAvailability: availability,
      supplierStockStatus: availability,
      supplierLastCheckedAt: isoNow,
      supplierLastCheckedBy: adminName,
      requiresSupplierCheck: false,
      lastUpdated: isoNow.split('T')[0]
    };

    if (isAvailableInSupplier) {
      updatedProduct.stock = Math.max(prod.stock || 0, 10);
      updatedProduct.stockStatus = 'available';
      updatedProduct.hideIfOutOfStock = false;
      if (updatedProduct.shortFeatures) {
        updatedProduct.shortFeatures = updatedProduct.shortFeatures.filter(
          f => !f.toLowerCase().includes('sin stock momentáneo')
        );
      }
    } else if (isOutOfStockInSupplier) {
      updatedProduct.stock = 0;
      updatedProduct.stockStatus = 'out_of_stock';
    }

    if (costChanged && observedCost) {
      const oldCost = prod.costPrice;
      const targetMargin = prod.marginPercentage || settings.defaultTargetMargin || 30;
      const calc = calculatePriceWithMargin(observedCost, targetMargin, prod.priceRounding || settings.defaultPriceRounding || 100);

      updatedProduct = {
        ...updatedProduct,
        costPrice: observedCost,
        supplierCostPrice: observedCost,
        lastCostUpdate: isoNow,
        salePrice: calc.roundedPrice,
        originalPrice: Math.round(calc.roundedPrice * 1.25)
      };

      // Create notification if cost increased
      if (observedCost > oldCost) {
        await createNotification({
          type: 'STOCK_ISSUE',
          title: `Costo mayorista actualizado en Inova ARG`,
          message: `El producto "${prod.name}" subió de $${(oldCost ?? 0).toLocaleString()} a $${(observedCost ?? 0).toLocaleString()}. El precio de venta se recalculó a $${(calc.roundedPrice ?? 0).toLocaleString()}.`,
          priority: 'HIGH',
          entityType: 'product',
          entityId: prod.id,
          read: false
        });
      }

      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'SUPPLIER_COST_CHANGED',
        entity: 'product',
        entityId: prod.id,
        previousValue: { costPrice: oldCost, salePrice: prod.salePrice },
        newValue: { costPrice: observedCost, salePrice: calc.roundedPrice },
        notes: `Actualización de costo mayorista observada en Inova ARG. Recalculado con margen ${targetMargin}%.`
      });
    }

    setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));

    try {
      await saveProductToFirestore(updatedProduct);
      await addSupplierCheck({
        productId: prod.id,
        productName: prod.name,
        productSku: prod.sku,
        supplierId: prod.supplierId || 'sup-inova',
        supplierName: prod.supplier || 'Inova ARG',
        availability,
        costPriceObserved: observedCost || prod.costPrice,
        checkedBy: adminName,
        notes: notes || `Verificación manual en web mayorista.`
      });
    } catch (e) {
      console.warn('Error updating product check in firestore:', e);
    }
  };

  const createPurchaseOrder = async (
    poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const isoNow = new Date().toISOString();
    const poNumber = poData.orderNumber || `PO-INOVA-${String(purchaseOrders.length + 1).padStart(4, '0')}`;
    const calculatedTotal = poData.items.reduce((s, i) => s + (i.estimatedCostPrice * i.quantity), 0);

    const newPO: PurchaseOrder = {
      ...poData,
      id: `po-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      orderNumber: poNumber,
      totalEstimatedCost: calculatedTotal,
      createdAt: isoNow,
      updatedAt: isoNow
    };

    setPurchaseOrders(prev => [newPO, ...prev]);

    try {
      await savePurchaseOrderToFirestore(newPO);
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'PURCHASE_ORDER_CREATED',
        entity: 'purchaseOrder',
        entityId: newPO.id,
        newValue: { orderNumber: newPO.orderNumber, total: newPO.totalEstimatedCost, itemsCount: newPO.items.length },
        notes: `Orden de compra creada para ${newPO.supplierName} por un total estimado de $${(newPO.totalEstimatedCost ?? 0).toLocaleString()}`
      });
    } catch (e) {
      console.warn('Error saving purchase order to firestore:', e);
    }

    return newPO.id;
  };

  const updatePurchaseOrder = async (id: string, updated: Partial<PurchaseOrder>) => {
    const isoNow = new Date().toISOString();
    setPurchaseOrders(prev =>
      prev.map(po => po.id === id ? { ...po, ...updated, updatedAt: isoNow } : po)
    );

    const existing = purchaseOrders.find(po => po.id === id);
    if (existing) {
      const merged: PurchaseOrder = { ...existing, ...updated, updatedAt: isoNow };
      try {
        await savePurchaseOrderToFirestore(merged);
      } catch (e) {
        console.warn('Error updating purchase order in firestore:', e);
      }
    }
  };

  const receivePurchaseOrder = async (
    id: string, 
    receivedItems: { productId: string; receivedQuantity: number; actualCostPrice?: number }[], 
    notes?: string
  ) => {
    const targetPO = purchaseOrders.find(p => p.id === id);
    if (!targetPO) return;

    const isoNow = new Date().toISOString();
    const adminName = user?.name || 'Diego (Admin)';

    let totalActualCost = 0;
    const updatedItems: PurchaseOrderItem[] = targetPO.items.map(item => {
      const rec = receivedItems.find(r => r.productId === item.productId);
      const recQty = rec ? rec.receivedQuantity : item.quantity;
      const actualCost = rec?.actualCostPrice !== undefined ? rec.actualCostPrice : item.estimatedCostPrice;
      totalActualCost += (actualCost * recQty);
      return {
        ...item,
        receivedQuantity: recQty,
        actualCostPrice: actualCost,
        subtotal: actualCost * recQty
      };
    });

    const updatedPO: PurchaseOrder = {
      ...targetPO,
      status: 'RECEIVED',
      items: updatedItems,
      totalActualCost,
      receivedAt: isoNow,
      receivedBy: adminName,
      notes: notes ? `${targetPO.notes ? targetPO.notes + ' | ' : ''}${notes}` : targetPO.notes,
      updatedAt: isoNow
    };

    setPurchaseOrders(prev => prev.map(p => p.id === id ? updatedPO : p));

    // Update stock and cost for each received product
    for (const rec of receivedItems) {
      if (rec.receivedQuantity > 0) {
        await replenishStock(
          rec.productId, 
          rec.receivedQuantity, 
          rec.actualCostPrice, 
          targetPO.supplierId, 
          `Recepción de orden de compra ${targetPO.orderNumber}`
        );
      }
    }

    try {
      await savePurchaseOrderToFirestore(updatedPO);
      await createNotification({
        type: 'ORDER_PREPARING_PENDING',
        title: `Mercadería recibida de ${targetPO.supplierName}`,
        message: `Se completó la recepción de la orden ${targetPO.orderNumber} con ${receivedItems.reduce((s, i) => s + i.receivedQuantity, 0)} unidades ingresadas al stock.`,
        priority: 'MEDIUM',
        entityType: 'supplier',
        entityId: targetPO.supplierId,
        read: false
      });
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'PURCHASE_ORDER_RECEIVED',
        entity: 'purchaseOrder',
        entityId: targetPO.id,
        newValue: { totalActualCost, status: 'RECEIVED' },
        notes: `Mercadería recibida de ${targetPO.supplierName} (${targetPO.orderNumber}). Stock actualizado automáticamente.`
      });
    } catch (e) {
      console.warn('Error saving received PO to firestore:', e);
    }
  };

  const deletePurchaseOrder = async (id: string) => {
    setPurchaseOrders(prev => prev.filter(p => p.id !== id));
    try {
      await deletePurchaseOrderFromFirestore(id);
    } catch (e) {
      console.warn('Error deleting purchase order from firestore:', e);
    }
  };

  const generatePurchaseOrderFromPendingOrders = async (supplierId: string): Promise<PurchaseOrder | null> => {
    // Find active customer orders needing supplier fulfillment
    const activeCustomerOrders = orders.filter(o => 
      ['pending', 'paid', 'preparing'].includes(o.status)
    );

    const neededMap = new Map<string, { product: Product; quantity: number; orderIds: string[] }>();

    activeCustomerOrders.forEach(order => {
      (order.items || []).forEach(cartItem => {
        const targetProdId = cartItem.productId || (cartItem as any)?.product?.id;
        if (!targetProdId) return;
        const prod = products.find(p => p.id === targetProdId);
        if (prod && (prod.supplierId === supplierId || prod.supplier === 'Inova ARG' || supplierId === 'sup-inova')) {
          const current = neededMap.get(prod.id) || { product: prod, quantity: 0, orderIds: [] };
          current.quantity += (cartItem.quantity || 1);
          if (order.id && !current.orderIds.includes(order.id)) {
            current.orderIds.push(order.id);
          }
          neededMap.set(prod.id, current);
        }
      });
    });

    if (neededMap.size === 0) {
      return null;
    }

    const items: PurchaseOrderItem[] = [];
    const relatedOrderIds: string[] = [];

    neededMap.forEach(({ product, quantity, orderIds }) => {
      items.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        supplierSku: product.supplierSku || product.sku,
        supplierProductUrl: product.supplierProductUrl || '',
        quantity,
        estimatedCostPrice: product.costPrice || product.supplierCostPrice || 0,
        subtotal: (product.costPrice || product.supplierCostPrice || 0) * quantity
      });
      orderIds.forEach(oid => {
        if (!relatedOrderIds.includes(oid)) relatedOrderIds.push(oid);
      });
    });

    const supplierObj = suppliers.find(s => s.id === supplierId) || { name: 'Inova ARG' };
    const totalEstimatedCost = items.reduce((s, i) => s + i.subtotal, 0);

    const draftPO: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'> = {
      orderNumber: `PO-INOVA-${String(purchaseOrders.length + 1).padStart(4, '0')}`,
      supplierId: supplierId || 'sup-inova',
      supplierName: supplierObj.name,
      items,
      totalEstimatedCost,
      status: totalEstimatedCost >= (settings.supplierMinimumOrder || 80000) ? 'READY' : 'DRAFT',
      relatedOrderIds,
      notes: `Generado automáticamente a partir de ${relatedOrderIds.length} pedidos de clientes pendientes.`
    };

    const newId = await createPurchaseOrder(draftPO);
    return purchaseOrders.find(p => p.id === newId) || {
      ...draftPO,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  const addSupplierReturn = async (
    returnData: Omit<SupplierReturn, 'id' | 'createdAt'>
  ): Promise<string> => {
    const newRet: SupplierReturn = {
      ...returnData,
      id: `ret-sup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString()
    };

    setSupplierReturns(prev => [newRet, ...prev]);

    try {
      await saveSupplierReturnToFirestore(newRet);
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'SUPPLIER_RETURN_REGISTERED',
        entity: 'supplierReturn',
        entityId: newRet.id,
        newValue: { product: newRet.productName, quantity: newRet.quantity, reason: newRet.reason },
        notes: `Devolución / RMA registrada ante proveedor ${newRet.supplierName}`
      });
    } catch (e) {
      console.warn('Error saving supplier return to firestore:', e);
    }

    return newRet.id;
  };

  // =============================================================
  // FASE 7.5: ASSISTANT, CONVERSATIONS, TICKETS & FAQS METHODS
  // =============================================================

  const toggleAssistant = () => {
    setIsAssistantOpen(prev => !prev);
  };

  const quickOpenAssistantWithPrompt = (promptText: string) => {
    setIsAssistantOpen(true);
    sendAssistantUserMessage(promptText);
  };

  // Automatically link assistant chat conversation per active user without losing ongoing messages
  useEffect(() => {
    if (!user || (!user.id && !user.email)) {
      return;
    }

    const targetConvId = `conv-user-${(user.id || user.email).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    setConversations(prevConvs => {
      const existingUserConv = prevConvs.find(c => c.id === targetConvId);
      const activeConv = prevConvs.find(c => c.id === currentConversationId);
      const messagesToKeep = (activeConv && activeConv.messages && activeConv.messages.length > 0) 
        ? activeConv.messages 
        : (existingUserConv?.messages || []);

      if (existingUserConv) {
        if (messagesToKeep.length > (existingUserConv.messages?.length || 0)) {
          return prevConvs.map(c => c.id === targetConvId ? { ...c, messages: messagesToKeep } : c);
        }
        return prevConvs;
      }

      const newConv: AssistantConversation = {
        id: targetConvId,
        userId: auth.currentUser?.uid || user.id,
        channel: 'web',
        customerName: user?.name || 'Cliente VONDRO',
        customerPhone: user?.phone || '',
        customerEmail: user?.email || '',
        status: 'active',
        aiPaused: false,
        unreadCountAdmin: 0,
        unreadCountCustomer: 0,
        tags: ['user-chat'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: messagesToKeep[messagesToKeep.length - 1]?.text || '',
        messages: messagesToKeep
      };
      return [newConv, ...prevConvs.filter(c => c.id !== targetConvId)];
    });

    setCurrentConversationId(targetConvId);
  }, [user]);

  // Keep conversationMessages in sync with currentConversationId
  useEffect(() => {
    const found = conversations.find(c => c.id === currentConversationId);
    if (found && found.messages) {
      setConversationMessages(found.messages);
    } else {
      setConversationMessages([]);
    }
  }, [currentConversationId, conversations]);

  const sendAssistantUserMessage = async (
    text: string,
    quickActionData?: { actionType?: AssistantMessage['actionType']; actionData?: any }
  ) => {
    if (!text || !text.trim()) return;

    const trimmedText = text.trim();
    const timestamp = new Date().toISOString();

    // Determine or create current conversation
    let conv = conversations.find(c => c.id === currentConversationId);
    if (!conv) {
      const newConvId = `conv-web-${Date.now()}`;
      conv = {
        id: newConvId,
        userId: auth.currentUser?.uid || user?.id,
        channel: 'web',
        customerName: user?.name || 'Cliente VONDRO',
        customerPhone: user?.phone || '',
        customerEmail: user?.email || '',
        status: 'active',
        aiPaused: false,
        unreadCountAdmin: 0,
        unreadCountCustomer: 0,
        tags: ['web-chat'],
        createdAt: timestamp,
        updatedAt: timestamp,
        lastMessageAt: timestamp,
        lastMessagePreview: trimmedText,
        messages: []
      };
      setCurrentConversationId(newConvId);
      setConversations(prev => [conv!, ...prev]);
    }

    // 1. Create User Message
    const userMsg: AssistantMessage = {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      conversationId: conv.id,
      userId: auth.currentUser?.uid || user?.id,
      sender: 'user',
      text: trimmedText,
      timestamp,
      channel: conv.channel || 'web',
      actionType: quickActionData?.actionType,
      actionData: quickActionData?.actionData
    };

    // Update conversation with user message immediately
    const updatedMessages = [...(conv.messages || []), userMsg];
    const updatedConv: AssistantConversation = {
      ...conv,
      messages: updatedMessages,
      lastMessageAt: timestamp,
      lastMessagePreview: trimmedText,
      unreadCountAdmin: (conv.unreadCountAdmin || 0) + 1,
      updatedAt: timestamp
    };

    setConversations(prev => prev.map(c => c.id === conv!.id ? updatedConv : c));
    setConversationMessages(updatedMessages);

    // Save to Firestore asynchronously
    saveAssistantConversationToFirestore(updatedConv);
    saveAssistantMessageToFirestore(userMsg);

    // If AI is paused by human admin, do not auto-respond
    if (conv.aiPaused) {
      return;
    }

    // 2. Process Assistant Reply (First try server-side Gemini Function Calling AI, then fallback to local assistantEngine)
    try {
      let replyText = '';
      let actionButtons: any = undefined;
      let quickReplies: any = undefined;
      let productThumbnails: any = undefined;
      let orderSummary: any = undefined;
      let requiresHumanHandoff = false;
      let isAiSuccess = false;

      // Try server-side Gemini with Function Calling and Tool Execution
      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmedText,
            conversationHistory: updatedMessages.slice(-8).map(m => ({
              role: m.sender === 'user' ? 'user' : 'model',
              text: m.text
            })),
            sessionUser: user,
            cartSubtotal,
            cartItems: cart,
            clientProducts: [],
            clientOrders: orders,
            settings: {
              freeShippingThreshold: settings.freeShippingThreshold || INITIAL_SETTINGS.freeShippingThreshold,
              whatsappNumber: settings.whatsappNumber || '5493515948952',
              zones: settings.zones
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.reply) {
            replyText = data.reply;
            isAiSuccess = true;
            if (data.productThumbnails && data.productThumbnails.length > 0) {
              productThumbnails = data.productThumbnails;
            }
            if (data.orderSummary) {
              orderSummary = data.orderSummary;
            }
            if (data.quickReplies && data.quickReplies.length > 0) {
              quickReplies = data.quickReplies;
            }
            if (data.cartAction && data.cartAction.action === 'ADD_TO_CART' && data.cartAction.product) {
              const fullP = products.find(p => p.id === data.cartAction.product.id) || data.cartAction.product;
              addToCart(fullP, data.cartAction.quantity || 1);
            }
            if (data.transferAction) {
              requiresHumanHandoff = true;
            }
          }
        }
      } catch (apiErr) {
        console.warn('[Assistant API call fallback to local engine]:', apiErr);
      }

      // If AI did not return a response, run local deterministic assistant engine
      if (!isAiSuccess || !replyText) {
        const engineResult = processNaturalLanguageQuery(trimmedText, {
          products,
          orders,
          user,
          currentUser: user,
          cartSubtotal,
          zones: settings.zones || INITIAL_SETTINGS.zones
        });

        replyText = engineResult.replyText || engineResult.text;
        actionButtons = engineResult.actionButtons;
        quickReplies = engineResult.quickReplies;
        productThumbnails = engineResult.productThumbnails;
        orderSummary = engineResult.orderSummary;
        requiresHumanHandoff = engineResult.requiresHumanHandoff || requiresHumanHandoff;

        // If unresolved query or low confidence, log to UnresolvedQueries
        if ((engineResult.confidence !== undefined && engineResult.confidence < 0.55) || engineResult.intent === 'general_inquiry') {
          const unresItem: UnresolvedQuery = {
            id: `unres-${Date.now()}`,
            userId: auth.currentUser?.uid || user?.id,
            rawQuery: trimmedText,
            queryText: trimmedText,
            detectedIntent: engineResult.intent,
            confidence: engineResult.confidence,
            channel: conv.channel || 'web',
            conversationId: conv.id,
            status: 'pending',
            createdAt: timestamp
          };
          setUnresolvedQueries(prev => [unresItem, ...prev]);
          saveUnresolvedQueryToFirestore(unresItem);
        }
      }

      if (requiresHumanHandoff && isAdmin) {
        await createNotification({
          type: 'TICKET_CREATED',
          title: '💬 Solicitud de atención con asesor',
          message: `El cliente ${conv.customerName || 'Cliente'} solicita hablar con un asesor humano en el chat (${conv.channel}).`,
          entityId: conv.id,
          entityType: 'conversation',
          priority: 'high',
          read: false
        });
      }

      // 3. Create Assistant Message
      const botMsgTimestamp = new Date().toISOString();
      const botMsg: AssistantMessage = {
        id: `msg-bot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        conversationId: conv.id,
        userId: auth.currentUser?.uid || user?.id,
        sender: 'assistant',
        text: replyText,
        timestamp: botMsgTimestamp,
        channel: conv.channel || 'web',
        quickReplies: quickReplies && quickReplies.length > 0 ? quickReplies : DEFAULT_QUICK_REPLIES.slice(0, 4),
        actionButtons: actionButtons,
        productThumbnails: productThumbnails,
        orderSummary: orderSummary
      };

      const finalMessages = [...updatedMessages, botMsg];
      const finalConv: AssistantConversation = {
        ...updatedConv,
        messages: finalMessages,
        lastMessageAt: botMsgTimestamp,
        lastMessagePreview: botMsg.text.slice(0, 60) + '...',
        updatedAt: botMsgTimestamp
      };

      setConversations(prev => prev.map(c => c.id === conv!.id ? finalConv : c));
      setConversationMessages(finalMessages);

      saveAssistantConversationToFirestore(finalConv);
      saveAssistantMessageToFirestore(botMsg);

    } catch (err) {
      console.error('[Error generating assistant response]:', err);
    }
  };

  const sendAssistantAdminMessage = async (conversationId: string, text: string) => {
    if (!text || !text.trim()) return;

    const trimmedText = text.trim();
    const timestamp = new Date().toISOString();
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const adminMsg: AssistantMessage = {
      id: `msg-admin-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      conversationId: conv.id,
      sender: 'human_agent',
      text: trimmedText,
      timestamp,
      channel: conv.channel || 'web'
    };

    const newMessages = [...(conv.messages || []), adminMsg];
    const newConv: AssistantConversation = {
      ...conv,
      messages: newMessages,
      lastMessageAt: timestamp,
      lastMessagePreview: `[Asesor]: ${trimmedText}`,
      unreadCountAdmin: 0,
      updatedAt: timestamp
    };

    setConversations(prev => prev.map(c => c.id === conv.id ? newConv : c));
    if (currentConversationId === conv.id) {
      setConversationMessages(newMessages);
    }

    try {
      await saveAssistantConversationToFirestore(newConv);
      await saveAssistantMessageToFirestore(adminMsg);
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'CONVERSATION_REPLIED',
        entity: 'conversation',
        entityId: conv.id,
        newValue: { text: trimmedText, customer: conv.customerName },
        notes: `Respuesta manual enviada por asesor en conversación ${conv.id}`
      });
    } catch (e) {
      console.warn('Error saving admin message to firestore:', e);
    }
  };

  const setConversationAiPaused = async (conversationId: string, isPaused: boolean) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const updated: AssistantConversation = {
      ...conv,
      aiPaused: isPaused,
      updatedAt: new Date().toISOString()
    };

    setConversations(prev => prev.map(c => c.id === conversationId ? updated : c));

    try {
      await saveAssistantConversationToFirestore(updated);
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: isPaused ? 'ASSISTANT_AI_PAUSED' : 'ASSISTANT_AI_RESUMED',
        entity: 'conversation',
        entityId: conversationId,
        newValue: { isPaused },
        notes: isPaused ? 'IA pausada para atención humana personalizada' : 'IA reanudada en conversación'
      });
    } catch (e) {
      console.warn('Error updating AI pause state:', e);
    }
  };

  const updateConversationStatus = async (conversationId: string, status: AssistantConversationStatus) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const updated: AssistantConversation = {
      ...conv,
      status,
      updatedAt: new Date().toISOString()
    };

    setConversations(prev => prev.map(c => c.id === conversationId ? updated : c));

    try {
      await saveAssistantConversationToFirestore(updated);
    } catch (e) {
      console.warn('Error updating conversation status:', e);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (currentConversationId === conversationId) {
      const remaining = conversations.filter(c => c.id !== conversationId);
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      }
    }
    try {
      await deleteAssistantConversationFromFirestore(conversationId);
    } catch (e) {
      console.warn('Error deleting conversation from firestore:', e);
    }
  };

  const clearAssistantChat = () => {
    const activeId = currentConversationId;
    if (!activeId) return;

    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        const resetConv: AssistantConversation = {
          ...c,
          messages: [],
          lastMessagePreview: '',
          updatedAt: new Date().toISOString()
        };
        try {
          saveAssistantConversationToFirestore(resetConv);
        } catch (e) {
          console.warn('Error saving cleared conversation to firestore:', e);
        }
        return resetConv;
      }
      return c;
    }));

    setConversationMessages([]);
  };

  // Support Tickets CRUD
  const createSupportTicket = async (
    ticketData: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<SupportTicket> => {
    const count = supportTickets.length + 1;
    const ticketNumber = `TCK-${String(count).padStart(4, '0')}`;
    const timestamp = new Date().toISOString();

    const newTicket: SupportTicket = {
      ...ticketData,
      userId: ticketData.userId || auth.currentUser?.uid || user?.id,
      id: `tck-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ticketNumber,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setSupportTickets(prev => [newTicket, ...prev]);

    try {
      await saveSupportTicketToFirestore(newTicket);
      if (isAdmin) {
        await createNotification({
          type: 'TICKET_CREATED',
          title: `🎫 Nuevo Ticket ${ticketNumber}`,
          message: `${newTicket.customerName}: ${newTicket.subject || newTicket.message} (${newTicket.reason})`,
          entityId: newTicket.id,
          entityType: 'ticket',
          priority: 'high',
          read: false
        });
        await recordAdminActionInFirestore({
          adminId: user?.id || 'system',
          adminEmail: user?.email || 'sistema@vondro.com',
          action: 'TICKET_CREATED',
          entity: 'ticket',
          entityId: newTicket.id,
          newValue: { number: ticketNumber, reason: newTicket.reason, priority: newTicket.priority },
          notes: `Ticket de soporte registrado: ${newTicket.subject || newTicket.message}`
        });
      }
    } catch (e) {
      console.warn('Error saving ticket to firestore:', e);
    }

    return newTicket;
  };

  const updateTicketStatus = async (
    ticketId: string,
    status: SupportTicketStatus,
    adminNotes?: string,
    resolutionNotes?: string
  ) => {
    const ticket = supportTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const timestamp = new Date().toISOString();
    const isResolvedOrClosed = status === 'resolved' || status === 'closed' || status === 'RESOLVED' || status === 'CLOSED';
    const updated: SupportTicket = {
      ...ticket,
      status,
      adminNotes: adminNotes !== undefined ? adminNotes : ticket.adminNotes,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : ticket.resolutionNotes,
      resolvedAt: isResolvedOrClosed ? (ticket.resolvedAt || timestamp) : undefined,
      updatedAt: timestamp
    };

    setSupportTickets(prev => prev.map(t => t.id === ticketId ? updated : t));

    try {
      await saveSupportTicketToFirestore(updated);
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'TICKET_RESOLVED',
        entity: 'ticket',
        entityId: ticketId,
        newValue: { status, adminNotes, resolutionNotes },
        notes: `Estado del Ticket ${ticket.ticketNumber} actualizado a ${status}`
      });
    } catch (e) {
      console.warn('Error updating ticket status:', e);
    }
  };

  // FAQs CRUD
  const addOrUpdateFAQ = async (faqData: Partial<FAQItem> & { question: string; answer: string; category: FAQItem['category'] }) => {
    const timestamp = new Date().toISOString();
    let faqItem: FAQItem;

    if (faqData.id) {
      const existing = faqs.find(f => f.id === faqData.id);
      faqItem = {
        ...existing,
        ...faqData,
        id: faqData.id,
        updatedAt: timestamp
      } as FAQItem;
      setFaqs(prev => prev.map(f => f.id === faqData.id ? faqItem : f));
    } else {
      faqItem = {
        id: `faq-${Date.now()}`,
        question: faqData.question,
        answer: faqData.answer,
        category: faqData.category,
        order: faqData.order ?? (faqs.length + 1),
        tags: faqData.tags || [],
        viewsCount: 0,
        helpfulCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      setFaqs(prev => [...prev, faqItem]);
    }

    try {
      await saveFAQToFirestore(faqItem);
      await recordAdminActionInFirestore({
        adminId: user?.id || 'admin',
        adminEmail: user?.email || 'admin@vondro.com',
        action: 'FAQ_UPDATED',
        entity: 'faq',
        entityId: faqItem.id,
        newValue: { question: faqItem.question, category: faqItem.category },
        notes: `Pregunta frecuente guardada / actualizada`
      });
    } catch (e) {
      console.warn('Error saving FAQ:', e);
    }
  };

  const deleteFAQ = async (faqId: string) => {
    setFaqs(prev => prev.filter(f => f.id !== faqId));
    try {
      await deleteFAQFromFirestore(faqId);
    } catch (e) {
      console.warn('Error deleting FAQ:', e);
    }
  };

  // Unresolved Queries Resolution
  const resolveUnresolvedQuery = async (queryId: string, adminAnswer?: string, createFaq?: boolean) => {
    const item = unresolvedQueries.find(q => q.id === queryId);
    if (!item) return;

    const timestamp = new Date().toISOString();
    const updated: UnresolvedQuery = {
      ...item,
      status: 'resolved',
      resolvedAt: timestamp,
      adminNotes: adminAnswer || item.adminNotes
    };

    setUnresolvedQueries(prev => prev.map(q => q.id === queryId ? updated : q));

    try {
      await saveUnresolvedQueryToFirestore(updated);

      if (createFaq && adminAnswer) {
        await addOrUpdateFAQ({
          question: item.rawQuery,
          answer: adminAnswer,
          category: 'ayuda'
        });
      }
    } catch (e) {
      console.warn('Error resolving unresolved query:', e);
    }
  };

  // Reset data to clean launch state ($0 KPIs, delete pre-test orders from Firestore, persist baseline)
  const resetAllSalesAndReviewsToZero = async () => {
    const ordersToClear = [...orders];
    const nowIso = new Date().toISOString();

    // 1. Mark current orders deleted locally and delete them from Firestore if Admin is authenticated
    ordersToClear.forEach(o => {
      if (o?.id) persistDeletedOrderId(o.id);
    });
    setOrders([]);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ORDERS, JSON.stringify([]));
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PRODUCTS);
    } catch (_) {}

    if (isAdmin && auth.currentUser?.emailVerified) {
      await Promise.allSettled(
        ordersToClear
          .filter(o => o?.id)
          .map(o => deleteOrderFromFirestore(o.id))
      );
      await updateSettings({ metricsResetAt: nowIso });
    } else {
      setSettings(prev => ({ ...prev, metricsResetAt: nowIso }));
    }

    // 2. Reset all products sales, units, rating, and review counts to 0
    const cleanProducts = products.map(p => ({
      ...p,
      salesCount: 0,
      unitsSold: 0,
      rating: 0,
      reviewCount: 0,
      lastSoldAt: null
    }));
    setProducts(cleanProducts);
    try {
      localStorage.setItem(
        BOOT_PRODUCTS_CACHE_KEY,
        JSON.stringify(cleanProducts.filter(p => p && p.stock > 0 && !p.hideIfOutOfStock).slice(0, 40))
      );
    } catch (_) {}

    // 3. Clear reviewsMap to clean state
    setReviewsMap({});
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.REVIEWS, JSON.stringify({}));
    } catch (_) {}

    createNotification({
      title: 'Pruebas Reiniciadas a $0',
      message: 'Ganancia, ventas y pedidos pendientes fueron establecidos en 0 para iniciar nuevas pruebas limpias.',
      type: 'SYSTEM_INFO',
      priority: 'normal',
      read: false
    });
  };

  const resetAllData = () => {
    getFullInitialProducts()
      .then(all => setProducts(all))
      .catch(() => setProducts(INSTANT_BOOT_PRODUCTS));
    setCategories(INITIAL_CATEGORIES);
    setOrders(INITIAL_ORDERS);
    setCoupons(INITIAL_COUPONS);
    setSettings(INITIAL_SETTINGS);
    setSuppliers(INITIAL_SUPPLIERS);
    setCouriers(INITIAL_COURIERS);
    setLogisticsProviders(INITIAL_LOGISTICS_PROVIDERS);
    setShippingExpenses(INITIAL_SHIPPING_EXPENSES);
    setStockMovements([]);
    setNotifications([]);
    setAdminActions([]);
    setOrderReturns([]);
    setCart([]);
    setFavorites([]);
    setAppliedCoupon(null);
    setConversations(INITIAL_ASSISTANT_CONVERSATIONS);
    setSupportTickets(INITIAL_SUPPORT_TICKETS);
    setFaqs(INITIAL_FAQS);
    setUnresolvedQueries(INITIAL_UNRESOLVED_QUERIES);
    setReviewsMap({});
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.REVIEWS);
    } catch (_) {}
  };

  // FASE 8: Abandoned Carts & Stock Resolution Functions
  const recordAbandonedCart = async (
    cartItems: CartItem[], 
    customerName?: string, 
    phone?: string, 
    email?: string
  ): Promise<string> => {
    const newCart: AbandonedCart = {
      id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      items: cartItems,
      subtotal: cartItems.reduce((sum, i) => sum + (i.product.salePrice * i.quantity), 0),
      totalAmount: cartItems.reduce((sum, i) => sum + (i.product.salePrice * i.quantity), 0),
      status: 'ABANDONED',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      customerName: customerName || user?.name || 'Cliente Córdoba',
      phone: phone || user?.phone || '3511234567',
      email: email || user?.email || 'cliente@vondro.com',
      recoveryStatus: 'PENDING',
      attemptsCount: 0
    };
    setAbandonedCarts(prev => [newCart, ...prev]);
    return newCart.id;
  };

  const recoverAbandonedCart = async (cartId: string) => {
    setAbandonedCarts(prev => prev.map(c => c.id === cartId ? {
      ...c,
      recoveryStatus: 'RECOVERED',
      lastActivityAt: new Date().toISOString()
    } : c));
  };

  const confirmOrderStock = async (orderId: string, isAvailable: boolean) => {
    if (isAvailable) {
      await updateOrderStatus(orderId, 'stock_confirmed', 'Stock verificado y disponible en depósito');
    } else {
      await updateOrderStatus(orderId, 'STOCK_ISSUE', 'Sin stock suficiente en proveedor');
      createNotification({
        title: 'ALERTA DE STOCK EN PEDIDO',
        message: `El pedido ${orderId} presentó problema de stock al verificar disponibilidad.`,
        type: 'STOCK_ISSUE',
        priority: 'high',
        entityType: 'order',
        entityId: orderId,
        read: false
      });
    }
  };

  const resolveStockIssue = async (
    orderId: string, 
    action: 'CONTACT_CLIENT' | 'WAIT_RESTOCK' | 'REPLACE_PRODUCT' | 'CANCEL_ORDER' | 'REFUND',
    notes?: string
  ) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (action === 'CANCEL_ORDER' || action === 'REFUND') {
      await cancelOrderWithStockRefund(order, notes || 'Cancelado por falta de stock');
    } else if (action === 'WAIT_RESTOCK') {
      await updateOrderStatus(orderId, 'checking_stock', `Esperando reingreso de stock: ${notes || ''}`);
    } else if (action === 'REPLACE_PRODUCT') {
      await updateOrderStatus(orderId, 'preparing', `Producto reemplazado según acuerdo con el cliente: ${notes || ''}`);
    } else if (action === 'CONTACT_CLIENT') {
      await updateOrderStatus(orderId, 'STOCK_ISSUE', `Cliente contactado por WhatsApp/Teléfono: ${notes || ''}`);
    }
  };

  // -------------------------------------------------------------
  // FASE 10: DAILY STOCK & CATALOG AUDIT IMPLEMENTATION
  // -------------------------------------------------------------
  // Subscribe to real-time daily stock audits from Firestore
  useEffect(() => {
    const isVerifiedAdmin = Boolean(
      isAdmin &&
      auth.currentUser?.emailVerified &&
      checkIsAdminEmail(auth.currentUser?.email || user?.email)
    );
    if (!isVerifiedAdmin) {
      return;
    }
    const unsubscribe = subscribeToDailyStockAudits((audits) => {
      if (audits && audits.length > 0) {
        setDailyAudits(audits);
        setLatestDailyAudit(audits[0]);
      }
    });
    return () => unsubscribe();
  }, [isAdmin, user?.email]);

  const fetchDailyStockAuditsList = async () => {
    try {
      if (!auth.currentUser || !isAdmin) return;
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/daily-stock-analysis', {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.latestAudit) setLatestDailyAudit(data.latestAudit);
        if (data.history) setDailyAudits(data.history);
        if (data.scheduler) setDailyStockSchedulerConfig(data.scheduler);
      }
    } catch (err) {
      console.warn('Could not fetch daily stock audits from server, using local fallback:', err);
    }
  };

  // Apply live server/Inova products into local state + authenticated Admin Firestore batch writes
  const persistLiveCatalogDiffsToFirestore = useCallback(async (
    authoritativeServerProducts: Product[],
    options?: { forceOverwriteNewer?: boolean }
  ): Promise<number> => {
    const canAdminWrite = Boolean(
      isAdmin &&
      auth.currentUser?.emailVerified &&
      checkIsAdminEmail(auth.currentUser?.email || user?.email)
    );
    if (!canAdminWrite || !Array.isArray(authoritativeServerProducts) || authoritativeServerProducts.length === 0) {
      return 0;
    }

    // Ensure we have the exact Firestore snapshot to diff against
    if (firestoreRemoteProductsRef.current.size === 0) {
      const snapMap = await fetchFirestoreProductsSnapshotMap();
      if (snapMap.size > 0) {
        firestoreRemoteProductsRef.current = snapMap;
      }
    }

    const remoteMap = firestoreRemoteProductsRef.current;
    const srvMap = new Map<string, Product>();
    const toWrite: Product[] = [];

    const parseTs = (val?: string | null): number => {
      if (!val) return 0;
      const ms = Date.parse(String(val));
      return Number.isFinite(ms) ? ms : 0;
    };

    for (const srvP of authoritativeServerProducts) {
      if (!srvP || !srvP.id) continue;
      srvMap.set(srvP.id, srvP);
      const fsP = remoteMap.get(srvP.id);

      if (!fsP) {
        toWrite.push(srvP);
        continue;
      }

      const fsStock = Number(fsP.stock ?? -1);
      const srvStock = Number(srvP.stock ?? 0);
      const fsStatus = String(fsP.stockStatus || '');
      const srvStatus = String(srvP.stockStatus || (srvStock <= 0 ? 'out_of_stock' : 'available'));
      const fsCost = Number(fsP.costPrice ?? 0);
      const srvCost = Number(srvP.costPrice ?? 0);
      const fsSale = Number(fsP.salePrice ?? 0);
      const srvSale = Number(srvP.salePrice ?? 0);

      // Respect a brand-new manual admin edit made directly in Firestore unless forcing Inova refresh
      const fsTs = parseTs(fsP.lastStockUpdate);
      const srvTs = parseTs(srvP.lastStockUpdate || srvP.lastUpdated);
      if (!options?.forceOverwriteNewer && fsTs > srvTs + 10000 && fsStock !== srvStock) {
        continue;
      }

      const needsZeroMarginRepair = fsSale <= fsCost && srvSale > srvCost;
      const stockDiffers = fsStock !== srvStock || fsStatus !== srvStatus;
      const priceDiffers = fsCost !== srvCost || (fsCost !== srvCost && fsSale !== srvSale) || needsZeroMarginRepair;

      if (stockDiffers || priceDiffers) {
        const mergedForWrite: Product = {
          ...fsP,
          ...srvP,
          id: srvP.id,
          // Keep manual salePrice if wholesale cost didn't change and salePrice is profitable
          salePrice: (!needsZeroMarginRepair && fsCost === srvCost && fsSale > fsCost) ? fsSale : srvSale,
          stock: srvStock,
          stockStatus: (srvStock <= 0 ? 'out_of_stock' : srvStatus) as StockStatus,
          lastStockUpdate: srvP.lastStockUpdate || new Date().toISOString(),
          lastUpdated: new Date().toISOString().split('T')[0],
        };
        toWrite.push(mergedForWrite);
      }
    }

    serverLiveCatalogRef.current = srvMap;

    if (toWrite.length === 0) {
      setLastFirestoreStockSyncAt(new Date().toISOString());
      setLastFirestoreStockSyncCount(0);
      return 0;
    }

    const res = await batchSyncProductsToFirestore(toWrite);
    if (res.written > 0) {
      toWrite.forEach(p => firestoreRemoteProductsRef.current.set(p.id, p));
      setLastFirestoreStockSyncAt(new Date().toISOString());
      setLastFirestoreStockSyncCount(res.written);

      // Immediately update React state + local cache with the newly synced products
      const writtenMap = new Map(toWrite.map(p => [p.id, p]));
      setProducts(prev => {
        const mergedMap = new Map<string, Product>();
        prev.forEach(p => {
          const updated = writtenMap.get(p.id);
          mergedMap.set(p.id, updated ? { ...p, ...updated } : p);
        });
        toWrite.forEach(p => {
          if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
        });
        const nextList = sortProductsWithNewAndRestockedFirst(normalizeProductsPricingList(Array.from(mergedMap.values())));
        try {
          localStorage.setItem(BOOT_PRODUCTS_CACHE_KEY, JSON.stringify(nextList.slice(0, 40)));
        } catch (_) {}
        return nextList;
      });
    }
    return res.written;
  }, [isAdmin, user?.email]);

  const syncInovaAndApiProductsToFirestore = useCallback(async (
    options?: { forceInovaRefresh?: boolean; silent?: boolean }
  ): Promise<{ syncedCount: number; liveSynced: boolean; skipped?: boolean; error?: string }> => {
    const canAdminWrite = Boolean(
      isAdmin &&
      auth.currentUser?.emailVerified &&
      checkIsAdminEmail(auth.currentUser?.email || user?.email)
    );
    if (!canAdminWrite || !auth.currentUser) {
      return { syncedCount: 0, liveSynced: false, skipped: true };
    }

    if (isSyncingFirestoreStockRef.current) {
      return { syncedCount: 0, liveSynced: false, skipped: true };
    }

    const now = Date.now();
    if (!options?.forceInovaRefresh && now - lastFirestoreSyncAttemptMsRef.current < 3 * 60 * 1000) {
      return { syncedCount: 0, liveSynced: false, skipped: true };
    }

    isSyncingFirestoreStockRef.current = true;
    lastFirestoreSyncAttemptMsRef.current = now;
    setIsSyncingFirestoreStock(true);

    try {
      const idToken = await auth.currentUser.getIdToken();
      let liveSynced = false;
      let returnedAudit: DailyStockAudit | null = null;

      // 1. Check current server catalog & sync timestamp
      const apiRes = await fetch('/api/products?status=all&limit=all');
      const apiData = apiRes.ok ? await apiRes.json() : null;
      const serverSyncIso: string | null = apiData?.lastInovaLiveSyncAt || null;
      const serverSyncAgeMs = serverSyncIso ? (Date.now() - Date.parse(serverSyncIso)) : Number.POSITIVE_INFINITY;

      // 2. Trigger live Inova ARG crawl if requested or server cache is missing / older than 20 min
      if (options?.forceInovaRefresh || !serverSyncIso || serverSyncAgeMs > 20 * 60 * 1000) {
        try {
          const baseForDiff = Array.from(firestoreRemoteProductsRef.current.values());
          const syncResp = await fetch('/api/admin/daily-stock-analysis/sync-inova', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify({
              products: baseForDiff.length > 0 ? baseForDiff : products
            })
          });
          if (syncResp.ok) {
            const syncJson = await syncResp.json();
            liveSynced = Boolean(syncJson.liveSynced);
            if (syncJson.audit) returnedAudit = syncJson.audit;
          }
        } catch (syncErr) {
          console.warn('[Firestore Admin Sync] Live Inova refresh warning:', syncErr);
        }
      } else {
        liveSynced = true;
      }

      // 3. Re-read authoritative /api/products after any Inova refresh
      const freshRes = liveSynced && (options?.forceInovaRefresh || !serverSyncIso || serverSyncAgeMs > 20 * 60 * 1000)
        ? await fetch('/api/products?status=all&limit=all')
        : null;
      const freshJson = freshRes && freshRes.ok ? await freshRes.json() : apiData;
      const authoritativeProducts: Product[] = Array.isArray(freshJson?.products) ? freshJson.products : [];

      const syncedCount = await persistLiveCatalogDiffsToFirestore(authoritativeProducts, {
        forceOverwriteNewer: Boolean(options?.forceInovaRefresh)
      });

      if (returnedAudit) {
        setLatestDailyAudit(returnedAudit);
        setDailyAudits(prev => [returnedAudit!, ...prev.filter(a => a.id !== returnedAudit!.id)].slice(0, 30));
        saveDailyAuditLocally(returnedAudit);
        await saveDailyStockAuditToFirestore(returnedAudit).catch(() => {});
      }

      if (syncedCount > 0 && !options?.silent) {
        console.log(`[Firestore Admin Sync] ✅ ${syncedCount} productos actualizados en Firestore con stock real de Inova.`);
      }

      return { syncedCount, liveSynced };
    } catch (err: any) {
      console.warn('[Firestore Admin Sync] Error:', err);
      return { syncedCount: 0, liveSynced: false, error: err?.message || 'Error al sincronizar Firestore' };
    } finally {
      isSyncingFirestoreStockRef.current = false;
      setIsSyncingFirestoreStock(false);
    }
  }, [isAdmin, user?.email, products, persistLiveCatalogDiffsToFirestore]);

  const runDailyStockAnalysis = async (
    customProducts?: Product[], 
    force = false,
    slot?: { time: string; name: string }
  ): Promise<DailyStockAudit | null> => {
    setIsAnalyzingDailyStock(true);
    const targetProducts = customProducts || products;
    let auditResult: DailyStockAudit | null = null;
    let didLiveSync = false;

    try {
      const idToken = (auth.currentUser && isAdmin) ? await auth.currentUser.getIdToken().catch(() => null) : null;
      if (idToken) {
        const resp = await fetch('/api/admin/daily-stock-analysis/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({
            products: targetProducts,
            executedBy: slot ? `BOT_${slot.time.replace(':', '')}` : 'ADMIN_MANUAL'
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.audit) {
            auditResult = data.audit;
            didLiveSync = Boolean(data.liveSynced);
          }
        }
      }
    } catch (apiErr) {
      console.warn('[Daily Stock Analysis] Server endpoint unreachable, computing client-side:', apiErr);
    }

    // 2. Fallback to resilient client-side computation
    if (!auditResult) {
      auditResult = computeDailyStockAudit(
        targetProducts, 
        slot ? `BOT_${slot.time.replace(':', '')}` : 'ADMIN_MANUAL',
        undefined,
        slot
      );
    }

    // 3. Save to state and Firestore (only admins can persist audits/notifications)
    setLatestDailyAudit(auditResult);
    setDailyAudits(prev => [auditResult!, ...prev.filter(a => a.id !== auditResult!.id)].slice(0, 30));
    saveDailyAuditLocally(auditResult);

    if (isAdmin) {
      try {
        await saveDailyStockAuditToFirestore(auditResult);
        // Persist live Inova / server stock diffs into Firestore under Admin auth
        if (didLiveSync) {
          const liveCatalogRes = await fetch('/api/products?status=all&limit=all').catch(() => null);
          const liveCatalogJson = liveCatalogRes && liveCatalogRes.ok ? await liveCatalogRes.json() : null;
          if (Array.isArray(liveCatalogJson?.products)) {
            await persistLiveCatalogDiffsToFirestore(liveCatalogJson.products, { forceOverwriteNewer: true });
          }
        }
      } catch (e) {
        console.warn('Error saving daily audit to Firestore:', e);
      }

      if (auditResult.outOfStockCount > 0 || auditResult.stockChangesCount > 0 || auditResult.newProductsCount > 0) {
        const notifPriority = auditResult.status === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
        createNotification({
          type: 'DAILY_STOCK_AUDIT',
          title: slot ? `🤖 Bot Auditoría [${slot.time} - ${slot.name}]` : `Auditoría Diaria: ${auditResult.date}`,
          message: auditResult.summaryNote,
          priority: notifPriority,
          entityType: 'stock',
          entityId: auditResult.id,
          read: false
        }).catch(console.warn);

        if (user?.email) {
          recordAdminActionInFirestore({
            adminId: user.id || 'admin',
            adminEmail: user.email,
            action: 'DAILY_STOCK_AUDIT',
            entity: 'dailyStockAudit',
            entityId: auditResult.id,
            newValue: {
              outOfStockCount: auditResult.outOfStockCount,
              stockChangesCount: auditResult.stockChangesCount,
              newProductsCount: auditResult.newProductsCount,
              criticalLowStockCount: auditResult.criticalLowStockCount,
              summaryNote: auditResult.summaryNote
            },
            notes: `Análisis de stock ejecutado: ${auditResult.summaryNote}`
          }).catch(console.warn);
        }
      }
    }

    setIsAnalyzingDailyStock(false);
    return auditResult;
  };

  const triggerStrategicSlot = async (slotTime: string): Promise<DailyStockAudit | null> => {
    setIsAnalyzingDailyStock(true);
    let auditResult: DailyStockAudit | null = null;
    let didLiveSync = false;
    let updatedSchedulerSnapshot: DailyStockSchedulerConfig | null = null;
    const targetSlot = (dailyStockSchedulerConfig.strategicSlots || DEFAULT_STRATEGIC_SLOTS).find(s => s.time === slotTime);
    const slotObj = targetSlot || { time: slotTime, name: 'Auditoría Estratégica Forzada', description: '', enabled: true };

    try {
      const idToken = (auth.currentUser && isAdmin) ? await auth.currentUser.getIdToken().catch(() => null) : null;
      if (idToken) {
        const resp = await fetch('/api/admin/daily-stock-analysis/trigger-slot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({
            slotTime,
            products
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.audit) {
            auditResult = data.audit;
            didLiveSync = Boolean(data.liveSynced);
            if (data.slot) {
              setDailyStockSchedulerConfig(prev => {
                const updatedSlots = (prev.strategicSlots || DEFAULT_STRATEGIC_SLOTS).map(s => 
                  s.time === slotTime ? { ...s, ...data.slot } : s
                );
                const nextConf = {
                  ...prev,
                  strategicSlots: updatedSlots,
                  lastRunDate: data.slot.lastRunDate,
                  lastRunTimestamp: data.slot.lastRunTimestamp,
                  lastExecutedSlot: `${data.slot.time} - ${data.slot.name}`
                };
                updatedSchedulerSnapshot = nextConf;
                localStorage.setItem('vondro_daily_stock_scheduler_config', JSON.stringify(nextConf));
                return nextConf;
              });
            }
          }
        }
      }
    } catch (apiErr) {
      console.warn('[Daily Stock Analysis] Error triggering slot on server, computing locally:', apiErr);
    }

    if (!auditResult) {
      auditResult = computeDailyStockAudit(products, `AUDIT_BOT_${slotTime.replace(':', '')}`, undefined, slotObj);
      setDailyStockSchedulerConfig(prev => {
        const todayStr = new Date().toISOString().split('T')[0];
        const nowIso = new Date().toISOString();
        const updatedSlots = (prev.strategicSlots || DEFAULT_STRATEGIC_SLOTS).map(s => 
          s.time === slotTime ? {
            ...s,
            lastRunDate: todayStr,
            lastRunTimestamp: nowIso,
            lastStatus: auditResult!.status,
            lastSummary: auditResult!.summaryNote
          } : s
        );
        const nextConf = {
          ...prev,
          strategicSlots: updatedSlots,
          lastRunDate: todayStr,
          lastRunTimestamp: nowIso,
          lastExecutedSlot: `${slotObj.time} - ${slotObj.name}`
        };
        updatedSchedulerSnapshot = nextConf;
        localStorage.setItem('vondro_daily_stock_scheduler_config', JSON.stringify(nextConf));
        return nextConf;
      });
    }

    setLatestDailyAudit(auditResult);
    setDailyAudits(prev => [auditResult!, ...prev.filter(a => a.id !== auditResult!.id)].slice(0, 30));
    saveDailyAuditLocally(auditResult);

    if (isAdmin) {
      try {
        await saveDailyStockAuditToFirestore(auditResult);
        if (updatedSchedulerSnapshot) {
          await saveDailyStockSchedulerToFirestore(updatedSchedulerSnapshot);
        }
        if (didLiveSync) {
          const liveCatalogRes = await fetch('/api/products?status=all&limit=all').catch(() => null);
          const liveCatalogJson = liveCatalogRes && liveCatalogRes.ok ? await liveCatalogRes.json() : null;
          if (Array.isArray(liveCatalogJson?.products)) {
            await persistLiveCatalogDiffsToFirestore(liveCatalogJson.products, { forceOverwriteNewer: true });
          }
        }
      } catch (e) {
        console.warn('Error saving daily audit to Firestore:', e);
      }

      if (auditResult.outOfStockCount > 0 || auditResult.stockChangesCount > 0 || auditResult.newProductsCount > 0) {
        createNotification({
          type: 'DAILY_STOCK_AUDIT',
          title: `🤖 Bot Auditoría [${slotObj.time} - ${slotObj.name}]`,
          message: auditResult.summaryNote,
          priority: auditResult.status === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          entityType: 'stock',
          entityId: auditResult.id,
          read: false
        }).catch(console.warn);
      }
    }

    setIsAnalyzingDailyStock(false);
    return auditResult;
  };

  const updateDailyStockSchedulerConfig = async (newConfig: Partial<DailyStockSchedulerConfig>) => {
    const updated = { ...dailyStockSchedulerConfig, ...newConfig };
    setDailyStockSchedulerConfig(updated);
    try {
      localStorage.setItem('vondro_daily_stock_scheduler_config', JSON.stringify(updated));
      if (auth.currentUser && isAdmin) {
        await saveDailyStockSchedulerToFirestore(updated).catch(() => {});
        const idToken = await auth.currentUser.getIdToken();
        await fetch('/api/admin/daily-stock-analysis/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify(updated)
        });
      }
    } catch (e) {
      console.warn('Error saving scheduler config:', e);
    }
  };

  // 🤖 24/7 Strategic Bot Ticker (Admin-only client evaluation matching 08:30, 14:30, 20:30 Córdoba time)
  useEffect(() => {
    if (!isAdmin || !products || products.length === 0) return;

    const timer = setInterval(() => {
      if (dailyStockSchedulerConfig.botActive === false && !dailyStockSchedulerConfig.enabled) return;
      const current = getCurrentArgentinaTime();
      const slots = dailyStockSchedulerConfig.strategicSlots || DEFAULT_STRATEGIC_SLOTS;

      for (const slot of slots) {
        if (!slot.enabled) continue;
        if (slot.time === current.timeStr && slot.lastRunDate !== current.dateStr && !isAnalyzingDailyStock) {
          console.log(`[🤖 Strategic Bot] Disparando horario de auditoría: ${slot.time} - ${slot.name}`);
          triggerStrategicSlot(slot.time).catch(console.warn);
        }
      }
    }, 20 * 1000);

    return () => clearInterval(timer);
  }, [isAdmin, dailyStockSchedulerConfig, isAnalyzingDailyStock, products]);

  // Automatic Daily Check & Firestore Diff Sync on Admin Login
  useEffect(() => {
    if (!isAdmin || !auth.currentUser?.emailVerified || !checkIsAdminEmail(auth.currentUser?.email || user?.email)) return;
    if (!hasRemoteProductsSnapshot || !products || products.length === 0) return;

    // 1. Immediately reconcile any stale stock in Firestore against live /api/products + Inova ARG
    syncInovaAndApiProductsToFirestore({ forceInovaRefresh: false, silent: false }).catch(console.warn);

    // 2. Ensure daily audit has run for today (Argentina time)
    const todayArgStr = getCurrentArgentinaTime().dateStr;
    if (latestDailyAudit?.date !== todayArgStr && !isAnalyzingDailyStock) {
      console.log(`[Daily Stock Analysis] Running automatic daily audit for ${todayArgStr}...`);
      runDailyStockAnalysis(products, false).catch(console.warn);
    }
  }, [isAdmin, user?.email, hasRemoteProductsSnapshot]);

  // Enforce strictly real sales count derived from actual placed orders after the current baseline
  const metricsResetMs = useMemo(() => getEffectiveMetricsResetMs(settings), [settings?.metricsResetAt]);
  const productsWithRealSales = useMemo(() => {
    const salesMap = new Map<string, number>();
    (orders || []).forEach(order => {
      if (
        isOrderAfterMetricsBaseline(order, metricsResetMs) &&
        (order.status as string) !== 'cancelled' &&
        (order.status as string) !== 'CANCELLED'
      ) {
        order.items?.forEach(item => {
          const pid = item.productId || (item as any).product?.id;
          if (pid) {
            salesMap.set(pid, (salesMap.get(pid) || 0) + (item.quantity || 1));
          }
        });
      }
    });

    return (products || []).map(p => {
      const realSales = salesMap.get(p.id) || 0;
      if (p.salesCount !== realSales || p.unitsSold !== realSales) {
        return {
          ...p,
          salesCount: realSales,
          unitsSold: realSales
        };
      }
      return p;
    });
  }, [products, orders, metricsResetMs]);

  const activeSelectedProduct = useMemo(() => {
    if (!selectedProduct) return null;
    return productsWithRealSales.find(p => p.id === selectedProduct.id) || selectedProduct;
  }, [selectedProduct, productsWithRealSales]);

  return (
    <StoreContext.Provider
      value={{
        activeTab,
        setActiveTab,
        previousTab,
        selectedProduct: activeSelectedProduct,
        openProductDetail,
        closeProductDetail,
        selectedOrder,
        openOrderDetail,
        selectedCategoryFilter,
        setSelectedCategoryFilter,
        selectedSubcategoryFilter,
        setSelectedSubcategoryFilter,
        searchQuery,
        setSearchQuery,
        recentSearches,
        addRecentSearch,
        removeRecentSearch,
        clearRecentSearches,
        searchSortBy,
        setSearchSortBy,
        searchOnlyInStock,
        setSearchOnlyInStock,
        searchOnlyOffers,
        setSearchOnlyOffers,
        searchOnlySeasonal,
        setSearchOnlySeasonal,
        resetSearchFilters,
        products: productsWithRealSales,
        categories,
        addProduct,
        updateProduct,
        deleteProduct,
        updateStock,
        addCategory,
        updateCategory,
        deleteCategory,
        syncCategoriesWithInovaCatalog,
        cart,
        selectedCartItemKeys,
        selectedCartItems,
        toggleCartItemSelection,
        toggleSelectAllCartItems,
        removeCartItemsByKeys,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        freeShippingThreshold,
        isFreeShipping,
        amountForFreeShipping,
        progressToFreeShipping,
        favorites,
        toggleFavorite,
        isFavorite,
        clearFavorites,
        coupons,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        discountAmount,
        addCoupon,
        toggleCouponStatus,
        deleteCoupon,
        redeemReferralCode,
        shippingZones: settings.zones || INITIAL_SETTINGS.zones,
        selectedZoneId,
        setSelectedZoneId,
        currentShippingCost,
        updateShippingZone,
        addShippingZone,
        deleteShippingZone,
        orders,
        createOrder,
        createMercadoPagoPreference,
        processPaymentResult,
        lastPaymentResult,
        setLastPaymentResult,
        updateOrderStatus,
        deleteOrder,
        deletedOrderIds,
        settings,
        storeSettings: settings,
        updateSettings,
        isAdmin,
        setIsAdmin,
        user,
        registeredUsers,
        setUser,
        updateUserProfile,
        signInWithEmail,
        signUpWithEmail,
        signInGoogle,
        signInFacebook,
        signInApple,
        signOut,
        deleteAccount,
        sendPasswordReset,
        isFirebaseSynced,
        syncDatabaseToFirestore,
        isCartPillVisible,
        setIsCartPillVisible,
        resetAllData,
        resetAllSalesAndReviewsToZero,

        // Product Reviews & Dynamic Ratings
        reviewsMap,
        addProductReview,
        likeProductReview,
        getProductReviews,
        getProductRatingSummary,
        hasUserPurchasedProduct,

        // FASE 5
        suppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
        stockMovements,
        replenishStock,
        adjustStock,
        notifications,
        unreadNotificationsCount,
        createNotification,
        markNotificationRead,
        markAllNotificationsRead,
        adminActions,
        orderReturns,
        registerOrderReturn,
        bulkUpdateProducts,
        importProductsCSV,
        cancelOrderWithStockRefund,
        updateOrderPreparation,

        // FASE 6
        couriers,
        addCourier,
        updateCourier,
        deleteCourier,
        logisticsProviders,
        addLogisticsProvider,
        updateLogisticsProvider,
        shippingExpenses,
        addShippingExpense,
        updateShippingStatus,
        updateOrderPackageInfo,
        assignCourierToOrder,

        // FASE 7
        supplierChecks,
        addSupplierCheck,
        verifyProductAvailability,
        purchaseOrders,
        createPurchaseOrder,
        updatePurchaseOrder,
        receivePurchaseOrder,
        deletePurchaseOrder,
        generatePurchaseOrderFromPendingOrders,
        supplierReturns,
        addSupplierReturn,
        calculatePriceWithMargin,

        // FASE 7.5
        conversations,
        currentConversationId,
        setCurrentConversationId,
        conversationMessages,
        supportTickets,
        faqs,
        unresolvedQueries,
        isAssistantOpen,
        setIsAssistantOpen,
        toggleAssistant,
        unreadAssistantMessagesCount,
        sendAssistantUserMessage,
        sendAssistantAdminMessage,
        setConversationAiPaused,
        updateConversationStatus,
        deleteConversation,
        clearAssistantChat,
        createSupportTicket,
        updateTicketStatus,
        addOrUpdateFAQ,
        deleteFAQ,
        resolveUnresolvedQuery,
        quickOpenAssistantWithPrompt,

        // FASE 8
        abandonedCarts,
        recordAbandonedCart,
        recoverAbandonedCart,
        confirmOrderStock,
        resolveStockIssue,

        // FASE 9: Dynamic Recommendations
        recentBrowsingCategories,
        recommendationRefreshTrigger,
        refreshRecommendationsFeed,
        recordCategoryVisit: handleRecordCategoryVisit,

        // FASE 10: Daily Stock & Catalog Audit
        dailyAudits,
        latestDailyAudit,
        isAnalyzingDailyStock,
        isSyncingFirestoreStock,
        lastFirestoreStockSyncAt,
        lastFirestoreStockSyncCount,
        dailyStockSchedulerConfig,
        runDailyStockAnalysis,
        triggerStrategicSlot,
        updateDailyStockSchedulerConfig,
        fetchDailyStockAuditsList,
        syncInovaAndApiProductsToFirestore,

        // Gamification
        isSpinWheelOpen,
        openSpinWheel,
        closeSpinWheel,

        // Flash deals
        activeFlashDealIds: globalFlashTimer.activeProductIds,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
