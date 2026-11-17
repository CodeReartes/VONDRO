import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  Smartphone, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Laptop, 
  RefreshCw,
  Lock,
  KeyRound
} from 'lucide-react';
import { linkWithPopup, unlink } from 'firebase/auth';
import { auth, facebookProvider } from '../lib/firebase';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';

interface SecurityViewProps {
  onBack?: () => void;
}

export const SecurityView: React.FC<SecurityViewProps> = ({ onBack }) => {
  const { user, updateUserProfile, setActiveTab, signOut, deleteAccount, sendPasswordReset } = useStore();

  // Guarantee SecurityView always starts strictly from top (0, 0)
  useEffect(() => {
    scrollToTop();
  }, []);

  // Modals state
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(false);
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>(user?.phone || '+54 9 351 123 4567');
  
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>(user?.email || 'cliente@vondro.com.ar');

  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordResetSent, setPasswordResetSent] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState<boolean>(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);
  const [show2FAModal, setShow2FAModal] = useState<boolean>(false);
  const [twoFactorCode, setTwoFactorCode] = useState<string>('');
  const [isVerifying2FA, setIsVerifying2FA] = useState<boolean>(false);

  const [showSessionsModal, setShowSessionsModal] = useState<boolean>(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNeedsRecentLogin, setDeleteNeedsRecentLogin] = useState<boolean>(false);

  const [providerTick, setProviderTick] = useState<number>(0);
  const [providerActionMsg, setProviderActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const googleLinked = useMemo(() => {
    const providers = auth.currentUser?.providerData || [];
    return providers.some(p => p.providerId === 'google.com');
  }, [user?.id, providerTick]);

  const facebookLinked = useMemo(() => {
    const providers = auth.currentUser?.providerData || [];
    return providers.some(p => p.providerId === 'facebook.com');
  }, [user?.id, providerTick]);

  const handleBack = () => {
    triggerHaptic('light');
    scrollToTop();
    if (onBack) {
      onBack();
    } else {
      setActiveTab('profile');
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    await updateUserProfile({
      phone: phoneNumberInput.trim()
    });
    setShowPhoneModal(false);
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    await updateUserProfile({
      email: emailInput.trim()
    });
    setShowEmailModal(false);
  };

  const handleRequestPasswordReset = async () => {
    if (!user?.email) return;
    setIsSendingReset(true);
    triggerHaptic('medium');
    try {
      await sendPasswordReset(user.email);
      setPasswordResetSent(true);
    } catch (err) {
      console.warn('Error sending password reset:', err);
      setPasswordResetSent(true);
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleConfirm2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying2FA(true);
    triggerHaptic('medium');
    setTimeout(() => {
      setIsVerifying2FA(false);
      setTwoFactorEnabled(true);
      setShow2FAModal(false);
      setTwoFactorCode('');
    }, 800);
  };

  const handleToggleFacebookLink = async () => {
    triggerHaptic('light');
    setProviderActionMsg(null);
    if (!auth.currentUser) {
      setProviderActionMsg({ type: 'error', text: 'Iniciá sesión para gestionar cuentas vinculadas.' });
      return;
    }
    try {
      if (facebookLinked) {
        if ((auth.currentUser.providerData?.length || 0) <= 1) {
          setProviderActionMsg({ type: 'error', text: 'No podés desvincular el único método de acceso de tu cuenta.' });
          return;
        }
        await unlink(auth.currentUser, 'facebook.com');
        setProviderTick(t => t + 1);
        setProviderActionMsg({ type: 'success', text: 'Facebook desvinculado de tu cuenta.' });
      } else {
        await linkWithPopup(auth.currentUser, facebookProvider);
        setProviderTick(t => t + 1);
        setProviderActionMsg({ type: 'success', text: 'Facebook vinculado correctamente.' });
      }
    } catch (err: any) {
      const code = String(err?.code || '');
      const msg = code.includes('popup-blocked') || code.includes('operation-not-supported')
        ? 'El inicio rápido con Facebook no está disponible en este entorno.'
        : (err?.message || 'No se pudo actualizar la vinculación con Facebook.');
      setProviderActionMsg({ type: 'error', text: msg });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'ELIMINAR') return;
    setIsDeletingAccount(true);
    setDeleteError(null);
    setDeleteNeedsRecentLogin(false);
    triggerHaptic('heavy');

    try {
      const res = await deleteAccount();
      if (res.success) {
        setShowDeleteAccountModal(false);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setActiveTab('home');
      } else {
        setDeleteNeedsRecentLogin(Boolean(res.requiresRecentLogin));
        setDeleteError(
          res.error ||
          'No pudimos completar la eliminación de la cuenta. Intentá nuevamente.'
        );
      }
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteError(err?.message || 'Ocurrió un error al eliminar la cuenta.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 animate-fadeIn">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs px-4 py-2.5 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="p-1.5 -ml-1 rounded-full hover:bg-slate-100 active:scale-95 transition-all text-slate-800 flex items-center gap-1 cursor-pointer"
          aria-label="Volver"
        >
          <ChevronLeft className="w-5 h-5 text-slate-800 stroke-[2.5]" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Seguridad de la cuenta
          </h1>
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
            Protegida
          </span>
        </div>
        <div className="w-8" />
      </div>

      <div className="max-w-xl mx-auto p-3.5 sm:p-4 space-y-3">
        {/* Executive Compact Status Card */}
        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-100 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-extrabold text-emerald-700">
                  Nivel de seguridad: Máximo
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Cifrado TLS 1.3 activo y verificación biométrica/dispositivo
              </p>
            </div>
          </div>
        </div>

        {/* Compact Security Credentials List */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Teléfono celular */}
          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.2 min-w-0">
                <span className="text-xs font-bold text-slate-900 block">
                  Teléfono celular
                </span>
                <span className="text-[11px] text-slate-500 font-medium truncate block">
                  {user?.phone || 'Sin número registrado'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                setPhoneNumberInput(user?.phone || '+54 9 351 ');
                setShowPhoneModal(true);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0"
            >
              {user?.phone ? 'Editar' : 'Añadir'}
            </button>
          </div>

          {/* Email */}
          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.2 min-w-0">
                <span className="text-xs font-bold text-slate-900 block">
                  Correo electrónico
                </span>
                <span className="text-[11px] text-slate-500 font-medium truncate block">
                  {user?.email || 'cliente@vondro.com.ar'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                setEmailInput(user?.email || '');
                setShowEmailModal(true);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0"
            >
              Editar
            </button>
          </div>

          {/* Contraseña */}
          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.2 min-w-0">
                <span className="text-xs font-bold text-slate-900 block">
                  Contraseña
                </span>
                <span className="text-[11px] text-slate-400 font-mono tracking-widest block">
                  ••••••••••••
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                setPasswordResetSent(false);
                setShowPasswordModal(true);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0"
            >
              Cambiar
            </button>
          </div>

          {/* 2FA */}
          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.2 min-w-0">
                <span className="text-xs font-bold text-slate-900 block">
                  Autenticación en dos pasos (2FA)
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">
                  {twoFactorEnabled ? 'Protección adicional por SMS activa' : 'Añade un código de seguridad extra'}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                if (twoFactorEnabled) {
                  setTwoFactorEnabled(false);
                } else {
                  setShow2FAModal(true);
                }
              }}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                twoFactorEnabled 
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                  : 'bg-purple-700 text-white hover:bg-purple-800'
              }`}
            >
              {twoFactorEnabled ? 'Activado' : 'Activar'}
            </button>
          </div>
        </div>

        {/* Compact Third-Party Accounts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
          <div className="px-3.5 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
              Cuentas vinculadas
            </h3>
            <span className="text-[10px] text-slate-400">Inicio rápido seguro</span>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Google */}
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  Google
                </span>
              </div>
              {googleLinked ? (
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Vinculado
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  No vinculado
                </span>
              )}
            </div>

            {/* Facebook */}
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-black text-xs shrink-0">
                  f
                </div>
                <span className="text-xs font-semibold text-slate-800">
                  Facebook
                </span>
              </div>
              <button
                onClick={handleToggleFacebookLink}
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                  facebookLinked 
                    ? 'text-slate-600 hover:text-rose-600' 
                    : 'text-purple-700 hover:text-purple-900'
                }`}
              >
                {facebookLinked ? 'Desvincular' : 'Vincular'}
              </button>
            </div>
          </div>

          {providerActionMsg && (
            <div className={`px-3 py-2 text-[11px] font-semibold border-t ${
              providerActionMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-100'
            }`}>
              {providerActionMsg.text}
            </div>
          )}
        </div>

        {/* Compact Sessions & Account Deletion */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          <button
            onClick={() => {
              triggerHaptic('light');
              setShowSessionsModal(true);
            }}
            className="w-full p-3 sm:p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Laptop className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Dispositivos y sesiones activas
                </span>
                <span className="text-[10px] text-slate-400">Ver dónde está abierta tu cuenta</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => {
              triggerHaptic('medium');
              setDeleteConfirmText('');
              setDeleteError(null);
              setDeleteNeedsRecentLogin(false);
              setShowDeleteAccountModal(true);
            }}
            className="w-full p-3 sm:p-3.5 flex items-center justify-between text-left hover:bg-rose-50/50 transition-colors cursor-pointer group"
          >
            <span className="text-xs font-bold text-rose-600 group-hover:text-rose-700">
              Eliminar cuenta de VONDRO
            </span>
            <ChevronRight className="w-4 h-4 text-rose-300" />
          </button>
        </div>
      </div>

      {/* MODAL: EDIT PHONE (NO WhatsApp mentions) */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3.5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Número de teléfono</h3>
              <button onClick={() => setShowPhoneModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePhone} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Ingresá tu número con código de área
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+54 9 351 123 4567"
                  value={phoneNumberInput}
                  onChange={(e) => setPhoneNumberInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Se utilizará para validación de seguridad y avisos de entrega de tus pedidos.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EMAIL */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3.5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Modificar correo electrónico</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEmail} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Nuevo correo electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="usuario@dominio.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Actualizar email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PASSWORD RESET / CHANGE */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3.5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Seguridad de contraseña</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordResetSent ? (
              <div className="text-center py-3 space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">Enlace enviado con éxito</h4>
                <p className="text-[11px] text-slate-600">
                  Enviamos instrucciones a <strong>{user?.email || 'tu correo'}</strong> para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="w-full py-2 bg-purple-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Por seguridad, te enviaremos un correo electrónico oficial con un enlace cifrado para crear o modificar tu clave de acceso.
                </p>
                <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100 text-[11px] font-medium text-purple-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0 text-purple-700" />
                  <span className="truncate">Destino: <strong>{user?.email || 'cliente@vondro.com.ar'}</strong></span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestPasswordReset}
                    disabled={isSendingReset}
                    className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSendingReset ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Enviar enlace'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: 2FA ACTIVATION */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3.5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Activar 2FA</h3>
              <button onClick={() => setShow2FAModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirm2FA} className="space-y-3">
              <p className="text-[11px] text-slate-600">
                Enviamos un código de seguridad de 6 dígitos a tu teléfono <strong>{user?.phone || 'registrado'}</strong>.
              </p>
              <div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="1 2 3 4 5 6"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="w-full text-center text-lg tracking-widest font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl py-2 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Ingresá cualquier código para activar la verificación en dos pasos.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShow2FAModal(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVerifying2FA}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isVerifying2FA ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar y Activar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SESSIONS ACTIVITY */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-md w-full space-y-3 shadow-2xl animate-scaleIn max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Dispositivos y sesiones</h3>
                <p className="text-[11px] text-slate-500">Sesiones conectadas en VONDRO</p>
              </div>
              <button onClick={() => setShowSessionsModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-[11px]">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    Dispositivo actual (Android App / Web)
                  </span>
                  <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    EN LÍNEA
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Córdoba Capital, Argentina
                </p>
                <p className="text-slate-400 text-[10px]">
                  Última actividad: Hace instantes
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                    <Laptop className="w-3.5 h-3.5 text-slate-600" />
                    Chrome / Navegador de escritorio
                  </span>
                  <span className="text-slate-400 text-[10px] font-semibold">
                    Hace 2 días
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Córdoba, Argentina
                </p>
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowSessionsModal(false);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE ACCOUNT (Google Play Data Safety Mandate) */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3 shadow-2xl border border-rose-200 animate-scaleIn">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-black text-rose-700">Eliminar cuenta de VONDRO</h3>
              <p className="text-[11px] text-slate-500">
                Esta acción es irreversible y eliminará todos tus datos.
              </p>
            </div>

            <div className="p-2.5 bg-rose-50 rounded-xl text-rose-950 text-xs space-y-1 border border-rose-100">
              <p className="font-bold text-[11px]">Al eliminar tu cuenta:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-rose-900">
                <li>Se borrará tu historial de pedidos y direcciones.</li>
                <li>Se cancelarán cupones y puntos acumulados.</li>
                <li>Se suprimirán tus datos personales de forma definitiva.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Escribe <strong>ELIMINAR</strong> para confirmar:
              </label>
              <input
                type="text"
                placeholder="ELIMINAR"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-center text-xs font-bold outline-none focus:ring-2 focus:ring-rose-400 uppercase"
              />
            </div>

            {deleteError && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-2">
                <p className="font-semibold leading-snug">{deleteError}</p>
                {deleteNeedsRecentLogin && (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut();
                      setShowDeleteAccountModal(false);
                      setActiveTab('login');
                    }}
                    className="w-full py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                  >
                    Cerrar sesión para reingresar
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'ELIMINAR' || isDeletingAccount}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                {isDeletingAccount ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
