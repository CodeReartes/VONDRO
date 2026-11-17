export type StockStatus = 
  | 'available' 
  | 'low_stock' 
  | 'out_of_stock' 
  | 'hidden';

export type SupplierAvailability = 
  | 'AVAILABLE' 
  | 'LOW_STOCK' 
  | 'OUT_OF_STOCK' 
  | 'DISCONTINUED'
  | 'UNKNOWN' 
  | 'NOT_CHECKED';

export type ProductStatus = 
  | 'DRAFT' 
  | 'ACTIVE' 
  | 'PAUSED' 
  | 'OUT_OF_STOCK' 
  | 'ARCHIVED' 
  | 'DISCONTINUED';

export type FulfillmentMode = 
  | 'OWN_STOCK' 
  | 'SUPPLIER_ORDER'
  | 'SUPPLIER_STOCK';

export interface AlternativeSupplier {
  supplierId: string;
  supplierName?: string;
  supplierSku?: string;
  costPrice?: number;
  leadTimeDays?: number;
  notes?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  shortFeatures: string[];
  categoryId: string;
  category?: string;
  subcategoryId?: string;
  images: string[];
  image?: string;
  imageUrl?: string;
  costPrice: number; // Costo mayorista (ej. Inova ARG), visible SOLO para admin
  salePrice: number; // Precio de venta al público
  originalPrice?: number; // Precio anterior tachado
  discountPercentage?: number; // e.g. 25 for -25%
  stock: number;
  minimumStock?: number; // Default 3
  maximumStock?: number; // Default 20
  stockStatus: StockStatus;
  hideIfOutOfStock: boolean;
  isFeatured: boolean;
  isOnSale: boolean;
  isNew: boolean;
  rating: number;
  reviewCount: number;
  supplier: string; // e.g. 'Inova ARG'
  supplierId?: string;
  supplierSku?: string;
  supplierProductUrl?: string; // Real product link on inovaarg.com
  supplierProductName?: string;
  supplierProductImageUrl?: string;
  supplierImageUrls?: string[];
  supplierDescription?: string;
  supplierBrand?: string;
  displayBrand?: string;
  publicDescription?: string;
  publicImageUrls?: string[];
  supplierCostPrice?: number;
  supplierStockStatus?: SupplierAvailability;
  supplierAvailability?: SupplierAvailability;
  supplierLastCheckedAt?: string | null;
  supplierLastCheckedBy?: string;
  supplierNotes?: string;
  productStatus?: ProductStatus;
  fulfillmentMode?: FulfillmentMode;
  requiresSupplierCheck?: boolean;
  marginPercentage?: number; // Calculated or target markup / margin
  marginType?: 'PERCENTAGE' | 'MANUAL';
  targetMargin?: number;
  minimumMargin?: number;
  preferredMargin?: number;
  minimumSellingPrice?: number;
  priceRounding?: number; // e.g. 100, 500, 1000
  tags?: string[]; // ['OFERTA', 'NUEVO', 'TENDENCIA', 'MÁS VENDIDO', 'OFERTA RELÁMPAGO', 'ÚLTIMAS UNIDADES']
  featured?: boolean;
  competitorPrice?: number;
  competitorUrl?: string;
  competitorCheckedAt?: string;
  paymentFeeEstimate?: number;
  packagingCost?: number;
  shippingCostEstimate?: number;
  otherCost?: number;
  lastStockUpdate?: string;
  lastCostUpdate?: string;
  internalStock?: number;
  supplierStock?: number | null;
  supplierIntegrationType?: 'MANUAL' | 'CSV' | 'EXCEL' | 'XML' | 'API';
  lastSupplierSync?: string | null;
  lastUpdated?: string;
  createdAt?: string;
  salesCount?: number;
  unitsSold?: number;
  lastSoldAt?: string | null;
  recommendedProducts?: string[];
  alternativeSuppliers?: AlternativeSupplier[];
  variants?: ProductVariant[];
  sizes?: ProductSize[];
  colors?: ProductColor[];
  allowCustomSpecification?: boolean;
  specificationPlaceholder?: string;
  priceRange?: { min: number; max: number };
  // FASE 8: Commercial & Conversions
  tieredPricing?: ProductTieredPrice[];
  promoBadges?: PromoBadgeType[];
  isFlashSale?: boolean;
  flashSaleEndsAt?: string;
  isRestocked?: boolean;
  restockedAt?: string;
  consultCount?: number;
  addToCartCount?: number;
  specifications?: ProductSpecifications;
  technicalSpecs?: Record<string, string | number> | Array<{ id?: string; name?: string; label?: string; key?: string; value: string | number; sublabel?: string; iconType?: any }>;
  attributes?: Record<string, string | number> | Array<{ id?: string; name?: string; label?: string; key?: string; value: string | number; sublabel?: string; iconType?: any }>;
}

export interface ProductSpecifications {
  dimensions?: string;        // Medidas exactas / Rango de medidas (ej. 8 mm a 24 mm)
  capacity?: string;          // Capacidad / Piezas incluidas (ej. Set de 11 llaves)
  material?: string;          // Material (ej. Acero Cromo Vanadio Cr-V)
  assemblySystem?: string;    // Sistema de armado / Uso recomendado (ej. Profesional y taller)
  piecesIncluded?: string;    // Piezas incluidas
  measuresIncluded?: string;  // Medidas incluidas
  usage?: string;             // Uso
  power?: string;             // Potencia (ej. 1200W)
  pressure?: string;          // Presión de vapor / agua (ej. 3.5 Bares)
  waterCapacity?: string;     // Capacidad de agua / depósito (ej. 350 ml)
  pressureOrCapacity?: string;// Presión / Capacidad de agua
  voltage?: string;           // Voltaje y frecuencia (ej. 220V - 50Hz)
  accessoriesIncluded?: string;// Accesorios incluidos (ej. Kit de 9 piezas)
  functions?: string;         // Funciones y modos de uso (ej. Secado rápido, control de temperatura)
  speed?: string;             // Velocidades / Niveles
  batteryLife?: string;       // Autonomía / Batería
  connectivity?: string;      // Conectividad (ej. Bluetooth 5.3)
  warranty?: string;          // Garantía técnica
  additionalFeatures?: string[];
  customSpecs?: {
    id: string;
    label: string;
    sublabel?: string;
    value: string;
    iconType?: 'dimensions' | 'capacity' | 'material' | 'assembly' | 'tools' | 'pieces' | 'usage' | 'power' | 'pressure' | 'voltage' | 'accessories' | 'connectivity' | 'battery' | 'speed' | 'warranty';
  }[];
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  color?: string;
  imageUrl?: string;
  inStock?: boolean;
  priceOffset?: number;
}

export interface ProductSize {
  id: string;
  name: string; // e.g. "QUEEN", "KING", "1 ½ Plaza", "2 Plazas", "S", "M", etc.
  price?: number; // Direct final price e.g. 18200
  priceOffset?: number; // Difference from base price
  dimensions?: string; // Dimensions description e.g. "Para colchón hasta 1.60m x 2.00m + 30cm alto"
  stock?: number; // Individual stock for this size, e.g. 120 or 0
  inStock?: boolean;
}

export interface ProductColor {
  id: string;
  name: string; // e.g. "Rosa", "Beige", "Celeste", "Gris", "Blanco"
  hex?: string;
  imageUrl?: string;
  imageIndex?: number;
  inStock?: boolean;
}

export interface AddToCartOptions {
  selectedSize?: string;
  selectedColor?: string;
  selectedVariant?: string;
  customSpecification?: string;
  unitPrice?: number;
}

export type PromoBadgeType = 
  | 'OFERTA' 
  | 'OFERTA_RELAMPAGO' 
  | 'ULTIMAS_UNIDADES' 
  | 'MAS_VENDIDO' 
  | 'DESTACADO'
  | 'TENDENCIA'
  | 'NOVEDAD'
  | 'NUEVO'
  | 'NUEVO_INGRESO'
  | 'REPOSICIÓN'
  | 'REPOSICION'
  | 'VERANO';

export interface ProductTieredPrice {
  quantity: number; // e.g. 2, 3, 5, 10
  pricePerUnit: number; // e.g. $12.900
  discountPercentage?: number; // e.g. 5%
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
  active: boolean;
  type?: 'MAYORISTA' | 'DISTRIBUIDOR' | 'FABRICANTE' | 'LOCAL';
  minimumOrder?: number; // e.g. 80000 for Inova ARG
  integrationType?: 'MANUAL' | 'CSV' | 'XML' | 'API' | 'FEED';
  apiEnabled?: boolean;
  location?: string;
  cuit?: string;
  leadTimeDays?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierCheck {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  supplierId: string;
  supplierName: string;
  availability: SupplierAvailability;
  costPriceObserved?: number;
  checkedBy: string;
  checkedAt: string;
  notes?: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'READY' | 'SUBMITTED' | 'ORDERED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  productSku: string;
  supplierSku?: string;
  supplierProductUrl?: string;
  quantity: number;
  receivedQuantity?: number;
  estimatedCostPrice: number;
  actualCostPrice?: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string; // e.g. PO-INOVA-0001
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  totalEstimatedCost: number;
  totalActualCost?: number;
  status: PurchaseOrderStatus;
  relatedOrderIds?: string[];
  notes?: string;
  orderedAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierReturn {
  id: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  resolution?: string;
  refundAmount?: number;
  notes?: string;
  createdAt: string;
}

export type StockMovementType = 
  | 'SALE' 
  | 'PURCHASE' 
  | 'MANUAL_ADJUSTMENT' 
  | 'ADJUSTMENT'
  | 'RETURN' 
  | 'CANCELLATION' 
  | 'IMPORT' 
  | 'CORRECTION';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: StockMovementType;
  quantity: number; // + or -
  previousStock: number;
  newStock: number;
  reason: string;
  orderId?: string;
  userId?: string;
  adminId?: string;
  createdAt: string;
}

export type NotificationType = 
  | 'ORDER_CREATED' 
  | 'PAYMENT_APPROVED' 
  | 'PAYMENT_PENDING' 
  | 'PAYMENT_ERROR' 
  | 'STOCK_LOW' 
  | 'OUT_OF_STOCK' 
  | 'STOCK_ISSUE' 
  | 'ORDER_PREPARING_PENDING' 
  | 'ORDER_SHIPPED' 
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_ARRIVED_TODAY'
  | 'FLASH_OFFER'
  | 'PRICE_DROP'
  | 'CUSTOM_PROMO'
  | 'ASSISTANT_AGENT_REQUESTED'
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED'
  | 'DAILY_STOCK_AUDIT'
  | 'SYSTEM_INFO';

export interface AppNotification {
  id: string;
  userId?: string;
  targetAudience?: 'all' | 'customer' | 'admin';
  type: NotificationType;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'normal' | 'info' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  entityType?: 'order' | 'product' | 'stock' | 'supplier' | 'ticket' | 'conversation';
  entityId?: string;
  imageUrl?: string;
  linkUrl?: string;
  actionText?: string;
  read: boolean;
  createdAt: string;
}

export type AdminActionType = 
  | 'PRODUCT_PRICE_CHANGED' 
  | 'PRODUCT_STOCK_CHANGED' 
  | 'PRODUCT_CREATED'
  | 'ORDER_STATUS_CHANGED' 
  | 'SHIPPING_COST_CHANGED' 
  | 'PRODUCT_DISABLED' 
  | 'PRODUCT_IMPORTED' 
  | 'SUPPLIER_CREATED' 
  | 'SUPPLIER_UPDATED' 
  | 'RETURN_REGISTERED' 
  | 'BULK_UPDATE'
  | 'SHIPPING_STATUS_CHANGED'
  | 'COURIER_ASSIGNED'
  | 'TRACKING_CHANGED'
  | 'DELIVERY_CONFIRMED'
  | 'DELIVERY_FAILED'
  | 'DELIVERY_RESCHEDULED'
  | 'SUPPLIER_COST_CHANGED'
  | 'SUPPLIER_STATUS_CHANGED'
  | 'SUPPLIER_URL_CHANGED'
  | 'PRODUCT_MARGIN_CHANGED'
  | 'SUPPLIER_CHECKED'
  | 'PURCHASE_ORDER_CREATED'
  | 'PURCHASE_ORDER_RECEIVED'
  | 'SUPPLIER_RETURN_REGISTERED'
  | 'ASSISTANT_AI_PAUSED'
  | 'ASSISTANT_AI_RESUMED'
  | 'CONVERSATION_REPLIED'
  | 'TICKET_CREATED'
  | 'TICKET_RESOLVED'
  | 'TICKET_STATUS_CHANGED'
  | 'FAQ_UPDATED'
  | 'UNRESOLVED_QUERY_ANSWERED'
  | 'DAILY_STOCK_AUDIT';

export interface AdminAction {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AdminActionType;
  entity: 'product' | 'order' | 'supplier' | 'settings' | 'stock' | 'bulk' | 'purchaseOrder' | 'supplierReturn' | 'ticket' | 'conversation' | 'faq' | 'dailyStockAudit';
  entityId: string;
  previousValue?: any;
  newValue?: any;
  notes?: string;
  createdAt: string;
}

// -------------------------------------------------------------
// DAILY STOCK & CATALOG AUDIT TYPES
// -------------------------------------------------------------
export type StockChangeCategory = 
  | 'INCREASED' 
  | 'DECREASED' 
  | 'DEPLETED' 
  | 'RESTOCKED' 
  | 'CRITICAL';

export interface StockChangeItem {
  productId: string;
  productName: string;
  sku: string;
  previousStock: number;
  currentStock: number;
  delta: number;
  changeType: StockChangeCategory;
  costPrice?: number;
  salePrice?: number;
  supplier?: string;
  category?: string;
  image?: string;
  notes?: string;
}

export interface NewProductItem {
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  salePrice: number;
  costPrice?: number;
  category?: string;
  supplier?: string;
  image?: string;
  addedAt: string;
}

export interface OutOfStockItem {
  productId: string;
  productName: string;
  sku: string;
  previousStock: number;
  currentStock: number;
  supplier?: string;
  category?: string;
  minimumStock: number;
  suggestedRestock: number;
  image?: string;
  costPrice?: number;
  salePrice?: number;
}

export interface StrategicAuditSlot {
  time: '08:30' | '14:30' | '20:30' | string;
  name: string; // 'Apertura comercial' | 'Cierre de media jornada mayorista' | 'Cierre de jornada y despacho'
  description: string;
  enabled: boolean;
  lastRunDate?: string;
  lastRunTimestamp?: string;
  lastStatus?: 'COMPLETED' | 'WARNING' | 'CRITICAL';
  lastSummary?: string;
}

export interface DailyStockAudit {
  id: string;
  date: string; // Formato YYYY-MM-DD
  timestamp: string;
  executedBy: 'AUTOMATIC_DAILY_SCHEDULER' | 'ADMIN_MANUAL' | 'AUDIT_BOT_0830' | 'AUDIT_BOT_1430' | 'AUDIT_BOT_2030' | string;
  slotTime?: '08:30' | '14:30' | '20:30' | 'MANUAL' | string;
  slotLabel?: string;
  totalProductsChecked: number;
  inStockCount?: number;
  newProductsCount: number;
  outOfStockCount: number;
  restockedCount?: number;
  stockChangesCount: number;
  criticalLowStockCount: number;
  newProducts: NewProductItem[];
  outOfStockProducts: OutOfStockItem[];
  restockedProducts?: StockChangeItem[];
  stockChanges: StockChangeItem[];
  criticalStockProducts: StockChangeItem[];
  summaryNote: string;
  status: 'COMPLETED' | 'WARNING' | 'CRITICAL';
}

export interface DailyStockSchedulerConfig {
  enabled: boolean;
  scheduledTime: string; // e.g. "08:30"
  intervalHours: number; // default 6
  lastRunDate?: string;
  lastRunTimestamp?: string;
  notifyOnOutOfStock: boolean;
  notifyOnStockChanges: boolean;
  notifyOnNewProducts: boolean;
  criticalStockThreshold: number; // default 3
  botActive?: boolean;
  botMode?: 'THREE_STRATEGIC_SLOTS' | 'CUSTOM';
  strategicSlots?: StrategicAuditSlot[];
  lastExecutedSlot?: string;
}

export interface OrderReturn {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  refundStock: boolean;
  status: 'pending' | 'completed' | 'rejected';
  notes?: string;
  registeredBy: string;
  createdAt: string;
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  imageUrl?: string;
  badgeColor?: string;
  order: number;
  subcategories?: Subcategory[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariant?: string;
  customSpecification?: string;
  unitPrice?: number;
  itemKey?: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  description: string;
  price: number;
  cost?: number; // Compatible alias
  active: boolean;
  estimatedDelivery: string;
  order: number;
  neighborhoods?: string[];
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number; // e.g. 10 for 10% or 5000 for $5.000
  minPurchaseAmount: number;
  maxUses?: number;
  usedCount: number;
  startDate?: string;
  expiresAt?: string;
  specificProductIds?: string[];
  specificCategoryIds?: string[];
  active: boolean;
  description: string;
  ownerUserId?: string;
  createdAt?: string;
}

export interface AbandonedCart {
  id: string;
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  phone?: string;
  email?: string;
  attemptsCount?: number;
  totalAmount?: number;
  recoveryStatus?: 'PENDING' | 'CONTACTED' | 'RECOVERED' | 'EXPIRED';
  items: CartItem[];
  subtotal: number;
  discountAmount?: number;
  couponCode?: string;
  shippingZoneId?: string;
  status: 'ABANDONED' | 'RECOVERED' | 'EXPIRED';
  recoveryLink?: string;
  recoveryCouponCode?: string;
  notes?: string;
  createdAt: string;
  lastActivityAt: string;
  recoveredAt?: string;
}

// FASE 6: Logistical Statuses
export type ShippingStatus = 
  | 'PENDING'            // 🟣 Pedido recibido
  | 'PREPARING'          // 🟡 Preparando pedido
  | 'READY_TO_SHIP'      // 📦 Pedido listo
  | 'OUT_FOR_DELIVERY'   // 🚚 En camino
  | 'DELIVERED'          // 🟢 Entregado
  | 'DELIVERY_FAILED'    // 🔴 Problema con la entrega
  | 'CANCELLED'          // Cancelado
  | 'RETURNED';          // ↩️ Devuelto

// FASE 8: Complete Order Lifecycle Statuses
export type OrderStatus = 
  | 'pending_payment'   // 1. Pendiente de pago
  | 'payment_received'  // 2. Pago aprobado / recibido
  | 'checking_stock'    // 3. Verificando stock / disponibilidad
  | 'stock_confirmed'   // 4. Stock confirmado con proveedor / propio
  | 'preparing'         // 5. Preparando / embalando
  | 'ready_to_ship'     // 6. Listo para enviar
  | 'shipped'           // 7. Enviado
  | 'out_for_delivery'  // 8. En camino / en reparto urbano
  | 'delivered'         // 9. Entregado
  | 'completed'         // 10. Pedido finalizado
  | 'cancelled'         // 11. Cancelado
  | 'STOCK_ISSUE'       // 12. Problema de stock / requiere resolución
  // Uppercase aliases for maximum interoperability
  | 'PENDIENTE_PAGO'
  | 'PAGO_APROBADO'
  | 'VERIFICANDO_STOCK'
  | 'STOCK_CONFIRMADO'
  | 'PREPARANDO'
  | 'LISTO_PARA_ENVIAR'
  | 'ENVIADO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'FINALIZADO'
  | 'CANCELADO'
  | 'PROBLEMA_DE_STOCK';

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';

export type PaymentMethodType = 'mercadopago' | 'bank_transfer' | 'cash_delivery';

export interface ShippingAddress {
  province: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  floor?: string;
  apartment?: string;
  reference?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CustomerData {
  id?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  name?: string;
  dni?: string;
  phone: string;
  email: string;
  province: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  floor?: string;
  apartment?: string;
  address?: string;
  floorApartment?: string;
  reference?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: { lat: number; lng: number };
  addressVerified?: boolean;
  addressVerificationSource?: 'gps_reverse' | 'georef_ar' | 'nominatim' | 'manual';
  matchedZoneId?: string;
  distanceKm?: number;
  gpsMatchDistanceKm?: number | null;
}

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  salePrice: number;
  price?: number;
  costPrice: number; // For admin analytics calculation
  quantity: number;
  subtotal: number;
  prepared?: boolean;
  selectedSize?: string;
  selectedColor?: string;
  selectedVariant?: string;
  customSpecification?: string;
  product?: any;
}

export interface OrderTimelineEvent {
  status: OrderStatus | ShippingStatus;
  title: string;
  description: string;
  timestamp: string;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  changedBy: string; // 'system' | 'customer' | 'admin' | user email
  timestamp: string;
  note?: string;
  previousStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

export interface ShippingStatusHistoryItem {
  id: string;
  orderId: string;
  status: ShippingStatus;
  note: string;
  changedBy: string; // admin / courier / system
  createdAt: string;
}

export interface Courier {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
  vehicleType: 'MOTO' | 'AUTO' | 'UTILITARIO' | 'BICICLETA' | 'A_PIE';
  notes: string;
  createdAt: string;
}

export type ShippingExpenseType = 'FUEL' | 'COURIER' | 'COURIER_FEE' | 'PACKAGING' | 'OTHER';

export interface ShippingExpense {
  id: string;
  orderId?: string;
  amount: number;
  type: ShippingExpenseType;
  description: string;
  createdAt: string;
}

export interface ShippingRecord {
  id: string;
  orderId: string;
  shippingStatus: ShippingStatus;
  shippingCost: number;
  shippingExpense: number;
  zoneId: string;
  courierId?: string;
  trackingCode: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LogisticsProviderType = 'MANUAL' | 'EXTERNAL_API';

export interface LogisticsProvider {
  id: string;
  name: string;
  type: LogisticsProviderType;
  phone: string;
  email: string;
  website: string;
  apiEnabled: boolean;
  active: boolean;
  notes: string;
  createdAt: string;
}

export interface StockReservation {
  reservationId: string;
  productId: string;
  quantity: number;
  userId?: string;
  expiresAt: string;
  status: 'active' | 'confirmed' | 'expired' | 'cancelled';
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "#VON-000001"
  createdAt: string;
  updatedAt: string;
  customer: CustomerData;
  items: OrderItem[];
  subtotal: number;
  shippingZoneId: string;
  shippingZoneName: string;
  shippingZone?: any;
  shippingCost: number;
  isFreeShipping: boolean;
  couponCode?: string;
  discountAmount: number;
  couponDiscount?: number;
  total: number;
  paymentMethod: PaymentMethodType;
  paymentStatus: PaymentStatus;
  paymentStatusDetail?: string;
  paymentId?: string; // ID asignado por Mercado Pago (ej. '1234567890')
  preferenceId?: string; // ID de preferencia de checkout Mercado Pago
  initPoint?: string; // URL de redirección a Mercado Pago
  status: OrderStatus;
  timeline: OrderTimelineEvent[];
  orderStatusHistory?: OrderStatusHistoryItem[];
  adminNotes?: string;
  transferReceiptImage?: string;
  userId?: string; // Optional if guest checkout
  isGuest?: boolean;
  purchasedItemKeys?: string[];
  referralRewardGranted?: boolean;
  // FASE 5 Extensions
  hasStockIssue?: boolean;
  stockIssueNote?: string;
  preparedItems?: Record<string, boolean>; // checklist of productId -> prepared
  preparedAt?: string;
  preparedBy?: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;

  // FASE 6 Logistical Fields
  shippingStatus: ShippingStatus;
  shippingAddress?: ShippingAddress;
  shippingNotes?: string;
  deliveryDate?: string;
  requestedDeliveryDate?: string;
  deliveryTimeSlot?: string;
  trackingCode: string; // e.g. "VON-TRK-000001"
  deliveryMethod?: 'DIRECT_COURIER' | 'PICKUP' | 'EXTERNAL_LOGISTICS';
  assignedCourierId?: string | null;
  assignedCourierName?: string;
  deliveryAttempts: number;
  deliveryFailureReason?: string;
  deliveryNotes?: string;
  deliveredTo?: string;
  deliveryConfirmationCode?: string;
  deliveryPin?: string;
  packageCount?: number;
  packageWeight?: number;
  packageSize?: string;
  packageNotes?: string;
  shippingStatusHistory?: ShippingStatusHistoryItem[];
  shippingExpense?: number; // Costo real logístico de VONDRO

  // FASE 8: Financials, Profitability & Stock Resolution (Strictly Admin / Private)
  supplierCostTotal?: number;
  paymentFee?: number;
  packagingCost?: number;
  otherCosts?: number;
  estimatedProfit?: number;
  actualProfit?: number;
  profitMarginPct?: number;
  stockIssueAction?: 'CONTACT_CLIENT' | 'WAIT_RESTOCK' | 'REPLACE_PRODUCT' | 'CANCEL_ORDER' | 'REFUND';
  stockIssueResolutionNotes?: string;
  replacedItems?: { originalProductId: string; replacedWithProductId: string; replacedWithProductName: string; priceDifference: number }[];

  // Future external logistics fields
  providerId?: string;
  externalShipmentId?: string;
  externalTrackingCode?: string;
  externalStatus?: string;
  apiStatus?: string;

  // Bank Transfer Verification & Proof fields
  transferProofUrl?: string;
  transferOperationNumber?: string;
  transferPayerName?: string;
  transferPayerDni?: string;
  transferBankOrigin?: string;
  transferDate?: string;
  transferVerifiedAt?: string;
  transferVerifiedBy?: string;
  transferVerificationScore?: number;
  transferVerificationNotes?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  phone: string;
  dni?: string;
  isVerified?: boolean;
  role: 'admin' | 'customer' | 'courier';
  addresses: CustomerData[];
  defaultAddress?: CustomerData;
  address?: any;
  favorites: string[];
  photoUrl?: string;
  avatarPreset?: string;
  referralCode?: string;
  referredBy?: string;
  referredByUserId?: string;
  referralCount?: number;
  referralEarnings?: number;
  claimedReferralDiscount?: boolean;
  referralRewardCreditedForReferrer?: boolean;
  identityVerification?: {
    status: 'unverified' | 'basic_dni' | 'verified_dni_document' | 'verified_full_match' | 'mismatch';
    verifiedAt?: string;
    dniMatch?: boolean;
    nameMatch?: boolean;
    addressMatchesDni?: boolean;
    extractedDni?: string;
    extractedName?: string;
    extractedDniAddress?: string;
    selfieMatched?: boolean;
    pdf417Verified?: boolean;
    tramiteNumber?: string;
    livenessChallenge?: string;
    confidenceScore?: number;
    summary?: string;
  };
  createdAt?: string;
}

export interface MercadoPagoConfigSettings {
  enabled: boolean;
  publicKey: string;
  accessToken: string;
  mode: 'test' | 'production';
  sandbox: boolean;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  logoUrl?: string;
  whatsappNumber: string;
  whatsappGreeting: string;
  supportEmail: string;
  address: string;
  city: string;
  freeShippingThreshold: number; // e.g. 100000
  bankDetails: {
    bankName: string;
    accountHolder: string;
    cbu: string;
    alias: string;
    cuit: string;
  };
  mercadoPago: MercadoPagoConfigSettings;
  zones: ShippingZone[];
  // FASE 6 Logistics Configuration
  deliveryTimeSlotsEnabled: boolean;
  availableTimeSlots: string[];
  dailyDeliveryCapacity: number;
  // FASE 7 Inova & Sourcing Configuration
  supplierMinimumOrder: number; // e.g. 80000 for Inova ARG
  supplierCheckExpirationHours: number; // e.g. 24 hours
  requireSupplierUrl: boolean; // default false
  defaultPriceRounding: number; // e.g. 100, 500, 1000
  defaultTargetMargin: number; // e.g. 30%
  defaultMinimumMargin: number; // e.g. 15%
  // Cost controls structure
  expensesEstimate?: {
    paymentFeesPct: number;
    shippingExpenseAvg: number;
    marketingExpenseMonthly: number;
    otherExpensesMonthly: number;
  };
  metricsResetAt?: string;
}

export type AnalyticsEventType = 
  | 'product_view'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'payment_started'
  | 'payment_approved'
  | 'payment_rejected'
  | 'purchase';

export type AnalyticsEvent = {
  event: AnalyticsEventType;
  timestamp: string;
  data?: Record<string, any>;
};

// ============================================================================
// FASE 7.5: ASISTENTE INTELIGENTE VONDRO & OMNICHANNEL SUPPORT
// ============================================================================

export type AssistantChannel = 'WEB' | 'APP' | 'WHATSAPP' | 'ADMIN' | 'web' | 'app' | 'whatsapp' | 'admin';

export type AssistantConversationStatus = 
  | 'NUEVO' 
  | 'EN_ATENCION' 
  | 'ESPERANDO_CLIENTE' 
  | 'RESUELTO'
  | 'new'
  | 'active'
  | 'waiting'
  | 'resolved'
  | 'closed';

export type AssistantMessageSender = 'user' | 'assistant' | 'human_agent' | 'system' | 'agent';

export type AssistantMessageActionType = 
  | 'PRODUCT_CARD' 
  | 'PRODUCT_LIST' 
  | 'ORDER_TRACKING' 
  | 'CART_CONFIRM' 
  | 'SHIPPING_CALC' 
  | 'FAQ_LIST' 
  | 'TICKET_CREATED' 
  | 'AGENT_HANDOFF' 
  | 'QUICK_REPLIES'
  | 'STOCK_STATUS'
  | 'CREATE_SUPPORT_TICKET'
  | 'OPEN_FAQS';

export interface AssistantQuickReply {
  label: string;
  action?: string;
  payload?: any;
  icon?: string;
}

export interface AssistantActionButton {
  label: string;
  action: string;
  payload?: any;
  icon?: string;
}

export interface AssistantProductThumbnail {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  stock?: number;
  stockStatus?: string;
  category?: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  userId?: string;
  sender: AssistantMessageSender;
  senderName?: string;
  text: string;
  timestamp: string;
  actionType?: AssistantMessageActionType;
  actionData?: any;
  actionButtons?: AssistantActionButton[];
  productThumbnails?: AssistantProductThumbnail[];
  orderSummary?: any;
  quickReplies?: AssistantQuickReply[];
  isRead?: boolean;
  channel?: AssistantChannel;
  metadata?: Record<string, any>;
}

export interface AssistantConversation {
  id: string;
  userId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  channel: AssistantChannel;
  status: AssistantConversationStatus;
  isAiPaused?: boolean;
  aiPaused?: boolean;
  assignedAgentId?: string;
  assignedAgentName?: string;
  lastMessageText?: string;
  lastMessagePreview?: string;
  lastMessageAt: string;
  unreadByAdminCount?: number;
  unreadByUserCount?: number;
  unreadCountAdmin?: number;
  unreadCountCustomer?: number;
  relatedOrderIds?: string[];
  consultedProductIds?: string[];
  tags?: string[];
  messages?: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export type SupportTicketReason = 
  | 'falla_rotura'
  | 'demora_envio'
  | 'cambio_devolucion'
  | 'cancelacion'
  | 'reclamo_pago'
  | 'asesor_humano'
  | 'DAMAGED_PRODUCT' 
  | 'NOT_RECEIVED' 
  | 'CANCELLATION' 
  | 'RETURN' 
  | 'PAYMENT_ISSUE' 
  | 'STOCK_INQUIRY' 
  | 'OTHER';

export type SupportTicketPriority = 'baja' | 'media' | 'alta' | 'urgente' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SupportTicketStatus = 
  | 'open'
  | 'in_progress'
  | 'waiting'
  | 'resolved'
  | 'closed'
  | 'OPEN' 
  | 'IN_PROGRESS' 
  | 'WAITING_CLIENT' 
  | 'RESOLVED' 
  | 'CLOSED';

export interface SupportTicket {
  id: string;
  ticketNumber: string; // e.g. "TCK-0001"
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderId?: string;
  orderNumber?: string;
  reason: SupportTicketReason;
  reasonLabel?: string;
  subject?: string;
  description?: string;
  message?: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  conversationId?: string;
  channel?: string;
  adminNotes?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type FAQCategory = 
  | 'envios' 
  | 'pagos' 
  | 'productos' 
  | 'pedidos' 
  | 'general' 
  | 'ayuda' 
  | 'compras' 
  | 'cambios' 
  | 'devoluciones' 
  | 'cuenta';

export interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
  order: number;
  active?: boolean;
  tags?: string[];
  viewsCount?: number;
  helpfulCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnresolvedQuery {
  id: string;
  rawQuery?: string;
  queryText?: string;
  detectedIntent?: string;
  confidence?: number;
  userId?: string;
  customerName?: string;
  conversationId?: string;
  channel: AssistantChannel;
  category?: string;
  status?: 'pending' | 'resolved';
  resolved?: boolean;
  adminNotes?: string;
  adminAnswer?: string;
  convertedToFaq?: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  orderId?: string;
  author: string;
  avatarColor?: string;
  country?: string;
  date: string;
  rating: number; // 1 to 5
  comment: string;
  title?: string;
  boughtVariant?: string;
  verified: boolean;
  images?: string[];
  likes: number;
  likedByUser?: boolean;
  createdAt: string;
}

