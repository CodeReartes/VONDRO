import { 
  AssistantMessage, 
  AssistantProductThumbnail,
  AssistantQuickReply, 
  FAQItem, 
  Order, 
  Product, 
  ShippingZone, 
  StoreSettings, 
  SupportTicket, 
  SupportTicketPriority, 
  SupportTicketReason, 
  UserAccount 
} from '../types';

export interface AssistantContext {
  products: Product[];
  orders: Order[];
  settings?: StoreSettings;
  faqs?: FAQItem[];
  currentUser?: UserAccount | null;
  user?: UserAccount | null;
  conversationId?: string;
  cartItemsCount?: number;
  cartSubtotal?: number;
  zones?: ShippingZone[];
}

export interface AssistantEngineResult {
  text: string;
  replyText?: string;
  actionType?: AssistantMessage['actionType'];
  actionData?: any;
  actionButtons?: any[];
  productThumbnails?: any[];
  orderSummary?: any;
  quickReplies?: AssistantQuickReply[];
  suggestedTicket?: Partial<SupportTicket>;
  requiresHumanHandoff?: boolean;
  unresolved?: boolean;
  unresolvedCategory?: string;
  intent?: string;
  confidence?: number;
}

// -------------------------------------------------------------
// DEFAULT QUICK REPLIES
// -------------------------------------------------------------
export const DEFAULT_QUICK_REPLIES: AssistantQuickReply[] = [
  { label: '🔎 Buscar productos', action: 'search_prompt', payload: 'buscar productos' },
  { label: '📦 Consultar disponibilidad', action: 'stock_prompt', payload: 'consultar disponibilidad de stock' },
  { label: '💰 Consultar precio', action: 'price_prompt', payload: 'consultar precios y promociones' },
  { label: '🛒 Ayuda para comprar', action: 'buy_help', payload: 'ayuda para realizar una compra' },
  { label: '📋 Mi pedido', action: 'my_orders', payload: 'consultar estado de mi pedido' },
  { label: '🚚 Seguimiento', action: 'track_order_prompt', payload: 'seguimiento de mi pedido' },
  { label: '📍 Envíos', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
  { label: '💳 Pagos', action: 'payment_info', payload: 'medios de pago y cuotas' },
  { label: '❓ Ayuda (FAQ)', action: 'show_faq', payload: 'preguntas frecuentes de la tienda' },
  { label: '👤 Hablar con un asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' },
];

// -------------------------------------------------------------
// 1. SEARCH PRODUCTS (Sanitized for public viewing)
// -------------------------------------------------------------
export function searchProducts(
  products: Product[],
  options: {
    query?: string;
    categoryId?: string;
    maxPrice?: number;
    inStockOnly?: boolean;
    limit?: number;
  }
): Product[] {
  const { query = '', categoryId, maxPrice, inStockOnly = false, limit = 4 } = options;
  const rawQ = query.toLowerCase().trim();

  // Tokenize and clean stop words
  const stopWords = new Set(['este', 'esta', 'estos', 'estas', 'queda', 'quedan', 'disponible', 'disponibles', 'tenes', 'tene', 'tienen', 'tendran', 'hay', 'busco', 'buscar', 'quiero', 'necesito', 'productos', 'articulos', 'algo', 'ver', 'mostrar', 'de', 'del', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'con', 'en', 'por', 'que', 'tal', 'como']);
  const genericModifiers = new Set(['electrica', 'electrico', 'electricas', 'electricos', 'digital', 'digitales', 'mini', 'grande', 'grandes', 'portatil', 'portatiles', 'recargable', 'recargables', 'inalambrico', 'inalambrica', 'inalambricos', 'inalambricas', 'bluetooth', 'usb', 'led', 'pro', 'max', 'plus', 'pack', 'set', 'kit', 'universal', 'infantil', 'nino', 'nina', 'chico', 'chica', 'nuevo', 'nueva', 'nuevos', 'nuevas']);

  const cleanNorm = (str: string) => (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&#\d+;|&#x[0-9a-f]+;|&[a-z0-9]+;/gi, ' ')
    .replace(/[–—−–-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stemSpanishToken = (token: string): string => {
    if (token.length <= 4) return token;
    if (token.endsWith('es') && token.length > 5 && !token.endsWith('les')) return token.slice(0, -2);
    if (token.endsWith('ces') && token.length > 5) return token.slice(0, -3) + 'z';
    if (token.endsWith('s') && !token.endsWith('is') && !token.endsWith('us')) return token.slice(0, -1);
    return token;
  };

  const SYNONYM_GROUPS: Array<{ triggers: string[]; expansions: string[] }> = [
    { triggers: ['alfombr', 'tapet', 'felpud', 'esterill', 'diatomin', 'shaggy', 'mimbre', 'piso'], expansions: ['alfombra', 'tapete', 'felpudo', 'shaggy', 'mimbre', 'diatomina', 'limpiador de alfombra'] },
    { triggers: ['cortina', 'bano', 'ducha', 'inodoro', 'toalla', 'jabonera'], expansions: ['cortina', 'bano', 'ducha', 'alfombra de bano'] },
    { triggers: ['navid', 'papa noel', 'noel', 'arbol', 'guirnald', 'pesebr', 'festiv'], expansions: ['navidad', 'papa noel', 'colgante', 'guirnalda', 'luces', 'led'] },
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

  const normQ = cleanNorm(rawQ);
  const rawTokens = normQ
    .split(' ')
    .filter(t => t.length >= 3 && !stopWords.has(t));

  const coreNounTokens = rawTokens.filter(t => !genericModifiers.has(t));
  const modifierTokens = rawTokens.filter(t => genericModifiers.has(t));

  const baseTokens = coreNounTokens.length > 0 ? coreNounTokens : rawTokens;
  const expandedSet = new Set<string>();
  baseTokens.forEach(t => {
    expandedSet.add(t);
    const st = stemSpanishToken(t);
    if (st.length >= 3) expandedSet.add(st);
  });
  for (const token of Array.from(expandedSet)) {
    for (const grp of SYNONYM_GROUPS) {
      if (grp.triggers.some(tr => token.startsWith(tr) || tr.startsWith(token))) {
        grp.expansions.forEach(ex => expandedSet.add(ex));
      }
    }
  }
  const expandedCoreTokens = Array.from(expandedSet);

  const scored = products.map(p => {
    if (!p || p.productStatus === 'PAUSED' || p.productStatus === 'ARCHIVED' || p.productStatus === 'DISCONTINUED') return { p, score: -1 };
    if (categoryId && p.categoryId !== categoryId) return { p, score: -1 };
    if (inStockOnly && (p.stock <= 0 || p.stockStatus === 'out_of_stock')) return { p, score: -1 };
    if (maxPrice !== undefined && p.salePrice > maxPrice) return { p, score: -1 };

    let score = 0;
    const pName = cleanNorm(p.name);
    const pDesc = cleanNorm(p.description);
    const pCat = cleanNorm(`${p.categoryId || ''} ${p.subcategoryId || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`);
    const pSku = cleanNorm(p.sku || '');
    const pTokens = pName.split(' ');
    const isInStock = (p.stock ?? 0) > 0 && p.stockStatus !== 'out_of_stock';

    if (normQ) {
      if (pName === normQ) score += 100;
      else if (pName.includes(normQ) || (normQ.length >= 10 && normQ.includes(pName))) score += 55;
      if (pCat.includes(normQ)) score += 20;
      if (pSku === normQ) score += 80;
      else if (pSku.includes(normQ)) score += 30;
      if (pDesc.includes(normQ)) score += 8;

      let matchedAnyCore = false;
      expandedCoreTokens.forEach(token => {
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
      });

      if (expandedCoreTokens.length === 0 || matchedAnyCore) {
        modifierTokens.forEach(token => {
          if (pName.includes(token)) score += 6;
          if (pCat.includes(token)) score += 3;
          if (pDesc.includes(token)) score += 1;
        });
      } else {
        score = 0;
      }
    } else {
      score = 1;
    }

    if (score > 0 && isInStock) score += 25;
    return { p, score };
  });

  const filtered = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.p.stock ?? 0) - (a.p.stock ?? 0))
    .map(item => item.p);

  // Strip all internal supplier cost / margin info for safety
  const sanitized = filtered.slice(0, limit).map(p => ({
    ...p,
    costPrice: 0,
    supplierCostPrice: 0,
    marginPercentage: 0,
    supplier: '',
    supplierId: undefined,
    supplierSku: undefined,
    supplierProductUrl: undefined
  }));

  return sanitized;
}

// -------------------------------------------------------------
// 2. GET PRODUCT DETAILS (Sanitized)
// -------------------------------------------------------------
export function getProduct(products: Product[], identifier: string): Product | null {
  const cleanId = (identifier || '').toLowerCase().trim();
  const found = (products || []).find(p => 
    (p?.id && p.id.toLowerCase() === cleanId) || 
    (p?.sku && p.sku.toLowerCase() === cleanId) || 
    (p?.slug && p.slug.toLowerCase() === cleanId) ||
    (p?.name && p.name.toLowerCase().includes(cleanId))
  );

  if (!found) return null;

  return {
    ...found,
    costPrice: 0,
    supplierCostPrice: 0,
    marginPercentage: 0,
    supplier: '',
    supplierId: undefined,
    supplierSku: undefined,
    supplierProductUrl: undefined
  };
}

// -------------------------------------------------------------
// 3. CHECK STOCK (Official VONDRO response format)
// -------------------------------------------------------------
export function checkStock(
  products: Product[],
  identifier: string
): { 
  product: Product | null; 
  statusText: string; 
  available: boolean; 
  stockCount: number;
} {
  const product = getProduct(products, identifier);

  if (!product) {
    return {
      product: null,
      statusText: 'No encontré ese producto en nuestro catálogo actual.',
      available: false,
      stockCount: 0
    };
  }

  if (product.stock > 5) {
    return {
      product,
      statusText: `Sí 👍 Tenemos disponibilidad inmediata de "${product.name}".`,
      available: true,
      stockCount: product.stock
    };
  } else if (product.stock > 0) {
    return {
      product,
      statusText: `Sí 👍 Quedan pocas unidades (${product.stock} disponibles) de "${product.name}".`,
      available: true,
      stockCount: product.stock
    };
  } else {
    return {
      product,
      statusText: `En este momento "${product.name}" figura agotado. Podemos notificarte cuando reingrese.`,
      available: false,
      stockCount: 0
    };
  }
}

// -------------------------------------------------------------
// 4. GET SHIPPING COST & ZONES (Córdoba Capital & Gran CBA)
// -------------------------------------------------------------
export function getShippingCost(
  settings?: StoreSettings,
  options?: { query?: string; subtotal?: number }
): {
  isFree: boolean;
  threshold: number;
  zones: Array<{ name: string; price: number; time: string; neighborhoods: string[] }>;
  message: string;
} {
  const threshold = settings?.freeShippingThreshold ?? 100000;
  const subtotal = options?.subtotal || 0;
  const isFree = subtotal >= threshold;

  const standardZones = [
    {
      name: 'Centro, Nueva Córdoba y Güemes',
      price: 3500,
      time: 'Entrega en el día (si pedís antes de las 14:00 hs)',
      neighborhoods: ['Centro', 'Nueva Córdoba', 'Güemes', 'Alberdi', 'General Paz', 'Observatorio']
    },
    {
      name: 'Zona Norte y Zona Sur',
      price: 4500,
      time: 'Entrega en 24 a 48 hs hábiles',
      neighborhoods: ['Cerro de las Rosas', 'Urca', 'Villa Belgrano', 'Argüello', 'Jardín', 'San Vicente', 'Empalme']
    },
    {
      name: 'Gran Córdoba & Alrededores',
      price: 6500,
      time: 'Entrega en 48 a 72 hs hábiles',
      neighborhoods: ['Villa Allende', 'La Calera', 'Carlos Paz', 'Mendiolaza', 'Río Ceballos']
    }
  ];

  let message = `📍 **Envíos en Córdoba Capital y Gran Córdoba**:\n\n`;
  standardZones.forEach(z => {
    message += `• **${z.name}**: $${(z.price ?? 0).toLocaleString('es-AR')} — ${z.time}\n`;
  });
  message += `\n✨ **¡ENVÍO GRATIS!** en compras a partir de **$${(threshold ?? 100000).toLocaleString('es-AR')}**.\n`;
  
  if (subtotal > 0 && !isFree) {
    const missing = threshold - subtotal;
    message += `\n💡 *Te faltan $${(missing ?? 0).toLocaleString('es-AR')} para acceder al envío gratis.*`;
  } else if (isFree) {
    message += `\n🎉 *¡Tu carrito actual ya califica para Envío 100% Bonificado!*`;
  }

  return {
    isFree,
    threshold,
    zones: standardZones,
    message
  };
}

// -------------------------------------------------------------
// 5. GET USER ORDERS & FRIENDLY STATUS HELPER
// -------------------------------------------------------------
export function getFriendlyStatusLabel(status: string): { label: string; emoji: string; isFinished: boolean } {
  const s = (status || '').toLowerCase().trim();

  if (s === 'pending_payment' || s === 'pendiente_pago' || s === 'pending') {
    return { label: 'Pendiente de Pago', emoji: '🟡', isFinished: false };
  }
  if (s === 'payment_received' || s === 'pago_aprobado') {
    return { label: 'Pago Acreditado - En preparación', emoji: '🟢', isFinished: false };
  }
  if (s === 'checking_stock' || s === 'stock_confirmed' || s === 'verificando_stock' || s === 'stock_confirmado') {
    return { label: 'Stock Confirmado', emoji: '📦', isFinished: false };
  }
  if (s === 'preparing' || s === 'preparando') {
    return { label: 'En preparación en depósito', emoji: '📦', isFinished: false };
  }
  if (s === 'ready_to_ship') {
    return { label: 'Listo para despacho', emoji: '🛵', isFinished: false };
  }
  if (s === 'shipped' || s === 'out_for_delivery' || s === 'enviado') {
    return { label: 'En camino con el cadete', emoji: '🚚', isFinished: false };
  }
  if (s === 'delivered' || s === 'completed' || s === 'entregado') {
    return { label: 'Entregado / Finalizado', emoji: '✅', isFinished: true };
  }
  if (s === 'cancelled' || s === 'cancelado') {
    return { label: 'Cancelado', emoji: '❌', isFinished: true };
  }
  if (s === 'stock_issue') {
    return { label: 'En revisión de stock', emoji: '⚠️', isFinished: false };
  }

  return { label: status || 'En proceso', emoji: '🔹', isFinished: false };
}

export function getUserOrders(orders: Order[], currentUser: UserAccount | null): Order[] {
  if (!orders || orders.length === 0) return [];

  let list: Order[] = [];

  // 1. If currentUser is logged in, filter by user identity
  if (currentUser) {
    list = orders.filter(o => 
      (o?.userId && currentUser?.id && o.userId === currentUser.id) ||
      (o?.customer?.email && currentUser?.email && o.customer.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (o?.customer?.phone && currentUser?.phone && o.customer.phone.replace(/\D/g, '') === currentUser.phone.replace(/\D/g, ''))
    );
  }

  // 2. If no user-matched orders found, take the system/session orders
  if (list.length === 0 && orders.length > 0) {
    list = [...orders];
  }

  // Sort newest first
  return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

// -------------------------------------------------------------
// 6. GET ORDER STATUS (Secure verification & detailed view)
// -------------------------------------------------------------
export function getOrderStatus(
  orders: Order[],
  orderIdentifier: string,
  currentUser: UserAccount | null
): {
  order: Order | null;
  message: string;
  isAuthorized: boolean;
  orderSummary?: any;
} {
  const cleanCode = (orderIdentifier || '').replace('#', '').trim().toLowerCase();
  
  const matched = (orders || []).find(o => 
    (o?.id && o.id.toLowerCase() === cleanCode) ||
    (o?.orderNumber && o.orderNumber.replace('#', '').toLowerCase() === cleanCode) ||
    (o?.trackingCode && o.trackingCode.toLowerCase() === cleanCode)
  );

  if (!matched) {
    return {
      order: null,
      message: `No encontré ningún pedido registrado con el identificador "${orderIdentifier}". Por favor verificá que el número sea como \`#VON-000001\` o consultá tu código de seguimiento.`,
      isAuthorized: false
    };
  }

  const isOwner = currentUser && (
    (matched.userId && currentUser.id && matched.userId === currentUser.id) ||
    (currentUser.email && matched.customer?.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
    currentUser.role === 'admin'
  );

  const statusInfo = getFriendlyStatusLabel(matched.status);
  const deliveryEstimated = matched.deliveryDate || matched.requestedDeliveryDate
    ? new Date(matched.deliveryDate || matched.requestedDeliveryDate!).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Próximas 24 a 48 hs hábiles';

  let message = `📋 **Estado del Pedido ${matched.orderNumber}**\n\n`;
  message += `• **Estado actual**: ${statusInfo.emoji} **${statusInfo.label}**\n`;
  message += `• **Fecha de compra**: ${new Date(matched.createdAt).toLocaleDateString('es-AR')}\n`;
  message += `• **Total**: **$${(matched.total ?? 0).toLocaleString('es-AR')}**\n`;

  if (matched.items && matched.items.length > 0) {
    const totalUnits = matched.items.reduce((sum, item) => sum + item.quantity, 0);
    message += `• **Productos** (${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'}):\n`;
    matched.items.forEach(item => {
      message += `   - ${item.name} (x${item.quantity}) — $${(item.subtotal || (item.salePrice * item.quantity)).toLocaleString('es-AR')}\n`;
    });
  }

  if (matched.status === 'pending_payment' || matched.status === 'PENDIENTE_PAGO') {
    message += `\n🟡 *Este pedido figura PENDIENTE DE PAGO. Si transferiste o pagaste por Mercado Pago, podés indicárnoslo o adjuntar comprobante para procesar el envío de inmediato.*\n`;
  } else if (matched.status === 'preparing' || matched.status === 'PREPARANDO' || matched.status === 'payment_received') {
    message += `\n📦 *¡Tu pago fue acreditado! El paquete está siendo armado en nuestro depósito de Córdoba y se asignará al cadete para su entrega.*\n`;
  } else if (matched.status === 'shipped' || matched.status === 'out_for_delivery') {
    message += `\n🚚 *¡Tu pedido ya está en camino con el cadete a tu domicilio en Córdoba!*\n`;
  } else if (matched.status === 'delivered' || matched.status === 'completed') {
    message += `\n✅ *Este pedido ya fue entregado y finalizado con éxito. ¡Gracias por confiar en VONDRO!*\n`;
  }

  if (matched.trackingCode) {
    message += `• **Código de seguimiento**: \`${matched.trackingCode}\`\n`;
  }
  if (matched.assignedCourierName) {
    message += `• **Cadete asignado**: ${matched.assignedCourierName}\n`;
  }
  message += `• **Entrega estimada**: ${deliveryEstimated}\n`;

  return {
    order: matched,
    message,
    isAuthorized: !!isOwner,
    orderSummary: {
      id: matched.id,
      orderNumber: matched.orderNumber,
      total: matched.total,
      status: statusInfo.label,
      shippingStatus: matched.assignedCourierName ? `Con cadete ${matched.assignedCourierName}` : statusInfo.label,
      trackingNumber: matched.trackingCode
    }
  };
}

// -------------------------------------------------------------
// 7. GET SHIPPING STATUS (Cadete & Tracking)
// -------------------------------------------------------------
export function getShippingStatus(
  orders: Order[],
  trackingCode: string
): {
  order: Order | null;
  message: string;
} {
  const clean = (trackingCode || '').trim().toLowerCase();
  const matched = (orders || []).find(o => 
    (o?.trackingCode && o.trackingCode.toLowerCase() === clean) ||
    (o?.id && o.id.toLowerCase() === clean) ||
    (o?.orderNumber && o.orderNumber.replace('#', '').toLowerCase() === clean)
  );

  if (!matched) {
    return {
      order: null,
      message: `No encontramos envíos asociados al código "${trackingCode}". Podés consultar con tu número de pedido #VON-XXXXXX.`
    };
  }

  const shippingStatusLabels: Record<string, string> = {
    pending_assignment: '⏳ En espera de asignación de cadete',
    assigned: '📋 Cadete asignado para retiro en depósito',
    in_transit: '🛵 En reparto hacia tu domicilio',
    delivered: '✅ Entregado en destino',
    failed_attempt: '⚠️ Intento de entrega sin éxito (reprogramando)',
    rescheduled: '🗓️ Entrega reprogramada'
  };

  const statusLabel = matched.shippingStatus 
    ? (shippingStatusLabels[matched.shippingStatus] || matched.shippingStatus)
    : 'En proceso';

  let msg = `🚚 **Seguimiento de Envío - Pedido ${matched.orderNumber}**\n\n`;
  msg += `• **Estado de entrega**: ${statusLabel}\n`;
  if (matched.assignedCourierName) {
    msg += `• **Repartidor**: ${matched.assignedCourierName}\n`;
  }
  if (matched.trackingCode) {
    msg += `• **Guía / Tracking**: \`${matched.trackingCode}\`\n`;
  }
  if (matched.shippingZoneName) {
    msg += `• **Zona de entrega**: ${matched.shippingZoneName}\n`;
  }

  return {
    order: matched,
    message: msg
  };
}

function mapToThumbnails(products: Product[]): AssistantProductThumbnail[] {
  return products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.salePrice,
    originalPrice: p.originalPrice,
    image: p.images && p.images.length > 0 ? p.images[0] : undefined,
    stock: p.stock,
    stockStatus: p.stockStatus,
    category: p.categoryId
  }));
}

// -------------------------------------------------------------
// 8. NATURAL LANGUAGE PROCESSOR & INTENT ENGINE (Argentine Context)
// -------------------------------------------------------------
export function processNaturalLanguageQuery(
  rawInput: string,
  context: AssistantContext
): AssistantEngineResult {
  const input = rawInput.trim();
  // Strip emojis, symbols, and punctuation for cleaner natural language matching
  const cleanInput = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[🔎📦💰🛒📋🚚📍💳❓👤✨🔥⚡💡📱🎧🏷️]/gu, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = cleanInput.toLowerCase() || input.toLowerCase();

  // A. GREETINGS & INTRO
  if (/^(hola|buenas|buen d[ií]a|buenas tardes|buenas noches|hola que tal|alo|hey|inicio|empezar)$/i.test(lower)) {
    const featuredProds = context.products.filter(p => p.stock > 0).slice(0, 2);
    return {
      text: `¡Hola 👋! Soy el Asistente Inteligente de **VONDRO** Córdoba.\n\n¿En qué te puedo ayudar? Podés consultar productos, stock, envíos o seguir tu pedido.`,
      intent: 'greeting',
      confidence: 1.0,
      productThumbnails: mapToThumbnails(featuredProds),
      quickReplies: DEFAULT_QUICK_REPLIES
    };
  }

  // A0. NEW ARRIVALS / RESTOCKED / AUDIT UPDATES
  if (/(novedad|novedades|lo nuevo|productos nuevos|que ingreso|recien llegado|reposicion|reposiciones|auditoria)/i.test(lower)) {
    const newOrRestocked = context.products
      .filter(p => p.stock > 0 && p.stockStatus !== 'out_of_stock' && (p.isNew || p.isRestocked))
      .slice(0, 4);
    const items = newOrRestocked.length > 0
      ? newOrRestocked
      : context.products.filter(p => p.stock > 0).slice(0, 4);

    return {
      text: `✨ **Novedades e Ingresos Recientes con Stock en VONDRO**\n\nAcá tenés las últimas incorporaciones y reposiciones disponibles ahora mismo:`,
      actionType: 'PRODUCT_LIST',
      actionData: items,
      productThumbnails: mapToThumbnails(items),
      intent: 'new_arrivals',
      confidence: 1.0,
      quickReplies: [
        { label: '🔎 Buscar productos', action: 'search_prompt', payload: 'buscar productos' },
        { label: '🚚 Envíos en Córdoba', action: 'shipping_info', payload: 'costos de envío en Córdoba' }
      ]
    };
  }

  // A1. UNSUPPORTED PRODUCTS (checked only if truly zero matches in catalog)
  if (/(diamante|diamantes|joya|joyas|joyeria|anillo|oro|plata|zapatillas|calzado)/i.test(lower)) {
    const checkExisting = searchProducts(context.products, { query: lower, limit: 2 });
    if (checkExisting.length === 0) {
      return {
        text: `En **VONDRO** no comercializamos ese tipo de artículos. Trabajamos hogar, bazar, decoración, tecnología, audio, iluminación, cocina, termos, herramientas y más.\n\n¿Te gustaría buscar algún producto de nuestros rubros?`,
        intent: 'unsupported_category',
        confidence: 1.0,
        quickReplies: [
          { label: '🔎 Ver catálogo', action: 'search_prompt', payload: 'buscar productos' },
          { label: '👤 Hablar con un asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' }
        ]
      };
    }
  }

  // A2. DELIVERY TIME / CUANTO DEMORA EL ENVIO
  if (/(cuanto demora|cuanto tarda|tiempo de entrega|cuando llega|demora el envio|demoran los envios|plazo de entrega)/i.test(lower)) {
    return {
      text: `🚚 **Tiempos de entrega VONDRO:**\n\n• **Córdoba Capital**: En el día o en 24 a 48 hs hábiles con cadetería propia.\n• **Interior y resto del país**: De 2 a 5 días hábiles.\n\n¿Querés consultar la entrega para tu barrio o zona?`,
      intent: 'delivery_time',
      confidence: 1.0,
      quickReplies: [
        { label: '📍 Calcular costo de envío', action: 'shipping_info' },
        { label: '📦 Estado de mi pedido', action: 'my_orders' },
        { label: '👤 Hablar con un asesor', action: 'request_agent' }
      ]
    };
  }

  // A3. SUPPORT / RECLAMOS / QUEJAS
  if (/(soporte|reclamo|reclamos|queja|falla|roto|averiado|devolucion|cambio|garantia|ayuda con reclamo)/i.test(lower)) {
    return {
      text: `🛡️ **Soporte y Garantía Oficial VONDRO**\n\nTodos nuestros productos cuentan con **90 días de garantía**. Para gestionar un cambio, reclamo o asistencia técnica inmediata, te conectamos con nuestro equipo:`,
      actionType: 'AGENT_HANDOFF',
      requiresHumanHandoff: true,
      intent: 'support_claim',
      confidence: 1.0,
      quickReplies: [
        { label: '👤 Hablar con un asesor', action: 'request_agent' },
        { label: '📝 Iniciar ticket', action: 'ticket_form' },
        { label: '🔙 Menú principal', action: 'main_menu' }
      ]
    };
  }

  // A4. ORDER NUMBER HELP
  if (/(numero de pedido|codigo de pedido|donde veo mi pedido|como saber mi pedido|cual es mi pedido)/i.test(lower)) {
    return {
      text: `📋 Tu número de pedido comienza con **#VON-** (ej: \`#VON-1042\`) y te llega por confirmación de compra.\n\nPodés escribirlo acá para consultar su estado en vivo o verlo en la pestaña **Mis Pedidos**.`,
      intent: 'order_number_help',
      confidence: 1.0,
      quickReplies: [
        { label: '📋 Ver mis pedidos', action: 'my_orders' },
        { label: '👤 Hablar con un asesor', action: 'request_agent' }
      ]
    };
  }

  // B. TALK WITH HUMAN ADVISOR (Handoff)
  if (/(asesor|humano|persona|agente|atencion al cliente|hablar con alguien|humana|representante|soporte humano|quiero hablar con un asesor)/i.test(lower)) {
    return {
      text: `👤 **Conexión con Asesor Humano VONDRO**\n\nUn integrante de nuestro equipo de atención personalizada en Córdoba tomará tu consulta de inmediato.\n\nPodés dejarnos escrito tu mensaje, duda o número de pedido mientras te asignamos a un asesor.`,
      actionType: 'AGENT_HANDOFF',
      requiresHumanHandoff: true,
      intent: 'human_advisor',
      confidence: 1.0,
      quickReplies: [
        { label: '📝 Dejar número de pedido', action: 'ticket_form' },
        { label: '❓ Ver preguntas frecuentes', action: 'show_faq' },
        { label: '🔙 Volver al menú', action: 'main_menu' }
      ]
    };
  }

  // C. MY ORDERS / ORDER LOOKUP
  if (/(mi pedido|mis pedidos|estado de mi compra|donde esta mi pedido|consultar pedido|ver mi pedido|orden|mis compras|consultar estado de mi pedido|consultar estado de pedido)/i.test(lower)) {
    // Check if user specified an order number in the text (e.g., #VON-000001 or VON-101)
    const orderMatch = lower.match(/(#?von-?\d{1,8})/i);
    if (orderMatch) {
      const orderInfo = getOrderStatus(context.orders, orderMatch[1], context.currentUser);
      return {
        text: orderInfo.message,
        actionType: orderInfo.order ? 'ORDER_TRACKING' : undefined,
        actionData: orderInfo.order || undefined,
        orderSummary: orderInfo.orderSummary,
        intent: 'order_status_specific',
        confidence: 1.0,
        quickReplies: [
          { label: '🚚 Rastrear con cadete', action: `track_${orderMatch[1]}` },
          { label: '📋 Ver otros pedidos', action: 'my_orders', payload: 'consultar estado de mi pedido' },
          { label: '👤 Hablar con un asesor', action: 'request_agent' },
          { label: '🔙 Menú principal', action: 'main_menu' }
        ]
      };
    }

    // Retrieve user orders or recent system/session orders
    const userOrders = getUserOrders(context.orders, context.currentUser);
    if (userOrders.length > 0) {
      const recentOrders = userOrders.slice(0, 3);
      
      let msg = `📋 **Tus Últimos Pedidos Registrados**\n\n`;
      msg += `Encontré ${recentOrders.length === 1 ? 'tu pedido más reciente' : `tus últimos ${recentOrders.length} pedidos`} en nuestro sistema:\n\n`;

      recentOrders.forEach((o, idx) => {
        const statusInfo = getFriendlyStatusLabel(o.status);
        const orderDate = o.createdAt 
          ? new Date(o.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : 'Reciente';
        const itemCount = o.items ? o.items.reduce((s, it) => s + it.quantity, 0) : 0;

        msg += `**${idx + 1}. Pedido ${o.orderNumber}**\n`;
        msg += `• Estado: ${statusInfo.emoji} **${statusInfo.label}**\n`;
        msg += `• Total: **$${(o.total ?? 0).toLocaleString('es-AR')}** (${itemCount} ${itemCount === 1 ? 'producto' : 'productos'})\n`;
        msg += `• Fecha: ${orderDate}\n\n`;
      });

      msg += `👇 *Hacé clic en los botones para ver el detalle en tiempo real o el seguimiento de entrega:*`;

      const quickReplies: AssistantQuickReply[] = recentOrders.map(o => {
        const statusInfo = getFriendlyStatusLabel(o.status);
        return {
          label: `${statusInfo.emoji} ${o.orderNumber}`,
          action: `order_status_${o.orderNumber}`,
          payload: `consultar estado de pedido ${o.orderNumber}`
        };
      });

      quickReplies.push(
        { label: '🔎 Ingresar otro número', action: 'track_order_prompt' },
        { label: '👤 Hablar con un asesor', action: 'request_agent' },
        { label: '🔙 Menú principal', action: 'main_menu' }
      );

      return {
        text: msg,
        actionType: 'ORDER_TRACKING',
        actionData: recentOrders[0],
        intent: 'order_status_list',
        confidence: 1.0,
        orderSummary: {
          id: recentOrders[0].id,
          orderNumber: recentOrders[0].orderNumber,
          total: recentOrders[0].total,
          status: getFriendlyStatusLabel(recentOrders[0].status).label,
          shippingStatus: recentOrders[0].assignedCourierName ? `Con cadete ${recentOrders[0].assignedCourierName}` : getFriendlyStatusLabel(recentOrders[0].status).label,
          trackingNumber: recentOrders[0].trackingCode
        },
        quickReplies
      };
    }

    return {
      text: `📋 **Consulta de Pedidos**\n\nPor favor escribí tu número de pedido (ejemplo: \`#VON-000001\`) o tu código de seguimiento para buscarlo de inmediato en nuestro sistema.`,
      intent: 'order_status_prompt',
      confidence: 0.9,
      quickReplies: [
        { label: '🚚 Rastrear con guía', action: 'track_order_prompt' },
        { label: '👤 Hablar con un asesor', action: 'request_agent' },
        { label: '🔙 Menú principal', action: 'main_menu' }
      ]
    };
  }

  // D. TRACKING / COURIER
  if (/(seguimiento|tracking|cadete|donde viene|reparto|en camino|guia)/i.test(lower)) {
    const trkMatch = lower.match(/(von-trk-\d{1,8}|#?von-\d{1,8})/i);
    if (trkMatch) {
      const res = getShippingStatus(context.orders, trkMatch[1]);
      return {
        text: res.message,
        actionType: res.order ? 'ORDER_TRACKING' : undefined,
        actionData: res.order || undefined,
        intent: 'tracking_specific',
        confidence: 1.0,
        quickReplies: [
          { label: '👤 Consultar al asesor', action: 'request_agent' },
          { label: '🔙 Menú principal', action: 'main_menu' }
        ]
      };
    }

    return {
      text: `🚚 **Seguimiento de Envíos en Tiempo Real**\n\nIngresá tu código de seguimiento (ej: \`VON-TRK-000001\`) o tu número de pedido para conocer la ubicación del cadete y hora estimada de llegada.`,
      intent: 'tracking_prompt',
      confidence: 0.9,
      quickReplies: [
        { label: '📍 Ver zonas y tarifas', action: 'shipping_info' },
        { label: '👤 Hablar con un asesor', action: 'request_agent' },
        { label: '🔙 Menú principal', action: 'main_menu' }
      ]
    };
  }

  // E. SHIPPING / ENVIOS & COST CALCULATOR
  if (/(env[ií]o|envios|costo de envio|costos y zonas de env[ií]o|cuanto cuesta el envio|envio gratis|gratis|zona|flete|cadeteria|a domicilio|cordoba|cba)/i.test(lower)) {
    const calc = getShippingCost(context.settings, {
      subtotal: context.cartSubtotal || (context.cartItemsCount ? 15000 : 0)
    });

    return {
      text: calc.message,
      actionType: 'SHIPPING_CALC',
      actionData: calc,
      intent: 'shipping_info',
      confidence: 1.0,
      quickReplies: [
        { label: '🔎 Ver productos en catálogo', action: 'search_prompt', payload: 'buscar productos' },
        { label: '🛒 Ver mi carrito', action: 'view_cart' },
        { label: '💳 Medios de pago', action: 'payment_info', payload: 'medios de pago y cuotas' },
        { label: '🔙 Menú principal', action: 'main_menu' }
      ]
    };
  }

  // F. PAYMENTS / MEDIOS DE PAGO
  if (/(pago|pagos|medios de pago|tarjeta|mercado pago|transferencia|efectivo|cuotas|alias|cbu|factura)/i.test(lower)) {
    const paymentMsg = `💳 **Medios de Pago Disponibles en VONDRO**\n\n` +
      `1. **Mercado Pago (Online)**:\n` +
      `   • Tarjetas de crédito (con opción en cuotas).\n` +
      `   • Tarjetas de débito (Visa Débito, Mastercard Débito, Cabal).\n` +
      `   • Dinero en cuenta de Mercado Pago con acreditación inmediata.\n\n` +
      `2. **Transferencia Bancaria Directa**:\n` +
      `   • Alias oficial: \`VONDRO.CORDOBA\`\n` +
      `   • Acreditación rápida y confirmación automática.\n\n` +
      `3. **Efectivo Contra Entrega**:\n` +
      `   • Abonás en mano al cadete al recibir tu pedido en Córdoba Capital.\n\n` +
      `🔒 *Todas tus transacciones cuentan con cifrado y garantía oficial.*`;

    return {
      text: paymentMsg,
      intent: 'payment_info',
      confidence: 1.0,
      quickReplies: [
        { label: '🚚 Consultar envíos', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
        { label: '🔎 Buscar productos', action: 'search_prompt', payload: 'buscar productos' },
        { label: '❓ Preguntas frecuentes', action: 'show_faq', payload: 'preguntas frecuentes de la tienda' },
        { label: '🔙 Menú principal', action: 'main_menu' }
      ]
    };
  }

  // G. HOW TO BUY / PURCHASE HELP
  if (/(ayuda para realizar una compra|ayuda para comprar|como comprar|como realizo una compra|pasos para comprar|como compro|como es el proceso)/i.test(lower)) {
    const buyHelpMsg = `🛒 **¿Cómo comprar en VONDRO? ¡Es muy fácil!**\n\n` +
      `1️⃣ **Elegí tus productos**: Explorá nuestro catálogo o buscá por categoría y agregá los artículos que desees al carrito.\n\n` +
      `2️⃣ **Ingresá tus datos de entrega**: Seleccioná tu barrio en Córdoba Capital para calcular el costo de cadetería o retiro en punto céntrico.\n\n` +
      `3️⃣ **Elegí tu medio de pago**: Aboná seguro con Mercado Pago (tarjetas/cuotas), Transferencia bancaria directa o Efectivo contra entrega.\n\n` +
      `4️⃣ **Recibí en tu puerta**: Nuestro cadete asignado te lo entrega en 24 a 48 hs con seguimiento en vivo.\n\n` +
      `💡 *¿Querés que te recomiende los artículos más vendidos hoy?*`;

    const featured = context.products.filter(p => p.stock > 0).slice(0, 3);

    return {
      text: buyHelpMsg,
      intent: 'purchase_help',
      confidence: 1.0,
      productThumbnails: mapToThumbnails(featured),
      quickReplies: [
        { label: '🔎 Ver todo el catálogo', action: 'search_prompt', payload: 'buscar productos' },
        { label: '📦 Disponibilidad de stock', action: 'stock_prompt', payload: 'consultar disponibilidad de stock' },
        { label: '🚚 Envíos en Córdoba', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
        { label: '👤 Hablar con asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' }
      ]
    };
  }

  // H. PRICES & PROMOTIONS (Precios, ofertas, promociones, descuentos)
  if (/(consultar precios|precios y promociones|precios|promociones|ofertas|oferta|descuentos|descuento|cupon|promos|baratos)/i.test(lower)) {
    // Find products on sale or with discount
    const saleProducts = context.products
      .filter(p => p.isOnSale || (p.originalPrice && p.originalPrice > p.salePrice))
      .slice(0, 4);

    const productsToShow = saleProducts.length > 0 ? saleProducts : context.products.slice(0, 4);

    const promoMsg = `💰 **Precios y Promociones Exclusivas VONDRO**\n\n` +
      `✨ **¡ENVÍO GRATIS!** en Córdoba Capital en compras desde $100.000.\n` +
      `💳 **Cuotas y promociones** con Mercado Pago y transferencia directa.\n` +
      `🛡️ **Garantía total de 90 días** con reposición inmediata.\n\n` +
      `🔥 *Aquí tenés las mejores ofertas destacadas del momento:*`;

    return {
      text: promoMsg,
      actionType: 'PRODUCT_LIST',
      actionData: productsToShow,
      productThumbnails: mapToThumbnails(productsToShow),
      intent: 'pricing_promotions',
      confidence: 1.0,
      quickReplies: [
        { label: '📦 Disponibilidad de stock', action: 'stock_prompt', payload: 'consultar disponibilidad de stock' },
        { label: '🚚 Zonas de envío', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
        { label: '💳 Medios de pago', action: 'payment_info', payload: 'medios de pago y cuotas' },
        { label: '🔙 Menú principal', action: 'main_menu' }
      ]
    };
  }

  // I. STOCK CHECK & AVAILABILITY & COMBINED SEARCH
  if (/(buscar productos y disponibilidad|disponibilidad de productos|consultar disponibilidad de stock|disponibilidad de stock|consultar disponibilidad|consultar stock|disponibilidad|hay stock|tienen stock|hay unidades)/i.test(lower)) {
    // Check if user specified a specific product name
    const cleanTerm = lower
      .replace(/buscar productos y disponibilidad|disponibilidad de productos|consultar disponibilidad de stock|disponibilidad de stock|consultar disponibilidad|consultar stock|buscar productos y|buscar productos|buscar producto|buscar|hay stock de|hay stock|tienen stock de|tienen stock|disponibilidad de|disponibilidad|hay unidades de|hay unidades|stock de|stock|tienen|tenes|tendra|tendran|tienen disponible|disponible/gi, '')
      .trim();

    if (cleanTerm.length >= 2 && !/^(de|un|una|el|la|los|las|y|o|en|para|productos?|art[ií]culos?)$/i.test(cleanTerm)) {
      const results = searchProducts(context.products, { query: cleanTerm, limit: 4 });
      if (results.length > 0) {
        let msg = `📦 **Disponibilidad para "${cleanTerm}":**\n\n`;
        results.forEach(p => {
          const stockLabel = p.stock > 5 ? `🟢 En stock (${p.stock} u. disponibles)` : p.stock > 0 ? `🟡 Últimas ${p.stock} unidades` : `🔴 Agotado momentáneamente`;
          msg += `• **${p.name}**\n  Precio: **$${(p.salePrice ?? 0).toLocaleString('es-AR')}** | Estado: ${stockLabel}\n\n`;
        });
        msg += `👇 *Podés agregarlo directo al carrito o ver más detalles:*`;

        return {
          text: msg,
          actionType: 'PRODUCT_LIST',
          actionData: results,
          productThumbnails: mapToThumbnails(results),
          intent: 'stock_specific',
          confidence: 1.0,
          quickReplies: [
            { label: '🚚 Calcular costo de envío', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
            { label: '💳 Ver medios de pago', action: 'payment_info', payload: 'medios de pago y cuotas' },
            { label: '👤 Hablar con asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' },
            { label: '🔙 Menú principal', action: 'main_menu' }
          ]
        };
      } else {
        // Specific term was asked but not found in catalog
        return {
          text: `📦 No encontramos disponibilidad para **"${cleanTerm}"** en nuestro catálogo. Nos especializamos en tecnología, audio, iluminación, cocina, termos y bazar.\n\n¿Te gustaría buscar alguna otra cosa?`,
          intent: 'stock_not_found',
          confidence: 0.95,
          quickReplies: [
            { label: '🔎 Ver todo el catálogo', action: 'search_prompt', payload: 'buscar productos' },
            { label: '👤 Consultar con asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' },
            { label: '🔙 Menú principal', action: 'main_menu' }
          ]
        };
      }
    }

    // Generic Stock & Availability Query (e.g. user clicked "📦 Disponibilidad" or "Buscar productos y disponibilidad")
    const inStockProds = context.products.filter(p => p.stock > 0).slice(0, 2);

    const stockGeneralMsg = `📦 **Disponibilidad de Stock en Córdoba:**\n\nTodos nuestros artículos se despachan desde depósito propio en Córdoba Capital con entrega inmediata:`;

    return {
      text: stockGeneralMsg,
      actionType: 'PRODUCT_LIST',
      actionData: inStockProds,
      productThumbnails: mapToThumbnails(inStockProds),
      intent: 'stock_general',
      confidence: 1.0,
      quickReplies: [
        { label: '🔎 Ver todo el catálogo', action: 'search_prompt', payload: 'buscar productos' },
        { label: '💰 Ver ofertas', action: 'price_prompt', payload: 'consultar precios y promociones' },
        { label: '🚚 Envíos en Córdoba', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
        { label: '👤 Consultar con asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' }
      ]
    };
  }

  // J. PRODUCT SEARCH / CATALOG / CATEGORIES
  if (/(buscar productos|buscar producto|buscar|busco|catalogo|ver catalogo|ver productos|que venden|productos|articulos|tienda|que tienen|que tenes|mostrar productos|explorar catalogo)/i.test(lower)) {
    const searchWord = lower
      .replace(/buscar productos y disponibilidad|buscar productos y|buscar productos|buscar producto|buscar|busco|quiero comprar|quiero|comprar|necesito|mostrame|ver catalogo|ver productos|ver|catalogo|que venden|productos|articulos|tienda|que tienen|que tenes/gi, '')
      .trim();

    // If a specific keyword was searched
    if (searchWord.length >= 2 && !/^(de|un|una|el|la|los|las|y|o|en|para)$/i.test(searchWord)) {
      const matchedProducts = searchProducts(context.products, {
        query: searchWord,
        limit: 4
      });

      if (matchedProducts.length > 0) {
        return {
          text: `🔎 **Resultados para "${searchWord}" en VONDRO:**`,
          actionType: 'PRODUCT_LIST',
          actionData: matchedProducts,
          productThumbnails: mapToThumbnails(matchedProducts),
          intent: 'product_search_specific',
          confidence: 1.0,
          quickReplies: [
            { label: '📦 Consultar stock', action: 'stock_prompt', payload: 'consultar disponibilidad de stock' },
            { label: '📍 Calcular costo de envío', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
            { label: '💳 Opciones de pago', action: 'payment_info', payload: 'medios de pago y cuotas' },
            { label: '👤 Hablar con un asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' }
          ]
        };
      } else {
        return {
          text: `🔎 No encontramos artículos para **"${searchWord}"** en nuestro catálogo actual. Trabajamos hogar, bazar, decoración, tecnología, audio, iluminación, cocina, termos y herramientas.\n\n¿Te gustaría explorar alguna de nuestras categorías?`,
          intent: 'product_search_not_found',
          confidence: 0.95,
          quickReplies: [
            { label: '🔎 Ver categorías', action: 'search_prompt', payload: 'buscar productos' },
            { label: '👤 Consultar con asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' },
            { label: '🔙 Menú principal', action: 'main_menu' }
          ]
        };
      }
    }

    // Generic Catalog prompt (e.g. user clicked "🔎 Buscar productos")
    const topProducts = context.products.filter(p => p.stock > 0).slice(0, 4);

    return {
      text: `🔍 **Productos destacados en VONDRO:**`,
      actionType: 'PRODUCT_LIST',
      actionData: topProducts,
      productThumbnails: mapToThumbnails(topProducts),
      intent: 'catalog_overview',
      confidence: 1.0,
      quickReplies: [
        { label: '🏷️ Hogar & Cocina', action: 'cat_hogar', payload: 'productos de hogar y cocina' },
        { label: '📱 Tecnología', action: 'cat_tech', payload: 'productos de tecnologia' },
        { label: '🎧 Audio & Sonido', action: 'cat_audio', payload: 'auriculares y audio' },
        { label: '🥤 Vasos & Botellas', action: 'cat_vasos', payload: 'vasos y botellas' },
        { label: '🚚 Envíos en Córdoba', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' }
      ]
    };
  }

  // K. CATEGORY-SPECIFIC QUERIES
  if (/(hogar|bazar|decoracion|alfombra|alfombras|cocina|baño|bano|limpieza|organizacion|tecnologia|tech|celular|cargador|audio|auricular|auriculares|parlante|iluminacion|luces|lampara|foco|navidad|accesorios|vasos|botellas|termos|herramientas|belleza|infantil|juguetes|ventilador)/i.test(lower)) {
    const matched = searchProducts(context.products, { query: lower, limit: 4 });
    if (matched.length > 0) {
      return {
        text: `✨ **Opciones destacadas encontradas en VONDRO:**`,
        actionType: 'PRODUCT_LIST',
        actionData: matched,
        productThumbnails: mapToThumbnails(matched),
        intent: 'category_results',
        confidence: 1.0,
        quickReplies: [
          { label: '📦 Disponibilidad de stock', action: 'stock_prompt', payload: 'consultar disponibilidad de stock' },
          { label: '🚚 Calcular envío', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
          { label: '💳 Opciones de pago', action: 'payment_info', payload: 'medios de pago y cuotas' },
          { label: '🔙 Menú principal', action: 'main_menu' }
        ]
      };
    }
  }

  // L. SUPPORT CLAIM / DAMAGES / RETURNS / COMPLAINTS
  if (/(reclamo|devoluci[oó]n|cambio|roto|defectuoso|falla|no funciona|cable roto|cancelar|problema|error|no me llego)/i.test(lower)) {
    let reason: SupportTicketReason = 'falla_rotura';
    let label = 'Producto con falla / daño';

    if (/roto|falla|defectuoso|no funciona|da[nñ]ado/i.test(lower)) {
      reason = 'falla_rotura';
      label = 'Producto con falla / daño';
    } else if (/no llego|demora|tarde/i.test(lower)) {
      reason = 'demora_envio';
      label = 'Demora en la entrega';
    } else if (/cancelar|cancelacion/i.test(lower)) {
      reason = 'cancelacion';
      label = 'Cancelación de pedido';
    } else if (/cambio|cambiar|devolucion/i.test(lower)) {
      reason = 'cambio_devolucion';
      label = 'Cambio o devolución';
    } else if (/pago|cobro|duplicado/i.test(lower)) {
      reason = 'reclamo_pago';
      label = 'Inconveniente con el pago';
    }

    return {
      text: `🛠️ **Soporte & Garantía Oficial VONDRO**\n\nEn VONDRO contás con **90 días de garantía total**. Si tu producto presentó alguna falla, rotura o demora, podés abrir un Ticket de Soporte directo para darle prioridad de resolución.`,
      suggestedTicket: {
        reason,
        reasonLabel: label,
        priority: 'alta',
        message: input
      },
      actionType: 'TICKET_CREATED',
      intent: 'support_claim',
      confidence: 1.0,
      quickReplies: [
        { label: '📝 Abrir Ticket de Soporte', action: 'open_ticket_modal' },
        { label: '👤 Hablar con un asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' },
        { label: '❓ Ver políticas de garantía', action: 'faq_cambios', payload: 'preguntas frecuentes de la tienda' }
      ]
    };
  }

  // M. FAQS AND HELP
  if (/(ayuda|faq|preguntas frecuentes|preguntas|como compro|garantia|contacto|horario|telefono|atencion)/i.test(lower)) {
    return {
      text: `❓ **Centro de Ayuda & Preguntas Frecuentes VONDRO**\n\n¿Sobre qué tema necesitás información? Seleccioná una categoría para ver respuestas instantáneas:`,
      actionType: 'FAQ_LIST',
      actionData: context.faqs || [],
      intent: 'faqs_overview',
      confidence: 1.0,
      quickReplies: [
        { label: '🛒 ¿Cómo comprar?', action: 'buy_help', payload: 'ayuda para realizar una compra' },
        { label: '💳 Medios de pago y cuotas', action: 'payment_info', payload: 'medios de pago y cuotas' },
        { label: '🚚 Costos de envío en Córdoba', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
        { label: '🛡️ Garantías y devoluciones', action: 'faq_cambios', payload: 'reclamos y devoluciones' },
        { label: '👤 Hablar con un asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' }
      ]
    };
  }

  // N. GENERIC SMART PRODUCT MATCH FALLBACK
  const genericSearch = searchProducts(context.products, { query: lower, limit: 3 });
  if (genericSearch.length > 0) {
    return {
      text: `Encontré los siguientes productos relacionados con "${input}". ¿Te gustaría conocer más detalles o consultar disponibilidad?`,
      actionType: 'PRODUCT_LIST',
      actionData: genericSearch,
      productThumbnails: mapToThumbnails(genericSearch),
      intent: 'smart_match',
      confidence: 0.85,
      quickReplies: [
        { label: '📦 Consultar stock', action: 'stock_prompt', payload: 'consultar disponibilidad de stock' },
        { label: '🚚 Calcular envío', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
        { label: '👤 Hablar con un asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' }
      ]
    };
  }

  // O. FINAL SMART FALLBACK (Providing helpful concise guidance without random products)
  return {
    text: `¿En qué te puedo ayudar respecto a "${input}"? Podés buscar productos de nuestro catálogo, consultar envíos o hablar con un asesor oficial:`,
    unresolved: false,
    intent: 'general_guidance',
    confidence: 0.75,
    quickReplies: [
      { label: '🔎 Buscar productos', action: 'search_prompt', payload: 'buscar productos' },
      { label: '📦 Disponibilidad', action: 'stock_prompt', payload: 'consultar disponibilidad de stock' },
      { label: '🚚 Envíos en Córdoba', action: 'shipping_info', payload: 'costos y zonas de envío en Córdoba' },
      { label: '💳 Medios de pago', action: 'payment_info', payload: 'medios de pago' },
      { label: '👤 Hablar con asesor', action: 'request_agent', payload: 'quiero hablar con un asesor humano' }
    ]
  };
}
