import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Building2, 
  Truck, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  MessageCircle,
  Lock,
  Sparkles,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  MapPin,
  User,
  LogIn,
  Upload,
  Image as ImageIcon,
  Check,
  X,
  FileText,
  Navigation,
  Loader2,
  Plus,
  Trash2,
  Clock,
  Compass
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CustomerData, PaymentMethodType, Order } from '../types';
import { MercadoPagoModal } from './MercadoPagoModal';
import { LoginView } from './LoginView';
import { decodeHtmlEntities } from '../utils/imageOptimizer';
import { triggerHaptic } from '../utils/native';
import { compressReceiptImage } from '../utils/imageOptimizer';
import { getDeviceCoordinates, reverseGeocodeCoordinates, KNOWN_CORDOBA_NEIGHBORHOODS, POPULAR_CORDOBA_LOCATIONS } from '../utils/geoAddress';
import { 
  CORDOBA_ORIGIN_COORDINATES, 
  calculateUberCadeteriaFare, 
  getCoordinatesForNeighborhood,
  getCoordinatesForStreet,
  getRequiredMinimumZone,
  calculateDistanceInKm,
  CORDOBA_DRIVING_FACTOR,
  UberShippingQuote 
} from '../utils/cordobaShipping';

const CORDOBA_NEIGHBORHOODS = KNOWN_CORDOBA_NEIGHBORHOODS;

export const NEIGHBORHOOD_ZONE_MAP: Record<string, string> = {
  // Zona 1 - Cercana / Villa Martínez (Hasta 4 km)
  'Villa Martínez': 'zona-1',
  'Las Palmas': 'zona-1',
  'Santa Ana': 'zona-1',
  'Los Plátanos': 'zona-1',
  'Rosedal': 'zona-1',
  'San Rafael': 'zona-1',
  'Residencial San Roque': 'zona-1',
  'Villa Unión': 'zona-1',
  'Estación Flores': 'zona-1',
  'Parque Capital': 'zona-1',

  // Zona 2 - Alberdi, Centro y Macrocentro (4 a 8 km)
  'Alberdi': 'zona-2',
  'Alto Alberdi': 'zona-2',
  'Observatorio': 'zona-2',
  'Centro': 'zona-2',
  'Nueva Córdoba': 'zona-2',
  'Güemes': 'zona-2',
  'Manantiales': 'zona-2',
  'Manantiales II': 'zona-2',
  'Providencia': 'zona-2',
  'Ducasse': 'zona-2',
  'Barrio Jardín': 'zona-2',
  'Crisol': 'zona-2',

  // Zona 3 - Periférica / Circunvalación / Norte (8 a 15 km)
  'Cerro de las Rosas': 'zona-3',
  'Urca': 'zona-3',
  'Alta Córdoba': 'zona-3',
  'General Paz': 'zona-3',
  'Cofico': 'zona-3',
  'San Martín': 'zona-3',
  'Villa Belgrano': 'zona-3',
  'Argüello': 'zona-3',
  'Poeta Lugones': 'zona-3',
  'San Vicente': 'zona-3',
  'Empalme': 'zona-3',
  'Iponá': 'zona-3',
  'Villa El Libertador': 'zona-3',
  'Guiñazú': 'zona-3',
  'Los Boulevares': 'zona-3',
  'Tablada Park': 'zona-3',
  'Alejandro Centeno': 'zona-3',
  'Villa Cabrera': 'zona-3',
  'Villa Marta': 'zona-3',
  'Juniors': 'zona-3',

  // Zona 4 - Gran Córdoba / Fuera de Circunvalación (> 15 km)
  'Villa Allende': 'zona-4',
  'Villa Allende (Gran Cba)': 'zona-4',
  'Saldán': 'zona-4',
  'La Calera': 'zona-4',
  'Malvinas Argentinas': 'zona-4',
  'Mendiolaza': 'zona-4',
  'Unquillo': 'zona-4',
  'Juárez Celman': 'zona-4',
  'Río Ceballos': 'zona-4',
  'Coronel Olmedo': 'zona-4',
};

import { formatWhatsAppPhone } from '../utils/phoneUtils';

export const CheckoutView: React.FC = () => {
  const {
    selectedCartItems,
    cartSubtotal,
    discountAmount,
    currentShippingCost,
    isFreeShipping,
    selectedZoneId,
    setSelectedZoneId,
    shippingZones,
    createOrder,
    createMercadoPagoPreference,
    setActiveTab,
    openOrderDetail,
    settings,
    user
  } = useStore();

  const defaultAddr = user?.defaultAddress || user?.addresses?.[0];

  const [formData, setFormData] = useState<CustomerData>({
    firstName: user?.name ? user.name.split(' ')[0] : (defaultAddr?.firstName || ''),
    lastName: user?.name ? user.name.split(' ').slice(1).join(' ') : (defaultAddr?.lastName || ''),
    phone: user?.phone || defaultAddr?.phone || '',
    email: user?.email || defaultAddr?.email || '',
    dni: user?.dni || defaultAddr?.dni || '',
    province: defaultAddr?.province || 'Córdoba',
    city: defaultAddr?.city || 'Córdoba Capital',
    neighborhood: defaultAddr?.neighborhood || 'Nueva Córdoba',
    street: defaultAddr?.street || '',
    number: defaultAddr?.number || '',
    floorApartment: defaultAddr?.floorApartment || '',
    reference: defaultAddr?.reference || '',
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('mercadopago');
  const [transferReceiptImage, setTransferReceiptImage] = useState<string | null>(null);
  const [transferReceiptName, setTransferReceiptName] = useState<string | null>(null);
  const [isCompressingReceipt, setIsCompressingReceipt] = useState<boolean>(false);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState<Order | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState<boolean>(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [locationStatusMsg, setLocationStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationStatusMsg(null);
    triggerHaptic('medium');
    try {
      const coords = await getDeviceCoordinates();
      const res = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);
      
      const newStreet = res.street || 'Av. Japón';
      const newNumber = res.number || '550';
      const newNeighborhood = res.neighborhood || 'Otro';

      setFormData(prev => ({
        ...prev,
        street: newStreet,
        number: newNumber,
        neighborhood: newNeighborhood,
        city: 'Córdoba Capital',
        province: 'Córdoba',
        latitude: res.latitude,
        longitude: res.longitude,
      }));

      // Calcular distancia en ruta estilo Uber desde base Villa Martínez
      const straightKm = calculateDistanceInKm(
        CORDOBA_ORIGIN_COORDINATES.lat,
        CORDOBA_ORIGIN_COORDINATES.lng,
        res.latitude,
        res.longitude
      );
      const drivingKm = Math.max(0.5, Math.round(straightKm * CORDOBA_DRIVING_FACTOR * 10) / 10);

      // Determinar y fijar zona mínima obligatoria para impedir evasión de tarifa
      const targetZoneResult = getRequiredMinimumZone(
        drivingKm,
        shippingZones,
        newNeighborhood,
        res.latitude,
        res.longitude,
        newStreet
      );

      const lockedZoneId = targetZoneResult.requiredZone.id;
      setSelectedZoneId(lockedZoneId);
      try {
        localStorage.setItem('vondro_selected_zone_v2', lockedZoneId);
      } catch (_) {}

      setLocationStatusMsg({
        type: 'success',
        text: `📍 Ubicación fijada por GPS (${drivingKm} km): Zona asignada automáticamente: ${targetZoneResult.requiredZone.name} ($${(targetZoneResult.requiredZone.price ?? targetZoneResult.minimumPrice).toLocaleString('es-AR')}) sin posibilidad de evasión.`
      });
      triggerHaptic('success');
      setTimeout(() => setLocationStatusMsg(null), 6000);
    } catch (err: any) {
      console.warn('Geolocation fallback in checkout:', err);
      // Fallback for denied/blocked geolocation (e.g. iframe or browser permissions):
      const savedAddr = user?.defaultAddress || user?.addresses?.[0];
      if (savedAddr && (savedAddr.street || savedAddr.neighborhood)) {
        const fallbackStreet = savedAddr.street || 'Av. Colón';
        const fallbackNeighborhood = savedAddr.neighborhood || 'Alberdi';
        setFormData(prev => ({
          ...prev,
          street: fallbackStreet,
          number: savedAddr.number || prev.number || '1450',
          neighborhood: fallbackNeighborhood,
          city: savedAddr.city || 'Córdoba Capital',
          province: savedAddr.province || 'Córdoba',
        }));
        
        const fallbackZoneResult = getRequiredMinimumZone(
          6.0,
          shippingZones,
          fallbackNeighborhood,
          undefined,
          undefined,
          fallbackStreet
        );
        setSelectedZoneId(fallbackZoneResult.requiredZone.id);
        try {
          localStorage.setItem('vondro_selected_zone_v2', fallbackZoneResult.requiredZone.id);
        } catch (_) {}

        setLocationStatusMsg({
          type: 'success',
          text: `📍 Dirección registrada cargada: ${fallbackStreet} (B° ${fallbackNeighborhood}) - Zona: ${fallbackZoneResult.requiredZone.name}`
        });
        triggerHaptic('success');
      } else {
        const defaultLoc = POPULAR_CORDOBA_LOCATIONS[0] || { street: 'Av. Hipólito Yrigoyen', number: '380', neighborhood: 'Nueva Córdoba', zoneId: 'zona-2' };
        setFormData(prev => ({
          ...prev,
          street: prev.street || defaultLoc.street,
          number: prev.number || defaultLoc.number,
          neighborhood: prev.neighborhood || defaultLoc.neighborhood,
          city: 'Córdoba Capital',
          province: 'Córdoba',
        }));
        setSelectedZoneId(defaultLoc.zoneId);
        try {
          localStorage.setItem('vondro_selected_zone_v2', defaultLoc.zoneId);
        } catch (_) {}
        setLocationStatusMsg({
          type: 'success',
          text: `📍 Dirección autocompletada: ${defaultLoc.street} ${defaultLoc.number} (B° ${defaultLoc.neighborhood})`
        });
        triggerHaptic('success');
      }
      setTimeout(() => setLocationStatusMsg(null), 6000);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSelectSavedAddress = (addr: CustomerData) => {
    triggerHaptic('selection');
    setFormData(prev => ({
      ...prev,
      firstName: prev.firstName || addr.firstName || (user?.name ? user.name.split(' ')[0] : ''),
      lastName: prev.lastName || addr.lastName || (user?.name ? user.name.split(' ').slice(1).join(' ') : ''),
      phone: addr.phone || prev.phone || user?.phone || '',
      email: addr.email || prev.email || user?.email || '',
      dni: addr.dni || prev.dni || user?.dni || '',
      street: addr.street || '',
      number: addr.number || '',
      floorApartment: addr.floorApartment || '',
      neighborhood: addr.neighborhood || 'Nueva Córdoba',
      reference: addr.reference || '',
      city: addr.city || 'Córdoba Capital',
      province: addr.province || 'Córdoba',
      latitude: addr.latitude,
      longitude: addr.longitude,
    }));
    if (addr.neighborhood && NEIGHBORHOOD_ZONE_MAP[addr.neighborhood]) {
      setSelectedZoneId(NEIGHBORHOOD_ZONE_MAP[addr.neighborhood]);
    }
    setShowSavedAddressesModal(false);
    setLocationStatusMsg({
      type: 'success',
      text: `✓ Dirección seleccionada: ${addr.street} ${addr.number} (B° ${addr.neighborhood})`
    });
    setTimeout(() => setLocationStatusMsg(null), 4000);
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 15MB)
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('El comprobante supera los 15MB. Por favor sube una imagen más liviana.');
      return;
    }

    setErrorMessage(null);
    triggerHaptic('selection');
    setTransferReceiptName(file.name);
    setIsCompressingReceipt(true);

    try {
      // Compress receipt image to safe dimensions (<1000px, 70% quality, ~50KB)
      // so it stores reliably in LocalStorage and Firestore without quota limits
      const compressedBase64 = await compressReceiptImage(file, 1000, 0.7);
      setTransferReceiptImage(compressedBase64);
      triggerHaptic('success');
    } catch (err) {
      console.error('Error compressing receipt:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setTransferReceiptImage(base64);
        triggerHaptic('success');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressingReceipt(false);
    }
  };

  const handleRemoveReceipt = () => {
    triggerHaptic('light');
    setTransferReceiptImage(null);
    setTransferReceiptName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sync user details and saved address when user logs in or registers
  useEffect(() => {
    if (user) {
      const addr = user.defaultAddress || user.addresses?.[0];
      setFormData(prev => ({
        ...prev,
        firstName: prev.firstName || (user.name ? user.name.split(' ')[0] : '') || addr?.firstName || '',
        lastName: prev.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : '') || addr?.lastName || '',
        email: user.email || prev.email,
        phone: prev.phone || user.phone || addr?.phone || '',
        dni: prev.dni || user.dni || addr?.dni || '',
        province: addr?.province || prev.province || 'Córdoba',
        city: addr?.city || prev.city || 'Córdoba Capital',
        neighborhood: addr?.neighborhood || prev.neighborhood || 'Nueva Córdoba',
        street: prev.street || addr?.street || '',
        number: prev.number || addr?.number || '',
        floorApartment: prev.floorApartment || addr?.floorApartment || '',
        reference: prev.reference || addr?.reference || '',
      }));
    }
  }, [user]);

  // Auto-sync Shipping Zone based on selected Neighborhood
  useEffect(() => {
    if (formData.neighborhood && NEIGHBORHOOD_ZONE_MAP[formData.neighborhood]) {
      const targetZoneId = NEIGHBORHOOD_ZONE_MAP[formData.neighborhood];
      if (selectedZoneId !== targetZoneId) {
        setSelectedZoneId(targetZoneId);
      }
    }
  }, [formData.neighborhood, selectedZoneId, setSelectedZoneId]);

  const totalCartItemsCount = selectedCartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

  // Mercado Pago Modal State
  const [mpModalData, setMpModalData] = useState<{
    isOpen: boolean;
    order: Order | null;
    initPoint?: string;
    preferenceId?: string;
    isSimulated?: boolean;
  }>({
    isOpen: false,
    order: null
  });

  // Dynamic Uber-style Cadetería calculation based on origin: Llanquelén 4741, Villa Martínez
  const uberQuote = useMemo<UberShippingQuote>(() => {
    let lat = formData.latitude;
    let lng = formData.longitude;
    if (!lat || !lng) {
      const streetCoords = getCoordinatesForStreet(formData.street);
      if (streetCoords) {
        lat = streetCoords.lat;
        lng = streetCoords.lng;
      } else {
        const coords = getCoordinatesForNeighborhood(formData.neighborhood);
        lat = coords.lat;
        lng = coords.lng;
      }
    }
    const destLabel = formData.street
      ? `${formData.street} ${formData.number || ''}, B° ${formData.neighborhood}`
      : `B° ${formData.neighborhood}, Córdoba`;
    return calculateUberCadeteriaFare(lat, lng, destLabel);
  }, [formData.latitude, formData.longitude, formData.neighborhood, formData.street, formData.number]);

  // 🔒 Zona mínima obligatoria calculada por distancia/cuadrante desde Llanquelén 4741
  const requiredMinimumZoneResult = useMemo(() => {
    return getRequiredMinimumZone(
      uberQuote.drivingDistanceKm,
      shippingZones,
      formData.neighborhood,
      formData.latitude,
      formData.longitude,
      formData.street
    );
  }, [uberQuote.drivingDistanceKm, shippingZones, formData.neighborhood, formData.latitude, formData.longitude, formData.street]);

  const minimumRequiredZone = requiredMinimumZoneResult.requiredZone;

  // 🔒 Sincronización y fijación de zona: si la zona seleccionada actualmente es menor que la requerida,
  // se fuerza y guarda automáticamente la zona correspondiente para que nadie pueda evadir el costo real.
  useEffect(() => {
    const currentZone = shippingZones.find(z => z.id === selectedZoneId);
    if (!currentZone || (currentZone.price || 0) < (minimumRequiredZone.price || 0)) {
      setSelectedZoneId(minimumRequiredZone.id);
      try {
        localStorage.setItem('vondro_selected_zone_v2', minimumRequiredZone.id);
      } catch (_) {}
    }
  }, [minimumRequiredZone, selectedZoneId, shippingZones, setSelectedZoneId]);

  const freeShipThreshold = settings?.freeShippingThreshold ?? 100000;
  const isFreeShipEligible = cartSubtotal >= freeShipThreshold;
  const remainingForFreeShip = Math.max(0, freeShipThreshold - cartSubtotal);

  // Garantiza que la zona cobrada sea como mínimo la zona requerida por distancia
  const selectedZoneCandidate = shippingZones.find(z => z.id === selectedZoneId) || minimumRequiredZone;
  const enforcedZone = (selectedZoneCandidate && selectedZoneCandidate.price >= minimumRequiredZone.price)
    ? selectedZoneCandidate
    : minimumRequiredZone;
  const selectedZone = enforcedZone;

  const effectiveShippingCost = isFreeShipEligible ? 0 : (enforcedZone?.price || currentShippingCost || 3000);
  const finalTotal = Math.max(0, cartSubtotal - discountAmount + effectiveShippingCost);

  const handleInputChange = (field: keyof CustomerData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 0. MANDATORY AUTHENTICATION CHECK - User must be logged in/registered
    if (!user) {
      triggerHaptic('warning');
      setErrorMessage('Para confirmar tu pedido en VONDRO es obligatorio iniciar sesión o registrarte.');
      setAuthModalMode('login');
      setShowAuthModal(true);
      return;
    }

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMessage('Por favor ingresa tu nombre y apellido.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 8) {
      setErrorMessage('Por favor ingresa un número de teléfono / WhatsApp válido.');
      return;
    }
    if (!formData.street.trim() || !formData.number.trim()) {
      setErrorMessage('Por favor ingresa la calle y altura de entrega.');
      return;
    }

    // MANDATORY RECEIPT VALIDATION FOR BANK TRANSFER
    if (paymentMethod === 'bank_transfer' && !transferReceiptImage) {
      triggerHaptic('warning');
      setErrorMessage('Es obligatorio adjuntar el comprobante de transferencia para poder confirmar el pedido.');
      const receiptEl = document.getElementById('transfer-receipt-upload-section');
      if (receiptEl) {
        receiptEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const finalZoneIdToUse = enforcedZone.id;
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
      const addressLine = [
        `${formData.street.trim()} ${formData.number.trim()}`.trim(),
        formData.floorApartment?.trim(),
        formData.neighborhood ? `B° ${formData.neighborhood}` : '',
        formData.city || 'Córdoba Capital'
      ].filter(Boolean).join(', ');

      const customerPayload: CustomerData = {
        ...formData,
        name: formData.name?.trim() || fullName,
        fullName: formData.fullName?.trim() || fullName,
        address: formData.address?.trim() || addressLine,
      };

      if (paymentMethod === 'mercadopago') {
        // Create Mercado Pago Preference via secure backend with enforced zone
        const res = await createMercadoPagoPreference(customerPayload, finalZoneIdToUse, adminNotes);
        setIsSubmitting(false);

        if (!res.success || !res.order) {
          setErrorMessage(res.error || 'Hubo un error al iniciar el pago con Mercado Pago.');
          return;
        }

        // Open checkout modal / simulator with secure preference
        setMpModalData({
          isOpen: true,
          order: res.order,
          initPoint: res.initPoint,
          preferenceId: res.preferenceId,
          isSimulated: res.isSimulated
        });
      } else {
        // Standard non-MP orders (bank transfer) with enforced zone
        const result = await createOrder(
          customerPayload, 
          paymentMethod, 
          finalZoneIdToUse, 
          adminNotes, 
          transferReceiptImage || undefined
        );
        setIsSubmitting(false);

        if (!result.success || !result.order) {
          setErrorMessage(result.error || 'Hubo un error al procesar el pedido.');
        } else {
          setOrderCreatedSuccess(result.order);
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Error al procesar el pedido.');
    }
  };

  // SUCCESS CONFIRMATION MODAL / SCREEN FOR CASH & BANK TRANSFER
  if (orderCreatedSuccess) {
    const isBankTransfer = orderCreatedSuccess.paymentMethod === 'bank_transfer';
    const cleanPhone = formatWhatsAppPhone(settings?.whatsappNumber || '3515948952');
    const waText = encodeURIComponent(
      `¡Hola ${settings.storeName}! Acabo de confirmar el pedido ${orderCreatedSuccess.orderNumber} por un total de $${(orderCreatedSuccess.total ?? 0).toLocaleString('es-AR')}. Mi nombre es ${orderCreatedSuccess.customer.firstName} ${orderCreatedSuccess.customer.lastName}.`
    );

    return (
      <div className="pb-24 max-w-lg mx-auto px-4 pt-6 space-y-5 text-center animate-fadeIn">
        {isBankTransfer ? (
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-md border border-amber-300">
            <ShieldCheck className="w-10 h-10" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
              Pedido {orderCreatedSuccess.orderNumber}
            </span>
            {isBankTransfer && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-700" />
                Seguridad: Verificación Pendiente
              </span>
            )}
          </div>

          <h2 className="text-2xl font-black text-slate-900 pt-2">
            {isBankTransfer ? 'Comprobante recibido con éxito' : '¡Muchas gracias por tu compra!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            {isBankTransfer ? (
              <>
                Tu pedido fue registrado en nuestro sistema. Por protocolo de seguridad, <strong>el comprobante adjunto será auditado por el equipo de administración</strong> para confirmar la acreditación bancaria antes de liberar el despacho.
              </>
            ) : (
              'Hemos recibido tu pedido correctamente. Nos pondremos en contacto para coordinar la entrega en Córdoba Capital.'
            )}
          </p>
        </div>

        {/* Order Brief Summary Card */}
        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm text-left space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-xs">
            <span className="text-slate-500">Destinatario:</span>
            <span className="font-bold text-slate-800">{orderCreatedSuccess.customer.firstName} {orderCreatedSuccess.customer.lastName}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-xs">
            <span className="text-slate-500">Dirección:</span>
            <span className="font-bold text-slate-800 text-right">
              {orderCreatedSuccess.customer.street} {orderCreatedSuccess.customer.number}, {orderCreatedSuccess.customer.neighborhood}
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-xs">
            <span className="text-slate-500">Método de pago:</span>
            <span className="font-bold text-purple-700 uppercase">
              {orderCreatedSuccess.paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Transferencia Bancaria Directa'}
            </span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-xs">
            <span className="text-slate-500">Estado del pago:</span>
            {isBankTransfer ? (
              <span className="font-extrabold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-amber-600" />
                Pendiente de Auditoría
              </span>
            ) : (
              <span className="font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Pago Confirmado
              </span>
            )}
          </div>

          {orderCreatedSuccess.paymentMethod === 'bank_transfer' && (
            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-950 space-y-2">
              <div className="space-y-0.5">
                <p className="font-extrabold text-slate-900">Datos bancarios de la cuenta:</p>
                <p className="text-slate-600">Banco: <strong className="text-slate-900">{settings.bankDetails.bankName}</strong></p>
                <p className="text-slate-600">Alias: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-800">{settings.bankDetails.alias}</strong></p>
                <p className="text-slate-600">CBU: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-purple-200 text-slate-900">{settings.bankDetails.cbu}</strong></p>
                <p className="text-slate-600">Titular: <strong className="text-slate-900">{settings.bankDetails.accountHolder} ({settings.bankDetails.cuit})</strong></p>
              </div>

              {orderCreatedSuccess.transferReceiptImage ? (
                <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-[11.5px]">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Comprobante adjuntado para verificación</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 leading-relaxed">
                    El equipo administrativo de VONDRO cotejará la acreditación en la cuenta bancaria. Te notificaremos cuando el pago sea aprobado y empiece la preparación.
                  </p>
                </div>
              ) : (
                <div className="p-2 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-950 text-[11px]">
                  <span>💡 Por favor enviá la captura del comprobante por WhatsApp para validar y despachar tu compra.</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-1 text-sm font-black text-slate-900">
            <span>{isBankTransfer ? 'Total a verificar:' : 'Total abonado:'}</span>
            <span className="text-lg text-purple-700">${(orderCreatedSuccess.total ?? 0).toLocaleString('es-AR')}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            id="btn-view-order-tracking"
            onClick={() => openOrderDetail(orderCreatedSuccess)}
            className="w-full py-3.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl font-bold text-sm shadow-md shadow-purple-700/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Ver estado y seguimiento del pedido</span>
          </button>

          <button
            onClick={() => setActiveTab('home')}
            className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Volver a la tienda
          </button>
        </div>
      </div>
    );
  }

  if (selectedCartItems.length === 0) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-slate-600 font-semibold text-sm">No hay productos seleccionados para pagar.</p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setActiveTab('cart')}
            className="px-4 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Volver al carrito
          </button>
          <button
            onClick={() => setActiveTab('home')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            Ir al catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-lg mx-auto px-3.5 pt-1 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 py-1 border-b border-slate-100">
        <button
          onClick={() => setActiveTab('cart')}
          className="p-1.5 -ml-1 rounded-full text-slate-700 hover:bg-slate-100 active:scale-95 cursor-pointer"
          aria-label="Volver al carrito"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-base font-extrabold text-slate-900">Datos de envío y pago</h1>
      </div>

      {/* Collapsible Order Summary Accordion */}
      {selectedCartItems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsSummaryExpanded(prev => !prev)}
            className="w-full px-3 py-2.5 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/70 active:bg-slate-100 transition-colors text-left cursor-pointer"
            aria-expanded={isSummaryExpanded}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block leading-tight">
                  Ver resumen del pedido ({totalCartItemsCount} {totalCartItemsCount === 1 ? 'ítem' : 'ítems'})
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {isSummaryExpanded ? 'Toca para ocultar el detalle' : 'Toca para corroborar tus productos'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-black text-slate-900">
                ${finalTotal.toLocaleString('es-AR')}
              </span>
              {isSummaryExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </div>
          </button>

          {isSummaryExpanded && (
            <div className="p-3 border-t border-slate-100 bg-white space-y-2.5">
              {/* Product items list */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 divide-y divide-slate-100">
                {selectedCartItems.map((item) => {
                  const effectiveUnitPrice = (item.unitPrice !== undefined && item.unitPrice > 0) 
                    ? item.unitPrice 
                    : (item.product.salePrice || 0);
                  const itemSubtotal = effectiveUnitPrice * (item.quantity || 1);
                  const itemKey = item.itemKey || item.product.id;

                  return (
                    <div key={itemKey} className="flex items-start gap-2.5 pt-2 first:pt-0">
                      <img
                        src={item.product.imageUrl || item.product.images?.[0]}
                        alt={item.product.name}
                        className="w-11 h-11 rounded-lg object-cover bg-slate-50 shrink-0 border border-slate-100 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight">
                          {decodeHtmlEntities(item.product.name)}
                        </p>

                        {/* Variants display */}
                        {(item.selectedSize || item.selectedColor || item.selectedVariant) && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {item.selectedSize && (
                              <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-md">
                                {item.selectedSize}
                              </span>
                            )}
                            {item.selectedColor && (
                              <span className="text-[9px] font-bold bg-pink-100 text-pink-800 px-1.5 py-0.2 rounded-md">
                                {item.selectedColor}
                              </span>
                            )}
                            {item.selectedVariant && !item.selectedColor && (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-md">
                                {item.selectedVariant}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Custom specification */}
                        {item.customSpecification && (
                          <p className="text-[10px] text-amber-800 font-medium italic bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md mt-1">
                            "{item.customSpecification}"
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500 font-medium">
                            Cant: {item.quantity}
                          </span>
                          <span className="text-[10px] text-slate-400">×</span>
                          <span className="text-[10px] text-slate-600 font-semibold font-mono">
                            ${effectiveUnitPrice.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-900 shrink-0 font-mono">
                        ${itemSubtotal.toLocaleString('es-AR')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Pricing Breakdown */}
              <div className="pt-2 border-t border-dashed border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal productos</span>
                  <span className="font-semibold">${cartSubtotal.toLocaleString('es-AR')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Descuento cupón</span>
                    <span className="font-bold">-${discountAmount.toLocaleString('es-AR')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Envío</span>
                  <span className={isFreeShipping ? 'font-bold text-emerald-600' : 'font-semibold'}>
                    {isFreeShipping ? 'GRATIS' : `$${currentShippingCost.toLocaleString('es-AR')}`}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-1.5 border-t border-slate-100">
                  <span>Total final</span>
                  <span className="text-purple-700">${finalTotal.toLocaleString('es-AR')}</span>
                </div>
              </div>

              {/* Action to edit in cart */}
              <div className="pt-0.5 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('cart')}
                  className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Modificar productos en el carrito
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleConfirmOrder} className="space-y-2.5">
        {/* User Account / Mandatory Auth Gate Banner */}
        {user ? (
          <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-emerald-50 rounded-2xl p-3 border border-purple-200/80 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-slate-900 text-xs truncate">{user.name || 'Cliente Vondro'}</span>
                  <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Cuenta activa
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium truncate block">{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowSavedAddressesModal(true);
              }}
              className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline shrink-0 cursor-pointer"
            >
              Mis direcciones
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-purple-50/50 rounded-2xl p-3.5 border-2 border-amber-300 shadow-sm space-y-2.5 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Lock className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    Identificación obligatoria
                  </h3>
                  <span className="text-[9px] font-black uppercase bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded-md">
                    Requerido
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Para poder realizar tu pedido y coordinar el envío en Córdoba, es <strong>obligatorio iniciar sesión o crear tu cuenta</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                id="btn-checkout-login-trigger"
                onClick={() => {
                  triggerHaptic('selection');
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                }}
                className="flex-1 py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Iniciar Sesión</span>
              </button>

              <button
                type="button"
                id="btn-checkout-register-trigger"
                onClick={() => {
                  triggerHaptic('selection');
                  setAuthModalMode('register');
                  setShowAuthModal(true);
                }}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border-2 border-purple-700 text-purple-700 font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Registrarme</span>
              </button>
            </div>
          </div>
        )}

        {/* Contact & Personal Data */}
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Datos de contacto
            </h2>
            {user?.addresses && user.addresses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const saved = user.addresses?.[0] || user.defaultAddress;
                  if (saved) {
                    setFormData(prev => ({
                      ...prev,
                      firstName: user.name?.split(' ')[0] || saved.firstName || prev.firstName,
                      lastName: user.name?.split(' ').slice(1).join(' ') || saved.lastName || prev.lastName,
                      phone: user.phone || saved.phone || prev.phone,
                      email: user.email || saved.email || prev.email,
                      dni: user.dni || saved.dni || prev.dni || '',
                      street: saved.street || prev.street,
                      number: saved.number || prev.number,
                      floorApartment: saved.floorApartment || prev.floorApartment,
                      neighborhood: saved.neighborhood || prev.neighborhood,
                      reference: saved.reference || prev.reference,
                    }));
                  }
                }}
                className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>📍 Usar datos guardados</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Nombre *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Apellido *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-0.5">DNI / CUIL (Titular de Compra) *</label>
            <input
              type="text"
              required
              placeholder="Ej. 38.452.190"
              value={formData.dni || ''}
              onChange={(e) => handleInputChange('dni', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Teléfono / WhatsApp *</label>
            <input
              type="tel"
              required
              placeholder="Ej. 351 123 4567"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1.5 pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-purple-700" />
              <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                Dirección en Córdoba
              </h2>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-detect-location-checkout"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-purple-700" />
                    <span>Detectando...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3 h-3 text-purple-700" />
                    <span>📍 Usar mi ubicación</span>
                  </>
                )}
              </button>

              {user?.addresses && user.addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowSavedAddressesModal(true);
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                >
                  Guardadas ({user.addresses.length})
                </button>
              )}
            </div>
          </div>

          {/* Quick-fill popular Córdoba locations */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">Puntos rápidos:</span>
            {POPULAR_CORDOBA_LOCATIONS.slice(0, 6).map((loc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setFormData(prev => ({
                    ...prev,
                    street: loc.street,
                    number: loc.number,
                    neighborhood: loc.neighborhood,
                    city: 'Córdoba Capital',
                    province: 'Córdoba',
                  }));
                  setSelectedZoneId(loc.zoneId);
                  setLocationStatusMsg({
                    type: 'success',
                    text: `📍 Dirección aplicada: ${loc.street} ${loc.number} (B° ${loc.neighborhood})`
                  });
                  setTimeout(() => setLocationStatusMsg(null), 4000);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-purple-100 active:scale-95 text-slate-700 hover:text-purple-800 transition-all shrink-0 cursor-pointer border border-slate-200/80"
              >
                <span>{loc.neighborhood}</span>
              </button>
            ))}
          </div>

          {locationStatusMsg && (
            <div className={`p-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 ${
              locationStatusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {locationStatusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              <span>{locationStatusMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Provincia</label>
              <input
                type="text"
                disabled
                readOnly
                value="Córdoba"
                className="w-full bg-[#f0f2f5] border border-slate-200/90 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 cursor-not-allowed select-none focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-0.5">Ciudad</label>
              <input
                type="text"
                disabled
                readOnly
                value="Córdoba Capital"
                className="w-full bg-[#f0f2f5] border border-slate-200/90 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 cursor-not-allowed select-none focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[11px] font-medium text-slate-700">Barrio *</label>
              {formData.neighborhood && NEIGHBORHOOD_ZONE_MAP[formData.neighborhood] && (
                <span className="text-[10px] font-semibold text-purple-700 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 text-purple-600" />
                  Asigna zona automáticamente
                </span>
              )}
            </div>
            <select
              value={formData.neighborhood}
              onChange={(e) => {
                const val = e.target.value;
                handleInputChange('neighborhood', val);
                if (NEIGHBORHOOD_ZONE_MAP[val]) {
                  setSelectedZoneId(NEIGHBORHOOD_ZONE_MAP[val]);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none cursor-pointer"
            >
              {CORDOBA_NEIGHBORHOODS.map((nh) => (
                <option key={nh} value={nh}>{nh}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Dirección / Calle *</label>
              <input
                type="text"
                required
                placeholder="Ej. Av. Colón"
                value={formData.street}
                onChange={(e) => handleInputChange('street', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Número *</label>
              <input
                type="text"
                required
                placeholder="Ej. 1234"
                value={formData.number}
                onChange={(e) => handleInputChange('number', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Piso / Dpto (opcional)</label>
              <input
                type="text"
                placeholder="Ej. 2° B"
                value={formData.floorApartment || ''}
                onChange={(e) => handleInputChange('floorApartment', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-700 block mb-0.5">Referencia (opcional)</label>
              <input
                type="text"
                placeholder="Ej. Timbre blanco"
                value={formData.reference || ''}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
          </div>

          {/* Uber-style Distance Route Card */}
          <div className="pt-2 border-t border-slate-100">
            <div className="bg-slate-950 text-white rounded-xl p-3 border border-slate-800 shadow-md space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5" />
                    Cadetería por Distancia (Estilo Uber)
                  </span>
                </div>
                <span className="text-[9px] font-bold bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                  Moto / Auto
                </span>
              </div>

              {/* Route timeline */}
              <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold shrink-0 mt-0.5">🟢</span>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
                      Punto de Origen (Depósito Central):
                    </span>
                    <span className="text-[11px] font-bold text-white block truncate">
                      Centro de Distribución VONDRO, Córdoba Capital
                    </span>
                  </div>
                </div>

                <div className="border-l-2 border-dashed border-slate-700 ml-2 pl-3.5 py-0.5 my-0.5 flex items-center gap-2 text-[10px] text-amber-300 font-bold">
                  <span className="bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                    📏 {uberQuote.drivingDistanceKm} km en ruta
                  </span>
                  <span>•</span>
                  <span className="bg-sky-400/10 px-1.5 py-0.5 rounded border border-sky-400/20 text-sky-300">
                    ⏱️ ~{uberQuote.estimatedMinutes} min
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold shrink-0 mt-0.5">🔴</span>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-semibold leading-tight">
                      Punto de Entrega (Tu Domicilio):
                    </span>
                    <span className="text-[11px] font-bold text-white block truncate">
                      {formData.street ? `${formData.street} ${formData.number || ''}` : 'Dirección indicada'}, B° {formData.neighborhood}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[11px] font-medium">Tarifa de cadetería calculada:</span>
                  <span className="text-[9px] text-emerald-400/90 font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    Fijada por GPS ({uberQuote.drivingDistanceKm} km)
                  </span>
                </div>
                {isFreeShipEligible ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 line-through font-mono">
                      ${(enforcedZone?.price || 3000).toLocaleString('es-AR')}
                    </span>
                    <span className="text-xs font-black text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/80">
                      GRATIS (Supera $100.000)
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    ${(enforcedZone?.price || 3000).toLocaleString('es-AR')}
                  </span>
                )}
              </div>
            </div>

            {/* Threshold Notice if subtotal < $100.000 */}
            {!isFreeShipEligible && remainingForFreeShip > 0 && (
              <div className="mb-2 p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-medium flex items-center justify-between">
                <span>Sumá <strong>${remainingForFreeShip.toLocaleString('es-AR')}</strong> para <strong>Envío GRATIS</strong></span>
                <span className="text-[10px] font-bold bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded">
                  Desde $100.000
                </span>
              </div>
            )}

            {/* Shipping Zone Radio List */}
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="text-[11px] font-bold text-slate-800">Zona de Envío por Radio (km):</label>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Zona fijada por distancia ({uberQuote.drivingDistanceKm} km)
              </span>
            </div>

            <div className="space-y-1.5">
              {shippingZones.map((zone) => {
                const isAutoSelected = minimumRequiredZone.id === zone.id;
                const isSelected = selectedZoneId === zone.id;
                const isBlockedLower = (zone.price || 0) < (minimumRequiredZone.price || 0);

                return (
                  <div
                    key={zone.id}
                    onClick={() => {
                      if (isBlockedLower) {
                        triggerHaptic('warning');
                        setLocationStatusMsg({
                          type: 'error',
                          text: `⚠️ Zona no permitida: Tu domicilio está a ${uberQuote.drivingDistanceKm} km de nuestro centro de despacho en Córdoba Capital. La tarifa mínima permitida para esta distancia es ${minimumRequiredZone.name} ($${(minimumRequiredZone.price || 0).toLocaleString('es-AR')}).`
                        });
                        return;
                      }
                      triggerHaptic('selection');
                      setSelectedZoneId(zone.id);
                      try {
                        localStorage.setItem('vondro_selected_zone_v2', zone.id);
                      } catch (_) {}
                    }}
                    className={`relative flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isBlockedLower
                        ? 'bg-slate-100/90 border-slate-200 opacity-60 cursor-not-allowed select-none'
                        : isSelected
                        ? 'border-purple-600 bg-purple-50/90 ring-2 ring-purple-600 shadow-sm cursor-pointer'
                        : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="radio"
                        name="shippingZone"
                        checked={isSelected}
                        disabled={isBlockedLower}
                        onChange={() => {
                          if (!isBlockedLower) {
                            setSelectedZoneId(zone.id);
                            try {
                              localStorage.setItem('vondro_selected_zone_v2', zone.id);
                            } catch (_) {}
                          }
                        }}
                        className={`text-purple-600 focus:ring-purple-500 ${isBlockedLower ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                      />
                      <div className="text-xs min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-bold leading-tight ${isBlockedLower ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                            {zone.name}
                          </span>
                          {isAutoSelected && (
                            <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              Tu zona fijada ({uberQuote.drivingDistanceKm} km)
                            </span>
                          )}
                          {isBlockedLower && (
                            <span className="text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              Bloqueado: menor a tu distancia real
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">{zone.description}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <span className={`text-xs font-black font-mono block ${
                        isBlockedLower
                          ? 'text-slate-400 line-through'
                          : isFreeShipEligible
                          ? 'text-emerald-600'
                          : 'text-purple-700'
                      }`}>
                        {isFreeShipEligible ? 'GRATIS' : `$${(zone.price ?? 0).toLocaleString('es-AR')}`}
                      </span>
                      {isBlockedLower && (
                        <span className="text-[8.5px] font-bold text-rose-600 block">
                          No disponible
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Método de pago
            </h2>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" />
              100% Seguro
            </span>
          </div>

          <div className="space-y-1.5">
            {/* Mercado Pago */}
            <label
              className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                paymentMethod === 'mercadopago'
                  ? 'border-[#009EE3] bg-sky-50/80 ring-1 ring-[#009EE3]'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="mercadopago"
                checked={paymentMethod === 'mercadopago'}
                onChange={() => setPaymentMethod('mercadopago')}
                className="text-sky-600 focus:ring-sky-500"
              />
              <div className="w-7 h-7 rounded-lg bg-[#009EE3] text-white flex items-center justify-center shrink-0 font-black text-[10px] shadow-2xs">
                MP
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-900 block leading-tight">Mercado Pago</span>
                  <span className="text-[8px] font-extrabold uppercase bg-sky-100 text-[#009EE3] px-1 py-0.2 rounded">Recomendado</span>
                </div>
                <span className="text-[10px] text-slate-500 block">Débito, crédito, QR o dinero en cuenta</span>
              </div>
            </label>

            {/* Transferencia Bancaria Directa */}
            <div className={`rounded-xl border transition-all overflow-hidden ${
              paymentMethod === 'bank_transfer'
                ? 'border-purple-600 bg-purple-50/40 ring-1 ring-purple-600'
                : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <label className="flex items-center gap-2.5 p-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank_transfer"
                  checked={paymentMethod === 'bank_transfer'}
                  onChange={() => setPaymentMethod('bank_transfer')}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 text-xs">
                  <span className="font-bold text-slate-900 block leading-tight">Transferencia bancaria directa</span>
                  <span className="text-[10px] text-slate-500 block">Alias: <strong className="font-mono text-purple-700">{settings.bankDetails.alias}</strong></span>
                </div>
              </label>

              {/* Sub-panel when bank transfer is selected: Bank details & Receipt attachment */}
              {paymentMethod === 'bank_transfer' && (
                <div className="p-3 pt-1 border-t border-purple-100 bg-white space-y-2.5 animate-fadeIn">
                  {/* Bank info box */}
                  <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-100 text-[11px] text-slate-700 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Banco:</span>
                      <span className="font-bold text-slate-900">{settings.bankDetails.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Alias:</span>
                      <span className="font-mono font-bold text-purple-800 bg-white px-1.5 py-0.5 rounded border border-purple-200">
                        {settings.bankDetails.alias}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">CBU:</span>
                      <span className="font-mono text-[10px] text-slate-800">{settings.bankDetails.cbu}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Titular:</span>
                      <span className="font-semibold text-slate-800">{settings.bankDetails.accountHolder}</span>
                    </div>
                  </div>

                  {/* Receipt Uploader */}
                  <div id="transfer-receipt-upload-section" className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-bold text-slate-800 block flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span>📄 Comprobante de transferencia:</span>
                      </span>
                      <span className="text-[9.5px] text-rose-700 font-black bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                        * OBLIGATORIO
                      </span>
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReceiptFileChange}
                      className="hidden"
                      id="input-transfer-receipt"
                    />

                    {isCompressingReceipt ? (
                      <div className="w-full py-3 px-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-purple-700">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-700" />
                        <span>Comprimiendo y preparando comprobante...</span>
                      </div>
                    ) : transferReceiptImage ? (
                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 animate-fadeIn">
                        <div className="flex items-center gap-2 min-w-0">
                          {transferReceiptImage.startsWith('data:image') ? (
                            <img 
                              src={transferReceiptImage} 
                              alt="Comprobante" 
                              className="w-10 h-10 object-cover rounded-lg border border-emerald-300 shrink-0" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-emerald-900 block truncate">
                              {transferReceiptName || 'Comprobante adjuntado'}
                            </span>
                            <span className="text-[10px] text-emerald-700 flex items-center gap-0.5">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Comprobante verificado y listo
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleRemoveReceipt}
                          className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Eliminar comprobante"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-2.5 px-3 border-2 border-dashed border-rose-300 hover:border-purple-500 bg-rose-50/40 hover:bg-purple-50 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-purple-800 cursor-pointer active:scale-98 transition-all"
                        >
                          <Upload className="w-4 h-4 text-rose-600" />
                          <span>Adjuntar comprobante de pago</span>
                        </button>
                        <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-lg text-[10.5px] text-amber-900 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Es requisito subir la foto/captura del comprobante para poder confirmar el pedido.</span>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500 leading-tight flex items-center gap-1">
                      <span>🔒</span>
                      <span>Al adjuntar tu comprobante, la administración audita la acreditación para despachar tu compra a tiempo.</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error message if any */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Total Summary Breakdown & Submit */}
        <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs space-y-2">
          <div className="flex justify-between items-baseline text-xs">
            <span className="text-slate-600 font-medium">Total a pagar</span>
            <span className="text-xl font-black text-purple-700">
              ${(finalTotal ?? 0).toLocaleString('es-AR')}
            </span>
          </div>

          {!user ? (
            <div className="space-y-2 pt-1">
              <div className="p-2.5 bg-amber-50 border border-amber-200/90 rounded-xl flex items-center gap-2 text-amber-900 text-xs">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Requisito obligatorio: Debés identificarte para realizar el pedido.</span>
              </div>
              <button
                id="btn-confirm-order-auth-required"
                type="button"
                onClick={() => {
                  triggerHaptic('warning');
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                }}
                className="w-full py-3.5 rounded-xl text-white text-sm font-black shadow-md shadow-purple-700/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer bg-purple-700 hover:bg-purple-800"
              >
                <Lock className="w-4 h-4" />
                <span>Iniciar sesión o registrarme para realizar pedido</span>
              </button>
            </div>
          ) : (
            <button
              id="btn-confirm-order"
              type="submit"
              disabled={isSubmitting || isCompressingReceipt}
              className={`w-full py-3 rounded-xl text-white text-sm font-black shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                paymentMethod === 'mercadopago'
                  ? 'bg-[#009EE3] hover:bg-[#0089c7] shadow-sky-600/20'
                  : (paymentMethod === 'bank_transfer' && !transferReceiptImage)
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-purple-700 hover:bg-purple-800 shadow-purple-700/20'
              }`}
            >
              {isSubmitting ? (
                <span>Iniciando pago...</span>
              ) : isCompressingReceipt ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando comprobante...</span>
                </span>
              ) : paymentMethod === 'mercadopago' ? (
                <span className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  Pagar con Mercado Pago
                </span>
              ) : (paymentMethod === 'bank_transfer' && !transferReceiptImage) ? (
                <span className="flex items-center gap-1.5">
                  <Upload className="w-4 h-4" />
                  Adjuntar comprobante para confirmar
                </span>
              ) : (
                <span>Confirmar pedido</span>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Mercado Pago Checkout & Simulation Modal */}
      {mpModalData.isOpen && mpModalData.order && (
        <MercadoPagoModal
          isOpen={mpModalData.isOpen}
          order={mpModalData.order}
          initPoint={mpModalData.initPoint}
          preferenceId={mpModalData.preferenceId}
          isSimulated={mpModalData.isSimulated}
          onClose={() => setMpModalData(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Saved Addresses Selector Modal for Checkout */}
      {showSavedAddressesModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9998] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setShowSavedAddressesModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-5 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto animate-scaleIn shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Mis Direcciones Guardadas</h3>
                  <p className="text-xs text-slate-500">Selecciona el domicilio para tu entrega</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedAddressesModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Quick GPS button inside modal */}
            <button
              type="button"
              onClick={async () => {
                await handleDetectLocation();
                setShowSavedAddressesModal(false);
              }}
              disabled={isDetectingLocation}
              className="w-full py-2.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isDetectingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-700" />
                  <span>Detectando ubicación GPS...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-purple-700" />
                  <span>📍 Usar mi ubicación actual exacta</span>
                </>
              )}
            </button>

            {/* List of saved addresses */}
            <div className="space-y-2.5">
              {(!user?.addresses || user.addresses.length === 0) ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <MapPin className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No tienes direcciones guardadas aún</p>
                  <p className="text-[11px] text-slate-500">
                    Completá tu dirección en el formulario o detectala automáticamente con GPS.
                  </p>
                </div>
              ) : (
                user.addresses.map((addr, idx) => {
                  const isCurrentlySelected = 
                    formData.street.toLowerCase().trim() === (addr.street || '').toLowerCase().trim() &&
                    formData.number.trim() === (addr.number || '').trim();

                  return (
                    <div 
                      key={idx}
                      onClick={() => handleSelectSavedAddress(addr)}
                      className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all cursor-pointer relative ${
                        isCurrentlySelected
                          ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-300 shadow-xs'
                          : 'bg-slate-50 hover:bg-purple-50/40 border-slate-200 hover:border-purple-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 flex items-center gap-1.5 text-sm">
                          <MapPin className="w-4 h-4 text-purple-700" />
                          {addr.street} {addr.number} {addr.floorApartment ? `, ${addr.floorApartment}` : ''}
                        </span>
                        {isCurrentlySelected ? (
                          <span className="bg-purple-700 text-white font-black text-[9.5px] px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> SELECCIONADA
                          </span>
                        ) : idx === 0 ? (
                          <span className="bg-slate-200 text-slate-700 font-bold text-[9px] px-2 py-0.5 rounded-full">
                            PRINCIPAL
                          </span>
                        ) : null}
                      </div>

                      <p className="text-slate-700 font-semibold">
                        Barrio {addr.neighborhood}, {addr.city || 'Córdoba Capital'}
                      </p>

                      {addr.reference && (
                        <p className="text-slate-500 text-[11px] italic">
                          Ref: {addr.reference}
                        </p>
                      )}

                      <div className="pt-1 flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-500">Tel: {addr.phone || user?.phone || 'No especificado'}</span>
                        <span className="text-purple-700 font-bold flex items-center gap-0.5">
                          Tocar para usar →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowSavedAddressesModal(false);
                  setActiveTab('profile');
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-purple-900 font-bold text-xs rounded-xl transition-colors cursor-pointer text-center"
              >
                ⚙️ Gestionar en mi Perfil
              </button>
              <button
                type="button"
                onClick={() => setShowSavedAddressesModal(false)}
                className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Mandatory Authentication Modal for Checkout with Portal for Full View and Top-Level Stacking */}
      {showAuthModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-start sm:justify-center p-2.5 sm:p-4 py-4 sm:py-6 overflow-y-auto overscroll-contain animate-fadeIn"
          onClick={() => setShowAuthModal(false)}
        >
          <div 
            className="w-full max-w-[430px] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <LoginView
              isModal={true}
              allowGuest={false}
              initialMode={authModalMode}
              checkoutNotice={`Iniciá sesión o registrate para concretar tu pedido de ARS$${(finalTotal ?? 0).toLocaleString('es-AR')} en VONDRO. Tus artículos seleccionados permanecerán en tu carrito.`}
              onCancel={() => setShowAuthModal(false)}
              onSuccess={() => {
                setShowAuthModal(false);
                setErrorMessage(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

