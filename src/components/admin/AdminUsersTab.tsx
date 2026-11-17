import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  AlertCircle, 
  Phone, 
  Mail, 
  MapPin, 
  Package, 
  Calendar, 
  IdCard, 
  ExternalLink,
  MessageCircle,
  CheckCircle2,
  X,
  Edit,
  UserCheck,
  Building,
  Sparkles,
  Filter,
  Camera,
  QrCode,
  Navigation
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { UserAccount, Order, CustomerData } from '../../types';
import { formatWhatsAppPhone } from '../../utils/phoneUtils';
import { triggerHaptic } from '../../utils/native';

export const AdminUsersTab: React.FC = () => {
  const { registeredUsers, orders, updateUserProfile } = useStore();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'verified' | 'unverified' | 'with_orders'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserAccount | null>(null);

  // Edit DNI Modal inside Admin
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDniValue, setEditDniValue] = useState<string>('');
  const [editNameValue, setEditNameValue] = useState<string>('');
  const [editPhoneValue, setEditPhoneValue] = useState<string>('');

  // Combine registered users + unique customers from orders into a unified list
  const combinedUserMap = new Map<string, {
    user: UserAccount;
    userOrders: Order[];
    totalSpent: number;
    lastOrderDate?: string;
  }>();

  // 1. Process registered users
  registeredUsers.forEach(u => {
    const userOrders = orders.filter(o => 
      o.userId === u.id || 
      (o.customer?.email && u.email && o.customer.email.toLowerCase() === u.email.toLowerCase()) ||
      (o.customer?.phone && u.phone && o.customer.phone.replace(/\D/g, '') === u.phone.replace(/\D/g, ''))
    );

    const totalSpent = userOrders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? (o.total || 0) : 0), 0);
    const lastOrderDate = userOrders.length > 0 ? userOrders[0].createdAt : undefined;

    combinedUserMap.set(u.id, {
      user: u,
      userOrders,
      totalSpent,
      lastOrderDate
    });
  });

  // 2. Add customers from orders who may not be in registeredUsers list yet
  orders.forEach(o => {
    if (!o.customer) return;
    const emailKey = o.customer.email?.toLowerCase().trim();
    const phoneKey = o.customer.phone?.replace(/\D/g, '');

    // Check if already matched
    let existingEntry = Array.from(combinedUserMap.values()).find(entry => 
      (emailKey && entry.user.email?.toLowerCase().trim() === emailKey) ||
      (phoneKey && entry.user.phone?.replace(/\D/g, '') === phoneKey)
    );

    if (!existingEntry && (emailKey || phoneKey)) {
      const syntheticId = `guest-customer-${emailKey || phoneKey}`;
      const guestAddress: CustomerData = {
        firstName: o.customer.firstName,
        lastName: o.customer.lastName,
        phone: o.customer.phone,
        email: o.customer.email,
        dni: o.customer.dni,
        province: o.customer.province || 'Córdoba',
        city: o.customer.city || 'Córdoba Capital',
        neighborhood: o.customer.neighborhood || '',
        street: o.customer.street || '',
        number: o.customer.number || '',
        floorApartment: o.customer.floorApartment || '',
        reference: o.customer.reference || ''
      };

      const guestUser: UserAccount = {
        id: syntheticId,
        email: o.customer.email || '',
        name: `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim() || 'Cliente VONDRO',
        phone: o.customer.phone || '',
        dni: o.customer.dni,
        isVerified: Boolean(o.customer.dni && o.customer.dni.trim().length >= 7),
        role: 'customer',
        addresses: [guestAddress],
        defaultAddress: guestAddress,
        favorites: [],
        createdAt: o.createdAt
      };

      const guestOrders = orders.filter(ord => 
        (emailKey && ord.customer?.email?.toLowerCase().trim() === emailKey) ||
        (phoneKey && ord.customer?.phone?.replace(/\D/g, '') === phoneKey)
      );

      const totalSpent = guestOrders.reduce((sum, ord) => sum + (ord.status !== 'cancelled' ? (ord.total || 0) : 0), 0);

      combinedUserMap.set(syntheticId, {
        user: guestUser,
        userOrders: guestOrders,
        totalSpent,
        lastOrderDate: o.createdAt
      });
    }
  });

  const allUserEntries = Array.from(combinedUserMap.values());

  // Search & Filter
  const filteredUserEntries = allUserEntries.filter(({ user, userOrders }) => {
    const query = searchTerm.toLowerCase().trim();
    const addr = user.defaultAddress || user.addresses?.[0];

    const matchesSearch = !query || (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.phone && user.phone.includes(query)) ||
      (user.dni && user.dni.toLowerCase().includes(query)) ||
      (addr?.neighborhood && addr.neighborhood.toLowerCase().includes(query)) ||
      (addr?.street && addr.street.toLowerCase().includes(query))
    );

    if (!matchesSearch) return false;

    if (filterType === 'verified') return Boolean(user.dni && user.dni.trim().length >= 7);
    if (filterType === 'unverified') return !user.dni || user.dni.trim().length < 7;
    if (filterType === 'with_orders') return userOrders.length > 0;

    return true;
  });

  // KPIs
  const totalUsersCount = allUserEntries.length;
  const kycVerifiedCount = allUserEntries.filter(e =>
    e.user.identityVerification?.status === 'verified_full_match' ||
    e.user.identityVerification?.status === 'verified_dni_document'
  ).length;
  const verifiedCount = allUserEntries.filter(e => e.user.dni && e.user.dni.trim().length >= 7).length;
  const withOrdersCount = allUserEntries.filter(e => e.userOrders.length > 0).length;
  const googleUsersCount = allUserEntries.filter(e => e.user.email?.endsWith('@gmail.com')).length;

  const handleOpenEditUser = (user: UserAccount) => {
    setEditingUserId(user.id);
    setEditDniValue(user.dni || '');
    setEditNameValue(user.name || '');
    setEditPhoneValue(user.phone || '');
  };

  const handleSaveAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    if (!editingUserId) return;

    // If it's the current logged in user
    await updateUserProfile({
      dni: editDniValue,
      isVerified: Boolean(editDniValue && editDniValue.trim().length >= 7),
      name: editNameValue,
      phone: editPhoneValue
    });

    setEditingUserId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Usuarios y Clientes Registrados</h2>
              <p className="text-xs text-slate-400">Control integral de datos personales, DNI, dirección en Córdoba y teléfonos</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-purple-950 text-purple-300 border border-purple-800/50 px-3 py-1.5 rounded-xl font-bold">
            Total: {totalUsersCount} registrados
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Total Clientes</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-black text-white">{totalUsersCount}</p>
          <span className="text-[10px] text-slate-500">Base activa de la tienda</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">KYC / DNI Cargado</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-400">
            {kycVerifiedCount} <span className="text-xs font-bold text-slate-400">/ {verifiedCount}</span>
          </p>
          <span className="text-[10px] text-slate-500">PDF417+Selfie OK / Con DNI</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Con Pedidos</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-400">{withOrdersCount}</p>
          <span className="text-[10px] text-slate-500">Compradores recurrentes</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Usuarios Gmail</span>
            <Mail className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-black text-blue-400">{googleUsersCount}</p>
          <span className="text-[10px] text-slate-500">Inicio rápido por Google</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Nombre, Email, DNI, Teléfono o Barrio en Córdoba..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Todos ({totalUsersCount})
            </button>
            <button
              onClick={() => setFilterType('verified')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === 'verified'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              DNI Verificado ({verifiedCount})
            </button>
            <button
              onClick={() => setFilterType('unverified')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === 'unverified'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Sin DNI ({totalUsersCount - verifiedCount})
            </button>
            <button
              onClick={() => setFilterType('with_orders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === 'with_orders'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Con Pedidos ({withOrdersCount})
            </button>
          </div>
        </div>
      </div>

      {/* Users List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUserEntries.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="font-bold text-sm">No se encontraron usuarios registered con ese filtro.</p>
            <p className="text-xs text-slate-500 mt-1">Prueba cambiando el término de búsqueda.</p>
          </div>
        ) : (
          filteredUserEntries.map(({ user, userOrders, totalSpent }) => {
            const addr = user.defaultAddress || user.addresses?.[0];
            const cleanPhone = formatWhatsAppPhone(user.phone);
            const waText = encodeURIComponent(`Hola ${user.name}, te escribimos de VONDRO por tu cuenta y pedidos en Córdoba.`);

            return (
              <div 
                key={user.id} 
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top user header */}
                  <div className="flex items-start gap-3">
                    {/* User Photo / Avatar */}
                    {user.photoUrl ? (
                      <img 
                        src={user.photoUrl} 
                        alt={user.name} 
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/40 shadow-sm shrink-0" 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 text-white flex items-center justify-center font-black text-lg border border-purple-400/30 shrink-0 shadow-sm">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-white truncate">{user.name}</h3>
                        {user.role === 'admin' && (
                          <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 font-extrabold text-[9px] rounded-md border border-purple-500/30">
                            ADMIN
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{user.email || 'Sin correo registrado'}</span>
                      </p>

                      {/* KYC & DNI Badges */}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {user.identityVerification?.status === 'verified_full_match' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold rounded-full">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            DNI {user.dni || user.identityVerification.extractedDni} · Domicilio OK
                          </span>
                        ) : user.identityVerification?.status === 'verified_dni_document' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-950 text-teal-300 border border-teal-700 text-[10px] font-bold rounded-full">
                            <ShieldCheck className="w-3 h-3 text-teal-400" />
                            DNI {user.dni || user.identityVerification.extractedDni} · Domicilio Alt.
                          </span>
                        ) : user.identityVerification?.status === 'mismatch' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold rounded-full">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            KYC Rechazado ({user.dni || 'DNI'})
                          </span>
                        ) : user.dni && user.dni.trim().length >= 7 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold rounded-full">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            DNI {user.dni} (Sin KYC)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold rounded-full">
                            <AlertCircle className="w-3 h-3 text-slate-400" />
                            Sin DNI
                          </span>
                        )}

                        {user.identityVerification?.pdf417Verified && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-950 text-purple-300 border border-purple-800/80 text-[9px] font-bold rounded-full">
                            <QrCode className="w-2.5 h-2.5" />
                            PDF417
                          </span>
                        )}

                        {user.identityVerification?.selfieMatched && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-950 text-blue-300 border border-blue-800/80 text-[9px] font-bold rounded-full">
                            <Camera className="w-2.5 h-2.5" />
                            Selfie
                          </span>
                        )}

                        {(addr?.addressVerified || (addr?.latitude && addr?.longitude)) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-950/70 text-emerald-300 border border-emerald-800/70 text-[9px] font-bold rounded-full">
                            <Navigation className="w-2.5 h-2.5" />
                            Mapa/GPS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal & Address details */}
                  <div className="mt-3.5 space-y-1.5 bg-slate-950 border border-slate-800/80 p-3 rounded-xl text-xs">
                    {/* Phone & WhatsApp link */}
                    <div className="flex items-center justify-between text-slate-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-semibold truncate">{user.phone || 'Sin teléfono'}</span>
                      </div>
                      {user.phone && (
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-[10px] font-bold transition-colors shrink-0"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </a>
                      )}
                    </div>

                    {/* Address */}
                    <div className="flex items-start gap-1.5 text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                      <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        {addr ? (
                          <>
                            <span className="font-medium text-slate-200 block">
                              {addr.street} {addr.number} {addr.floorApartment ? `(${addr.floorApartment})` : ''}
                            </span>
                            <span className="text-slate-400 block">
                              Barrio: <strong className="text-purple-300">{addr.neighborhood || 'Córdoba'}</strong>
                              {addr.addressVerified && (
                                <span className="ml-1.5 text-[9px] text-emerald-400 font-bold">
                                  · {addr.addressVerificationSource === 'gps_reverse' ? 'GPS' : addr.addressVerificationSource === 'georef_ar' ? 'Georef AR' : 'Mapa OK'}
                                </span>
                              )}
                            </span>
                            {user.identityVerification?.status === 'verified_dni_document' && user.identityVerification.extractedDniAddress && (
                              <span className="text-teal-300/90 block text-[10px]">
                                Domicilio legal DNI: {user.identityVerification.extractedDniAddress}
                              </span>
                            )}
                            {addr.reference && (
                              <span className="text-slate-500 italic block text-[10px]">
                                Ref: {addr.reference}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500 italic">Sin dirección guardada aún</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders Summary & Action Footer */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Pedidos realizados</span>
                    <span className="font-extrabold text-white">
                      {userOrders.length} {userOrders.length === 1 ? 'pedido' : 'pedidos'} 
                      {totalSpent > 0 && <span className="text-emerald-400 ml-1">(${totalSpent.toLocaleString('es-AR')})</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditUser(user)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Editar DNI / Datos"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedUserDetail(user)}
                      className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                    >
                      Ficha Completa
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: FICHA COMPLETA DE USUARIO */}
      {selectedUserDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 text-white relative shadow-2xl my-8">
            <button
              onClick={() => setSelectedUserDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              {selectedUserDetail.photoUrl ? (
                <img 
                  src={selectedUserDetail.photoUrl} 
                  alt={selectedUserDetail.name} 
                  className="w-14 h-14 rounded-full object-cover border-2 border-purple-500 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-purple-700 text-white flex items-center justify-center font-black text-xl">
                  {selectedUserDetail.name?.charAt(0) || 'U'}
                </div>
              )}
              <div>
                <h3 className="text-lg font-extrabold">{selectedUserDetail.name}</h3>
                <p className="text-xs text-purple-300">{selectedUserDetail.email}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {selectedUserDetail.identityVerification?.status === 'verified_full_match' ? (
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      DNI + Domicilio Verificados ({selectedUserDetail.dni || selectedUserDetail.identityVerification.extractedDni})
                    </span>
                  ) : selectedUserDetail.identityVerification?.status === 'verified_dni_document' ? (
                    <span className="px-2 py-0.5 bg-teal-950 text-teal-300 border border-teal-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      DNI Verificado ({selectedUserDetail.dni || selectedUserDetail.identityVerification.extractedDni}) · Domicilio Alt.
                    </span>
                  ) : selectedUserDetail.identityVerification?.status === 'mismatch' ? (
                    <span className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      KYC DNI Rechazado
                    </span>
                  ) : selectedUserDetail.dni ? (
                    <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      DNI declarado: {selectedUserDetail.dni} (Sin KYC foto/selfie)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold rounded-full">
                      Sin DNI Verificado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* KYC Identity Verification Block */}
            {selectedUserDetail.identityVerification && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                  <QrCode className="w-4 h-4 text-purple-400" />
                  Validación Documental (PDF417 + Dorso + Selfie)
                </h4>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 text-[10px] block">PDF417 RENAPER</span>
                      <span className={`font-bold ${selectedUserDetail.identityVerification.pdf417Verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedUserDetail.identityVerification.pdf417Verified ? 'Lectura OK ✓' : 'No leído'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Selfie Biométrica</span>
                      <span className={`font-bold ${selectedUserDetail.identityVerification.selfieMatched ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedUserDetail.identityVerification.selfieMatched ? 'Coincide ✓' : 'No validada'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">N° Trámite</span>
                      <span className="font-bold text-slate-200">
                        {selectedUserDetail.identityVerification.tramiteNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Confianza</span>
                      <span className="font-bold text-purple-300">
                        {selectedUserDetail.identityVerification.confidenceScore ? `${selectedUserDetail.identityVerification.confidenceScore}%` : '—'}
                      </span>
                    </div>
                  </div>
                  {selectedUserDetail.identityVerification.extractedDniAddress && (
                    <div className="pt-1.5 border-t border-slate-800/80 text-[11px]">
                      <span className="text-slate-500">Domicilio impreso en dorso DNI: </span>
                      <span className="text-slate-200 font-semibold">{selectedUserDetail.identityVerification.extractedDniAddress}</span>
                    </div>
                  )}
                  {selectedUserDetail.identityVerification.livenessChallenge && (
                    <div className="text-[10px] text-slate-400">
                      Reto prueba de vida: <span className="text-slate-200">{selectedUserDetail.identityVerification.livenessChallenge}</span>
                    </div>
                  )}
                  {selectedUserDetail.identityVerification.summary && (
                    <p className="text-[11px] text-slate-400 italic">{selectedUserDetail.identityVerification.summary}</p>
                  )}
                </div>
              </div>
            )}

            {/* Contact & Phone */}
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                <IdCard className="w-4 h-4 text-purple-400" />
                Información de Contacto
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block">Teléfono / WhatsApp</span>
                  <span className="font-bold text-slate-200">{selectedUserDetail.phone || 'No especificado'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Correo electrónico</span>
                  <span className="font-bold text-slate-200">{selectedUserDetail.email}</span>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Direcciones Guardadas en Córdoba
              </h4>

              {selectedUserDetail.addresses && selectedUserDetail.addresses.length > 0 ? (
                <div className="space-y-2">
                  {selectedUserDetail.addresses.map((addr, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-purple-300">{addr.street} {addr.number}</span>
                        <div className="flex items-center gap-1.5">
                          {(addr.addressVerified || (addr.latitude && addr.longitude)) && (
                            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              {addr.addressVerificationSource === 'gps_reverse'
                                ? 'GPS Verificado ✓'
                                : addr.addressVerificationSource === 'georef_ar'
                                ? 'Georef AR OK ✓'
                                : 'Mapa Verificado ✓'}
                            </span>
                          )}
                          {idx === 0 && <span className="text-[10px] bg-purple-900 text-purple-200 px-2 py-0.5 rounded-full font-bold">Principal</span>}
                        </div>
                      </div>
                      <p className="text-slate-300">Barrio: <strong>{addr.neighborhood || 'Córdoba Capital'}</strong> {addr.floorApartment && `(${addr.floorApartment})`}</p>
                      {typeof addr.latitude === 'number' && typeof addr.longitude === 'number' && (
                        <p className="text-[10px] text-slate-400">
                          Coordenadas: {addr.latitude.toFixed(5)}, {addr.longitude.toFixed(5)}
                          {typeof addr.gpsMatchDistanceKm === 'number' && ` · Distancia GPS: ${addr.gpsMatchDistanceKm.toFixed(2)} km`}
                        </p>
                      )}
                      {addr.reference && <p className="text-slate-400 italic text-[11px]">Ref: {addr.reference}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic bg-slate-950 p-3 rounded-xl border border-slate-800">Sin direcciones registradas en la cuenta.</p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR DNI DESDE ADMIN */}
      {editingUserId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveAdminUser} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 text-white relative shadow-2xl">
            <button
              type="button"
              onClick={() => setEditingUserId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold flex items-center gap-2">
              <Edit className="w-4 h-4 text-purple-400" />
              Editar DNI y Datos de Usuario
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Nombre Completo</label>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">DNI (Número de Documento)</label>
                <input
                  type="text"
                  placeholder="Ej: 38.452.190"
                  value={editDniValue}
                  onChange={(e) => setEditDniValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  placeholder="351 123 4567"
                  value={editPhoneValue}
                  onChange={(e) => setEditPhoneValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUserId(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
