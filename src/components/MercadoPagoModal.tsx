import React, { useState } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  X, 
  QrCode, 
  Sparkles,
  Lock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { Order } from '../types';
import { useStore } from '../context/StoreContext';

interface MercadoPagoModalProps {
  isOpen: boolean;
  order: Order;
  initPoint?: string;
  preferenceId?: string;
  isSimulated?: boolean;
  onClose: () => void;
}

export const MercadoPagoModal: React.FC<MercadoPagoModalProps> = ({
  isOpen,
  order,
  initPoint,
  preferenceId,
  isSimulated,
  onClose,
}) => {
  const { processPaymentResult, settings } = useStore();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'qr'>('cards');

  if (!isOpen) return null;

  const handleSimulate = async (status: 'approved' | 'pending' | 'rejected' | 'cancelled') => {
    setIsProcessing(status);
    try {
      await new Promise((res) => setTimeout(res, 600));
      await processPaymentResult(order.id, status);
      onClose();
    } catch (err) {
      console.error(err);
      setIsProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-scaleUp">
        {/* Mercado Pago Branded Header */}
        <div className="bg-[#009EE3] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white text-[#009EE3] flex items-center justify-center font-black text-sm">
              MP
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight">Mercado Pago</span>
                <span className="text-[10px] font-bold uppercase bg-white/20 px-1.5 py-0.5 rounded text-white">
                  {settings.mercadoPago.mode === 'production' ? 'PROD' : 'SANDBOX / TEST'}
                </span>
              </div>
              <p className="text-[11px] text-sky-100">Pago seguro en VONDRO</p>
            </div>
          </div>

          <button
            onClick={() => handleSimulate('cancelled')}
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Price Banner */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Pedido {order.orderNumber}</span>
            <p className="text-xs font-bold text-slate-800">
              {order.items.length} {order.items.length === 1 ? 'producto' : 'productos'} • {order.shippingZoneName || 'Córdoba'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400 uppercase font-bold">Total</span>
            <p className="text-xl font-black text-slate-900">${(order?.total ?? 0).toLocaleString('es-AR')}</p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Method selector tab */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('cards')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Tarjeta / Débito</span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'qr' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Transferencia QR</span>
            </button>
          </div>

          {activeTab === 'cards' ? (
            <div className="space-y-2.5">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-sky-600" />
                    Medio de pago seleccionado
                  </span>
                  <span className="text-[11px] text-emerald-600 font-extrabold">Sin interés</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Podés pagar con cualquier tarjeta Visa, Mastercard, Cabal o dinero disponible en cuenta de Mercado Pago.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
              <div className="w-28 h-28 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
                <QrCode className="w-24 h-24 text-slate-800" />
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Escaneá el código QR desde la App de Mercado Pago o tu billetera virtual preferida.
              </p>
            </div>
          )}

          {/* Test & Simulation Section */}
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold uppercase tracking-wider text-slate-500 text-[10px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" />
                Simulador de Pruebas Mercado Pago
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Preference: {preferenceId?.slice(0, 8)}...</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option 1: Approve */}
              <button
                id="btn-simulate-approved"
                disabled={!!isProcessing}
                onClick={() => handleSimulate('approved')}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessing === 'approved' ? 'Procesando...' : 'Aprobar Pago'}</span>
              </button>

              {/* Option 2: Pending */}
              <button
                id="btn-simulate-pending"
                disabled={!!isProcessing}
                onClick={() => handleSimulate('pending')}
                className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                <span>{isProcessing === 'pending' ? 'Procesando...' : 'Pago Pendiente'}</span>
              </button>

              {/* Option 3: Reject */}
              <button
                id="btn-simulate-rejected"
                disabled={!!isProcessing}
                onClick={() => handleSimulate('rejected')}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>{isProcessing === 'rejected' ? 'Procesando...' : 'Rechazar Pago'}</span>
              </button>
            </div>

            {/* External link if available */}
            {initPoint && initPoint.startsWith('http') && !isSimulated && (
              <a
                href={initPoint}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-[#009EE3] border border-sky-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir ventana oficial de Mercado Pago</span>
              </a>
            )}
          </div>
        </div>

        {/* Footer Security */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-500" />
            Encriptación SSL de 256 bits
          </span>
          <button
            onClick={() => handleSimulate('cancelled')}
            className="text-slate-500 hover:text-slate-700 font-medium"
          >
            Cancelar operación
          </button>
        </div>
      </div>
    </div>
  );
};
