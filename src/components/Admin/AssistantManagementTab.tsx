import React, { useState } from 'react';
import { 
  Bot, 
  MessageSquare, 
  LifeBuoy, 
  HelpCircle, 
  AlertCircle, 
  Send, 
  Pause, 
  Play, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  User, 
  Smartphone, 
  Globe, 
  ExternalLink,
  ShieldCheck,
  Check,
  X,
  ChevronRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { 
  AssistantConversation, 
  SupportTicket, 
  SupportTicketStatus, 
  FAQItem, 
  UnresolvedQuery 
} from '../../types';

export const AssistantManagementTab: React.FC = () => {
  const { 
    conversations,
    currentConversationId,
    setCurrentConversationId,
    sendAssistantAdminMessage,
    setConversationAiPaused,
    updateConversationStatus,
    deleteConversation,
    supportTickets,
    updateTicketStatus,
    faqs,
    addOrUpdateFAQ,
    deleteFAQ,
    unresolvedQueries,
    resolveUnresolvedQuery
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<'conversations' | 'tickets' | 'faqs' | 'unresolved' | 'whatsapp'>('conversations');
  const [mobileConversationView, setMobileConversationView] = useState<'list' | 'chat'>('list');

  // Conversations State
  const [channelFilter, setChannelFilter] = useState<'all' | 'web' | 'whatsapp'>('all');
  const [adminReplyText, setAdminReplyText] = useState('');
  const chatMessagesEndRef = React.useRef<HTMLDivElement>(null);

  // Tickets State
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | SupportTicketStatus>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResolutionNote, setTicketResolutionNote] = useState('');
  const [ticketAdminNote, setTicketAdminNote] = useState('');

  // FAQs State
  const [editingFaq, setEditingFaq] = useState<Partial<FAQItem> | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState<FAQItem['category']>('general');

  // Active Conversation
  const selectedConversation = (conversations || []).find(c => c?.id === currentConversationId) || conversations?.[0];

  // Auto-scroll chat messages
  React.useEffect(() => {
    if (selectedConversation) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages?.length, currentConversationId]);

  // When currentConversationId changes from outside (e.g., notification click), switch to chat view
  React.useEffect(() => {
    if (currentConversationId) {
      setMobileConversationView('chat');
    }
  }, [currentConversationId]);

  const filteredConversations = conversations.filter(c => {
    if (channelFilter === 'all') return true;
    return c.channel === channelFilter;
  });

  const filteredTickets = supportTickets.filter(t => {
    if (ticketStatusFilter === 'all') return true;
    return t.status === ticketStatusFilter;
  });

  const handleSelectConversation = (convId: string) => {
    setCurrentConversationId(convId);
    setMobileConversationView('chat');
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !selectedConversation) return;

    await sendAssistantAdminMessage(selectedConversation.id, adminReplyText.trim());
    setAdminReplyText('');
  };

  const handleQuickInsertTemplate = (text: string) => {
    setAdminReplyText(text);
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    await addOrUpdateFAQ({
      id: editingFaq?.id,
      question: faqQuestion.trim(),
      answer: faqAnswer.trim(),
      category: faqCategory
    });

    setEditingFaq(null);
    setFaqQuestion('');
    setFaqAnswer('');
  };

  const handleEditFaqClick = (faq: FAQItem) => {
    setEditingFaq(faq);
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setFaqCategory(faq.category);
  };

  return (
    <div className="space-y-6">
      {/* Subtabs Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-black flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-500" />
            Centro de Asistente & Atención Omnicanal
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Gestiona conversaciones en tiempo real, tickets de reclamo, base de conocimiento y WhatsApp Business.
          </p>
        </div>

        {/* Subtab Navigation Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/70 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('conversations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === 'conversations'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Conversaciones
            {conversations.filter(c => (c.unreadCountAdmin || 0) > 0).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('tickets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === 'tickets'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            Tickets ({supportTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length})
          </button>

          <button
            onClick={() => setActiveSubTab('faqs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === 'faqs'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Preguntas Frecuentes ({faqs.length})
          </button>

          <button
            onClick={() => setActiveSubTab('unresolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === 'unresolved'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Consultas no Resueltas ({unresolvedQueries.filter(q => q.status === 'pending').length})
          </button>

          <button
            onClick={() => setActiveSubTab('whatsapp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeSubTab === 'whatsapp'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
            WhatsApp Business API
          </button>
        </div>
      </div>

      {/* 1. CONVERSATIONS SUBTAB */}
      {activeSubTab === 'conversations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px] lg:h-[660px]">
          {/* Inbox Sidebar */}
          <div className={`lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col overflow-hidden ${
            mobileConversationView === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}>
            {/* Filter Header */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/40">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Bandeja de Entrada</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChannelFilter('all')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    channelFilter === 'all' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setChannelFilter('web')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    channelFilter === 'web' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Web
                </button>
                <button
                  onClick={() => setChannelFilter('whatsapp')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    channelFilter === 'whatsapp' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  WhatsApp
                </button>
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[500px] lg:max-h-none">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No hay conversaciones en este canal.
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = conv.id === selectedConversation?.id;
                  const hasAdvisorRequest = conv.messages?.some(m => 
                    m.text.toLowerCase().includes('asesor') || 
                    m.text.toLowerCase().includes('humano') ||
                    (m.actionType as string) === 'request_agent'
                  );

                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`w-full text-left p-3.5 transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-l-4 border-cyan-500'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 overflow-hidden">
                        <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 relative">
                          {conv.channel === 'whatsapp' ? (
                            <Smartphone className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Globe className="w-4 h-4 text-cyan-500" />
                          )}
                          {hasAdvisorRequest && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full ring-2 ring-white dark:ring-zinc-900 animate-pulse" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                              {conv.customerName}
                            </span>
                            {conv.aiPaused && (
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold rounded">
                                Humano
                              </span>
                            )}
                            {hasAdvisorRequest && !conv.aiPaused && (
                              <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[9px] font-bold rounded">
                                Pide Asesor
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {conv.lastMessagePreview || 'Nueva conversación'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end">
                        <span className="text-[10px] text-zinc-400">
                          {new Date(conv.lastMessageAt || conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {conv.unreadCountAdmin ? (
                          <span className="block mt-1 w-4 h-4 rounded-full bg-cyan-500 text-white text-[9px] font-bold text-center leading-4">
                            {conv.unreadCountAdmin}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Conversation Detail & Active Chat View */}
          <div className={`lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col overflow-hidden ${
            mobileConversationView === 'list' ? 'hidden lg:flex' : 'flex'
          }`}>
            {selectedConversation ? (
              <>
                {/* Chat Top Bar */}
                <div className="p-3.5 sm:p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/50">
                  <div className="flex items-center gap-3">
                    {/* Mobile Back Button */}
                    <button
                      onClick={() => setMobileConversationView('list')}
                      className="lg:hidden p-1.5 -ml-1 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg"
                      title="Volver a la lista"
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>

                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-sm">
                      {selectedConversation.customerName ? selectedConversation.customerName.slice(0, 2).toUpperCase() : 'CL'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                          {selectedConversation.customerName}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          selectedConversation.channel === 'whatsapp' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
                        }`}>
                          {selectedConversation.channel.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {selectedConversation.customerPhone || selectedConversation.customerEmail || 'ID: ' + selectedConversation.id}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Pause AI / Status / Delete) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConversationAiPaused(selectedConversation.id, !selectedConversation.aiPaused)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
                        selectedConversation.aiPaused
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      {selectedConversation.aiPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5 text-white" />
                          <span>Reanudar IA</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5 text-amber-500" />
                          <span>Pausar IA (Tomar Chat)</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => deleteConversation(selectedConversation.id)}
                      className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Eliminar conversación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Banner if customer requested human advisor */}
                {selectedConversation.messages?.some(m => m.text.toLowerCase().includes('asesor') || m.text.toLowerCase().includes('humano')) && !selectedConversation.aiPaused && (
                  <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>El cliente solicitó atención de un asesor humano.</span>
                    </div>
                    <button
                      onClick={() => setConversationAiPaused(selectedConversation.id, true)}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shrink-0"
                    >
                      Tomar Chat
                    </button>
                  </div>
                )}

                {/* Messages Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/40 dark:bg-zinc-950/30 min-h-[300px]">
                  {selectedConversation.messages && selectedConversation.messages.length > 0 ? (
                    selectedConversation.messages.map(msg => {
                      const isCustomer = msg.sender === 'user';
                      const isAgent = msg.sender === 'human_agent' || msg.sender === 'agent';
                      const isBot = msg.sender === 'assistant';

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-2.5 ${isCustomer ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[85%] sm:max-w-[75%] p-3 rounded-2xl text-xs shadow-xs ${
                            isCustomer
                              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700'
                              : isAgent
                              ? 'bg-purple-600 text-white'
                              : 'bg-zinc-900 text-white dark:bg-zinc-700'
                          }`}>
                            <div className="flex items-center justify-between gap-3 text-[10px] font-bold mb-1 opacity-80">
                              <span>
                                {isCustomer ? selectedConversation.customerName : isAgent ? '👤 Asesor Humano (Tú)' : '🤖 IA Asistente'}
                              </span>
                              <span>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-zinc-400">
                      No hay mensajes en esta conversación aún.
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Quick Templates Bar */}
                <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 shrink-0">Respuestas rápidas:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickInsertTemplate('¡Hola! Soy Diego de VONDRO, ¿en qué te puedo ayudar?')}
                    className="whitespace-nowrap px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-purple-600 hover:text-white transition-colors"
                  >
                    Saludo Asesor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickInsertTemplate('Tu pedido ya está siendo preparado y saldrá a reparto en el próximo turno.')}
                    className="whitespace-nowrap px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-purple-600 hover:text-white transition-colors"
                  >
                    Estado Pedido
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickInsertTemplate('Tenemos stock disponible para entrega inmediata en Córdoba.')}
                    className="whitespace-nowrap px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-purple-600 hover:text-white transition-colors"
                  >
                    Stock Confirmado
                  </button>
                </div>

                {/* Agent Reply Input Form */}
                <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <form onSubmit={handleSendAdminReply} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder={selectedConversation.aiPaused ? "Escribe tu respuesta como asesor (la IA está en pausa)..." : "Escribe tu respuesta como asesor..."}
                      className="flex-1 px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="submit"
                      disabled={!adminReplyText.trim()}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-600/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center h-full">
                <MessageSquare className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300">Selecciona una conversación</p>
                <p className="text-xs text-zinc-400 mt-1">Elige una conversación de la bandeja de entrada para responder a tus clientes.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SUPPORT TICKETS SUBTAB */}
      {activeSubTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Filtrar Estado:</span>
              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-900 dark:text-white"
              >
                <option value="all">Todos los Tickets</option>
                <option value="open">Abiertos / Nuevos</option>
                <option value="in_progress">En Gestión</option>
                <option value="resolved">Resueltos</option>
                <option value="closed">Cerrados</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map(ticket => (
              <div
                key={ticket.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-zinc-900 dark:text-white">
                    {ticket.ticketNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ticket.status === 'open' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                    ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {ticket.status.toUpperCase()}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-white line-clamp-1">{ticket.subject}</h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{ticket.description}</p>
                </div>

                <div className="text-[11px] text-zinc-500 space-y-1 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div>Cliente: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ticket.customerName}</span></div>
                  {ticket.orderNumber && <div>N° Pedido: <span className="font-mono">{ticket.orderNumber}</span></div>}
                  <div>Motivo: <span className="font-semibold">{ticket.reason}</span> | Prioridad: <span className="font-semibold">{ticket.priority}</span></div>
                </div>

                {/* Actions */}
                <div className="pt-1 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {ticket.status !== 'resolved' && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, 'resolved', 'Resuelto por equipo de soporte')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Resolver
                      </button>
                    )}
                    {ticket.status === 'open' && (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, 'in_progress')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium"
                      >
                        En Gestión
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. FAQS / KNOWLEDGE BASE SUBTAB */}
      {activeSubTab === 'faqs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* FAQ Form */}
          <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-500" />
              {editingFaq ? 'Editar Pregunta Frecuente' : 'Nueva Pregunta Frecuente'}
            </h3>

            <form onSubmit={handleSaveFaq} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Categoría
                </label>
                <select
                  value={faqCategory}
                  onChange={(e) => setFaqCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                >
                  <option value="envios">Envíos y Entregas</option>
                  <option value="pagos">Medios de Pago</option>
                  <option value="productos">Garantía y Productos</option>
                  <option value="pedidos">Pedidos y Seguimiento</option>
                  <option value="general">General</option>
                  <option value="ayuda">Ayuda y Soporte</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Pregunta / Consulta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ¿Cuáles son las zonas de entrega en Córdoba?"
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Respuesta oficial del Asistente *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Redacta la respuesta clara que brindará el asistente a los clientes..."
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg font-medium shadow-xs"
                >
                  {editingFaq ? 'Guardar Cambios' : 'Agregar a la Base de Datos'}
                </button>
                {editingFaq && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFaq(null);
                      setFaqQuestion('');
                      setFaqAnswer('');
                    }}
                    className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 rounded-lg"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* FAQs List */}
          <div className="lg:col-span-7 space-y-3">
            {faqs.map(faq => (
              <div
                key={faq.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {faq.category.toUpperCase()}
                    </span>
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white mt-1">{faq.question}</h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditFaqClick(faq)}
                      className="p-1.5 text-zinc-400 hover:text-cyan-500 rounded-lg"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteFAQ(faq.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. UNRESOLVED QUERIES SUBTAB */}
      {activeSubTab === 'unresolved' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <p className="font-bold">Mejora continua del Asistente</p>
              <p>
                Aquí se registran las preguntas de usuarios que tuvieron baja confianza o requirieron atención humana. Puedes responderlas y guardarlas automáticamente como Preguntas Frecuentes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unresolvedQueries.map(item => (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-500">Canal: {item.channel.toUpperCase()}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl text-xs font-semibold text-zinc-900 dark:text-white">
                  "{item.rawQuery}"
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  {item.status === 'pending' && (
                    <button
                      onClick={() => {
                        const ans = window.prompt(`Ingresa la respuesta oficial para: "${item.rawQuery}"`);
                        if (ans) {
                          resolveUnresolvedQuery(item.id, ans, true);
                        }
                      }}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Responder y Crear FAQ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. WHATSAPP BUSINESS API READINESS */}
      {activeSubTab === 'whatsapp' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-zinc-900 dark:text-white">Integración Oficial WhatsApp Business API</h3>
              <p className="text-xs text-zinc-500">Arquitectura lista y probada para Meta Cloud API / WhatsApp Cloud API</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
              <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Endpoints Oficiales Activos en el Backend:
              </div>
              <div className="font-mono bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-lg text-[11px] text-zinc-700 dark:text-zinc-300">
                GET /api/whatsapp/webhook (Meta Hub Verification Token: VONDRO_WHATSAPP_VERIFY_TOKEN_2026)
              </div>
              <div className="font-mono bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-lg text-[11px] text-zinc-700 dark:text-zinc-300">
                POST /api/whatsapp/webhook (Recepción de mensajes entrantes)
              </div>
            </div>

            <div className="space-y-2 text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <h4 className="font-bold text-zinc-900 dark:text-white">Pasos para activar con tu número oficial de VONDRO:</h4>
              <ol className="list-decimal list-inside space-y-1.5 pl-2">
                <li>Crear cuenta en <strong>developers.facebook.com</strong> y dar de alta la app de WhatsApp Business.</li>
                <li>Configurar la Webhook URL apuntando a <code>https://tu-dominio.com/api/whatsapp/webhook</code>.</li>
                <li>Ingresar el Verify Token: <code>VONDRO_WHATSAPP_VERIFY_TOKEN_2026</code>.</li>
                <li>Suscribirse al evento <code>messages</code>.</li>
                <li>Todas las consultas entrantes se procesarán con la misma inteligencia, catálogo público y tickets unificados.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
