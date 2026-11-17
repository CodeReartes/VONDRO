import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Shield, 
  RotateCcw, 
  Copyright, 
  Truck, 
  CreditCard, 
  DollarSign, 
  X,
  Share2,
  ExternalLink,
  CheckCircle
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';

interface LegalPoliciesViewProps {
  onBack?: () => void;
  initialPolicyId?: string | null;
}

interface PolicyDetail {
  id: string;
  title: string;
  icon: React.ElementType;
  summary: string;
  sections: { subtitle: string; content: string }[];
}

const POLICIES: PolicyDetail[] = [
  {
    id: 'privacy',
    title: 'Política de privacidad',
    icon: Shield,
    summary: 'Protección de datos conforme a la Ley 25.326 de la República Argentina y directrices de Google Play.',
    sections: [
      {
        subtitle: '1. Recolección y Uso de Datos Personales',
        content: 'En VONDRO Córdoba respetamos profundamente tu privacidad. Recopilamos datos estrictamente necesarios para procesar tus pedidos, tales como nombre completo, DNI/CUIL para facturación y entrega, domicilio de entrega en Córdoba Capital, correo electrónico y número de teléfono celular para coordinación logística.'
      },
      {
        subtitle: '2. Seguridad y Cifrado de Información',
        content: 'Toda la información viaja cifrada mediante conexiones seguras SSL (TLS 1.3). No almacenamos datos de tarjetas de crédito o débito en nuestros servidores locales; todos los pagos se procesan de forma encriptada a través de la pasarela certificada de Mercado Pago o transferencias bancarias directas.'
      },
      {
        subtitle: '3. Derechos de Acceso, Rectificación y Supresión',
        content: 'Conforme a la Ley Nacional 25.326 de Protección de Datos Personales de la República Argentina, tienes derecho en cualquier momento a acceder, rectificar o solicitar la eliminación total y definitiva de tu cuenta y datos personales mediante el botón "Eliminar Cuenta" en la sección de Seguridad o escribiéndonos a privacidad@vondro.com.ar.'
      },
      {
        subtitle: '4. Divulgación a Terceros y Cadetería',
        content: 'No vendemos ni cedemos tus datos a terceros con fines publicitarios. Únicamente compartimos tu nombre, teléfono y domicilio con nuestros cadetes de reparto autorizados en Córdoba para completar la entrega efectiva de tus compras.'
      }
    ]
  },
  {
    id: 'terms',
    title: 'Términos de uso',
    icon: FileText,
    summary: 'Reglas generales de compra, registro de usuarios y validez de promociones en Córdoba.',
    sections: [
      {
        subtitle: '1. Ámbito de Aplicación',
        content: 'Estos Términos y Condiciones regulan la utilización de la aplicación móvil y plataforma web de VONDRO en la provincia de Córdoba, Argentina. Al navegar, registrarse o realizar una compra, el usuario acepta de manera plena y sin reservas estas condiciones.'
      },
      {
        subtitle: '2. Precios, Stock y Ofertas Relámpago',
        content: 'Los precios mostrados en pesos argentinos ($ ARS) incluyen IVA y son válidos exclusivamente para compras realizadas a través de la aplicación. En el caso de ofertas relámpago con cronómetro, el precio promocional rige hasta agotar el stock estipulado o finalizar la cuenta regresiva.'
      },
      {
        subtitle: '3. Registro de Cuenta y Responsabilidad',
        content: 'El usuario se compromete a brindar información verídica y mantener la confidencialidad de sus credenciales. VONDRO se reserva el derecho de cancelar pedidos sospechosos de fraude o suplantación de identidad.'
      }
    ]
  },
  {
    id: 'returns',
    title: 'Política de devolución y reembolso',
    icon: RotateCcw,
    summary: 'Garantía oficial de 90 días y botón de arrepentimiento de compra.',
    sections: [
      {
        subtitle: '1. Garantía de Satisfacción de 90 Días',
        content: 'En VONDRO ofrecemos una garantía de satisfacción de hasta 90 días corridos para todos nuestros productos. Si el producto presenta fallas de fábrica o rotura, gestionamos el cambio inmediato sin costo logístico adicional.'
      },
      {
        subtitle: '2. Derecho de Arrepentimiento (Ley 24.240)',
        content: 'De acuerdo con el Artículo 34 de la Ley de Defensa del Consumidor de Argentina, tienes derecho a revocar la aceptación de la compra dentro del plazo de 10 (diez) días corridos contados a partir de la entrega del producto, sin costo alguno y reintegrando el 100% del dinero.'
      },
      {
        subtitle: '3. Tiempos y Métodos de Reembolso',
        content: 'Los reembolsos por Mercado Pago se acreditan de forma inmediata en el medio de pago original una vez recibido el producto en nuestro centro de distribución de Córdoba. Para transferencias bancarias, el reintegro se efectiviza en un plazo máximo de 24 a 48 horas hábiles.'
      }
    ]
  },
  {
    id: 'intellectual_property',
    title: 'Política de propiedad intelectual',
    icon: Copyright,
    summary: 'Marcas, logotipos, contenidos y catálogo fotográfico protegidos.',
    sections: [
      {
        subtitle: '1. Propiedad de la Marca VONDRO',
        content: 'El nombre comercial "VONDRO", el logotipo, el diseño de la interfaz y los textos de la plataforma son propiedad exclusiva o licenciada. Queda prohibida su reproducción total o parcial sin autorización previa por escrito.'
      },
      {
        subtitle: '2. Catálogo e Imágenes de Productos',
        content: 'Las imágenes de los productos provienen de convenios oficiales con distribuidores mayoristas e importadores autorizados y fabricantes certificados. Se utilizan con fines puramente ilustrativos y descriptivos para el consumidor final.'
      }
    ]
  },
  {
    id: 'shipping_policy',
    title: 'Política de envíos',
    icon: Truck,
    summary: 'Envíos en el día en Córdoba Capital y zonas de cobertura.',
    sections: [
      {
        subtitle: '1. Cobertura en Córdoba Capital',
        content: 'Realizamos entregas diarias en todos los barrios de la Ciudad de Córdoba (Centro, Nueva Córdoba, General Paz, Alta Córdoba, Cerro de las Rosas, Villa Belgrano, Urca, Cofico, Jardín, etc.) y Gran Córdoba.'
      },
      {
        subtitle: '2. Envíos en el Día (Same-Day Delivery)',
        content: 'Los pedidos confirmados de lunes a viernes antes de las 14:00 hs se entregan en el mismo día mediante nuestra red de cadetería propia en el turno tarde (15:00 a 20:00 hs).'
      },
      {
        subtitle: '3. Envío Gratis por Monto Mínimo',
        content: 'Todas las compras que superen los $100.000 ARS cuentan con Envío 100% Gratis en toda la ciudad de Córdoba.'
      }
    ]
  },
  {
    id: 'payment_info',
    title: 'Información de pago',
    icon: CreditCard,
    summary: 'Mercado Pago, tarjetas, transferencias con descuento y efectivo.',
    sections: [
      {
        subtitle: '1. Métodos de Pago Habilitados',
        content: '• Mercado Pago: Dinero en cuenta, tarjetas de crédito (con promociones bancarias y cuotas sin interés según entidad) y tarjetas de débito.\n• Transferencia Bancaria Directa: Con verificación inmediata y 5% de descuento adicional automático.\n• Pago en Efectivo contra Entrega: Exclusivo para Córdoba Capital al recibir tu paquete.'
      },
      {
        subtitle: '2. Comprobantes y Facturación',
        content: 'Emitimos Facturas A y B electrónicas oficiales de AFIP / ARCA para todas las compras. El comprobante fiscal se envía automáticamente a tu correo electrónico al despachar el pedido.'
      }
    ]
  },
  {
    id: 'minimum_order',
    title: 'Importe mínimo por pedido',
    icon: DollarSign,
    summary: 'Montos mínimos de compra, escalado mayorista y tarifas de entrega.',
    sections: [
      {
        subtitle: '1. Sin Monto Mínimo Obligatorio para Minoristas',
        content: 'Puedes comprar desde 1 sola unidad de cualquier producto. No exigimos montos mínimos obligatorios para realizar pedidos estándar en Córdoba Capital.'
      },
      {
        subtitle: '2. Beneficios por Volumen y Escala',
        content: 'Al comprar 2, 3 o más unidades de un mismo artículo, accedes a precios mayoristas con descuentos progresivos que se aplican automáticamente en tu carrito.'
      }
    ]
  }
];

export const LegalPoliciesView: React.FC<LegalPoliciesViewProps> = ({ onBack, initialPolicyId }) => {
  const { setActiveTab } = useStore();
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDetail | null>(
    initialPolicyId ? POLICIES.find(p => p.id === initialPolicyId) || null : null
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Guarantee LegalPoliciesView always starts at top
  React.useEffect(() => {
    scrollToTop();
  }, [selectedPolicy]);

  const handleBack = () => {
    triggerHaptic('light');
    scrollToTop();
    if (selectedPolicy) {
      setSelectedPolicy(null);
    } else if (onBack) {
      onBack();
    } else {
      setActiveTab('profile');
    }
  };

  const handleOpenPolicy = (policy: PolicyDetail) => {
    triggerHaptic('light');
    setSelectedPolicy(policy);
  };

  const handleShare = () => {
    triggerHaptic('medium');
    if (navigator.share) {
      navigator.share({
        title: `${selectedPolicy?.title} - VONDRO`,
        text: `Consultá la ${selectedPolicy?.title} de VONDRO en Córdoba.`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-28 animate-fadeIn">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-2xs px-4 py-3 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 active:scale-95 transition-all text-slate-800 flex items-center gap-1 cursor-pointer"
          aria-label="Volver"
        >
          <ChevronLeft className="w-5 h-5 text-slate-800 stroke-[2.5]" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          {selectedPolicy ? selectedPolicy.title : 'Términos y políticas legales'}
        </h1>
        <div className="w-8 flex justify-end">
          {selectedPolicy && (
            <button
              onClick={handleShare}
              className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-slate-100 rounded-full transition-colors"
              title="Compartir"
            >
              {copiedLink ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {!selectedPolicy ? (
          /* Main Policies List (Screenshot 01446 style) */
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs divide-y divide-slate-100 overflow-hidden">
              {POLICIES.map((policy) => {
                const IconComponent = policy.icon;
                return (
                  <button
                    key={policy.id}
                    onClick={() => handleOpenPolicy(policy)}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100/50 group-hover:scale-105 transition-transform">
                        <IconComponent className="w-4 h-4 text-purple-700" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                          {policy.title}
                        </span>
                        <span className="text-[11px] text-slate-500 line-clamp-1">
                          {policy.summary}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Legal Footnote */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 text-center space-y-1 text-slate-400 text-[11px]">
              <p className="font-semibold text-slate-600">VONDRO Argentina S.R.L. · CUIT 30-71829304-8</p>
              <p>Córdoba Capital, Provincia de Córdoba, Argentina</p>
              <p className="text-[10px] text-slate-400">Versión de políticas 2026.1 · Actualizado para Google Play Store</p>
            </div>
          </div>
        ) : (
          /* Detailed Single Policy Reader */
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
                <selectedPolicy.icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {selectedPolicy.title}
                </h2>
                <p className="text-xs text-slate-500">
                  Vigente para compras y envíos en Córdoba, Argentina
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {selectedPolicy.sections.map((sec, idx) => (
                <div key={idx} className="space-y-1.5">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    {sec.subtitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-3.5 whitespace-pre-line font-normal">
                    {sec.content}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 text-center sm:text-left">
                ¿Dudas sobre esta política? Contactá a soporte@vondro.com.ar
              </span>
              <button
                onClick={() => setSelectedPolicy(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Volver a la lista
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
