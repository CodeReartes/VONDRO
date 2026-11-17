import React, { useRef } from 'react';
import { Printer, X, Package, QrCode, ShieldCheck, MapPin, Phone, User, CheckCircle2, Copy } from 'lucide-react';
import { Order } from '../../types';
import { triggerHaptic } from '../../utils/native';

interface ThermalLabelModalProps {
  order: Order | null;
  onClose: () => void;
  appName?: string;
  storePhone?: string;
}

export const ThermalLabelModal: React.FC<ThermalLabelModalProps> = ({
  order,
  onClose,
  appName = 'VONDRO Córdoba',
  storePhone = '351 594-8952'
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const customerName = order.customer.fullName || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Cliente';
  const customerAddress = order.customer.address || `${order.customer.street || ''} ${order.customer.number || ''}`.trim() || 'Domicilio no especificado';
  const customerCity = order.customer.city || 'Córdoba Capital';
  const customerNeighborhood = order.customer.neighborhood ? `B° ${order.customer.neighborhood}` : 'Centro / Macrocentro';
  const deliveryPin = order.deliveryConfirmationCode || order.deliveryPin || '4829';
  const trackingCode = order.trackingCode || `VON-${order.orderNumber || '001'}`;

  const handlePrint = () => {
    triggerHaptic();
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-print-area, #thermal-print-area * {
            visibility: visible;
          }
          #thermal-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm !important;
            padding: 4mm !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 no-print">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Etiqueta Térmica de Despacho</h3>
              <p className="text-xs text-slate-400">Formato autoadhesivo 80mm / Rollo continuo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Thermal Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/40 flex justify-center">
          <div
            id="thermal-print-area"
            ref={printContainerRef}
            className="w-full max-w-[340px] bg-white text-black p-5 rounded-2xl shadow-xl font-mono text-xs border border-slate-300"
          >
            {/* Store Branding Header */}
            <div className="text-center pb-3 border-b-2 border-dashed border-black">
              <div className="flex items-center justify-center space-x-1.5 font-black text-base tracking-tighter uppercase">
                <Package className="w-4 h-4" />
                <span>{appName}</span>
              </div>
              <p className="text-[10px] uppercase font-bold text-gray-700">Depósito Central Córdoba Capital</p>
              <p className="text-[9px] text-gray-500">WhatsApp Logística: {storePhone}</p>
            </div>

            {/* Order Number & Barcode Simulation */}
            <div className="py-3 border-b-2 border-dashed border-black flex justify-between items-center">
              <div>
                <span className="text-[9px] uppercase font-bold text-gray-500 block">Número de Pedido</span>
                <span className="text-base font-black tracking-wide">#{order.orderNumber}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-gray-500 block">Tracking</span>
                <span className="text-xs font-bold bg-black text-white px-2 py-0.5 rounded">{trackingCode}</span>
              </div>
            </div>

            {/* Big PIN Confirmation Code */}
            <div className="my-3 p-2.5 bg-gray-100 border-2 border-black rounded-xl text-center">
              <span className="text-[10px] font-black uppercase tracking-wider block text-gray-700">
                🔒 CÓDIGO PIN DE RECEPCIÓN:
              </span>
              <span className="text-2xl font-black tracking-widest text-black">
                {deliveryPin}
              </span>
              <span className="text-[9px] block text-gray-600 font-sans mt-0.5">
                (El cliente debe dictar este PIN al cadete para validar la entrega)
              </span>
            </div>

            {/* Recipient Details */}
            <div className="py-2.5 border-b border-black space-y-1 font-sans">
              <div className="flex items-start space-x-1.5">
                <User className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-xs uppercase block">{customerName}</span>
                  {order.customer.dni && (
                    <span className="text-[10px] text-gray-600">DNI: {order.customer.dni}</span>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-1.5 pt-1">
                <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-xs">{customerAddress}</span>
                  <span className="text-[11px] block font-semibold text-gray-800">
                    {customerNeighborhood}, {customerCity}
                  </span>
                  {order.customer.reference && (
                    <span className="text-[9px] italic text-gray-600 block">
                      Ref: "{order.customer.reference}"
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1.5 pt-1">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-bold text-xs">{order.customer.phone}</span>
              </div>
            </div>

            {/* Items Summary */}
            <div className="py-2.5 border-b-2 border-dashed border-black">
              <span className="text-[10px] font-bold uppercase block mb-1">Contenido del Paquete:</span>
              <table className="w-full text-[10px] font-sans">
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1 font-bold w-6">x{item.quantity}</td>
                      <td className="py-1 pr-1 truncate max-w-[190px]">{item.name}</td>
                      <td className="py-1 text-right font-mono">${((item.price || 0) * item.quantity).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="py-2.5 border-b-2 border-dashed border-black font-sans text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono">${(order.subtotal || order.total).toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span>Envío ({order.shippingZoneId || 'Córdoba'}):</span>
                <span className="font-mono">{order.shippingCost === 0 ? 'GRATIS' : `$${(order.shippingCost || 0).toLocaleString('es-AR')}`}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1 border-t border-gray-200">
                <span>TOTAL A COBRAR:</span>
                <span className="font-mono">${(order.total || 0).toLocaleString('es-AR')}</span>
              </div>
              <div className="text-[10px] font-bold text-gray-700 pt-0.5">
                Medio de Pago: <span className="uppercase">{order.paymentMethod === 'cash_delivery' || (order.paymentMethod as string) === 'cash' ? 'EFECTIVO CONTRA ENTREGA' : order.paymentMethod === 'bank_transfer' || (order.paymentMethod as string) === 'transfer' ? 'TRANSFERENCIA (VERIFICADA)' : 'MERCADO PAGO'}</span>
              </div>
            </div>

            {/* Reception Sign Box */}
            <div className="pt-3 pb-1 text-center font-sans text-[9px] text-gray-500">
              <div className="border border-dashed border-gray-400 h-10 rounded mb-1 flex items-end justify-center pb-1">
                <span>Firma y Aclaración de Quien Recibe</span>
              </div>
              <p>Generado por VONDRO OS • www.vondro.com</p>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 no-print">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-all"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic();
                navigator.clipboard.writeText(
                  `PEDIDO #${order.orderNumber} - PIN: ${deliveryPin}\nCliente: ${customerName} (${order.customer.phone})\nDirección: ${customerAddress}, ${customerNeighborhood}\nTotal: $${(order.total || 0).toLocaleString('es-AR')}`
                );
                alert('¡Datos de entrega copiados al portapapeles!');
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all border border-slate-700"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Info</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Etiqueta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
