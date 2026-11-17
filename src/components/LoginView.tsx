import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronRight, 
  User, 
  Phone,
  IdCard,
  AlertCircle,
  CheckCircle2,
  ShoppingBag,
  X,
  LogIn
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';

interface LoginViewProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
  allowGuest?: boolean;
  checkoutNotice?: string;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const LoginView: React.FC<LoginViewProps> = ({ 
  onSuccess, 
  onCancel, 
  isModal = false,
  allowGuest = true,
  checkoutNotice,
  initialMode = 'login'
}) => {
  const { 
    settings,
    signInWithEmail, 
    signUpWithEmail, 
    signInGoogle, 
    signInFacebook,
    signInApple,
    sendPasswordReset,
    updateUserProfile,
    setActiveTab,
    setIsAdmin
  } = useStore();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Synchronize mode if initialMode prop changes (e.g. from login to register)
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setError(null);
    }
  }, [initialMode]);

  // Keep standalone Login screen completely static with zero page scroll on mobile/WhatsApp browsers
  useEffect(() => {
    if (isModal) return;
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevOverscroll = bodyEl.style.overscrollBehavior;

    window.scrollTo(0, 0);
    htmlEl.style.overflow = 'hidden';
    bodyEl.style.overflow = 'hidden';
    bodyEl.style.overscrollBehavior = 'none';

    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      bodyEl.style.overscrollBehavior = prevOverscroll;
    };
  }, [isModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      if (mode === 'login') {
        const user = await signInWithEmail(cleanEmail, password);
        setSuccess('¡Sesión iniciada correctamente!');
        setTimeout(() => {
          setIsAdmin(user.role === 'admin');
          if (onSuccess) {
            onSuccess();
          } else {
            setActiveTab('home');
          }
        }, 500);
      } else if (mode === 'register') {
        const user = await signUpWithEmail(cleanEmail, password, name.trim(), phone.trim(), dni.trim());
        setSuccess('¡Cuenta registrada con éxito!');
        setTimeout(() => {
          setIsAdmin(user.role === 'admin');
          if (onSuccess) {
            onSuccess();
          } else {
            setActiveTab('home');
          }
        }, 500);
      } else if (mode === 'forgot') {
        await sendPasswordReset(cleanEmail);
        setSuccess('Te enviamos un enlace para restablecer tu contraseña.');
      }
    } catch (err: any) {
      const code = err?.code || '';
      const expectedUserAuthErrors = new Set([
        'auth/invalid-credential',
        'auth/wrong-password',
        'auth/user-not-found',
        'auth/invalid-email',
        'auth/missing-password',
        'auth/email-already-in-use',
        'auth/weak-password',
        'auth/too-many-requests',
        'auth/user-disabled',
        'auth/operation-not-allowed'
      ]);
      if (!expectedUserAuthErrors.has(code)) {
        console.warn('Auth submit notice:', err?.message || err);
      }

      let msg = 'Error de autenticación. Verificá tus datos.';
      if (code === 'auth/wrong-password' || err?.message?.includes('Contraseña incorrecta')) {
        msg = 'Contraseña incorrecta. Podés reintentar o tocar "¿Olvidaste tu contraseña?".';
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        msg = 'Email o contraseña incorrectos. Si te registraste con Google, ingresá usando el botón de Google de abajo o tocá "¿Olvidaste tu contraseña?".';
      } else if (code === 'auth/invalid-email') {
        msg = 'Ingresá un correo electrónico válido.';
      } else if (code === 'auth/missing-password') {
        msg = 'Ingresá tu contraseña para continuar.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'Este correo ya está registrado. Iniciá sesión o continuá con Google.';
      } else if (code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos. Esperá unos minutos antes de reintentar.';
      } else if (code === 'auth/user-disabled') {
        msg = 'Esta cuenta fue deshabilitada. Contactá a soporte.';
      } else if (code === 'auth/operation-not-allowed') {
        msg = 'El acceso con email/contraseña no está habilitado; continuá con Google.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'Sin conexión con el servidor de autenticación. Verificá tu internet y reintentá.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const mapSocialAuthError = (err: any, providerName: string): string => {
    const code = err?.code || '';
    const msg = String(err?.message || '').toLowerCase();
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || msg.includes('cancel')) {
      return `Cerraste el acceso con ${providerName} antes de finalizar.`;
    }
    if (code === 'auth/popup-blocked') {
      return `Tu navegador bloqueó la ventana emergente de ${providerName}. Habilitala o ingresá con email.`;
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'Ya existe una cuenta registrada con este correo usando otro método de acceso.';
    }
    if (code === 'auth/unauthorized-domain') {
      return `Dominio no autorizado para ${providerName} en este entorno. Ingresá con email y contraseña.`;
    }
    if (code === 'auth/native-google-not-configured') {
      return err.message;
    }
    if (code === 'auth/missing-google-id-token') {
      return 'No se recibió el token de verificación de Google. Intentá nuevamente o ingresá con email.';
    }
    return `No se pudo iniciar sesión con ${providerName}.`;
  };

  const handleSocialGoogle = async () => {
    triggerHaptic();
    setError(null);
    setLoading(true);
    try {
      const user = await signInGoogle();
      if (name.trim() || phone.trim() || dni.trim()) {
        await updateUserProfile({
          name: name.trim() || user.name,
          phone: phone.trim() || user.phone,
          dni: dni.trim() || user.dni
        });
      }
      setIsAdmin(user.role === 'admin');
      if (onSuccess) {
        onSuccess();
      } else {
        setActiveTab('home');
      }
    } catch (err: any) {
      setError(mapSocialAuthError(err, 'Google'));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialFacebook = async () => {
    triggerHaptic();
    setError(null);
    setLoading(true);
    try {
      const user = await signInFacebook();
      if (name.trim() || phone.trim() || dni.trim()) {
        await updateUserProfile({
          name: name.trim() || user.name,
          phone: phone.trim() || user.phone,
          dni: dni.trim() || user.dni
        });
      }
      setIsAdmin(user.role === 'admin');
      if (onSuccess) {
        onSuccess();
      } else {
        setActiveTab('home');
      }
    } catch (err: any) {
      setError(mapSocialAuthError(err, 'Facebook'));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialApple = async () => {
    triggerHaptic();
    setError(null);
    setLoading(true);
    try {
      const user = await signInApple();
      if (name.trim() || phone.trim() || dni.trim()) {
        await updateUserProfile({
          name: name.trim() || user.name,
          phone: phone.trim() || user.phone,
          dni: dni.trim() || user.dni
        });
      }
      setIsAdmin(user.role === 'admin');
      if (onSuccess) {
        onSuccess();
      } else {
        setActiveTab('home');
      }
    } catch (err: any) {
      setError(mapSocialAuthError(err, 'Apple'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    triggerHaptic('light');
    if (onCancel) {
      onCancel();
    } else {
      setActiveTab('home');
    }
  };

  const handleGuest = () => {
    triggerHaptic('light');
    if (onCancel) {
      onCancel();
    } else {
      setActiveTab('home');
    }
  };

  return (
    <div className={`w-full ${isModal ? 'flex items-center justify-center' : 'h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none bg-white sm:bg-slate-100 flex items-center justify-center sm:p-4'}`}>
      <div className={`w-full ${isModal ? 'max-w-[430px] bg-white rounded-3xl shadow-2xl border border-purple-100/90 p-4 sm:p-5 max-h-[92vh] overflow-y-auto overscroll-contain' : `h-full sm:h-auto sm:max-w-[440px] bg-white sm:rounded-3xl sm:shadow-2xl sm:border sm:border-purple-100/70 px-5 py-3 sm:px-6 sm:py-7 flex flex-col justify-center ${mode === 'register' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'}`} relative transition-all duration-300`}>
        
        {/* Top Close Button (only for modal mode) */}
        {isModal && onCancel && (
          <button 
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onCancel();
            }}
            className="absolute top-3.5 right-3.5 z-30 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm transition-all active:scale-95 shadow-2xs cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}

        {/* Content Container */}
        <div className="space-y-3.5 my-auto">
          
          {/* Brand Logo Header */}
          {isModal ? (
            <div className="flex flex-col items-center justify-center text-center pt-0.5 pb-0.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#4C1D95] flex items-center justify-center shadow-md shadow-purple-600/20 border border-purple-400/40 shrink-0">
                  <span className="text-white font-black text-base font-sans leading-none">V</span>
                </div>
                <span className="text-lg font-black text-[#1E0E3D] tracking-wider font-sans">
                  {settings?.storeName || 'VONDRO'}
                </span>
              </div>
              <p className="text-[8.5px] font-black uppercase text-purple-950/70 tracking-widest mt-0.5">
                {settings?.tagline || 'TODO LO QUE NECESITÁS, MÁS CERCA.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center pt-0.5 pb-0.5">
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt={settings?.storeName || 'VONDRO'} 
                  className="max-h-32 w-auto max-w-[260px] object-contain mix-blend-multiply transition-transform duration-300 hover:scale-[1.02]"
                />
              ) : (
                <img
                  src="/assets/aistudio/1794843127008_541ad96f.jpg"
                  alt={settings?.storeName || 'VONDRO — TODO LO QUE NECESITÁS, MÁS CERCA.'}
                  className={`${mode === 'register' ? 'h-24' : 'h-[144px] sm:h-[160px]'} w-auto max-w-[260px] object-contain mix-blend-multiply select-none mx-auto transition-all duration-200`}
                  draggable={false}
                />
              )}
            </div>
          )}

          {/* Mode Switcher Tabs (Segmented Control) */}
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/90 text-xs font-black">
              <button
                type="button"
                id="btn-tab-auth-login"
                onClick={() => { 
                  triggerHaptic('selection'); 
                  setMode('login'); 
                  setError(null); 
                }}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'login' 
                    ? 'bg-purple-700 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Iniciar sesión</span>
              </button>
              <button
                type="button"
                id="btn-tab-auth-register"
                onClick={() => { 
                  triggerHaptic('selection'); 
                  setMode('register'); 
                  setError(null); 
                }}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'register' 
                    ? 'bg-purple-700 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Registrarme</span>
              </button>
            </div>
          )}

          {/* Section Titles */}
          <div className="text-center">
            <h2 className="text-base font-black text-[#190634] leading-tight">
              {mode === 'login' && 'Ingresá a tu cuenta'}
              {mode === 'register' && 'Creá tu cuenta nueva'}
              {mode === 'forgot' && 'Restablecer contraseña'}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {mode === 'login' && 'Ingresá tus credenciales para continuar'}
              {mode === 'register' && 'Completá tus datos para confirmar tu pedido'}
              {mode === 'forgot' && 'Te enviaremos las instrucciones a tu correo'}
            </p>
          </div>

          {/* Checkout Mandatory Notice if applicable */}
          {checkoutNotice && (
            <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-300/90 text-amber-950 text-xs space-y-1 animate-fadeIn shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Requisito para confirmar tu compra</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                {checkoutNotice}
              </p>
            </div>
          )}

          {/* Feedback Messages */}
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Additional fields for register */}
            {mode === 'register' && (
              <>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nombre y apellido completo *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#FAF9FE] border border-purple-100 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <IdCard className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="DNI / CUIL (ej: 38.452.190) *"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="w-full bg-[#FAF9FE] border border-purple-100 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="Teléfono / WhatsApp (ej: 351 1234567) *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#FAF9FE] border border-purple-100 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                  />
                </div>
              </>
            )}

            {/* Email Input */}
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                placeholder="Correo electrónico *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FAF9FE] border border-purple-100 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Password Input (Login & Register) */}
            {mode !== 'forgot' && (
              <div className="space-y-1">
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={mode === 'register' ? 'Crear contraseña (mínimo 6 caracteres) *' : 'Contraseña *'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#FAF9FE] border border-purple-100 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Forgot Password link */}
                {mode === 'login' && (
                  <div className="text-right mt-1.5 mb-1">
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); setMode('forgot'); setError(null); }}
                      className="text-[11px] font-extrabold text-[#6D28D9] hover:text-purple-900 transition-colors py-0.5 inline-block cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8000FF] via-[#7A00F5] to-[#6700DF] hover:brightness-105 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-purple-600/25 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 mt-1 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>
                    {mode === 'login' && 'Iniciar sesión'}
                    {mode === 'register' && 'Crear mi cuenta y continuar'}
                    {mode === 'forgot' && 'Enviar enlace de recuperación'}
                  </span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>

          {/* Social Auth Section */}
          {mode !== 'forgot' && (
            <div className="space-y-2 pt-1">
              <div className="relative text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative px-3 bg-white text-[11px] font-semibold text-slate-400">
                  o continuá con
                </span>
              </div>

              <div className="flex items-center justify-center gap-4 pt-0.5">
                {/* Google Button */}
                <button
                  type="button"
                  onClick={handleSocialGoogle}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  title="Google"
                  aria-label="Continuar con Google"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </button>

                {/* Facebook Button */}
                <button
                  type="button"
                  onClick={handleSocialFacebook}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#1877F2] text-white shadow-2xs hover:bg-blue-600 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  title="Facebook"
                  aria-label="Continuar con Facebook"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </button>

                {/* Apple Button */}
                <button
                  type="button"
                  onClick={handleSocialApple}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-slate-900 text-white shadow-2xs hover:bg-black flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  title="Apple (iPhone)"
                  aria-label="Continuar con Apple"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.12-1.96.99-3.1-.97.04-2.16.65-2.85 1.46-.62.72-1.16 1.88-1.01 3 .01.01 1.08.08 2.87-1.36z"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Secondary Switch Mode Link */}
          <div className="pt-0.5 text-center">
            {mode === 'login' ? (
              <p className="text-xs text-slate-500 font-medium">
                ¿No tenés una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => { triggerHaptic(); setMode('register'); setError(null); }}
                  className="font-extrabold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                >
                  Registrate gratis
                </button>
              </p>
            ) : mode === 'register' ? (
              <p className="text-xs text-slate-500 font-medium">
                ¿Ya tenés cuenta creada?{' '}
                <button
                  type="button"
                  onClick={() => { triggerHaptic(); setMode('login'); setError(null); }}
                  className="font-extrabold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                >
                  Iniciá sesión aquí
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-medium">
                ¿Recordaste tu contraseña?{' '}
                <button
                  type="button"
                  onClick={() => { triggerHaptic(); setMode('login'); setError(null); }}
                  className="font-extrabold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                >
                  Iniciá sesión
                </button>
              </p>
            )}
          </div>

          {/* Flat Secondary Button for Guest Checkout */}
          {allowGuest && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleGuest}
                className="w-full py-2 px-3 rounded-xl text-slate-500 hover:text-purple-700 hover:bg-purple-50/60 active:scale-[0.98] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 stroke-[2.2] text-slate-400" />
                <span>Continuar como invitado</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
