import { jsPDF } from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Order } from '../types';
import { isNativePlatform } from './native';

export function resolveOrderReceiptStatus(order: Order): { label: string; rgb: [number, number, number]; hex: string } {
  if (order.paymentMethod === 'bank_transfer' && order.paymentStatus === 'rejected') {
    return { label: 'Comprobante no aprobado', rgb: [225, 29, 72], hex: '#e11d48' };
  }
  if (
    order.paymentMethod === 'bank_transfer' &&
    (order.paymentStatus === 'pending' || (order as any).paymentStatus === 'pending_verification') &&
    order.status !== 'cancelled' &&
    order.status !== 'CANCELADO'
  ) {
    return { label: 'Comprobante en revisión', rgb: [217, 119, 6], hex: '#d97706' };
  }

  switch (order.status) {
    case 'cancelled':
    case 'CANCELADO':
      return { label: 'Cancelado', rgb: [225, 29, 72], hex: '#e11d48' };
    case 'STOCK_ISSUE':
    case 'PROBLEMA_DE_STOCK':
      return { label: 'Stock en revisión', rgb: [225, 29, 72], hex: '#e11d48' };
    case 'pending_payment':
    case 'PENDIENTE_PAGO':
      return { label: 'Pendiente de pago', rgb: [124, 58, 237], hex: '#7c3aed' };
    case 'checking_stock':
    case 'VERIFICANDO_STOCK':
      return { label: 'Verificando stock', rgb: [217, 119, 6], hex: '#d97706' };
    case 'stock_confirmed':
    case 'STOCK_CONFIRMADO':
      return { label: 'Stock confirmado', rgb: [13, 148, 136], hex: '#0d9488' };
    case 'preparing':
    case 'PREPARANDO':
      return { label: 'En preparación', rgb: [234, 88, 12], hex: '#ea580c' };
    case 'ready_to_ship':
    case 'LISTO_PARA_ENVIAR':
      return { label: 'Listo para enviar', rgb: [79, 70, 229], hex: '#4f46e5' };
    case 'shipped':
    case 'ENVIADO':
      return { label: 'Enviado', rgb: [37, 99, 235], hex: '#2563eb' };
    case 'out_for_delivery':
    case 'EN_CAMINO':
      return { label: 'En camino', rgb: [22, 163, 74], hex: '#16a34a' };
    case 'delivered':
    case 'ENTREGADO':
    case 'completed':
    case 'FINALIZADO':
      return { label: 'Entregado', rgb: [22, 163, 74], hex: '#16a34a' };
    case 'payment_received':
    case 'PAGO_APROBADO':
      return { label: 'Pago aprobado', rgb: [2, 132, 199], hex: '#0284c7' };
    default:
      return { label: 'Pago aprobado', rgb: [22, 163, 74], hex: '#16a34a' };
  }
}

export const downloadOrderReceiptPdf = async (order: Order): Promise<boolean> => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [124, 58, 237]; // #7C3AED
    const darkColor = [15, 23, 42];     // #0F172A
    const grayColor = [100, 116, 139];   // #64748B
    const lightBg = [248, 250, 252];     // #F8FAFC
    const borderCol = [226, 232, 240];  // #E2E8F0

    const cleanOrderNumber = (order.orderNumber || '').replace('#', '') || order.id;
    const dateObj = new Date(order.createdAt);
    const formattedDate = dateObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const formattedTime = dateObj.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const customerName =
      order.customer.name ||
      order.customer.fullName ||
      `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() ||
      'Cliente VONDRO';
    const address =
      order.customer.address ||
      `${order.customer.street || ''} ${order.customer.number || ''}${order.customer.floorApartment ? ', ' + order.customer.floorApartment : ''}`.trim();
    const neighborhood = `B° ${order.customer.neighborhood || ''}, ${order.customer.city || 'Córdoba Capital'}`;

    // Top Header Banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 8, 'F');

    // Brand
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('VONDRO', 15, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('Todo lo que necesitás, más cerca · Córdoba Capital', 15, 29);
    doc.setFontSize(8);
    doc.text('CUIT: 30-71829304-8 · IVA Responsable Inscripto', 15, 33);

    // Document Details Box (Right aligned)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text('COMPROBANTE DE COMPRA', 195, 22, { align: 'right' });

    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`Pedido #${cleanOrderNumber}`, 195, 28, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Fecha: ${formattedDate} ${formattedTime} hs`, 195, 33, { align: 'right' });

    // Dynamic Status Label & Color
    const resolvedStatus = resolveOrderReceiptStatus(order);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(resolvedStatus.rgb[0], resolvedStatus.rgb[1], resolvedStatus.rgb[2]);
    doc.text(`Estado: ${resolvedStatus.label}`, 195, 38, { align: 'right' });

    // Divider Line
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.setLineWidth(0.5);
    doc.line(15, 42, 195, 42);

    // Customer & Logistics Info Boxes
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(15, 46, 88, 38, 2, 2, 'F');
    doc.roundedRect(107, 46, 88, 38, 2, 2, 'F');

    // Customer Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('DATOS DEL DESTINATARIO', 20, 52);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(customerName.slice(0, 32), 20, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(address.slice(0, 38), 20, 63);
    doc.text(neighborhood.slice(0, 38), 20, 68);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Tel: ${order.customer.phone || 'N/D'}`, 20, 74);
    if (order.customer.dni) {
      doc.text(`DNI: ${order.customer.dni}`, 20, 79);
    }

    // Logistics & Payment Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('DETALLES DE PAGO Y ENTREGA', 112, 52);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    const methodStr = order.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Transferencia Bancaria Directa';
    doc.text(`Método de pago: ${methodStr}`, 112, 58);
    doc.text(`Ventana estimada: ${order.deliveryTimeSlot || '14:00 - 18:00 hs'}`, 112, 63);
    doc.text(`Zona: ${order.shippingZoneName || 'Córdoba Capital'}`, 112, 68);

    if (order.deliveryConfirmationCode) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`PIN de Entrega: ${order.deliveryConfirmationCode}`, 112, 75);
    }

    // Items Table Header
    const startY = 92;
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(15, startY, 180, 8, 'F');
    doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
    doc.rect(15, startY, 180, 8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('PRODUCTO', 20, startY + 5.5);
    doc.text('CANT.', 130, startY + 5.5, { align: 'center' });
    doc.text('UNITARIO', 158, startY + 5.5, { align: 'right' });
    doc.text('SUBTOTAL', 190, startY + 5.5, { align: 'right' });

    let currentY = startY + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    order.items.forEach((item) => {
      const itemSubtotal = (item.salePrice || 0) * (item.quantity || 1);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      const truncatedName = item.name.length > 55 ? item.name.substring(0, 52) + '...' : item.name;
      doc.text(truncatedName, 20, currentY + 6);
      doc.text(String(item.quantity || 1), 130, currentY + 6, { align: 'center' });
      doc.text(`$${(item.salePrice || 0).toLocaleString('es-AR')}`, 158, currentY + 6, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(`$${itemSubtotal.toLocaleString('es-AR')}`, 190, currentY + 6, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      currentY += 9;
      doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
      doc.line(15, currentY, 195, currentY);
    });

    // Totals Breakdown
    currentY += 6;
    const totalsX = 130;
    doc.setFontSize(8.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('Subtotal:', totalsX, currentY);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`$${(order.subtotal || 0).toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });

    currentY += 5;
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('Envío:', totalsX, currentY);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    const shippingStr = order.isFreeShipping || order.shippingCost === 0 ? 'GRATIS' : `$${(order.shippingCost || 0).toLocaleString('es-AR')}`;
    doc.text(shippingStr, 190, currentY, { align: 'right' });

    if (order.discountAmount && order.discountAmount > 0) {
      currentY += 5;
      doc.setTextColor(22, 163, 74);
      doc.text(`Descuento (${order.couponCode || 'Cupón'}):`, totalsX, currentY);
      doc.text(`-$${order.discountAmount.toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });
    }

    currentY += 7;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.8);
    doc.line(totalsX - 5, currentY, 195, currentY);

    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('TOTAL ABONADO:', totalsX, currentY);
    doc.text(`$${(order.total || 0).toLocaleString('es-AR')}`, 190, currentY, { align: 'right' });

    // Official Verification Badge
    currentY += 15;
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(15, currentY, 180, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('COMPROBANTE OFICIAL VONDRO · CÓRDOBA CAPITAL', 20, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text('Documento electrónico emitido por la plataforma oficial de VONDRO. Válido como comprobante de compra.', 20, currentY + 12);
    doc.text('Centro de Atención y Soporte: +54 9 351 594-8952 · contacto@vondro.com.ar', 20, currentY + 16);

    const fileName = `Comprobante-VONDRO-${cleanOrderNumber}.pdf`;

    if (isNativePlatform()) {
      const dataUri = doc.output('datauristring');
      const base64Data = dataUri.split(',')[1];
      if (!base64Data) {
        return false;
      }

      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      const fileUriResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      });

      await Share.share({
        title: `Comprobante VONDRO #${cleanOrderNumber}`,
        text: `Comprobante oficial de tu pedido #${cleanOrderNumber} en VONDRO Córdoba.`,
        url: fileUriResult.uri,
        dialogTitle: 'Guardar o compartir comprobante PDF',
      });

      return true;
    }

    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Error generating PDF with jsPDF:', error);
    return false;
  }
};
