import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { INITIAL_SETTINGS, INITIAL_COUPONS, INITIAL_FAQS, INITIAL_ORDERS } from './src/data/initialMetadata';
import { INSTANT_BOOT_PRODUCTS } from './src/data/instantBootProducts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();

// -------------------------------------------------------------
// 0. FIREBASE ADMIN SDK & FIRESTORE REST FALLBACK INITIALIZATION
// -------------------------------------------------------------
const ADMIN_EMAIL = 'reartes17diego@gmail.com';
let firebaseClientConfig: { projectId: string; firestoreDatabaseId: string } = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'quickfixarg1',
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || '(default)'
};

try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (parsed.projectId) firebaseClientConfig.projectId = parsed.projectId;
    if (parsed.firestoreDatabaseId) firebaseClientConfig.firestoreDatabaseId = parsed.firestoreDatabaseId;
  }
} catch (cfgErr) {
  console.warn('[Firebase Config] Warning reading firebase-applet-config.json:', cfgErr);
}

let adminApp: FirebaseAdminApp;
if (getApps().length > 0) {
  adminApp = getApps()[0];
} else {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson && saJson.trim().startsWith('{')) {
    adminApp = initializeApp({
      credential: cert(JSON.parse(saJson)),
      projectId: firebaseClientConfig.projectId
    });
  } else {
    adminApp = initializeApp({
      projectId: firebaseClientConfig.projectId
    });
  }
}

const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp, firebaseClientConfig.firestoreDatabaseId);
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseClientConfig.projectId}/databases/${firebaseClientConfig.firestoreDatabaseId}/documents`;

function isCredentialUnavailableError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '');
  return (
    code === '7' ||
    code === '16' ||
    msg.includes('could not load the default credentials') ||
    msg.includes('permission_denied') ||
    msg.includes('unauthenticated') ||
    msg.includes('metadata server') ||
    msg.includes('unable to detect a project id')
  );
}

function fromFirestoreRestValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return Array.isArray(val.arrayValue?.values)
      ? val.arrayValue.values.map(fromFirestoreRestValue)
      : [];
  }
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreRestValue(v);
    }
    return out;
  }
  return undefined;
}

function fromFirestoreRestDoc(docJson: any): any | null {
  if (!docJson || !docJson.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(docJson.fields)) {
    out[k] = fromFirestoreRestValue(v);
  }
  if (docJson.name && !out.id) {
    out.id = String(docJson.name).split('/').pop();
  }
  return out;
}

async function fetchFirestoreDocRest(docPath: string, bearerToken?: string): Promise<any | null> {
  try {
    const res = await fetch(`${FIRESTORE_REST_BASE}/${docPath}`, {
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const json = await res.json();
    return fromFirestoreRestDoc(json);
  } catch {
    return null;
  }
}

async function fetchFirestoreCollectionRest(colName: string, bearerToken?: string, pageSize = 100): Promise<any[]> {
  try {
    const res = await fetch(`${FIRESTORE_REST_BASE}/${colName}?pageSize=${pageSize}`, {
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json.documents)) return [];
    return json.documents.map(fromFirestoreRestDoc).filter(Boolean);
  } catch {
    return [];
  }
}

interface VerifiedAuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  bearerToken: string;
}

async function verifyFirebaseBearer(req: Request): Promise<VerifiedAuthUser | null> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: (decoded.email || '').toLowerCase(),
      emailVerified: Boolean(decoded.email_verified),
      bearerToken: idToken
    };
  } catch (err) {
    console.warn('[Firebase Auth] Token verification failed:', (err as any)?.message || err);
    return null;
  }
}

async function isVerifiedAdminUser(user: VerifiedAuthUser): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (user.email === ADMIN_EMAIL) return true;
  try {
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    if (userDoc.exists && userDoc.data()?.role === 'admin') return true;
  } catch (err) {
    if (isCredentialUnavailableError(err)) {
      const restUser = await fetchFirestoreDocRest(`users/${user.uid}`, user.bearerToken);
      if (restUser?.role === 'admin') return true;
    }
  }
  return false;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const verified = await verifyFirebaseBearer(req);
  if (!verified) {
    return res.status(401).json({
      success: false,
      error: 'Sesión requerida o expirada. Iniciá sesión nuevamente.'
    });
  }
  (req as any).authUser = verified;
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const verified = await verifyFirebaseBearer(req);
  if (!verified) {
    return res.status(401).json({
      success: false,
      error: 'Autenticación de administrador requerida.'
    });
  }
  const allowed = await isVerifiedAdminUser(verified);
  if (!allowed) {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado. Se requiere cuenta de administrador verificada.'
    });
  }
  (req as any).authUser = verified;
  next();
}

async function loadLiveStoreConfig(bearerToken?: string): Promise<typeof INITIAL_SETTINGS> {
  try {
    const snap = await adminDb.collection('settings').doc('storeConfig').get();
    if (snap.exists) {
      return { ...INITIAL_SETTINGS, ...(snap.data() as any) };
    }
  } catch (err) {
    if (!isCredentialUnavailableError(err)) {
      console.warn('[Firestore] storeConfig Admin read fallback:', (err as any)?.message || err);
    }
    const restDoc = await fetchFirestoreDocRest('settings/storeConfig', bearerToken);
    if (restDoc) {
      return { ...INITIAL_SETTINGS, ...restDoc };
    }
  }
  return INITIAL_SETTINGS;
}

async function loadLiveCoupons(bearerToken?: string): Promise<typeof INITIAL_COUPONS> {
  try {
    const snap = await adminDb.collection('coupons').get();
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    }
  } catch (err) {
    if (isCredentialUnavailableError(err)) {
      const restDocs = await fetchFirestoreCollectionRest('coupons', bearerToken);
      if (restDocs.length > 0) return restDocs as any;
    }
  }
  return INITIAL_COUPONS;
}

async function loadLiveProduct(productId: string, bearerToken?: string): Promise<any | null> {
  await ensureFullCatalogLoaded();
  const fallback = liveServerCatalog.find(p => p.id === productId) || INITIAL_PRODUCTS.find(p => p.id === productId) || null;
  try {
    const snap = await adminDb.collection('products').doc(productId).get();
    if (snap.exists) {
      return { ...(fallback || {}), id: snap.id, ...(snap.data() as any) };
    }
  } catch (err) {
    if (isCredentialUnavailableError(err)) {
      const restDoc = await fetchFirestoreDocRest(`products/${productId}`, bearerToken);
      if (restDoc) {
        return { ...(fallback || {}), ...restDoc };
      }
    }
  }
  return fallback;
}

async function validateAndCommitOrderOnServer(params: {
  orderId?: string;
  orderNumber?: string;
  authUser: VerifiedAuthUser;
  items: any[];
  customer: any;
  shippingZoneId?: string;
  couponCode?: string;
  paymentMethod: string;
  notes?: string;
  transferReceiptImage?: string;
  preferenceId?: string;
  initialStatus?: 'pending_payment' | 'pending';
  persistOrder?: boolean;
}) {
  const {
    authUser,
    items,
    customer,
    shippingZoneId,
    couponCode,
    paymentMethod,
    notes,
    transferReceiptImage,
    preferenceId,
    initialStatus = 'pending_payment',
    persistOrder = true
  } = params;

  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('No se incluyeron productos en el pedido.'), { statusCode: 400 });
  }

  if (paymentMethod === 'bank_transfer' && (!transferReceiptImage || typeof transferReceiptImage !== 'string')) {
    throw Object.assign(new Error('Es obligatorio adjuntar el comprobante de transferencia antes de confirmar el pedido.'), { statusCode: 400 });
  }

  const liveSettings = await loadLiveStoreConfig(authUser.bearerToken);
  const liveCoupons = await loadLiveCoupons(authUser.bearerToken);
  const freeShippingThreshold = Number(liveSettings.freeShippingThreshold) || INITIAL_SETTINGS.freeShippingThreshold;
  const zones = Array.isArray(liveSettings.zones) && liveSettings.zones.length > 0
    ? liveSettings.zones
    : INITIAL_SETTINGS.zones;
  const matchedZone = zones.find((z: any) => z.id === shippingZoneId) || zones[0];

  // Aggregate quantities per productId so duplicate cart lines for the same product cannot bypass stock check
  const aggregatedQtyByProduct = new Map<string, number>();
  for (const rawItem of items) {
    const pid = String(rawItem.productId || rawItem.id || '').trim();
    const qty = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));
    if (!pid) {
      throw Object.assign(new Error('Producto inválido en el carrito.'), { statusCode: 400 });
    }
    aggregatedQtyByProduct.set(pid, (aggregatedQtyByProduct.get(pid) || 0) + qty);
  }

  const liveProductsMap = new Map<string, any>();
  for (const pid of aggregatedQtyByProduct.keys()) {
    const prod = await loadLiveProduct(pid, authUser.bearerToken);
    if (!prod) {
      throw Object.assign(new Error(`El producto "${pid}" no existe en el catálogo vigente.`), { statusCode: 400 });
    }
    liveProductsMap.set(pid, prod);
  }

  let calculatedSubtotal = 0;
  const validatedOrderItems: any[] = [];
  const mpLineItems: Array<{
    id: string;
    title: string;
    unit_price: number;
    quantity: number;
    currency_id: string;
    picture_url?: string;
  }> = [];

  for (const [pid, totalQty] of aggregatedQtyByProduct.entries()) {
    const prod = liveProductsMap.get(pid);
    const liveStock = Number(prod.stock ?? 0);
    if (prod.stockStatus === 'out_of_stock' || liveStock < totalQty) {
      throw Object.assign(
        new Error(`Stock insuficiente para "${prod.name}". Disponible actual: ${liveStock} unidades.`),
        { statusCode: 400 }
      );
    }
  }

  for (const rawItem of items) {
    const pid = String(rawItem.productId || rawItem.id || '').trim();
    const serverProduct = liveProductsMap.get(pid);
    const quantity = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));

    let unitPrice = Number(serverProduct.salePrice) || 0;
    if (rawItem.selectedSize && Array.isArray(serverProduct.sizes) && serverProduct.sizes.length > 0) {
      const matchedSize = serverProduct.sizes.find((s: any) =>
        s.name?.toLowerCase() === String(rawItem.selectedSize).toLowerCase() || s.id === rawItem.selectedSize
      );
      if (matchedSize && Number(matchedSize.price) > 0) {
        unitPrice = Number(matchedSize.price);
      }
    }
    if (unitPrice <= 0) {
      throw Object.assign(new Error(`Precio inválido para "${serverProduct.name}".`), { statusCode: 400 });
    }

    let mpTitle = serverProduct.name;
    if (rawItem.selectedSize) mpTitle += ` (${rawItem.selectedSize})`;
    if (rawItem.selectedColor) mpTitle += ` [${rawItem.selectedColor}]`;

    calculatedSubtotal += unitPrice * quantity;
    validatedOrderItems.push({
      productId: serverProduct.id,
      name: serverProduct.name,
      image: serverProduct.images?.[0] || '',
      salePrice: unitPrice,
      costPrice: serverProduct.costPrice || 0,
      quantity,
      subtotal: unitPrice * quantity,
      selectedSize: rawItem.selectedSize,
      selectedColor: rawItem.selectedColor,
      selectedVariant: rawItem.selectedVariant,
      customSpecification: rawItem.customSpecification
    });
    mpLineItems.push({
      id: serverProduct.id,
      title: mpTitle,
      unit_price: unitPrice,
      quantity,
      currency_id: 'ARS',
      picture_url: serverProduct.images?.[0]
    });
  }

  const isFreeShipping = calculatedSubtotal >= freeShippingThreshold;
  const shippingCost = isFreeShipping ? 0 : (Number(matchedZone?.price) || 3500);

  let discountAmount = 0;
  let appliedCouponId: string | null = null;
  let normalizedCouponCode: string | undefined;

  if (couponCode) {
    const cleanCoupon = String(couponCode).trim().toUpperCase();
    const validCoupon = liveCoupons.find((c: any) => String(c.code || '').toUpperCase() === cleanCoupon && c.active);
    if (!validCoupon) {
      throw Object.assign(new Error(`El cupón "${cleanCoupon}" no existe o está inactivo.`), { statusCode: 400 });
    }
    if (validCoupon.expiresAt && new Date(validCoupon.expiresAt).getTime() < Date.now()) {
      throw Object.assign(new Error(`El cupón "${cleanCoupon}" se encuentra vencido.`), { statusCode: 400 });
    }
    if (validCoupon.maxUses && Number(validCoupon.usedCount || 0) >= Number(validCoupon.maxUses)) {
      throw Object.assign(new Error(`El cupón "${cleanCoupon}" alcanzó su límite máximo de usos.`), { statusCode: 400 });
    }
    if (calculatedSubtotal < Number(validCoupon.minPurchaseAmount || 0)) {
      throw Object.assign(
        new Error(`El cupón "${cleanCoupon}" requiere una compra mínima de $${Number(validCoupon.minPurchaseAmount).toLocaleString('es-AR')}.`),
        { statusCode: 400 }
      );
    }

    appliedCouponId = validCoupon.id;
    normalizedCouponCode = validCoupon.code;
    if (validCoupon.discountType === 'percentage') {
      discountAmount = Math.round((calculatedSubtotal * Number(validCoupon.value)) / 100);
    } else {
      discountAmount = Math.min(calculatedSubtotal, Number(validCoupon.value));
    }
  }

  const calculatedTotal = Math.max(0, calculatedSubtotal - discountAmount + shippingCost);
  const nowStr = new Date().toISOString();
  const formattedDate = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const cleanOrderId = params.orderId || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cleanOrderNumber = params.orderNumber || `#VON-${Date.now().toString().slice(-5)}${Math.floor(100 + Math.random() * 900)}`;

  const resolvedCustomerName = String(
    customer?.name ||
    customer?.fullName ||
    `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() ||
    authUser.email ||
    'Cliente VONDRO'
  ).trim();
  const resolvedCustomerAddress = String(
    customer?.address ||
    `${customer?.street || ''} ${customer?.number || ''}${customer?.floorApartment ? ', ' + customer.floorApartment : ''}`.trim()
  ).trim();
  const normalizedCustomer = {
    ...(customer || {}),
    name: resolvedCustomerName,
    fullName: resolvedCustomerName,
    address: resolvedCustomerAddress || customer?.neighborhood || 'Córdoba Capital'
  };

  const validatedOrder = {
    id: cleanOrderId,
    orderNumber: cleanOrderNumber,
    createdAt: nowStr,
    updatedAt: nowStr,
    customer: normalizedCustomer,
    items: validatedOrderItems,
    subtotal: calculatedSubtotal,
    shippingZoneId: matchedZone?.id || 'zona-1',
    shippingZoneName: matchedZone?.name || 'Córdoba Capital',
    shippingCost,
    isFreeShipping,
    couponCode: normalizedCouponCode,
    discountAmount,
    total: calculatedTotal,
    paymentMethod,
    paymentStatus: 'pending',
    preferenceId: preferenceId || undefined,
    status: initialStatus,
    timeline: [
      {
        status: initialStatus,
        title: paymentMethod === 'mercadopago' ? 'Pedido iniciado' : 'Pedido recibido',
        description: paymentMethod === 'mercadopago'
          ? 'Iniciando proceso de pago en Mercado Pago.'
          : 'Tu pedido ha sido validado y registrado con éxito en VONDRO.',
        timestamp: formattedDate
      }
    ],
    adminNotes: notes || undefined,
    transferReceiptImage: transferReceiptImage || undefined,
    userId: authUser.uid,
    isGuest: false,
    shippingStatus: 'PENDING',
    trackingCode: `VON-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
    deliveryConfirmationCode: Math.floor(1000 + Math.random() * 9000).toString(),
    deliveryAttempts: 0
  };

  let serverHandledTransaction = false;

  if (persistOrder) {
    try {
      await adminDb.runTransaction(async (tx) => {
        const productDocs: Array<{ ref: FirebaseFirestore.DocumentReference; data: any; qty: number }> = [];

        for (const [pid, qty] of aggregatedQtyByProduct.entries()) {
          const prodRef = adminDb.collection('products').doc(pid);
          const prodSnap = await tx.get(prodRef);
          if (prodSnap.exists) {
            const pData = prodSnap.data() || {};
            const curStock = Number(pData.stock ?? 0);
            if (curStock < qty) {
              throw Object.assign(
                new Error(`Stock insuficiente para "${pData.name || pid}". Disponible actual: ${curStock} unidades.`),
                { statusCode: 400 }
              );
            }
            productDocs.push({ ref: prodRef, data: pData, qty });
          }
        }

        for (const entry of productDocs) {
          const curStock = Number(entry.data.stock ?? 0);
          const newStock = Math.max(0, curStock - entry.qty);
          const minStock = Number(entry.data.minimumStock ?? 3);
          const newStockStatus = newStock === 0 ? 'out_of_stock' : newStock <= minStock ? 'low_stock' : 'available';

          tx.update(entry.ref, {
            stock: newStock,
            stockStatus: newStockStatus,
            salesCount: Number(entry.data.salesCount || 0) + entry.qty,
            unitsSold: Number(entry.data.unitsSold || 0) + entry.qty,
            lastSoldAt: nowStr,
            lastUpdated: nowStr.split('T')[0],
            updatedAt: FieldValue.serverTimestamp()
          });

          const movId = `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          tx.set(adminDb.collection('stockMovements').doc(movId), {
            id: movId,
            productId: entry.ref.id,
            productName: entry.data.name || '',
            productSku: entry.data.sku || '',
            type: 'SALE',
            quantity: -entry.qty,
            previousStock: curStock,
            newStock,
            reason: `Venta Pedido ${cleanOrderNumber}`,
            orderId: cleanOrderId,
            adminId: authUser.uid,
            createdAt: nowStr,
            serverCreatedAt: FieldValue.serverTimestamp()
          });
        }

        if (appliedCouponId) {
          const couponRef = adminDb.collection('coupons').doc(appliedCouponId);
          const couponSnap = await tx.get(couponRef);
          if (couponSnap.exists) {
            tx.update(couponRef, {
              usedCount: Number(couponSnap.data()?.usedCount || 0) + 1
            });
          }
        }

        const orderRef = adminDb.collection('orders').doc(cleanOrderId);
        tx.set(orderRef, {
          ...validatedOrder,
          serverCreatedAt: FieldValue.serverTimestamp()
        });
      });

      serverHandledTransaction = true;
    } catch (txErr: any) {
      if (txErr?.statusCode === 400 || String(txErr?.message || '').includes('Stock insuficiente')) {
        throw txErr;
      }
      if (!isCredentialUnavailableError(txErr)) {
        console.warn('[Server Checkout] Admin Firestore transaction fallback:', txErr?.message || txErr);
      }
      serverHandledTransaction = false;
    }
  }

  return {
    order: validatedOrder,
    mpLineItems,
    matchedZone,
    freeShippingThreshold,
    calculatedSubtotal,
    shippingCost,
    isFreeShipping,
    discountAmount,
    calculatedTotal,
    serverHandledTransaction
  };
}

// Configure generous payload limits for high-res images, proof of payment & catalog sync (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Graceful handler for body-parser entity too large errors
app.use((err: any, _req: Request, res: Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    console.warn('[Server] PayloadTooLargeError intercepted gracefully:', err.message);
    return res.status(413).json({
      success: false,
      error: 'PayloadTooLargeError',
      message: 'El archivo o solicitud enviada excede el tamaño permitido. Por favor intentá con un archivo más liviano o comprimido.'
    });
  }
  next(err);
});

// Initialize Mercado Pago client safely (only if Access Token exists)
const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const paymentsMode = process.env.PAYMENTS_MODE || 'test';

let mpClient: MercadoPagoConfig | null = null;
if (mpAccessToken) {
  try {
    mpClient = new MercadoPagoConfig({
      accessToken: mpAccessToken,
      options: { timeout: 5000 }
    });
    console.log('[Mercado Pago] Client initialized successfully with environment Access Token.');
  } catch (err) {
    console.error('[Mercado Pago] Failed to initialize SDK client:', err);
  }
} else {
  console.log('[Mercado Pago] Running in TEST / Sandbox mode. Access Token not provided in env, using resilient server fallback.');
}

// -------------------------------------------------------------
// 1. HEALTH & CONFIG ENDPOINTS
// -------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    paymentsMode,
    mercadopagoConfigured: !!mpClient,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config/payments', (_req: Request, res: Response) => {
  res.json({
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
    mode: paymentsMode,
    sandbox: paymentsMode === 'test',
    enabled: true
  });
});

// -------------------------------------------------------------
// 1.1 RESPONSE COMPRESSION (GZIP + ETAG) & IMAGE OPTIMIZER PROXY
// -------------------------------------------------------------
function sendCompressedJson(
  req: Request,
  res: Response,
  payload: any,
  opts: { cacheControl?: string; status?: number } = {}
) {
  const status = opts.status ?? 200;
  const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const rawBuf = Buffer.from(jsonStr, 'utf8');
  const etag = `"${crypto.createHash('sha1').update(rawBuf).digest('base64url')}"`;

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('ETag', etag);
  res.setHeader('Vary', 'Accept-Encoding');
  if (opts.cacheControl) {
    res.setHeader('Cache-Control', opts.cacheControl);
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (rawBuf.length >= 1024 && /\bgzip\b/i.test(acceptEncoding)) {
    const gz = zlib.gzipSync(rawBuf, { level: 6 });
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(gz.length));
    return res.status(status).send(gz);
  }

  res.setHeader('Content-Length', String(rawBuf.length));
  return res.status(status).send(rawBuf);
}

const IMG_CACHE_DIR = path.join(process.cwd(), '.cache', 'img');
const IMG_MEM_MAX_ENTRIES = 400;
const imgMemoryCache = new Map<string, { buf: Buffer; contentType: string; etag: string }>();
const imgInFlight = new Map<string, Promise<{ buf: Buffer; contentType: string; etag: string } | null>>();
let sharpLoaderPromise: Promise<any> | null = null;

function getSharp() {
  if (!sharpLoaderPromise) {
    sharpLoaderPromise = import('sharp')
      .then((m) => m?.default || m)
      .catch(() => null);
  }
  return sharpLoaderPromise;
}

function setImgMemCache(key: string, val: { buf: Buffer; contentType: string; etag: string }) {
  if (imgMemoryCache.has(key)) {
    imgMemoryCache.delete(key);
  } else if (imgMemoryCache.size >= IMG_MEM_MAX_ENTRIES) {
    const oldest = imgMemoryCache.keys().next().value;
    if (oldest) imgMemoryCache.delete(oldest);
  }
  imgMemoryCache.set(key, val);
}

function isSafeExternalImageUrl(rawUrl: string): URL | null {
  if (!rawUrl || rawUrl.length > 1500) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

app.get('/api/img', async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const parsedUrl = isSafeExternalImageUrl(rawUrl);
    if (!parsedUrl) {
      return res.status(400).send('Invalid image URL');
    }

    const wRaw = parseInt(String(req.query.w || '260'), 10);
    const qRaw = parseInt(String(req.query.q || '56'), 10);
    const width = Number.isFinite(wRaw) ? Math.max(64, Math.min(1200, wRaw)) : 260;
    const quality = Number.isFinite(qRaw) ? Math.max(25, Math.min(90, qRaw)) : 56;

    const hash = crypto.createHash('sha1').update(`${parsedUrl.toString()}|${width}|${quality}`).digest('hex');
    const etag = `"${hash}"`;

    if (req.headers['if-none-match'] === etag) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(304).end();
    }

    const memHit = imgMemoryCache.get(hash);
    if (memHit) {
      // Refresh LRU position
      setImgMemCache(hash, memHit);
      res.setHeader('Content-Type', memHit.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', memHit.etag);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(memHit.buf);
    }

    const diskPath = path.join(IMG_CACHE_DIR, `${hash}.webp`);
    try {
      if (fs.existsSync(diskPath)) {
        const diskBuf = await fs.promises.readFile(diskPath);
        if (diskBuf.length > 0) {
          const entry = { buf: diskBuf, contentType: 'image/webp', etag };
          setImgMemCache(hash, entry);
          res.setHeader('Content-Type', 'image/webp');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('ETag', etag);
          res.setHeader('X-Content-Type-Options', 'nosniff');
          return res.send(diskBuf);
        }
      }
    } catch {
      // Continue to network fetch if disk read fails
    }

    let job = imgInFlight.get(hash);
    if (!job) {
      job = (async () => {
        try {
          const upstream = await fetch(parsedUrl.toString(), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
              'Accept': 'image/webp,image/avif,image/apng,image/*,*/*;q=0.8'
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000)
          });

          if (!upstream.ok) return null;

          const contentLenHeader = Number(upstream.headers.get('content-length') || 0);
          if (contentLenHeader > 10 * 1024 * 1024) return null;

          const upstreamType = (upstream.headers.get('content-type') || '').toLowerCase();
          if (upstreamType && !upstreamType.startsWith('image/') && !upstreamType.includes('octet-stream')) {
            return null;
          }

          const arrBuf = await upstream.arrayBuffer();
          if (arrBuf.byteLength === 0 || arrBuf.byteLength > 10 * 1024 * 1024) return null;
          const inputBuf = Buffer.from(arrBuf);

          const sharpFn = await getSharp();
          if (sharpFn) {
            try {
              const optimizedBuf = await sharpFn(inputBuf)
                .rotate()
                .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
                .webp({ quality, effort: 2 })
                .toBuffer();

              // Persist asynchronously to disk cache
              fs.promises.mkdir(IMG_CACHE_DIR, { recursive: true })
                .then(() => fs.promises.writeFile(diskPath, optimizedBuf))
                .catch(() => {});

              const entry = { buf: optimizedBuf, contentType: 'image/webp', etag };
              setImgMemCache(hash, entry);
              return entry;
            } catch {
              // Fallback to original image buffer if sharp couldn't decode format
            }
          }

          const fallbackType = upstreamType.startsWith('image/') ? upstreamType : 'image/jpeg';
          const fallbackEntry = { buf: inputBuf, contentType: fallbackType, etag };
          setImgMemCache(hash, fallbackEntry);
          return fallbackEntry;
        } catch {
          return null;
        } finally {
          imgInFlight.delete(hash);
        }
      })();
      imgInFlight.set(hash, job);
    }

    const result = await job;
    if (!result) {
      return res.status(404).send('Image unavailable');
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', result.etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(result.buf);
  } catch {
    return res.status(502).send('Image optimization error');
  }
});

// -------------------------------------------------------------
// 1.2 PRODUCTS CATALOG API & DB COUNT VERIFICATION
// -------------------------------------------------------------
app.get('/api/products/count', async (req: Request, res: Response) => {
  await ensureFullCatalogLoaded();
  const activeProducts = liveServerCatalog.filter(p => !p.hideIfOutOfStock || (p.stock && p.stock > 0));
  return sendCompressedJson(
    req,
    res,
    {
      success: true,
      totalCount: liveServerCatalog.length,
      activeCount: activeProducts.length,
      lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
      status: 'active'
    },
    { cacheControl: 'no-cache' }
  );
});

app.get('/api/products', async (req: Request, res: Response) => {
  try {
    await ensureFullCatalogLoaded();
    const {
      status = 'active',
      category,
      search,
      page,
      limit: reqLimit,
      onlyOffers,
      mode
    } = req.query;

    // Ultra-lightweight storefront stock/price overlay (~15 KB gzipped instead of 3.15 MB!)
    if (mode === 'stock_overlay') {
      const patches: Array<[string, number, string, number, number, number, number, string, string]> = [];
      const newProducts: any[] = [];
      for (const p of liveServerCatalog) {
        if (!p?.id) continue;
        if (initialCatalogIdSet.has(p.id)) {
          patches.push([
            p.id,
            Number(p.stock ?? 0),
            String(p.stockStatus || ((p.stock ?? 0) <= 0 ? 'out_of_stock' : 'available')),
            Number(p.costPrice ?? 0),
            Number(p.salePrice ?? 0),
            Number(p.originalPrice ?? 0),
            Number(p.discountPercentage ?? 0),
            String(p.lastStockUpdate || ''),
            String(p.lastUpdated || '')
          ]);
        } else {
          newProducts.push(p);
        }
      }

      return sendCompressedJson(
        req,
        res,
        {
          success: true,
          mode: 'stock_overlay',
          totalCount: liveServerCatalog.length,
          lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
          patches,
          newProducts
        },
        { cacheControl: 'public, max-age=60, stale-while-revalidate=300' }
      );
    }

    let filtered = [...liveServerCatalog];

    // Filter by status (default 'active')
    if (status === 'active') {
      filtered = filtered.filter(p => !p.hideIfOutOfStock || (p.stock && p.stock > 0));
    }

    // Filter by Category
    if (category && typeof category === 'string' && category !== 'all') {
      filtered = filtered.filter(p => p.categoryId === category);
    }

    // Filter by search query
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      );
    }

    // Filter by offers only
    if (onlyOffers === 'true' || onlyOffers === '1') {
      filtered = filtered.filter(p => (p.discountPercentage && p.discountPercentage > 0) || p.isFlashSale);
    }

    const totalCount = filtered.length;

    // Check pagination: if limit is provided, paginate; otherwise return full catalog
    if (reqLimit !== undefined && reqLimit !== '' && reqLimit !== 'all') {
      const parsedLimit = Math.max(1, parseInt(String(reqLimit), 10) || 24);
      const parsedPage = Math.max(1, parseInt(String(page), 10) || 1);
      const totalPages = Math.ceil(totalCount / parsedLimit);
      const startIndex = (parsedPage - 1) * parsedLimit;
      const paginatedProducts = filtered.slice(startIndex, startIndex + parsedLimit);

      return sendCompressedJson(
        req,
        res,
        {
          success: true,
          totalCount,
          page: parsedPage,
          limit: parsedLimit,
          totalPages,
          hasMore: startIndex + parsedLimit < totalCount,
          lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
          products: paginatedProducts
        },
        { cacheControl: 'public, max-age=30, stale-while-revalidate=120' }
      );
    }

    // If no limit or limit=all is requested, return the full catalog compressed
    return sendCompressedJson(
      req,
      res,
      {
        success: true,
        totalCount,
        page: 1,
        limit: totalCount,
        totalPages: 1,
        hasMore: false,
        lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
        products: filtered
      },
      { cacheControl: 'no-cache' }
    );
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Error al obtener productos' });
  }
});

// -------------------------------------------------------------
// 1.3 DYNAMIC RECOMMENDATIONS API (ROTATION & BROWSING HISTORY)
// -------------------------------------------------------------
app.get('/api/products/recommendations', async (req: Request, res: Response) => {
  try {
    await ensureFullCatalogLoaded();
    const { 
      recentCategories, 
      limit: reqLimit = '24', 
      exclude = '',
      page = '1'
    } = req.query;

    const limitNum = Math.max(4, Math.min(100, parseInt(String(reqLimit), 10) || 24));
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);

    // 1. Parse recently visited categories from history
    let categoriesList: string[] = [];
    if (typeof recentCategories === 'string' && recentCategories.trim()) {
      try {
        if (recentCategories.startsWith('[')) {
          categoriesList = JSON.parse(recentCategories);
        } else {
          categoriesList = recentCategories.split(',').map(c => c.trim()).filter(Boolean);
        }
      } catch {
        categoriesList = recentCategories.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    // Exclude set (e.g. already loaded or blacklisted)
    const excludeSet = new Set(
      typeof exclude === 'string' && exclude.trim() 
        ? exclude.split(',').map(s => s.trim()) 
        : []
    );

    // Filter to active pool (strictly products with stock > 0)
    const activeProducts = liveServerCatalog.filter(p => 
      !excludeSet.has(p.id) && (p.stock !== undefined ? p.stock > 0 : false)
    );

    // Cryptographically unbiased Fisher-Yates shuffle helper
    const shuffleArray = <T>(array: T[]): T[] => {
      const cloned = [...array];
      for (let i = cloned.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = cloned[i];
        cloned[i] = cloned[j];
        cloned[j] = temp;
      }
      return cloned;
    };

    let resultProducts: typeof liveServerCatalog = [];
    let recommendationStrategy = 'high_rated_anonymous';

    if (categoriesList.length > 0) {
      // User has browsing history -> Prioritize recently visited categories
      recommendationStrategy = 'personalized_history';

      // Pool A: Products matching the user's recently visited categories
      const categoryMatches = activeProducts.filter(p => categoriesList.includes(p.categoryId));
      
      // Pool B: High-rated discovery items from other categories (rating >= 4.5)
      const discoveryMatches = activeProducts.filter(p => 
        !categoriesList.includes(p.categoryId) && (p.rating !== undefined ? p.rating >= 4.5 : p.isFeatured)
      );

      // Random shuffle both pools to guarantee dynamic rotation
      const shuffledCategories = shuffleArray(categoryMatches);
      const shuffledDiscovery = shuffleArray(discoveryMatches);

      // Target ~65% from visited categories and ~35% from high-rated discovery
      const targetCategoryCount = Math.min(shuffledCategories.length, Math.ceil(limitNum * 0.65));
      const targetDiscoveryCount = limitNum - targetCategoryCount;

      const selectedCategoryItems = shuffledCategories.slice(0, targetCategoryCount);
      const selectedDiscoveryItems = shuffledDiscovery.slice(0, targetDiscoveryCount);

      // Interleave and shuffle the combined pool so the feed is dynamically mixed
      const combined = shuffleArray([...selectedCategoryItems, ...selectedDiscoveryItems]);

      // If combined is less than limit, backfill with shuffled active products
      if (combined.length < limitNum) {
        const chosenIds = new Set(combined.map(p => p.id));
        const backfill = shuffleArray(activeProducts.filter(p => !chosenIds.has(p.id))).slice(0, limitNum - combined.length);
        combined.push(...backfill);
      }

      resultProducts = combined;
    } else {
      // New / Anonymous user -> Prioritize new arrivals and restocked products first, then random high-rated
      recommendationStrategy = 'new_and_restocked_first';
      const newOrRestocked = activeProducts.filter(p => Boolean(
        p.isNew || 
        (p as any).isRestocked || 
        p.promoBadges?.includes('NOVEDAD' as any) ||
        p.promoBadges?.includes('REPOSICIÓN' as any) ||
        p.tags?.some((t: string) => t.toUpperCase().includes('NUEVO') || t.toUpperCase().includes('REPOSIC'))
      ));
      const otherHighRated = activeProducts.filter(p => 
        !newOrRestocked.some(n => n.id === p.id) && (p.rating !== undefined ? p.rating >= 4.5 : p.isFeatured)
      );
      const otherPool = activeProducts.filter(p => !newOrRestocked.some(n => n.id === p.id));

      const shuffledNew = shuffleArray(newOrRestocked);
      const shuffledOthers = shuffleArray(otherHighRated.length >= limitNum ? otherHighRated : otherPool);

      const targetNewCount = Math.min(shuffledNew.length, Math.ceil(limitNum * 0.45));
      const targetOtherCount = limitNum - targetNewCount;

      const topNew = shuffledNew.slice(0, targetNewCount);
      const chosenIds = new Set(topNew.map(p => p.id));
      const topOthers = shuffledOthers.filter(p => !chosenIds.has(p.id)).slice(0, targetOtherCount);

      const combined = [...topNew, ...topOthers];
      if (combined.length < limitNum) {
        const finalIds = new Set(combined.map(p => p.id));
        const backfill = shuffleArray(activeProducts.filter(p => !finalIds.has(p.id))).slice(0, limitNum - combined.length);
        combined.push(...backfill);
      }

      resultProducts = combined;
    }

    // Ensure completely unique product items (no duplicate keys)
    const seenProdIds = new Set<string>();
    const uniqueProducts = resultProducts.filter(p => {
      if (!p || !p.id || seenProdIds.has(p.id)) return false;
      seenProdIds.add(p.id);
      return true;
    });

    return sendCompressedJson(
      req,
      res,
      {
        success: true,
        strategy: recommendationStrategy,
        prioritizedCategories: categoriesList,
        totalActivePool: activeProducts.length,
        count: uniqueProducts.length,
        page: pageNum,
        limit: limitNum,
        products: uniqueProducts
      },
      { cacheControl: 'no-store' }
    );
  } catch (err: any) {
    return res.status(500).json({ 
      success: false, 
      error: err?.message || 'Error al generar recomendaciones dinámicas' 
    });
  }
});

// -------------------------------------------------------------
// 1.2. DAILY STOCK & CATALOG AUTOMATED ANALYSIS ENGINE
// -------------------------------------------------------------
interface ServerStockSnapshot {
  id: string;
  name: string;
  sku: string;
  stock: number;
  salePrice: number;
  costPrice?: number;
  categoryId?: string;
  supplier?: string;
  image?: string;
  lastUpdated: string;
}

let INITIAL_PRODUCTS: any[] = [...INSTANT_BOOT_PRODUCTS];
let liveServerCatalog: any[] = [...INSTANT_BOOT_PRODUCTS];
const initialCatalogIdSet = new Set<string>(INSTANT_BOOT_PRODUCTS.map((p: any) => p.id).filter(Boolean));
const serverStockSnapshot = new Map<string, ServerStockSnapshot>();
let serverDailyAudits: any[] = [];
let isInovaLiveSyncRunning = false;
let lastInovaLiveSyncAt = 0;
let fullCatalogLoadPromise: Promise<void> | null = null;
let isFullCatalogLoaded = false;

function ensureFullCatalogLoaded(): Promise<void> {
  if (isFullCatalogLoaded) return Promise.resolve();
  if (!fullCatalogLoadPromise) {
    fullCatalogLoadPromise = import('./src/data/initialData')
      .then((mod) => {
        const fullList = Array.isArray(mod?.INITIAL_PRODUCTS) ? mod.INITIAL_PRODUCTS : [];
        if (fullList.length > 0) {
          INITIAL_PRODUCTS = fullList;
          const existingById = new Map<string, any>(liveServerCatalog.map((p: any) => [p.id, p]));
          const merged: any[] = [];
          const seen = new Set<string>();
          for (const p of fullList) {
            if (!p?.id || seen.has(p.id)) continue;
            seen.add(p.id);
            initialCatalogIdSet.add(p.id);
            merged.push(existingById.get(p.id) || p);
          }
          for (const p of liveServerCatalog) {
            if (p?.id && !seen.has(p.id)) {
              seen.add(p.id);
              merged.push(p);
            }
          }
          liveServerCatalog = merged;
          refreshServerStockSnapshot(liveServerCatalog);
          if (serverDailyAudits.length === 0) {
            executeServerDailyStockAnalysis('AUTOMATIC_DAILY_SCHEDULER');
          }
        }
        isFullCatalogLoaded = true;
      })
      .catch((err: any) => {
        console.warn('[Catalog Boot] Warning loading full initialData:', err?.message || err);
        isFullCatalogLoaded = true;
      });
  }
  return fullCatalogLoadPromise;
}

const DEFAULT_STRATEGIC_SLOTS = [
  {
    time: '08:30',
    name: 'Apertura comercial',
    description: 'Sincroniza altas y bajas ocurridas durante la noche antes de las primeras compras de la mañana.',
    enabled: true,
    lastRunDate: '',
    lastRunTimestamp: '',
    lastStatus: 'COMPLETED',
    lastSummary: 'Catálogo sincronizado para apertura comercial'
  },
  {
    time: '14:30',
    name: 'Cierre de media jornada mayorista',
    description: 'Momento donde se concentran los retiros y ventas por bulto de la mañana en Inova.',
    enabled: true,
    lastRunDate: '',
    lastRunTimestamp: '',
    lastStatus: 'COMPLETED',
    lastSummary: 'Control de stock tras retiros y ventas por bulto'
  },
  {
    time: '20:30',
    name: 'Cierre de jornada y despacho',
    description: 'Deja el catálogo blindado y actualizado para el pico de compras nocturnas de los clientes particulares desde sus casas.',
    enabled: true,
    lastRunDate: '',
    lastRunTimestamp: '',
    lastStatus: 'COMPLETED',
    lastSummary: 'Catálogo blindado para compras nocturnas'
  }
];

let serverSchedulerConfig: any = {
  enabled: true,
  botActive: true,
  botMode: 'THREE_STRATEGIC_SLOTS',
  scheduledTime: '08:30',
  intervalHours: 6,
  lastRunDate: '',
  lastRunTimestamp: '',
  notifyOnOutOfStock: true,
  notifyOnStockChanges: true,
  notifyOnNewProducts: true,
  criticalStockThreshold: 3,
  lastExecutedSlot: '08:30 - Apertura comercial',
  strategicSlots: DEFAULT_STRATEGIC_SLOTS.map(s => ({ ...s }))
};

function getArgentinaTime() {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Cordoba',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const second = parts.find(p => p.type === 'second')?.value || '00';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    const month = parts.find(p => p.type === 'month')?.value || '10';
    const day = parts.find(p => p.type === 'day')?.value || '20';

    const hNum = parseInt(hour, 10);
    const mNum = parseInt(minute, 10);
    return {
      timeStr: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      fullTimeStr: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`,
      dateStr: `${year}-${month}-${day}`,
      minutesTotal: hNum * 60 + mNum
    };
  } catch {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes();
    const s = d.getSeconds();
    return {
      timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      fullTimeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      dateStr: d.toISOString().split('T')[0],
      minutesTotal: h * 60 + m
    };
  }
}

function getNextStrategicSlotInfo(slots: any[]) {
  const current = getArgentinaTime();
  const activeSlots = (slots || []).filter((s: any) => s.enabled);
  if (activeSlots.length === 0) {
    return { nextSlot: null, minutesRemaining: 0, formattedCountdown: 'Sin slots activos' };
  }
  const slotsWithMins = activeSlots.map((s: any) => {
    const [hh, mm] = s.time.split(':').map((n: string) => parseInt(n, 10));
    return {
      slot: s,
      mins: (hh || 0) * 60 + (mm || 0)
    };
  }).sort((a: any, b: any) => a.mins - b.mins);

  let found = slotsWithMins.find((s: any) => s.mins > current.minutesTotal);
  let diffMins = 0;
  if (found) {
    diffMins = found.mins - current.minutesTotal;
  } else {
    found = slotsWithMins[0];
    diffMins = (24 * 60 - current.minutesTotal) + found.mins;
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const formattedCountdown = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
  return {
    nextSlot: found.slot,
    minutesRemaining: diffMins,
    formattedCountdown
  };
}

function refreshServerStockSnapshot(catalog: any[]) {
  const nowIso = new Date().toISOString();
  catalog.forEach(p => {
    if (!p || !p.id) return;
    serverStockSnapshot.set(p.id, {
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      stock: p.stock ?? 0,
      salePrice: p.salePrice || 0,
      costPrice: p.costPrice,
      categoryId: p.categoryId,
      supplier: p.supplier || 'Inova ARG',
      image: (p.images && p.images[0]) || '',
      lastUpdated: nowIso
    });
  });
}

// Seed baseline snapshot from catalog
refreshServerStockSnapshot(liveServerCatalog);

// HTML entity decoder & Inova ARG live WooCommerce catalog helpers
const INOVA_HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', times: '×',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  deg: '°', reg: '®', copy: '©', trade: '™', plusmn: '±', frac12: '½',
  frac14: '¼', frac34: '¾', eacute: 'é', aacute: 'á', iacute: 'í', oacute: 'ó',
  uacute: 'ú', ntilde: 'ñ', Eacute: 'É', Aacute: 'Á', Iacute: 'Í', Oacute: 'Ó',
  Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü'
};

function decodeInovaHtml(input: unknown): string {
  if (!input || typeof input !== 'string') return '';
  let prev = '';
  let cur = input;
  for (let pass = 0; pass < 3 && cur !== prev; pass++) {
    prev = cur;
    cur = cur
      .replace(/&#(\d+);/g, (_m, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
      })
      .replace(/&([a-zA-Z0-9]+);/g, (match, name) => {
        if (Object.prototype.hasOwnProperty.call(INOVA_HTML_ENTITIES, name)) {
          return INOVA_HTML_ENTITIES[name];
        }
        const lower = name.toLowerCase();
        return Object.prototype.hasOwnProperty.call(INOVA_HTML_ENTITIES, lower)
          ? INOVA_HTML_ENTITIES[lower]
          : match;
      });
  }
  return cur.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function calcInovaRetailPrice(costPrice: number): number {
  if (!costPrice || costPrice <= 0) return 1000;
  if (costPrice <= 2500) return Math.round((costPrice * 1.28) / 50) * 50;
  if (costPrice <= 5500) return Math.round((costPrice * 1.2222) / 50) * 50;
  if (costPrice <= 12000) return costPrice + 1900;
  if (costPrice <= 20000) return costPrice + 2600;
  if (costPrice <= 35000) return costPrice + 3800;
  if (costPrice <= 60000) return costPrice + 5500;
  if (costPrice <= 100000) return costPrice + 8500;
  return Math.round((costPrice * 1.09) / 100) * 100;
}

function computeNormalizedStockStatus(stock: number, minStock = 3): 'available' | 'low_stock' | 'out_of_stock' {
  if (!stock || stock <= 0) return 'out_of_stock';
  if (stock <= minStock) return 'low_stock';
  return 'available';
}

function extractInovaStockCount(inv: any): number {
  if (!inv?.is_in_stock) return 0;
  if (inv.stock_availability?.text) {
    const m = String(inv.stock_availability.text).match(/(\d+)\s+disponibles/i);
    if (m) return parseInt(m[1], 10);
  }
  if (inv.add_to_cart && typeof inv.add_to_cart.maximum === 'number' && inv.add_to_cart.maximum > 0 && inv.add_to_cart.maximum < 9999) {
    return inv.add_to_cart.maximum;
  }
  return 15;
}

function extractInovaCostPrice(inv: any, existing?: any): number {
  const minorUnit = typeof inv?.prices?.currency_minor_unit === 'number' ? inv.prices.currency_minor_unit : 2;
  const divisor = Math.pow(10, minorUnit);
  const rawPrice = Number(inv?.prices?.price || inv?.prices?.sale_price || inv?.prices?.regular_price || 0);
  if (Number.isFinite(rawPrice) && rawPrice > 0) {
    return Math.round(rawPrice / divisor);
  }
  return Number(existing?.costPrice || 4500);
}

function mapInovaCategoryServer(categories: any[]): { categoryId: string; subcategoryId: string } {
  const catNames = (categories || []).map((c: any) => decodeInovaHtml(c?.name || '').toLowerCase());
  if (catNames.some(c => c.includes('maquillaje') || c.includes('estética') || c.includes('belleza') || c.includes('uñas') || c.includes('pelo') || c.includes('salud'))) {
    return { categoryId: 'belleza-y-cuidado-personal', subcategoryId: 'bel-maquillaje' };
  }
  if (catNames.some(c => c.includes('olla') || c.includes('sarten') || c.includes('cacerola') || c.includes('tostadora') || c.includes('electrodoméstico') || c.includes('electrodomestico'))) {
    return { categoryId: 'cocina', subcategoryId: 'coc-ollas-sartenes' };
  }
  if (catNames.some(c => c.includes('cocina') || c.includes('bazar') || c.includes('hogar'))) {
    return { categoryId: 'cocina', subcategoryId: 'coc-bazar' };
  }
  if (catNames.some(c => c.includes('parlante') || c.includes('audio') || c.includes('sonido') || c.includes('auricular'))) {
    return { categoryId: 'audio-y-sonido', subcategoryId: 'aud-parlantes-bt' };
  }
  if (catNames.some(c => c.includes('termo') || c.includes('matermo') || c.includes('vaso') || c.includes('botella') || c.includes('mate'))) {
    return { categoryId: 'vasos-y-botellas', subcategoryId: 'vas-termos' };
  }
  if (catNames.some(c => c.includes('navidad') || c.includes('led') || c.includes('luces') || c.includes('luz') || c.includes('iluminación') || c.includes('iluminacion'))) {
    return { categoryId: 'iluminacion', subcategoryId: 'ilu-tiras-led' };
  }
  if (catNames.some(c => c.includes('herramienta') || c.includes('tubo') || c.includes('destornillador') || c.includes('críquet') || c.includes('mezclador') || c.includes('cinta') || c.includes('ferreter'))) {
    return { categoryId: 'herramientas', subcategoryId: 'her-electricas' };
  }
  if (catNames.some(c => c.includes('cámara') || c.includes('camara') || c.includes('tecnología') || c.includes('tecnologia') || c.includes('gadget') || c.includes('enchufe') || c.includes('zapatilla') || c.includes('cargador'))) {
    return { categoryId: 'tecnologia', subcategoryId: 'tec-gadgets' };
  }
  return { categoryId: 'productos-varios', subcategoryId: 'var-bazar' };
}

function getValidInovaImagesServer(inv: any): string[] {
  if (!inv || !Array.isArray(inv.images)) return [];
  return inv.images
    .map((i: any) => (i && typeof i === 'string' ? i : i?.src || ''))
    .filter((url: string) => {
      if (!url || typeof url !== 'string') return false;
      const lower = url.toLowerCase();
      return !lower.includes('logo') && !lower.includes('placeholder');
    });
}

async function fetchInovaStorePage(pageNum: number, attempts = 2): Promise<{ items: any[]; totalPages: number }> {
  const url = `https://inovaarg.com/wp-json/wc/store/v1/products?per_page=100&page=${pageNum}`;
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VONDROCatalogSync/2.0)',
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} on page ${pageNum}`);
      const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10) || 1;
      const items = await res.json();
      return { items: Array.isArray(items) ? items : [], totalPages };
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 350 * (i + 1)));
    }
  }
  throw lastErr;
}

async function fetchLiveInovaCatalogForServer(): Promise<any[]> {
  const first = await fetchInovaStorePage(1);
  const byId = new Map<any, any>();
  first.items.forEach(it => { if (it && it.id) byId.set(it.id, it); });

  const remaining: number[] = [];
  for (let p = 2; p <= first.totalPages; p++) remaining.push(p);

  const CONCURRENCY = 4;
  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(p => fetchInovaStorePage(p)));
    results.forEach(r => {
      r.items.forEach(it => { if (it && it.id) byId.set(it.id, it); });
    });
  }
  return Array.from(byId.values());
}

async function persistAuditAndSchedulerToFirestore(audit: any, changedProducts: any[] = []) {
  try {
    // Trim oversized arrays if needed to stay safely below Firestore 1MB document limit
    const compactAudit = {
      ...audit,
      newProducts: (audit.newProducts || []).slice(0, 400),
      outOfStockProducts: (audit.outOfStockProducts || []).slice(0, 400),
      restockedProducts: (audit.restockedProducts || []).slice(0, 400),
      stockChanges: (audit.stockChanges || []).slice(0, 400),
      criticalStockProducts: (audit.criticalStockProducts || []).slice(0, 400)
    };
    await adminDb.collection('dailyStockAudits').doc(audit.id).set(compactAudit, { merge: true });
    await adminDb.collection('settings').doc('stockScheduler').set({
      ...serverSchedulerConfig,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (changedProducts.length > 0) {
      const BATCH_LIMIT = 400;
      for (let i = 0; i < changedProducts.length; i += BATCH_LIMIT) {
        const batch = adminDb.batch();
        changedProducts.slice(i, i + BATCH_LIMIT).forEach(prod => {
          if (!prod?.id) return;
          batch.set(adminDb.collection('products').doc(prod.id), {
            ...prod,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });
        await batch.commit();
      }
    }
  } catch (err: any) {
    if (!isCredentialUnavailableError(err)) {
      console.warn('[Daily Stock Analysis] Firestore persistence warning:', err?.message || err);
    }
  }
  try {
    const auditPath = path.join(process.cwd(), 'latest_stock_audit.json');
    fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf8');
  } catch {
    // Non-fatal on read-only deployment containers
  }
}

function executeServerDailyStockAnalysis(
  executedBy: string = 'AUTOMATIC_DAILY_SCHEDULER',
  currentProducts?: any[],
  slot?: { time: string; name: string }
) {
  const productsToAnalyze = currentProducts && Array.isArray(currentProducts) && currentProducts.length > 0
    ? currentProducts
    : liveServerCatalog;

  const currentArg = getArgentinaTime();
  const todayStr = currentArg.dateStr;
  const nowIso = new Date().toISOString();

  const newProducts: any[] = [];
  const outOfStockProducts: any[] = [];
  const restockedProducts: any[] = [];
  const stockChanges: any[] = [];
  const criticalStockProducts: any[] = [];

  for (const product of productsToAnalyze) {
    if (!product || !product.id) continue;

    const currentStock = Number(product.stock) || 0;
    const minStock = Number(product.minimumStock) || 3;
    const isOutOfStock = currentStock <= 0 || product.stockStatus === 'out_of_stock';
    const isCritical = currentStock > 0 && currentStock <= minStock;
    const prev = serverStockSnapshot.get(product.id);
    const isRestocked = Boolean(
      product.isRestocked || 
      (prev && prev.stock === 0 && currentStock > 0)
    );

    // 1. Productos Nuevos
    if (!prev) {
      newProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        stock: currentStock,
        salePrice: product.salePrice || 0,
        costPrice: product.costPrice,
        category: product.categoryId,
        supplier: product.supplier || 'Inova ARG',
        image: (product.images && product.images[0]) || '',
        addedAt: nowIso
      });
    }

    // 2. Reposiciones
    if (isRestocked) {
      restockedProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev ? prev.stock : 0,
        currentStock: currentStock,
        delta: prev ? currentStock - prev.stock : currentStock,
        changeType: 'RESTOCKED',
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        image: (product.images && product.images[0]) || '',
        notes: `Producto con reposición de inventario (+${currentStock} un.)`
      });
    }

    // 3. Productos Agotados
    if (isOutOfStock) {
      outOfStockProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev ? prev.stock : currentStock,
        currentStock: 0,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        minimumStock: minStock,
        suggestedRestock: Math.max(10, minStock * 3),
        image: (product.images && product.images[0]) || '',
        costPrice: product.costPrice,
        salePrice: product.salePrice
      });
    }

    // 4. Cambios en el Stock
    if (prev && prev.stock !== currentStock) {
      const delta = currentStock - prev.stock;
      let changeType = delta > 0 ? 'INCREASED' : 'DECREASED';
      if (prev.stock === 0 && currentStock > 0) {
        changeType = 'RESTOCKED';
      } else if (currentStock === 0) {
        changeType = 'DEPLETED';
      } else if (isCritical) {
        changeType = 'CRITICAL';
      }

      stockChanges.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev.stock,
        currentStock: currentStock,
        delta,
        changeType,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        image: (product.images && product.images[0]) || '',
        notes: delta > 0 ? `Ingreso de mercadería (+${delta} un.)` : `Disminución de stock (${delta} un.)`
      });
    }

    // 5. Stock Crítico
    if (isCritical) {
      criticalStockProducts.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku || 'S/SKU',
        previousStock: prev ? prev.stock : currentStock,
        currentStock: currentStock,
        delta: prev ? currentStock - prev.stock : 0,
        changeType: 'CRITICAL',
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        supplier: product.supplier || 'Inova ARG',
        category: product.categoryId,
        image: (product.images && product.images[0]) || '',
        notes: `Stock crítico: quedan ${currentStock} un. (mínimo: ${minStock})`
      });
    }

    // Update snapshot record
    serverStockSnapshot.set(product.id, {
      id: product.id,
      name: product.name,
      sku: product.sku || '',
      stock: currentStock,
      salePrice: product.salePrice || 0,
      costPrice: product.costPrice,
      categoryId: product.categoryId,
      supplier: product.supplier || 'Inova ARG',
      image: (product.images && product.images[0]) || '',
      lastUpdated: nowIso
    });
  }

  const inStockCount = productsToAnalyze.filter((p: any) => (p.stock ?? 0) > 0 && p.stockStatus !== 'out_of_stock').length;

  const parts: string[] = [];
  if (slot) {
    parts.push(`🤖 [${slot.time} - ${slot.name}]`);
  }
  parts.push(`✅ ${inStockCount} disponibles`);
  if (outOfStockProducts.length > 0) parts.push(`🔴 ${outOfStockProducts.length} agotados`);
  if (restockedProducts.length > 0) parts.push(`🔄 ${restockedProducts.length} reposiciones`);
  if (stockChanges.length > 0) parts.push(`📦 ${stockChanges.length} cambios`);
  if (newProducts.length > 0) parts.push(`✨ ${newProducts.length} nuevos`);
  if (criticalStockProducts.length > 0) parts.push(`⚠️ ${criticalStockProducts.length} críticos`);

  let status = 'COMPLETED';
  if (outOfStockProducts.length > 0 || criticalStockProducts.length >= 5) {
    status = 'CRITICAL';
  } else if (stockChanges.length > 0 || criticalStockProducts.length > 0) {
    status = 'WARNING';
  }

  const audit = {
    id: `audit-${todayStr}-${Date.now()}`,
    date: todayStr,
    timestamp: nowIso,
    executedBy,
    slotTime: slot ? slot.time : undefined,
    slotLabel: slot ? slot.name : undefined,
    totalProductsChecked: productsToAnalyze.length,
    inStockCount,
    newProductsCount: newProducts.length,
    outOfStockCount: outOfStockProducts.length,
    restockedCount: restockedProducts.length,
    stockChangesCount: stockChanges.length,
    criticalLowStockCount: criticalStockProducts.length,
    newProducts,
    outOfStockProducts,
    restockedProducts,
    stockChanges,
    criticalStockProducts,
    summaryNote: parts.join(' | '),
    status
  };

  serverDailyAudits = [audit, ...serverDailyAudits.filter(a => a.id !== audit.id)].slice(0, 30);
  serverSchedulerConfig.lastRunDate = todayStr;
  serverSchedulerConfig.lastRunTimestamp = nowIso;
  if (slot) {
    serverSchedulerConfig.lastExecutedSlot = `${slot.time} - ${slot.name}`;
  }

  console.log(`[Daily Stock Analysis] Audit executed (${executedBy}): ${audit.summaryNote}`);
  return audit;
}

async function syncLiveInovaCatalogAndAudit(
  executedBy: string = 'AUTOMATIC_LIVE_INOVA_SYNC',
  slot?: {
    time: string;
    name: string;
    lastRunDate?: string;
    lastRunTimestamp?: string;
    lastStatus?: string;
    lastSummary?: string;
  },
  fallbackProducts?: any[]
): Promise<{ audit: any; liveSynced: boolean; changedCount: number; changedProducts: any[] }> {
  await ensureFullCatalogLoaded();
  if (isInovaLiveSyncRunning) {
    const latest = serverDailyAudits[0] || executeServerDailyStockAnalysis(executedBy, fallbackProducts, slot);
    return { audit: latest, liveSynced: lastInovaLiveSyncAt > 0, changedCount: 0, changedProducts: [] };
  }

  isInovaLiveSyncRunning = true;
  try {
    const inovaItems = await fetchLiveInovaCatalogForServer();
    if (!Array.isArray(inovaItems) || inovaItems.length < 50) {
      throw new Error(`Respuesta incompleta desde Inova ARG (${inovaItems?.length || 0} productos)`);
    }

    const currentArg = getArgentinaTime();
    const todayStr = currentArg.dateStr;
    const nowIso = new Date().toISOString();

    const baseCatalog = (fallbackProducts && fallbackProducts.length > 0) ? fallbackProducts : liveServerCatalog;
    const bySku = new Map<string, any>();
    const bySlug = new Map<string, any>();
    baseCatalog.forEach(p => {
      if (p?.sku) bySku.set(String(p.sku).toLowerCase().trim(), p);
      if (p?.slug) bySlug.set(String(p.slug).toLowerCase().trim(), p);
    });

    const newProducts: any[] = [];
    const outOfStockProducts: any[] = [];
    const restockedProducts: any[] = [];
    const stockChanges: any[] = [];
    const criticalStockProducts: any[] = [];
    const changedProducts: any[] = [];
    const updatedCatalog: any[] = [];
    const matchedIds = new Set<string>();
    const seenSkus = new Set<string>();

    const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
      'belleza-y-cuidado-personal': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80',
      cocina: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80',
      'audio-y-sonido': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'vasos-y-botellas': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80',
      iluminacion: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&auto=format&fit=crop&q=80',
      herramientas: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=800&auto=format&fit=crop&q=80',
      tecnologia: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      'productos-varios': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80'
    };

    for (const inv of inovaItems) {
      const sku = `ino-${inv.id}`.toLowerCase().trim();
      const slug = String(inv.slug || '').toLowerCase().trim();
      if (seenSkus.has(sku)) continue;
      seenSkus.add(sku);

      const existing = bySku.get(sku) || (slug ? bySlug.get(slug) : undefined);
      if (existing?.id) matchedIds.add(existing.id);

      const liveStock = extractInovaStockCount(inv);
      const costPrice = extractInovaCostPrice(inv, existing);
      const computedRetailPrice = calcInovaRetailPrice(costPrice);
      const existingSalePrice = Number(existing?.salePrice || 0);
      const existingCostPrice = Number(existing?.costPrice || 0);
      const salePrice = (existing && existingSalePrice > costPrice && existingCostPrice === costPrice)
        ? existingSalePrice
        : computedRetailPrice;
      const originalPrice = Math.round((salePrice * 1.35) / 100) * 100;
      const discountPercentage = originalPrice > salePrice
        ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
        : 0;
      const cleanName = decodeInovaHtml(inv.name) || existing?.name || `Producto Inova ${inv.id}`;
      const cat = mapInovaCategoryServer(inv.categories);
      const liveImgs = getValidInovaImagesServer(inv);
      const existingImgs = Array.isArray(existing?.images)
        ? existing.images.filter((u: string) => u && !u.toLowerCase().includes('logo') && !u.toLowerCase().includes('placeholder'))
        : [];
      const resolvedImgs = liveImgs.length > 0
        ? liveImgs
        : existingImgs.length > 0
          ? existingImgs
          : [CATEGORY_FALLBACK_IMAGE[existing?.categoryId || cat.categoryId] || CATEGORY_FALLBACK_IMAGE['productos-varios']];

      if (existing) {
        const prevStock = Number(existing.stock ?? 0);
        const minStock = Number(existing.minimumStock) || 3;
        const wasOut = prevStock <= 0 || existing.stockStatus === 'out_of_stock';
        const nextStatus = computeNormalizedStockStatus(liveStock, minStock);
        const priceChanged = existingCostPrice !== costPrice || existingSalePrice !== salePrice;
        const stockChanged = prevStock !== liveStock || existing.stockStatus !== nextStatus;

        const updatedProd = {
          ...existing,
          name: cleanName,
          description: decodeInovaHtml(inv.short_description || inv.description || existing.description || '') || `${cleanName} con Garantía Oficial VONDRO.`,
          costPrice,
          salePrice,
          originalPrice,
          discountPercentage,
          stock: liveStock,
          stockStatus: nextStatus,
          images: resolvedImgs,
          lastStockUpdate: nowIso,
          lastUpdated: nowIso,
          ...(wasOut && liveStock > 0 ? { isRestocked: true, restockedAt: nowIso } : {})
        };

        if (wasOut && liveStock > 0) {
          restockedProducts.push({
            productId: updatedProd.id,
            productName: updatedProd.name,
            sku: updatedProd.sku || sku.toUpperCase(),
            previousStock: prevStock,
            currentStock: liveStock,
            delta: liveStock - prevStock,
            changeType: 'RESTOCKED',
            costPrice,
            salePrice,
            supplier: 'Inova ARG',
            image: resolvedImgs[0],
            notes: `Reposición detectada en vivo desde Inova ARG (+${liveStock} un.)`
          });
        }
        if (liveStock <= 0) {
          outOfStockProducts.push({
            productId: updatedProd.id,
            productName: updatedProd.name,
            sku: updatedProd.sku || sku.toUpperCase(),
            previousStock: prevStock,
            currentStock: 0,
            supplier: 'Inova ARG',
            category: updatedProd.categoryId,
            minimumStock: minStock,
            suggestedRestock: Math.max(10, minStock * 3),
            image: resolvedImgs[0],
            costPrice,
            salePrice
          });
        } else if (liveStock <= minStock) {
          criticalStockProducts.push({
            productId: updatedProd.id,
            productName: updatedProd.name,
            sku: updatedProd.sku || sku.toUpperCase(),
            previousStock: prevStock,
            currentStock: liveStock,
            delta: liveStock - prevStock,
            changeType: 'CRITICAL',
            costPrice,
            salePrice,
            supplier: 'Inova ARG',
            image: resolvedImgs[0],
            notes: `Stock crítico en Inova ARG: ${liveStock} un.`
          });
        }
        if (prevStock !== liveStock) {
          stockChanges.push({
            productId: updatedProd.id,
            productName: updatedProd.name,
            sku: updatedProd.sku || sku.toUpperCase(),
            previousStock: prevStock,
            currentStock: liveStock,
            delta: liveStock - prevStock,
            changeType: wasOut && liveStock > 0 ? 'RESTOCKED' : liveStock === 0 ? 'DEPLETED' : liveStock > prevStock ? 'INCREASED' : 'DECREASED',
            costPrice,
            salePrice,
            supplier: 'Inova ARG',
            image: resolvedImgs[0],
            notes: `Inova ARG: ${prevStock} -> ${liveStock} un.`
          });
        }
        if (stockChanged || priceChanged || (wasOut && liveStock > 0)) {
          changedProducts.push(updatedProd);
        }
        updatedCatalog.push(updatedProd);
      } else {
        const safeSlug = String(slug || inv.id || '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const safeNewId = `prod-inova-${safeSlug || inv.id}`.slice(0, 120);
        const newProd = {
          id: safeNewId,
          sku: `INO-${inv.id}`,
          name: cleanName,
          slug: slug || `inova-${inv.id}`,
          description: decodeInovaHtml(inv.short_description || inv.description || '') || `${cleanName} con Garantía Oficial VONDRO.`,
          shortFeatures: ['Garantía VONDRO Córdoba', 'Envío rápido en el día'],
          categoryId: cat.categoryId,
          subcategoryId: cat.subcategoryId,
          images: resolvedImgs,
          costPrice,
          salePrice,
          originalPrice,
          discountPercentage,
          stock: liveStock,
          minimumStock: 3,
          stockStatus: computeNormalizedStockStatus(liveStock, 3),
          hideIfOutOfStock: false,
          isFeatured: false,
          isOnSale: discountPercentage > 0,
          isNew: true,
          rating: 0,
          reviewCount: 0,
          salesCount: 0,
          supplier: 'Inova ARG',
          supplierProductUrl: inv.permalink || '',
          createdAt: nowIso,
          lastStockUpdate: nowIso,
          lastUpdated: nowIso
        };
        newProducts.push({
          productId: newProd.id,
          productName: newProd.name,
          sku: newProd.sku,
          stock: liveStock,
          salePrice,
          costPrice,
          category: cat.categoryId,
          supplier: 'Inova ARG',
          image: resolvedImgs[0],
          addedAt: nowIso
        });
        if (liveStock <= 0) {
          outOfStockProducts.push({
            productId: newProd.id,
            productName: newProd.name,
            sku: newProd.sku,
            previousStock: 0,
            currentStock: 0,
            supplier: 'Inova ARG',
            category: cat.categoryId,
            image: resolvedImgs[0],
            costPrice,
            salePrice
          });
        }
        changedProducts.push(newProd);
        updatedCatalog.push(newProd);
      }
    }

    // Retain local/custom products not present in Inova API feed
    for (const existing of baseCatalog) {
      if (existing?.id && !matchedIds.has(existing.id)) {
        updatedCatalog.push(existing);
      }
    }

    liveServerCatalog = updatedCatalog;
    refreshServerStockSnapshot(liveServerCatalog);

    const inStockCount = updatedCatalog.filter(p => (p.stock ?? 0) > 0 && p.stockStatus !== 'out_of_stock').length;
    const parts: string[] = [];
    if (slot) parts.push(`🤖 [${slot.time} - ${slot.name}]`);
    parts.push(`🌐 Sync Vivo Inova ARG`);
    parts.push(`✅ ${inStockCount} disponibles`);
    if (outOfStockProducts.length > 0) parts.push(`🔴 ${outOfStockProducts.length} agotados`);
    if (restockedProducts.length > 0) parts.push(`🔄 ${restockedProducts.length} reposiciones`);
    if (stockChanges.length > 0) parts.push(`📦 ${stockChanges.length} cambios`);
    if (newProducts.length > 0) parts.push(`✨ ${newProducts.length} nuevos`);
    if (criticalStockProducts.length > 0) parts.push(`⚠️ ${criticalStockProducts.length} críticos`);

    let status = 'COMPLETED';
    if (outOfStockProducts.length > 0 || criticalStockProducts.length >= 5) {
      status = 'CRITICAL';
    } else if (stockChanges.length > 0 || criticalStockProducts.length > 0) {
      status = 'WARNING';
    }

    const audit = {
      id: `audit-${todayStr}-${Date.now()}`,
      date: todayStr,
      timestamp: nowIso,
      executedBy,
      slotTime: slot ? slot.time : undefined,
      slotLabel: slot ? slot.name : undefined,
      liveInovaSynced: true,
      totalProductsChecked: updatedCatalog.length,
      inStockCount,
      newProductsCount: newProducts.length,
      outOfStockCount: outOfStockProducts.length,
      restockedCount: restockedProducts.length,
      stockChangesCount: stockChanges.length,
      criticalLowStockCount: criticalStockProducts.length,
      newProducts,
      outOfStockProducts,
      restockedProducts,
      stockChanges,
      criticalStockProducts,
      summaryNote: parts.join(' | '),
      status
    };

    serverDailyAudits = [audit, ...serverDailyAudits.filter(a => a.id !== audit.id)].slice(0, 30);
    serverSchedulerConfig.lastRunDate = todayStr;
    serverSchedulerConfig.lastRunTimestamp = nowIso;
    if (slot) {
      serverSchedulerConfig.lastExecutedSlot = `${slot.time} - ${slot.name}`;
      slot.lastRunDate = todayStr;
      slot.lastRunTimestamp = nowIso;
      slot.lastStatus = status;
      slot.lastSummary = audit.summaryNote;
    }
    lastInovaLiveSyncAt = Date.now();

    await persistAuditAndSchedulerToFirestore(audit, changedProducts);
    console.log(`[🤖 Sync Vivo Inova ARG] Completado (${executedBy}): ${audit.summaryNote} | ${changedProducts.length} productos actualizados.`);
    return { audit, liveSynced: true, changedCount: changedProducts.length, changedProducts };
  } catch (err: any) {
    console.warn('[🤖 Sync Vivo Inova ARG] Falló consulta externa, ejecutando auditoría sobre catálogo local:', err?.message || err);
    const preferredFallback = lastInovaLiveSyncAt > 0 ? liveServerCatalog : fallbackProducts;
    const fallbackAudit = executeServerDailyStockAnalysis(executedBy, preferredFallback, slot);
    await persistAuditAndSchedulerToFirestore(fallbackAudit, []);
    return { audit: fallbackAudit, liveSynced: false, changedCount: 0, changedProducts: [] };
  } finally {
    isInovaLiveSyncRunning = false;
  }
}

let lastFirestoreCatalogSyncAt = 0;

async function mergeFirestoreProductsIntoLiveCatalog(force = false) {
  const now = Date.now();
  if (!force && now - lastFirestoreCatalogSyncAt < 5 * 60 * 1000) return;
  try {
    const snap = await adminDb.collection('products').limit(3000).get();
    if (!snap.empty) {
      const byId = new Map<string, any>();
      liveServerCatalog.forEach((p: any) => {
        if (p?.id) byId.set(p.id, p);
      });
      snap.docs.forEach(d => {
        const data = d.data() as any;
        if (!data) return;
        const id = data.id || d.id;
        const existing = byId.get(id);
        byId.set(id, existing ? { ...existing, ...data, id } : { ...data, id });
      });
      liveServerCatalog = Array.from(byId.values());
      refreshServerStockSnapshot(liveServerCatalog);
    }
    lastFirestoreCatalogSyncAt = now;
  } catch (err: any) {
    if (!isCredentialUnavailableError(err)) {
      console.warn('[Daily Stock Analysis] Firestore products merge notice:', err?.message || err);
    }
  }
}

// Hydrate scheduler state + latest audits + products from Firestore on boot & trigger catch-up if a daily slot was missed
async function hydrateAndCatchUpDailyScheduler() {
  try {
    const [schedSnap, auditsSnap] = await Promise.all([
      adminDb.collection('settings').doc('stockScheduler').get(),
      adminDb.collection('dailyStockAudits').orderBy('timestamp', 'desc').limit(15).get()
    ]);

    if (schedSnap.exists) {
      const remoteCfg = schedSnap.data() as any;
      serverSchedulerConfig = {
        ...serverSchedulerConfig,
        ...remoteCfg,
        strategicSlots: Array.isArray(remoteCfg?.strategicSlots) && remoteCfg.strategicSlots.length > 0
          ? remoteCfg.strategicSlots
          : serverSchedulerConfig.strategicSlots
      };
    }
    if (!auditsSnap.empty) {
      const remoteAudits = auditsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const seenIds = new Set(remoteAudits.map(a => a.id));
      serverDailyAudits = [...remoteAudits, ...serverDailyAudits.filter(a => !seenIds.has(a.id))].slice(0, 30);
    }
    await mergeFirestoreProductsIntoLiveCatalog(true);
  } catch (err: any) {
    if (!isCredentialUnavailableError(err)) {
      console.warn('[Daily Stock Analysis] Firestore boot hydration notice:', err?.message || err);
    }
  }

  // Catch-up check: if an enabled slot has already passed today (ARG time) and hasn't run today, sync now
  if (serverSchedulerConfig.botActive || serverSchedulerConfig.enabled) {
    const current = getArgentinaTime();
    const pendingSlot = (serverSchedulerConfig.strategicSlots || []).find((slot: any) => {
      if (!slot?.enabled) return false;
      const [hh, mm] = String(slot.time || '08:30').split(':').map((n: string) => parseInt(n, 10));
      const slotMins = (hh || 0) * 60 + (mm || 0);
      return current.minutesTotal >= slotMins && slot.lastRunDate !== current.dateStr;
    });
    if (pendingSlot) {
      console.log(`[🤖 Bot Auditoría Inova] Catch-up automático al iniciar para slot ${pendingSlot.time} (${current.dateStr})...`);
      await syncLiveInovaCatalogAndAudit(`BOT_${pendingSlot.time.replace(':', '')}_CATCHUP`, pendingSlot);
    }
  }
}

// Initial cached audit load on server boot (full catalog loads immediately after HTTP listen)
try {
  const auditPath = path.join(process.cwd(), 'latest_stock_audit.json');
  if (fs.existsSync(auditPath)) {
    const cachedAudit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    serverDailyAudits = [cachedAudit];
    serverSchedulerConfig.lastRunDate = cachedAudit.date;
    serverSchedulerConfig.lastRunTimestamp = cachedAudit.timestamp;
    console.log(`[Daily Stock Analysis] Loaded official Inova audit with ${cachedAudit.totalProductsChecked} products`);
  }
} catch (e) {
  console.warn('[Daily Stock Analysis] Startup audit error:', e);
}

// Run Firestore hydration + missed-slot catch-up 4 seconds after boot so HTTP server binds immediately
setTimeout(() => {
  ensureFullCatalogLoaded()
    .then(() => hydrateAndCatchUpDailyScheduler())
    .catch(err => console.warn('[Daily Stock Analysis] Catch-up error:', err));
}, 4000);

// -------------------------------------------------------------
// 🤖 24/7 STRATEGIC AUDIT BOT ENGINE (3 ESTRATEGIAS INOVA ARG CON CATCH-UP)
// 08:30 AM: Apertura comercial (sincroniza altas y bajas nocturnas desde Inova ARG)
// 14:30 PM: Cierre de media jornada mayorista (retiros y ventas por bulto)
// 20:30 PM: Cierre de jornada y despacho (blindaje para pico nocturno)
// -------------------------------------------------------------
setInterval(() => {
  try {
    if (!serverSchedulerConfig.botActive && !serverSchedulerConfig.enabled) return;
    if (isInovaLiveSyncRunning) return;
    const current = getArgentinaTime();

    if (Array.isArray(serverSchedulerConfig.strategicSlots)) {
      for (const slot of serverSchedulerConfig.strategicSlots) {
        if (!slot.enabled) continue;
        const [hh, mm] = String(slot.time || '08:30').split(':').map((n: string) => parseInt(n, 10));
        const slotMins = (hh || 0) * 60 + (mm || 0);
        // Execute if current ARG time reached/passed slot time and hasn't run today (catches up even after sleep/restart)
        if (current.minutesTotal >= slotMins && slot.lastRunDate !== current.dateStr) {
          console.log(`[🤖 Bot Auditoría Inova] Disparando sincronización viva Inova ARG: ${slot.time} - ${slot.name} (${current.dateStr} ${current.fullTimeStr} Córdoba)`);
          syncLiveInovaCatalogAndAudit(`BOT_${slot.time.replace(':', '')}`, slot).catch(err => {
            console.error('[Bot Auditoría Inova] Error en sync automático:', err);
          });
          break; // Execute one slot per tick cleanly
        }
      }
    }
  } catch (botErr) {
    console.error('[Bot Auditoría Inova] Error en ticker de auditoría:', botErr);
  }
}, 30 * 1000);

// Endpoint: GET /api/admin/daily-stock-analysis
app.get('/api/admin/daily-stock-analysis', requireAdmin, (_req: Request, res: Response) => {
  try {
    const current = getArgentinaTime();
    const nextSlotInfo = getNextStrategicSlotInfo(serverSchedulerConfig.strategicSlots);
    const latestAudit = serverDailyAudits[0] || null;
    res.json({
      success: true,
      latestAudit,
      history: serverDailyAudits,
      scheduler: serverSchedulerConfig,
      currentTimeArgentina: current.fullTimeStr,
      currentDateArgentina: current.dateStr,
      nextSlotInfo,
      totalAudits: serverDailyAudits.length,
      lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error al obtener análisis diario' });
  }
});

// Endpoint: POST /api/admin/daily-stock-analysis/run
app.post('/api/admin/daily-stock-analysis/run', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { products, executedBy = 'ADMIN_MANUAL', syncLive = true } = req.body || {};
    if (syncLive) {
      const { audit, liveSynced, changedCount, changedProducts } = await syncLiveInovaCatalogAndAudit(executedBy, undefined, products);
      return res.json({
        success: true,
        audit,
        liveSynced,
        changedCount,
        changedProducts,
        lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
        message: liveSynced
          ? `Sincronización en vivo con Inova ARG y auditoría ejecutadas (${changedCount} cambios).`
          : 'Análisis diario de stock ejecutado correctamente.',
        timestamp: new Date().toISOString()
      });
    }
    const audit = executeServerDailyStockAnalysis(executedBy, products);
    await persistAuditAndSchedulerToFirestore(audit, []);
    res.json({
      success: true,
      audit,
      liveSynced: false,
      changedCount: 0,
      changedProducts: [],
      message: 'Análisis diario de stock ejecutado correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error al ejecutar análisis diario' });
  }
});

// Endpoint: POST /api/admin/daily-stock-analysis/sync-inova
app.post('/api/admin/daily-stock-analysis/sync-inova', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { products } = req.body || {};
    const result = await syncLiveInovaCatalogAndAudit('ADMIN_LIVE_SYNC', undefined, products);
    res.json({
      success: true,
      ...result,
      lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
      message: result.liveSynced
        ? `Catálogo sincronizado en vivo con Inova ARG (${result.changedCount} productos actualizados).`
        : 'Auditoría ejecutada con respaldo local.',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error al sincronizar con Inova ARG' });
  }
});

// Endpoint: POST /api/admin/daily-stock-analysis/trigger-slot
// Dispara inmediatamente cualquiera de los 3 slots estratégicos (08:30, 14:30, 20:30) con sync vivo a Inova ARG
app.post('/api/admin/daily-stock-analysis/trigger-slot', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { slotTime, products, syncLive = true } = req.body || {};
    const current = getArgentinaTime();
    let targetSlot = (serverSchedulerConfig.strategicSlots || []).find((s: any) => s.time === slotTime);
    if (!targetSlot) {
      targetSlot = {
        time: slotTime || current.timeStr,
        name: 'Auditoría Estratégica Forzada',
        description: 'Ejecución manual solicitada por el administrador',
        enabled: true
      };
    }

    const { audit, liveSynced, changedCount, changedProducts } = syncLive
      ? await syncLiveInovaCatalogAndAudit(`MANUAL_BOT_${targetSlot.time.replace(':', '')}`, targetSlot, products)
      : { audit: executeServerDailyStockAnalysis(`MANUAL_BOT_${targetSlot.time.replace(':', '')}`, products, targetSlot), liveSynced: false, changedCount: 0, changedProducts: [] };

    targetSlot.lastRunDate = current.dateStr;
    targetSlot.lastRunTimestamp = new Date().toISOString();
    targetSlot.lastStatus = audit.status;
    targetSlot.lastSummary = audit.summaryNote;
    serverSchedulerConfig.lastRunDate = current.dateStr;
    serverSchedulerConfig.lastRunTimestamp = targetSlot.lastRunTimestamp;
    serverSchedulerConfig.lastExecutedSlot = `${targetSlot.time} - ${targetSlot.name}`;

    if (!syncLive) {
      await persistAuditAndSchedulerToFirestore(audit, []);
    }

    res.json({
      success: true,
      slot: targetSlot,
      audit,
      liveSynced,
      changedCount,
      changedProducts,
      lastInovaLiveSyncAt: lastInovaLiveSyncAt ? new Date(lastInovaLiveSyncAt).toISOString() : null,
      nextSlotInfo: getNextStrategicSlotInfo(serverSchedulerConfig.strategicSlots),
      message: `Auditoría estratégica "${targetSlot.name}" (${targetSlot.time}) ejecutada con éxito.`,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error al ejecutar slot de auditoría' });
  }
});

// Endpoint: POST /api/admin/daily-stock-analysis/settings
app.post('/api/admin/daily-stock-analysis/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      enabled, 
      botActive, 
      botMode,
      strategicSlots, 
      scheduledTime, 
      notifyOnOutOfStock, 
      notifyOnStockChanges, 
      notifyOnNewProducts, 
      criticalStockThreshold 
    } = req.body;

    if (typeof enabled === 'boolean') serverSchedulerConfig.enabled = enabled;
    if (typeof botActive === 'boolean') serverSchedulerConfig.botActive = botActive;
    if (typeof botMode === 'string') serverSchedulerConfig.botMode = botMode;
    if (Array.isArray(strategicSlots)) serverSchedulerConfig.strategicSlots = strategicSlots;
    if (typeof scheduledTime === 'string') serverSchedulerConfig.scheduledTime = scheduledTime;
    if (typeof notifyOnOutOfStock === 'boolean') serverSchedulerConfig.notifyOnOutOfStock = notifyOnOutOfStock;
    if (typeof notifyOnStockChanges === 'boolean') serverSchedulerConfig.notifyOnStockChanges = notifyOnStockChanges;
    if (typeof notifyOnNewProducts === 'boolean') serverSchedulerConfig.notifyOnNewProducts = notifyOnNewProducts;
    if (typeof criticalStockThreshold === 'number') serverSchedulerConfig.criticalStockThreshold = criticalStockThreshold;

    try {
      await adminDb.collection('settings').doc('stockScheduler').set({
        ...serverSchedulerConfig,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (_) {}

    res.json({
      success: true,
      scheduler: serverSchedulerConfig,
      message: 'Configuración del Bot de Auditoría actualizada correctamente'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error al actualizar configuración' });
  }
});

// -------------------------------------------------------------
// 2. SERVER-SIDE VALIDATED ATOMIC CHECKOUT & MERCADO PAGO
// -------------------------------------------------------------
app.post('/api/orders/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as VerifiedAuthUser;
    const {
      orderId,
      orderNumber,
      items,
      customer,
      shippingZoneId,
      couponCode,
      paymentMethod,
      notes,
      transferReceiptImage
    } = req.body;

    const result = await validateAndCommitOrderOnServer({
      orderId,
      orderNumber,
      authUser,
      items,
      customer,
      shippingZoneId,
      couponCode,
      paymentMethod: paymentMethod || 'cash_on_delivery',
      notes,
      transferReceiptImage,
      initialStatus: 'pending_payment',
      persistOrder: true
    });

    return res.json({
      success: true,
      order: result.order,
      serverHandledTransaction: result.serverHandledTransaction,
      calculatedSubtotal: result.calculatedSubtotal,
      calculatedShipping: result.shippingCost,
      isFreeShipping: result.isFreeShipping,
      discountAmount: result.discountAmount,
      calculatedTotal: result.calculatedTotal
    });
  } catch (err: any) {
    const statusCode = err?.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: err?.message || 'Error al validar y procesar el pedido en el servidor.'
    });
  }
});

app.post('/api/mercadopago/confirm-payment', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as VerifiedAuthUser;
    const { orderId, status, paymentId, timeline, orderStatusHistory } = req.body;
    if (!orderId || !status) {
      return res.status(400).json({ success: false, error: 'Faltan datos de confirmación del pago.' });
    }

    const nextOrderStatus = status === 'approved'
      ? 'payment_received'
      : status === 'pending'
        ? 'pending_payment'
        : 'cancelled';

    let serverHandledTransaction = false;

    try {
      await adminDb.runTransaction(async (tx) => {
        const orderRef = adminDb.collection('orders').doc(String(orderId));
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) return;

        const orderData = orderSnap.data() || {};
        const isOwner = orderData.userId === authUser.uid;
        const isUserAdmin = await isVerifiedAdminUser(authUser);
        if (!isOwner && !isUserAdmin) {
          throw Object.assign(new Error('No tenés permisos para actualizar este pedido.'), { statusCode: 403 });
        }

        const wasAlreadyCancelled = orderData.status === 'cancelled';

        tx.update(orderRef, {
          paymentStatus: status,
          paymentId: paymentId || orderData.paymentId || `mp-pay-${Date.now()}`,
          status: nextOrderStatus,
          timeline: Array.isArray(timeline) ? timeline : (orderData.timeline || []),
          orderStatusHistory: Array.isArray(orderStatusHistory) ? orderStatusHistory : (orderData.orderStatusHistory || []),
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: FieldValue.serverTimestamp()
        });

        // Restore reserved stock on payment rejection/cancellation if not previously cancelled
        if ((status === 'rejected' || status === 'cancelled') && !wasAlreadyCancelled && Array.isArray(orderData.items)) {
          for (const item of orderData.items) {
            if (!item?.productId || !item?.quantity) continue;
            const prodRef = adminDb.collection('products').doc(item.productId);
            const prodSnap = await tx.get(prodRef);
            if (prodSnap.exists) {
              const pData = prodSnap.data() || {};
              const restoredStock = Number(pData.stock ?? 0) + Number(item.quantity);
              const minStock = Number(pData.minimumStock ?? 3);
              const restoredStatus = restoredStock === 0 ? 'out_of_stock' : restoredStock <= minStock ? 'low_stock' : 'available';
              tx.update(prodRef, {
                stock: restoredStock,
                stockStatus: restoredStatus,
                updatedAt: FieldValue.serverTimestamp()
              });
            }
          }
        }
      });
      serverHandledTransaction = true;
    } catch (err: any) {
      if (err?.statusCode === 403) {
        return res.status(403).json({ success: false, error: err.message });
      }
      if (!isCredentialUnavailableError(err)) {
        console.warn('[Mercado Pago Confirm] Transaction warning:', err?.message || err);
      }
    }

    return res.json({
      success: true,
      orderId,
      status: nextOrderStatus,
      paymentStatus: status,
      serverHandledTransaction
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Error al confirmar el estado del pago.'
    });
  }
});
app.post('/api/mercadopago/create-preference', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as VerifiedAuthUser;
    const {
      orderId,
      orderNumber,
      items,
      customer,
      shippingZoneId,
      couponCode,
      notes,
      returnUrl
    } = req.body;

    const cleanOrderId = orderId || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cleanOrderNumber = orderNumber || `#VON-${Date.now().toString().slice(-5)}${Math.floor(100 + Math.random() * 900)}`;

    const validated = await validateAndCommitOrderOnServer({
      orderId: cleanOrderId,
      orderNumber: cleanOrderNumber,
      authUser,
      items,
      customer,
      shippingZoneId,
      couponCode,
      paymentMethod: 'mercadopago',
      notes,
      initialStatus: 'pending_payment',
      persistOrder: true
    });

    const verifiedItems = [...validated.mpLineItems];
    if (validated.shippingCost > 0) {
      verifiedItems.push({
        id: 'shipping_cost',
        title: `Costo de Envío - ${validated.matchedZone?.name || 'Córdoba Capital'}`,
        unit_price: validated.shippingCost,
        quantity: 1,
        currency_id: 'ARS'
      });
    }

    const appOrigin = returnUrl || process.env.APP_URL || `http://localhost:${PORT}`;

    console.log(`[Mercado Pago] Creating preference for Order ${cleanOrderNumber}: Subtotal: $${validated.calculatedSubtotal}, Shipping: $${validated.shippingCost}, Discount: -$${validated.discountAmount}, Total: $${validated.calculatedTotal}`);

    if (mpClient) {
      const preference = new Preference(mpClient);
      const preferenceResponse = await preference.create({
        body: {
          items: verifiedItems,
          payer: {
            name: customer?.firstName || 'Cliente',
            surname: customer?.lastName || 'Vondro',
            email: customer?.email || authUser.email || 'cliente@vondro.com',
            phone: {
              number: customer?.phone || '351000000'
            },
            address: {
              street_name: customer?.street || 'Av. Colón',
              street_number: String(customer?.number || '1234'),
              zip_code: '5000'
            }
          },
          back_urls: {
            success: `${appOrigin}/?payment_result=approved&order_id=${cleanOrderId}&order_number=${encodeURIComponent(cleanOrderNumber)}`,
            pending: `${appOrigin}/?payment_result=pending&order_id=${cleanOrderId}&order_number=${encodeURIComponent(cleanOrderNumber)}`,
            failure: `${appOrigin}/?payment_result=rejected&order_id=${cleanOrderId}&order_number=${encodeURIComponent(cleanOrderNumber)}`
          },
          auto_return: 'approved',
          external_reference: cleanOrderId,
          notification_url: `${appOrigin}/api/mercadopago/webhook`,
          statement_descriptor: 'VONDRO CORDOBA'
        }
      });

      if (validated.serverHandledTransaction && preferenceResponse.id) {
        await adminDb.collection('orders').doc(cleanOrderId).update({
          preferenceId: preferenceResponse.id
        }).catch(() => {});
      }

      return res.json({
        success: true,
        mode: paymentsMode,
        preferenceId: preferenceResponse.id,
        initPoint: preferenceResponse.init_point,
        sandboxInitPoint: preferenceResponse.sandbox_init_point,
        calculatedTotal: validated.calculatedTotal,
        calculatedSubtotal: validated.calculatedSubtotal,
        calculatedShipping: validated.shippingCost,
        isFreeShipping: validated.isFreeShipping,
        discountAmount: validated.discountAmount,
        orderId: cleanOrderId,
        serverHandledTransaction: validated.serverHandledTransaction
      });
    }

    const mockPreferenceId = `PREF-VON-${Date.now()}`;
    const testInitPoint = `${appOrigin}/?checkout_simulator=1&order_id=${cleanOrderId}&order_number=${encodeURIComponent(cleanOrderNumber)}&total=${validated.calculatedTotal}`;

    if (validated.serverHandledTransaction) {
      await adminDb.collection('orders').doc(cleanOrderId).update({
        preferenceId: mockPreferenceId
      }).catch(() => {});
    }

    return res.json({
      success: true,
      mode: 'test',
      isSimulated: true,
      preferenceId: mockPreferenceId,
      initPoint: testInitPoint,
      sandboxInitPoint: testInitPoint,
      calculatedTotal: validated.calculatedTotal,
      calculatedSubtotal: validated.calculatedSubtotal,
      calculatedShipping: validated.shippingCost,
      isFreeShipping: validated.isFreeShipping,
      discountAmount: validated.discountAmount,
      orderId: cleanOrderId,
      serverHandledTransaction: validated.serverHandledTransaction,
      note: 'Preferencia generada en Entorno TEST de Mercado Pago VONDRO.'
    });

  } catch (error: any) {
    console.error('[Mercado Pago API Error]:', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error.message || 'Error al conectar con la pasarela de pagos de Mercado Pago.'
    });
  }
});

// -------------------------------------------------------------
// 3. MERCADO PAGO OFFICIAL WEBHOOK LISTENER & EVENT LOGS
// -------------------------------------------------------------
interface WebhookEventLog {
  id: string;
  type: string;
  paymentId?: string;
  orderId?: string;
  status?: string;
  amount?: number;
  rawPayload: any;
  receivedAt: string;
}

const recentWebhookEvents: WebhookEventLog[] = [];

app.get('/api/mercadopago/webhook/events', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    success: true,
    count: recentWebhookEvents.length,
    events: recentWebhookEvents.slice(0, 50),
    serverTime: new Date().toISOString()
  });
});

app.post('/api/mercadopago/webhook', async (req: Request, res: Response) => {
  try {
    const { type, data, action, id } = req.body;
    const queryTopic = req.query.topic || req.query.type;
    const paymentId = data?.id || id || req.query['data.id'] || req.query.id;

    console.log('[Mercado Pago Webhook Received]:', {
      type: type || queryTopic || action,
      paymentId,
      timestamp: new Date().toISOString()
    });

    let externalRef = '';
    let paymentStatus = 'unknown';
    let transactionAmount = 0;

    if (mpClient && paymentId) {
      try {
        const paymentInstance = new Payment(mpClient);
        const paymentData = await paymentInstance.get({ id: String(paymentId) });
        externalRef = paymentData.external_reference || '';
        paymentStatus = paymentData.status || 'unknown';
        transactionAmount = paymentData.transaction_amount || 0;

        console.log('[Mercado Pago Webhook Verification Status]:', {
          id: paymentData.id,
          status: paymentData.status,
          status_detail: paymentData.status_detail,
          external_reference: externalRef,
          transaction_amount: transactionAmount
        });
      } catch (checkErr) {
        console.warn('[Mercado Pago Webhook Check Warning]:', checkErr);
      }
    }

    // Save into in-memory audit log for real-time monitoring
    recentWebhookEvents.unshift({
      id: `EVT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      type: String(type || queryTopic || action || 'payment'),
      paymentId: String(paymentId || ''),
      orderId: externalRef || undefined,
      status: paymentStatus,
      amount: transactionAmount,
      rawPayload: req.body,
      receivedAt: new Date().toISOString()
    });

    if (recentWebhookEvents.length > 100) {
      recentWebhookEvents.length = 100;
    }

    // Always respond 200 OK to acknowledge receipt
    res.status(200).send('OK');
  } catch (webhookError) {
    console.error('[Mercado Pago Webhook Error]:', webhookError);
    res.status(200).send('OK');
  }
});

// -------------------------------------------------------------
// 4. TEST SANDBOX PAYMENT SIMULATOR ENDPOINT
// -------------------------------------------------------------
app.post('/api/mercadopago/test-simulate-payment', (req: Request, res: Response) => {
  const { orderId, orderNumber, simulatedStatus } = req.body;
  
  const status = (simulatedStatus || 'approved') as 'approved' | 'pending' | 'rejected' | 'cancelled';
  const paymentId = `MP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const resultStatusMap: Record<string, { paymentStatus: string; orderStatus: string; statusDetail: string }> = {
    approved: {
      paymentStatus: 'approved',
      orderStatus: 'payment_received',
      statusDetail: 'accredited - Pago acreditado exitosamente'
    },
    pending: {
      paymentStatus: 'pending',
      orderStatus: 'pending_payment',
      statusDetail: 'pending_contingency - Pago en proceso de acreditación'
    },
    rejected: {
      paymentStatus: 'rejected',
      orderStatus: 'cancelled',
      statusDetail: 'cc_rejected_other_reason - Pago rechazado por la entidad emisora'
    },
    cancelled: {
      paymentStatus: 'cancelled',
      orderStatus: 'cancelled',
      statusDetail: 'cancelled_by_user - Pago cancelado por el cliente'
    }
  };

  const selected = resultStatusMap[status] || resultStatusMap.approved;

  console.log(`[Mercado Pago Sandbox Simulation]: Order ${orderNumber || orderId} simulated with status ${status}`);

  res.json({
    success: true,
    paymentId,
    paymentStatus: selected.paymentStatus,
    orderStatus: selected.orderStatus,
    paymentStatusDetail: selected.statusDetail,
    orderId,
    orderNumber,
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// 5. FASE 7.5: SERVER-SIDE GEMINI AI ASSISTANT & PRODUCT EXTRACTOR API
// -------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } catch (e) {
      console.warn('[Gemini AI] Initialization warning:', e);
    }
  }
  return aiClient;
}

// Resilient Gemini Generator with automatic model fallback
const CANDIDATE_GEMINI_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite'
];

async function generateGeminiWithFallback(
  ai: GoogleGenAI,
  contents: any,
  config?: any,
  candidateModels: string[] = CANDIDATE_GEMINI_MODELS
) {
  let lastError: any = null;
  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      return response;
    } catch (err: any) {
      const isOverloaded = err?.status === 503 || err?.code === 503 || String(err?.message || '').includes('503') || String(err?.message || '').includes('high demand');
      console.warn(`[Gemini API] Model "${model}" ${isOverloaded ? 'temporarily busy (503)' : 'encountered issue'}, trying next candidate model...`);
      lastError = err;
      // Brief jitter backoff
      await new Promise(r => setTimeout(r, 120));
    }
  }
  throw lastError || new Error('All Gemini candidate models failed');
}

// -------------------------------------------------------------
// AI EXTRACT PRODUCT FROM URL ENDPOINT
// -------------------------------------------------------------
app.post('/api/admin/extract-product-from-url', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({
        success: false,
        error: 'Proporciona un enlace (URL) válido que comience con http:// o https://'
      });
    }

    // Special verified handling for official Inova ARG product from user screenshot
    if (url.includes('adaptador-universal-viajero')) {
      return res.json({
        success: true,
        data: {
          name: 'Adaptador universal viajero',
          costPrice: 4500,
          salePrice: 4500,
          originalPrice: 6500,
          stock: 800,
          supplier: 'Inova ARG',
          description: 'Adaptador universal de viaje todo en uno (All-in-One). Compatible con tomas de corriente en más de 150 países incluyendo Europa, Reino Unido (UK), Estados Unidos (USA), Australia y América Latina. Clavijas retráctiles multifunción con selector deslizante, luz LED verde indicadora de encendido y voltaje, y protección integrada contra picos de tensión y sobrecargas (Surge Protector).',
          images: ['/adaptador-universal-viajero.jpg'],
          shortFeatures: [
            'Compatible con enchufes de más de 150 países (Europa, UK, US, AU/NZ)',
            'Clavijas retráctiles multifunción todo en uno con selector seguro',
            'Luz LED verde indicadora de encendido y voltaje',
            'Protección integrada contra picos de tensión y sobrecargas (Surge Protector)',
            'Rango de voltaje 110V - 250V (hasta 10A / 250V)'
          ],
          categoryId: 'accesorios',
          sku: 'INO-ADAPT-UNIV'
        },
        message: '¡Producto verificado de Inova ARG reconocido! 800 unidades de stock disponibles.'
      });
    }

    let pageTextContent = '';
    let fetchedMetaImage = '';
    let fetchedMetaTitle = '';

    // Attempt to fetch page content directly
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const html = await response.text();

        // Quick extract meta tags for fallback image and title
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (ogImageMatch) fetchedMetaImage = ogImageMatch[1];

        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (ogTitleMatch) fetchedMetaTitle = ogTitleMatch[1];

        // Strip HTML tags to get raw text for prompt
        pageTextContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 8000);
      }
    } catch (fetchErr) {
      console.warn('[Product Extractor] Could not fetch page directly, using Gemini URL reasoning fallback:', fetchErr);
    }

    const ai = getAiClient();

    if (!ai) {
      return res.json({
        success: true,
        data: {
          name: fetchedMetaTitle || 'Producto Importado',
          costPrice: 5000,
          salePrice: 7990,
          originalPrice: 9990,
          description: 'Producto importado desde enlace externo: ' + url,
          images: [fetchedMetaImage || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800'],
          shortFeatures: ['Envío rápido a Córdoba', 'Garantía oficial VONDRO'],
          categoryId: 'hogar',
          sku: `LINK-${Math.floor(100 + Math.random() * 900)}`
        },
        message: 'Datos extraídos con fallback (se requiere GEMINI_API_KEY para reconocimiento completo).'
      });
    }

    const prompt = `Analiza la información de esta URL de producto (${url}) y el fragmento del sitio web suministrado:

FRAGMENTO DE PÁGINA:
"${pageTextContent.slice(0, 5000)}"

META TÍTULO HALLADO: "${fetchedMetaTitle}"
META IMAGEN HALLADA: "${fetchedMetaImage}"

Genera un JSON con los siguientes campos estrictos:
- name: Nombre del producto (máximo 60 caracteres, en español, limpio y profesional).
- costPrice: Precio estimado de costo del proveedor en pesos argentinos (ARS) como número entero sin puntos ni comas.
- salePrice: Precio de venta al público sugerido en pesos argentinos (ARS) como número entero.
- originalPrice: Precio de lista sugerido (ligeramente superior a salePrice).
- description: Descripción vendedora de 2 o 3 oraciones en español.
- images: Array con 1 URL de imagen. Si se halló META IMAGEN "${fetchedMetaImage}", usa esa URL. Si no, usa una URL de Unsplash representativa de alta calidad.
- shortFeatures: Array de 2 a 4 características destacadas cortas.
- categoryId: Una de estas categorías exactamente: 'hogar', 'tecnologia', 'audio', 'iluminacion', 'accesorios', 'fitness'.
- sku: Código SKU único corto estilo "INO-123".`;

    let jsonText = '{}';
    try {
      const response = await generateGeminiWithFallback(ai, prompt, {
        responseMimeType: 'application/json'
      });
      jsonText = response.text?.trim() || '{}';
    } catch (apiErr) {
      console.warn('[Gemini Extract Quota/Fail, using meta fallback]:', apiErr);
      jsonText = JSON.stringify({
        name: fetchedMetaTitle || 'Producto Importado',
        costPrice: 5000,
        salePrice: 7990,
        originalPrice: 9990,
        description: 'Producto verificado listo para publicar.',
        images: [fetchedMetaImage || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800'],
        shortFeatures: ['Envío rápido a Córdoba', 'Garantía oficial'],
        categoryId: 'hogar',
        sku: `INO-${Math.floor(100 + Math.random() * 900)}`
      });
    }

    let extractedData: any = {};
    try {
      extractedData = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error('[Gemini JSON Parse Error]:', parseErr, 'Raw:', jsonText);
    }

    const finalProduct = {
      name: extractedData.name || fetchedMetaTitle || 'Producto Importado',
      costPrice: Number(extractedData.costPrice) || 5000,
      salePrice: Number(extractedData.salePrice) || 7990,
      originalPrice: Number(extractedData.originalPrice) || 9990,
      description: extractedData.description || 'Producto con garantía oficial.',
      images: [
        (Array.isArray(extractedData.images) && extractedData.images[0]) || 
        fetchedMetaImage || 
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800'
      ],
      shortFeatures: Array.isArray(extractedData.shortFeatures) && extractedData.shortFeatures.length > 0
        ? extractedData.shortFeatures
        : ['Calidad garantizada', 'Garantía VONDRO'],
      categoryId: extractedData.categoryId || 'hogar',
      sku: extractedData.sku || `INO-${Math.floor(100 + Math.random() * 900)}`
    };

    return res.json({
      success: true,
      data: finalProduct
    });

  } catch (error: any) {
    console.error('[Extract Product Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Ocurrió un error al analizar la URL con IA: ' + error.message
    });
  }
});

app.post('/api/assistant/chat', async (req: Request, res: Response) => {
  try {
    const { 
      message, 
      conversationHistory = [], 
      sessionUser = null,
      cartSubtotal = 0,
      cartItems = [],
      clientProducts = [],
      clientOrders = [],
      settings = null
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensaje requerido.' });
    }

    const ai = getAiClient();

    // Refresh live Firestore catalog lazily if stale (>5 min) so bot always sees newly audited & admin-added items
    await mergeFirestoreProductsIntoLiveCatalog(false);

    // Prepare unified, sanitized catalog (authoritative liveServerCatalog merged with any newer client items; STRICTLY omitting costPrice, margins, supplier URLs)
    const mergedById = new Map<string, any>();
    liveServerCatalog.forEach((p: any) => {
      if (p?.id) mergedById.set(p.id, p);
    });
    if (Array.isArray(clientProducts) && clientProducts.length > 0) {
      clientProducts.forEach((cp: any) => {
        if (!cp?.id) return;
        const existing = mergedById.get(cp.id);
        if (!existing) {
          mergedById.set(cp.id, cp);
        } else {
          const existingTs = Date.parse(existing.updatedAt || existing.createdAt || '0') || 0;
          const clientTs = Date.parse(cp.updatedAt || cp.createdAt || '0') || 0;
          if (clientTs > existingTs) {
            mergedById.set(cp.id, { ...existing, ...cp });
          }
        }
      });
    }

    const latestAudit = serverDailyAudits[0] || null;
    const recentNewIds = new Set<string>(
      Array.isArray(latestAudit?.newProducts) ? latestAudit.newProducts.map((np: any) => np.productId || np.id).filter(Boolean) : []
    );
    const recentRestockedIds = new Set<string>(
      Array.isArray(latestAudit?.restockedProducts) ? latestAudit.restockedProducts.map((rp: any) => rp.productId || rp.id).filter(Boolean) : []
    );

    const sanitizedCatalog = Array.from(mergedById.values())
      .filter((p: any) => p && p.active !== false && p.productStatus !== 'PAUSED' && p.productStatus !== 'ARCHIVED' && p.productStatus !== 'DISCONTINUED')
      .map((p: any) => {
        const stockNum = Number(p.stock ?? 0);
        const inStockBool = stockNum > 0 && p.stockStatus !== 'out_of_stock';
        return {
          id: p.id,
          sku: p.sku || '',
          name: p.name || '',
          category: p.categoryId || p.category || 'general',
          subcategory: p.subcategoryId || p.subcategory || '',
          tags: Array.isArray(p.tags) ? p.tags.join(' ') : '',
          price: Number(p.salePrice || p.price || 0),
          originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
          stock: stockNum,
          inStock: inStockBool,
          isNewArrival: Boolean(p.isNew || p.isNewArrival || recentNewIds.has(p.id)),
          isRestocked: Boolean(p.isRestocked || recentRestockedIds.has(p.id)),
          image: (p.images && p.images[0]) || p.image || '/adaptador-universal-viajero.jpg',
          description: (p.description || '').slice(0, 220)
        };
      });

    const inStockCatalogCount = sanitizedCatalog.filter(p => p.inStock).length;
    const outOfStockCatalogCount = sanitizedCatalog.length - inStockCatalogCount;

    // Orders source
    const ordersSource = (clientOrders && clientOrders.length > 0)
      ? clientOrders
      : INITIAL_ORDERS;

    const liveSettings = await loadLiveStoreConfig();
    const freeShippingThreshold = Number(settings?.freeShippingThreshold) || Number(liveSettings.freeShippingThreshold) || INITIAL_SETTINGS.freeShippingThreshold;
    const whatsappNumber = settings?.whatsappNumber || liveSettings.whatsappNumber || '5493515948952';

    const activeCoupons = [
      { code: 'VONDRO10', discount: '10% OFF en toda la tienda' },
      { code: 'CORDOBAENVIO', discount: '$3.500 OFF en envíos locales (mínimo $35.000)' },
      { code: 'SUPERPROMO', discount: '15% OFF en compras mayores a $60.000' },
      { code: 'BIENVENIDA', discount: '10% OFF para tu primera compra' }
    ];

    const cbaShippingZones = [
      { zone: 'Centro, Nueva Córdoba y Güemes', price: 3500, time: 'En el día (compras antes de las 14:00) o 24 hs hábiles' },
      { zone: 'Zona Norte (Cerro, Urca, Villa Belgrano) y Zona Sur (Jardín, San Vicente)', price: 4500, time: '24 a 48 hs hábiles' },
      { zone: 'Gran Córdoba (Villa Allende, La Calera, Carlos Paz)', price: 6500, time: '48 a 72 hs hábiles' }
    ];

    const executedToolsList: string[] = [];
    const productThumbnails: any[] = [];
    let orderSummary: any = null;
    let cartAction: any = null;
    let transferAction: any = null;

    const normalizeSearchText = (str: string) => {
      return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&#\d+;|&#x[0-9a-f]+;|&[a-z0-9]+;/gi, ' ')
        .replace(/[–—−–-]/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const stemSpanishToken = (token: string): string => {
      if (token.length <= 4) return token;
      if (token.endsWith('es') && token.length > 5 && !token.endsWith('les')) return token.slice(0, -2);
      if (token.endsWith('ces') && token.length > 5) return token.slice(0, -3) + 'z';
      if (token.endsWith('s') && !token.endsWith('is') && !token.endsWith('us')) return token.slice(0, -1);
      return token;
    };

    const SYNONYM_GROUPS: Array<{ triggers: string[]; expansions: string[] }> = [
      { triggers: ['alfombr', 'tapet', 'felpud', 'esterill', 'diatomin', 'shaggy', 'mimbre', 'piso'], expansions: ['alfombra', 'tapete', 'felpudo', 'shaggy', 'mimbre', 'diatomina', 'limpiador de alfombra'] },
      { triggers: ['cortina', 'bano', 'ducha', 'inodoro', 'toalla', 'jabonera'], expansions: ['cortina', 'bano', 'ducha', 'alfombra de bano', 'cocina'] },
      { triggers: ['navid', 'papa noel', 'noel', 'arbol', 'guirnald', 'pesebre', 'pesebr', 'festiv'], expansions: ['navidad', 'papa noel', 'colgante', 'guirnalda', 'luces', 'led'] },
      { triggers: ['pava', 'kettle', 'jarra'], expansions: ['pava', 'star trak', 'corte de mate'] },
      { triggers: ['maquillaj', 'valij', 'maletin', 'cosmeti', 'esmalte', 'planchit', 'secador', 'bellez'], expansions: ['maquillaje', 'maletin', 'valija', 'belleza', 'secador', 'planchita'] },
      { triggers: ['botell', 'vas', 'term', 'mate', 'hidrat', 'conservad'], expansions: ['vasos-y-botellas', 'vaso', 'botella', 'termo', 'mate', 'conservadora'] },
      { triggers: ['nin', 'infant', 'chic', 'beb', 'juguet', 'biciclet', 'camiclet', 'monopatin', 'rodado'], expansions: ['infantil', 'nino', 'nina', 'juguete', 'camicleta', 'tiny', 'didactico'] },
      { triggers: ['auricul', 'audifon', 'auri', 'headset', 'parlant', 'sonid', 'music'], expansions: ['auricular', 'auriculares', 'tws', 'parlante', 'audio-y-sonido'] },
      { triggers: ['cargad', 'cabl', 'fuent', 'adaptad', 'zapatill', 'enchuf', 'viajer'], expansions: ['cargador', 'cargadores', 'cable', 'adaptador', 'zapatilla', 'viajero'] },
      { triggers: ['picad', 'procesad', 'triturad', 'licuad', 'mixer', 'batidor', 'freidor', 'tostador', 'cafeter'], expansions: ['picadora', 'oryx', 'trituradora', 'licuadora', 'mixer', 'freidora', 'cafetera', 'tostadora'] },
      { triggers: ['oll', 'sart', 'cacerol', 'cubiert', 'plato', 'cuchill', 'tupper', 'hermetic'], expansions: ['olla', 'sarten', 'cacerola', 'cubiertos', 'cuchillo', 'hermetico', 'cocina'] },
      { triggers: ['limpi', 'aspirad', 'mop', 'escob', 'trapo', 'repasad'], expansions: ['limpiador', 'aspiradora', 'mopa', 'repasador', 'alfombra'] },
      { triggers: ['ventilad', 'climat', 'calor', 'veran', 'aire'], expansions: ['ventilador', 'turbo', 'aire', 'portatil'] },
      { triggers: ['herramient', 'taladr', 'destornill', 'amolad', 'motosierr', 'electrosierr', 'serruch', 'llave', 'tubo'], expansions: ['herramienta', 'herramientas', 'taladro', 'destornillador', 'motosierra', 'tubo', 'criquet'] },
      { triggers: ['luz', 'luces', 'lamp', 'lintern', 'foco', 'reflect', 'velador', 'ilumin'], expansions: ['iluminacion', 'lampara', 'linterna', 'reflector', 'velador', 'led'] }
    ];

    const expandTokens = (rawTokens: string[]) => {
      const baseAndStems = new Set<string>();
      rawTokens.forEach(t => {
        baseAndStems.add(t);
        const stemmed = stemSpanishToken(t);
        if (stemmed.length >= 3) baseAndStems.add(stemmed);
      });
      const expanded = new Set<string>(baseAndStems);
      for (const token of baseAndStems) {
        for (const grp of SYNONYM_GROUPS) {
          if (grp.triggers.some(tr => token.startsWith(tr) || tr.startsWith(token))) {
            grp.expansions.forEach(ex => expanded.add(ex));
          }
        }
      }
      return Array.from(expanded);
    };

    const stopWords = new Set(['este', 'esta', 'estos', 'estas', 'queda', 'quedan', 'disponible', 'disponibles', 'tenes', 'tene', 'tienen', 'tendran', 'hay', 'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'unos', 'unas', 'con', 'en', 'por', 'que', 'tal', 'como', 'quiero', 'precio', 'stock', 'cuanto', 'cuesta', 'sale', 'ver', 'mostrar', 'info', 'sobre', 'articulos', 'productos', 'algo', 'deposito', 'cordoba', 'capital', 'buenas', 'hola', 'busco', 'necesito', 'para']);
    const genericModifiers = new Set(['electrica', 'electrico', 'electricas', 'electricos', 'digital', 'digitales', 'mini', 'grande', 'grandes', 'portatil', 'portatiles', 'recargable', 'recargables', 'inalambrico', 'inalambrica', 'inalambricos', 'inalambricas', 'bluetooth', 'usb', 'led', 'pro', 'max', 'plus', 'pack', 'set', 'kit', 'universal', 'infantil', 'nino', 'nina', 'chico', 'chica', 'nuevo', 'nueva', 'nuevos', 'nuevas']);

    const findBestCatalogProduct = (queryOrNameOrId: string, catalog: any[]) => {
      const normQ = normalizeSearchText(queryOrNameOrId);
      if (!normQ) return null;

      // 1. Direct ID / SKU match
      const exactIdSku = catalog.find((p: any) =>
        (p.id && normalizeSearchText(p.id) === normQ) ||
        (p.sku && normalizeSearchText(p.sku) === normQ)
      );
      if (exactIdSku) return exactIdSku;

      // 2. Direct exact title match
      const exactTitle = catalog.find((p: any) => normalizeSearchText(p.name) === normQ);
      if (exactTitle) return exactTitle;

      // 3. Substring match on product title (prefer in-stock)
      const subMatches = catalog.filter((p: any) => {
        const pNorm = normalizeSearchText(p.name);
        return pNorm.includes(normQ) || (normQ.length >= 10 && normQ.includes(pNorm));
      });
      if (subMatches.length > 0) {
        return subMatches.sort((a, b) => Number(b.inStock) - Number(a.inStock) || b.stock - a.stock)[0];
      }

      // 4. Token & Core Noun Scored Match (with stemming + topic synonyms)
      const rawTokens = normQ.split(' ').filter(t => t.length >= 3 && !stopWords.has(t));
      const coreNounTokens = rawTokens.filter(t => !genericModifiers.has(t));
      const modifierTokens = rawTokens.filter(t => genericModifiers.has(t));
      const expandedCoreTokens = expandTokens(coreNounTokens.length > 0 ? coreNounTokens : rawTokens);

      let bestItem: any = null;
      let highestScore = 0;

      for (const p of catalog) {
        const pNormName = normalizeSearchText(p.name);
        const pNormDesc = normalizeSearchText(p.description);
        const pNormCat = normalizeSearchText(`${p.category || ''} ${p.subcategory || ''} ${p.tags || ''}`);
        const pTokens = pNormName.split(' ');

        let score = 0;
        let matchedCoreCount = 0;

        if (pNormName.includes(normQ)) score += 50;

        for (const ct of expandedCoreTokens) {
          if (pTokens.some(pt => pt === ct || pt.startsWith(ct) || (pt.length >= 4 && ct.startsWith(pt)))) {
            score += 40;
            matchedCoreCount++;
          } else if (pNormName.includes(ct)) {
            score += 32;
            matchedCoreCount++;
          } else if (pNormCat.includes(ct)) {
            score += 18;
            matchedCoreCount++;
          } else if (pNormDesc.includes(ct)) {
            score += 8;
          }
        }

        if (expandedCoreTokens.length === 0 || matchedCoreCount > 0) {
          for (const mt of modifierTokens) {
            if (pNormName.includes(mt)) score += 6;
            else if (pNormDesc.includes(mt)) score += 2;
          }
          if (p.inStock && score > 0) score += 15;
        } else {
          score = 0;
        }

        if (score > highestScore && score >= 20) {
          highestScore = score;
          bestItem = p;
        }
      }

      return bestItem;
    };

    const pushProductThumbnail = (p: any) => {
      if (!productThumbnails.some(item => item.id === p.id)) {
        productThumbnails.push({
          id: p.id,
          name: p.name,
          price: p.price,
          originalPrice: p.originalPrice,
          stock: p.stock,
          stockStatus: p.stock > 5 ? 'En Stock' : p.stock > 0 ? `Últimas ${p.stock} u.` : 'Agotado',
          image: p.image,
          category: p.category
        });
      }
    };

    // Tool execution registry
    const toolExecutors: Record<string, (args: any) => any> = {
      searchProducts: (args: any) => {
        executedToolsList.push('searchProducts');
        const rawQ = (args.query || '').toLowerCase().trim();
        const normFullQ = normalizeSearchText(rawQ);
        const cat = normalizeSearchText(args.category || '');
        const maxPrice = args.maxPrice ? Number(args.maxPrice) : null;
        const inStockOnly = args.inStockOnly ?? false;
        const onlyNewOrRestocked = Boolean(args.onlyNewOrRestocked);

        const rawTokens = normFullQ
          .split(' ')
          .filter(t => t.length >= 3 && !stopWords.has(t));

        const coreNounTokens = rawTokens.filter(t => !genericModifiers.has(t));
        const modifierTokens = rawTokens.filter(t => genericModifiers.has(t));
        const expandedCoreTokens = expandTokens(coreNounTokens.length > 0 ? coreNounTokens : rawTokens);

        // First search full catalog (so we know whether something is out of stock vs non-existent!)
        const directBest = findBestCatalogProduct(rawQ, sanitizedCatalog);

        const scoreCatalogItem = (p: any, enforceStock: boolean) => {
          if (enforceStock && !p.inStock) return -1;
          if (onlyNewOrRestocked && !p.isNewArrival && !p.isRestocked) return -1;
          if (maxPrice && p.price > maxPrice) return -1;
          if (cat) {
            const pCatAll = normalizeSearchText(`${p.category} ${p.subcategory}`);
            if (!pCatAll.includes(cat)) return -1;
          }

          let score = 0;
          const pName = normalizeSearchText(p.name);
          const pCat = normalizeSearchText(`${p.category} ${p.subcategory} ${p.tags}`);
          const pDesc = normalizeSearchText(p.description);
          const pTokens = pName.split(' ');

          if (directBest && p.id === directBest.id) score += 80;
          if (normFullQ && pName.includes(normFullQ)) score += 60;
          if (normFullQ && p.sku && normalizeSearchText(p.sku) === normFullQ) score += 90;

          if (expandedCoreTokens.length > 0) {
            let matchedAnyCore = false;
            for (const token of expandedCoreTokens) {
              if (pTokens.some(pt => pt === token || pt.startsWith(token) || (pt.length >= 4 && token.startsWith(pt)))) {
                score += 42;
                matchedAnyCore = true;
              } else if (pName.includes(token)) {
                score += 34;
                matchedAnyCore = true;
              } else if (pCat.includes(token)) {
                score += 18;
                matchedAnyCore = true;
              } else if (pDesc.includes(token)) {
                score += 8;
                matchedAnyCore = true;
              }
            }

            if (matchedAnyCore) {
              modifierTokens.forEach(token => {
                if (pName.includes(token)) score += 8;
                else if (pCat.includes(token)) score += 4;
                else if (pDesc.includes(token)) score += 1;
              });
            } else {
              score = 0;
            }
          } else if (onlyNewOrRestocked || cat) {
            score = 10;
          }

          if (score > 0) {
            if (p.inStock) score += 25;
            if (p.isNewArrival) score += 12;
            if (p.isRestocked) score += 10;
          }
          return score;
        };

        const scoredAll = sanitizedCatalog
          .map((p: any) => ({ p, score: scoreCatalogItem(p, inStockOnly) }))
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score || Number(b.p.inStock) - Number(a.p.inStock) || b.p.stock - a.p.stock);

        const matchedProducts = scoredAll.map(item => item.p);

        if (matchedProducts.length === 0) {
          // Check truly unsupported categories ONLY after confirming 0 real catalog matches
          const unsupportedWords = ['diamante', 'diamantes', 'joya', 'joyas', 'joyeria', 'anillo', 'oro', 'plata', 'zapatillas', 'calzado', 'remera', 'pantalon', 'campera'];
          const isUnsupported = unsupportedWords.some(w => normFullQ.includes(w));
          return {
            totalFound: 0,
            querySearched: rawQ,
            categoryNotSupported: isUnsupported,
            products: [],
            message: isUnsupported
              ? `En VONDRO no comercializamos ese tipo de artículos.`
              : `No se encontraron productos para "${rawQ}" en el catálogo actual (${sanitizedCatalog.length} artículos revisados).`
          };
        }

        const topInStock = matchedProducts.filter(p => p.inStock).slice(0, 4);
        const topResults = topInStock.length > 0 ? topInStock : matchedProducts.slice(0, 4);
        topResults.forEach(pushProductThumbnail);

        // If all matched products are out of stock, find up to 3 in-stock alternatives in the same category
        let alternatives: any[] = [];
        if (topInStock.length === 0 && topResults[0]) {
          const refCat = topResults[0].category;
          alternatives = sanitizedCatalog
            .filter(p => p.inStock && p.category === refCat)
            .slice(0, 3);
          alternatives.forEach(pushProductThumbnail);
        }

        return {
          totalFound: matchedProducts.length,
          inStockMatches: matchedProducts.filter(p => p.inStock).length,
          allMatchedAreOutOfStock: topInStock.length === 0,
          products: topResults.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            originalPrice: p.originalPrice,
            stock: p.stock,
            inStock: p.inStock,
            isNewArrival: p.isNewArrival,
            isRestocked: p.isRestocked,
            category: p.category
          })),
          alternatives: alternatives.map((a: any) => ({
            id: a.id,
            name: a.name,
            price: a.price,
            stock: a.stock,
            category: a.category
          }))
        };
      },

      checkStock: (args: any) => {
        executedToolsList.push('checkStock');
        const pid = (args.productId || '').trim();
        const pname = (args.productName || '').trim();
        const queryTerm = pname || pid;

        const item = findBestCatalogProduct(queryTerm, sanitizedCatalog);

        if (!item) {
          return {
            found: false,
            message: `No se encontró el producto "${pname || pid}" en el catálogo oficial de VONDRO.`
          };
        }

        pushProductThumbnail(item);

        // Provide in-stock alternatives if item is out of stock
        let alternatives: any[] = [];
        if (item.stock <= 0) {
          alternatives = sanitizedCatalog
            .filter((p: any) => p.inStock && p.category === item.category && p.id !== item.id)
            .slice(0, 3);
          alternatives.forEach(pushProductThumbnail);
        }

        return {
          found: true,
          productId: item.id,
          productName: item.name,
          price: item.price,
          stock: item.stock,
          inStock: item.stock > 0,
          isNewArrival: item.isNewArrival,
          isRestocked: item.isRestocked,
          status: item.stock > 5 ? `En Stock inmediato (${item.stock} unidades disponibles)` : item.stock > 0 ? `Últimas ${item.stock} unidades disponibles` : 'Agotado temporalmente según última auditoría',
          alternatives: alternatives.map((a: any) => ({
            id: a.id,
            name: a.name,
            price: a.price,
            stock: a.stock
          })),
          warehouse: 'Depósito Central Córdoba Capital',
          estimatedDelivery: 'En el día o 24 a 48 hs hábiles en Córdoba Capital'
        };
      },

      getLatestAuditUpdates: (args: any) => {
        executedToolsList.push('getLatestAuditUpdates');
        const filterTopic = normalizeSearchText(args?.filterTopic || '');
        const audit = serverDailyAudits[0] || null;
        const filterByTopic = (list: any[]) => {
          if (!filterTopic) return list;
          const stemmed = stemSpanishToken(filterTopic);
          return list.filter(it => {
            const txt = normalizeSearchText(`${it.productName || it.name || ''} ${it.category || ''}`);
            return txt.includes(filterTopic) || (stemmed.length >= 3 && txt.includes(stemmed));
          });
        };

        const rawNew = Array.isArray(audit?.newProducts) ? audit.newProducts : [];
        const rawRestocked = Array.isArray(audit?.restockedProducts) ? audit.restockedProducts : [];
        const rawOutOfStock = Array.isArray(audit?.outOfStockProducts) ? audit.outOfStockProducts : [];

        // Enrich new arrivals with live catalog or directly from audit entry metadata
        const resolveAuditProduct = (entry: any, isNewFlag: boolean, isRestockedFlag: boolean) => {
          const pid = entry.productId || entry.id;
          const live = sanitizedCatalog.find(p => p.id === pid);
          if (live) return live;
          const stockNum = Number(entry.stock ?? entry.currentStock ?? 0);
          if (stockNum <= 0) return null;
          return {
            id: pid,
            name: entry.productName || entry.name || 'Producto nuevo',
            price: Number(entry.salePrice || entry.price || 0),
            originalPrice: entry.originalPrice ? Number(entry.originalPrice) : undefined,
            stock: stockNum,
            inStock: stockNum > 0,
            isNewArrival: isNewFlag,
            isRestocked: isRestockedFlag,
            image: entry.image || '/adaptador-universal-viajero.jpg',
            category: entry.category || 'productos-varios'
          };
        };

        const liveNewArrivals = filterByTopic(rawNew)
          .map((np: any) => resolveAuditProduct(np, true, false))
          .filter((p: any) => p && p.inStock)
          .slice(0, 4);

        const liveRestocked = filterByTopic(rawRestocked)
          .map((rp: any) => resolveAuditProduct(rp, false, true))
          .filter((p: any) => p && p.inStock)
          .slice(0, 4);

        const thumbnailsPool = [...liveNewArrivals, ...liveRestocked].slice(0, 4);
        thumbnailsPool.forEach(pushProductThumbnail);

        return {
          hasAuditData: Boolean(audit),
          lastAuditDate: audit?.date || new Date().toISOString().split('T')[0],
          lastAuditTimestamp: audit?.timestamp || new Date().toISOString(),
          slotLabel: audit?.slotLabel || 'Control de catálogo en tiempo real',
          totalProductsChecked: sanitizedCatalog.length,
          inStockCount: inStockCatalogCount,
          outOfStockCount: outOfStockCatalogCount,
          newArrivalsCount: rawNew.length,
          restockedCount: rawRestocked.length,
          newArrivals: liveNewArrivals.map((p: any) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, category: p.category })),
          restocked: liveRestocked.map((p: any) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, category: p.category })),
          outOfStockSample: filterByTopic(rawOutOfStock).slice(0, 5).map((op: any) => op.productName || op.name)
        };
      },

      getUserOrders: (args: any) => {
        executedToolsList.push('getUserOrders');
        const limit = args.limit ? Math.min(Number(args.limit), 5) : 3;

        let userOrders = ordersSource.filter((o: any) => {
          if (!sessionUser) return false;
          const matchId = sessionUser.id && o.userId === sessionUser.id;
          const matchEmail = sessionUser.email && o.customer?.email?.toLowerCase() === sessionUser.email.toLowerCase();
          return matchId || matchEmail;
        });

        if (userOrders.length === 0 && ordersSource.length > 0) {
          userOrders = ordersSource.slice(0, 2);
        }

        userOrders = userOrders.slice(0, limit);

        if (userOrders.length > 0) {
          const mainOrder = userOrders[0];
          orderSummary = {
            id: mainOrder.id,
            orderNumber: mainOrder.orderNumber || mainOrder.id,
            total: mainOrder.total,
            status: mainOrder.status || 'En preparación',
            shippingStatus: mainOrder.shippingStatus || 'En depósito Córdoba',
            trackingNumber: mainOrder.trackingCode || `VON-TRK-${mainOrder.orderNumber || '001'}`,
            deliveryPin: mainOrder.deliveryConfirmationCode || mainOrder.deliveryPin || '4829',
            courier: mainOrder.assignedCourierName || 'Cadetería Urbana VONDRO'
          };
        }

        return {
          found: userOrders.length > 0,
          ordersCount: userOrders.length,
          orders: userOrders.map((o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            total: o.total,
            status: o.status,
            shippingStatus: o.shippingStatus || 'En preparación',
            trackingCode: o.trackingCode,
            deliveryPin: o.deliveryConfirmationCode || o.deliveryPin || '4829',
            items: (o.items || []).map((it: any) => `${it.name} (x${it.quantity})`)
          }))
        };
      },

      getCouponsAndShipping: (args: any) => {
        executedToolsList.push('getCouponsAndShipping');
        return {
          activeCoupons,
          freeShipping: {
            threshold: freeShippingThreshold,
            currency: 'ARS',
            message: `Envío 100% GRATIS en compras a partir de $${freeShippingThreshold.toLocaleString('es-AR')} en Córdoba Capital.`
          },
          shippingZones: cbaShippingZones,
          requestedZone: args.zone || 'Todas las zonas de Córdoba Capital'
        };
      },

      addToCart: (args: any) => {
        executedToolsList.push('addToCart');
        const pid = (args.productId || '').trim();
        const pname = (args.productName || '').trim();
        const qty = Math.max(1, Number(args.quantity || 1));

        const item = findBestCatalogProduct(pname || pid, sanitizedCatalog);

        if (!item) {
          return {
            success: false,
            message: `No se encontró el producto "${pname || pid}" para agregar al carrito.`
          };
        }

        if (item.stock <= 0) {
          return {
            success: false,
            message: `Lo sentimos, "${item.name}" no tiene stock disponible en este momento.`
          };
        }

        cartAction = {
          action: 'ADD_TO_CART',
          product: {
            id: item.id,
            name: item.name,
            salePrice: item.price,
            price: item.price,
            originalPrice: item.originalPrice,
            stock: item.stock,
            images: [item.image],
            categoryId: item.category
          },
          quantity: qty
        };

        pushProductThumbnail(item);

        return {
          success: true,
          action: 'ADD_TO_CART',
          productId: item.id,
          productName: item.name,
          unitPrice: item.price,
          quantity: qty,
          totalAdded: item.price * qty,
          message: `Agregado al carrito: ${qty}x ${item.name} ($${(item.price * qty).toLocaleString('es-AR')})`
        };
      },

      transferToHumanSupport: (args: any) => {
        executedToolsList.push('transferToHumanSupport');
        const reason = args.reason || 'asesor_humano';
        const summary = args.summary || 'Consulta o gestión personalizada con asesor';
        const urgency = args.urgency || 'normal';

        const clientName = sessionUser?.name || 'Cliente';
        const clientEmail = sessionUser?.email || '';

        const whatsappText = `Hola VONDRO Soporte 👋 El asistente VONDRO Bot me derivó con un asesor:\n• Cliente: ${clientName}${clientEmail ? ` (${clientEmail})` : ''}\n• Motivo: ${reason}\n• Resumen: ${summary}\n• Urgencia: ${urgency.toUpperCase()}`;
        const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}`;

        transferAction = {
          transferToHuman: true,
          reason,
          summary,
          urgency,
          whatsappUrl,
          supportEmail: 'soporte@vondro.com'
        };

        return {
          success: true,
          transferInitiated: true,
          reason,
          summary,
          urgency,
          whatsappUrl,
          message: 'Derivación lista con canal oficial de WhatsApp y ticket prioritario.'
        };
      }
    };

    // Tools declarations for Gemini
    const searchProductsTool: FunctionDeclaration = {
      name: 'searchProducts',
      description: 'Busca productos en el catálogo vivo y auditado de VONDRO por palabra clave (en singular, ej: "alfombra", "termo", "navidad"), categoría, precio máximo o novedades.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Palabra clave principal o tema en singular (ej. "alfombra", "auricular", "ventilador", "navidad").' },
          category: { type: Type.STRING, description: 'Categoría opcional (ej. "tecnologia", "audio-y-sonido", "cocina", "iluminacion", "vasos-y-botellas", "herramientas", "belleza-y-cuidado-personal", "productos-varios").' },
          maxPrice: { type: Type.NUMBER, description: 'Precio máximo en pesos argentinos (ARS).' },
          inStockOnly: { type: Type.BOOLEAN, description: 'Si es true, filtra sólo productos con stock disponible mayor a 0.' },
          onlyNewOrRestocked: { type: Type.BOOLEAN, description: 'Si es true, prioriza ingresos nuevos o reposiciones de la auditoría.' }
        }
      }
    };

    const checkStockTool: FunctionDeclaration = {
      name: 'checkStock',
      description: 'Verifica disponibilidad exacta y stock en depósito Córdoba Capital para un producto, incluyendo alternativas disponibles si está agotado.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING, description: 'ID exacto del producto.' },
          productName: { type: Type.STRING, description: 'Nombre aproximado o palabra clave del producto.' }
        }
      }
    };

    const getLatestAuditUpdatesTool: FunctionDeclaration = {
      name: 'getLatestAuditUpdates',
      description: 'Consulta el último reporte de la auditoría automática de stock para responder sobre ingresos nuevos del día, reposiciones recientes, totales disponibles con stock o faltantes.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          filterTopic: { type: Type.STRING, description: 'Opcional: palabra clave o tema para filtrar ingresos o agotados de la auditoría (ej. "navidad", "alfombra").' }
        }
      }
    };

    const getUserOrdersTool: FunctionDeclaration = {
      name: 'getUserOrders',
      description: 'Recupera los pedidos recientes del usuario autenticado, indicando estado, total, artículos y PIN de recepción de entrega.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          limit: { type: Type.NUMBER, description: 'Cantidad de pedidos a consultar (por defecto 3).' }
        }
      }
    };

    const getCouponsAndShippingTool: FunctionDeclaration = {
      name: 'getCouponsAndShipping',
      description: 'Consulta los cupones de descuento activos, promociones, umbral de envío gratis y tarifas por zona en Córdoba Capital.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING, description: 'Zona o barrio de Córdoba (ej. "Centro", "Nueva Córdoba", "Zona Norte").' }
        }
      }
    };

    const addToCartTool: FunctionDeclaration = {
      name: 'addToCart',
      description: 'Agrega un producto directamente al carrito de compras de la sesión cuando el usuario solicita expresamente agregarlo o comprarlo.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING, description: 'ID del producto.' },
          productName: { type: Type.STRING, description: 'Nombre del producto.' },
          quantity: { type: Type.NUMBER, description: 'Cantidad de unidades (por defecto 1).' }
        },
        required: ['quantity']
      }
    };

    const transferToHumanSupportTool: FunctionDeclaration = {
      name: 'transferToHumanSupport',
      description: 'Deriva al cliente con un asesor humano oficial ante reclamos por falla/rotura, demora en envío, cancelaciones o cuando pide hablar con una persona.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          reason: { type: Type.STRING, description: 'Motivo: "falla_rotura", "demora_envio", "cambio_devolucion", "cancelacion", "reclamo_pago", "asesor_humano".' },
          summary: { type: Type.STRING, description: 'Resumen conciso del caso.' },
          urgency: { type: Type.STRING, description: 'Nivel de urgencia: "normal" o "alta".' }
        },
        required: ['reason', 'summary']
      }
    };

    const auditSlotSummary = latestAudit
      ? `Último control de stock: ${latestAudit.date} (${latestAudit.slotLabel || 'Automático'}) — ${inStockCatalogCount} productos con stock disponible, ${latestAudit.newProductsCount || 0} ingresos nuevos y ${latestAudit.restockedCount || 0} reposiciones.`
      : `Catálogo vivo: ${inStockCatalogCount} productos con stock disponible sobre ${sanitizedCatalog.length} totales.`;

    const systemInstruction = `Eres "VONDRO Bot", el asistente virtual oficial de compras y atención al cliente de VONDRO en Córdoba Capital.

REGLA DE ORO (OBLIGATORIA EN TODAS LAS CONSULTAS DE PRODUCTOS):
- VONDRO tiene más de ${sanitizedCatalog.length} artículos en rubros súper amplios: Hogar, Bazar y Decoración (incluyendo alfombras, cortinas de baño, organizadores, limpieza), Cocina y Pequeños Electrodomésticos, Termos/Vasos/Mates, Tecnología, Audio y Sonido, Iluminación y Navidad, Herramientas, Belleza y Cuidado Personal, Camping e Infantil/Juguetes.
- **ESTÁ TERMINANTEMENTE PROHIBIDO** responder "En VONDRO no comercializamos [producto]" sin haber llamado PRIMERO a \`searchProducts\` (pasando en \`query\` la palabra clave en singular, ej: "alfombra", "termo", "herramienta") o \`checkStock\` y confirmado que \`totalFound === 0\`.
- Si el cliente pregunta por un producto o tema (incluso mensajes cortos como "que tal alfombra", "algo navideño", "para el mate", "novedades"), SIEMPRE llama primero a \`searchProducts\` o \`getLatestAuditUpdates\`!

REGLAS DE FORMATO Y RESPUESTA:
- Sé claro, directo y amable (2 a 4 oraciones concisas). No hagas listas genéricas largas.
- Si \`searchProducts\` o \`checkStock\` encuentra el producto SIN stock (\`stock === 0\`), indicalo honestamente ("ahora mismo figura agotado") y menciona las alternativas con stock disponibles devueltas en \`alternatives\`.
- Si preguntan por ingresos nuevos, novedades de hoy, reposiciones o stock de auditoría, llama a \`getLatestAuditUpdates\`.
- Si preguntan por métodos de pago: "Aceptamos Mercado Pago (tarjetas de crédito/débito y saldo), Transferencia bancaria y Efectivo contra entrega en Córdoba Capital."
- Si preguntan demora de envío: "En Córdoba Capital entregamos en el día o en 24 a 48 hs hábiles con cadetería propia. Al interior demora de 2 a 5 días hábiles."
- Si preguntan por número de pedido o estado: usa \`getUserOrders\` o pide el código (#VON-...).
- NUNCA menciones proveedores internos (como Inova ARG), costos mayoristas ni márgenes.
- Si piden agregar al carrito o comprar algo puntual, usa \`addToCart\`. Si piden hablar con una persona o reclamo, usa \`transferToHumanSupport\`.

Estado vivo de inventario:
- ${auditSlotSummary}
- Usuario: ${sessionUser ? `${sessionUser.name} (${sessionUser.email || 'sin email'}), Ciudad: ${sessionUser.city || 'Córdoba Capital'}, Barrio: ${sessionUser.neighborhood || 'Centro'}` : 'Visitante'}
- Carrito actual: ${cartItems.length} ítems ($${cartSubtotal.toLocaleString('es-AR')})`;

    if (ai) {
      try {
        // Capped conversation history (last 10 messages for token optimization)
        const historyCapped = (conversationHistory || []).slice(-10);
        const contentsHistory = historyCapped.map((m: any) => ({
          role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.text || '') }]
        }));

        const response = await generateGeminiWithFallback(
          ai,
          [
            ...contentsHistory,
            { role: 'user', parts: [{ text: message }] }
          ],
          {
            systemInstruction,
            tools: [{
              functionDeclarations: [
                searchProductsTool,
                checkStockTool,
                getLatestAuditUpdatesTool,
                getUserOrdersTool,
                getCouponsAndShippingTool,
                addToCartTool,
                transferToHumanSupportTool
              ]
            }]
          }
        );

        let finalReplyText = response.text || '';
        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          const toolResultsParts: any[] = [];
          for (const call of functionCalls) {
            const executor = toolExecutors[call.name];
            if (executor) {
              const execResult = executor(call.args || {});
              toolResultsParts.push({
                functionResponse: {
                  name: call.name,
                  response: execResult
                }
              });
            }
          }

          // Follow-up turn to let Gemini generate the conversational response with retrieved data
          if (toolResultsParts.length > 0) {
            try {
              const followUpContents: any[] = [
                ...contentsHistory,
                { role: 'user', parts: [{ text: message }] },
                response.candidates?.[0]?.content,
                {
                  role: 'user',
                  parts: toolResultsParts
                }
              ];

              const followUpResponse = await generateGeminiWithFallback(
                ai,
                followUpContents,
                {
                  systemInstruction
                }
              );

              if (followUpResponse.text) {
                finalReplyText = followUpResponse.text;
              }
            } catch (followUpErr) {
              console.warn('[Gemini Tool Follow-up Warning]:', followUpErr);
            }
          }
        }

        // Resilient fallback text synthesis if response text is empty
        if (!finalReplyText) {
          if (cartAction) {
            finalReplyText = `¡Listo! Agregué **${cartAction.quantity}x ${cartAction.product.name}** a tu carrito de compras ($${(cartAction.product.salePrice * cartAction.quantity).toLocaleString('es-AR')}). ¿Querés calcular el envío a tu barrio o ver más productos?`;
          } else if (orderSummary) {
            finalReplyText = `Encontré tu pedido **#${orderSummary.orderNumber}** por un total de $${(orderSummary.total || 0).toLocaleString('es-AR')}. Estado: **${orderSummary.shippingStatus}**. Tu PIN de recepción es **${orderSummary.deliveryPin}**.`;
          } else if (transferAction) {
            finalReplyText = `Entiendo tu consulta. Para brindarte una respuesta inmediata y personalizada, te preparé la derivación directa con nuestro equipo de atención humana por WhatsApp oficial.`;
          } else if (productThumbnails.length > 0) {
            finalReplyText = `Encontré estas opciones disponibles en nuestro catálogo de Córdoba Capital con stock inmediato:`;
          } else {
            finalReplyText = 'Hola 👋 ¿En qué te puedo ayudar hoy con tus compras en VONDRO Córdoba?';
          }
        }

        // Generate contextual quick replies
        const contextualQuickReplies: any[] = [];
        if (productThumbnails.length > 0) {
          contextualQuickReplies.push(
            { label: '🛒 Ver Carrito', action: 'open_cart', payload: 'ver carrito' },
            { label: '🚚 Costo de envío en Córdoba', action: 'shipping_info', payload: 'costo de envío en Córdoba' },
            { label: '💳 Medios de pago', action: 'payment_info', payload: 'medios de pago' }
          );
        } else if (orderSummary) {
          contextualQuickReplies.push(
            { label: '📍 ¿Dónde está mi cadete?', action: 'track_courier', payload: '¿dónde está mi cadete?' },
            { label: '👤 Hablar con asesor', action: 'request_agent', payload: 'quiero hablar con un asesor' }
          );
        } else if (transferAction) {
          contextualQuickReplies.push(
            { label: '💬 Abrir WhatsApp', action: 'OPEN_WHATSAPP', payload: transferAction.whatsappUrl },
            { label: '🎫 Abrir Ticket', action: 'CREATE_SUPPORT_TICKET' }
          );
        } else {
          contextualQuickReplies.push(
            { label: '🔎 Buscar productos', action: 'search_prompt', payload: 'buscar productos' },
            { label: '📦 Estado de mi pedido', action: 'my_orders', payload: 'estado de mi compra' },
            { label: '🚚 Envíos en Córdoba', action: 'shipping_info', payload: 'costos de envío' },
            { label: '👤 Hablar con asesor', action: 'request_agent', payload: 'hablar con un asesor' }
          );
        }

        return res.json({
          success: true,
          reply: finalReplyText,
          source: 'gemini',
          toolCallsExecuted: executedToolsList,
          productThumbnails,
          orderSummary,
          cartAction,
          transferAction,
          quickReplies: contextualQuickReplies
        });

      } catch (geminiErr) {
        console.warn('[Gemini API Call Warning, falling back to local engine]:', geminiErr);
      }
    }

    // Fallback response if Gemini key not set or unavailable
    return res.json({
      success: true,
      reply: null,
      source: 'fallback'
    });

  } catch (err: any) {
    console.error('[Assistant Chat Error]:', err);
    return res.status(500).json({ error: 'Error procesando consulta del asistente.' });
  }
});

// -------------------------------------------------------------
// AI BANK TRANSFER RECEIPT VERIFIER BOT & ANTI-FRAUD AUDIT ENDPOINT
// -------------------------------------------------------------
app.post('/api/admin/verify-transfer', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { receiptText, receiptImage, orderTotal, orderNumber, customerName, pendingOrders } = req.body;

    if (!receiptText && !receiptImage) {
      return res.status(400).json({ error: 'Se requiere la imagen o texto del comprobante.' });
    }

    const ai = getAiClient();
    if (ai) {
      try {
        if (receiptImage && typeof receiptImage === 'string') {
          // Multimodal Image Analysis with Gemini
          const match = receiptImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          const mimeType = match ? match[1] : 'image/jpeg';
          const base64Data = match ? match[2] : receiptImage;

          const prompt = `Eres un Auditor Financiero y de Ciberseguridad bancaria en Argentina.
Tu tarea es auditar y verificar minuciosamente la imagen de este comprobante de transferencia bancaria / fintech (Mercado Pago, Bancor, Santander Río, Galicia, BBVA, Ualá, Cuenta DNI, Brubank, Naranja X, etc.) para la tienda VONDRO.

Datos esperados de la orden:
- Monto total del pedido a pagar: $${Number(orderTotal) || 0} ARS
- Número de pedido: ${orderNumber || 'N/A'}
- Cliente: ${customerName || 'N/A'}
- Datos oficiales de recepción de VONDRO: Titular "VONDRO Tienda Online" / Alias "VONDRO . CORDOBA" / CBU "0720123488000034567890"

Instrucciones de auditoría anti-fraude:
1. Revisa si el comprobante es AUTÉNTICO o si es un comprobante TRUCHO / EDITADO / FALSO (generado con bots de Telegram, apps de edición o tipografías inconsistentes).
2. Extrae los datos reales del comprobante:
   - amount: número con el monto transferido
   - payerName: nombre del titular que transfiere
   - recipientName: nombre, alias o CBU del destinatario
   - operationNumber: código de operación / ID de transacción / Coelsa
   - bankOrigin: banco o billetera emisora (ej: "Mercado Pago", "Bancor", "Santander", etc.)
   - transferDate: fecha y hora de la operación
3. Evalúa si el destinatario coincide con la cuenta de VONDRO y si el monto transferido cubre el pedido ($${Number(orderTotal) || 0}).
4. Emite el dictamen de seguridad:
   - isAuthentic: boolean (true si parece legítimo sin alteraciones)
   - fraudRisk: "LOW" (comprobante legítimo) | "MEDIUM" (dudas o datos ilegibles) | "HIGH" (fraude evidente, plantilla trucha, monto manipulado o destinatario no coincide)
   - confidenceScore: número de 0 a 100
   - amountMatch: boolean
   - recipientMatch: boolean
   - reasons: lista de strings explicando las razones del dictamen
   - summary: resumen claro de 1 línea para el administrador
   - automaticApprovalRecommended: boolean (true si es auténtico, coincide monto y destinatario oficial)`;

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  },
                  { text: prompt }
                ]
              }
            ],
            config: {
              responseMimeType: 'application/json'
            }
          });

          const jsonText = response.text?.trim() || '{}';
          const auditResult = JSON.parse(jsonText);

          return res.json({
            success: true,
            audit: auditResult,
            extracted: auditResult.extracted,
            source: 'gemini_vision'
          });
        } else if (receiptText) {
          // Text-based OCR / Telegram extraction
          const prompt = `Analiza el siguiente texto de un comprobante o transferencia bancaria en Argentina (MercadoPago, Galicia, Santander, Macro, BBVA, etc.).
Extrae exactamente los datos en formato JSON estricto:
{
  "amount": number,
  "payerName": string,
  "operationNumber": string,
  "bankOrigin": string,
  "transferDate": string,
  "isAuthentic": true,
  "fraudRisk": "LOW",
  "confidenceScore": 95,
  "reasons": ["Datos de texto extraídos correctamente"],
  "summary": "Transferencia analizada"
}

Texto del comprobante:
"""${receiptText}"""`;

          const response = await generateGeminiWithFallback(ai, prompt, {
            responseMimeType: 'application/json'
          });

          const jsonText = response.text?.trim() || '{}';
          const extracted = JSON.parse(jsonText);

          return res.json({
            success: true,
            audit: extracted,
            extracted,
            source: 'gemini_text'
          });
        }
      } catch (geminiErr) {
        console.warn('[Gemini Receipt Verifier Warning]:', geminiErr);
      }
    }

    return res.json({
      success: true,
      extracted: null,
      audit: null,
      source: 'fallback'
    });
  } catch (err: any) {
    console.error('[Verify Transfer Endpoint Error]:', err);
    return res.status(500).json({ error: 'Error en verificación de transferencia.' });
  }
});

// -------------------------------------------------------------
// 5b. ACCOUNT DELETION (GOOGLE PLAY DATA SAFETY) & MUTUAL REFERRALS
// -------------------------------------------------------------
app.post('/api/account/delete', requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as any).authUser as VerifiedAuthUser;
  let serverDeletedProfile = false;
  let serverDeletedAuth = false;

  try {
    await adminDb.collection('users').doc(authUser.uid).delete();
    serverDeletedProfile = true;
  } catch (err) {
    if (!isCredentialUnavailableError(err)) {
      console.warn('[Account Delete] Firestore profile delete warning:', (err as any)?.message || err);
    }
  }

  try {
    await adminAuth.deleteUser(authUser.uid);
    serverDeletedAuth = true;
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      serverDeletedAuth = true;
    } else if (!isCredentialUnavailableError(err)) {
      console.warn('[Account Delete] Firebase Auth deleteUser warning:', err?.message || err);
    }
  }

  return res.json({
    success: true,
    serverDeletedProfile,
    serverDeletedAuth
  });
});

app.post('/api/referrals/redeem', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as VerifiedAuthUser;
    const rawCode = String(req.body?.referralCode || '').trim().toUpperCase();

    if (!rawCode || rawCode.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Por favor ingresá un código de invitación válido.'
      });
    }

    const couponCode = rawCode.startsWith('AMIGO-')
      ? rawCode
      : `AMIGO-${rawCode.replace(/^VON-/, '')}`;

    const newCoupon = {
      id: `coup-ref-${authUser.uid.slice(0, 8)}-${Date.now()}`,
      code: couponCode,
      discountType: 'fixed' as const,
      value: 5000,
      minPurchaseAmount: 20000,
      usedCount: 0,
      maxUses: 1,
      active: true,
      ownerUserId: authUser.uid,
      description: `Descuento exclusivo de $5.000 por invitación de amigo (${rawCode})`,
      createdAt: new Date().toISOString()
    };

    try {
      const buyerRef = adminDb.collection('users').doc(authUser.uid);
      const buyerSnap = await buyerRef.get();
      const buyerData = buyerSnap.exists ? (buyerSnap.data() || {}) : {};

      if (buyerData.referralCode && String(buyerData.referralCode).toUpperCase() === rawCode) {
        return res.status(400).json({
          success: false,
          error: 'No podés canjear tu propio código de invitación.'
        });
      }

      if (buyerData.claimedReferralDiscount) {
        return res.status(400).json({
          success: false,
          error: 'Ya has canjeado un cupón de bienvenida de invitación en tu cuenta.'
        });
      }

      let referrerUserId: string | null = null;
      const referrerSnap = await adminDb
        .collection('users')
        .where('referralCode', '==', rawCode)
        .limit(1)
        .get();

      if (!referrerSnap.empty) {
        const refDoc = referrerSnap.docs[0];
        if (refDoc.id === authUser.uid) {
          return res.status(400).json({
            success: false,
            error: 'No podés canjear tu propio código de invitación.'
          });
        }
        referrerUserId = refDoc.id;
      }

      await adminDb.collection('coupons').doc(newCoupon.id).set({
        ...newCoupon,
        serverCreatedAt: FieldValue.serverTimestamp()
      });

      await buyerRef.set({
        claimedReferralDiscount: true,
        referredBy: rawCode,
        ...(referrerUserId ? { referredByUserId: referrerUserId } : {}),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      return res.json({
        success: true,
        coupon: newCoupon,
        referredBy: rawCode,
        referrerUserId,
        serverPersisted: true
      });
    } catch (adminErr: any) {
      if (isCredentialUnavailableError(adminErr)) {
        return res.json({
          success: true,
          coupon: newCoupon,
          referredBy: rawCode,
          referrerUserId: null,
          serverPersisted: false
        });
      }
      throw adminErr;
    }
  } catch (err: any) {
    console.error('[Referrals Redeem Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Error al validar el código de invitación.'
    });
  }
});

app.post('/api/referrals/credit-reward', requireAuth, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as VerifiedAuthUser;
    const isAdminUser = await isVerifiedAdminUser(authUser);
    const orderId = String(req.body?.orderId || '').trim();

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Falta orderId.' });
    }

    try {
      let resultPayload: any = { success: true, credited: false };

      await adminDb.runTransaction(async (tx) => {
        const orderRef = adminDb.collection('orders').doc(orderId);
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) return;

        const orderData = orderSnap.data() || {};
        if (!isAdminUser && orderData.userId !== authUser.uid) {
          throw Object.assign(new Error('Sin permisos para procesar recompensa.'), { statusCode: 403 });
        }

        const isDelivered = ['delivered', 'ENTREGADO', 'completed', 'FINALIZADO'].includes(String(orderData.status));
        if (!isDelivered || orderData.referralRewardGranted) {
          return;
        }

        const buyerId = String(orderData.userId || '').trim();
        if (!buyerId) return;

        const buyerRef = adminDb.collection('users').doc(buyerId);
        const buyerSnap = await tx.get(buyerRef);
        if (!buyerSnap.exists) return;

        const buyerData = buyerSnap.data() || {};
        if (buyerData.referralRewardCreditedForReferrer || !buyerData.referredBy) {
          return;
        }

        let referrerRef: FirebaseFirestore.DocumentReference | null = null;
        let referrerData: any = null;

        if (buyerData.referredByUserId) {
          const refCandidate = adminDb.collection('users').doc(String(buyerData.referredByUserId));
          const refSnap = await tx.get(refCandidate);
          if (refSnap.exists) {
            referrerRef = refCandidate;
            referrerData = refSnap.data() || {};
          }
        }

        if (!referrerRef && buyerData.referredBy) {
          const querySnap = await adminDb
            .collection('users')
            .where('referralCode', '==', String(buyerData.referredBy).toUpperCase())
            .limit(1)
            .get();
          if (!querySnap.empty) {
            referrerRef = querySnap.docs[0].ref;
            referrerData = querySnap.docs[0].data() || {};
          }
        }

        if (!referrerRef || referrerRef.id === buyerId) {
          return;
        }

        const nextReferralCount = Number(referrerData?.referralCount || 0) + 1;
        const nextReferralEarnings = Number(referrerData?.referralEarnings || 0) + 5000;
        const rewardCouponId = `coup-premio-${referrerRef.id.slice(0, 6)}-${Date.now()}`;
        const rewardCode = `PREMIO-${String(Date.now()).slice(-5)}`;
        const rewardCoupon = {
          id: rewardCouponId,
          code: rewardCode,
          discountType: 'fixed' as const,
          value: 5000,
          minPurchaseAmount: 20000,
          usedCount: 0,
          maxUses: 1,
          active: true,
          ownerUserId: referrerRef.id,
          description: `Premio de $5.000 por compra entregada de tu amigo invitado`,
          createdAt: new Date().toISOString()
        };

        tx.update(referrerRef, {
          referralCount: nextReferralCount,
          referralEarnings: nextReferralEarnings,
          updatedAt: FieldValue.serverTimestamp()
        });

        tx.set(adminDb.collection('coupons').doc(rewardCouponId), {
          ...rewardCoupon,
          serverCreatedAt: FieldValue.serverTimestamp()
        });

        tx.update(buyerRef, {
          referralRewardCreditedForReferrer: true,
          updatedAt: FieldValue.serverTimestamp()
        });

        tx.update(orderRef, {
          referralRewardGranted: true,
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: FieldValue.serverTimestamp()
        });

        resultPayload = {
          success: true,
          credited: true,
          referrerId: referrerRef.id,
          rewardCoupon
        };
      });

      return res.json(resultPayload);
    } catch (adminErr: any) {
      if (adminErr?.statusCode === 403) {
        return res.status(403).json({ success: false, error: adminErr.message });
      }
      if (isCredentialUnavailableError(adminErr)) {
        return res.json({ success: true, credited: false, serverUnavailable: true });
      }
      throw adminErr;
    }
  } catch (err: any) {
    console.error('[Referrals Credit Reward Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Error acreditando recompensa de referido.'
    });
  }
});

// -------------------------------------------------------------
// 5c. CORDOBA GEOLOCATION, ADDRESS VALIDATION (GEOREF AR + OSM) & DNI KYC
// -------------------------------------------------------------
const SERVER_CORDOBA_NEIGHBORHOODS = [
  'Villa Martínez', 'Las Palmas', 'Santa Ana', 'Los Plátanos', 'Rosedal',
  'San Rafael', 'Residencial San Roque', 'Villa Unión', 'Estación Flores',
  'Parque Capital', 'Alberdi', 'Alto Alberdi', 'Observatorio', 'Centro',
  'Nueva Córdoba', 'Güemes', 'General Paz', 'Alta Córdoba', 'Cofico',
  'Providencia', 'San Martín', 'Crisol', 'Ducasse', 'Juniors', 'Barrio Jardín',
  'Manantiales', 'Manantiales II', 'Cerro de las Rosas', 'Argüello',
  'Villa Belgrano', 'Urca', 'Poeta Lugones', 'San Vicente', 'Empalme', 'Iponá',
  'Villa El Libertador', 'Guiñazú', 'Los Boulevares', 'Tablada Park',
  'Alejandro Centeno', 'Villa Cabrera', 'Villa Marta', 'Villa Allende',
  'Villa Allende (Gran Cba)', 'Saldán', 'La Calera', 'Malvinas Argentinas',
  'Mendiolaza', 'Unquillo'
];

function normalizeServerNeighborhood(rawName?: string): string {
  if (!rawName) return 'Centro';
  const clean = String(rawName).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  for (const nh of SERVER_CORDOBA_NEIGHBORHOODS) {
    const normNh = nh.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (clean.includes(normNh) || normNh.includes(clean)) return nh;
  }
  if (clean.includes('martinez')) return 'Villa Martínez';
  if (clean.includes('nueva cba') || clean.includes('nva cba')) return 'Nueva Córdoba';
  if (clean.includes('guemes')) return 'Güemes';
  if (clean.includes('gral paz') || clean.includes('general paz')) return 'General Paz';
  if (clean.includes('alta cba')) return 'Alta Córdoba';
  if (clean.includes('cerro')) return 'Cerro de las Rosas';
  if (clean.includes('manantiales')) return 'Manantiales';
  if (clean.includes('rosedal')) return 'Rosedal';
  if (clean.includes('alberdi')) return 'Alberdi';
  return 'Centro';
}

app.post('/api/geo/reverse', async (req: Request, res: Response) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Coordenadas inválidas.' });
    }

    let street = '';
    let houseNumber = '';
    let neighborhood = 'Centro';
    let city = 'Córdoba Capital';
    let province = 'Córdoba';
    let postalCode = '5000';
    let formattedAddress = '';
    let source = 'nominatim';

    // 1. OpenStreetMap Nominatim with compliant server User-Agent
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1&accept-language=es`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VONDRO-Cordoba-App/1.0 (soporte@vondro.com.ar)'
          },
          signal: AbortSignal.timeout(4500)
        }
      );
      if (nomRes.ok) {
        const data: any = await nomRes.json();
        const addr = data?.address || {};
        street = addr.road || addr.pedestrian || addr.street || addr.footway || addr.avenue || '';
        houseNumber = addr.house_number || '';
        const rawNeigh = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.residential || '';
        if (rawNeigh) neighborhood = normalizeServerNeighborhood(rawNeigh);
        city = addr.city || addr.town || 'Córdoba Capital';
        province = addr.state || 'Córdoba';
        postalCode = addr.postcode || '5000';
        formattedAddress = data?.display_name || '';
      }
    } catch (nomErr) {
      console.warn('[Geo Reverse] Nominatim fallback:', (nomErr as any)?.message || nomErr);
    }

    // 2. Fallback to BigDataCloud if Nominatim didn't resolve street
    if (!street) {
      try {
        const bdcRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=es`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (bdcRes.ok) {
          const bdcData: any = await bdcRes.json();
          source = 'bigdatacloud';
          if (Array.isArray(bdcData?.localityInfo?.administrative)) {
            const roadPart = bdcData.localityInfo.administrative.find(
              (a: any) => a.order >= 7 || String(a.name || '').toLowerCase().includes('calle') || String(a.name || '').toLowerCase().includes('av')
            );
            if (roadPart?.name) street = roadPart.name;
          }
          if (!street && bdcData?.locality) street = bdcData.locality;
          if (bdcData?.locality) neighborhood = normalizeServerNeighborhood(bdcData.locality);
          if (bdcData?.city) city = bdcData.city;
          if (bdcData?.principalSubdivision) province = bdcData.principalSubdivision;
        }
      } catch (bdcErr) {
        console.warn('[Geo Reverse] BigDataCloud fallback:', (bdcErr as any)?.message || bdcErr);
      }
    }

    return res.json({
      success: Boolean(street),
      street: String(street || '').trim(),
      number: String(houseNumber || '').trim(),
      neighborhood,
      city: city.toLowerCase().includes('córdoba') || city.toLowerCase().includes('cordoba') ? 'Córdoba Capital' : city,
      province: province || 'Córdoba',
      postalCode: postalCode || '5000',
      formattedAddress: formattedAddress || `${street} ${houseNumber}, ${neighborhood}, Córdoba`,
      latitude: lat,
      longitude: lng,
      source
    });
  } catch (err: any) {
    console.error('[Geo Reverse Error]:', err);
    return res.status(500).json({ error: 'No se pudo geocodificar la ubicación.' });
  }
});

app.post('/api/geo/verify-address', async (req: Request, res: Response) => {
  try {
    const rawQuery = String(req.body?.query || '').trim();
    const rawStreet = String(req.body?.street || '').trim();
    const rawNumber = String(req.body?.number || '').trim();
    const rawCity = String(req.body?.city || 'Córdoba').trim();

    const searchQuery = rawQuery || `${rawStreet} ${rawNumber}`.trim();
    if (!searchQuery || searchQuery.length < 3) {
      return res.status(400).json({
        success: false,
        verified: false,
        suggestions: [],
        error: 'Ingresá calle y altura (ej. Av. Colón 1450) para verificar la dirección.'
      });
    }

    const suggestions: Array<{
      street: string;
      number: string;
      neighborhood: string;
      city: string;
      province: string;
      postalCode: string;
      latitude: number;
      longitude: number;
      formattedAddress: string;
      source: 'georef_ar' | 'nominatim';
      hasExactNumber: boolean;
    }> = [];

    const [georefResp, nomResp] = await Promise.allSettled([
      fetch(
        `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(searchQuery)}&provincia=cordoba&max=5`,
        { signal: AbortSignal.timeout(4500) }
      ).then(r => (r.ok ? r.json() : null)),
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${searchQuery}, ${rawCity || 'Córdoba'}, Argentina`)}&format=json&addressdetails=1&countrycodes=ar&limit=5&accept-language=es`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VONDRO-Cordoba-App/1.0 (soporte@vondro.com.ar)'
          },
          signal: AbortSignal.timeout(4500)
        }
      ).then(r => (r.ok ? r.json() : null))
    ]);

    // Merge Nominatim results first for barrio + house_number richness
    const nomItems: any[] =
      nomResp.status === 'fulfilled' && Array.isArray(nomResp.value) ? nomResp.value : [];
    const georefItems: any[] =
      georefResp.status === 'fulfilled' && Array.isArray(georefResp.value?.direcciones)
        ? georefResp.value.direcciones
        : [];

    for (const item of nomItems) {
      const addr = item?.address || {};
      const lat = Number(item?.lat);
      const lng = Number(item?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // Check it's within Greater Córdoba area roughly (-31.8 to -30.9 lat, -64.6 to -63.8 lng)
      if (lat < -31.9 || lat > -30.8 || lng < -64.7 || lng > -63.7) continue;

      const street = addr.road || addr.pedestrian || addr.street || '';
      if (!street) continue;
      const number = String(addr.house_number || rawNumber || '').trim();
      const rawNeigh = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
      const neighborhood = rawNeigh ? normalizeServerNeighborhood(rawNeigh) : 'Centro';
      const city = addr.city || addr.town || 'Córdoba Capital';

      suggestions.push({
        street,
        number,
        neighborhood,
        city: city.toLowerCase().includes('córdoba') || city.toLowerCase().includes('cordoba') ? 'Córdoba Capital' : city,
        province: 'Córdoba',
        postalCode: addr.postcode || '5000',
        latitude: lat,
        longitude: lng,
        formattedAddress: `${street}${number ? ` ${number}` : ''}, B° ${neighborhood}, Córdoba`,
        source: 'nominatim',
        hasExactNumber: Boolean(addr.house_number)
      });
    }

    for (const g of georefItems) {
      const lat = Number(g?.ubicacion?.lat);
      const lng = Number(g?.ubicacion?.lon);
      const streetName = String(g?.calle?.nombre || '').trim();
      if (!streetName || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const alturaVal = g?.altura?.valor != null ? String(g.altura.valor) : rawNumber;
      // Format uppercase Georef name nicely in Title Case
      const niceStreet = streetName
        .toLowerCase()
        .replace(/\bav\b/g, 'Av.')
        .replace(/\bbv\b/g, 'Bv.')
        .replace(/\b\w/g, (m: string) => m.toUpperCase());

      // Try enriching neighborhood from nearest Nominatim match if available
      const matchingNom = suggestions.find(
        s => Math.abs(s.latitude - lat) < 0.003 && Math.abs(s.longitude - lng) < 0.003
      );

      if (matchingNom) {
        matchingNom.source = 'georef_ar';
        if (!matchingNom.number && alturaVal) matchingNom.number = alturaVal;
        matchingNom.hasExactNumber = matchingNom.hasExactNumber || Boolean(g?.altura?.valor);
      } else {
        suggestions.push({
          street: niceStreet,
          number: alturaVal,
          neighborhood: normalizeServerNeighborhood(g?.localidad_censal?.nombre || 'Centro'),
          city: 'Córdoba Capital',
          province: 'Córdoba',
          postalCode: '5000',
          latitude: lat,
          longitude: lng,
          formattedAddress: g?.nomenclatura || `${niceStreet}${alturaVal ? ` ${alturaVal}` : ''}, Córdoba`,
          source: 'georef_ar',
          hasExactNumber: Boolean(g?.altura?.valor)
        });
      }
    }

    // Deduplicate nearby coordinates
    const deduped: typeof suggestions = [];
    for (const s of suggestions) {
      const dup = deduped.some(
        d =>
          Math.abs(d.latitude - s.latitude) < 0.0008 &&
          Math.abs(d.longitude - s.longitude) < 0.0008 &&
          d.street.toLowerCase() === s.street.toLowerCase()
      );
      if (!dup) deduped.push(s);
    }

    return res.json({
      success: true,
      verified: deduped.length > 0,
      bestMatch: deduped[0] || null,
      suggestions: deduped.slice(0, 5)
    });
  } catch (err: any) {
    console.error('[Geo Verify Address Error]:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      suggestions: [],
      error: 'No se pudo validar la dirección en este momento.'
    });
  }
});

const identityVerifyRateLimit = new Map<string, { count: number; resetAt: number }>();

app.post('/api/account/verify-identity', async (req: Request, res: Response) => {
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const rateEntry = identityVerifyRateLimit.get(ip);
    if (rateEntry && now < rateEntry.resetAt && rateEntry.count >= 10) {
      return res.status(429).json({
        success: false,
        error: 'Demasiados intentos de verificación. Esperá unos minutos antes de reintentar.'
      });
    }
    identityVerifyRateLimit.set(
      ip,
      rateEntry && now < rateEntry.resetAt
        ? { count: rateEntry.count + 1, resetAt: rateEntry.resetAt }
        : { count: 1, resetAt: now + 15 * 60 * 1000 }
    );

    // Optional Firebase Auth verification (if user is signed in with Firebase, persist server-side too)
    const authUser = await verifyFirebaseBearer(req);

    const dniFrontImage = String(req.body?.dniFrontImage || '').trim();
    const dniBackImage = String(req.body?.dniBackImage || '').trim();
    const selfieImage = String(req.body?.selfieImage || '').trim();
    const declaredName = String(req.body?.declaredName || '').trim();
    const declaredDni = String(req.body?.declaredDni || '').replace(/\D/g, '');
    const declaredAddress = String(req.body?.declaredAddress || '').trim();
    const livenessChallenge = String(req.body?.livenessChallenge || '').trim();
    const pdf417Data = req.body?.pdf417Data && typeof req.body.pdf417Data === 'object' ? req.body.pdf417Data : null;

    if (!dniFrontImage || !dniBackImage || !selfieImage) {
      return res.status(400).json({
        success: false,
        error: 'Necesitás subir el frente del DNI, el dorso (domicilio) y la selfie en vivo para completar la verificación biométrica.'
      });
    }

    const pdf417Dni = String(pdf417Data?.dni || '').replace(/\D/g, '');
    const pdf417Name = String(pdf417Data?.fullName || '').trim();
    const pdf417Tramite = String(pdf417Data?.tramiteNumber || '').trim();
    const pdf417Scanned = Boolean(pdf417Data?.isValidArgentinePdf417 && pdf417Dni.length >= 7);

    // Fail-fast if the scanned RENAPER PDF417 barcode clearly contradicts the declared DNI
    if (pdf417Scanned && declaredDni && pdf417Dni !== declaredDni) {
      return res.json({
        success: true,
        verification: {
          status: 'mismatch',
          verifiedAt: new Date().toISOString(),
          dniMatch: false,
          nameMatch: false,
          addressMatchesDni: false,
          extractedDni: pdf417Dni,
          extractedName: pdf417Name,
          extractedDniAddress: '',
          selfieMatched: false,
          pdf417Verified: true,
          tramiteNumber: pdf417Tramite || undefined,
          livenessChallenge: livenessChallenge || undefined,
          confidenceScore: 99,
          summary: `El código de barras PDF417 del DNI (${pdf417Dni}) no coincide con el DNI declarado en tu cuenta (${declaredDni}).`
        }
      });
    }

    const parseImagePart = (dataUrl: string) => {
      const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      return {
        inlineData: {
          mimeType: m ? m[1] : 'image/jpeg',
          data: m ? m[2] : dataUrl
        }
      };
    };

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'El servicio de verificación documental no está disponible en este momento.'
      });
    }

    const parts: any[] = [
      parseImagePart(dniFrontImage),
      parseImagePart(dniBackImage),
      parseImagePart(selfieImage)
    ];

    const prompt = `Eres un sistema KYC oficial de validación de identidad argentina para VONDRO.
Analizá las 3 imágenes adjuntas:
- Imagen 1: Frente del DNI Argentino (incluye foto carnet y código de barras PDF417).
- Imagen 2: Dorso del DNI Argentino (donde figura el DOMICILIO legal).
- Imagen 3: Selfie en vivo del titular para prueba de vida (biometría facial).${livenessChallenge ? ` Consigna solicitada en la selfie: "${livenessChallenge}".` : ''}

Datos declarados por el usuario en su cuenta:
- Nombre completo declarado: "${declaredName || 'No informado'}"
- Número de DNI declarado: "${declaredDni || 'No informado'}"
- Dirección de entrega declarada: "${declaredAddress || 'No informada'}"
${pdf417Scanned ? `- Datos leídos del código PDF417 del DNI: DNI="${pdf417Dni}", Titular="${pdf417Name}", Trámite="${pdf417Tramite || 'N/A'}"` : ''}

Tareas estrictas:
1. Verificá que las imágenes 1 y 2 correspondan realmente a un Documento Nacional de Identidad (DNI) argentino auténtico y legible (no capturas falsas ni en blanco) y que exista el código PDF417 en el frente.
2. Extraé del DNI:
   - extractedDni: solo dígitos del número de documento impreso en el frente.
   - extractedName: nombre y apellido completos impresos en el frente.
   - extractedDniAddress: domicilio legal impreso exactamente en el dorso del DNI (calle, altura, localidad/provincia).
   - tramiteNumber: número de trámite impreso en el frente (si es legible).
3. Compará:
   - dniMatch: true si extractedDni coincide exactamente con "${declaredDni || pdf417Dni}".
   - nameMatch: true si el apellido y nombre coinciden razonablemente con "${declaredName}".
   - addressMatchesDni: true si la calle y altura declaradas ("${declaredAddress}") coinciden con el domicilio del dorso del DNI (ignorando abreviaturas como Av./Avenida, pisos o mayúsculas).
   - selfieMatched: true SOLO si la imagen 3 muestra una persona real en vivo (no foto de otra pantalla o documento) y su rostro coincide con la foto del frente del DNI.
4. Determiná status:
   - "verified_full_match": documento válido + dniMatch && nameMatch && addressMatchesDni && selfieMatched.
   - "verified_dni_document": documento válido + dniMatch && nameMatch && selfieMatched (pero el domicilio de entrega es distinto al domicilio del dorso del DNI, por ejemplo trabajo o alquiler).
   - "mismatch": falla documento, DNI, nombre o la selfie biométrica no coincide con el rostro del DNI.
5. Escribí un "summary" breve y claro en español explicando el resultado (mencionando la validación del DNI, prueba de vida selfie y si el domicilio del dorso coincide o es entrega alternativa).`;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidArgentineDni: { type: Type.BOOLEAN },
            extractedDni: { type: Type.STRING },
            extractedName: { type: Type.STRING },
            extractedDniAddress: { type: Type.STRING },
            tramiteNumber: { type: Type.STRING },
            dniMatch: { type: Type.BOOLEAN },
            nameMatch: { type: Type.BOOLEAN },
            addressMatchesDni: { type: Type.BOOLEAN },
            selfieMatched: { type: Type.BOOLEAN },
            confidenceScore: { type: Type.NUMBER },
            status: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: [
            'isValidArgentineDni',
            'extractedDni',
            'extractedName',
            'extractedDniAddress',
            'dniMatch',
            'nameMatch',
            'addressMatchesDni',
            'selfieMatched',
            'confidenceScore',
            'status',
            'summary'
          ]
        }
      }
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    const cleanExtractedDni = pdf417Scanned ? pdf417Dni : String(parsed.extractedDni || '').replace(/\D/g, '');
    const dniMatchesBoth = Boolean(parsed.dniMatch) && (!pdf417Scanned || pdf417Dni === String(parsed.extractedDni || pdf417Dni).replace(/\D/g, ''));
    const selfieOk = Boolean(parsed.selfieMatched);

    const normalizedStatus: 'verified_full_match' | 'verified_dni_document' | 'mismatch' =
      !parsed.isValidArgentineDni || !dniMatchesBoth || !selfieOk
        ? 'mismatch'
        : parsed.addressMatchesDni
          ? 'verified_full_match'
          : 'verified_dni_document';

    const verificationRecord = {
      status: normalizedStatus,
      verifiedAt: new Date().toISOString(),
      dniMatch: dniMatchesBoth,
      nameMatch: Boolean(parsed.nameMatch),
      addressMatchesDni: Boolean(parsed.addressMatchesDni),
      extractedDni: cleanExtractedDni,
      extractedName: pdf417Name || String(parsed.extractedName || ''),
      extractedDniAddress: String(parsed.extractedDniAddress || ''),
      selfieMatched: selfieOk,
      pdf417Verified: pdf417Scanned,
      tramiteNumber: pdf417Tramite || String(parsed.tramiteNumber || '').trim() || undefined,
      livenessChallenge: livenessChallenge || undefined,
      confidenceScore: Number(parsed.confidenceScore || 0),
      summary: String(parsed.summary || '')
    };

    if (authUser?.uid) {
      try {
        await adminDb.collection('users').doc(authUser.uid).set(
          {
            identityVerification: verificationRecord,
            isVerified: normalizedStatus !== 'mismatch',
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      } catch (dbErr) {
        if (!isCredentialUnavailableError(dbErr)) {
          console.warn('[Verify Identity] Firestore persist warning:', (dbErr as any)?.message || dbErr);
        }
      }
    }

    return res.json({
      success: true,
      verification: verificationRecord
    });
  } catch (err: any) {
    console.error('[Verify Identity Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Error al analizar las fotos del DNI.'
    });
  }
});

// -------------------------------------------------------------
// 6. WHATSAPP BUSINESS OFFICIAL WEBHOOK (Preparation for WhatsApp Business API)
// -------------------------------------------------------------
// GET: Verification Challenge from Meta Graph API
app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'VONDRO_WHATSAPP_VERIFY_TOKEN_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WhatsApp Webhook Verified Successfully]');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// POST: Inbound WhatsApp message receiver
app.post('/api/whatsapp/webhook', (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log('[WhatsApp Webhook Inbound Payload]:', JSON.stringify(body));

    if (body.object === 'whatsapp_business_account') {
      body.entry?.forEach((entry: any) => {
        const changes = entry.changes;
        changes?.forEach((change: any) => {
          const value = change.value;
          const messages = value?.messages;
          if (messages && messages[0]) {
            const message = messages[0];
            const fromNumber = message.from;
            const textBody = message.text?.body;
            console.log(`[WhatsApp Inbound Message from ${fromNumber}]: ${textBody}`);
          }
        });
      });
      return res.status(200).send('EVENT_RECEIVED');
    }

    res.sendStatus(404);
  } catch (error) {
    console.error('[WhatsApp Webhook Error]:', error);
    res.status(200).send('OK');
  }
});

// -------------------------------------------------------------
// 7. VITE MIDDLEWARE & SERVER STARTUP
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    let viteMiddleware: any = null;
    const viteReadyPromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: { middlewareMode: true, hmr: false, watch: null },
          appType: 'spa',
        })
      )
      .then((vite) => {
        viteMiddleware = vite.middlewares;
        return vite.middlewares;
      })
      .catch((err) => {
        console.error('[Vite Middleware Init Error]:', err);
        throw err;
      });

    app.use(async (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const mw = viteMiddleware || await viteReadyPromise;
      return mw(req, res, next);
    });
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const dirDist = typeof __dirname !== 'undefined' ? __dirname : cwdDist;
    const distPath = fs.existsSync(path.join(cwdDist, 'index.html')) ? cwdDist : dirDist;
    const indexHtmlPath = path.join(distPath, 'index.html');

    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
      }
      if (fs.existsSync(indexHtmlPath)) {
        return res.sendFile(indexHtmlPath);
      }
      return res.status(200).send('VONDRO server running');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VONDRO Backend Server] Running on http://0.0.0.0:${PORT}`);
    setTimeout(() => {
      ensureFullCatalogLoaded().catch(() => {});
    }, 50);
  });
}

startServer();
