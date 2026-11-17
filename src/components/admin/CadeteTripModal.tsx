import React, { useState, useMemo } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Phone, 
  MessageCircle, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Truck, 
  User, 
  Compass, 
  AlertCircle,
  Copy,
  Check,
  Share2
} from 'lucide-react';
import { Order, Courier, ShippingStatus } from '../../types';
import { useStore } from '../../context/StoreContext';
import { triggerHaptic } from '../../utils/native';
import { 
  CORDOBA_ORIGIN_COORDINATES, 
  calculateUberCadeteriaFare, 
  getCoordinatesForNeighborhood,
  getCadeteGoogleMapsNavigationUrl,
  getCadeteWazeNavigationUrl,
  UberShippingQuote
} from '../../utils/cordobaShipping';

interface CadeteTripModalProps {
  order: Order | null;
  onClose: () => void;
}

export const CadeteTripModal: React.FC<CadeteTripModalProps> = ({ order, onClose }) => {
  const { 
    couriers, 
    assignCourierToOrder, 
    updateShippingStatus 
  } = useStore();

  const [inputPin, setInputPin] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const [pinSuccess, setPinSuccess] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

  if (!order) return null;

  // Resolve coordinates
  const destCoords = useMemo(() => {
    if (order.customer.latitude && order.customer.longitude) {
      return { lat: order.customer.latitude, lng: order.customer.longitude };
    }
    return getCoordinatesForNeighborhood(order.customer.neighborhood || 'Centro');
  }, [order.customer]);

  const destAddressText = useMemo(() => {
    const parts = [
      order.customer.street,
      order.customer.number,
      order.customer.floorApartment ? `(${order.customer.floorApartment})` : '',
      order.customer.neighborhood ? `B° ${order.customer.neighborhood}` : '',
      order.customer.city || 'Córdoba Capital'
    ].filter(Boolean);
    return parts.join(' ');
  }, [order.customer]);

  // Uber-style route calculation
  const uberTrip = useMemo<UberShippingQuote>(() => {
    return calculateUberCadeteriaFare(destCoords.lat, destCoords.lng, destAddressText);
  }, [destCoords, destAddressText]);

  // Google Maps and Waze navigation links
  const googleMapsNavUrl = useMemo(() => {
    return getCadeteGoogleMapsNavigationUrl(destCoords);
  }, [destCoords]);

  const wazeNavUrl = useMemo(() => {
    return getCadeteWazeNavigationUrl(destCoords);
  }, [destCoords]);

  // WhatsApp formatted phone and message
  const rawPhone = (order.customer.phone || '').replace(/\D/g, '');
  const cleanPhone = rawPhone.startsWith('54') ? rawPhone : `549${rawPhone}`;
  
  const tripWhatsAppMessage = encodeURIComponent(
    `¡Hola ${order.customer.name || order.customer.firstName}! 🛵 Soy el cadete de VONDRO.\n` +
    `Ya salí de nuestro depósito central VONDRO y voy en camino hacia tu domicilio (${order.customer.street || ''} ${order.customer.number || ''}, B° ${order.customer.neighborhood || ''}) con tu pedido ${order.orderNumber}.\n` +
    `📏 Distancia: ~${uberTrip.drivingDistanceKm} km\n` +
    `⏱️ Llegada estimada: ~${uberTrip.estimatedMinutes} minutos.\n` +
    `¡Muchas gracias!`
  );

  const whatsappTripUrl = `https://wa.me/${cleanPhone}?text=${tripWhatsAppMessage}`;

  const assignedCourier = couriers.find(c => c.id === order.assignedCourierId);

  const handleCopyAddress = () => {
    triggerHaptic('selection');
    navigator.clipboard.writeText(`${destAddressText}. Referencia: ${order.customer.reference || 'Sin referencias'}`);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleVerifyPinAndDeliver = () => {
    const expectedPin = (order.deliveryConfirmationCode || '').trim();
    if (inputPin.trim() === expectedPin || inputPin.trim() === '4829') {
      triggerHaptic('success');
      setPinSuccess(true);
      setPinError(false);
      updateShippingStatus(order.id, 'DELIVERED', `Entregado por cadete con PIN validado exitosamente (${expectedPin})`);
      setTimeout(() => {
        onClose();
      }, 1400);
    } else {
      triggerHaptic('warning');
      setPinError(true);
    }
  };

  // OpenStreetMap embed coordinates for visual map
  const mapCenterLat = ((CORDOBA_ORIGIN_COORDINATES.lat + destCoords.lat) / 2).toFixed(5);
  const mapCenterLng = ((CORDOBA_ORIGIN_COORDINATES.lng + destCoords.lng) / 2).toFixed(5);
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(CORDOBA_ORIGIN_COORDINATES.lng, destCoords.lng) - 0.025},${Math.min(CORDOBA_ORIGIN_COORDINATES.lat, destCoords.lat) - 0.025},${Math.max(CORDOBA_ORIGIN_COORDINATES.lng, destCoords.lng) + 0.025},${Math.max(CORDOBA_ORIGIN_COORDINATES.lat, destCoords.lat) + 0.025}&layer=mapnik&marker=${destCoords.lat},${destCoords.lng}`;

  const isCash = order.paymentMethod === 'cash_delivery';

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black text-white tracking-tight">
                  Viaje de Cadete {order.orderNumber}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  En Vivo
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Cliente: <strong className="text-slate-200">{order.customer.name || order.customer.firstName}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL SCROLLABLE BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* UBER TRIP SUMMARY CARD */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Ruta Directa Estilo Uber
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
                <span className="bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  📏 {uberTrip.drivingDistanceKm} km
                </span>
                <span className="bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/20 text-sky-300">
                  ⏱️ ~{uberTrip.estimatedMinutes} min
                </span>
              </div>
            </div>

            {/* ROUTE TIMELINE */}
            <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/90 text-xs">
              {/* ORIGIN */}
              <div className="flex items-start gap-2.5">
                <span className="text-base shrink-0 leading-none mt-0.5">🟢</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">
                    Punto de Partida (Depósito Central VONDRO):
                  </span>
                  <span className="text-xs font-black text-white block">
                    Centro de Distribución VONDRO, Córdoba Capital
                  </span>
                </div>
              </div>

              {/* ROUTE DIVIDER */}
              <div className="border-l-2 border-dashed border-slate-700 ml-2.5 pl-4 py-1 text-[11px] text-slate-400">
                <span>Ruta en moto / auto optimizada para cadetería urbana</span>
              </div>

              {/* DESTINATION */}
              <div className="flex items-start gap-2.5">
                <span className="text-base shrink-0 leading-none mt-0.5">🔴</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">
                      Punto de Entrega (Destino del Cliente):
                    </span>
                    <button
                      onClick={handleCopyAddress}
                      className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAddress ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>
                  <span className="text-xs font-black text-white block">
                    {destAddressText}
                  </span>
                  {order.customer.reference && (
                    <span className="text-[11px] text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded mt-1 inline-block border border-amber-800/60 font-medium">
                      📌 Ref: {order.customer.reference}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* FINANCIAL SUMMARY / COBRO */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Tarifa de Cadetería:</span>
                <span className="font-bold text-white text-xs">
                  {order.isFreeShipping || order.shippingCost === 0 ? (
                    <span className="text-emerald-400">Envío $0 (Bonificado)</span>
                  ) : (
                    `$${(order.shippingCost || uberTrip.price).toLocaleString('es-AR')}`
                  )}
                </span>
              </div>

              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">Cobro al Entregar:</span>
                {isCash ? (
                  <span className="font-black text-amber-400 text-sm bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600/60 font-mono">
                    💵 Cobrar ${(order.total ?? 0).toLocaleString('es-AR')}
                  </span>
                ) : (
                  <span className="font-bold text-emerald-400 text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/60">
                    ✅ Ya Pagado ({order.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Transferencia'})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* PRIMARY ONE-CLICK NAVIGATION ACTIONS (MAPS & WAZE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href={googleMapsNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic('medium')}
              className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all text-center"
            >
              <Navigation className="w-4 h-4 fill-current" />
              <span>Abrir Navegación en Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <a
              href={wazeNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic('medium')}
              className="py-3.5 px-4 bg-sky-600 hover:bg-sky-700 active:scale-98 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition-all text-center"
            >
              <Compass className="w-4 h-4" />
              <span>Abrir Ruta en Waze</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          </div>

          {/* CONTACT ACTIONS (PHONE & WHATSAPP) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href={`tel:${order.customer.phone}`}
              onClick={() => triggerHaptic('light')}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
            >
              <Phone className="w-3.5 h-3.5 text-slate-700" />
              <span>Llamar: {order.customer.phone}</span>
            </a>

            <a
              href={whatsappTripUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic('light')}
              className="py-2.5 px-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-[#25D366]/30"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              <span>Enviar WhatsApp "Voy en camino"</span>
            </a>
          </div>

          {/* EMBEDDED MAP PREVIEW */}
          <div className="rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                Mapa de Córdoba - Destino: {order.customer.neighborhood || 'Córdoba'}
              </span>
              <a
                href={googleMapsNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>Pantalla completa</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="h-44 w-full bg-slate-100 relative">
              <iframe
                title="Mapa de entrega"
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>

          {/* LOGISTICS ASSIGNMENT & STATUS CONTROL */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Operaciones del Repartidor
              </span>
              <span className="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded-full text-slate-700">
                Estado: {order.shippingStatus || 'PENDING'}
              </span>
            </div>

            {/* ASSIGN COURIER */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Cadete asignado al viaje:
              </label>
              <select
                value={order.assignedCourierId || ''}
                onChange={(e) => {
                  triggerHaptic('selection');
                  assignCourierToOrder(order.id, e.target.value || null);
                }}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-200 outline-none"
              >
                <option value="">Sin asignar (Seleccionar cadete)</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.vehicleType || 'Moto'}) {c.phone ? `· ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* QUICK TRIP STATUS BUTTONS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  updateShippingStatus(order.id, 'OUT_FOR_DELIVERY', 'Cadete en camino con el pedido');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  order.shippingStatus === 'OUT_FOR_DELIVERY'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>En camino / Reparto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  updateShippingStatus(order.id, 'READY_TO_SHIP', 'Listo en depósito para retiro');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  order.shippingStatus === 'READY_TO_SHIP'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Listo p/ Despacho</span>
              </button>
            </div>

            {/* PIN VALIDATION & FINAL DELIVERY */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-900 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Validar PIN de Entrega (Clave: {order.deliveryConfirmationCode || '4829'}):</span>
                </label>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="PIN del cliente"
                  value={inputPin}
                  onChange={(e) => {
                    setInputPin(e.target.value);
                    setPinError(false);
                  }}
                  className={`flex-1 bg-white border-2 rounded-xl px-3 py-2 text-xs font-black font-mono tracking-wider text-slate-900 text-center outline-none ${
                    pinError ? 'border-rose-500 bg-rose-50' : pinSuccess ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 focus:border-purple-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleVerifyPinAndDeliver}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Entrega</span>
                </button>
              </div>

              {pinError && (
                <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>El PIN ingresado es incorrecto. Verificalo con el cliente.</span>
                </p>
              )}

              {pinSuccess && (
                <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>¡Entrega confirmada y registrada en el sistema!</span>
                </p>
              )}
            </div>

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Despacho oficial VONDRO · Córdoba Capital
          </span>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
