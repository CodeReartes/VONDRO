import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  writeBatch,
  runTransaction,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { optimizeProductPayload } from '../utils/imageCompressor';
import { normalizeProductsPricingList } from '../utils/pricingUtils';
import { sortProductsWithNewAndRestockedFirst } from '../utils/productSorting';
import { decodeHtmlEntities } from '../utils/imageOptimizer';
import { 
  AdminAction,
  AppNotification,
  Category, 
  Coupon, 
  Courier,
  LogisticsProvider,
  Order, 
  OrderItem,
  OrderReturn,
  OrderStatus, 
  PaymentStatus,
  Product,
  PurchaseOrder,
  SupplierCheck,
  SupplierReturn, 
  ShippingExpense,
  ShippingRecord,
  ShippingStatus,
  ShippingZone, 
  StockMovement,
  StockStatus,
  StoreSettings, 
  Supplier,
  SupportTicket,
  UnresolvedQuery,
  FAQItem,
  AssistantConversation,
  AssistantMessage,
  UserAccount,
  DailyStockAudit,
  DailyStockSchedulerConfig
} from '../types';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_COUPONS, 
  INITIAL_COURIERS,
  INITIAL_FAQS,
  INITIAL_LOGISTICS_PROVIDERS,
  INITIAL_ORDERS, 
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SETTINGS, 
  INITIAL_SHIPPING_EXPENSES,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_CHECKS,
  INITIAL_SUPPLIER_RETURNS,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_UNRESOLVED_QUERIES,
} from '../data/initialMetadata';
import { INSTANT_BOOT_PRODUCTS } from '../data/instantBootProducts';

let cachedFullInitialProducts: Product[] | null = null;
async function loadFullInitialProducts(): Promise<Product[]> {
  if (cachedFullInitialProducts) return cachedFullInitialProducts;
  const mod = await import('../data/initialData');
  cachedFullInitialProducts = mod.INITIAL_PRODUCTS;
  return cachedFullInitialProducts;
}
// Trigger idle preload in background only after initial paint if needed
function getSyncFallbackCatalog(): Product[] {
  return cachedFullInitialProducts || INSTANT_BOOT_PRODUCTS;
}

// Collection Names
export const COLLECTIONS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  ORDERS: 'orders',
  COUPONS: 'coupons',
  SHIPPING_ZONES: 'shippingZones',
  SETTINGS: 'settings',
  USERS: 'users',
  SUPPLIERS: 'suppliers',
  STOCK_MOVEMENTS: 'stockMovements',
  NOTIFICATIONS: 'notifications',
  ADMIN_ACTIONS: 'adminActions',
  RETURNS: 'returns',
  COURIERS: 'couriers',
  LOGISTICS_PROVIDERS: 'logisticsProviders',
  SHIPPING_EXPENSES: 'shippingExpenses',
  SHIPPING_RECORDS: 'shippingRecords',
  SUPPLIER_CHECKS: 'supplierChecks',
  PURCHASE_ORDERS: 'purchaseOrders',
  SUPPLIER_RETURNS: 'supplierReturns',
  ASSISTANT_CONVERSATIONS: 'assistantConversations',
  ASSISTANT_MESSAGES: 'assistantMessages',
  SUPPORT_TICKETS: 'supportTickets',
  FAQS: 'faqs',
  UNRESOLVED_QUERIES: 'unresolvedQueries',
  DAILY_STOCK_AUDITS: 'dailyStockAudits'
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  // If it's a transient offline/unavailable notice, log informative warning
  if (errMessage.includes('unavailable') || errMessage.includes('the client is offline')) {
    console.warn(`[Firestore Offline Mode] Operation '${operationType}' on '${path}': Operating in local cache/fallback mode.`);
    return;
  }

  // If it's a permission restriction due to unauthenticated / client role access on an admin path, log clean info warning
  if (
    errMessage.includes('Missing or insufficient permissions') || 
    errMessage.includes('permission-denied') || 
    errMessage.includes('insufficient permissions')
  ) {
    console.warn(`[Firestore Security Rules] Access to '${path}' with operation '${operationType}' restricted for current session (${auth.currentUser?.email || 'unauthenticated'}).`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// -------------------------------------------------------------
// 0. CONNECTION TEST
// -------------------------------------------------------------
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'storeConfig'));
    return snap.exists();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('offline') || msg.includes('unavailable')) {
      console.warn('[Firestore Status] Backend connection temporarily unavailable; running with local client cache.');
    }
    return false;
  }
}

// -------------------------------------------------------------
// 1. PRODUCTS SERVICES
// -------------------------------------------------------------

export function normalizeStockStatus(
  status: unknown,
  stock: number = 0,
  minimumStock: number = 3
): StockStatus {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'hidden' || s === 'inactive') return 'hidden';
  if (s === 'out_of_stock' || stock <= 0) return 'out_of_stock';
  if (s === 'low_stock' || stock <= Math.max(1, minimumStock)) return 'low_stock';
  if (s === 'available' || s === 'in_stock') return 'available';
  return stock > 0 ? 'available' : 'out_of_stock';
}

function normalizeProductFromFirestore(id: string, raw: Omit<Product, 'id'>): Product {
  const stock = typeof raw.stock === 'number' ? raw.stock : 0;
  const minimumStock = typeof raw.minimumStock === 'number' ? raw.minimumStock : 3;
  return {
    ...raw,
    id,
    name: decodeHtmlEntities(raw.name || ''),
    description: decodeHtmlEntities(raw.description || ''),
    shortFeatures: Array.isArray(raw.shortFeatures)
      ? raw.shortFeatures.map(f => decodeHtmlEntities(String(f || '')))
      : raw.shortFeatures,
    stockStatus: normalizeStockStatus(raw.stockStatus, stock, minimumStock),
  };
}

export const subscribeToProducts = (callback: (products: Product[]) => void, limitCount?: number) => {
  try {
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    const q = (limitCount && limitCount > 0)
      ? query(productsRef, orderBy('salesCount', 'desc'), limit(limitCount))
      : query(productsRef, orderBy('salesCount', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const products: Product[] = [];
      snapshot.forEach((docSnap) => {
        products.push(normalizeProductFromFirestore(docSnap.id, docSnap.data() as Omit<Product, 'id'>));
      });
      callback(products);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.PRODUCTS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PRODUCTS);
    return () => {};
  }
};

// -------------------------------------------------------------
// CURSOR-BASED PRODUCT PAGINATION & CACHE LAYER
// -------------------------------------------------------------
export interface FetchProductsOptions {
  categoryId?: string | null;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'featured' | 'price-asc' | 'price-desc' | 'discount' | 'rating' | 'newest';
  onlyInStock?: boolean;
  onlyOffers?: boolean;
  limitCount?: number;
  startAfterDoc?: QueryDocumentSnapshot<DocumentData> | null;
  forceRefresh?: boolean;
}

export interface PaginatedProductsResult {
  products: Product[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  fromCache?: boolean;
  totalEstimated?: number;
}

interface CachedQueryResult {
  timestamp: number;
  data: PaginatedProductsResult;
}

const queryCache = new Map<string, CachedQueryResult>();
const QUERY_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes TTL

export function invalidateProductsCache() {
  queryCache.clear();
}

export const fetchProductsPaginated = async (
  options: FetchProductsOptions = {}
): Promise<PaginatedProductsResult> => {
  const {
    categoryId,
    minPrice,
    maxPrice,
    sortBy = 'featured',
    onlyInStock = false,
    onlyOffers = false,
    limitCount = 20,
    startAfterDoc = null,
    forceRefresh = false
  } = options;

  // Build cache key based on query parameters and cursor
  const cursorId = startAfterDoc ? startAfterDoc.id : 'first_page';
  const cacheKey = `products_${categoryId || 'all'}_${sortBy}_${onlyInStock}_${onlyOffers}_${minPrice ?? 'none'}_${maxPrice ?? 'none'}_${limitCount}_${cursorId}`;

  if (!forceRefresh) {
    const cached = queryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < QUERY_CACHE_TTL_MS)) {
      return { ...cached.data, fromCache: true };
    }
  }

  try {
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    const constraints: any[] = [];

    // Filter by Category
    if (categoryId && categoryId !== 'all') {
      constraints.push(where('categoryId', '==', categoryId));
    }

    // Filter by stock
    if (onlyInStock) {
      constraints.push(where('stock', '>', 0));
    }

    // Sort order
    if (sortBy === 'price-asc') {
      constraints.push(orderBy('salePrice', 'asc'));
    } else if (sortBy === 'price-desc') {
      constraints.push(orderBy('salePrice', 'desc'));
    } else if (sortBy === 'discount') {
      constraints.push(orderBy('discountPercentage', 'desc'));
    } else if (sortBy === 'rating') {
      constraints.push(orderBy('rating', 'desc'));
    } else if (sortBy === 'newest') {
      constraints.push(orderBy('createdAt', 'desc'));
    } else {
      // 'featured'
      constraints.push(orderBy('salesCount', 'desc'));
    }

    // Cursor pagination: start after document snapshot
    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    // Fetch 1 extra document to accurately determine if hasMore without an extra count query
    constraints.push(limit(limitCount + 1));

    const q = query(productsRef, ...constraints);
    const getDocsWithTimeout = Promise.race([
      getDocs(q),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 2500))
    ]);
    const snapshot = await getDocsWithTimeout;

    if (snapshot.empty) {
      // If Firestore has no documents, fallback gracefully to INITIAL_PRODUCTS
      return fallbackInitialProducts(options);
    }

    const docs = snapshot.docs;
    const hasMore = docs.length > limitCount;
    const slicedDocs = hasMore ? docs.slice(0, limitCount) : docs;
    const lastDoc = slicedDocs.length > 0 ? slicedDocs[slicedDocs.length - 1] : null;

    let products: Product[] = slicedDocs.map(docSnap =>
      normalizeProductFromFirestore(docSnap.id, docSnap.data() as Omit<Product, 'id'>)
    );

    // In-memory post-filters for price range & offers if requested
    if (minPrice !== undefined && minPrice !== null) {
      products = products.filter(p => p.salePrice >= minPrice);
    }
    if (maxPrice !== undefined && maxPrice !== null) {
      products = products.filter(p => p.salePrice <= maxPrice);
    }
    if (onlyOffers) {
      products = products.filter(p => (p.discountPercentage && p.discountPercentage > 0) || p.isFlashSale);
    }

    // Strictly ensure newly uploaded and restocked products appear first in featured and newest listings
    if (sortBy === 'featured' || sortBy === 'newest') {
      products = sortProductsWithNewAndRestockedFirst(products);
    }

    const result: PaginatedProductsResult = {
      products,
      lastDoc,
      hasMore
    };

    // Store in query cache
    queryCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });

    return result;
  } catch (error: any) {
    console.warn('[Firestore Pagination] Error fetching paginated products:', error?.message || error);
    handleFirestoreError(error, OperationType.LIST, COLLECTIONS.PRODUCTS);
    // Graceful fallback to initial data
    return fallbackInitialProducts(options);
  }
};

function fallbackInitialProducts(options: FetchProductsOptions): PaginatedProductsResult {
  const {
    categoryId,
    minPrice,
    maxPrice,
    sortBy = 'featured',
    onlyInStock = false,
    onlyOffers = false,
    limitCount = 20,
    startAfterDoc
  } = options;

  let filtered = normalizeProductsPricingList([...getSyncFallbackCatalog()]).map(p =>
    normalizeProductFromFirestore(p.id, p)
  );

  if (categoryId && categoryId !== 'all') {
    filtered = filtered.filter(p => p.categoryId === categoryId);
  }
  if (onlyInStock) {
    filtered = filtered.filter(p => p.stock > 0);
  }
  if (minPrice !== undefined) {
    filtered = filtered.filter(p => p.salePrice >= minPrice);
  }
  if (maxPrice !== undefined) {
    filtered = filtered.filter(p => p.salePrice <= maxPrice);
  }
  if (onlyOffers) {
    filtered = filtered.filter(p => (p.discountPercentage && p.discountPercentage > 0) || p.isFlashSale);
  }

  // Sort
  if (sortBy === 'price-asc') {
    filtered.sort((a, b) => a.salePrice - b.salePrice);
  } else if (sortBy === 'price-desc') {
    filtered.sort((a, b) => b.salePrice - a.salePrice);
  } else if (sortBy === 'discount') {
    filtered.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
  } else if (sortBy === 'rating') {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortBy === 'newest') {
    filtered = sortProductsWithNewAndRestockedFirst(filtered);
  } else {
    // Default 'featured': prioritize in-stock new arrivals, restocked items, and updated stock first
    filtered = sortProductsWithNewAndRestockedFirst(filtered);
  }

  // Find index of startAfterDoc if simulated
  let startIndex = 0;
  if (startAfterDoc && typeof startAfterDoc === 'object' && 'id' in startAfterDoc) {
    const foundIdx = filtered.findIndex(p => p.id === (startAfterDoc as any).id);
    if (foundIdx !== -1) {
      startIndex = foundIdx + 1;
    }
  }

  const paginated = filtered.slice(startIndex, startIndex + limitCount);
  const hasMore = startIndex + limitCount < filtered.length;
  const lastItem = paginated[paginated.length - 1];
  const fakeDoc = lastItem ? ({ id: lastItem.id } as any) : null;

  return {
    products: paginated,
    lastDoc: fakeDoc,
    hasMore,
    fromCache: true,
    totalEstimated: filtered.length
  };
}

export const saveProductToFirestore = async (product: Omit<Product, 'id'> | Product, customId?: string): Promise<string> => {
  const id = customId || ('id' in product ? product.id : `prod-${Date.now()}`);
  const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
  
  // Sanitize and compress all base64 images to stay safely below 1MB
  let optimized = await optimizeProductPayload(product);
  
  let data: any = {
    ...optimized,
    id,
    lastStockUpdate: (product as any).lastStockUpdate || new Date().toISOString(),
    lastUpdated: new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp()
  };

  // Ultra-safe size check before sending to Firestore
  if (JSON.stringify(data).length > 850000) {
    if (Array.isArray(data.images) && data.images.length > 1) {
      data.images = [data.images[0]];
    }
    if (Array.isArray(data.variants)) {
      data.variants = data.variants.map((v: any) => ({
        ...v,
        imageUrl: (typeof v.imageUrl === 'string' && v.imageUrl.startsWith('data:')) ? '' : v.imageUrl
      }));
    }
  }

  try {
    await setDoc(productRef, data, { merge: true });
    invalidateProductsCache();
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('exceeds') || msg.includes('bytes') || msg.includes('size')) {
      console.warn('Firestore size error intercepted, applying ultimate compression fallback...', msg);
      // Remove all base64 strings and retry
      const safeData = {
        ...data,
        images: (data.images || []).filter((img: string) => !img.startsWith('data:image/')),
        variants: (data.variants || []).map((v: any) => ({ ...v, imageUrl: '' }))
      };
      try {
        await setDoc(productRef, safeData, { merge: true });
        invalidateProductsCache();
        return id;
      } catch (retryErr) {
        handleFirestoreError(retryErr, OperationType.WRITE, `${COLLECTIONS.PRODUCTS}/${id}`);
      }
    } else {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PRODUCTS}/${id}`);
    }
  }
  return id;
};

export const syncCatalogToFirestore = async (force: boolean = false): Promise<{ synced: number; skipped: number }> => {
  try {
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    const snap = await getDocs(productsRef);
    const existingIds = new Set(snap.docs.map(d => d.id));

    let synced = 0;
    let skipped = 0;
    const allInitial = await loadFullInitialProducts();

    for (const prod of allInitial) {
      if (force || !existingIds.has(prod.id)) {
        await saveProductToFirestore(prod, prod.id);
        synced++;
      } else {
        skipped++;
      }
    }

    invalidateProductsCache();
    return { synced, skipped };
  } catch (err) {
    console.warn('Error in syncCatalogToFirestore:', err);
    return { synced: 0, skipped: 0 };
  }
};

export const updateProductStockInFirestore = async (productId: string, newStock: number) => {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
  const validStock = Math.max(0, newStock);
  const stockStatus = validStock === 0 ? 'out_of_stock' : validStock <= 5 ? 'low_stock' : 'available';
  const nowIso = new Date().toISOString();
  
  try {
    await updateDoc(productRef, {
      stock: validStock,
      stockStatus,
      lastStockUpdate: nowIso,
      lastUpdated: nowIso.split('T')[0],
      updatedAt: serverTimestamp()
    });
    invalidateProductsCache();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.PRODUCTS}/${productId}`);
  }
};

function stripUndefinedForFirestore<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map(item => stripUndefinedForFirestore(item)).filter(item => item !== undefined) as unknown as T;
  }
  if (typeof val === 'object') {
    const proto = Object.getPrototypeOf(val);
    if (proto !== Object.prototype && proto !== null) {
      return val;
    }
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, any>)) {
      if (v !== undefined) {
        cleaned[k] = stripUndefinedForFirestore(v);
      }
    }
    return cleaned as T;
  }
  return val;
}

export const fetchFirestoreProductsSnapshotMap = async (): Promise<Map<string, Product>> => {
  const map = new Map<string, Product>();
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.PRODUCTS));
    snap.forEach((docSnap) => {
      map.set(docSnap.id, normalizeProductFromFirestore(docSnap.id, docSnap.data() as Omit<Product, 'id'>));
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PRODUCTS);
  }
  return map;
};

export const batchSyncProductsToFirestore = async (
  productsToSync: Product[]
): Promise<{ written: number; batches: number; errors: number }> => {
  if (!Array.isArray(productsToSync) || productsToSync.length === 0) {
    return { written: 0, batches: 0, errors: 0 };
  }
  if (!auth.currentUser?.emailVerified) {
    return { written: 0, batches: 0, errors: 0 };
  }

  const validIdRegex = /^[a-zA-Z0-9._-]+$/;
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  const prepared: Array<{ id: string; payload: Record<string, any> }> = [];
  for (const prod of productsToSync) {
    if (!prod || !prod.id) continue;
    const id = String(prod.id).trim();
    if (!id || id.length > 128 || !validIdRegex.test(id)) continue;

    const validStock = Math.max(0, Number.isFinite(Number(prod.stock)) ? Number(prod.stock) : 0);
    const minStock = Number.isFinite(Number(prod.minimumStock)) ? Number(prod.minimumStock) : 3;
    const validStatus = normalizeStockStatus(prod.stockStatus, validStock, minStock);
    const validSalePrice = Math.max(0, Number.isFinite(Number(prod.salePrice)) ? Number(prod.salePrice) : 0);

    const safeImages = Array.isArray(prod.images)
      ? prod.images.filter(img => typeof img === 'string' && (!img.startsWith('data:image/') || img.length < 80000)).slice(0, 8)
      : [];
    const safeVariants = Array.isArray(prod.variants)
      ? prod.variants.map(v => ({
          ...v,
          imageUrl: (typeof v?.imageUrl === 'string' && v.imageUrl.startsWith('data:') && v.imageUrl.length > 40000) ? '' : v?.imageUrl
        }))
      : undefined;

    const cleanDoc = stripUndefinedForFirestore({
      ...prod,
      id,
      name: String(prod.name || `Producto ${id}`).slice(0, 300),
      categoryId: String(prod.categoryId || 'productos-varios'),
      salePrice: validSalePrice,
      stock: validStock,
      stockStatus: validStatus,
      images: safeImages,
      ...(safeVariants ? { variants: safeVariants } : {}),
      lastStockUpdate: prod.lastStockUpdate || nowIso,
      lastUpdated: prod.lastUpdated || todayStr,
      updatedAt: serverTimestamp()
    });

    prepared.push({ id, payload: cleanDoc });
  }

  let written = 0;
  let batches = 0;
  let errors = 0;
  const CHUNK_SIZE = 300;

  for (let i = 0; i < prepared.length; i += CHUNK_SIZE) {
    const chunk = prepared.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(doc(db, COLLECTIONS.PRODUCTS, item.id), item.payload, { merge: true });
    }
    try {
      await batch.commit();
      written += chunk.length;
      batches++;
    } catch (err) {
      errors++;
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PRODUCTS}/batchSync`);
    }
  }

  if (written > 0) {
    invalidateProductsCache();
  }

  return { written, batches, errors };
};

export const deleteProductFromFirestore = async (productId: string) => {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
  try {
    await deleteDoc(productRef);
    invalidateProductsCache();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.PRODUCTS}/${productId}`);
  }
};

export const purgeOldProductsFromFirestore = async (validProductIds: string[]) => {
  try {
    const validSet = new Set(validProductIds);
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    const snap = await getDocs(productsRef);
    const toDelete = snap.docs.filter(d => !validSet.has(d.id));
    for (const docSnap of toDelete) {
      await deleteDoc(docSnap.ref).catch(() => {});
    }
  } catch (err) {
    console.warn('Error in purgeOldProductsFromFirestore:', err);
  }
};

// -------------------------------------------------------------
// 2. CATEGORIES SERVICES
// -------------------------------------------------------------

export const subscribeToCategories = (callback: (categories: Category[]) => void) => {
  try {
    const catRef = collection(db, COLLECTIONS.CATEGORIES);
    return onSnapshot(catRef, (snapshot) => {
      const categories: Category[] = [];
      snapshot.forEach((docSnap) => {
        categories.push({ id: docSnap.id, ...(docSnap.data() as Omit<Category, 'id'>) });
      });
      categories.sort((a, b) => a.order - b.order);
      callback(categories);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.CATEGORIES);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.CATEGORIES);
    return () => {};
  }
};

export const saveCategoryToFirestore = async (category: Omit<Category, 'id'> | Category, customId?: string): Promise<string> => {
  const id = customId || ('id' in category ? category.id : (category.slug || `cat-${Date.now()}`));
  const catRef = doc(db, COLLECTIONS.CATEGORIES, id);
  try {
    await setDoc(catRef, { ...category, id, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.CATEGORIES}/${id}`);
  }
  return id;
};

export const deleteCategoryFromFirestore = async (categoryId: string) => {
  const catRef = doc(db, COLLECTIONS.CATEGORIES, categoryId);
  try {
    await deleteDoc(catRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.CATEGORIES}/${categoryId}`);
  }
};

// -------------------------------------------------------------
// 3. ORDERS SERVICES (with atomic stock deduction)
// -------------------------------------------------------------

export const subscribeToOrders = (
  callback: (orders: Order[]) => void,
  userId?: string | null,
  isAdminUser: boolean = false
) => {
  try {
    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    const targetUserId = userId || auth.currentUser?.uid || null;
    const isExplicitAdmin = isAdminUser || (
      Boolean(auth.currentUser?.emailVerified) &&
      auth.currentUser?.email?.toLowerCase() === 'reartes17diego@gmail.com'
    );

    // 1. Admin mode: query all orders with order & limit
    if (isExplicitAdmin) {
      const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(100));
      return onSnapshot(q, (snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach((docSnap) => {
          orders.push({ id: docSnap.id, ...(docSnap.data() as Omit<Order, 'id'>) });
        });
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(orders);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.ORDERS);
      });
    }

    // 2. Customer mode: scoped strictly to user's orders
    if (targetUserId) {
      const q = query(ordersRef, where('userId', '==', targetUserId));
      return onSnapshot(q, (snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach((docSnap) => {
          orders.push({ id: docSnap.id, ...(docSnap.data() as Omit<Order, 'id'>) });
        });
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(orders);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.ORDERS);
      });
    }

    // 3. Unauthenticated guest visitor: do not execute unauthorized global query
    return () => {};
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.ORDERS);
    return () => {};
  }
};

export const createOrderInFirestore = async (order: Order): Promise<{ success: boolean; orderId?: string; error?: string }> => {
  const authUid = auth.currentUser?.uid;
  if (!authUid) {
    return { success: false, error: 'Se requiere sesión autenticada para registrar pedidos en la nube.' };
  }

  const sanitizedOrder: Order = {
    ...order,
    userId: authUid,
    isGuest: false,
    status: (order.status === 'payment_received' ? 'pending_payment' : order.status) as OrderStatus,
  };

  try {
    const orderRef = doc(db, COLLECTIONS.ORDERS, sanitizedOrder.id);

    // Use a Firestore transaction to validate stock in real-time and decrement
    await runTransaction(db, async (transaction) => {
      // 1. Verify all items have sufficient stock in Firestore
      for (const item of sanitizedOrder.items) {
        const prodRef = doc(db, COLLECTIONS.PRODUCTS, item.productId);
        const prodSnap = await transaction.get(prodRef);

        if (prodSnap.exists()) {
          const currentStock = prodSnap.data().stock ?? 0;
          if (currentStock < item.quantity) {
            throw new Error(`Stock insuficiente para "${item.name}". Solo quedan ${currentStock} unidades.`);
          }
          const newStock = Math.max(0, currentStock - item.quantity);
          const minStock = prodSnap.data().minimumStock ?? 3;
          const newStockStatus: StockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';

          transaction.update(prodRef, {
            stock: newStock,
            stockStatus: newStockStatus,
            salesCount: (prodSnap.data().salesCount || 0) + item.quantity,
            updatedAt: serverTimestamp()
          });
        }
      }

      // 2. Set the order document
      transaction.set(orderRef, {
        ...sanitizedOrder,
        createdAt: sanitizedOrder.createdAt || new Date().toISOString(),
        updatedAt: sanitizedOrder.updatedAt || new Date().toISOString(),
        serverCreatedAt: serverTimestamp()
      });
    });

    return { success: true, orderId: sanitizedOrder.id };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.ORDERS}/${sanitizedOrder.id}`);
    const errMsg = String(err?.message || '');
    if (errMsg.includes('Stock insuficiente')) {
      return { success: false, error: errMsg };
    }
    return { success: false, error: errMsg || 'Error al procesar el pedido.' };
  }
};

export const updateOrderStatusInFirestore = async (
  orderId: string, 
  status: OrderStatus, 
  timeline: any[],
  orderStatusHistory?: any[],
  extraFields?: {
    paymentStatus?: PaymentStatus;
    shippingStatus?: ShippingStatus;
    deliveredAt?: string;
  }
) => {
  const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
  try {
    const payload: Record<string, any> = {
      status,
      timeline,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp()
    };
    if (orderStatusHistory) {
      payload.orderStatusHistory = orderStatusHistory;
    }
    if (extraFields?.paymentStatus) {
      payload.paymentStatus = extraFields.paymentStatus;
    }
    if (extraFields?.shippingStatus) {
      payload.shippingStatus = extraFields.shippingStatus;
    }
    if (extraFields?.deliveredAt) {
      payload.deliveredAt = extraFields.deliveredAt;
    }
    await updateDoc(orderRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ORDERS}/${orderId}`);
  }
};

export const updateOrderPaymentInFirestore = async (
  orderId: string,
  paymentData: {
    paymentStatus: PaymentStatus;
    paymentId?: string;
    paymentStatusDetail?: string;
    status?: OrderStatus;
    timeline?: any[];
    orderStatusHistory?: any[];
  }
) => {
  const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
  try {
    await updateDoc(orderRef, {
      ...paymentData,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ORDERS}/${orderId}`);
  }
};

export const deleteOrderFromFirestore = async (orderId: string) => {

  const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
  try {
    await deleteDoc(orderRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.ORDERS}/${orderId}`);
  }
};

// -------------------------------------------------------------
// 4. USERS & PROFILE
// -------------------------------------------------------------

export const saveUserToFirestore = async (user: UserAccount) => {
  const userRef = doc(db, COLLECTIONS.USERS, user.id);
  try {
    await setDoc(userRef, {
      ...user,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.USERS}/${user.id}`);
  }
};

export const getUserFromFirestore = async (userId: string): Promise<UserAccount | null> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as Omit<UserAccount, 'id'>) };
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.USERS}/${userId}`);
    return null;
  }
};

export const deleteUserFromFirestore = async (userId: string) => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  try {
    await deleteDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.USERS}/${userId}`);
  }
};

export const subscribeToUsers = (callback: (users: UserAccount[]) => void) => {
  if (!auth.currentUser) {
    return () => {};
  }
  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    return onSnapshot(usersRef, (snapshot) => {
      const users: UserAccount[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserAccount, 'id'>)
      }));
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, COLLECTIONS.USERS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, COLLECTIONS.USERS);
    return () => {};
  }
};

// -------------------------------------------------------------
// 4b. COUPONS & REFERRAL DISCOUNTS
// -------------------------------------------------------------

export const subscribeToCoupons = (callback: (coupons: Coupon[]) => void) => {
  try {
    const couponsRef = collection(db, COLLECTIONS.COUPONS);
    return onSnapshot(couponsRef, (snapshot) => {
      const list: Coupon[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Coupon, 'id'>)
      }));
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.COUPONS);
      callback(INITIAL_COUPONS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.COUPONS);
    return () => {};
  }
};

export const saveCouponToFirestore = async (coupon: Coupon) => {
  const couponRef = doc(db, COLLECTIONS.COUPONS, coupon.id);
  try {
    await setDoc(couponRef, {
      ...coupon,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.COUPONS}/${coupon.id}`);
  }
};

export const deleteCouponFromFirestore = async (couponId: string) => {
  const couponRef = doc(db, COLLECTIONS.COUPONS, couponId);
  try {
    await deleteDoc(couponRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.COUPONS}/${couponId}`);
  }
};

// -------------------------------------------------------------
// 5. STORE SETTINGS & SHIPPING ZONES
// -------------------------------------------------------------

export const subscribeToSettings = (callback: (settings: StoreSettings) => void) => {
  try {
    const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'storeConfig');
    return onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as StoreSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${COLLECTIONS.SETTINGS}/storeConfig`);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.SETTINGS}/storeConfig`);
    return () => {};
  }
};

export const saveSettingsToFirestore = async (settings: StoreSettings) => {
  const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'storeConfig');
  try {
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SETTINGS}/storeConfig`);
  }
};

// -------------------------------------------------------------
// 6. INITIAL SEEDER (Populates Firestore if empty)
// -------------------------------------------------------------

export const seedDatabaseIfEmpty = async (): Promise<{ seeded: boolean; count: number }> => {
  try {
    const isVerifiedAdmin = Boolean(
      auth.currentUser?.emailVerified &&
      auth.currentUser?.email?.toLowerCase() === 'reartes17diego@gmail.com'
    );
    if (!isVerifiedAdmin) {
      return { seeded: false, count: 0 };
    }

    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    const snap = await getDocs(query(productsRef, limit(1)));

    if (!snap.empty && snap.size > 0) {
      return { seeded: false, count: snap.size };
    }

    // Chunked batch commits (Firestore hard limit is 500 writes per batch)
    const operations: Array<{ ref: any; data: any }> = [];
    const allInitial = await loadFullInitialProducts();

    normalizeProductsPricingList(allInitial).forEach((p) => {
      operations.push({
        ref: doc(db, COLLECTIONS.PRODUCTS, p.id),
        data: { ...p, serverCreatedAt: serverTimestamp() },
      });
    });

    INITIAL_CATEGORIES.forEach((c) => {
      operations.push({
        ref: doc(db, COLLECTIONS.CATEGORIES, c.id),
        data: { ...c, serverCreatedAt: serverTimestamp() },
      });
    });

    INITIAL_COUPONS.forEach((coup) => {
      operations.push({
        ref: doc(db, COLLECTIONS.COUPONS, coup.id),
        data: { ...coup, serverCreatedAt: serverTimestamp() },
      });
    });

    INITIAL_ORDERS.forEach((ord) => {
      operations.push({
        ref: doc(db, COLLECTIONS.ORDERS, ord.id),
        data: { ...ord, serverCreatedAt: serverTimestamp() },
      });
    });

    operations.push({
      ref: doc(db, COLLECTIONS.SETTINGS, 'storeConfig'),
      data: { ...INITIAL_SETTINGS, serverCreatedAt: serverTimestamp() },
    });

    INITIAL_SUPPLIERS.forEach((sup) => {
      operations.push({
        ref: doc(db, COLLECTIONS.SUPPLIERS, sup.id),
        data: { ...sup, serverCreatedAt: serverTimestamp() },
      });
    });

    const CHUNK_SIZE = 450;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      operations.slice(i, i + CHUNK_SIZE).forEach((op) => {
        batch.set(op.ref, op.data);
      });
      await batch.commit();
    }

    return { seeded: true, count: allInitial.length };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'batch_seed');
    return { seeded: false, count: 0 };
  }
};

// -------------------------------------------------------------
// 7. SUPPLIERS SERVICES
// -------------------------------------------------------------

export const subscribeToSuppliers = (callback: (suppliers: Supplier[]) => void) => {
  if (!auth.currentUser) {
    callback(INITIAL_SUPPLIERS);
    return () => {};
  }
  try {
    const supRef = collection(db, COLLECTIONS.SUPPLIERS);
    return onSnapshot(supRef, (snapshot) => {
      const suppliers: Supplier[] = [];
      snapshot.forEach((docSnap) => {
        suppliers.push({ id: docSnap.id, ...(docSnap.data() as Omit<Supplier, 'id'>) });
      });
      suppliers.sort((a, b) => a.name.localeCompare(b.name));
      callback(suppliers);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.SUPPLIERS);
      callback(INITIAL_SUPPLIERS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPLIERS);
    return () => {};
  }
};

export const saveSupplierToFirestore = async (
  supplier: Omit<Supplier, 'id'> | Supplier, 
  customId?: string,
  adminEmail?: string
): Promise<string> => {
  const id = customId || ('id' in supplier ? supplier.id : `sup-${Date.now()}`);
  const supRef = doc(db, COLLECTIONS.SUPPLIERS, id);
  const now = new Date().toISOString();
  
  const data = {
    ...supplier,
    id,
    updatedAt: now,
    serverUpdatedAt: serverTimestamp()
  };

  try {
    await setDoc(supRef, data, { merge: true });

    // Audit action
    if (adminEmail) {
      await recordAdminActionInFirestore({
        adminId: auth.currentUser?.uid || 'admin',
        adminEmail,
        action: 'id' in supplier && supplier.id ? 'SUPPLIER_UPDATED' : 'SUPPLIER_CREATED',
        entity: 'supplier',
        entityId: id,
        newValue: { name: supplier.name, contactName: supplier.contactName },
        notes: `Proveedor ${supplier.name} guardado.`
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SUPPLIERS}/${id}`);
  }
  return id;
};

export const deleteSupplierFromFirestore = async (supplierId: string, adminEmail?: string) => {
  const supRef = doc(db, COLLECTIONS.SUPPLIERS, supplierId);
  try {
    await deleteDoc(supRef);
    if (adminEmail) {
      await recordAdminActionInFirestore({
        adminId: auth.currentUser?.uid || 'admin',
        adminEmail,
        action: 'SUPPLIER_UPDATED',
        entity: 'supplier',
        entityId: supplierId,
        notes: `Proveedor ${supplierId} eliminado.`
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SUPPLIERS}/${supplierId}`);
  }
};

// -------------------------------------------------------------
// 8. STOCK MOVEMENTS & INVENTORY LEDGER
// -------------------------------------------------------------

export const subscribeToStockMovements = (callback: (movements: StockMovement[]) => void) => {
  if (!auth.currentUser) {
    return () => {};
  }
  try {
    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    return onSnapshot(movementsRef, (snapshot) => {
      const movements: StockMovement[] = [];
      snapshot.forEach((docSnap) => {
        movements.push({ id: docSnap.id, ...(docSnap.data() as Omit<StockMovement, 'id'>) });
      });
      movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(movements);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.STOCK_MOVEMENTS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.STOCK_MOVEMENTS);
    return () => {};
  }
};

export const recordStockMovementInFirestore = async (
  movement: Omit<StockMovement, 'id' | 'createdAt'>, 
  customId?: string
): Promise<string> => {
  const id = customId || `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const movRef = doc(db, COLLECTIONS.STOCK_MOVEMENTS, id);
  const now = new Date().toISOString();
  
  const fullMovement: StockMovement = {
    ...movement,
    id,
    createdAt: now
  };

  try {
    await setDoc(movRef, {
      ...fullMovement,
      serverCreatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.STOCK_MOVEMENTS}/${id}`);
  }
  return id;
};

// -------------------------------------------------------------
// 9. NOTIFICATIONS & ADMINISTRATIVE ALERTS
// -------------------------------------------------------------

export const subscribeToNotifications = (
  callback: (notifications: AppNotification[]) => void,
  userId?: string | null,
  isAdminUser: boolean = false
) => {
  const uid = userId || auth.currentUser?.uid || null;
  const isExplicitAdmin = isAdminUser || (
    Boolean(auth.currentUser?.emailVerified) &&
    auth.currentUser?.email?.toLowerCase() === 'reartes17diego@gmail.com'
  );
  if (!auth.currentUser || (!isExplicitAdmin && !uid)) {
    return () => {};
  }
  try {
    const notifRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = isExplicitAdmin ? notifRef : query(notifRef, where('userId', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        notifs.push({ id: docSnap.id, ...(docSnap.data() as Omit<AppNotification, 'id'>) });
      });
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.NOTIFICATIONS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.NOTIFICATIONS);
    return () => {};
  }
};

export const createNotificationInFirestore = async (
  notification: Omit<AppNotification, 'id' | 'createdAt'>
): Promise<string> => {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const notifRef = doc(db, COLLECTIONS.NOTIFICATIONS, id);
  const now = new Date().toISOString();
  
  const fullNotif: AppNotification = {
    ...notification,
    id,
    createdAt: now
  };

  try {
    await setDoc(notifRef, {
      ...fullNotif,
      serverCreatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.NOTIFICATIONS}/${id}`);
  }
  return id;
};

export const markNotificationReadInFirestore = async (notifId: string, read: boolean = true) => {
  const notifRef = doc(db, COLLECTIONS.NOTIFICATIONS, notifId);
  try {
    await updateDoc(notifRef, {
      read,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.NOTIFICATIONS}/${notifId}`);
  }
};

export const markAllNotificationsReadInFirestore = async (notifs: AppNotification[]) => {
  try {
    const batch = writeBatch(db);
    notifs.filter(n => !n.read).forEach((n) => {
      const nRef = doc(db, COLLECTIONS.NOTIFICATIONS, n.id);
      batch.update(nRef, {
        read: true,
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: serverTimestamp()
      });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, COLLECTIONS.NOTIFICATIONS);
  }
};

// -------------------------------------------------------------
// 10. ADMIN ACTIONS & AUDIT TRAIL
// -------------------------------------------------------------

export const subscribeToAdminActions = (callback: (actions: AdminAction[]) => void) => {
  if (!auth.currentUser) {
    return () => {};
  }
  try {
    const actionsRef = collection(db, COLLECTIONS.ADMIN_ACTIONS);
    return onSnapshot(actionsRef, (snapshot) => {
      const actions: AdminAction[] = [];
      snapshot.forEach((docSnap) => {
        actions.push({ id: docSnap.id, ...(docSnap.data() as Omit<AdminAction, 'id'>) });
      });
      actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(actions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.ADMIN_ACTIONS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.ADMIN_ACTIONS);
    return () => {};
  }
};

export const recordAdminActionInFirestore = async (
  action: Omit<AdminAction, 'id' | 'createdAt'>
): Promise<string> => {
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const actionRef = doc(db, COLLECTIONS.ADMIN_ACTIONS, id);
  const now = new Date().toISOString();
  
  const fullAction: AdminAction = {
    ...action,
    id,
    createdAt: now
  };

  try {
    await setDoc(actionRef, {
      ...fullAction,
      serverCreatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.ADMIN_ACTIONS}/${id}`);
  }
  return id;
};

// -------------------------------------------------------------
// 11. RETURNS & RMA
// -------------------------------------------------------------

export const subscribeToOrderReturns = (callback: (returns: OrderReturn[]) => void) => {
  if (!auth.currentUser) {
    return () => {};
  }
  try {
    const returnsRef = collection(db, COLLECTIONS.RETURNS);
    return onSnapshot(returnsRef, (snapshot) => {
      const returns: OrderReturn[] = [];
      snapshot.forEach((docSnap) => {
        returns.push({ id: docSnap.id, ...(docSnap.data() as Omit<OrderReturn, 'id'>) });
      });
      returns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(returns);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTIONS.RETURNS);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.RETURNS);
    return () => {};
  }
};

export const registerOrderReturnInFirestore = async (
  returnData: Omit<OrderReturn, 'id' | 'createdAt'>,
  adminEmail: string
): Promise<string> => {
  const id = `ret-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const returnRef = doc(db, COLLECTIONS.RETURNS, id);
  const now = new Date().toISOString();
  
  const fullReturn: OrderReturn = {
    ...returnData,
    id,
    createdAt: now
  };

  try {
    await setDoc(returnRef, {
      ...fullReturn,
      serverCreatedAt: serverTimestamp()
    });

    // If refundStock is true, increment product stock & create stock movement
    if (returnData.refundStock && returnData.quantity > 0) {
      const prodRef = doc(db, COLLECTIONS.PRODUCTS, returnData.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const currentStock = prodSnap.data().stock || 0;
        const newStock = currentStock + returnData.quantity;
        const minStock = prodSnap.data().minimumStock || 3;
        const newStockStatus: StockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';

        await updateDoc(prodRef, {
          stock: newStock,
          stockStatus: newStockStatus,
          lastStockUpdate: now,
          updatedAt: serverTimestamp()
        });

        await recordStockMovementInFirestore({
          productId: returnData.productId,
          productName: returnData.productName,
          productSku: prodSnap.data().sku || '',
          type: 'RETURN',
          quantity: returnData.quantity,
          previousStock: currentStock,
          newStock,
          reason: `Devolución de Pedido #${returnData.orderNumber}: ${returnData.reason}`,
          orderId: returnData.orderId,
          adminId: auth.currentUser?.uid || 'admin'
        });
      }
    }

    // Audit log
    await recordAdminActionInFirestore({
      adminId: auth.currentUser?.uid || 'admin',
      adminEmail,
      action: 'RETURN_REGISTERED',
      entity: 'order',
      entityId: returnData.orderId,
      newValue: returnData,
      notes: `Devolución registrada para Pedido #${returnData.orderNumber} (${returnData.quantity}x ${returnData.productName}). Reintegro de stock: ${returnData.refundStock ? 'Sí' : 'No'}`
    });

  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.RETURNS}/${id}`);
  }
  return id;
};

// -------------------------------------------------------------
// 12. INTELLIGENT STOCK OPERATIONS & HELPERS
// -------------------------------------------------------------

export const replenishProductStockInFirestore = async (
  productId: string,
  quantityToAdd: number,
  unitCost?: number,
  supplierId?: string,
  notes?: string,
  adminEmail?: string
) => {
  const prodRef = doc(db, COLLECTIONS.PRODUCTS, productId);
  const now = new Date().toISOString();

  try {
    const prodSnap = await getDoc(prodRef);
    if (!prodSnap.exists()) return;

    const prodData = prodSnap.data() as Product;
    const currentStock = prodData.stock || 0;
    const newStock = currentStock + quantityToAdd;
    const minStock = prodData.minimumStock || 3;
    const newStockStatus: StockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';

    const updatePayload: Record<string, any> = {
      stock: newStock,
      stockStatus: newStockStatus,
      lastStockUpdate: now,
      lastUpdated: now.split('T')[0],
      updatedAt: serverTimestamp()
    };

    if (unitCost !== undefined && unitCost > 0) {
      updatePayload.costPrice = unitCost;
      updatePayload.lastCostUpdate = now;
    }
    if (supplierId) {
      updatePayload.supplierId = supplierId;
    }

    await updateDoc(prodRef, updatePayload);

    // Record Stock Movement
    await recordStockMovementInFirestore({
      productId,
      productName: prodData.name,
      productSku: prodData.sku || '',
      type: 'PURCHASE',
      quantity: quantityToAdd,
      previousStock: currentStock,
      newStock,
      reason: notes || `Reposición de stock (+${quantityToAdd} unidades)`,
      adminId: auth.currentUser?.uid || 'admin'
    });

    // Record Admin Action
    if (adminEmail) {
      await recordAdminActionInFirestore({
        adminId: auth.currentUser?.uid || 'admin',
        adminEmail,
        action: 'PRODUCT_STOCK_CHANGED',
        entity: 'product',
        entityId: productId,
        previousValue: { stock: currentStock },
        newValue: { stock: newStock, costPrice: unitCost ?? prodData.costPrice },
        notes: `Stock de "${prodData.name}" incrementado en +${quantityToAdd} un. (Stock nuevo: ${newStock})`
      });
    }

  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.PRODUCTS}/${productId}`);
  }
};

export const cancelOrderAndRestoreStockInFirestore = async (
  order: Order,
  reason: string,
  adminEmail?: string
) => {
  const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);
  const now = new Date().toISOString();

  try {
    // 1. Update Order Status
    const newTimeline = [
      ...(order.timeline || []),
      {
        status: 'cancelled' as OrderStatus,
        title: 'Pedido cancelado',
        description: `Cancelado por ${adminEmail || 'administración'}. Motivo: ${reason}`,
        timestamp: new Date().toLocaleString('es-AR')
      }
    ];

    const newHistory = [
      ...(order.orderStatusHistory || []),
      {
        status: 'cancelled' as OrderStatus,
        changedBy: adminEmail || 'admin',
        timestamp: now,
        note: `Cancelación: ${reason}`
      }
    ];

    await updateDoc(orderRef, {
      status: 'cancelled',
      paymentStatus: order.paymentStatus === 'approved' ? 'refunded' : 'cancelled',
      timeline: newTimeline,
      orderStatusHistory: newHistory,
      updatedAt: now,
      serverUpdatedAt: serverTimestamp()
    });

    // 2. Restore Stock for each product in the order
    for (const item of order.items) {
      const prodRef = doc(db, COLLECTIONS.PRODUCTS, item.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const prodData = prodSnap.data() as Product;
        const currentStock = prodData.stock || 0;
        const newStock = currentStock + item.quantity;
        const minStock = prodData.minimumStock || 3;
        const newStockStatus: StockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';

        await updateDoc(prodRef, {
          stock: newStock,
          stockStatus: newStockStatus,
          lastStockUpdate: now,
          updatedAt: serverTimestamp()
        });

        // Record stock movement (CANCELLATION)
        await recordStockMovementInFirestore({
          productId: item.productId,
          productName: item.name,
          productSku: prodData.sku || '',
          type: 'CANCELLATION',
          quantity: item.quantity,
          previousStock: currentStock,
          newStock,
          reason: `Reintegro por cancelación de Pedido #${order.orderNumber}`,
          orderId: order.id,
          adminId: auth.currentUser?.uid || 'admin'
        });
      }
    }

    // 3. Audit action
    if (adminEmail) {
      await recordAdminActionInFirestore({
        adminId: auth.currentUser?.uid || 'admin',
        adminEmail,
        action: 'ORDER_STATUS_CHANGED',
        entity: 'order',
        entityId: order.id,
        previousValue: { status: order.status },
        newValue: { status: 'cancelled' },
        notes: `Pedido #${order.orderNumber} cancelado y stock reintegrado.`
      });
    }

  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ORDERS}/${order.id}`);
  }
};

export const updateOrderPreparationInFirestore = async (
  orderId: string,
  preparationStatus: 'pending' | 'in_preparation' | 'ready_for_shipping',
  allPrepared: boolean,
  items?: OrderItem[]
) => {
  const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
  try {
    const updatePayload: Record<string, any> = {
      preparationStatus,
      allPrepared,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp()
    };
    if (items && Array.isArray(items)) {
      updatePayload.items = items;
    }
    await updateDoc(orderRef, updatePayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ORDERS}/${orderId}`);
  }
};

// ==========================================
// FASE 6: LOGISTICS & SHIPPING SERVICE
// ==========================================

export const subscribeToCouriers = (callback: (couriers: Courier[]) => void) => {
  if (!auth.currentUser) {
    callback(INITIAL_COURIERS);
    return () => {};
  }
  const couriersCol = collection(db, COLLECTIONS.COURIERS);
  return onSnapshot(couriersCol, (snapshot) => {
    if (snapshot.empty) {
      callback(INITIAL_COURIERS);
    } else {
      const couriersList: Courier[] = [];
      snapshot.forEach((docSnap) => {
        couriersList.push({ id: docSnap.id, ...docSnap.data() } as Courier);
      });
      callback(couriersList);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.COURIERS);
    callback(INITIAL_COURIERS);
  });
};

export const saveCourierToFirestore = async (courier: Courier) => {
  const courierRef = doc(db, COLLECTIONS.COURIERS, courier.id);
  try {
    await setDoc(courierRef, {
      ...courier,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.COURIERS}/${courier.id}`);
  }
};

export const deleteCourierFromFirestore = async (courierId: string) => {
  const courierRef = doc(db, COLLECTIONS.COURIERS, courierId);
  try {
    await deleteDoc(courierRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.COURIERS}/${courierId}`);
  }
};

export const subscribeToLogisticsProviders = (callback: (providers: LogisticsProvider[]) => void) => {
  if (!auth.currentUser) {
    callback(INITIAL_LOGISTICS_PROVIDERS);
    return () => {};
  }
  const providersCol = collection(db, COLLECTIONS.LOGISTICS_PROVIDERS);
  return onSnapshot(providersCol, (snapshot) => {
    if (snapshot.empty) {
      callback(INITIAL_LOGISTICS_PROVIDERS);
    } else {
      const providersList: LogisticsProvider[] = [];
      snapshot.forEach((docSnap) => {
        providersList.push({ id: docSnap.id, ...docSnap.data() } as LogisticsProvider);
      });
      callback(providersList);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.LOGISTICS_PROVIDERS);
    callback(INITIAL_LOGISTICS_PROVIDERS);
  });
};

export const saveLogisticsProviderToFirestore = async (provider: LogisticsProvider) => {
  const providerRef = doc(db, COLLECTIONS.LOGISTICS_PROVIDERS, provider.id);
  try {
    await setDoc(providerRef, {
      ...provider,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.LOGISTICS_PROVIDERS}/${provider.id}`);
  }
};

export const subscribeToShippingExpenses = (callback: (expenses: ShippingExpense[]) => void) => {
  if (!auth.currentUser) {
    callback(INITIAL_SHIPPING_EXPENSES);
    return () => {};
  }
  const expensesCol = collection(db, COLLECTIONS.SHIPPING_EXPENSES);
  return onSnapshot(expensesCol, (snapshot) => {
    if (snapshot.empty) {
      callback(INITIAL_SHIPPING_EXPENSES);
    } else {
      const list: ShippingExpense[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ShippingExpense);
      });
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SHIPPING_EXPENSES);
    callback(INITIAL_SHIPPING_EXPENSES);
  });
};

export const saveShippingExpenseToFirestore = async (expense: ShippingExpense) => {
  const expenseRef = doc(db, COLLECTIONS.SHIPPING_EXPENSES, expense.id);
  try {
    await setDoc(expenseRef, {
      ...expense,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SHIPPING_EXPENSES}/${expense.id}`);
  }
};

export const updateOrderShippingInFirestore = async (
  orderId: string,
  shippingUpdates: Partial<Order>
) => {
  const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);
  try {
    await updateDoc(orderRef, {
      ...shippingUpdates,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.ORDERS}/${orderId}`);
  }
};

// ==========================================
// FASE 7: Inova Supplier Checks & Purchase Orders
// ==========================================

export const subscribeToSupplierChecks = (callback: (checks: SupplierCheck[]) => void) => {
  if (!auth.currentUser) {
    callback(INITIAL_SUPPLIER_CHECKS);
    return () => {};
  }
  const checksCol = collection(db, COLLECTIONS.SUPPLIER_CHECKS);
  return onSnapshot(checksCol, (snapshot) => {
    if (snapshot.empty) {
      callback(INITIAL_SUPPLIER_CHECKS);
    } else {
      const list: SupplierCheck[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SupplierCheck);
      });
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPLIER_CHECKS);
    callback(INITIAL_SUPPLIER_CHECKS);
  });
};

export const saveSupplierCheckToFirestore = async (check: SupplierCheck) => {
  const checkRef = doc(db, COLLECTIONS.SUPPLIER_CHECKS, check.id);
  try {
    await setDoc(checkRef, {
      ...check,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SUPPLIER_CHECKS}/${check.id}`);
  }
};

export const subscribeToPurchaseOrders = (callback: (orders: PurchaseOrder[]) => void) => {
  if (!auth.currentUser) {
    callback(INITIAL_PURCHASE_ORDERS);
    return () => {};
  }
  const poCol = collection(db, COLLECTIONS.PURCHASE_ORDERS);
  return onSnapshot(poCol, (snapshot) => {
    if (snapshot.empty) {
      callback(INITIAL_PURCHASE_ORDERS);
    } else {
      const list: PurchaseOrder[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as PurchaseOrder);
      });
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PURCHASE_ORDERS);
    callback(INITIAL_PURCHASE_ORDERS);
  });
};

export const savePurchaseOrderToFirestore = async (po: PurchaseOrder) => {
  const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, po.id);
  try {
    await setDoc(poRef, {
      ...po,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PURCHASE_ORDERS}/${po.id}`);
  }
};

export const deletePurchaseOrderFromFirestore = async (poId: string) => {
  const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, poId);
  try {
    await deleteDoc(poRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.PURCHASE_ORDERS}/${poId}`);
  }
};

export const subscribeToSupplierReturns = (callback: (returns: SupplierReturn[]) => void) => {
  if (!auth.currentUser) {
    callback(INITIAL_SUPPLIER_RETURNS);
    return () => {};
  }
  const retCol = collection(db, COLLECTIONS.SUPPLIER_RETURNS);
  return onSnapshot(retCol, (snapshot) => {
    if (snapshot.empty) {
      callback(INITIAL_SUPPLIER_RETURNS);
    } else {
      const list: SupplierReturn[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SupplierReturn);
      });
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPLIER_RETURNS);
    callback(INITIAL_SUPPLIER_RETURNS);
  });
};

export const saveSupplierReturnToFirestore = async (ret: SupplierReturn) => {
  const retRef = doc(db, COLLECTIONS.SUPPLIER_RETURNS, ret.id);
  try {
    await setDoc(retRef, {
      ...ret,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SUPPLIER_RETURNS}/${ret.id}`);
  }
};

// ============================================================================
// FASE 7.5: ASISTENTE INTELIGENTE, CONVERSACIONES & TICKETS
// ============================================================================

// 1. Assistant Conversations
export const subscribeToAssistantConversations = (
  callback: (conversations: AssistantConversation[]) => void,
  userId?: string | null,
  isAdminUser: boolean = false
) => {
  const uid = userId || auth.currentUser?.uid || null;
  const isExplicitAdmin = isAdminUser || (
    Boolean(auth.currentUser?.emailVerified) &&
    auth.currentUser?.email?.toLowerCase() === 'reartes17diego@gmail.com'
  );
  if (!auth.currentUser || (!isExplicitAdmin && !uid)) {
    callback([]);
    return () => {};
  }

  const convCol = collection(db, COLLECTIONS.ASSISTANT_CONVERSATIONS);
  const q = isExplicitAdmin ? convCol : query(convCol, where('userId', '==', uid));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
    } else {
      const list: AssistantConversation[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AssistantConversation);
      });
      list.sort((a, b) => new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime());
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.ASSISTANT_CONVERSATIONS);
    callback([]);
  });
};

export const saveAssistantConversationToFirestore = async (conversation: AssistantConversation) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const convRef = doc(db, COLLECTIONS.ASSISTANT_CONVERSATIONS, conversation.id);
  try {
    await setDoc(convRef, {
      ...conversation,
      userId: conversation.userId || uid,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.ASSISTANT_CONVERSATIONS}/${conversation.id}`);
  }
};

export const deleteAssistantConversationFromFirestore = async (convId: string) => {
  if (!auth.currentUser) return;
  const convRef = doc(db, COLLECTIONS.ASSISTANT_CONVERSATIONS, convId);
  try {
    await deleteDoc(convRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.ASSISTANT_CONVERSATIONS}/${convId}`);
  }
};

// 2. Assistant Messages
export const subscribeToAssistantMessages = (
  conversationId: string,
  callback: (messages: AssistantMessage[]) => void,
  userId?: string | null,
  isAdminUser: boolean = false
) => {
  const uid = userId || auth.currentUser?.uid || null;
  const isExplicitAdmin = isAdminUser || (
    Boolean(auth.currentUser?.emailVerified) &&
    auth.currentUser?.email?.toLowerCase() === 'reartes17diego@gmail.com'
  );
  if (!auth.currentUser || (!isExplicitAdmin && !uid)) {
    callback([]);
    return () => {};
  }

  const msgsCol = collection(db, COLLECTIONS.ASSISTANT_MESSAGES);
  const q = isExplicitAdmin
    ? query(msgsCol, where('conversationId', '==', conversationId))
    : query(msgsCol, where('conversationId', '==', conversationId), where('userId', '==', uid));

  return onSnapshot(q, (snapshot) => {
    const list: AssistantMessage[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as AssistantMessage);
    });
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    callback(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, `${COLLECTIONS.ASSISTANT_MESSAGES}?conversationId=${conversationId}`);
    callback([]);
  });
};

export const saveAssistantMessageToFirestore = async (message: AssistantMessage) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const msgRef = doc(db, COLLECTIONS.ASSISTANT_MESSAGES, message.id);
  try {
    await setDoc(msgRef, {
      ...message,
      userId: message.userId || uid,
      serverCreatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.ASSISTANT_MESSAGES}/${message.id}`);
  }
};

// 3. Support Tickets
export const subscribeToSupportTickets = (
  callback: (tickets: SupportTicket[]) => void,
  userId?: string | null,
  isAdminUser: boolean = false
) => {
  const uid = userId || auth.currentUser?.uid || null;
  const isExplicitAdmin = isAdminUser || (
    Boolean(auth.currentUser?.emailVerified) &&
    auth.currentUser?.email?.toLowerCase() === 'reartes17diego@gmail.com'
  );
  if (!auth.currentUser || (!isExplicitAdmin && !uid)) {
    callback([]);
    return () => {};
  }

  const tckCol = collection(db, COLLECTIONS.SUPPORT_TICKETS);
  const q = isExplicitAdmin ? tckCol : query(tckCol, where('userId', '==', uid));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(isExplicitAdmin ? INITIAL_SUPPORT_TICKETS : []);
    } else {
      const list: SupportTicket[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SupportTicket);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPORT_TICKETS);
    callback([]);
  });
};

export const saveSupportTicketToFirestore = async (ticket: SupportTicket) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const tckRef = doc(db, COLLECTIONS.SUPPORT_TICKETS, ticket.id);
  try {
    await setDoc(tckRef, {
      ...ticket,
      userId: ticket.userId || uid,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SUPPORT_TICKETS}/${ticket.id}`);
  }
};

// 4. FAQs Management
export const subscribeToFAQs = (callback: (faqs: FAQItem[]) => void) => {
  const faqCol = collection(db, COLLECTIONS.FAQS);
  return onSnapshot(faqCol, (snapshot) => {
    if (snapshot.empty) {
      callback(INITIAL_FAQS);
    } else {
      const list: FAQItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as FAQItem);
      });
      list.sort((a, b) => a.order - b.order);
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.FAQS);
    callback(INITIAL_FAQS);
  });
};

export const saveFAQToFirestore = async (faq: FAQItem) => {
  const faqRef = doc(db, COLLECTIONS.FAQS, faq.id);
  try {
    await setDoc(faqRef, {
      ...faq,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.FAQS}/${faq.id}`);
  }
};

export const deleteFAQFromFirestore = async (faqId: string) => {
  const faqRef = doc(db, COLLECTIONS.FAQS, faqId);
  try {
    await deleteDoc(faqRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.FAQS}/${faqId}`);
  }
};

// 5. Unresolved Queries
export const subscribeToUnresolvedQueries = (
  callback: (queries: UnresolvedQuery[]) => void,
  userId?: string | null,
  isAdminUser: boolean = false
) => {
  const uid = userId || auth.currentUser?.uid || null;
  const isExplicitAdmin = isAdminUser || (
    Boolean(auth.currentUser?.emailVerified) &&
    auth.currentUser?.email?.toLowerCase() === 'reartes17diego@gmail.com'
  );
  if (!auth.currentUser || (!isExplicitAdmin && !uid)) {
    callback([]);
    return () => {};
  }

  const unresCol = collection(db, COLLECTIONS.UNRESOLVED_QUERIES);
  const q = isExplicitAdmin ? unresCol : query(unresCol, where('userId', '==', uid));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(isExplicitAdmin ? INITIAL_UNRESOLVED_QUERIES : []);
    } else {
      const list: UnresolvedQuery[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as UnresolvedQuery);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.UNRESOLVED_QUERIES);
    callback([]);
  });
};

export const saveUnresolvedQueryToFirestore = async (queryItem: UnresolvedQuery) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const qRef = doc(db, COLLECTIONS.UNRESOLVED_QUERIES, queryItem.id);
  try {
    await setDoc(qRef, {
      ...queryItem,
      userId: queryItem.userId || uid,
      serverUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.UNRESOLVED_QUERIES}/${queryItem.id}`);
  }
};

// -------------------------------------------------------------
// 6. DAILY STOCK AUDITS
// -------------------------------------------------------------
export const subscribeToDailyStockAudits = (callback: (audits: DailyStockAudit[]) => void) => {
  const auditsCol = collection(db, COLLECTIONS.DAILY_STOCK_AUDITS);
  const q = query(auditsCol, orderBy('timestamp', 'desc'), limit(30));
  return onSnapshot(q, (snapshot) => {
    const list: DailyStockAudit[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as DailyStockAudit);
    });
    callback(list);
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.DAILY_STOCK_AUDITS);
    callback([]);
  });
};

export const saveDailyStockAuditToFirestore = async (audit: DailyStockAudit): Promise<void> => {
  const docRef = doc(db, COLLECTIONS.DAILY_STOCK_AUDITS, audit.id);
  try {
    const compactAudit = stripUndefinedForFirestore({
      ...audit,
      newProducts: (audit.newProducts || []).slice(0, 400),
      outOfStockProducts: (audit.outOfStockProducts || []).slice(0, 400),
      restockedProducts: (audit.restockedProducts || []).slice(0, 400),
      stockChanges: (audit.stockChanges || []).slice(0, 400),
      criticalStockProducts: (audit.criticalStockProducts || []).slice(0, 400),
      serverTimestamp: serverTimestamp()
    });
    await setDoc(docRef, compactAudit, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.DAILY_STOCK_AUDITS}/${audit.id}`);
  }
};

export const saveDailyStockSchedulerToFirestore = async (config: DailyStockSchedulerConfig): Promise<void> => {
  if (!auth.currentUser?.emailVerified) return;
  const docRef = doc(db, COLLECTIONS.SETTINGS, 'stockScheduler');
  try {
    const cleaned = stripUndefinedForFirestore({
      ...config,
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp()
    });
    await setDoc(docRef, cleaned, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SETTINGS}/stockScheduler`);
  }
};

export const fetchDailyStockAudits = async (limitCount = 30): Promise<DailyStockAudit[]> => {
  try {
    const auditsCol = collection(db, COLLECTIONS.DAILY_STOCK_AUDITS);
    const q = query(auditsCol, orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    const list: DailyStockAudit[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as DailyStockAudit);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.DAILY_STOCK_AUDITS);
    return [];
  }
};





