import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, 
  X, 
  Minimize2, 
  Sparkles, 
  Search, 
  Package, 
  Tag, 
  ShoppingCart, 
  Truck, 
  CreditCard, 
  HelpCircle, 
  User,
  UserCheck, 
  ExternalLink,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  LifeBuoy,
  Trash2,
  BookOpen,
  ListFilter,
  CheckCheck
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { AssistantMessage, SupportTicketReason, SupportTicketPriority } from '../../types';
import { triggerHaptic } from '../../utils/native';

// Custom VONDRO Avatar Icon matching the official brand logo
const VondroAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg'; showGlow?: boolean }> = ({ 
  size = 'md', 
  showGlow = true 
}) => {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  }[size];

  const svgSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  }[size];

  return (
    <div className={`relative ${sizeClasses} shrink-0 select-none flex items-center justify-center`}>
      {/* Speed trail aura */}
      {showGlow && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-4 h-2 bg-purple-500/60 blur-[3px] rounded-full pointer-events-none" />
      )}
      <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#581C87] via-[#7C3AED] to-[#9333EA] flex items-center justify-center text-white shadow-md shadow-purple-950/70 border border-purple-300/50 relative overflow-hidden">
        {/* Official VONDRO dynamic icon mark */}
        <svg 
          viewBox="0 0 200 200" 
          className={`${svgSizes} shrink-0`}
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Speed Motion Lines */}
          <rect x="24" y="76" width="38" height="7" rx="3.5" fill="#C4B5FD" opacity="0.8" />
          <rect x="12" y="94" width="54" height="8" rx="4" fill="#DDD6FE" opacity="0.9" />
          <rect x="28" y="113" width="30" height="7" rx="3.5" fill="#C4B5FD" opacity="0.8" />

          {/* Bag Handle */}
          <path 
            d="M74 58 C74 34, 126 34, 126 58" 
            stroke="#FFFFFF" 
            strokeWidth="11" 
            strokeLinecap="round" 
            fill="none" 
          />

          {/* Bag Body */}
          <path 
            d="M62 60 H138 C146 60, 153 66, 154 74 L162 144 C163 154, 155 162, 145 162 H55 C45 162, 37 154, 38 144 L46 74 C47 66, 54 60, 62 60 Z" 
            fill="#6D28D9" 
          />

          {/* Stylized Dynamic White "V" Cutout */}
          <path 
            d="M48 84 C72 84, 82 92, 102 146 C118 96, 138 72, 172 68 C150 82, 134 116, 114 162 C104 162, 94 158, 90 148 L62 94 C56 86, 50 84, 48 84 Z" 
            fill="#FFFFFF" 
          />
        </svg>
      </div>
    </div>
  );
};

// Formats message text with bold tags and line breaks
const FormattedMessageText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 break-words [overflow-wrap:anywhere] min-w-0">
      {lines.map((line, lIdx) => {
        if (!line.trim()) return <div key={lIdx} className="h-1.5" />;

        // Parse **bold** markdown
        const parts = line.split(/(\*\*.*?\*\*)/g);

        return (
          <p key={lIdx} className="leading-relaxed break-words [overflow-wrap:anywhere]">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldContent = part.slice(2, -2);
                return (
                  <strong 
                    key={pIdx} 
                    className="font-bold text-white tracking-wide drop-shadow-xs"
                  >
                    {boldContent}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
};

export const AssistantChat: React.FC = () => {
  const { 
    isAssistantOpen, 
    setIsAssistantOpen, 
    toggleAssistant,
    conversations,
    currentConversationId,
    conversationMessages,
    clearAssistantChat,
    sendAssistantUserMessage,
    openProductDetail,
    addToCart,
    createSupportTicket,
    faqs,
    user,
    orders,
    openOrderDetail,
    products,
    setActiveTab,
    activeTab,
    isCartPillVisible
  } = useStore();

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  // Floating Assistant Button Adaptive States
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const startOffsetY = useRef(0);
  const hasMovedRef = useRef(false);

  // Ticket Form State
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketReason, setTicketReason] = useState<SupportTicketReason>('falla_rotura');
  const [ticketPriority, setTicketPriority] = useState<SupportTicketPriority>('media');
  const [ticketOrderNumber, setTicketOrderNumber] = useState('');
  const [ticketSuccessMessage, setTicketSuccessMessage] = useState<string | null>(null);

  const [isScrollVisible, setIsScrollVisible] = useState(true);
  const lastScrollY = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dynamic Visual Viewport tracking for mobile virtual keyboard adaptation
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!isAssistantOpen) return;

    const updateViewport = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
      updateViewport();
    }

    return () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewport);
        window.visualViewport.removeEventListener('scroll', updateViewport);
      }
    };
  }, [isAssistantOpen]);

  // Smart Scroll: Auto-hide floating button on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;

      if (Math.abs(currentScrollY - lastScrollY.current) < 6) {
        return;
      }

      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsScrollVisible(false);
      } else {
        setIsScrollVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    if (isAssistantOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationMessages, isAssistantOpen, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isAssistantOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isAssistantOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    setInputMessage('');
    setIsTyping(true);

    try {
      await sendAssistantUserMessage(text);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickReply = (qr: any) => {
    if (!qr) return;
    triggerHaptic('selection');

    if (typeof qr === 'string') {
      const orderMatch = qr.match(/(#?von-\d{1,8})/i);
      if (orderMatch) {
        const matched = orders.find(o => o.orderNumber.replace('#', '').toLowerCase() === orderMatch[1].replace('#', '').toLowerCase());
        if (matched) {
          openOrderDetail(matched);
        }
      }
      handleSend(qr);
      return;
    }

    const action = qr.action || '';
    const payloadText = qr.payload || qr.label || action || '';

    // Direct UI navigation actions
    if (action === 'view_cart' || action === 'start_checkout') {
      setActiveTab('cart');
      setIsAssistantOpen(false);
      return;
    }

    if (action === 'open_ticket_modal' || action === 'ticket_form') {
      setIsAssistantOpen(false);
      setShowTicketModal(true);
      return;
    }

    if (action === 'main_menu') {
      handleSend('hola');
      return;
    }

    if (action === 'show_faq' || action === 'open_faqs') {
      handleSend('preguntas frecuentes de la tienda');
      return;
    }

    if (action === 'search_prompt') {
      handleSend('buscar productos');
      return;
    }

    if (action === 'stock_prompt') {
      handleSend('consultar disponibilidad de stock');
      return;
    }

    if (action === 'price_prompt') {
      handleSend('consultar precios y ofertas');
      return;
    }

    if (action === 'request_agent') {
      handleSend('quiero hablar con un asesor humano');
      return;
    }

    // Add to cart action from quick replies
    if (action.startsWith('add_cart_')) {
      const prodId = action.replace('add_cart_', '');
      const prod = products.find(p => p.id === prodId);
      if (prod) {
        addToCart(prod, 1);
        triggerHaptic('success');
        setAddedProductId(prod.id);
        setTimeout(() => setAddedProductId(null), 2500);
        handleSend(`Agregué 1x "${prod.name}" al carrito.`);
        return;
      }
    }

    // View product detail action
    if (action.startsWith('view_product_') || action.startsWith('open_product_')) {
      const prodId = action.replace('view_product_', '').replace('open_product_', '');
      const prod = products.find(p => p.id === prodId);
      if (prod) {
        openProductDetail(prod);
        setIsAssistantOpen(false);
        return;
      }
    }

    // Order status or tracking action
    if (action.startsWith('order_status_') || action.startsWith('track_')) {
      const orderNum = action.replace('order_status_', '').replace('track_', '');
      const matched = orders.find(o => 
        o.orderNumber.replace('#', '').toLowerCase() === orderNum.replace('#', '').toLowerCase() ||
        o.id === orderNum
      );
      if (matched) {
        openOrderDetail(matched);
      }
      handleSend(payloadText || `consultar estado de pedido ${orderNum}`);
      return;
    }

    if (payloadText) {
      handleSend(payloadText);
    }
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDescription.trim()) return;

    try {
      const newTicket = await createSupportTicket({
        channel: 'web',
        conversationId: currentConversationId,
        customerName: user?.name || 'Cliente Web',
        customerEmail: user?.email || '',
        customerPhone: user?.phone || '',
        orderNumber: ticketOrderNumber.trim() || undefined,
        reason: ticketReason,
        priority: ticketPriority,
        status: 'open',
        subject: ticketSubject.trim(),
        description: ticketDescription.trim()
      });

      setTicketSuccessMessage(`¡Ticket creado con éxito! Número: ${newTicket.ticketNumber}`);
      setTimeout(() => {
        setShowTicketModal(false);
        setTicketSuccessMessage(null);
        setTicketSubject('');
        setTicketDescription('');
        setTicketOrderNumber('');
        handleSend(`He creado el ticket ${newTicket.ticketNumber} sobre: "${newTicket.subject}"`);
      }, 1800);
    } catch (err) {
      console.error('Error creating ticket:', err);
    }
  };

  // Flyer Quick Action Pills
  const FLYER_PRIMARY_ACTIONS = [
    { label: 'Buscar productos', icon: Search, query: 'buscar productos' },
    { label: 'Disponibilidad', icon: Package, query: 'consultar disponibilidad de stock' },
    { label: 'Precios', icon: Tag, query: 'consultar precios y promociones' },
    { label: 'Explorar el catálogo', icon: BookOpen, query: 'ver catálogo completo de productos' },
  ];

  // Helper to render action pill button
  const renderActionPill = (
    label: string, 
    queryOrAction: string | any, 
    IconComponent?: React.ElementType,
    key?: string | number
  ) => {
    // Detect icon from label if not provided
    let Icon = IconComponent;
    if (!Icon) {
      const l = label.toLowerCase();
      if (l.includes('buscar') || l.includes('catalogo')) Icon = Search;
      else if (l.includes('disponib') || l.includes('stock')) Icon = Package;
      else if (l.includes('precio') || l.includes('oferta')) Icon = Tag;
      else if (l.includes('asesor') || l.includes('humano')) Icon = User;
      else if (l.includes('pregunt') || l.includes('faq')) Icon = HelpCircle;
      else if (l.includes('menu') || l.includes('volver') || l.includes('inicio')) Icon = ListFilter;
      else if (l.includes('pedido') || l.includes('compra')) Icon = ShoppingCart;
      else if (l.includes('envio') || l.includes('cordoba')) Icon = Truck;
      else Icon = Sparkles;
    }

    return (
      <button
        key={key || label}
        type="button"
        onClick={() => handleQuickReply(queryOrAction)}
        className="group bg-[#150D2E]/95 hover:bg-[#22134B] border border-purple-500/40 hover:border-purple-300 text-purple-100 hover:text-white px-3.5 py-2 sm:py-2.5 rounded-full text-xs sm:text-[13px] font-medium flex items-center justify-between gap-2 shadow-xs transition-all duration-200 active:scale-95 cursor-pointer whitespace-nowrap shrink-0 snap-start"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 group-hover:text-purple-200 shrink-0" />
          <span className="whitespace-nowrap font-medium text-white/95">{label}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 group-hover:text-purple-200 transition-all shrink-0 ml-0.5" />
      </button>
    );
  };

  // Floating Assistant Button Drag & Click Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    startOffsetY.current = dragOffsetY;
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartY.current;
    if (Math.abs(deltaY) > 15) {
      hasMovedRef.current = true;
      const newOffset = Math.max(-220, Math.min(30, startOffsetY.current + deltaY));
      setDragOffsetY(newOffset);
    }
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleOpenAssistant = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    triggerHaptic('selection');
    setIsAssistantOpen(true);
  };

  // In Checkout view, hide the floating trigger button so it never obstructs form fields or payment buttons
  if (!isAssistantOpen && activeTab === 'checkout') {
    return null;
  }

  return (
    <>
      {/* Floating Circular FAB Button with VONDRO Logo */}
      {!isAssistantOpen && (
        isMinimized ? (
          /* Minimized Edge Dock Pill */
          <button
            id="btn-assistant-docked"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerHaptic('selection');
              setIsMinimized(false);
              setIsAssistantOpen(true);
            }}
            style={{ transform: `translateY(${dragOffsetY}px)` }}
            className={`fixed right-0 z-40 transition-all duration-300 ease-out flex items-center shadow-xl cursor-pointer ${
              isCartPillVisible
                ? 'bottom-[calc(148px+env(safe-area-inset-bottom,0px))] md:bottom-44'
                : activeTab === 'cart'
                ? 'bottom-[calc(148px+env(safe-area-inset-bottom,0px))] md:bottom-36'
                : activeTab === 'product-detail'
                ? 'bottom-[calc(92px+env(safe-area-inset-bottom,0px))] md:bottom-28'
                : 'bottom-[calc(92px+env(safe-area-inset-bottom,0px))] md:bottom-28'
            } ${
              isScrollVisible 
                ? 'opacity-100 translate-x-0 pointer-events-auto' 
                : 'opacity-0 translate-x-full pointer-events-none'
            }`}
            title="Abrir Asistente VONDRO"
            aria-label="Abrir Asistente VONDRO"
          >
            <div className="flex items-center gap-2 bg-gradient-to-l from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] text-white pl-3 pr-2.5 py-2.5 rounded-l-full border-l-2 border-y-2 border-purple-300/70 shadow-xl shadow-purple-950/80 hover:pl-4 transition-all group">
              <VondroAvatar size="sm" showGlow={false} />
              <span className="text-[11px] font-bold text-white tracking-tight hidden sm:inline">VONDRO IA</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            </div>
          </button>
        ) : (
          /* Modern, Compact & Premium Floating Assistant Button */
          <div
            style={{ transform: `translateY(${dragOffsetY}px)` }}
            className={`fixed right-3.5 md:right-6 z-40 transition-all duration-300 ease-out select-none ${
              isCartPillVisible
                ? 'bottom-[calc(148px+env(safe-area-inset-bottom,0px))] md:bottom-44'
                : activeTab === 'cart'
                ? 'bottom-[calc(148px+env(safe-area-inset-bottom,0px))] md:bottom-36'
                : activeTab === 'product-detail'
                ? 'bottom-[calc(92px+env(safe-area-inset-bottom,0px))] md:bottom-28'
                : 'bottom-[calc(92px+env(safe-area-inset-bottom,0px))] md:bottom-28'
            } ${
              isScrollVisible 
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
                : 'opacity-0 translate-y-12 scale-75 pointer-events-none'
            }`}
          >
            <div className="relative group">
              <button
                id="btn-assistant-floating"
                type="button"
                onClick={handleOpenAssistant}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setIsDragging(false)}
                className="w-12 h-12 rounded-full bg-gradient-to-b from-[#8B5CF6] via-[#7C3AED] to-[#581C87] text-white shadow-[0_8px_22px_-4px_rgba(109,40,217,0.5),0_2px_6px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_28px_-4px_rgba(109,40,217,0.65)] border border-purple-300/35 ring-1 ring-inset ring-white/20 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer relative"
                aria-label="Abrir Asistente VONDRO"
                title="Asistente VONDRO"
              >
                {/* Centered VONDRO Logo Icon */}
                <div className="relative flex items-center justify-center pointer-events-none">
                  <svg 
                    viewBox="0 0 200 200" 
                    className="w-7 h-7 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Speed Motion Lines */}
                    <rect x="24" y="76" width="38" height="7" rx="3.5" fill="#DDD6FE" opacity="0.85" />
                    <rect x="12" y="94" width="54" height="8" rx="4" fill="#EDE9FE" opacity="0.95" />
                    <rect x="28" y="113" width="30" height="7" rx="3.5" fill="#DDD6FE" opacity="0.85" />

                    {/* Bag Handle */}
                    <path 
                      d="M74 58 C74 34, 126 34, 126 58" 
                      stroke="#FFFFFF" 
                      strokeWidth="11" 
                      strokeLinecap="round" 
                      fill="none" 
                    />

                    {/* Bag Body */}
                    <path 
                      d="M62 60 H138 C146 60, 153 66, 154 74 L162 144 C163 154, 155 162, 145 162 H55 C45 162, 37 154, 38 144 L46 74 C47 66, 54 60, 62 60 Z" 
                      fill="#4C1D95" 
                      fillOpacity="0.8"
                    />

                    {/* Stylized Dynamic White "V" Cutout */}
                    <path 
                      d="M48 84 C72 84, 82 92, 102 146 C118 96, 138 72, 172 68 C150 82, 134 116, 114 162 C104 162, 94 158, 90 148 L62 94 C56 86, 50 84, 48 84 Z" 
                      fill="#FFFFFF" 
                    />
                  </svg>
                </div>

                {/* Small Compact Online Indicator */}
                <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-400 border-[1.5px] border-[#581C87] rounded-full shadow-[0_0_6px_#34d399]" />
              </button>

              {/* Discreet Minimize Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('selection');
                  setIsMinimized(true);
                }}
                title="Minimizar botón al lateral"
                className="absolute -top-1 -left-1 w-4 h-4 bg-zinc-900/90 hover:bg-black text-purple-300 hover:text-white rounded-full border border-purple-400/40 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[8px] cursor-pointer shadow-xs z-10"
                aria-label="Minimizar al lateral"
              >
                <Minimize2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        )
      )}

      {/* Main Assistant Chat Window (Flyer Cyber-Violet UI) */}
      {isAssistantOpen && (
        <div
          id="assistant-chat-window"
          style={
            viewportHeight
              ? { height: `${Math.min(640, viewportHeight - 12)}px`, maxHeight: `${viewportHeight - 12}px` }
              : undefined
          }
          className="fixed bottom-2 right-2 left-2 sm:left-auto sm:bottom-6 sm:right-6 z-[9000] sm:w-[420px] h-[min(640px,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] bg-[#0B0616] border border-purple-500/35 rounded-3xl shadow-[0_0_50px_rgba(124,58,237,0.3)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* 1. Header Banner (Flyer Gradient with Glowing VONDRO Monogram & Live Status) */}
          <div className="sticky top-0 z-20 bg-gradient-to-r from-[#15093A] via-[#2A0E5C] to-[#47118E] px-3.5 sm:px-4 py-3 sm:py-3.5 flex items-center justify-between border-b border-purple-500/30 overflow-hidden shrink-0">
            {/* Ambient header glow flare */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-2.5 sm:gap-3 relative z-10 shrink-0">
              <VondroAvatar size="lg" showGlow={true} />
              
              <div className="shrink-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm sm:text-base tracking-tight text-white drop-shadow-xs whitespace-nowrap">
                    Asistente VONDRO
                  </h3>
                  <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black bg-[#7C3AED] text-white rounded-full tracking-wider shadow-xs border border-purple-300/40 shrink-0">
                    IA
                  </span>
                </div>
                <p className="text-[11px] text-purple-200/80 font-normal leading-tight mt-0.5 whitespace-nowrap hidden xs:block">
                  Tu asistente de compras 24/7
                </p>
              </div>
            </div>

            {/* Right Status & Action Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 relative z-10 shrink-0 ml-auto">
              <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 font-medium px-2 py-0.5 bg-emerald-950/40 border border-emerald-500/30 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                <span className="text-[10px] sm:text-[11px] font-medium">En línea</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setIsAssistantOpen(false);
                  setShowTicketModal(true);
                }}
                title="Crear Ticket de Soporte / Reclamo"
                className="w-8 h-8 sm:w-9 sm:h-9 min-w-[32px] sm:min-w-[36px] text-purple-300 hover:text-white bg-purple-900/30 hover:bg-purple-800/50 rounded-full transition-colors flex items-center justify-center cursor-pointer border border-purple-500/20 shrink-0"
              >
                <LifeBuoy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  clearAssistantChat();
                }}
                title="Borrar chat / Limpiar conversación"
                className="w-8 h-8 sm:w-9 sm:h-9 min-w-[32px] sm:min-w-[36px] text-purple-300 hover:text-rose-400 bg-purple-900/30 hover:bg-purple-800/50 rounded-full transition-colors flex items-center justify-center cursor-pointer border border-purple-500/20 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 hover:text-rose-400" />
              </button>

              {/* Accessible, high-contrast Close (X) button with min 44x44px touch target */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsAssistantOpen(false);
                }}
                title="Cerrar chat"
                aria-label="Cerrar chat"
                className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] sm:min-w-[44px] min-h-[40px] sm:min-h-[44px] text-purple-100 hover:text-white bg-purple-600/60 hover:bg-purple-600 active:scale-95 rounded-full transition-all flex items-center justify-center cursor-pointer border border-purple-400/40 shadow-sm ml-0.5 shrink-0"
              >
                <X className="w-5 h-5 text-white stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* 2. Chat Feed Area (Flyer Dark Purple Canvas with Native Touch Scroll) */}
          <div 
            id="assistant-chat-feed"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3.5 sm:p-4 bg-[#0B0616] text-purple-100 scrollbar-thin scrollbar-thumb-purple-900/50"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <div className="flex flex-col min-h-full space-y-4">
              {/* Flexible spacer that pushes conversation to bottom when brief, collapsing to 0 when overflowing */}
              <div className="flex-1 min-h-0 pointer-events-none" />

              {/* Flyer Welcome Greeting when conversation is empty */}
              {conversationMessages.length === 0 && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  {/* Bot Greeting Bubble */}
                  <div className="flex items-start gap-2.5">
                    <VondroAvatar size="md" showGlow={true} />
                    <div className="bg-[#140E2E]/95 border border-purple-500/25 rounded-2xl rounded-tl-xs p-4 text-xs sm:text-[13px] text-purple-100 leading-relaxed shadow-lg shadow-purple-950/50 max-w-[88%] space-y-3">
                      <p>
                        ¡Hola! 👋 Soy <strong className="text-white font-bold">VONDRO</strong>, tu asistente virtual de compras. Estoy disponible <strong className="text-white font-bold">24/7</strong> para ayudarte a encontrar productos, revisar tu catálogo, resolver dudas, hacer pedidos y mucho más.
                      </p>
                      <p className="font-semibold text-white">
                        ¿En qué puedo ayudarte hoy?
                      </p>
                      <div className="text-[10px] text-purple-400/70 text-right pt-1">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Initial Flyer Action Pills (Horizontal Scroll Carousel with pr-4 / 16px right padding) */}
                  <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar pl-10 pr-4 sm:pr-6 max-w-full snap-x">
                    {FLYER_PRIMARY_ACTIONS.map((act, idx) => 
                      renderActionPill(act.label, act.query, act.icon, idx)
                    )}
                  </div>
                </div>
              )}

            {/* Conversation Messages */}
            {conversationMessages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isAgent = msg.sender === 'agent' || msg.sender === 'human_agent';
              const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col space-y-2 ${isUser ? 'items-end' : 'items-start'} w-full min-w-0`}
                >
                  <div className={`flex items-start gap-2 max-w-[94%] sm:max-w-[85%] min-w-0 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Left or Right Avatar */}
                    {isUser ? (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#1F163D] border border-purple-500/40 text-purple-200 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-purple-950/60">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                    ) : (
                      <VondroAvatar size="sm" showGlow={false} />
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-lg min-w-0 flex-1 max-w-full overflow-hidden break-words [overflow-wrap:anywhere] ${
                        isUser
                          ? 'bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-white rounded-tr-xs shadow-purple-900/30'
                          : isAgent
                          ? 'bg-[#2A174E]/90 text-purple-100 border border-amber-500/40 rounded-tl-xs shadow-purple-950/50'
                          : 'bg-[#140E2E]/95 text-purple-100 border border-purple-500/25 rounded-tl-xs shadow-purple-950/50'
                      }`}
                    >
                      {isAgent && (
                        <div className="text-[10px] font-bold text-amber-300 mb-1.5 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Asesor Humano VONDRO
                        </div>
                      )}

                      {/* Text content with bold tag renderer */}
                      <FormattedMessageText text={msg.text} />

                      {/* Timestamp & Read Receipts */}
                      <div className="flex items-center justify-end gap-1 text-[10px] mt-1.5 pt-0.5 text-purple-300/80">
                        <span>{formattedTime}</span>
                        {isUser && (
                          <CheckCheck className="w-3.5 h-3.5 text-purple-200" />
                        )}
                      </div>

                      {/* Product Thumbnails inside message if present - Ultra compact layout */}
                      {msg.productThumbnails && msg.productThumbnails.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-purple-500/20 w-full min-w-0">
                          <div className="text-[10px] font-bold text-purple-300/90 flex items-center gap-1 mb-1.5">
                            <Package className="w-3 h-3 text-purple-400" />
                            <span>Opciones disponibles:</span>
                          </div>
                          
                          <div className="space-y-1.5 w-full min-w-0">
                            {msg.productThumbnails.slice(0, 4).map((prod) => {
                              const fullProd = products.find(p => p.id === prod.id);
                              const effectiveProd: any = fullProd || {
                                id: prod.id,
                                sku: prod.id,
                                name: prod.name,
                                slug: prod.id,
                                description: `${prod.name} con Garantía Oficial VONDRO.`,
                                shortFeatures: [],
                                categoryId: prod.category || 'productos-varios',
                                images: prod.image ? [prod.image] : [],
                                costPrice: 0,
                                salePrice: prod.price,
                                originalPrice: prod.originalPrice,
                                stock: prod.stock ?? 0,
                                stockStatus: (prod.stock ?? 0) > 5 ? 'available' : (prod.stock ?? 0) > 0 ? 'low_stock' : 'out_of_stock',
                                hideIfOutOfStock: false,
                                isFeatured: false,
                                isOnSale: Boolean(prod.originalPrice && prod.originalPrice > prod.price),
                                isNew: true,
                                rating: 5,
                                reviewCount: 0,
                                supplier: 'VONDRO'
                              };
                              const isAdded = addedProductId === prod.id;
                              const stockCount = prod.stock ?? fullProd?.stock ?? 0;
                              const hasDiscount = prod.originalPrice && prod.originalPrice > prod.price;

                              return (
                                <div
                                  key={prod.id}
                                  className="bg-[#1C123D]/95 p-2 rounded-xl border border-purple-500/30 flex items-center justify-between gap-1.5 sm:gap-2 shadow-2xs hover:border-purple-400 transition-all w-full min-w-0 overflow-hidden"
                                >
                                  <div 
                                    onClick={() => {
                                      openProductDetail(effectiveProd);
                                      setIsAssistantOpen(false);
                                    }}
                                    className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer overflow-hidden"
                                  >
                                    {prod.image ? (
                                      <img
                                        src={prod.image}
                                        alt={prod.name}
                                        className="w-9 h-9 sm:w-10 sm:h-10 object-cover rounded-lg bg-white/10 shrink-0 border border-purple-400/20"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-950/80 rounded-lg flex items-center justify-center shrink-0 border border-purple-500/30">
                                        <Package className="w-4 h-4 text-purple-300" />
                                      </div>
                                    )}
                                    <div className="truncate flex-1 min-w-0 overflow-hidden">
                                      <div className="font-semibold text-white text-[11px] truncate leading-tight">
                                        {prod.name}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                        <span className="text-emerald-400 font-extrabold text-[11px] shrink-0">
                                          ${(prod.price ?? 0).toLocaleString('es-AR')}
                                        </span>
                                        {hasDiscount && (
                                          <span className="text-[9px] text-purple-300/60 line-through shrink-0">
                                            ${(prod.originalPrice ?? 0).toLocaleString('es-AR')}
                                          </span>
                                        )}
                                        {stockCount > 0 ? (
                                          <span className="text-[9px] text-purple-300/80 font-medium truncate">
                                            • {stockCount > 5 ? 'En Stock' : `Quedan ${stockCount}`}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-rose-400 font-medium shrink-0">• Agotado</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quick Action Button */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={stockCount === 0}
                                      onClick={() => {
                                        addToCart(effectiveProd, 1);
                                        triggerHaptic('success');
                                        setAddedProductId(prod.id);
                                        setTimeout(() => setAddedProductId(null), 2200);
                                      }}
                                      className={`py-1 px-2 sm:px-2.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                                        isAdded
                                          ? 'bg-emerald-600 text-white'
                                          : stockCount === 0
                                          ? 'bg-purple-950/60 text-purple-400/40 cursor-not-allowed'
                                          : 'bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-2xs'
                                      }`}
                                    >
                                      {isAdded ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>Listo</span>
                                        </>
                                      ) : (
                                        <>
                                          <ShoppingCart className="w-3 h-3" />
                                          <span>Agregar</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Order Summary Card inside message */}
                      {msg.orderSummary && (
                        <div className="mt-3 pt-2.5 border-t border-purple-500/25 bg-[#1C123D]/90 p-3 rounded-xl border border-purple-500/30 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-white mb-1">
                            <span>Pedido #{msg.orderSummary.orderNumber}</span>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-900/80 text-purple-200 border border-purple-400/40 font-semibold">
                              {msg.orderSummary.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-purple-200/90 text-[11px] space-y-0.5">
                            <div>Total: <span className="font-bold text-white">${(msg.orderSummary?.total ?? 0).toLocaleString('es-AR')}</span></div>
                            <div>Envío: {msg.orderSummary.shippingStatus || 'En proceso'}</div>
                            {msg.orderSummary.trackingNumber && (
                              <div className="text-purple-300 font-mono text-[10px]">
                                Guía: {msg.orderSummary.trackingNumber}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const found = orders.find(o => 
                                (msg.orderSummary?.orderNumber && o.orderNumber === msg.orderSummary.orderNumber) || 
                                (msg.orderSummary?.id && o.id === msg.orderSummary.id)
                              );
                              if (found) {
                                openOrderDetail(found);
                                setIsAssistantOpen(false);
                              }
                            }}
                            className="mt-2.5 w-full py-1.5 px-3 bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:brightness-110 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm"
                          >
                            <span>Ver detalle completo del pedido</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Action Buttons inside message */}
                      {msg.actionButtons && msg.actionButtons.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                          {msg.actionButtons.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => {
                                if (btn.action === 'CREATE_SUPPORT_TICKET') {
                                  setIsAssistantOpen(false);
                                  setShowTicketModal(true);
                                } else if (btn.action === 'OPEN_FAQS') {
                                  handleSend('mostrar preguntas frecuentes');
                                } else {
                                  handleQuickReply(btn);
                                }
                              }}
                              className="px-3.5 py-2 text-xs font-semibold bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:brightness-110 text-white rounded-full transition-all flex items-center justify-between gap-1 shadow-md cursor-pointer border border-purple-300/40"
                            >
                              <span>{btn.label}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-purple-200" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Replies Pills (Horizontal Scroll Carousel with neat padding) */}
                  {!isUser && msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar pl-8 sm:pl-9 pr-2 w-full max-w-full snap-x">
                      {msg.quickReplies.map((qr, qrIdx) => 
                        renderActionPill(qr.label, qr, undefined, qrIdx)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Indicator (Glowing Cyber Violet) */}
            {isTyping && (
              <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
                <VondroAvatar size="md" showGlow={true} />
                <div className="bg-[#140E2E]/95 border border-purple-500/25 p-3.5 rounded-2xl rounded-tl-xs shadow-md flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-purple-200 rounded-full animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 3. Bottom Input Bar (Clean Full-Width Input + Send Button) */}
          <div className="p-2.5 sm:p-3.5 bg-[#0D071B] border-t border-purple-500/30 shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              {/* Capsule Input Field */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  id="input-assistant-chat"
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onFocus={() => {
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 300);
                  }}
                  placeholder="Escribe tu consulta o pedido..."
                  className="w-full px-4 py-2.5 bg-[#160E30] border border-purple-500/35 focus:border-purple-400 focus:ring-1 focus:ring-purple-500/50 rounded-full text-xs sm:text-[13px] text-white placeholder-purple-300/50 outline-none transition-all shadow-inner"
                />
              </div>

              {/* Glowing Purple Send Button */}
              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#A855F7] hover:from-[#6D28D9] hover:to-[#9333EA] disabled:opacity-40 disabled:hover:from-[#7C3AED] disabled:hover:to-[#A855F7] text-white flex items-center justify-center shadow-lg shadow-purple-600/40 active:scale-95 transition-all cursor-pointer shrink-0 disabled:cursor-not-allowed border border-purple-300/30"
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4 ml-0.5 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Support Ticket Modal (Dark Glass Cyber Aesthetic) */}
      {showTicketModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pt-16 sm:pt-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#120A27] border border-purple-500/40 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl shadow-purple-950/80 animate-in zoom-in-95 duration-150 text-white my-auto max-h-[calc(100dvh-5rem)] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-purple-500/30 pb-3 mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <LifeBuoy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">Abrir Ticket de Soporte</h3>
                  <p className="text-[11px] text-purple-300/70 truncate">Atención personalizada con el equipo VONDRO</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTicketModal(false)}
                title="Cerrar modal"
                aria-label="Cerrar modal"
                className="w-8 h-8 sm:w-9 sm:h-9 text-purple-300 hover:text-white bg-purple-900/40 hover:bg-purple-800 rounded-full transition-colors flex items-center justify-center cursor-pointer border border-purple-500/30 shrink-0 ml-2"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {ticketSuccessMessage ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                <p className="font-bold text-sm text-white">{ticketSuccessMessage}</p>
                <p className="text-xs text-purple-300/70">Un asesor se pondrá en contacto a la brevedad.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateTicketSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-purple-200 mb-1">
                    Motivo de la solicitud *
                  </label>
                  <select
                    value={ticketReason}
                    onChange={(e) => setTicketReason(e.target.value as SupportTicketReason)}
                    className="w-full px-3 py-2 bg-[#1A0E38] border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="falla_rotura">Producto defectuoso / Falla de fábrica</option>
                    <option value="demora_envio">Demora en la entrega / Envío</option>
                    <option value="cambio_devolucion">Cambio o Devolución</option>
                    <option value="cancelacion">Cancelación de pedido</option>
                    <option value="reclamo_pago">Problema con el Pago</option>
                    <option value="asesor_humano">Consulta general con Asesor</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-purple-200 mb-1">
                      N° Pedido (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: VON-8821"
                      value={ticketOrderNumber}
                      onChange={(e) => setTicketOrderNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1A0E38] border border-purple-500/30 rounded-lg text-white placeholder-[#A3A3C2] focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-purple-200 mb-1">
                      Prioridad
                    </label>
                    <select
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value as SupportTicketPriority)}
                      className="w-full px-2.5 py-2 bg-[#1A0E38] border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="baja">Baja (Consulta general)</option>
                      <option value="media">Media (Gestión rápida)</option>
                      <option value="alta">Alta (Pedido en curso)</option>
                      <option value="urgente">Urgente (Falla / Reclamo)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-purple-200 mb-1">
                    Asunto del Ticket *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Auricular Bluetooth no sincroniza"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A0E38] border border-purple-500/30 rounded-lg text-white placeholder-[#A3A3C2] focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block font-medium text-purple-200 mb-1">
                    Detalle y descripción *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe lo sucedido con el mayor detalle posible..."
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1A0E38] border border-purple-500/30 rounded-lg text-white placeholder-[#A3A3C2] resize-none focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTicketModal(false)}
                    className="px-3.5 py-2 bg-[#1A0E38] text-purple-200 rounded-lg hover:bg-[#25144F] font-medium border border-purple-500/30"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:brightness-110 text-white rounded-lg font-bold shadow-md"
                  >
                    Crear Ticket
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

