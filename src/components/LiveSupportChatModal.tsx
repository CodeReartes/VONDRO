import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Paperclip, 
  Smile, 
  CheckCheck, 
  Star, 
  Phone, 
  ShieldCheck, 
  Sparkles, 
  ShoppingBag, 
  Truck, 
  RotateCcw,
  Headphones,
  Image,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';

interface LiveSupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'system' | 'agent' | 'user';
  text: string;
  timestamp: string;
  imageUrl?: string;
  quickChips?: string[];
}

export const LiveSupportChatModal: React.FC<LiveSupportChatModalProps> = ({ isOpen, onClose }) => {
  const { user, settings, storeSettings, orders } = useStore();
  const activeSettings = settings || storeSettings;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'system',
      text: 'Bienvenido al Servicio de Atención al Cliente de VONDRO. Al continuar, usted reconoce que su chat puede ser monitoreado y utilizado de acuerdo con lo establecido en nuestra Política de Privacidad para mejorar su experiencia y optimizar la atención en Córdoba Capital. Gracias por contactarnos.',
      timestamp: 'Ahora'
    },
    {
      id: 'welcome-2',
      sender: 'agent',
      text: `Hola ${user?.name ? user.name.split(' ')[0] : ''}, soy el Asistente Oficial de Atención al Cliente de VONDRO. ¿En qué puedo ayudarte el día de hoy?`,
      timestamp: 'Ahora',
      quickChips: [
        'Estado de mi último pedido',
        '¿Cómo hacer una devolución?',
        'Zonas de envío en Córdoba',
        'Hablar con un asesor humano'
      ]
    }
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [ratingSubmitted, setRatingSubmitted] = useState<boolean>(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const finalMsg = textToSend || inputVal;
    if (!finalMsg.trim() && !attachedImage) return;

    triggerHaptic('light');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: finalMsg.trim(),
      imageUrl: attachedImage || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setAttachedImage(null);
    setIsTyping(true);

    // Dynamic smart response
    setTimeout(() => {
      setIsTyping(false);
      triggerHaptic('medium');
      const lower = finalMsg.toLowerCase();
      let replyText = 'Entendido. Estoy revisando tu solicitud en nuestro sistema de Córdoba Capital.';
      let chips: string[] | undefined = undefined;

      if (lower.includes('pedido') || lower.includes('estado') || lower.includes('seguimiento') || lower.includes('donde esta')) {
        const lastOrder = orders[0];
        if (lastOrder) {
          replyText = `Tu último pedido #${lastOrder.orderNumber} por un total de $${lastOrder.total.toLocaleString('es-AR')} está en estado: ${lastOrder.shippingStatus || 'EN PREPARACIÓN'}. Entrega estimada en ${lastOrder.shippingZoneName || 'Córdoba Capital'}.`;
          chips = ['Ver detalle completo del pedido', 'Cambiar dirección de entrega'];
        } else {
          replyText = 'No encontramos pedidos activos recientes asociados a tu cuenta. ¿Deseas hacer una consulta sobre algún producto de nuestro catálogo?';
          chips = ['Ver ofertas relámpago', 'Consultar tiempos de entrega'];
        }
      } else if (lower.includes('devol') || lower.includes('cambio') || lower.includes('garantia') || lower.includes('falla')) {
        replyText = 'En VONDRO contás con 90 días de garantía total. Podés solicitar el cambio o devolución sin cargo desde el Centro de Ayuda o enviándonos una foto del producto aquí mismo.';
        chips = ['Iniciar trámite de cambio', 'Ver política de devolución'];
      } else if (lower.includes('zona') || lower.includes('envio') || lower.includes('costo') || lower.includes('gratis')) {
        replyText = 'Realizamos envíos en el día en toda la Ciudad de Córdoba. Además, si tu compra supera los $100.000 ARS, ¡el envío es 100% GRATIS a tu domicilio!';
        chips = ['Calcular costo a mi barrio', 'Conocer horarios de cadetería'];
      } else if (lower.includes('humano') || lower.includes('asesor') || lower.includes('persona')) {
        replyText = `Un asesor de nuestro equipo oficial de soporte en Córdoba responderá por este mismo chat en breve. También podés comunicarte telefónicamente a nuestra central de atención.`;
        chips = ['Dejar mensaje detallado', 'Llamar a central de atención'];
      } else {
        replyText = `He registrado tu consulta: "${finalMsg}". Nuestro equipo de soporte oficial te asistirá con prioridad. ¿Hay algo puntual sobre tu compra o entrega que quieras detallar?`;
        chips = ['¿Cuánto tarda el envío?', '¿Cómo pagar con transferencia?', 'Hablar con un asesor'];
      }

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickChips: chips
      };

      setMessages(prev => [...prev, agentMsg]);
    }, 1000);
  };

  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
        triggerHaptic('light');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitRating = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('heavy');
    setRatingSubmitted(true);
    setTimeout(() => {
      setShowRatingModal(false);
      setRatingSubmitted(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 animate-fadeIn">
      {/* Main Chat Container */}
      <div className="bg-white w-full sm:max-w-md h-[92vh] sm:h-[680px] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Top Header (Screenshot 01559 Style) */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="p-1 -ml-1 text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-base tracking-tight">
                VONDRO
              </span>
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ayuda oficial 24/7
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              setShowRatingModal(true);
            }}
            className="px-3 py-1 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 font-bold text-xs rounded-full border border-slate-200 transition-colors cursor-pointer"
          >
            Calificar
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70">
          {messages.map((msg) => {
            const isSystem = msg.sender === 'system';
            const isUser = msg.sender === 'user';

            if (isSystem) {
              return (
                <div key={msg.id} className="p-3 bg-white border border-slate-200 rounded-2xl text-[11px] text-slate-600 leading-relaxed shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-700 font-bold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Aviso oficial de atención al cliente</span>
                  </div>
                  <p>{msg.text}</p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-purple-700 text-white rounded-br-xs shadow-xs'
                      : 'bg-white text-slate-900 border border-slate-100 rounded-bl-xs shadow-2xs'
                  }`}
                >
                  {msg.imageUrl && (
                    <img 
                      src={msg.imageUrl} 
                      alt="Adjunto" 
                      className="w-full max-h-48 object-cover rounded-xl mb-2 border border-black/10" 
                    />
                  )}
                  <p className="whitespace-pre-line font-normal">{msg.text}</p>
                </div>
                <span className="text-[10px] text-slate-400 px-1 font-medium">
                  {msg.timestamp}
                </span>

                {/* Quick Chips on Agent Messages */}
                {msg.quickChips && msg.quickChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5 max-w-[90%]">
                    {msg.quickChips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip)}
                        className="px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 hover:border-purple-300 rounded-full text-xs font-semibold shadow-2xs transition-all cursor-pointer text-left active:scale-95"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-100 w-24 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce [animation-delay:0.4s]" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Image Attachment Preview */}
        {attachedImage && (
          <div className="px-4 py-2 bg-purple-50 border-t border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={attachedImage} alt="Adjunto" className="w-10 h-10 object-cover rounded-lg border border-purple-200" />
              <span className="text-xs font-bold text-purple-900">Imagen adjuntada</span>
            </div>
            <button
              onClick={() => setAttachedImage(null)}
              className="text-xs text-rose-600 font-bold hover:underline"
            >
              Quitar
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleAttachImage}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-purple-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="Adjuntar imagen o comprobante"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            placeholder="Escribí tu mensaje o consulta..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all font-medium"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputVal.trim() && !attachedImage}
            className="p-2.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white rounded-full transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RATING MODAL */}
      {showRatingModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-purple-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Calificar atención de VONDRO</h3>
              <button onClick={() => setShowRatingModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {ratingSubmitted ? (
              <div className="text-center py-4 space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">¡Muchas gracias por tu opinión!</h4>
                <p className="text-xs text-slate-500">Nos ayuda a mejorar la experiencia en Córdoba.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitRating} className="space-y-4">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingScore(star)}
                      className="p-1 text-2xl cursor-pointer hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= ratingScore
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Comentario adicional (opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="¿Qué te pareció la rapidez y claridad?"
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRatingModal(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Enviar calificación
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
