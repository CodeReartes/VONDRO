import { Order, Product } from '../types';

/**
 * Generates and triggers download of a UTF-8 BOM CSV file (Compatible directly with Excel & Google Sheets)
 */
function downloadCSV(filename: string, csvContent: string) {
  // UTF-8 BOM (\uFEFF) ensures Excel opens special characters (tildes, ñ, $, etc.) without encoding bugs
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a field for CSV escaping quotes and semicolons/commas
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * 1. REPORTE COMPLETO DE VENTAS Y FACTURACIÓN
 * Incluye datos de cliente, desglose de montos, costos y márgenes de ganancia.
 */
export function exportOrdersAccountingCSV(orders: Order[], products: Product[] = []) {
  const headers = [
    'Nro Pedido',
    'Fecha y Hora',
    'Estado Pedido',
    'Cliente Nombre',
    'DNI / CUIT',
    'Telefono',
    'Email',
    'Direccion',
    'Barrio / Zona Cordoba',
    'Ciudad',
    'Metodo de Pago',
    'PIN Entrega',
    'Tracking Code',
    'Items Comprados (Resumen)',
    'Cantidad Total Unidades',
    'Subtotal Bruto (ARS)',
    'Descuento Cupon (ARS)',
    'Costo de Envio (ARS)',
    'Total Cobrado (ARS)',
    'Costo Estimado Mercaderia COGS (ARS)',
    'Ganancia Bruta Estimada (ARS)',
    'Margen Bruto %'
  ];

  const productMap = new Map(products.map(p => [p.id, p]));

  const rows = orders.map(order => {
    const customer = order.customer || ({} as any);
    const customerName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Cliente';
    const address = customer.address || `${customer.street || ''} ${customer.number || ''}`.trim() || 'Córdoba';
    
    // Calculate units & cost of goods sold
    let totalUnits = 0;
    let totalCogs = 0;
    const itemsSummary = (order.items || []).map(it => {
      totalUnits += it.quantity || 1;
      const prod = productMap.get(it.productId);
      const unitCost = prod?.costPrice || ((it.salePrice || it.price) ? (it.salePrice || it.price || 0) * 0.65 : 0);
      totalCogs += unitCost * (it.quantity || 1);
      return `${it.quantity}x ${it.name} ($${it.salePrice || it.price || 0})`;
    }).join(' | ');

    const subtotal = Number(order.subtotal || order.total || 0);
    const discount = Number(order.discountAmount || order.couponDiscount || 0);
    const shipping = Number(order.shippingCost || 0);
    const total = Number(order.total || 0);
    const grossProfit = Math.max(0, total - totalCogs - shipping);
    const marginPct = total > 0 ? ((grossProfit / total) * 100).toFixed(1) + '%' : '0%';

    let dateStr = '';
    try {
      dateStr = new Date(order.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' });
    } catch {
      dateStr = String(order.createdAt);
    }

    return [
      escapeCSV(order.orderNumber),
      escapeCSV(dateStr),
      escapeCSV(order.status),
      escapeCSV(customerName),
      escapeCSV(customer.dni || ''),
      escapeCSV(customer.phone || ''),
      escapeCSV(customer.email || ''),
      escapeCSV(address),
      escapeCSV(customer.neighborhood || order.shippingZoneId || 'Centro'),
      escapeCSV(customer.city || 'Córdoba Capital'),
      escapeCSV(order.paymentMethod || 'transfer'),
      escapeCSV(order.deliveryConfirmationCode || order.deliveryPin || '4829'),
      escapeCSV(order.trackingCode || `VON-${order.orderNumber}`),
      escapeCSV(itemsSummary),
      totalUnits,
      subtotal,
      discount,
      shipping,
      total,
      Math.round(totalCogs),
      Math.round(grossProfit),
      escapeCSV(marginPct)
    ].join(';');
  });

  const csvContent = [headers.join(';'), ...rows].join('\r\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`VONDRO_Reporte_Ventas_Contable_${timestamp}.csv`, csvContent);
}

/**
 * 2. REPORTE DE LIQUIDACIÓN DE CADETERÍA Y LOGÍSTICA
 * Agrupa por zonas de Córdoba y cadetes asignados.
 */
export function exportLogisticsSettlementCSV(orders: Order[]) {
  const headers = [
    'Nro Pedido',
    'Fecha',
    'Cliente',
    'Telefono',
    'Direccion de Entrega',
    'Zona Tarifaria Cordoba',
    'Cadeteria / Repartidor',
    'PIN Validacion',
    'Estado Envio',
    'Costo Envio Cobrado al Cliente (ARS)',
    'Metodo de Pago',
    'Cobro en Efectivo a Rendir (ARS)'
  ];

  const rows = orders.map(order => {
    const customer = order.customer || ({} as any);
    const customerName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Cliente';
    const address = customer.address || `${customer.street || ''} ${customer.number || ''}`.trim() || 'Córdoba';
    const isCashOnDelivery = order.paymentMethod === 'cash_delivery' || (order.paymentMethod as string) === 'cash';
    const cashToCollect = isCashOnDelivery ? order.total : 0;

    let dateStr = '';
    try {
      dateStr = new Date(order.createdAt).toLocaleDateString('es-AR');
    } catch {
      dateStr = String(order.createdAt);
    }

    return [
      escapeCSV(order.orderNumber),
      escapeCSV(dateStr),
      escapeCSV(customerName),
      escapeCSV(customer.phone || ''),
      escapeCSV(`${address} (${customer.neighborhood || 'Centro'})`),
      escapeCSV(order.shippingZoneId || 'Zona Centro/Macrocentro'),
      escapeCSV(order.assignedCourierName || 'Cadetería Urbana VONDRO'),
      escapeCSV(order.deliveryConfirmationCode || order.deliveryPin || '4829'),
      escapeCSV(order.shippingStatus || order.status),
      order.shippingCost || 0,
      escapeCSV(order.paymentMethod),
      cashToCollect
    ].join(';');
  });

  const csvContent = [headers.join(';'), ...rows].join('\r\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`VONDRO_Liquidacion_Cadeteria_${timestamp}.csv`, csvContent);
}

/**
 * 3. REPORTE LIBRO IVA VENTAS SIMPLIFICADO
 * Desglose fiscal de Base Imponible, IVA 21% y Total para el contador.
 */
export function exportTaxVentasCSV(orders: Order[]) {
  const headers = [
    'Fecha',
    'Tipo Comprobante',
    'Nro Comprobante / Pedido',
    'Doc Tipo',
    'Doc Nro (DNI/CUIT)',
    'Denominacion Cliente',
    'Neto Gravado 21% (ARS)',
    'IVA Debito Fiscal 21% (ARS)',
    'Total Facturado (ARS)'
  ];

  const validOrders = orders.filter(o => o.status !== 'cancelled');

  const rows = validOrders.map(order => {
    const customer = order.customer || ({} as any);
    const customerName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Consumidor Final';
    const docType = customer.cuit ? 'CUIT' : 'DNI';
    const docNum = customer.cuit || customer.dni || '00000000';
    
    const total = Number(order.total || 0);
    // IVA 21% breakdown: Total = Neto * 1.21 => Neto = Total / 1.21
    const neto = Math.round((total / 1.21) * 100) / 100;
    const iva = Math.round((total - neto) * 100) / 100;

    let dateStr = '';
    try {
      dateStr = new Date(order.createdAt).toLocaleDateString('es-AR');
    } catch {
      dateStr = String(order.createdAt);
    }

    return [
      escapeCSV(dateStr),
      escapeCSV('Factura B / Ticket VONDRO'),
      escapeCSV(order.orderNumber),
      escapeCSV(docType),
      escapeCSV(docNum),
      escapeCSV(customerName),
      neto.toFixed(2),
      iva.toFixed(2),
      total.toFixed(2)
    ].join(';');
  });

  const csvContent = [headers.join(';'), ...rows].join('\r\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadCSV(`VONDRO_Libro_IVA_Ventas_${timestamp}.csv`, csvContent);
}
