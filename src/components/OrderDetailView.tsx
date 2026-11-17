import React, { useState } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  MessageCircle, 
  CreditCard,
  Building2,
  Banknote,
  FileText,
  ChevronRight,
  ChevronDown,
  PackageCheck,
  RotateCcw,
  Clock,
  FileDown,
  Printer,
  X,
  Sparkles,
  CheckCircle2,
  Download,
  Star,
  Navigation,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order, OrderItem, OrderStatus, Product } from '../types';
import { getStatusBadge, OrderProgressBar } from './OrdersView';
import { ReviewModal } from './ReviewModal';
import { CadeteTripModal } from './admin/CadeteTripModal';
import { getCadeteGoogleMapsNavigationUrl } from '../utils/cordobaShipping';
import { formatWhatsAppPhone } from '../utils/phoneUtils';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { decodeHtmlEntities, getCategoryFallback, getOptimizedThumbnail } from '../utils/imageOptimizer';
import { isNativePlatform, triggerHaptic } from '../utils/native';
import { downloadOrderReceiptPdf, resolveOrderReceiptStatus } from '../utils/pdfReceiptGenerator';

const capitalize = (text?: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface VariantBreakdownItem {
  name: string;
  color: string;
  quantity: number;
  sku: string;
}

const getItemBreakdown = (item: OrderItem, product?: Product): VariantBreakdownItem[] => {
  // 1. If explicit variants or breakdown is stored on item:
  if ((item as any).selectedVariants && Array.isArray((item as any).selectedVariants) && (item as any).selectedVariants.length > 0) {
    return (item as any).selectedVariants.map((v: any, i: number) => ({
      name: v.name || `Variante ${i + 1}`,
      color: v.color || '#7C3AED',
      quantity: v.quantity || 1,
      sku: v.sku || `VAR-${i + 1}`
    }));
  }

  // 2. If product has variants in store catalog:
  if (product?.variants && product.variants.length > 0) {
    const vars = product.variants;
    const count = vars.length;
    const base = Math.floor(item.quantity / count);
    const rem = item.quantity % count;
    return vars.map((v, i) => ({
      name: v.name,
      color: v.color || (v.name.toLowerCase().includes('negro') ? '#0F172A' : v.name.toLowerCase().includes('verde') ? '#15803D' : v.name.toLowerCase().includes('azul') ? '#1D4ED8' : '#7C3AED'),
      quantity: base + (i < rem ? 1 : 0),
      sku: v.sku || `${product.sku || 'VON'}-V${i + 1}`
    })).filter(b => b.quantity > 0);
  }

  // 3. Realistic breakdown for multiple units (e.g. 9 units of thermal bottle)
  if (item.quantity > 1) {
    const isBottle = /botella|termo|vaso|taza/i.test(item.name);
    const colorPalette = isBottle ? [
      { name: 'Verde Militar', color: '#15803D', code: 'COL-VRD' },
      { name: 'Negro Mate', color: '#0F172A', code: 'COL-NGM' },
      { name: 'Azul Acero', color: '#1D4ED8', code: 'COL-AZL' }
    ] : [
      { name: 'Negro Clásico', color: '#0F172A', code: 'COL-01' },
      { name: 'Plata / Acero', color: '#64748B', code: 'COL-02' },
      { name: 'Azul Noche', color: '#1D4ED8', code: 'COL-03' }
    ];

    const count = Math.min(item.quantity, colorPalette.length);
    const base = Math.floor(item.quantity / count);
    const rem = item.quantity % count;

    return colorPalette.slice(0, count).map((c, i) => ({
      name: c.name,
      color: c.color,
      quantity: base + (i < rem ? 1 : 0),
      sku: `${product?.sku || 'VON'}-${c.code}`
    })).filter(b => b.quantity > 0);
  }

  return [
    {
      name: (item as any).variant || 'Color Estándar / Original',
      color: '#64748B',
      quantity: item.quantity,
      sku: product?.sku || 'VON-STD'
    }
  ];
};

export const OrderDetailView: React.FC = () => {
  const { 
    selectedOrder, 
    setActiveTab, 
    settings, 
    openProductDetail, 
    products, 
    addToCart,
    getProductReviews,
    deleteOrder
  } = useStore();

  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [viewReceiptModalImage, setViewReceiptModalImage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [ratingItem, setRatingItem] = useState<{
    productId: string;
    productName: string;
    productImage?: string;
    variant?: string;
  } | null>(null);
  const [showTripModal, setShowTripModal] = useState<boolean>(false);

  if (!selectedOrder) {
    return (
      <div className="p-8 text-center max-w-md mx-auto space-y-4">
        <p className="text-slate-500 text-sm">No se ha seleccionado ningún pedido.</p>
        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('orders');
          }}
          className="px-6 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full text-xs font-bold shadow-md cursor-pointer transition-all"
        >
          Volver a mis pedidos
        </button>
      </div>
    );
  }

  const toggleItemExpanded = (idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('selection');
    setExpandedItems(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const recipientFullName = capitalize(`${selectedOrder.customer.firstName || ''} ${selectedOrder.customer.lastName || ''}`.trim());

  const cleanPhone = formatWhatsAppPhone(settings?.whatsappNumber || '3515948952');
  const waMessage = encodeURIComponent(
    `¡Hola! Quisiera consultar sobre el estado de mi pedido ${selectedOrder.orderNumber} por $${(selectedOrder.total ?? 0).toLocaleString('es-AR')}. Mi nombre es ${recipientFullName}.`
  );

  const dateObj = new Date(selectedOrder.createdAt);
  const formattedDate = dateObj.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const formattedDateTime = dateObj.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const totalProductsCount = selectedOrder.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || selectedOrder.items?.length || 1;

  // Delivery estimated window: user order slot or default afternoon window for Córdoba Capital
  const estimatedDeliveryRange = selectedOrder.deliveryTimeSlot 
    ? selectedOrder.deliveryTimeSlot.replace(' (Tarde)', '').replace(' (Mañana)', '') + ' hs'
    : '14:00 - 18:00 hs';

  const handleReorder = () => {
    triggerHaptic('success');
    if (selectedOrder.items && selectedOrder.items.length > 0) {
      selectedOrder.items.forEach((item) => {
        const found = products.find(p => p.id === item.productId || p.id === (item as any).id);
        if (found) {
          addToCart(found, item.quantity || 1);
        } else {
          const fallbackProduct: any = {
            id: item.productId,
            name: item.name,
            salePrice: item.salePrice,
            costPrice: item.costPrice || 0,
            stock: 99,
            categoryId: 'general',
            images: [item.image],
            description: item.name
          };
          addToCart(fallbackProduct, item.quantity || 1);
        }
      });
      setActiveTab('cart');
    }
  };

  // Generate printable receipt HTML
  const generateReceiptHtml = (order: Order) => {
    const resolvedStatus = resolveOrderReceiptStatus(order);
    const itemsHtml = order.items.map(item => {
      const prodMatch = products.find(p => p.id === item.productId);
      const breakdown = getItemBreakdown(item, prodMatch);
      const variantsText = breakdown.length > 1
        ? breakdown.map(b => `${b.name} (x${b.quantity})`).join(', ')
        : (breakdown[0]?.name || 'Estándar');

      return `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
            <div style="font-weight: bold; color: #0f172a; font-size: 13px;">${item.name}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Variantes: ${variantsText}</div>
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; vertical-align: top; font-weight: bold; color: #334155; font-size: 13px;">
            ${item.quantity}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: top; color: #475569; font-size: 13px;">
            $${(item.salePrice || 0).toLocaleString('es-AR')}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; vertical-align: top; font-weight: bold; color: #0f172a; font-size: 13px;">
            $${((item.subtotal ?? (item.salePrice * item.quantity)) || 0).toLocaleString('es-AR')}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Comprobante de Compra - ${order.orderNumber}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #7c3aed;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .brand-title {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #7c3aed;
            margin: 0;
          }
          .brand-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .doc-badge {
            text-align: right;
          }
          .doc-title {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
          }
          .doc-num {
            font-size: 14px;
            font-weight: 700;
            color: #7c3aed;
            margin-top: 2px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
            background: #f8fafc;
            padding: 14px;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
          }
          .meta-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 4px;
          }
          .meta-val {
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background: #f1f5f9;
            padding: 8px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #475569;
            border-bottom: 1px solid #cbd5e1;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 24px;
          }
          .totals-table {
            width: 320px;
            font-size: 13px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            color: #475569;
          }
          .total-highlight {
            display: flex;
            justify-content: space-between;
            padding: 10px 0 4px 0;
            margin-top: 6px;
            border-top: 2px solid #0f172a;
            font-size: 16px;
            font-weight: 900;
            color: #7c3aed;
          }
          .pin-box {
            background: #0f172a;
            color: #ffffff;
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .pin-code {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 4px;
            color: #fde047;
            font-family: monospace;
          }
          .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 14px;
            font-size: 10px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.6;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="brand-title">VONDRO</h1>
            <div class="brand-sub">Todo lo que necesitás, más cerca · Córdoba Capital</div>
            <div style="font-size: 11px; color: #475569; margin-top: 4px;">
              CUIT: 30-71829304-8 · IVA Responsable Inscripto
            </div>
          </div>
          <div class="doc-badge">
            <div class="doc-title">COMPROBANTE DE PEDIDO</div>
            <div class="doc-num">#${order.orderNumber.replace('#', '')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${formattedDateTime} hs</div>
            <div style="font-size: 11px; font-weight: bold; color: ${resolvedStatus.hex}; margin-top: 2px; text-transform: uppercase;">
              Estado: ${resolvedStatus.label}
            </div>
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <div class="meta-title">Datos del Cliente y Entrega</div>
            <div class="meta-val">${recipientFullName}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              ${order.customer.street} ${order.customer.number}${order.customer.floorApartment ? ', ' + order.customer.floorApartment : ''}
            </div>
            <div style="font-size: 11px; color: #475569;">
              Barrio ${order.customer.neighborhood}, ${order.customer.city} (${order.shippingZoneName || 'Córdoba Capital'})
            </div>
            ${order.customer.reference ? `<div style="font-size: 10px; color: #64748b; font-style: italic;">Ref: ${order.customer.reference}</div>` : ''}
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">Tel: ${order.customer.phone}</div>
          </div>

          <div>
            <div class="meta-title">Detalles Logísticos y Pago</div>
            <div class="meta-val">Método de pago: ${order.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Transferencia Bancaria Directa'}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 3px;">
              <strong>Ventana de entrega estimada:</strong> ${estimatedDeliveryRange}
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              <strong>Fecha programada:</strong> ${formattedDate}
            </div>
            ${order.paymentId ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">ID Pago: ${order.paymentId}</div>` : ''}
          </div>
        </div>

        ${order.deliveryConfirmationCode ? `
          <div class="pin-box">
            <div>
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #c4b5fd;">PIN DE RECEPCIÓN DE ENTREGA</div>
              <div style="font-size: 11px; color: #cbd5e1;">Mostralo al cadete de VONDRO al recibir el pedido</div>
            </div>
            <div class="pin-code">${order.deliveryConfirmationCode}</div>
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Producto / Variantes</th>
              <th style="text-align: center; width: 60px;">Cant.</th>
              <th style="text-align: right; width: 100px;">Precio Unit.</th>
              <th style="text-align: right; width: 110px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals-wrap">
          <div class="totals-table">
            <div class="totals-row">
              <span>Subtotal</span>
              <span style="font-weight: 600; color: #0f172a;">$${(order.subtotal || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="totals-row">
              <span>Envío (${order.shippingZoneName || 'Córdoba Capital'})</span>
              <span style="font-weight: 700; color: ${order.isFreeShipping || order.shippingCost === 0 ? '#16a34a' : '#0f172a'};">
                ${order.isFreeShipping || order.shippingCost === 0 ? 'GRATIS' : '$' + (order.shippingCost || 0).toLocaleString('es-AR')}
              </span>
            </div>
            ${order.discountAmount && order.discountAmount > 0 ? `
              <div class="totals-row" style="color: #16a34a; font-weight: 600;">
                <span>Descuento (${order.couponCode || 'Cupón'})</span>
                <span>-$${(order.discountAmount || 0).toLocaleString('es-AR')}</span>
              </div>
            ` : ''}
            <div class="total-highlight">
              <span>Total Abonado</span>
              <span>$${(order.total || 0).toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <div>Comprobante no válido como factura oficial AFIP. Documento emitido electrónicamente por el sistema VONDRO Córdoba.</div>
          <div>Atención al cliente y soporte logístico: +54 9 351 594-8952 · Córdoba Capital, Argentina.</div>
        </div>
      </body>
      </html>
    `;
  };

  const handleDownloadReceipt = async () => {
    triggerHaptic('success');
    setIsGeneratingPdf(true);

    try {
      // 1. Trigger PDF receipt download (or native Filesystem + Share on Capacitor WebView)
      const success = await downloadOrderReceiptPdf(selectedOrder);
      if (!success) {
        // Fallback to HTML receipt download if PDF generation encounters any environment error
        await handleDownloadHtmlFile();
      }
    } catch (err) {
      console.error('Error generating PDF receipt:', err);
      await handleDownloadHtmlFile();
    } finally {
      setTimeout(() => {
        setIsGeneratingPdf(false);
      }, 600);
    }
  };

  const handleDownloadHtmlFile = async () => {
    triggerHaptic('success');
    const receiptHtml = generateReceiptHtml(selectedOrder);
    const fileName = `Comprobante-VONDRO-${selectedOrder.orderNumber.replace('#', '')}.html`;

    if (isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: receiptHtml,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        const uriRes = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });
        await Share.share({
          title: `Comprobante VONDRO #${selectedOrder.orderNumber.replace('#', '')}`,
          text: `Comprobante de tu pedido ${selectedOrder.orderNumber}`,
          url: uriRes.uri,
          dialogTitle: 'Guardar o compartir comprobante',
        });
        return;
      } catch (nativeErr) {
        console.warn('Native HTML receipt share fallback error:', nativeErr);
      }
    }

    const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Status message callout helper (Flyer style)
  const getStatusCallout = (status: OrderStatus) => {
    const isCancelledStatus = status === 'cancelled' || status === 'CANCELADO';

    if (selectedOrder.paymentMethod === 'bank_transfer' && selectedOrder.paymentStatus === 'rejected') {
      return {
        title: '🔴 Comprobante no aprobado',
        desc: 'Tu comprobante de transferencia no pudo ser aprobado por administración. Por favor revisá los datos o escribinos por WhatsApp para regularizar el pago.',
        icon: AlertCircle
      };
    }

    const isPaymentPending = !isCancelledStatus && (
      selectedOrder.paymentStatus === 'pending' || 
      (selectedOrder as any).paymentStatus === 'pending_verification' || 
      (selectedOrder.paymentMethod === 'bank_transfer' && selectedOrder.paymentStatus !== 'approved')
    );

    if (isPaymentPending) {
      return {
        title: '🔒 En espera de confirmación del pago',
        desc: 'Hemos recibido tu pedido y comprobante. El equipo de administración de VONDRO validará la acreditación en la cuenta bancaria. En cuanto sea confirmado, pasará inmediatamente a la etapa de preparación.',
        icon: Clock
      };
    }

    const orderHour = new Date(selectedOrder.createdAt).getHours();
    const isAfterMidday = orderHour >= 12;

    switch (status) {
      case 'pending_payment':
      case 'PENDIENTE_PAGO':
        return {
          title: 'En espera de confirmación del pago',
          desc: 'Por favor completá el pago para que podamos iniciar la preparación de tus productos.',
          icon: FileText
        };
      case 'payment_received':
      case 'PAGO_APROBADO':
      case 'checking_stock':
      case 'VERIFICANDO_STOCK':
      case 'stock_confirmed':
      case 'STOCK_CONFIRMADO':
        return {
          title: '✅ ¡Pago confirmado por administración!',
          desc: isAfterMidday
            ? 'Tu pago fue aprobado exitosamente. Al haber realizado la compra después de las 12:00 hs, la preparación en depósito está programada para el día siguiente para no saturar los repartos y garantizar el mejor cuidado.'
            : 'Tu pago fue aprobado exitosamente. Tu compra ingresó antes de las 12:00 hs y será preparada en depósito para su despacho en el día de hoy.',
          icon: PackageCheck
        };
      case 'preparing':
      case 'PREPARANDO':
      case 'ready_to_ship':
      case 'LISTO_PARA_ENVIAR':
        return {
          title: '📦 Estamos preparando tu pedido',
          desc: isAfterMidday
            ? 'Productos en proceso de embalaje y control de calidad. Despacho programado para la primera tanda de reparto.'
            : 'Productos en proceso de embalaje en depósito VONDRO. En cuanto salga con el repartidor te avisaremos por notificación.',
          icon: PackageCheck
        };
      case 'shipped':
      case 'ENVIADO':
      case 'out_for_delivery':
      case 'EN_CAMINO':
        return {
          title: '🚚 Tu pedido está en camino',
          desc: 'El repartidor ya tiene tu paquete y está en ruta hacia tu domicilio en Córdoba. Mostrale tu PIN de recepción cuando llegue a tu puerta.',
          icon: PackageCheck
        };
      case 'delivered':
      case 'ENTREGADO':
      case 'completed':
      case 'FINALIZADO':
        return {
          title: '🎉 ¡Pedido entregado con éxito!',
          desc: 'La entrega fue confirmada mediante tu PIN de seguridad. Esperamos que disfrutes tu compra. ¡Gracias por confiar en VONDRO!',
          icon: PackageCheck
        };
      case 'cancelled':
      case 'CANCELADO':
        return {
          title: 'Pedido cancelado',
          desc: 'Este pedido ha sido cancelado y dado de baja. Si crees que es un error o necesitás asistencia, contactanos por WhatsApp.',
          icon: AlertCircle
        };
      default:
        return {
          title: 'Procesando pedido',
          desc: 'Actualizaremos el estado a medida que avance el despacho.',
          icon: FileText
        };
    }
  };

  const callout = getStatusCallout(selectedOrder.status);
  const isCancelled = selectedOrder.status === 'cancelled' || selectedOrder.status === 'CANCELADO' || (selectedOrder as any).status === 'cancelado';

  return (
    <div className="pb-24 max-w-xl mx-auto px-3 sm:px-4 pt-1 space-y-2.5">
      {/* 1. Header (Flyer Style: ← Detalle del pedido) */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab('orders');
            }}
            className="p-1.5 -ml-1 rounded-full text-slate-800 hover:bg-slate-100 active:scale-95 transition-colors cursor-pointer"
            aria-label="Volver a mis pedidos"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
            Detalle del pedido
          </h1>
        </div>

        {isCancelled && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              setShowDeleteModal(true);
            }}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs shrink-0"
            title="Eliminar este pedido cancelado de tu historial"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Eliminar</span>
          </button>
        )}
      </div>

      {/* 2. Main Order Summary & Items Card (Flyer Style) */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.03)] space-y-3">
        {/* Card Header - Diseño adaptado para que la entrega estimada nunca tape el número de pedido */}
        <div className="pb-3 border-b border-slate-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight whitespace-nowrap block">
                  Pedido #{selectedOrder.orderNumber.replace('#', '')}
                </span>
                <span className="text-[10.5px] sm:text-[11px] font-medium text-slate-400 block whitespace-nowrap">
                  {formattedDate} · {totalProductsCount} {totalProductsCount === 1 ? 'producto' : 'productos'}
                </span>
              </div>
            </div>

            {/* Badge de estado principal */}
            <div className="shrink-0">
              {getStatusBadge(selectedOrder.status, selectedOrder)}
            </div>
          </div>

          {/* Ventana de entrega estimada en su propio renglón para legibilidad total */}
          <div className="flex items-center justify-start pt-0.5">
            <div 
              id="tag-estimated-delivery-window"
              className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-xs font-bold text-amber-900 bg-amber-50/90 px-2.5 py-1 rounded-full border border-amber-200/90 shadow-2xs"
            >
              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Entrega estimada: {estimatedDeliveryRange}</span>
            </div>
          </div>
        </div>

        {/* Product Items List (con soporte de lista desplegable para variantes / colores) */}
        <div className="divide-y divide-slate-100">
          {selectedOrder.items.map((item, idx) => {
            const productMatch = products.find(p => p.id === item.productId);
            const itemImg = item.image ? getOptimizedThumbnail(item.image, 160) : getCategoryFallback();
            const breakdown = getItemBreakdown(item, productMatch);
            const isExpanded = !!expandedItems[idx];

            return (
              <div key={idx} className="py-2.5 -mx-1 px-1 rounded-xl transition-colors">
                {/* Main Item Row */}
                <div 
                  onClick={(e) => {
                    // Clicking the item row toggles variants breakdown
                    toggleItemExpanded(idx, e);
                  }}
                  className="flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50/70 p-1 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <div 
                      onClick={(e) => {
                        if (productMatch) {
                          e.stopPropagation();
                          triggerHaptic('selection');
                          openProductDetail(productMatch);
                        }
                      }}
                      title="Ver producto en catálogo"
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-50 p-0.5 border border-slate-100 shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-300 transition-all"
                    >
                      <img
                        src={itemImg}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getCategoryFallback();
                        }}
                      />
                    </div>
                    <div className="truncate min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {decodeHtmlEntities(item.name)}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-600">x{item.quantity}</span>
                        <span>·</span>
                        <span>${(item.salePrice ?? 0).toLocaleString('es-AR')} c/u</span>
                      </div>
                      {/* Dropdown Toggle indicator & Review button */}
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <button
                          type="button"
                          onClick={(e) => toggleItemExpanded(idx, e)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                        >
                          <span>{isExpanded ? 'Ocultar desglose' : 'Ver desglose individual (colores)'}</span>
                          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {(() => {
                          const itemReviews = getProductReviews ? getProductReviews(item.productId) : [];
                          const existingReview = itemReviews.find(r => r.orderId === selectedOrder.id);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('selection');
                                setRatingItem({
                                  productId: item.productId,
                                  productName: item.name,
                                  productImage: item.image,
                                  variant: breakdown[0]?.name
                                });
                              }}
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-all cursor-pointer shadow-2xs border ${
                                existingReview 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                              }`}
                            >
                              <Star className={`w-2.5 h-2.5 ${existingReview ? 'fill-emerald-600 text-emerald-600' : 'fill-amber-500 text-amber-500'}`} />
                              <span>{existingReview ? `Calificado (${existingReview.rating}★)` : 'Calificar producto'}</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      ${(item.subtotal ?? (item.salePrice * item.quantity)).toLocaleString('es-AR')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => toggleItemExpanded(idx, e)}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      aria-label="Desplegar variantes"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#7C3AED]' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* 1. Lista desplegable de ítems: Desglose individual (colores/variantes) */}
                {isExpanded && (
                  <div className="mt-2 ml-1 mr-1 p-2.5 bg-slate-50/90 rounded-xl border border-purple-100/70 space-y-2 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-[#7C3AED]" />
                        Desglose individual ({item.quantity} unidades):
                      </span>
                      <span className="text-[9px] font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded border border-purple-200">
                        {breakdown.length} {breakdown.length === 1 ? 'variante' : 'variantes'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {breakdown.map((b, bIdx) => (
                        <div 
                          key={bIdx} 
                          className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60 shadow-xs text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full shrink-0 border border-black/15 shadow-xs inline-block" 
                              style={{ backgroundColor: b.color }} 
                            />
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-[11px]">
                                {b.name}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                SKU: {b.sku}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
                            <span className="font-bold text-slate-900 bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                              x{b.quantity}
                            </span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-slate-800 font-bold">
                              ${((item.salePrice ?? 0) * b.quantity).toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {productMatch && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('selection');
                            openProductDetail(productMatch);
                          }}
                          className="text-[10px] font-bold text-[#7C3AED] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ver ficha completa del producto</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pricing Totals Breakdown (Flyer Style) */}
        <div className="pt-2.5 border-t border-slate-100 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-800">
              ${(selectedOrder.subtotal ?? 0).toLocaleString('es-AR')}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Envío</span>
            {selectedOrder.isFreeShipping || selectedOrder.shippingCost === 0 ? (
              <span className="font-bold text-emerald-600">GRATIS</span>
            ) : (
              <span className="font-semibold text-slate-800">
                ${(selectedOrder.shippingCost ?? 0).toLocaleString('es-AR')}
              </span>
            )}
          </div>

          {!!selectedOrder.discountAmount && selectedOrder.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Descuento ({selectedOrder.couponCode || 'Cupón'})</span>
              <span>-${(selectedOrder.discountAmount ?? 0).toLocaleString('es-AR')}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline font-black text-slate-900">
            <span className="text-xs sm:text-sm">Total pagado</span>
            <span className="text-base sm:text-lg font-black text-[#7C3AED]">
              ${(selectedOrder.total ?? 0).toLocaleString('es-AR')}
            </span>
          </div>

          {/* 2. Enlace Descargar comprobante (PDF) debajo del desglose de Subtotal y Total */}
          <div className="pt-3 border-t border-dashed border-slate-200 flex flex-col items-center justify-center gap-1">
            <button
              type="button"
              id="btn-download-order-receipt"
              onClick={handleDownloadReceipt}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7C3AED] hover:text-[#6D28D9] hover:underline cursor-pointer py-1.5 px-3 rounded-lg hover:bg-purple-50 active:scale-95 transition-all"
            >
              <FileDown className="w-4 h-4 text-[#7C3AED]" />
              <span>{isGeneratingPdf ? 'Generando...' : 'Descargar comprobante (PDF)'}</span>
            </button>
            <span className="text-[10px] text-slate-400">
              Comprobante de compra oficial con validez VONDRO
            </span>
          </div>
        </div>
      </div>

      {/* 3. Seguimiento de tu pedido Card (Flyer Style) */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.03)] space-y-3">
        <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
          Seguimiento de tu pedido
        </h2>

        {/* 4-Step Stepper */}
        <OrderProgressBar status={selectedOrder.status} createdAt={selectedOrder.createdAt} order={selectedOrder} />

        {/* Info Callout Banner (Flyer Style: Light violet with message) */}
        <div className={`p-3 rounded-xl flex items-start gap-2.5 ${
          isCancelled ? 'bg-rose-50 border border-rose-200' : 'bg-purple-50/70 border border-purple-100'
        }`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
            isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-[#7C3AED]'
          }`}>
            <callout.icon className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-1">
            <h4 className={`text-xs font-bold ${
              isCancelled ? 'text-rose-950' : 'text-purple-950'
            }`}>
              {callout.title}
            </h4>
            <p className={`text-[11px] leading-relaxed ${
              isCancelled ? 'text-rose-800' : 'text-purple-800/80'
            }`}>
              {callout.desc}
            </p>

            {/* Ventana de entrega estimada adicional en el callout */}
            {(selectedOrder.status === 'preparing' || selectedOrder.status === 'PREPARANDO') && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 border border-purple-200 text-[11px] text-purple-950 shadow-2xs">
                <Clock className="w-3 h-3 text-[#7C3AED] shrink-0" />
                <span className="font-semibold text-slate-700">Rango estimado de entrega:</span>
                <span className="text-[#7C3AED] font-black">{estimatedDeliveryRange}</span>
              </div>
            )}
          </div>
        </div>

        {/* Security PIN for Delivery / Reception Confirmation */}
        {!isCancelled && selectedOrder.deliveryConfirmationCode && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 text-white border border-slate-800">
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-purple-300 block">
                PIN de Recepción
              </span>
              <span className="text-[11px] text-slate-400">
                Mostralo al cadete al recibir
              </span>
            </div>
            <span className="text-sm font-black font-mono tracking-widest text-amber-300 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-purple-700/60 shadow-xs">
              {selectedOrder.deliveryConfirmationCode}
            </span>
          </div>
        )}
      </div>

      {/* 4. Dirección de Envío Card (Flyer Style) */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.03)] space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
            Dirección de envío
          </h2>
        </div>

        <div className="pl-8 space-y-0.5">
          <p className="text-xs font-bold text-slate-900">
            {selectedOrder.customer.street} {selectedOrder.customer.number}
            {selectedOrder.customer.floorApartment ? `, ${selectedOrder.customer.floorApartment}` : ''}
          </p>
          <p className="text-[11px] text-slate-500">
            Barrio {selectedOrder.customer.neighborhood}, {selectedOrder.customer.city} ({selectedOrder.shippingZoneName || 'Córdoba Capital'})
          </p>
          {selectedOrder.customer.reference && (
            <p className="text-[10px] text-slate-400 italic">
              Ref: {selectedOrder.customer.reference}
            </p>
          )}

          <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-600">
            <Phone className="w-3 h-3 text-[#7C3AED]" />
            <span>{selectedOrder.customer.phone} · {recipientFullName}</span>
          </div>
        </div>
      </div>

      {/* 5. Información de Pago */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-[0_1px_8px_rgba(0,0,0,0.03)] space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700">Método de pago</span>
          <span className="text-xs font-bold text-[#7C3AED] flex items-center gap-1.5">
            {selectedOrder.paymentMethod === 'mercadopago' ? (
              <>
                <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                Mercado Pago
              </>
            ) : (
              <>
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                Transferencia Bancaria
              </>
            )}
          </span>
        </div>

        {selectedOrder.transferReceiptImage && (
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
            <span className="text-[11px] font-extrabold text-purple-950 block">Comprobante de Transferencia Adjunto:</span>
            <div className="flex items-center gap-3">
              <div 
                onClick={() => setViewReceiptModalImage(selectedOrder.transferReceiptImage!)}
                className="relative group cursor-pointer shrink-0"
                title="Toca para ampliar comprobante"
              >
                <img 
                  src={selectedOrder.transferReceiptImage} 
                  alt="Comprobante" 
                  className="w-14 h-14 object-cover rounded-xl border border-purple-300 shadow-2xs group-hover:opacity-90 transition-opacity" 
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] font-bold">
                  Ver
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex-1 min-w-0">
                {selectedOrder.paymentStatus === 'approved' ? (
                  <div>
                    <span className="font-extrabold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Pago Aprobado y Acreditado
                    </span>
                    <p className="text-[10px] text-slate-500">Verificado exitosamente por administración</p>
                  </div>
                ) : selectedOrder.paymentStatus === 'rejected' ? (
                  <div>
                    <span className="font-extrabold text-rose-800 flex items-center gap-1">
                      <X className="w-3.5 h-3.5 text-rose-600" />
                      Comprobante No Aprobado
                    </span>
                    <p className="text-[10px] text-rose-700">Comunicate por WhatsApp para regularizar el pago</p>
                  </div>
                ) : (
                  <div>
                    <span className="font-extrabold text-amber-900 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      En Proceso de Auditoría
                    </span>
                    <p className="text-[10px] text-slate-500">Pendiente de verificación por el equipo de administración</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setViewReceiptModalImage(selectedOrder.transferReceiptImage!)}
                  className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline mt-0.5 block cursor-pointer"
                >
                  Ampliar comprobante
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedOrder.paymentId && (
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>ID de Transacción</span>
            <span className="font-mono font-semibold text-slate-900">{selectedOrder.paymentId}</span>
          </div>
        )}
      </div>

      {/* 6. Action Buttons (Flyer Style: Volver a mis pedidos + Volver a comprar + WhatsApp) */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('orders');
          }}
          className="w-full py-2.5 px-5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full font-bold text-xs shadow-sm shadow-purple-900/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Volver a mis pedidos</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleReorder}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600 stroke-[2.2]" />
            <span>Volver a comprar</span>
          </button>

          <a
            href={`https://wa.me/${cleanPhone}?text=${waMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-full font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-emerald-600" />
            <span>Consultar estado por WhatsApp</span>
          </a>
        </div>

        {isCancelled && (
          <button
            type="button"
            id="btn-delete-order-detail-bottom"
            onClick={() => {
              triggerHaptic('medium');
              setShowDeleteModal(true);
            }}
            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-full font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Eliminar pedido cancelado del historial</span>
          </button>
        )}
      </div>

      {/* Modal Vista Previa del Comprobante */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs sm:text-sm font-bold">
                  Comprobante Pedido #{selectedOrder.orderNumber.replace('#', '')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Actions Bar */}
            <div className="p-2.5 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-purple-900 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Listo para descargar o imprimir</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    window.print();
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-purple-100 text-[#7C3AED] border border-purple-200 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadHtmlFile}
                  className="px-2.5 py-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Guardar archivo</span>
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable Receipt Card */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex justify-between items-start border-b border-purple-200/80 pb-3">
                  <div>
                    <h3 className="text-base font-black text-[#7C3AED] tracking-tight">VONDRO</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Córdoba Capital</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Comprobante de compra</span>
                    <span className="font-mono font-bold text-slate-900">{selectedOrder.orderNumber}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cliente</span>
                    <span className="font-semibold text-slate-800">{recipientFullName}</span>
                    <span className="block text-slate-500">{selectedOrder.customer.street} {selectedOrder.customer.number}</span>
                    <span className="block text-slate-500">{selectedOrder.customer.neighborhood}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Entrega y Fecha</span>
                    <span className="font-semibold text-purple-700 block">Est: {estimatedDeliveryRange}</span>
                    <span className="text-slate-600 block">{formattedDate}</span>
                    <span className="text-slate-500 block">Tel: {selectedOrder.customer.phone}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Productos del Pedido
                  </span>
                  {selectedOrder.items.map((it, i) => {
                    const pm = products.find(p => p.id === it.productId);
                    const itBreakdown = getItemBreakdown(it, pm);
                    return (
                      <div key={i} className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex justify-between items-baseline font-bold text-slate-800">
                          <span>{it.name} (x{it.quantity})</span>
                          <span>${((it.subtotal ?? (it.salePrice * it.quantity)) || 0).toLocaleString('es-AR')}</span>
                        </div>
                        {itBreakdown.length > 0 && (
                          <div className="text-[10px] text-slate-500 pl-2 border-l-2 border-purple-300">
                            {itBreakdown.map((b, bi) => (
                              <span key={bi} className="inline-block mr-2">
                                • {b.name}: <strong>x{b.quantity}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>${(selectedOrder.subtotal || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Envío:</span>
                    <span className="text-emerald-600 font-bold">
                      {selectedOrder.isFreeShipping || selectedOrder.shippingCost === 0 ? 'GRATIS' : `$${(selectedOrder.shippingCost || 0).toLocaleString('es-AR')}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total Pagado:</span>
                    <span className="text-[#7C3AED]">${(selectedOrder.total || 0).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Product Rating & Review Modal */}
      {ratingItem && (
        <ReviewModal
          productId={ratingItem.productId}
          productName={ratingItem.productName}
          productImage={ratingItem.productImage}
          orderId={selectedOrder.id}
          defaultVariant={ratingItem.variant}
          isOpen={!!ratingItem}
          onClose={() => setRatingItem(null)}
        />
      )}

      {/* Lightbox Modal for Transfer Receipt */}
      {viewReceiptModalImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-xs animate-fadeIn"
          onClick={() => setViewReceiptModalImage(null)}
        >
          <div 
            className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-3 border border-slate-700 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white border-b border-slate-800 pb-2">
              <span className="text-xs font-extrabold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" />
                Comprobante de Pago #{selectedOrder.orderNumber.replace('#', '')}
              </span>
              <button
                type="button"
                onClick={() => setViewReceiptModalImage(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-1 flex items-center justify-center max-h-[70vh] overflow-auto rounded-xl bg-slate-950">
              <img 
                src={viewReceiptModalImage} 
                alt="Comprobante de Transferencia" 
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between pt-1 text-slate-400 text-[11px]">
              <span>Toca fuera de la imagen para cerrar</span>
              <button
                type="button"
                onClick={() => setViewReceiptModalImage(null)}
                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cadete Trip & GPS Navigation Modal */}
      {showTripModal && (
        <CadeteTripModal
          order={selectedOrder}
          onClose={() => setShowTripModal(false)}
        />
      )}

      {/* Deletion Confirmation Modal for Cancelled Order in Detail View */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">¿Eliminar pedido cancelado?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta acción quitará el pedido cancelado #{selectedOrder.orderNumber.replace('#', '')} de tu historial.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('success');
                  await deleteOrder(selectedOrder.id);
                  setShowDeleteModal(false);
                  setActiveTab('orders');
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer active:scale-95"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
