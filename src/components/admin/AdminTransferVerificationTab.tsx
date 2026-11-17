import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Bot, 
  Sparkles, 
  Upload, 
  Search, 
  Filter, 
  Check, 
  X, 
  MessageSquare, 
  FileText, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  DollarSign,
  Shield,
  AlertOctagon,
  Image as ImageIcon,
  FileCheck2
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { auth } from '../../lib/firebase';
import { Order, OrderStatus } from '../../types';
import { parseReceiptText, matchReceiptWithOrders, VerificationResult, auditReceiptWithAI, ReceiptAuditResult } from '../../utils/transferBot';
import { triggerHaptic } from '../../utils/native';

export const AdminTransferVerificationTab: React.FC = () => {
  const { orders, updateOrderStatus, updateSettings, settings } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Bot Verification State
  const [botTab, setBotTab] = useState<'image' | 'text'>('image');
  const [botInputText, setBotInputText] = useState('');
  const [uploadedReceiptImage, setUploadedReceiptImage] = useState<string | null>(null);
  const [uploadedReceiptName, setUploadedReceiptName] = useState<string | null>(null);
  const [isAnalyzingBot, setIsAnalyzingBot] = useState(false);
  const [botAnalysisResult, setBotAnalysisResult] = useState<VerificationResult | null>(null);
  const [botAuditResult, setBotAuditResult] = useState<ReceiptAuditResult | null>(null);

  // Order Audit Modal State
  const [auditModalOrder, setAuditModalOrder] = useState<Order | null>(null);
  const [orderAuditResult, setOrderAuditResult] = useState<ReceiptAuditResult | null>(null);
  const [isAuditingOrder, setIsAuditingOrder] = useState(false);

  // Manual Transfer Details Modal/Form State
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [opNumberInput, setOpNumberInput] = useState('');
  const [payerNameInput, setPayerNameInput] = useState('');
  const [bankOriginInput, setBankOriginInput] = useState('Mercado Pago');
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);

  // Success toast state
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // Image Upload handler for Bot Anti-Fraud Inspection
  const handleBotImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic('selection');
    setUploadedReceiptName(file.name);
    setIsAnalyzingBot(true);
    setBotAuditResult(null);
    setBotAnalysisResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUploadedReceiptImage(base64);

      try {
        const audit = await auditReceiptWithAI({
          receiptImage: base64,
          pendingOrders
        });
        setBotAuditResult(audit);

        // Also match with pending orders
        const extracted = {
          amount: audit.extracted?.amount,
          payerName: audit.extracted?.payerName,
          operationNumber: audit.extracted?.operationNumber,
          bankOrigin: audit.extracted?.bankOrigin,
          transferDate: audit.extracted?.transferDate
        };
        const matchResult = matchReceiptWithOrders(extracted, pendingOrders);
        setBotAnalysisResult(matchResult);
        triggerHaptic('success');
      } catch (err) {
        console.error('Error auditing receipt image:', err);
      } finally {
        setIsAnalyzingBot(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Audit specific order receipt
  const handleOpenOrderAuditModal = async (order: Order) => {
    triggerHaptic('selection');
    setAuditModalOrder(order);
    setOrderAuditResult(null);
    setIsAuditingOrder(true);

    try {
      const audit = await auditReceiptWithAI({
        receiptImage: order.transferReceiptImage,
        receiptText: order.transferOperationNumber ? `Op: ${order.transferOperationNumber}, Monto: ${order.total}` : undefined,
        orderTotal: order.total,
        orderNumber: order.orderNumber,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`
      });
      setOrderAuditResult(audit);
      triggerHaptic('success');
    } catch (err) {
      console.error('Error auditing order receipt:', err);
    } finally {
      setIsAuditingOrder(false);
    }
  };

  // Filter transfer orders
  const transferOrders = orders.filter(o => o.paymentMethod === 'bank_transfer');
  
  const filteredOrders = transferOrders.filter(order => {
    const matchesFilter = 
      statusFilter === 'all' ? true :
      statusFilter === 'pending' ? order.paymentStatus === 'pending' :
      statusFilter === 'approved' ? order.paymentStatus === 'approved' :
      order.paymentStatus === 'rejected';

    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      order.orderNumber.toLowerCase().includes(q) ||
      `${order.customer.firstName} ${order.customer.lastName}`.toLowerCase().includes(q) ||
      order.customer.email.toLowerCase().includes(q) ||
      (order.transferOperationNumber && order.transferOperationNumber.toLowerCase().includes(q)) ||
      (order.transferPayerName && order.transferPayerName.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  // Calculate quick metrics
  const pendingOrders = transferOrders.filter(o => o.paymentStatus === 'pending');
  const pendingTotalAmount = pendingOrders.reduce((sum, o) => sum + o.total, 0);
  const approvedTodayCount = transferOrders.filter(o => o.paymentStatus === 'approved').length;
  const approvedTodayTotal = transferOrders.filter(o => o.paymentStatus === 'approved').reduce((sum, o) => sum + o.total, 0);

  // Handle Bot Analysis
  const handleRunBotAnalysis = async () => {
    if (!botInputText.trim()) return;
    triggerHaptic();
    setIsAnalyzingBot(true);

    try {
      // 1. Try server endpoint
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/admin/verify-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ receiptText: botInputText, pendingOrders })
      });
      const data = await res.json();

      let extractedData = parseReceiptText(botInputText);
      if (data.success && data.extracted) {
        extractedData = {
          ...extractedData,
          amount: data.extracted.amount || extractedData.amount,
          payerName: data.extracted.payerName || extractedData.payerName,
          operationNumber: data.extracted.operationNumber || extractedData.operationNumber,
          bankOrigin: data.extracted.bankOrigin || extractedData.bankOrigin,
          transferDate: data.extracted.transferDate || extractedData.transferDate
        };
      }

      const matchResult = matchReceiptWithOrders(extractedData, pendingOrders);
      setBotAnalysisResult(matchResult);
    } catch (err) {
      console.warn('Falling back to local bot matching:', err);
      const extractedData = parseReceiptText(botInputText);
      const matchResult = matchReceiptWithOrders(extractedData, pendingOrders);
      setBotAnalysisResult(matchResult);
    } finally {
      setIsAnalyzingBot(false);
    }
  };

  // Sample receipt loader for 1-click test
  const loadSampleReceipt = () => {
    triggerHaptic();
    const targetOrder = pendingOrders[0] || transferOrders[0];
    const sampleAmount = targetOrder ? targetOrder.total : 23380;
    const sampleName = targetOrder ? `${targetOrder.customer.firstName} ${targetOrder.customer.lastName}` : 'Carlos Gómez';
    const sampleOp = `OP-${Math.floor(100000 + Math.random() * 900000)}`;

    setBotInputText(`MERCADO PAGO
Comprobante de Transferencia
Monto: $ ${sampleAmount.toLocaleString('es-AR')}
De: ${sampleName}
Para: VONDRO CORDOBA
CoFi / CBU: 000000310009481920
N° de Operación: ${sampleOp}
Fecha: ${new Date().toLocaleDateString('es-AR')} - 14:25 hs`);
  };

  // Action: Approve Transfer
  const handleApproveTransfer = async (order: Order, customNotes?: string) => {
    triggerHaptic();
    try {
      // Update order status to payment_received & approved
      await updateOrderStatus(
        order.id, 
        'payment_received', 
        customNotes || `Transferencia bancaria aprobada manualmente por administrador. Monto: $${order.total.toLocaleString('es-AR')}`
      );
      showNotification(`✅ Pago por Transferencia Aprobado para la Orden ${order.orderNumber}`);
      if (botAnalysisResult?.matchedOrder?.id === order.id) {
        setBotAnalysisResult(null);
        setBotInputText('');
      }
    } catch (err) {
      console.error('Error approving transfer:', err);
    }
  };

  // Action: Reject Transfer
  const handleRejectTransfer = async (orderId: string) => {
    triggerHaptic();
    if (!rejectReasonInput.trim()) return;
    const targetOrder = orders.find(o => o.id === orderId);
    try {
      await updateOrderStatus(
        orderId, 
        'pending_payment', 
        `🔴 Transferencia Reclamada / Rechazada: ${rejectReasonInput}`,
        { paymentStatus: 'rejected' }
      );
      showNotification(`Transferencia rechazada en orden ${targetOrder?.orderNumber || orderId}`);
      setRejectingOrderId(null);
      setRejectReasonInput('');
    } catch (err) {
      console.error('Error rejecting transfer:', err);
    }
  };

  // Save manual transfer reference to order
  const handleSaveTransferDetails = (order: Order) => {
    triggerHaptic();
    order.transferOperationNumber = opNumberInput || order.transferOperationNumber;
    order.transferPayerName = payerNameInput || order.transferPayerName;
    order.transferBankOrigin = bankOriginInput || order.transferBankOrigin;
    showNotification(`Datos de comprobante guardados para orden ${order.orderNumber}`);
    setEditingOrderId(null);
  };

  // WhatsApp Link Helper
  const getWhatsAppLink = (order: Order, type: 'approve' | 'claim') => {
    const cleanPhone = order.customer.phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.startsWith('549') ? cleanPhone : `549${cleanPhone}`;
    let msg = '';
    if (type === 'approve') {
      msg = `Hola ${order.customer.firstName}! 👋 Te confirmamos que recibimos y validamos correctamente tu *Transferencia Bancaria* por $${order.total.toLocaleString('es-AR')} para tu *Pedido ${order.orderNumber}* en VONDRO 🛍️. Tu compra pasa ahora a embalaje y preparación. Muchas gracias!`;
    } else {
      msg = `Hola ${order.customer.firstName}! 👋 Te contactamos de VONDRO por tu *Pedido ${order.orderNumber}*. Vimos que seleccionaste Transferencia Bancaria pero aún no pudimos validar el comprobante. Por favor reenvianos la captura del pago por este medio para despacharte el pedido. ¡Muchas gracias!`;
    }
    return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold text-sm">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 border border-purple-500/20 rounded-2xl p-5 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                <Building2 className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">Verificación de Transferencias Bancarias</h2>
            </div>
            <p className="mt-1 text-xs text-slate-300 max-w-2xl">
              Controlá las transferencias recibidas en tu CBU/Alias. Usá el **Bot Verificador IA** para matchear comprobantes de MercadoPago y bancos en segundos.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-700 text-xs">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">CBU / Alias VONDRO</p>
              <p className="font-mono font-bold text-purple-300">VONDRO.CORDOBA</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText('VONDRO.CORDOBA');
                showNotification('Alias VONDRO.CORDOBA copiado al portapapeles');
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Copiar Alias"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between text-amber-400">
              <span className="text-[11px] font-medium">Pendientes Verificación</span>
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-xl font-black text-white mt-1">{pendingOrders.length} <span className="text-xs font-normal text-amber-300">pedidos</span></p>
            <p className="text-[10px] text-amber-200/80">$ {pendingTotalAmount.toLocaleString('es-AR')}</p>
          </div>

          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[11px] font-medium">Aprobadas</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xl font-black text-white mt-1">{approvedTodayCount} <span className="text-xs font-normal text-emerald-300">validadas</span></p>
            <p className="text-[10px] text-emerald-200/80">$ {approvedTodayTotal.toLocaleString('es-AR')}</p>
          </div>

          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between text-cyan-400">
              <span className="text-[11px] font-medium">Bot Verificador IA</span>
              <Bot className="w-4 h-4" />
            </div>
            <p className="text-xl font-black text-white mt-1">Activo ⚡</p>
            <p className="text-[10px] text-cyan-200/80">Reconocimiento OCR & Match</p>
          </div>

          <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between text-purple-400">
              <span className="text-[11px] font-medium">Comisión MP</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <p className="text-xl font-black text-emerald-400 mt-1">0% <span className="text-xs font-normal text-slate-300">Directo</span></p>
            <p className="text-[10px] text-purple-200/80">Sin intermediarios</p>
          </div>
        </div>
      </div>

      {/* 🤖 BOT VERIFICADOR VONDRO IA & AUDITORÍA ANTI-FRAUDE */}
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-xl text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-purple-600 text-white shadow-lg">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Auditoría IA & Bot Anti-Fraude de Transferencias
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] border border-cyan-500/30 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" />
                  Anti-Estafa Activo
                </span>
              </h3>
              <p className="text-xs text-slate-400">Subí la foto del comprobante o pegá el texto para verificar autenticidad, CBU/Alias y monto transferido.</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setBotTab('image')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                botTab === 'image' ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Foto / Captura</span>
            </button>
            <button
              onClick={() => setBotTab('text')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                botTab === 'text' ? 'bg-purple-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Texto / Extracto</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-3">
            {botTab === 'image' ? (
              <div className="space-y-3">
                <label className="border-2 border-dashed border-purple-500/40 hover:border-purple-400/80 bg-slate-950/70 hover:bg-slate-950 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBotImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {uploadedReceiptImage ? (
                    <div className="flex items-center gap-3 w-full">
                      <img 
                        src={uploadedReceiptImage} 
                        alt="Comprobante" 
                        className="w-16 h-16 object-cover rounded-xl border border-purple-500/40 shrink-0" 
                      />
                      <div className="text-left min-w-0 flex-1">
                        <span className="text-xs font-bold text-white block truncate">{uploadedReceiptName || 'Comprobante cargado'}</span>
                        <span className="text-[10.5px] text-purple-300 flex items-center gap-1 mt-0.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Listo para análisis multimodal IA
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Tocar para cambiar imagen</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-white">Subir captura del comprobante</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Detecta comprobantes truchos, montos y cuenta de destino con IA</p>
                    </>
                  )}
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    value={botInputText}
                    onChange={(e) => setBotInputText(e.target.value)}
                    placeholder="Pegá aquí el texto del comprobante recibido por WhatsApp o extracto bancario (ej: Monto $144.000, De: Diego Reartes, N° Op: 198402, Para: VONDRO CORDOBA)..."
                    rows={4}
                    className="w-full bg-slate-950/90 border border-slate-700 focus:border-purple-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                  />
                  <button
                    onClick={() => setBotInputText('')}
                    className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 text-xs"
                    title="Limpiar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={loadSampleReceipt}
                    className="text-xs text-purple-400 underline font-medium"
                  >
                    Probar comprobante demo ($144.000)
                  </button>

                  <button
                    onClick={handleRunBotAnalysis}
                    disabled={!botInputText.trim() || isAnalyzingBot}
                    className={`ml-auto px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      isAnalyzingBot 
                        ? 'bg-purple-800 text-purple-200 cursor-wait' 
                        : botInputText.trim() 
                          ? 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-lg shadow-purple-900/30' 
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isAnalyzingBot ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                        <span>Analizando con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Verificar con Bot IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bot & Anti-Fraud Result Panel */}
          <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
            {isAnalyzingBot ? (
              <div className="py-8 text-center text-cyan-300 text-xs space-y-2 my-auto">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-cyan-400" />
                <p className="font-bold">Analizando autenticidad y datos bancarios...</p>
                <p className="text-[10.5px] text-slate-400">Verificando tipografía, emisor, CBU y Coelsa ID</p>
              </div>
            ) : botAuditResult ? (
              <div className="space-y-3 animate-fadeIn">
                {/* Anti-Fraud Banner */}
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  botAuditResult.fraudRisk === 'LOW' && botAuditResult.isAuthentic
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : botAuditResult.fraudRisk === 'HIGH'
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                }`}>
                  {botAuditResult.fraudRisk === 'LOW' && botAuditResult.isAuthentic ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs">
                    <span className="font-extrabold block">
                      {botAuditResult.fraudRisk === 'LOW' && botAuditResult.isAuthentic
                        ? `🛡️ Comprobante Auténtico (${botAuditResult.confidenceScore}% Confianza)`
                        : botAuditResult.fraudRisk === 'HIGH'
                        ? '🚨 ALERTA: Posible Comprobante Falso o Editado'
                        : '⚠️ Comprobante con Datos Incompletos'}
                    </span>
                    <p className="text-[11px] opacity-90 mt-0.5">{botAuditResult.summary}</p>
                  </div>
                </div>

                {/* Extracted Details */}
                <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-2.5 text-[11px] space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monto Transferido:</span>
                    <strong className="text-white font-mono">${(botAuditResult.extracted?.amount || 0).toLocaleString('es-AR')}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Titular Emisor:</span>
                    <span className="text-slate-200 font-semibold">{botAuditResult.extracted?.payerName || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Banco / Billetera:</span>
                    <span className="text-purple-300 font-semibold">{botAuditResult.extracted?.bankOrigin || 'Mercado Pago'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">N° de Operación:</span>
                    <span className="font-mono text-slate-300">{botAuditResult.extracted?.operationNumber || 'N/A'}</span>
                  </div>
                </div>

                {/* Match with pending order if available */}
                {botAnalysisResult?.matchedOrder && (
                  <div className="p-3 bg-purple-950/60 border border-purple-500/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-purple-300">Orden #{botAnalysisResult.matchedOrder.orderNumber}</span>
                      <span className="font-black text-white">${botAnalysisResult.matchedOrder.total.toLocaleString('es-AR')}</span>
                    </div>
                    <button
                      onClick={() => handleApproveTransfer(botAnalysisResult.matchedOrder!, `Aprobado por Auditoría IA Anti-Fraude (${botAuditResult.confidenceScore}% Confianza - Op: ${botAuditResult.extracted?.operationNumber || 'N/A'})`)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprobar y Autorizar Pago Automáticamente</span>
                    </button>
                  </div>
                )}
              </div>
            ) : botAnalysisResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Resultado del Análisis:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                    botAnalysisResult.score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                    botAnalysisResult.score >= 50 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                    'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    {botAnalysisResult.score}% Coincidencia
                  </span>
                </div>

                {botAnalysisResult.matchedOrder ? (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-purple-300">
                        Orden #{botAnalysisResult.matchedOrder.orderNumber}
                      </span>
                      <span className="text-xs font-bold text-white">
                        $ {botAnalysisResult.matchedOrder.total.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      <strong>Cliente:</strong> {botAnalysisResult.matchedOrder.customer.firstName} {botAnalysisResult.matchedOrder.customer.lastName}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono">
                      {botAnalysisResult.notes}
                    </p>
                    <button
                      onClick={() => handleApproveTransfer(botAnalysisResult.matchedOrder!, `Aprobado vía Bot Verificador IA (${botAnalysisResult.score}% Match)`)}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprobar Pago en 1 Clic</span>
                    </button>
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 text-xs">
                    <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2 opacity-80" />
                    No se encontró ningún pedido pendiente de pago que coincida con este comprobante.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs my-auto">
                <ShieldCheck className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                Subí una captura o pegá el texto para auditar la transferencia contra fraudes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pendientes ({pendingOrders.length})</span>
          </button>

          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Aprobadas ({transferOrders.filter(o => o.paymentStatus === 'approved').length})</span>
          </button>

          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
              statusFilter === 'rejected'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Rechazadas ({transferOrders.filter(o => o.paymentStatus === 'rejected').length})</span>
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas ({transferOrders.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por orden, cliente, op..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-xs">
            <ShieldCheck className="w-12 h-12 mx-auto text-slate-700 mb-3 opacity-80" />
            No se encontraron transferencias con los filtros seleccionados.
          </div>
        ) : (
          filteredOrders.map(order => {
            const isApproved = order.paymentStatus === 'approved';
            const isRejected = order.paymentStatus === 'rejected';

            return (
              <div 
                key={order.id}
                className={`bg-slate-900 border rounded-2xl p-4 shadow-md transition-all ${
                  isApproved ? 'border-emerald-500/30' :
                  isRejected ? 'border-rose-500/30' :
                  'border-amber-500/40 hover:border-amber-500/70'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Info */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-white">{order.orderNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isApproved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        isRejected ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                        'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                      }`}>
                        {isApproved ? '🟢 PAGO APROBADO' : isRejected ? '🔴 RECLAMADO / RECHAZADO' : '🟡 PENDIENTE VERIFICACIÓN'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-300">
                      <span className="font-semibold text-purple-300">
                        {order.customer.firstName} {order.customer.lastName}
                      </span>
                      <span>•</span>
                      <span className="text-slate-400">{order.customer.phone}</span>
                      <span>•</span>
                      <span className="text-slate-400">{order.customer.city}</span>
                    </div>

                    <div className="text-xs text-slate-400 pt-1">
                      {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>
                  </div>

                  {/* Right Amount & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-400">Total a Transferir</p>
                      <p className="text-xl font-black text-white">$ {order.total.toLocaleString('es-AR')}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2">
                      {!isApproved && (
                        <button
                          onClick={() => handleApproveTransfer(order)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprobar Pago</span>
                        </button>
                      )}

                      {!isApproved && !isRejected && (
                        <button
                          onClick={() => setRejectingOrderId(order.id)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-xs font-bold transition-colors"
                          title="Reclamar o Rechazar"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}

                      <a
                        href={getWhatsAppLink(order, isApproved ? 'approve' : 'claim')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 transition-colors"
                        title="Contactar por WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Transfer Details Card Breakdown */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                  <div className="flex items-center flex-wrap gap-3">
                    <span><strong>N° Operación:</strong> {order.transferOperationNumber || <span className="text-slate-500">Pendiente</span>}</span>
                    <span><strong>Titular:</strong> {order.transferPayerName || <span className="text-slate-500">{order.customer.firstName} {order.customer.lastName}</span>}</span>
                    <span><strong>Banco:</strong> {order.transferBankOrigin || 'Mercado Pago'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.transferReceiptImage && (
                      <button
                        onClick={() => handleOpenOrderAuditModal(order)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>🛡️ Auditar Comprobante (IA)</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingOrderId(order.id);
                        setOpNumberInput(order.transferOperationNumber || '');
                        setPayerNameInput(order.transferPayerName || `${order.customer.firstName} ${order.customer.lastName}`);
                        setBankOriginInput(order.transferBankOrigin || 'Mercado Pago');
                      }}
                      className="text-[11px] text-purple-400 hover:text-purple-300 underline font-medium"
                    >
                      ✏️ Cargar/Editar datos
                    </button>
                  </div>
                </div>

                {/* Inline Edit Details Form */}
                {editingOrderId === order.id && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-700 space-y-3">
                    <p className="text-xs font-bold text-slate-200">Ingresar o editar datos del comprobante recibido:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="N° de Operación (ej: 198402)"
                        value={opNumberInput}
                        onChange={(e) => setOpNumberInput(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="text"
                        placeholder="Nombre Titular Pagador"
                        value={payerNameInput}
                        onChange={(e) => setPayerNameInput(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
                      />
                      <select
                        value={bankOriginInput}
                        onChange={(e) => setBankOriginInput(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="Mercado Pago">Mercado Pago</option>
                        <option value="Banco Galicia">Banco Galicia</option>
                        <option value="BBVA">BBVA</option>
                        <option value="Banco Macro">Banco Macro</option>
                        <option value="Santander">Santander</option>
                        <option value="Naranja X">Naranja X</option>
                        <option value="Otro Banco">Otro Banco</option>
                      </select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingOrderId(null)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveTransferDetails(order)}
                        className="px-3 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold"
                      >
                        Guardar Datos
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Reject Reason Form */}
                {rejectingOrderId === order.id && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 space-y-3">
                    <p className="text-xs font-bold text-rose-300">Indicar motivo de reclamo / rechazo:</p>
                    <input
                      type="text"
                      placeholder="Ej: Monto incompleto (faltan $2.000), Comprobante no coincide..."
                      value={rejectReasonInput}
                      onChange={(e) => setRejectReasonInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setRejectingOrderId(null)}
                        className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleRejectTransfer(order.id)}
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold"
                      >
                        Confirmar Reclamo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Modal de Auditoría Inteligente Anti-Fraude de Comprobante */}
      {auditModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-purple-500/30 overflow-hidden flex flex-col max-h-[92vh] animate-scaleIn text-white">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-slate-950 via-purple-950 to-slate-950 border-b border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    Auditoría Anti-Fraude: Orden #{auditModalOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-purple-300">
                    Total: <strong>${auditModalOrder.total.toLocaleString('es-AR')}</strong> · {auditModalOrder.customer.firstName} {auditModalOrder.customer.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditModalOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Image Preview */}
              {auditModalOrder.transferReceiptImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 max-h-64 flex items-center justify-center group">
                  <img 
                    src={auditModalOrder.transferReceiptImage} 
                    alt="Comprobante" 
                    className="max-h-64 object-contain rounded-xl"
                  />
                  <a
                    href={auditModalOrder.transferReceiptImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white font-bold text-[11px] border border-slate-700 flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver tamaño completo</span>
                  </a>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2 opacity-80" />
                  <span>Sin captura de comprobante adjunta.</span>
                </div>
              )}

              {/* AI Audit Verdict */}
              {isAuditingOrder ? (
                <div className="p-6 text-center bg-slate-950 rounded-2xl border border-purple-500/30 space-y-2 text-purple-300">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin text-purple-400" />
                  <p className="font-extrabold text-sm">Examinando comprobante con IA Anti-Fraude...</p>
                  <p className="text-slate-400 text-xs">Validando tipografía, monto de ${auditModalOrder.total.toLocaleString('es-AR')} y cuenta VONDRO.</p>
                </div>
              ) : orderAuditResult ? (
                <div className="space-y-3 animate-fadeIn">
                  {/* Security Banner */}
                  <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                    orderAuditResult.fraudRisk === 'LOW' && orderAuditResult.isAuthentic
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                      : orderAuditResult.fraudRisk === 'HIGH'
                      ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                      : 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                  }`}>
                    {orderAuditResult.fraudRisk === 'LOW' && orderAuditResult.isAuthentic ? (
                      <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
                    )}
                    <div className="space-y-0.5">
                      <h4 className="font-extrabold text-sm">
                        {orderAuditResult.fraudRisk === 'LOW' && orderAuditResult.isAuthentic
                          ? `✅ Comprobante Verificado y Legítimo (${orderAuditResult.confidenceScore}% Confianza)`
                          : orderAuditResult.fraudRisk === 'HIGH'
                          ? '🚨 ALERTA: Posible Comprobante Falso / Editado'
                          : '⚠️ Comprobante con Posibles Inconsistencias'}
                      </h4>
                      <p className="text-[11.5px] opacity-95 leading-relaxed">{orderAuditResult.summary}</p>
                    </div>
                  </div>

                  {/* Audit Details Grid */}
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Monto del comprobante:</span>
                      <span className="font-black text-white font-mono text-sm">
                        ${(orderAuditResult.extracted?.amount || 0).toLocaleString('es-AR')}
                        {orderAuditResult.amountMatch && <span className="ml-1.5 text-emerald-400 text-[11px]">✓ Coincide</span>}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Destinatario:</span>
                      <span className="text-purple-300 font-bold">{orderAuditResult.extracted?.recipientName || 'VONDRO . CORDOBA'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                      <span className="text-slate-400">Banco / Billetera:</span>
                      <span className="text-slate-200 font-semibold">{orderAuditResult.extracted?.bankOrigin || 'Mercado Pago'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                      <span className="text-slate-400">N° de Operación / ID:</span>
                      <span className="font-mono text-cyan-300 font-bold">{orderAuditResult.extracted?.operationNumber || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Titular pagador:</span>
                      <span className="text-slate-200">{orderAuditResult.extracted?.payerName || auditModalOrder.customer.firstName}</span>
                    </div>
                  </div>

                  {/* Technical Reasons */}
                  {orderAuditResult.reasons && orderAuditResult.reasons.length > 0 && (
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <span className="font-bold text-slate-300 block">Puntos auditados:</span>
                      {orderAuditResult.reasons.map((r, ri) => (
                        <div key={ri} className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-purple-400 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setAuditModalOrder(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={async () => {
                  const auditNote = orderAuditResult 
                    ? `Aprobado por Auditoría IA (${orderAuditResult.confidenceScore}% Confianza - Op: ${orderAuditResult.extracted?.operationNumber || 'N/A'})`
                    : undefined;
                  await handleApproveTransfer(auditModalOrder, auditNote);
                  setAuditModalOrder(null);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>✓ Aprobar y Autorizar Pago Automáticamente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
