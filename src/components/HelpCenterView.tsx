import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  RotateCcw, 
  Truck, 
  Tag, 
  ShieldCheck, 
  Phone, 
  MessageSquare, 
  FileQuestion, 
  CheckCircle2, 
  X, 
  Sparkles,
  Clock,
  HelpCircle,
  Mail
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';
import { LiveSupportChatModal } from './LiveSupportChatModal';

interface HelpCenterViewProps {
  onBack?: () => void;
}

interface FAQEntry {
  id: string;
  category: 'returns' | 'shipping' | 'promos' | 'general' | 'account';
  categoryLabel: string;
  question: string;
  answer: string;
  isOrderIssue?: boolean;
}

const FAQ_LIST: FAQEntry[] = [
  {
    id: 'unknown-charges',
    category: 'account',
    categoryLabel: 'Cuenta',
    question: 'Cargos desconocidos en mi tarjeta',
    answer: 'Si ves un cobro en tu tarjeta o cuenta que no reconoces, primero revisa si algún familiar con acceso a tu cuenta realizó una compra en VONDRO. Todos los cobros legítimos aparecen como "MERCADOPAGO*VONDRO" o "VONDRO CORDOBA". Si confirmas que no autorizaste la transacción, contáctanos de inmediato desde el chat oficial para bloquear la operación y gestionar el reintegro.',
    isOrderIssue: true
  },
  {
    id: 'report-suspicious',
    category: 'account',
    categoryLabel: 'Seguridad',
    question: 'Denunciar un mensaje o contacto sospechoso',
    answer: 'En VONDRO nos tomamos la seguridad muy en serio. Si recibes un mensaje o correo de alguien haciéndose pasar por VONDRO solicitando contraseñas, claves bancarias o transferencias a cuentas no oficiales, repórtalo inmediatamente desde nuestro chat oficial. Nuestro equipo jamás te solicitará contraseñas ni tokens de seguridad.',
    isOrderIssue: false
  },
  {
    id: 'return-exchange-how-to',
    category: 'returns',
    categoryLabel: 'Devoluciones',
    question: '¿Cómo devuelvo o cambio un artículo en VONDRO?',
    answer: 'Para devolver o cambiar un artículo en Córdoba Capital:\n1. Ingresá a "Mis Pedidos" desde tu Perfil.\n2. Seleccioná el pedido que contiene el artículo.\n3. Presioná el botón "Solicitar Cambio / Devolución".\n4. Nuestro cadete retirará el producto por tu domicilio en el próximo turno de reparto sin ningún costo logístico.',
    isOrderIssue: true
  },
  {
    id: 'marked-delivered-not-received',
    category: 'shipping',
    categoryLabel: 'Envíos',
    question: 'Dice que mi paquete fue entregado, pero no lo recibí',
    answer: 'A veces los repartidores marcan la entrega al llegar a la portería o guardia del edificio. Te recomendamos:\n• Verificar con el portero, recepción o vecinos si recibieron el paquete.\n• Si pasaron más de 30 minutos y no lo tienes, abrí el chat oficial con tu número de pedido y nuestro coordinador logístico en Córdoba verificará la ubicación exacta del cadete.',
    isOrderIssue: true
  },
  {
    id: 'how-to-send-items-back',
    category: 'returns',
    categoryLabel: 'Devoluciones',
    question: '¿Cómo puedo enviar mis artículos de regreso?',
    answer: 'No necesitás llevar el paquete a una sucursal de correo. En Córdoba Capital disponemos de cadetería propia que retira el producto directamente por tu puerta en el día y horario que coordines con nosotros.',
    isOrderIssue: true
  },
  {
    id: 'missing-items-order',
    category: 'shipping',
    categoryLabel: 'Envíos',
    question: '¿Qué debo hacer si faltan artículos en mi pedido?',
    answer: 'Si tu pedido contenía varios artículos y falta alguno, puede deberse a que se despachó en paquetes separados para mayor rapidez. Revisá el detalle del pedido en tu perfil o avísanos por el chat oficial para enviarte el artículo faltante en el primer turno disponible sin costo.',
    isOrderIssue: true
  },
  {
    id: 'cant-find-order',
    category: 'account',
    categoryLabel: 'Cuenta',
    question: '¿Por qué no puedo encontrar mi pedido en mi cuenta?',
    answer: 'Asegurate de haber iniciado sesión con el mismo correo electrónico o cuenta de Google con la que realizaste la compra. Si compraste como invitado, podés ingresar con tu email o escribirnos al chat oficial con tu comprobante para vincular el pedido a tu perfil verificado.',
    isOrderIssue: false
  },
  {
    id: 'track-refund',
    category: 'returns',
    categoryLabel: 'Reembolsos',
    question: '¿Cómo realizo el rastreo de mi reembolso?',
    answer: 'Una vez aceptada la devolución, los reembolsos se gestionan de inmediato:\n• Mercado Pago (Dinero en cuenta o Débito): Se acredita al instante.\n• Tarjeta de Crédito: Se refleja en tu próximo resumen de cuenta bancaria.\n• Transferencia Bancaria: Se efectúa en un plazo de 24 a 48 hs hábiles.',
    isOrderIssue: true
  },
  {
    id: 'change-notifications',
    category: 'account',
    categoryLabel: 'Cuenta',
    question: '¿Cómo cambio la configuración de notificaciones?',
    answer: 'Podés activar o desactivar avisos y alertas de promociones desde la pestaña "Perfil" > "Notificaciones" o en la configuración de la aplicación de tu dispositivo Android.',
    isOrderIssue: false
  },
  {
    id: 'damaged-or-wrong-item',
    category: 'returns',
    categoryLabel: 'Garantía',
    question: '¿Qué sucede si recibí un artículo dañado o defectuoso?',
    answer: 'Todos los productos tienen Garantía Total VONDRO de hasta 90 días. Si recibes un producto con defecto o rotura, te enviaremos uno nuevo de reemplazo de inmediato y sin cargo, o el reembolso completo de tu dinero.',
    isOrderIssue: true
  },
  {
    id: 'phishing-protection',
    category: 'account',
    categoryLabel: 'Seguridad',
    question: 'Protégete de mensajes no deseados y estafas',
    answer: 'Las comunicaciones oficiales de VONDRO provienen únicamente de nuestra aplicación oficial y correos con dominio @vondro.com.ar o nuestro teléfono verificado (+54 9 351 289-9430).',
    isOrderIssue: false
  },
  {
    id: 'safety-and-data-usage',
    category: 'account',
    categoryLabel: 'Privacidad',
    question: '¿Es seguro comprar en VONDRO y cómo se usa mi información?',
    answer: 'Comprar en VONDRO es 100% seguro. Cumplimos con la Ley 25.326 de Protección de Datos Personales de Argentina y los estándares de seguridad de Google Play Store. Tus datos están cifrados y solo se utilizan para procesar y entregar tus pedidos.',
    isOrderIssue: false
  }
];

export const HelpCenterView: React.FC<HelpCenterViewProps> = ({ onBack }) => {
  const { setActiveTab } = useStore();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTabFilter, setActiveTabFilter] = useState<'recommended' | 'order_issues'>('recommended');
  // Start collapsed by default to drastically reduce initial scrolling
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  // Modals
  const [showRequestItemModal, setShowRequestItemModal] = useState<boolean>(false);
  const [requestedItemName, setRequestedItemName] = useState<string>('');
  const [requestedItemCategory, setRequestedItemCategory] = useState<string>('Hogar');
  const [requestItemSuccess, setRequestItemSuccess] = useState<boolean>(false);
  const [showTicketsModal, setShowTicketsModal] = useState<boolean>(false);

  // Guarantee HelpCenterView always starts strictly from top (0, 0)
  useEffect(() => {
    scrollToTop();
  }, []);

  const handleBack = () => {
    triggerHaptic('light');
    scrollToTop();
    if (onBack) {
      onBack();
    } else {
      setActiveTab('profile');
    }
  };

  const handleToggleFaq = (id: string) => {
    triggerHaptic('light');
    setExpandedFaqId(prev => prev === id ? null : id);
  };

  const handleRequestItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedItemName.trim()) return;
    triggerHaptic('heavy');
    setRequestItemSuccess(true);
    setTimeout(() => {
      setShowRequestItemModal(false);
      setRequestItemSuccess(false);
      setRequestedItemName('');
    }, 1800);
  };

  // Filter FAQs based on search, category chip, or tab
  const filteredFaqs = FAQ_LIST.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.question.toLowerCase().includes(q) || 
        item.answer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q)
      );
    }
    if (activeTabFilter === 'order_issues') {
      return item.isOrderIssue;
    }
    return true;
  });

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
            Centro de Ayuda
          </h1>
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
            Soporte Oficial
          </span>
        </div>
        <div className="w-8" />
      </div>

      <div className="max-w-xl mx-auto p-3.5 sm:p-4 space-y-3">
        {/* Compact Guarantee Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-xl px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-200" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold tracking-wide uppercase text-emerald-200 block leading-tight">
                Garantía VONDRO 90 Días
              </span>
              <p className="text-[11px] font-medium text-white/90 leading-tight">
                Devolución gratis en Córdoba Capital y reemplazo inmediato
              </p>
            </div>
          </div>
        </div>

        {/* Compact Search & Category Chips */}
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs space-y-2.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3" />
            <input
              type="text"
              placeholder="¿Cómo podemos ayudarte hoy?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white font-medium transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'returns', label: 'Devoluciones' },
              { id: 'shipping', label: 'Envíos' },
              { id: 'promos', label: 'Promociones' },
              { id: 'account', label: 'Cuenta' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory(cat.id);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Quick Direct Actions Grid (3 Compact Buttons) */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
            {/* Action 1: Chat Oficial */}
            <button
              onClick={() => {
                triggerHaptic('medium');
                setIsChatOpen(true);
              }}
              className="p-2 rounded-xl bg-purple-50/70 hover:bg-purple-100/70 text-purple-900 border border-purple-100 flex flex-col items-center text-center gap-1 active:scale-95 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-700 text-white flex items-center justify-center shadow-2xs">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-black leading-tight">Chat 24/7</span>
            </button>

            {/* Action 2: Mis Consultas / Tickets */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowTicketsModal(true);
              }}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-100 flex flex-col items-center text-center gap-1 active:scale-95 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shadow-2xs">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-black leading-tight">Mis Consultas</span>
            </button>

            {/* Action 3: Solicitar Producto */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowRequestItemModal(true);
              }}
              className="p-2 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 border border-amber-100 flex flex-col items-center text-center gap-1 active:scale-95 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-black leading-tight">Pedir Producto</span>
            </button>
          </div>
        </div>

        {/* FAQs Accordion Section */}
        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-100 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-purple-700" />
              Preguntas Frecuentes
            </h3>

            {/* Compact Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTabFilter('recommended');
                }}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  activeTabFilter === 'recommended'
                    ? 'bg-white text-purple-950 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Recomendadas
              </button>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTabFilter('order_issues');
                }}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  activeTabFilter === 'order_issues'
                    ? 'bg-white text-purple-950 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Entregas
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-6 space-y-1.5">
                <FileQuestion className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Sin resultados para esta búsqueda</p>
                <p className="text-[11px] text-slate-400">Podés consultarle directamente al chat oficial 24/7</p>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <div key={faq.id} className="py-2.5 first:pt-1 last:pb-1">
                    <button
                      onClick={() => handleToggleFaq(faq.id)}
                      className="w-full flex items-center justify-between text-left gap-2 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">
                          {faq.categoryLabel}
                        </span>
                        <span className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors truncate">
                          {faq.question}
                        </span>
                      </div>
                      <div className="shrink-0 text-slate-400 group-hover:text-slate-700">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed space-y-2 animate-fadeIn">
                        <p className="whitespace-pre-line font-normal">{faq.answer}</p>
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                          <span>¿Te resultó útil esta respuesta?</span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => triggerHaptic('light')}
                              className="px-2 py-0.5 bg-white rounded border border-slate-200 font-bold hover:bg-purple-50 hover:text-purple-700"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => triggerHaptic('light')}
                              className="px-2 py-0.5 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Compact Professional Contact Card (NO WhatsApp) */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <span>¿Necesitás asistencia adicional?</span>
            </h4>
            <span className="text-[10px] font-bold text-purple-700">Atención Oficial</span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Nuestro equipo de atención al cliente está a tu disposición para coordinar entregas y resolver consultas en Córdoba.
          </p>

          {/* Primary Action Button: Chat Oficial */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              setIsChatOpen(true);
            }}
            className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            Abrir Chat de Soporte Oficial 24/7
          </button>

          {/* Direct Contact Channels Info */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1">
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <span>Central telefónica: <strong>+54 9 351 289-9430</strong></span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <span>Correo de soporte: <strong>ayuda@vondro.com.ar</strong></span>
            </p>
            <p className="text-[10px] text-slate-400 pl-5.5">
              Horario: Lunes a Viernes 09:00 a 20:00 hs · Sábados 09:00 a 14:00 hs
            </p>
          </div>
        </div>
      </div>

      {/* LIVE SUPPORT CHAT MODAL */}
      <LiveSupportChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* MODAL: REQUEST AN ITEM */}
      {showRequestItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3.5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900">Solicitar un artículo</h3>
              <button onClick={() => setShowRequestItemModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {requestItemSuccess ? (
              <div className="text-center py-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">¡Solicitud recibida con éxito!</h4>
                <p className="text-[11px] text-slate-500">
                  Evaluaremos incorporarlo a nuestro catálogo de distribuidores en Córdoba.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestItemSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    ¿Qué producto te gustaría encontrar en VONDRO?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Termo de acero inoxidable 1L, Luz led solar..."
                    value={requestedItemName}
                    onChange={(e) => setRequestedItemName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Categoría sugerida
                  </label>
                  <select
                    value={requestedItemCategory}
                    onChange={(e) => setRequestedItemCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="Hogar">Hogar y Organización</option>
                    <option value="Tecnología">Tecnología y Accesorios</option>
                    <option value="Belleza">Belleza y Cuidado Personal</option>
                    <option value="Herramientas">Herramientas y Autos</option>
                    <option value="Cocina">Cocina y Bazar</option>
                    <option value="Otro">Otra categoría</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRequestItemModal(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Enviar pedido
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SUPPORT TICKETS & HISTORY */}
      {showTicketsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-md w-full space-y-3.5 shadow-2xl animate-scaleIn max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Registros de atención</h3>
                <p className="text-[11px] text-slate-500">Historial de solicitudes en Córdoba Capital</p>
              </div>
              <button onClick={() => setShowTicketsModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-[11px]">Consulta de Entrega Rápida</span>
                  <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                    RESUELTO
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Confirmación de franja horaria para entrega en Nueva Córdoba.
                </p>
                <p className="text-slate-400 text-[10px]">
                  Fecha: Hace 3 días · Asistente Oficial VONDRO
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-[11px]">Verificación de Garantía 90 Días</span>
                  <span className="bg-slate-200 text-slate-700 text-[9px] font-black px-2 py-0.5 rounded-full">
                    FINALIZADO
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Activación de cobertura para compra de organizadores.
                </p>
                <p className="text-slate-400 text-[10px]">
                  Fecha: Hace 1 semana
                </p>
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={() => setShowTicketsModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
