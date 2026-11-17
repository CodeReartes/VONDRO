import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, 
  User, 
  MapPin, 
  Heart, 
  Tag, 
  ShieldAlert, 
  LogOut, 
  ChevronRight, 
  Phone, 
  Mail, 
  Sparkles,
  Edit2,
  Check,
  Building,
  KeyRound,
  LogIn,
  UserPlus,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Plus,
  Trash2,
  IdCard,
  Home,
  Camera,
  Upload,
  X,
  Image as ImageIcon,
  Shield,
  FileText,
  HelpCircle,
  Headphones,
  MessageSquare,
  Navigation,
  Loader2,
  Gift
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CustomerData } from '../types';
import { LoginView } from './LoginView';
import { LiveSupportChatModal } from './LiveSupportChatModal';
import { ReferralInviteModal } from './ReferralInviteModal';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';
import { compressImageFile } from '../utils/imageCompressor';
import { AVATAR_PRESETS, AvatarPreset } from '../data/avatarPresets';
import { formatUserName } from '../utils/textUtils';
import { getDeviceCoordinates, reverseGeocodeCoordinates, KNOWN_CORDOBA_NEIGHBORHOODS } from '../utils/geoAddress';

const CORDOBA_NEIGHBORHOODS = KNOWN_CORDOBA_NEIGHBORHOODS;

export const ProfileView: React.FC = () => {
  const { 
    user, 
    setUser, 
    updateUserProfile, 
    setActiveTab, 
    orders, 
    favorites, 
    coupons, 
    isAdmin, 
    setIsAdmin,
    signInWithEmail,
    signUpWithEmail,
    signInGoogle,
    signOut,
    sendPasswordReset,
    isFirebaseSynced,
    syncDatabaseToFirestore,
    openOrderDetail,
    settings
  } = useStore();

  const firstAddr = user?.defaultAddress || user?.addresses?.[0];

  const userOrders = React.useMemo(() => {
    if (!user) return [];
    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id;
    return (orders || []).filter(o => {
      const custEmail = (o.customer?.email || '').toLowerCase().trim();
      return (custEmail && custEmail === userEmail) || (o.userId && o.userId === userId);
    });
  }, [user, orders]);

  // Modals state
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState<boolean>(false);
  const [newAddrStreet, setNewAddrStreet] = useState<string>('');
  const [newAddrNumber, setNewAddrNumber] = useState<string>('');
  const [newAddrFloorApt, setNewAddrFloorApt] = useState<string>('');
  const [newAddrNeighborhood, setNewAddrNeighborhood] = useState<string>('Nueva Córdoba');
  const [newAddrReference, setNewAddrReference] = useState<string>('');
  const [newAddrCoords, setNewAddrCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [geoStatusMsg, setGeoStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDetectLocationForProfile = async (target: 'new' | 'edit') => {
    setIsDetectingLocation(true);
    setGeoStatusMsg(null);
    triggerHaptic('medium');
    try {
      const coords = await getDeviceCoordinates();
      const res = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);
      if (target === 'new') {
        setNewAddrStreet(res.street || '');
        setNewAddrNumber(res.number || '');
        setNewAddrNeighborhood(res.neighborhood || 'Nueva Córdoba');
        setNewAddrCoords({ lat: res.latitude, lng: res.longitude });
      } else {
        setNewAddrStreet(res.street ? `${res.street} ${res.number || ''}`.trim() : '');
        setNewAddrNeighborhood(res.neighborhood || 'Nueva Córdoba');
        setNewAddrCoords({ lat: res.latitude, lng: res.longitude });
      }
      setGeoStatusMsg({
        type: 'success',
        text: `📍 Dirección detectada: ${res.street} ${res.number ? res.number : ''} (B° ${res.neighborhood})`
      });
      triggerHaptic('success');
      setTimeout(() => setGeoStatusMsg(null), 4500);
    } catch (err: any) {
      console.warn('Geolocation error in profile:', err);
      setGeoStatusMsg({
        type: 'error',
        text: err?.message || 'No se pudo detectar la ubicación GPS automáticamente.'
      });
      triggerHaptic('error');
      setTimeout(() => setGeoStatusMsg(null), 4500);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const [showCouponsModal, setShowCouponsModal] = useState<boolean>(false);
  const [showReferralModal, setShowReferralModal] = useState<boolean>(false);
  const [showSupportChat, setShowSupportChat] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Avatar / Photo Modal State
  const [showAvatarModal, setShowAvatarModal] = useState<boolean>(false);
  const [avatarTab, setAvatarTab] = useState<'upload' | 'presets'>('upload');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Guarantee Profile always opens from top (0, 0)
  useEffect(() => {
    scrollToTop();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    setAvatarError(null);
    triggerHaptic('light');

    try {
      const compressedDataUrl = await compressImageFile(file, 400, 400, 0.8);
      await updateUserProfile({
        photoUrl: compressedDataUrl,
        avatarPreset: undefined
      });
      setIsCompressingPhoto(false);
      setShowAvatarModal(false);
    } catch (err: any) {
      console.error('Error compressing image:', err);
      setIsCompressingPhoto(false);
      setAvatarError(err?.message || 'Error al comprimir la imagen. Intentá con un archivo más liviano.');
    }
  };

  const handleSelectPresetAvatar = async (preset: AvatarPreset) => {
    triggerHaptic('medium');
    await updateUserProfile({
      photoUrl: preset.svgUrl,
      avatarPreset: preset.id
    });
    setShowAvatarModal(false);
  };

  const handleRemovePhoto = async () => {
    triggerHaptic('light');
    await updateUserProfile({
      photoUrl: undefined,
      avatarPreset: undefined
    });
    setShowAvatarModal(false);
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    if (!newAddrStreet.trim()) return;

    const newAddr: CustomerData = {
      firstName: user?.name?.split(' ')[0] || 'Cliente',
      lastName: user?.name?.split(' ').slice(1).join(' ') || 'VONDRO',
      phone: user?.phone || '351 123 4567',
      email: user?.email || '',
      dni: user?.dni || '',
      province: 'Córdoba',
      city: 'Córdoba Capital',
      neighborhood: newAddrNeighborhood,
      street: newAddrStreet,
      number: newAddrNumber,
      floorApartment: newAddrFloorApt,
      reference: newAddrReference,
      ...(newAddrCoords ? {
        latitude: newAddrCoords.lat,
        longitude: newAddrCoords.lng,
        coordinates: newAddrCoords,
        addressVerified: true,
        addressVerificationSource: 'gps_reverse' as const,
      } : {}),
    };

    const currentAddresses = user?.addresses || [];
    const updated = [...currentAddresses, newAddr];

    await updateUserProfile({
      addresses: updated,
      defaultAddress: user?.defaultAddress || newAddr
    });

    setIsAddingNewAddress(false);
    setNewAddrStreet('');
    setNewAddrNumber('');
    setNewAddrFloorApt('');
    setNewAddrReference('');
    setNewAddrCoords(null);
  };

  const handleSetDefaultAddress = async (index: number) => {
    triggerHaptic();
    const currentAddresses = [...(user?.addresses || [])];
    if (index < 0 || index >= currentAddresses.length) return;
    const selected = currentAddresses[index];
    currentAddresses.splice(index, 1);
    currentAddresses.unshift(selected);

    await updateUserProfile({
      addresses: currentAddresses,
      defaultAddress: selected
    });
  };

  const handleDeleteAddress = async (index: number) => {
    triggerHaptic();
    const currentAddresses = [...(user?.addresses || [])];
    currentAddresses.splice(index, 1);

    await updateUserProfile({
      addresses: currentAddresses,
      defaultAddress: currentAddresses[0] || undefined
    });
  };

  return (
    <div className="pb-24 max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto space-y-3 px-1 sm:px-2">
      {/* 1. TOP HEADER */}
      {user ? (
        <div className="bg-gradient-to-br from-purple-800 via-purple-700 to-indigo-900 text-white p-3.5 sm:p-4 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] rounded-b-2xl shadow-sm">
          <div className="flex items-center gap-3">
            {/* Avatar with Camera badge */}
            <div 
              onClick={() => {
                triggerHaptic('light');
                setShowAvatarModal(true);
              }}
              className="relative group cursor-pointer shrink-0"
              title="Cambiar Foto o Avatar"
            >
              {user.photoUrl ? (
                <img 
                  src={user.photoUrl} 
                  alt={user.name} 
                  className="w-13 h-13 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white/60 shadow-md" 
                />
              ) : (
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/40 text-xl font-black shadow-md">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera className="w-4 h-4" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 bg-amber-400 text-slate-950 p-0.5 rounded-full shadow-md border border-white">
                <Camera className="w-2.5 h-2.5" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold truncate leading-tight capitalize">
                  {formatUserName(user.name || 'Mi Perfil')}
                </h1>
                {(() => {
                  const kycStatus = user.identityVerification?.status;
                  if (kycStatus === 'verified_full_match') {
                    return (
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          scrollToTop();
                          setActiveTab('personal-data');
                        }}
                        className="inline-flex items-center gap-1 bg-emerald-400 text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-xs cursor-pointer hover:bg-emerald-300 transition-colors"
                      >
                        <ShieldCheck className="w-3 h-3 text-slate-950" />
                        DNI + Domicilio Verificados
                      </button>
                    );
                  }
                  if (kycStatus === 'verified_dni_document') {
                    return (
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          scrollToTop();
                          setActiveTab('personal-data');
                        }}
                        className="inline-flex items-center gap-1 bg-teal-300 text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-xs cursor-pointer hover:bg-teal-200 transition-colors"
                      >
                        <ShieldCheck className="w-3 h-3 text-slate-950" />
                        DNI Verificado · Domicilio Alt.
                      </button>
                    );
                  }
                  if (kycStatus === 'mismatch') {
                    return (
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          scrollToTop();
                          setActiveTab('personal-data');
                        }}
                        className="inline-flex items-center gap-1 bg-rose-400 text-slate-950 font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-xs cursor-pointer hover:bg-rose-300 transition-colors"
                      >
                        <AlertCircle className="w-3 h-3 text-slate-950" />
                        Revisión DNI requerida
                      </button>
                    );
                  }
                  if (user.dni) {
                    return (
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          scrollToTop();
                          setActiveTab('personal-data');
                        }}
                        className="inline-flex items-center gap-1 bg-amber-300 text-amber-950 font-extrabold text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors cursor-pointer active:scale-95 shadow-xs"
                      >
                        <AlertCircle className="w-3 h-3 text-amber-950" />
                        DNI {user.dni} · Validar foto
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        scrollToTop();
                        setActiveTab('personal-data');
                      }}
                      className="inline-flex items-center gap-1 bg-amber-400 text-amber-950 font-extrabold text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full hover:bg-amber-300 transition-colors cursor-pointer active:scale-95 shadow-xs"
                    >
                      <AlertCircle className="w-3 h-3 text-amber-950" />
                      Agregar DNI para Verificar
                    </button>
                  );
                })()}
              </div>
              
              <p className="text-[11px] text-purple-200 truncate mt-0.5">
                {user.email}
              </p>

              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[9px] sm:text-[10px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full font-semibold">
                  {user.role === 'admin' ? '⭐ Administrador VONDRO' : 'Cliente Córdoba'}
                </span>
                <span className="text-[9px] sm:text-[10px] bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full font-bold">
                  {userOrders.length} {userOrders.length === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-purple-800 via-purple-700 to-indigo-900 text-white p-3.5 sm:p-4 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] rounded-b-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/40 text-xl font-black shadow-md">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                  Mi Perfil
                </h1>
                <p className="text-[11px] text-purple-200">
                  {settings?.storeName || 'VONDRO'} Córdoba
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                setAuthMode('login');
                setShowAuthModal(true);
              }}
              className="px-3.5 py-1.5 bg-white text-purple-900 hover:bg-purple-50 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      )}

      <div className="px-3 sm:px-4 space-y-2.5">
        {/* Quick Order Status Card if active order for logged in user */}
        {user && userOrders.length > 0 && (
          <div 
            onClick={() => openOrderDetail(userOrders[0])}
            className="p-2.5 bg-white rounded-xl border border-purple-100 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-300 transition-all active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Último pedido: {userOrders[0].orderNumber}
                </span>
                <span className="text-[10px] text-purple-700 font-semibold">
                  Estado: {userOrders[0].status === 'shipped' ? '🚚 En camino' : userOrders[0].status === 'preparing' ? '🟠 En preparación' : userOrders[0].status === 'delivered' ? '🟢 Entregado' : userOrders[0].status === 'cancelled' || userOrders[0].status === 'CANCELADO' ? '🔴 Cancelado' : 'Aguardando'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        )}

        {/* 🎁 MODO INVITACIÓN - Banner Destacado Interactivo */}
        <div 
          id="banner-modo-invitacion"
          onClick={() => {
            triggerHaptic('medium');
            setShowReferralModal(true);
          }}
          className="relative overflow-hidden bg-gradient-to-r from-purple-800 via-indigo-700 to-purple-900 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-purple-400/30 cursor-pointer hover:shadow-md transition-all active:scale-[0.99] group"
        >
          {/* Background glow & accents */}
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />
          <div className="absolute right-12 top-0 w-16 h-16 bg-purple-400/20 rounded-full blur-lg pointer-events-none" />

          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition-transform">
                <Gift className="w-5 h-5 text-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-black tracking-tight text-white">
                    Modo Invitación
                  </span>
                  <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-2xs">
                    Ganá $5.000 OFF
                  </span>
                </div>
                <p className="text-[11px] text-purple-100 mt-0.5 truncate">
                  Invitá amigos: ellos reciben $5.000 y vos ganás $5.000 en cupones
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-amber-300 shrink-0">
              <span className="hidden sm:inline">Abrir</span>
              <ChevronRight className="w-4 h-4 text-amber-300 stroke-[3] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* Menu list matching reference mockup */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Mis pedidos */}
          <button
            id="btn-profile-orders"
            onClick={() => {
              if (!user) {
                triggerHaptic('light');
                setAuthMode('login');
                setShowAuthModal(true);
                return;
              }
              scrollToTop();
              setActiveTab('orders');
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Mis pedidos</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-400">
                {user ? userOrders.length : 0}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          {/* Mis datos & Verificación */}
          <button
            id="btn-profile-data"
            onClick={() => {
              triggerHaptic('light');
              scrollToTop();
              setActiveTab('personal-data');
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Mis datos personales y DNI</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {user?.identityVerification?.status === 'verified_full_match'
                    ? `DNI ${user.dni || user.identityVerification.extractedDni} · PDF417 + Selfie + Domicilio OK`
                    : user?.identityVerification?.status === 'verified_dni_document'
                    ? `DNI ${user.dni || user.identityVerification.extractedDni} · PDF417 + Selfie (Domicilio alt.)`
                    : user?.identityVerification?.status === 'mismatch'
                    ? `DNI ${user.dni || ''} — Reintentar verificación con foto y selfie`
                    : user?.dni
                    ? `DNI: ${user.dni} (Falta validar PDF417, dorso y selfie)`
                    : 'Ingresar DNI, domicilio y selfie de identidad'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                user?.identityVerification?.status === 'verified_full_match'
                  ? 'bg-emerald-100 text-emerald-800'
                  : user?.identityVerification?.status === 'verified_dni_document'
                  ? 'bg-teal-100 text-teal-800'
                  : user?.identityVerification?.status === 'mismatch'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {user?.identityVerification?.status === 'verified_full_match'
                  ? 'Verificado ✓'
                  : user?.identityVerification?.status === 'verified_dni_document'
                  ? 'DNI OK · Alt.'
                  : user?.identityVerification?.status === 'mismatch'
                  ? 'Revisión'
                  : user?.dni
                  ? 'Validar KYC'
                  : 'Pendiente'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          {/* Direcciones guardadas */}
          <button
            id="btn-profile-addresses"
            onClick={() => {
              triggerHaptic('light');
              setShowAddressModal(true);
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Direcciones guardadas</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {user?.addresses && user.addresses.length > 0
                    ? `${user.addresses.length} ${user.addresses.length === 1 ? 'dirección de entrega' : 'direcciones de entrega'}`
                    : 'Sin direcciones guardadas'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Mis favoritos */}
          <button
            id="btn-profile-favorites"
            onClick={() => {
              scrollToTop();
              setActiveTab('favorites');
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <Heart className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Mis favoritos</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-400">{favorites.length}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          {/* Cupones y promociones */}
          <button
            id="btn-profile-coupons"
            onClick={() => setShowCouponsModal(true)}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Tag className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Cupones y promociones</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Seguridad de la cuenta */}
          <button
            id="btn-profile-security"
            onClick={() => {
              triggerHaptic('light');
              scrollToTop();
              setActiveTab('security');
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Seguridad de la cuenta</span>
                <span className="text-[10px] text-slate-500 font-normal">Teléfono, correo, contraseña y privacidad</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Centro de Ayuda y Garantías (Capturas 01547 / 01551) */}
          <button
            id="btn-profile-help"
            onClick={() => {
              triggerHaptic('light');
              scrollToTop();
              setActiveTab('help');
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <HelpCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Centro de Ayuda</span>
                <span className="text-[10px] text-slate-500 font-normal">Garantías hasta 90 días, envíos y reembolsos</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Chat de Atención al Cliente 24/7 (Captura 01559) */}
          <button
            id="btn-profile-live-chat"
            onClick={() => {
              triggerHaptic('medium');
              setShowSupportChat(true);
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Headphones className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <span>Atención al Cliente Oficial</span>
                  <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">24/7</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Chat en vivo con agentes oficiales VONDRO</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Términos, Privacidad y Políticas Legales */}
          <button
            id="btn-profile-legal"
            onClick={() => {
              triggerHaptic('light');
              scrollToTop();
              setActiveTab('legal');
            }}
            className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Términos y Políticas</span>
                <span className="text-[10px] text-slate-500 font-normal">Condiciones de servicio, privacidad y envíos</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* 2. ADMIN PANEL ENTRY / STORE MANAGEMENT */}
        {Boolean(user && (user.role === 'admin' || user.email?.toLowerCase().trim() === 'reartes17diego@gmail.com')) && (
          <div className="p-4 bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white rounded-2xl shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <span className="text-xs font-black block">Panel de Administración VONDRO</span>
                  <span className="text-[10px] text-purple-200">Control de stock, costos mayoristas, precios y pedidos</span>
                </div>
              </div>
              <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-2 py-0.5 rounded-full">
                Privado
              </span>
            </div>

            <button
              id="btn-enter-admin-panel"
              onClick={() => {
                triggerHaptic();
                scrollToTop();
                setIsAdmin(true);
                setActiveTab('admin');
              }}
              className="w-full py-2.5 bg-white text-purple-900 hover:bg-purple-50 font-extrabold text-xs rounded-xl shadow-xs active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Ingresar al Panel Administrativo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Logout / Switch Account */}
        <div className="pt-2">
          <button
            onClick={async () => {
              triggerHaptic();
              await signOut();
            }}
            className="w-full p-3 text-center text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-2xl flex items-center justify-center gap-1.5 transition-colors border border-rose-100 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Auth Modal (Login / Register / Forgot Password) */}
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
              initialMode={authMode}
              onCancel={() => setShowAuthModal(false)} 
              onSuccess={() => setShowAuthModal(false)} 
            />
          </div>
        </div>,
        document.body
      )}

      {/* Addresses Modal with Full Saved Address Management */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full space-y-4 max-h-[90vh] overflow-y-auto animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Direcciones guardadas</h3>
                <p className="text-xs text-slate-500">Gestiona tus domicilios de entrega para compras rápidas</p>
              </div>
              <button
                onClick={() => {
                  setShowAddressModal(false);
                  setIsAddingNewAddress(false);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* List of saved addresses */}
            {!isAddingNewAddress ? (
              <div className="space-y-3">
                {(!user?.addresses || user.addresses.length === 0) ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No tienes direcciones guardadas</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Guarda tu domicilio para autocompletar tus pedidos</p>
                    <button
                      onClick={() => setIsAddingNewAddress(true)}
                      className="px-4 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      + Agregar primera dirección
                    </button>
                  </div>
                ) : (
                  user.addresses.map((addr, idx) => {
                    const isDefault = idx === 0;
                    return (
                      <div 
                        key={idx} 
                        className={`p-3.5 rounded-2xl border text-xs space-y-1.5 relative transition-all ${
                          isDefault ? 'bg-purple-50/60 border-purple-300 ring-1 ring-purple-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-sm">
                            <MapPin className="w-4 h-4 text-purple-700" />
                            {addr.street} {addr.number} {addr.floorApartment ? `, ${addr.floorApartment}` : ''}
                          </span>
                          {isDefault ? (
                            <span className="bg-purple-700 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full">
                              PREDETERMINADA
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetDefaultAddress(idx)}
                              className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
                            >
                              Usar como principal
                            </button>
                          )}
                        </div>

                        <p className="text-slate-700 font-medium">
                          Barrio {addr.neighborhood}, {addr.city || 'Córdoba Capital'}
                        </p>
                        {addr.reference && (
                          <p className="text-slate-500 text-[11px] italic">
                            Ref: {addr.reference}
                          </p>
                        )}
                        <p className="text-slate-500 text-[11px]">
                          Tel: {addr.phone || user.phone} {addr.dni ? `| DNI: ${addr.dni}` : ''}
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50">
                          <button
                            onClick={() => handleDeleteAddress(idx)}
                            className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {user?.addresses && user.addresses.length > 0 && (
                  <button
                    onClick={() => setIsAddingNewAddress(true)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-purple-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-purple-700" />
                    <span>Agregar otra dirección</span>
                  </button>
                )}
              </div>
            ) : (
              /* Add new address form */
              <form onSubmit={handleAddNewAddress} className="space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Nueva Dirección de Envío</h4>
                  <button
                    type="button"
                    onClick={() => handleDetectLocationForProfile('new')}
                    disabled={isDetectingLocation}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isDetectingLocation ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-purple-700" />
                        <span>Detectando GPS...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3 h-3 text-purple-700" />
                        <span>📍 Detectar ubicación GPS</span>
                      </>
                    )}
                  </button>
                </div>

                {geoStatusMsg && (
                  <div className={`p-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 ${
                    geoStatusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {geoStatusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{geoStatusMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Calle *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Av. Colón"
                      value={newAddrStreet}
                      onChange={(e) => setNewAddrStreet(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Número *</label>
                    <input
                      type="text"
                      required
                      placeholder="1234"
                      value={newAddrNumber}
                      onChange={(e) => setNewAddrNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Piso / Depto</label>
                    <input
                      type="text"
                      placeholder="2° B"
                      value={newAddrFloorApt}
                      onChange={(e) => setNewAddrFloorApt(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Barrio *</label>
                    <select
                      value={newAddrNeighborhood}
                      onChange={(e) => setNewAddrNeighborhood(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none"
                    >
                      {CORDOBA_NEIGHBORHOODS.map(nh => (
                        <option key={nh} value={nh}>{nh}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Referencia</label>
                  <input
                    type="text"
                    placeholder="Ej. Timbre blanco, fachada gris"
                    value={newAddrReference}
                    onChange={(e) => setNewAddrReference(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Guardar dirección
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewAddress(false)}
                    className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={() => setShowAddressModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Coupons Modal */}
      {showCouponsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 animate-scaleIn">
            <h3 className="text-base font-extrabold text-slate-900">Cupones disponibles</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {coupons.map((c) => (
                <div key={c.id} className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-purple-900 text-sm tracking-wider font-mono">{c.code}</span>
                    <span className="font-extrabold text-purple-700">
                      {c.discountType === 'percentage' ? `${c.value}% OFF` : `$${(c.value ?? 0).toLocaleString('es-AR')} OFF`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{c.description}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowCouponsModal(false)}
              className="w-full py-2.5 bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIAR FOTO O AVATAR DE PERFIL */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 relative shadow-2xl animate-scaleIn my-8">
            <button
              onClick={() => setShowAvatarModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Foto de Perfil y Avatar</h3>
              <p className="text-xs text-slate-500">
                Subí tu foto o elegí un avatar prediseñado para tu cuenta VONDRO.
              </p>
            </div>

            {/* Current avatar preview */}
            <div className="flex flex-col items-center justify-center py-2 bg-purple-50/50 rounded-2xl border border-purple-100">
              {user?.photoUrl ? (
                <img 
                  src={user.photoUrl} 
                  alt="Vista previa" 
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 text-white flex items-center justify-center font-black text-2xl border-4 border-white shadow-md">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'V'}
                </div>
              )}
              <span className="text-[11px] font-bold text-purple-800 mt-2">
                {user?.photoUrl ? 'Foto / Avatar Actual' : 'Sin foto seleccionada'}
              </span>
            </div>

            {/* Tab Selector: Subir Foto vs Avatares */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setAvatarTab('upload')}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  avatarTab === 'upload'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Subir Foto
              </button>
              <button
                type="button"
                onClick={() => setAvatarTab('presets')}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  avatarTab === 'presets'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Elegir Avatar
              </button>
            </div>

            {avatarError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{avatarError}</span>
              </div>
            )}

            {/* TAB 1: UPLOAD PHOTO */}
            {avatarTab === 'upload' && (
              <div className="space-y-3">
                <label className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50 p-6 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isCompressingPhoto}
                    className="hidden"
                  />
                  {isCompressingPhoto ? (
                    <div className="space-y-2 py-2">
                      <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                      <p className="text-xs font-bold text-purple-900">Comprimiendo e instalando foto...</p>
                      <p className="text-[10px] text-slate-500">Optimizando peso para carga rápida</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-extrabold text-purple-950">Seleccionar Foto desde tu Dispositivo</span>
                      <span className="text-[11px] text-slate-500 mt-0.5">JPG, PNG o WEBP. Se comprimirá automáticamente a ~25KB.</span>
                    </>
                  )}
                </label>

                {user?.photoUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="w-full py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar foto actual
                  </button>
                )}
              </div>
            )}

            {/* TAB 2: AVATAR PRESETS GRID */}
            {avatarTab === 'presets' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(preset)}
                      className={`p-2 rounded-2xl border-2 text-center transition-all cursor-pointer hover:scale-105 flex flex-col items-center justify-center gap-1 ${
                        user?.avatarPreset === preset.id
                          ? 'border-purple-600 bg-purple-50 shadow-sm'
                          : 'border-slate-100 hover:border-purple-300 bg-slate-50/50'
                      }`}
                    >
                      <img 
                        src={preset.svgUrl} 
                        alt={preset.name} 
                        className="w-12 h-12 rounded-full object-cover shadow-xs"
                      />
                      <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Support Chat Modal 24/7 */}
      <LiveSupportChatModal
        isOpen={showSupportChat}
        onClose={() => setShowSupportChat(false)}
      />

      {/* Modo Invitación / Programa de Referidos Modal */}
      <ReferralInviteModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
      />
    </div>
  );
};

