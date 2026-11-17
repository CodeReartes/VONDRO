import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  IdCard,
  Phone,
  Home,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  MapPin,
  Save,
  Search,
  Camera,
  Upload,
  Check,
  Sparkles,
  QrCode,
  Video,
  X
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CustomerData } from '../types';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';
import { compressImageFile } from '../utils/imageCompressor';
import { auth } from '../lib/firebase';
import { calculateDistanceInKm, CORDOBA_ORIGIN_COORDINATES } from '../utils/cordobaShipping';
import {
  scanPdf417FromImageDataUrl,
  ArgentineDniPdf417Result
} from '../utils/dniPdf417';
import {
  getDeviceCoordinates,
  reverseGeocodeCoordinates,
  verifyCordobaAddress,
  splitStreetAndNumber,
  VerifiedAddressCandidate,
  KNOWN_CORDOBA_NEIGHBORHOODS as CORDOBA_NEIGHBORHOODS
} from '../utils/geoAddress';

interface PersonalDataViewProps {
  onBack?: () => void;
}

function getInitialAddressFields(user: any) {
  const primary: any = user?.defaultAddress || user?.addresses?.[0] || user?.address || {};
  const rawStreet = String(primary?.street || '').trim();
  const rawNumber = String(primary?.number || '').trim();
  const fullStreet = rawNumber && !rawStreet.includes(rawNumber)
    ? `${rawStreet} ${rawNumber}`.trim()
    : rawStreet;

  const lat = Number(primary?.coordinates?.lat ?? primary?.latitude);
  const lng = Number(primary?.coordinates?.lng ?? primary?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

  return {
    street: fullStreet,
    floorApt: String(primary?.floorApartment || primary?.floor || '').trim(),
    neighborhood: String(primary?.neighborhood || 'Nueva Córdoba').trim() || 'Nueva Córdoba',
    city: String(primary?.city || 'Córdoba Capital').trim() || 'Córdoba Capital',
    reference: String(primary?.reference || primary?.additionalInfo || '').trim(),
    coords: hasCoords ? { lat, lng } : null,
    addressVerified: Boolean(primary?.addressVerified || hasCoords),
    addressVerificationSource: primary?.addressVerificationSource || (hasCoords ? 'gps_reverse' : 'manual'),
    matchedZoneId: primary?.matchedZoneId as string | undefined,
    distanceKm: typeof primary?.distanceKm === 'number' ? primary.distanceKm : undefined
  };
}

export const PersonalDataView: React.FC<PersonalDataViewProps> = ({ onBack }) => {
  const { user, updateUserProfile, setActiveTab } = useStore();

  useEffect(() => {
    scrollToTop();
  }, []);

  const initialAddr = getInitialAddressFields(user);

  // Identity & Contact state
  const [name, setName] = useState<string>(user?.name || '');
  const [dni, setDni] = useState<string>(user?.dni || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [email, setEmail] = useState<string>(user?.email || '');

  // Address & Geolocation state
  const [street, setStreet] = useState<string>(initialAddr.street);
  const [floorApt, setFloorApt] = useState<string>(initialAddr.floorApt);
  const [neighborhood, setNeighborhood] = useState<string>(initialAddr.neighborhood);
  const [city, setCity] = useState<string>(initialAddr.city);
  const [reference, setReference] = useState<string>(initialAddr.reference);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(initialAddr.coords);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressVerified, setAddressVerified] = useState<boolean>(initialAddr.addressVerified);
  const [addressVerificationSource, setAddressVerificationSource] = useState<
    'gps_reverse' | 'georef_ar' | 'nominatim' | 'manual'
  >(initialAddr.addressVerificationSource);
  const [matchedZoneId, setMatchedZoneId] = useState<string | undefined>(initialAddr.matchedZoneId);
  const [distanceKm, setDistanceKm] = useState<number | undefined>(initialAddr.distanceKm);

  // Address lookup / GPS UI state
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [isVerifyingAddress, setIsVerifyingAddress] = useState<boolean>(false);
  const [addressCandidates, setAddressCandidates] = useState<VerifiedAddressCandidate[]>([]);
  const [geoStatusMsg, setGeoStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // KYC Document Verification state
  const [dniFrontPreview, setDniFrontPreview] = useState<string>('');
  const [dniBackPreview, setDniBackPreview] = useState<string>('');
  const [selfiePreview, setSelfiePreview] = useState<string>('');
  const [pdf417Result, setPdf417Result] = useState<ArgentineDniPdf417Result | null>(null);
  const [isScanningPdf417, setIsScanningPdf417] = useState<boolean>(false);
  const [isVerifyingKyc, setIsVerifyingKyc] = useState<boolean>(false);
  const [kycMessage, setKycMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Live Camera Selfie (Liveness / Prueba de vida) state
  const LIVENESS_PROMPTS = [
    'Mirá de frente a la cámara con tu rostro dentro del óvalo',
    'Sonreí levemente mirando de frente con buena iluminación',
    'Mantené el rostro centrado y sin lentes oscuros'
  ];
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [livenessChallenge, setLivenessChallenge] = useState<string>(LIVENESS_PROMPTS[0]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selfieFallbackInputRef = useRef<HTMLInputElement | null>(null);

  // Re-sync form if user object loads/changes asynchronously after mount
  useEffect(() => {
    if (!user) return;
    setName(prev => prev || user.name || '');
    setDni(prev => prev || user.dni || '');
    setPhone(prev => prev || user.phone || '');
    setEmail(prev => prev || user.email || '');

    const synced = getInitialAddressFields(user);
    setStreet(prev => prev || synced.street);
    setFloorApt(prev => prev || synced.floorApt);
    setNeighborhood(prev => (prev && prev !== 'Nueva Córdoba') ? prev : synced.neighborhood);
    setCity(prev => (prev && prev !== 'Córdoba Capital') ? prev : synced.city);
    setReference(prev => prev || synced.reference);
    setAddressCoords(prev => prev || synced.coords);
    if (synced.addressVerified) {
      setAddressVerified(true);
      setAddressVerificationSource(synced.addressVerificationSource);
    }
    if (synced.matchedZoneId) setMatchedZoneId(prev => prev || synced.matchedZoneId);
    if (synced.distanceKm !== undefined) setDistanceKm(prev => prev ?? synced.distanceKm);
  }, [user]);

  const cleanDniDigits = dni.replace(/\D/g, '');
  const isDniValid = cleanDniDigits.length >= 7 && cleanDniDigits.length <= 9;
  const kycStatus = user?.identityVerification?.status;

  const gpsMatchDistanceKm =
    gpsCoords && addressCoords
      ? Math.round(calculateDistanceInKm(gpsCoords.lat, gpsCoords.lng, addressCoords.lat, addressCoords.lng) * 100) / 100
      : null;

  const handleBack = () => {
    triggerHaptic('light');
    scrollToTop();
    if (onBack) {
      onBack();
    } else {
      setActiveTab('profile');
    }
  };

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setGeoStatusMsg(null);
    setAddressCandidates([]);
    triggerHaptic('medium');

    try {
      const coords = await getDeviceCoordinates();
      setGpsCoords({ lat: coords.latitude, lng: coords.longitude });

      const res = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);
      const formattedStreet = `${res.street} ${res.number || ''}`.trim();

      if (formattedStreet) setStreet(formattedStreet);
      if (res.neighborhood) setNeighborhood(res.neighborhood);
      if (res.city) setCity(res.city);

      setAddressCoords({ lat: res.latitude, lng: res.longitude });
      setAddressVerified(true);
      setAddressVerificationSource('gps_reverse');
      if (res.matchedZoneId) setMatchedZoneId(res.matchedZoneId);
      if (typeof res.distanceKm === 'number') setDistanceKm(res.distanceKm);

      setGeoStatusMsg({
        type: 'success',
        text: `📍 Ubicación GPS detectada y guardada: ${formattedStreet || 'Ubicación fijada'} (B° ${res.neighborhood} · ${res.distanceKm ?? ''} km).`
      });
      triggerHaptic('success');
    } catch (err: any) {
      console.warn('Geolocation error in personal data:', err);
      setGeoStatusMsg({
        type: 'error',
        text: `${err?.message || 'No se pudo obtener el GPS automáticamente.'} Escribí tu calle y altura abajo y tocá "Verificar en mapa".`
      });
      triggerHaptic('error');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const applyVerifiedCandidate = (cand: VerifiedAddressCandidate) => {
    triggerHaptic('selection');
    const fullStreet = `${cand.street} ${cand.number || ''}`.trim();
    setStreet(fullStreet);
    setNeighborhood(cand.neighborhood || 'Centro');
    setCity(cand.city || 'Córdoba Capital');
    setAddressCoords({ lat: cand.latitude, lng: cand.longitude });
    setAddressVerified(true);
    setAddressVerificationSource(cand.source);
    setMatchedZoneId(cand.matchedZoneId);
    setDistanceKm(cand.distanceKm);
    setAddressCandidates([]);

    setGeoStatusMsg({
      type: 'success',
      text: `✓ Dirección real confirmada (${cand.source === 'georef_ar' ? 'Georef AR oficial' : 'Mapa Córdoba'}): ${fullStreet}, B° ${cand.neighborhood}.`
    });
  };

  const handleVerifyTypedAddress = async () => {
    const query = street.trim();
    if (query.length < 3) {
      setGeoStatusMsg({
        type: 'error',
        text: 'Ingresá calle y número (ej. Av. Colón 1450) para verificar si existe en Córdoba.'
      });
      return;
    }
    setIsVerifyingAddress(true);
    setGeoStatusMsg(null);
    setAddressCandidates([]);
    triggerHaptic('light');

    try {
      const { street: sName, number: sNum } = splitStreetAndNumber(query);
      const res = await verifyCordobaAddress({
        query,
        street: sName,
        number: sNum,
        city: city || 'Córdoba'
      });

      if (!res.verified || res.suggestions.length === 0) {
        setAddressVerified(false);
        setAddressVerificationSource('manual');
        setGeoStatusMsg({
          type: 'error',
          text: res.error || 'No encontramos esa calle y altura en Córdoba. Revisá el nombre o probá sin abreviaturas (ej. "Avenida Colón 1450").'
        });
        triggerHaptic('error');
        return;
      }

      if (res.suggestions.length === 1) {
        applyVerifiedCandidate(res.suggestions[0]);
      } else {
        setAddressCandidates(res.suggestions);
        setGeoStatusMsg({
          type: 'info',
          text: `Encontramos ${res.suggestions.length} coincidencias reales en Córdoba. Seleccioná la tuya:`
        });
      }
    } catch {
      setGeoStatusMsg({
        type: 'error',
        text: 'No se pudo consultar el mapa en este momento. Verificá tu conexión e intentá nuevamente.'
      });
    } finally {
      setIsVerifyingAddress(false);
    }
  };

  const persistProfileAndAddress = async (extraPatch: Record<string, any> = {}) => {
    const cleanDni = dni.trim();
    const { street: parsedStreet, number: parsedNumber } = splitStreetAndNumber(street);
    const nameParts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'VONDRO';

    const resolvedCoords = addressCoords || gpsCoords || null;
    const computedDist = resolvedCoords
      ? Math.round(
          calculateDistanceInKm(
            CORDOBA_ORIGIN_COORDINATES.lat,
            CORDOBA_ORIGIN_COORDINATES.lng,
            resolvedCoords.lat,
            resolvedCoords.lng
          ) * 10
        ) / 10
      : distanceKm;

    const legacyAddressObj = {
      street: street.trim(),
      number: parsedNumber,
      neighborhood: neighborhood.trim(),
      city: city.trim() || 'Córdoba Capital',
      province: 'Córdoba',
      zipCode: '5000',
      floor: floorApt.trim(),
      additionalInfo: reference.trim(),
      isDefault: true,
      ...(resolvedCoords ? { latitude: resolvedCoords.lat, longitude: resolvedCoords.lng } : {}),
      addressVerified,
      addressVerificationSource
    };

    const customerAddressObj: CustomerData = {
      firstName,
      lastName,
      fullName: name.trim(),
      name: name.trim(),
      dni: cleanDni,
      phone: phone.trim(),
      email: email.trim(),
      province: 'Córdoba',
      city: city.trim() || 'Córdoba Capital',
      neighborhood: neighborhood.trim(),
      street: parsedStreet,
      number: parsedNumber,
      floor: floorApt.trim(),
      floorApartment: floorApt.trim(),
      reference: reference.trim(),
      address: `${street.trim()}${floorApt.trim() ? ` (${floorApt.trim()})` : ''}`,
      latitude: resolvedCoords?.lat ?? null,
      longitude: resolvedCoords?.lng ?? null,
      ...(resolvedCoords ? { coordinates: resolvedCoords } : {}),
      addressVerified,
      addressVerificationSource,
      matchedZoneId,
      distanceKm: computedDist,
      gpsMatchDistanceKm
    };

    const existingAddresses = Array.isArray(user?.addresses) ? [...user.addresses] : [];
    let updatedAddresses: CustomerData[];
    if (!parsedStreet) {
      updatedAddresses = existingAddresses;
    } else if (existingAddresses.length === 0) {
      updatedAddresses = [customerAddressObj];
    } else {
      updatedAddresses = [customerAddressObj, ...existingAddresses.slice(1)];
    }

    await updateUserProfile({
      name: name.trim(),
      dni: cleanDni,
      isVerified: Boolean(cleanDniDigits.length >= 7),
      phone: phone.trim(),
      email: email.trim(),
      address: legacyAddressObj,
      ...(parsedStreet ? { defaultAddress: customerAddressObj, addresses: updatedAddresses } : {}),
      ...extraPatch
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    setIsSaving(true);

    try {
      await persistProfileAndAddress();
      triggerHaptic('success');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error saving personal data:', err);
      triggerHaptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  const stopSelfieCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleOpenLiveSelfieCamera = async () => {
    setKycMessage(null);
    setCameraError(null);
    const chosenPrompt = LIVENESS_PROMPTS[Math.floor(Math.random() * LIVENESS_PROMPTS.length)];
    setLivenessChallenge(chosenPrompt);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      selfieFallbackInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setCameraError('No pudimos abrir la cámara en vivo desde este navegador. Podés sacar la selfie con el selector nativo.');
      selfieFallbackInputRef.current?.click();
    }
  };

  const handleCaptureLiveSelfie = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    const maxW = 720;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setSelfiePreview(dataUrl);
    triggerHaptic('success');
    stopSelfieCamera();
  };

  const handleKycImageSelect = async (
    file: File | undefined,
    setter: React.Dispatch<React.SetStateAction<string>>,
    options?: { scanPdf417?: boolean }
  ) => {
    if (!file) return;
    setKycMessage(null);
    try {
      // Use higher resolution when scanning front DNI so PDF417 barcode bars stay sharp
      const maxSize = options?.scanPdf417 ? 1400 : 1000;
      const compressed = await compressImageFile(file, maxSize, maxSize, 0.86);
      setter(compressed);

      if (options?.scanPdf417) {
        setIsScanningPdf417(true);
        setPdf417Result(null);
        try {
          const decoded = await scanPdf417FromImageDataUrl(compressed);
          setPdf417Result(decoded);
          if (decoded?.isValidArgentinePdf417) {
            if (!dni.trim() && decoded.dni) setDni(decoded.dni);
            if (!name.trim() && decoded.fullName) setName(decoded.fullName);
            triggerHaptic('success');
          }
        } finally {
          setIsScanningPdf417(false);
        }
      }
    } catch (err: any) {
      setKycMessage({
        type: 'error',
        text: err?.message || 'No se pudo procesar la foto. Probá con una imagen JPG o PNG más liviana.'
      });
    }
  };

  const handleRunKycVerification = async () => {
    if (!dniFrontPreview || !dniBackPreview || !selfiePreview) {
      setKycMessage({
        type: 'error',
        text: 'Necesitás cargar el Frente del DNI, el Dorso (domicilio) y la Selfie en vivo para validar tu identidad.'
      });
      return;
    }

    setIsVerifyingKyc(true);
    setKycMessage(null);
    triggerHaptic('medium');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const declaredFullAddress = `${street.trim()}, B° ${neighborhood.trim()}, ${city.trim()}`;
      const res = await fetch('/api/account/verify-identity', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dniFrontImage: dniFrontPreview,
          dniBackImage: dniBackPreview,
          selfieImage: selfiePreview,
          pdf417Data: pdf417Result || undefined,
          livenessChallenge,
          declaredName: name.trim(),
          declaredDni: cleanDniDigits,
          declaredAddress: declaredFullAddress
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.verification) {
        setKycMessage({
          type: 'error',
          text: data?.error || 'No se pudo completar la verificación documental.'
        });
        triggerHaptic('error');
        return;
      }

      const ver = data.verification;
      await persistProfileAndAddress({ identityVerification: ver });

      if (ver.status === 'verified_full_match') {
        setKycMessage({
          type: 'success',
          text: `✓ ¡DNI real verificado con domicilio coincidente y biometría facial OK! (${ver.summary})`
        });
        triggerHaptic('success');
      } else if (ver.status === 'verified_dni_document') {
        setKycMessage({
          type: 'warning',
          text: `✓ DNI verificado con domicilio de entrega alternativo. Domicilio legal del DNI (${ver.extractedDniAddress || 'otro'}) distinto al de entrega; tu dirección de envío quedó validada aparte.`
        });
        triggerHaptic('success');
      } else {
        setKycMessage({
          type: 'error',
          text: `⚠ Verificación rechazada: ${ver.summary || 'Los datos o la selfie no coinciden con el DNI.'}`
        });
        triggerHaptic('error');
      }
    } catch {
      setKycMessage({
        type: 'error',
        text: 'Error de conexión al verificar el documento. Intentá nuevamente.'
      });
    } finally {
      setIsVerifyingKyc(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 animate-fadeIn">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-1.5 -ml-1 rounded-full text-slate-800 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            aria-label="Volver al Perfil"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              Mis Datos y DNI
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
              Titularidad de cuenta, ubicación verificada y entrega protegida
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full border ${
              kycStatus === 'verified_full_match' || kycStatus === 'verified_dni_document'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isDniValid
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {kycStatus === 'verified_full_match'
              ? '✓ KYC Completo'
              : kycStatus === 'verified_dni_document'
                ? '✓ DNI Foto OK'
                : isDniValid
                  ? '✓ DNI Cargado'
                  : 'DNI Pendiente'}
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-3.5 sm:p-4 space-y-3.5">
        {/* Verification Status Card */}
        <div
          className={`p-3.5 rounded-2xl border shadow-2xs flex items-center justify-between gap-3 ${
            kycStatus === 'verified_full_match' || kycStatus === 'verified_dni_document'
              ? 'bg-emerald-50/80 border-emerald-200'
              : isDniValid
                ? 'bg-purple-50/60 border-purple-200'
                : 'bg-amber-50/70 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                kycStatus === 'verified_full_match' || kycStatus === 'verified_dni_document'
                  ? 'bg-emerald-600 text-white'
                  : isDniValid
                    ? 'bg-purple-700 text-white'
                    : 'bg-amber-500 text-white'
              }`}
            >
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                  {kycStatus === 'verified_full_match'
                    ? 'Identidad y domicilio verificados con DNI real'
                    : kycStatus === 'verified_dni_document'
                      ? 'Identidad verificada con foto de DNI'
                      : isDniValid
                        ? 'DNI registrado en tu cuenta'
                        : 'Verificación de titularidad pendiente'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                {kycStatus === 'verified_full_match'
                  ? `DNI ${dni} y domicilio legal validados documentalmente.`
                  : isDniValid
                    ? `DNI cargado: ${dni}. Podés verificar tu dirección en el mapa y validar foto de DNI más abajo.`
                    : 'Ingresá tu DNI / CUIL y validá tu domicilio real para entregas seguras en Córdoba.'}
              </p>
            </div>
          </div>
        </div>

        {/* Success Alert Toast */}
        {saveSuccess && (
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md flex items-center gap-2 text-xs font-bold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>¡Tus datos, DNI y ubicación de entrega se guardaron correctamente!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Card 1: Identidad & DNI */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-purple-700" />
                Titular de la cuenta
              </h3>
              <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                Oficial VONDRO
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Nombre y Apellido completo *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Número de DNI o CUIL *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ej. 38452190"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-28 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                />
                <span
                  className={`absolute right-2 top-2 text-[10px] font-black px-2 py-0.5 rounded-md ${
                    isDniValid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isDniValid ? '✓ FORMATO OK' : '7+ DÍGITOS'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Requerido para comprobantes fiscales y control del cadete al entregar.
              </p>
            </div>
          </div>

          {/* Card 2: Contacto */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-purple-700" />
                Datos de contacto
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Teléfono celular *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+54 9 351 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  El repartidor te avisará antes de llegar.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  required
                  placeholder="usuario@dominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Recibirás el recibo de compra.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Domicilio Principal y Sistema de Ubicación Real */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-purple-700" />
                Domicilio principal de entrega
              </h3>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Detectando GPS...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-3 h-3" />
                    <span>Usar mi ubicación GPS</span>
                  </>
                )}
              </button>
            </div>

            {geoStatusMsg && (
              <div
                className={`p-2.5 rounded-xl text-[11px] font-bold flex items-start gap-2 ${
                  geoStatusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : geoStatusMsg.type === 'info'
                      ? 'bg-purple-50 text-purple-900 border border-purple-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {geoStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : geoStatusMsg.type === 'info' ? (
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-purple-700" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{geoStatusMsg.text}</span>
              </div>
            )}

            {/* Suggestions returned by Georef AR / Nominatim */}
            {addressCandidates.length > 0 && (
              <div className="space-y-1.5 bg-purple-50/60 border border-purple-200 rounded-xl p-2.5">
                {addressCandidates.map((cand, idx) => (
                  <button
                    key={`${cand.latitude}-${cand.longitude}-${idx}`}
                    type="button"
                    onClick={() => applyVerifiedCandidate(cand)}
                    className="w-full text-left p-2 bg-white hover:bg-purple-50 border border-purple-100 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {cand.street} {cand.number}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        B° {cand.neighborhood}, {cand.city} · {cand.distanceKm} km de depósito
                      </span>
                    </div>
                    <span className="text-[9.5px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                      {cand.source === 'georef_ar' ? 'Georef AR' : 'Mapa OK'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Calle y Número *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="Ej. Av. Colón 1450"
                      value={street}
                      onChange={(e) => {
                        setStreet(e.target.value);
                        if (addressVerified) {
                          setAddressVerified(false);
                          setAddressVerificationSource('manual');
                        }
                      }}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyTypedAddress}
                      disabled={isVerifyingAddress}
                      className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10.5px] font-bold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                      title="Verificar si la dirección existe en Córdoba (Georef AR + Mapa)"
                    >
                      {isVerifyingAddress ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Verificar</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Piso / Depto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 2° B"
                    value={floorApt}
                    onChange={(e) => setFloorApt(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-200 outline-none"
                  />
                </div>
              </div>

              {/* Address geolocation & verification badge */}
              <div className="flex items-center justify-between flex-wrap gap-1.5 pt-0.5">
                {addressVerified && addressCoords ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>
                      Dirección real verificada ({addressVerificationSource === 'georef_ar' ? 'Georef AR' : addressVerificationSource === 'gps_reverse' ? 'GPS' : 'Mapa'}) · {addressCoords.lat.toFixed(4)}, {addressCoords.lng.toFixed(4)}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    <MapPin className="w-3 h-3" />
                    <span>Tocá &quot;Verificar&quot; o &quot;Usar mi ubicación GPS&quot; para validar coordenadas</span>
                  </span>
                )}

                {gpsMatchDistanceKm !== null && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      gpsMatchDistanceKm <= 0.8
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {gpsMatchDistanceKm <= 0.8
                      ? '✓ GPS coincide con el domicilio'
                      : `A ${gpsMatchDistanceKm} km de tu GPS actual`}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Barrio en Córdoba *
                </label>
                <select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-200 outline-none"
                >
                  {CORDOBA_NEIGHBORHOODS.map((nh) => (
                    <option key={nh} value={nh}>
                      {nh}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Referencia para el cadete
              </label>
              <input
                type="text"
                placeholder="Ej. Portón negro, timbre blanco al lado de la reja"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-200 outline-none"
              />
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 bg-purple-700 hover:bg-purple-800 active:scale-98 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando datos y ubicación...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar datos, DNI y ubicación</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Card 4: Verificación Real de Identidad (DNI Frente + PDF417 + Dorso + Selfie en Vivo) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
                Validación Real: DNI (PDF417), Domicilio y Selfie
              </h3>
              <p className="text-[10.5px] text-slate-500 mt-0.5">
                Leemos el código PDF417 del DNI, comparamos el domicilio del dorso y validamos tu selfie biométrica
              </p>
            </div>
            <span className="text-[9.5px] font-black bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full shrink-0">
              KYC Biométrico
            </span>
          </div>

          {user?.identityVerification && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                user.identityVerification.status === 'verified_full_match'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : user.identityVerification.status === 'verified_dni_document'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="font-extrabold flex items-center gap-1.5 flex-wrap">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {user.identityVerification.status === 'verified_full_match'
                    ? 'DNI real verificado con domicilio coincidente'
                    : user.identityVerification.status === 'verified_dni_document'
                      ? 'DNI verificado con domicilio de entrega alternativo'
                      : 'Verificación con diferencias'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {user.identityVerification.pdf417Verified && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/80 border border-current/20">
                    ✓ PDF417 RENAPER {user.identityVerification.tramiteNumber ? `· Trámite ${user.identityVerification.tramiteNumber}` : ''}
                  </span>
                )}
                {user.identityVerification.selfieMatched && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/80 border border-current/20">
                    ✓ Prueba de vida / Selfie OK
                  </span>
                )}
              </div>
              {user.identityVerification.extractedDniAddress && (
                <p className="text-[11px] opacity-90">
                  Domicilio legal en dorso DNI: <strong>{user.identityVerification.extractedDniAddress}</strong>
                </p>
              )}
              {user.identityVerification.summary && (
                <p className="text-[11px] opacity-90">{user.identityVerification.summary}</p>
              )}
            </div>
          )}

          {/* Client-side PDF417 Live Read Feedback */}
          {isScanningPdf417 && (
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-[11px] font-bold text-purple-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Leyendo código de barras PDF417 del DNI...</span>
            </div>
          )}
          {!isScanningPdf417 && pdf417Result?.isValidArgentinePdf417 && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-900 flex items-start gap-2">
              <QrCode className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <div>
                <span className="block">
                  ✓ Código PDF417 detectado: DNI {pdf417Result.dni} · {pdf417Result.fullName}
                </span>
                {pdf417Result.tramiteNumber && (
                  <span className="text-[10px] font-semibold text-emerald-700">
                    N° Trámite: {pdf417Result.tramiteNumber}
                  </span>
                )}
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
              {cameraError}
            </div>
          )}

          {kycMessage && (
            <div
              className={`p-2.5 rounded-xl text-[11px] font-bold flex items-start gap-2 ${
                kycMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : kycMessage.type === 'warning'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{kycMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/70 hover:bg-purple-50/40 transition-colors">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleKycImageSelect(e.target.files?.[0], setDniFrontPreview, { scanPdf417: true })}
              />
              {dniFrontPreview ? (
                <img src={dniFrontPreview} alt="Frente DNI" className="h-16 w-full object-cover rounded-lg mb-1.5" />
              ) : (
                <Camera className="w-5 h-5 text-purple-700 mb-1" />
              )}
              <span className="text-[11px] font-bold text-slate-800">
                {dniFrontPreview ? 'Cambiar Frente DNI' : '1. Frente + PDF417 *'}
              </span>
              <span className="text-[9.5px] text-slate-500">Lee código de barras</span>
            </label>

            <label className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/70 hover:bg-purple-50/40 transition-colors">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleKycImageSelect(e.target.files?.[0], setDniBackPreview)}
              />
              {dniBackPreview ? (
                <img src={dniBackPreview} alt="Dorso DNI" className="h-16 w-full object-cover rounded-lg mb-1.5" />
              ) : (
                <Upload className="w-5 h-5 text-purple-700 mb-1" />
              )}
              <span className="text-[11px] font-bold text-slate-800">
                {dniBackPreview ? 'Cambiar Dorso DNI' : '2. Dorso (Domicilio) *'}
              </span>
              <span className="text-[9.5px] text-slate-500">Lee domicilio legal</span>
            </label>

            {/* Step 3: Live Camera Selfie Button + Fallback Hidden Input */}
            <div className="border-2 border-dashed border-slate-200 hover:border-purple-400 rounded-xl p-3 flex flex-col items-center justify-center text-center bg-slate-50/70 hover:bg-purple-50/40 transition-colors">
              <input
                ref={selfieFallbackInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => handleKycImageSelect(e.target.files?.[0], setSelfiePreview)}
              />
              <button
                type="button"
                onClick={handleOpenLiveSelfieCamera}
                className="w-full flex flex-col items-center justify-center cursor-pointer"
              >
                {selfiePreview ? (
                  <img src={selfiePreview} alt="Selfie en vivo" className="h-16 w-full object-cover rounded-lg mb-1.5" />
                ) : (
                  <Video className="w-5 h-5 text-purple-700 mb-1" />
                )}
                <span className="text-[11px] font-bold text-slate-800">
                  {selfiePreview ? 'Repetir Selfie en vivo' : '3. Selfie en vivo *'}
                </span>
                <span className="text-[9.5px] text-slate-500">Prueba de vida facial</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunKycVerification}
            disabled={isVerifyingKyc || !dniFrontPreview || !dniBackPreview || !selfiePreview}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isVerifyingKyc ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando PDF417, domicilio y biometría...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Validar DNI, domicilio y selfie ahora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Camera Selfie Liveness Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl text-white">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-extrabold">Prueba de vida · Selfie</span>
              </div>
              <button
                type="button"
                onClick={stopSelfieCamera}
                className="p-1 text-slate-400 hover:text-white rounded-full cursor-pointer"
                aria-label="Cerrar cámara"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs font-bold text-amber-300 text-center bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                {livenessChallenge}
              </p>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {/* Face guide oval */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-60 rounded-full border-2 border-dashed border-emerald-400/80 shadow-[0_0_0_999px_rgba(2,6,23,0.45)]" />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCaptureLiveSelfie}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Sacar selfie ahora</span>
                </button>
                <button
                  type="button"
                  onClick={stopSelfieCamera}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
