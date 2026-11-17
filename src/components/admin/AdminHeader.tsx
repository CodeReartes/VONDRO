import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Bell, 
  ShieldCheck, 
  Store, 
  ExternalLink, 
  Check, 
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  X,
  MessageSquare,
  Boxes
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { triggerHaptic } from '../../utils/native';
import {
  getEffectiveMetricsResetMs,
  isOrderAfterMetricsBaseline,
  isPendingOrderStatus
} from '../../utils/metricsBaseline';

interface AdminHeaderProps {
  activeTab: string;
  onSelectTab: (tab: any) => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ activeTab, onSelectTab }) => {
  const { 
    setActiveTab, 
    unreadNotificationsCount, 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead,
    user,
    products,
    orders,
    settings,
    conversations,
    setCurrentConversationId
  } = useStore();

  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        const toggleBtn = document.getElementById('admin-btn-notifications-toggle');
        if (toggleBtn && !toggleBtn.contains(event.target as Node)) {
          setShowNotificationsPopover(false);
        }
      }
    };
    if (showNotificationsPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationsPopover]);

  const lowStockCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if ((p.stock <= (p.minimumStock || 3)) || p.stockStatus === 'out_of_stock') count++;
    }
    return count;
  }, [products]);

  const metricsResetMs = useMemo(() => getEffectiveMetricsResetMs(settings), [settings?.metricsResetAt]);
  const pendingOrdersCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (isOrderAfterMetricsBaseline(o, metricsResetMs) && isPendingOrderStatus(o.status)) count++;
    }
    return count;
  }, [orders, metricsResetMs]);

  const handleNotificationSelect = (n: any) => {
    triggerHaptic();
    if (!n.read) markNotificationRead(n.id);
    setShowNotificationsPopover(false);

    const typeStr = (n.type || '').toUpperCase();
    const titleStr = (n.title || '').toLowerCase();
    const msgStr = (n.message || '').toLowerCase();

    const isAdvisor = 
      typeStr.includes('ASSISTANT') ||
      typeStr.includes('ADVISOR') ||
      typeStr.includes('AGENT') ||
      typeStr.includes('TICKET') ||
      n.entityType === 'conversation' ||
      n.entityType === 'ticket' ||
      titleStr.includes('asesor') ||
      titleStr.includes('chat') ||
      msgStr.includes('asesor') ||
      msgStr.includes('chat');

    if (isAdvisor) {
      if (n.entityId) {
        setCurrentConversationId(n.entityId);
      } else {
        const matchingConv = (conversations || []).find(c => 
          (n.message && n.message.toLowerCase().includes(c.customerName?.toLowerCase() || '')) ||
          c.customerName?.toLowerCase().includes('juan')
        );
        if (matchingConv) {
          setCurrentConversationId(matchingConv.id);
        } else if (conversations && conversations.length > 0) {
          setCurrentConversationId(conversations[0].id);
        }
      }
      onSelectTab('assistant');
    } else if (n.type?.includes('STOCK')) {
      onSelectTab('stock');
    } else if (n.type?.includes('ORDER') || n.type?.includes('PAYMENT')) {
      onSelectTab('preparation');
    } else {
      onSelectTab('alerts');
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-slate-800/80 text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Mode */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <button
              id="admin-btn-back-to-store"
              onClick={() => {
                triggerHaptic();
                setActiveTab('home');
              }}
              className="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all border border-slate-700/80 shadow-sm shrink-0"
              title="Volver a la tienda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-black text-white text-xs shadow-md shadow-purple-900/30 shrink-0">
                V
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-white">VONDRO</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  Admin
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Icons & Badges */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Quick stock warning badge if any */}
            {lowStockCount > 0 && (
              <button
                id="admin-badge-low-stock-quick"
                onClick={() => {
                  triggerHaptic();
                  onSelectTab('stock');
                }}
                className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                title={`${lowStockCount} productos con stock crítico`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{lowStockCount} stock bajo</span>
              </button>
            )}

            {/* Notifications Bell */}
            <div className="relative">
              <button
                id="admin-btn-notifications-toggle"
                onClick={() => {
                  triggerHaptic();
                  setShowNotificationsPopover(!showNotificationsPopover);
                }}
                className="relative w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700/80 focus:outline-hidden"
                title="Alertas y Notificaciones"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 ? (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
                ) : (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500/70" />
                )}
              </button>

              {/* Notifications Popover with backdrop */}
              {showNotificationsPopover && (
                <>
                  {/* Mobile backdrop */}
                  <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 sm:hidden"
                    onClick={() => setShowNotificationsPopover(false)}
                  />

                  <div 
                    ref={popoverRef}
                    id="admin-notifications-popover"
                    className="fixed sm:absolute right-3 left-3 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2 sm:w-[400px] max-w-md rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl p-4 z-50 text-slate-200 ring-1 ring-white/10"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-500/30">
                          <Bell className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-white block">Alertas Operativas</span>
                          <span className="text-[10px] text-slate-400">
                            {unreadNotificationsCount > 0 ? `${unreadNotificationsCount} alertas sin leer` : 'Todo al día'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadNotificationsCount > 0 && (
                          <button
                            onClick={() => {
                              triggerHaptic();
                              markAllNotificationsRead();
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 font-medium hover:underline"
                          >
                            Leídas
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotificationsPopover(false)}
                          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          <Check className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-80" />
                          No hay alertas pendientes. Todo en orden.
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => {
                          const isAdvisor = 
                            n.type?.includes('ASSISTANT') ||
                            n.type?.includes('ADVISOR') ||
                            n.type?.includes('AGENT') ||
                            n.title?.toLowerCase().includes('asesor') ||
                            n.message?.toLowerCase().includes('asesor') ||
                            n.title?.toLowerCase().includes('chat');

                          return (
                            <div
                              key={n.id}
                              onClick={() => handleNotificationSelect(n)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                n.read 
                                  ? 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:border-slate-700' 
                                  : isAdvisor
                                    ? 'bg-purple-950/30 border-purple-500/50 text-slate-100 shadow-sm hover:border-purple-400 ring-1 ring-purple-500/20'
                                    : 'bg-slate-800/90 border-slate-700 text-slate-100 shadow-sm hover:border-purple-400'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center space-x-1.5">
                                  {isAdvisor ? (
                                    <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  ) : n.type?.includes('STOCK') ? (
                                    <Boxes className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  ) : (
                                    <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  )}
                                  <span className="font-semibold text-slate-100">{n.title}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                  n.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                                  n.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-slate-700 text-slate-300'
                                }`}>
                                  {n.priority}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-300 line-clamp-2 leading-relaxed">{n.message}</p>
                              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                                <span>
                                  {new Date(n.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-purple-400 font-medium hover:underline">
                                  {isAdvisor ? 'Atender chat →' : 'Ver detalle →'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800 text-center">
                      <button
                        onClick={() => {
                          setShowNotificationsPopover(false);
                          onSelectTab('alerts');
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center justify-center gap-1 mx-auto"
                      >
                        <span>Ver todas las alertas operativas</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Admin User Chip */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800 text-xs">
              <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center font-bold text-purple-300">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="font-medium text-xs text-slate-200 truncate max-w-[120px]">{user?.name || 'Administrador'}</p>
                <p className="text-[10px] text-slate-400">Córdoba, AR</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
