import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, 
  Package, 
  ShoppingBag, 
  Truck, 
  Users, 
  Settings, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  ArrowLeft, 
  Check, 
  DollarSign, 
  Percent, 
  MessageCircle, 
  Phone, 
  Calendar, 
  Tag, 
  RotateCcw,
  Sparkles,
  TrendingUp,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  X,
  Smartphone,
  Copy,
  Terminal,
  Layers,
  Vibrate,
  Boxes,
  Bell,
  FileSpreadsheet,
  CheckSquare,
  Building2,
  Bot,
  Upload,
  Landmark,
  Zap,
  Image as ImageIcon,
  Link as LinkIcon,
  Camera,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Home,
  ClipboardList,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { auth } from '../../lib/firebase';
import { Order, OrderStatus, Product, ProductVariant, ShippingZone, StockStatus } from '../../types';
import { triggerHaptic } from '../../utils/native';
import { AdminHeader } from './AdminHeader';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminPreparationTab } from './AdminPreparationTab';
import { AdminTransferVerificationTab } from './AdminTransferVerificationTab';
import { AdminStockTab } from './AdminStockTab';
import { AdminStockAuditTab } from './AdminStockAuditTab';
import { AdminSuppliersTab } from './AdminSuppliersTab';
import { AdminBulkImportTab } from './AdminBulkImportTab';
import { AdminAlertsTab } from './AdminAlertsTab';
import { LogisticsDashboard } from './LogisticsDashboard';
import { AdminInovaSourcingTab } from './AdminInovaSourcingTab';
import { AssistantManagementTab } from '../Admin/AssistantManagementTab';
import { AdminAbandonedCartsTab } from './AdminAbandonedCartsTab';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminFlashDealsTab } from './AdminFlashDealsTab';
import { ProductImagePicker } from './ProductImagePicker';
import { compressProductImage } from '../../utils/imageCompressor';
import { formatCategoryName } from '../../utils/textUtils';
import {
  getEffectiveMetricsResetMs,
  isOrderAfterMetricsBaseline,
  isPendingOrderStatus
} from '../../utils/metricsBaseline';

const ADMIN_TAB_SESSION_KEY = 'vondro_admin_tab_session';

type AdminTab = 
  | 'dashboard' 
  | 'transfers'
  | 'flash-deals'
  | 'preparation' 
  | 'logistics'
  | 'users'
  | 'stock' 
  | 'stock-audit'
  | 'sourcing'
  | 'suppliers' 
  | 'assistant'
  | 'abandoned-carts'
  | 'bulk-import' 
  | 'alerts' 
  | 'products' 
  | 'orders' 
  | 'shipping' 
  | 'coupons' 
  | 'settings' 
  | 'android';

export const AdminDashboard: React.FC = () => {
  const { 
    products, 
    categories, 
    orders, 
    registeredUsers = [],
    shippingZones, 
    settings, 
    suppliers,
    stockMovements,
    notifications,
    unreadNotificationsCount,
    latestDailyAudit,
    isSyncingFirestoreStock,
    syncInovaAndApiProductsToFirestore,
    updateSettings,
    updateShippingZone,
    addShippingZone,
    deleteShippingZone,
    addProduct, 
    updateProduct,
    deleteProduct,
    updateCategory,
    deleteCategory,
    syncCategoriesWithInovaCatalog,
    updateStock, 
    updateOrderStatus,
    cancelOrderWithStockRefund,
    coupons,
    addCoupon,
    toggleCouponStatus,
    deleteCoupon,
    setActiveTab,
    setIsAdmin,
    resetAllData
  } = useStore();

  const [activeAdminTab, setActiveAdminTabState] = useState<AdminTab>(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_TAB_SESSION_KEY);
      if (saved) return saved as AdminTab;
    } catch {}
    return 'dashboard';
  });
  const setActiveAdminTab = React.useCallback((tab: AdminTab) => {
    setActiveAdminTabState(tab);
    try {
      sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, tab);
    } catch {}
  }, []);
  const [selectedModule, setSelectedModule] = useState<'all' | 'sales' | 'catalog' | 'logistics' | 'customers' | 'settings'>('all');
  const [tabFilterQuery, setTabFilterQuery] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [productPage, setProductPage] = useState<number>(1);
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const PRODUCTS_PER_PAGE = 25;

  const [orderSearch, setOrderSearch] = useState<string>('');
  const [showArchivedOrders, setShowArchivedOrders] = useState<boolean>(false);
  const [isSyncingCategories, setIsSyncingCategories] = useState<boolean>(false);
  const [categoriesSyncSuccess, setCategoriesSyncSuccess] = useState<string | null>(null);
  const [firestoreSyncMessage, setFirestoreSyncMessage] = useState<string | null>(null);

  // Fast memoized filtered products for zero-lag catalog rendering
  const filteredCatalogProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products.filter(p => {
      if (q) {
        const nameMatch = p.name?.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);
        const catMatch = p.categoryId?.toLowerCase().includes(q);
        if (!nameMatch && !skuMatch && !catMatch) return false;
      }
      if (productCategoryFilter !== 'all' && p.categoryId !== productCategoryFilter) {
        return false;
      }
      if (productStockFilter === 'out_of_stock') {
        return p.stock <= 0 || p.stockStatus === 'out_of_stock';
      }
      if (productStockFilter === 'low_stock') {
        const min = p.minimumStock || 5;
        return p.stock > 0 && p.stock <= min;
      }
      if (productStockFilter === 'in_stock') {
        return p.stock > 0 && p.stockStatus !== 'out_of_stock';
      }
      return true;
    });
  }, [products, productSearch, productCategoryFilter, productStockFilter]);

  const totalCatalogPages = Math.ceil(filteredCatalogProducts.length / PRODUCTS_PER_PAGE) || 1;
  const currentCatalogPage = Math.min(productPage, totalCatalogPages);
  const paginatedCatalogProducts = useMemo(() => {
    const start = (currentCatalogPage - 1) * PRODUCTS_PER_PAGE;
    return filteredCatalogProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [filteredCatalogProducts, currentCatalogPage]);

  // Auto-sync module when active tab is changed externally (e.g., from overview cards or header)
  React.useEffect(() => {
    const salesTabs: AdminTab[] = ['dashboard', 'orders', 'transfers', 'abandoned-carts', 'flash-deals'];
    const catalogTabs: AdminTab[] = ['products', 'stock', 'stock-audit', 'bulk-import', 'sourcing', 'suppliers'];
    const logisticsTabs: AdminTab[] = ['preparation', 'logistics', 'shipping'];
    const customersTabs: AdminTab[] = ['assistant', 'users', 'alerts'];
    const settingsTabs: AdminTab[] = ['settings', 'coupons', 'android'];

    if (selectedModule !== 'all') {
      const currentModuleMatches = 
        (selectedModule === 'sales' && salesTabs.includes(activeAdminTab)) ||
        (selectedModule === 'catalog' && catalogTabs.includes(activeAdminTab)) ||
        (selectedModule === 'logistics' && logisticsTabs.includes(activeAdminTab)) ||
        (selectedModule === 'customers' && customersTabs.includes(activeAdminTab)) ||
        (selectedModule === 'settings' && settingsTabs.includes(activeAdminTab));

      if (!currentModuleMatches) {
        if (salesTabs.includes(activeAdminTab)) setSelectedModule('sales');
        else if (catalogTabs.includes(activeAdminTab)) setSelectedModule('catalog');
        else if (logisticsTabs.includes(activeAdminTab)) setSelectedModule('logistics');
        else if (customersTabs.includes(activeAdminTab)) setSelectedModule('customers');
        else if (settingsTabs.includes(activeAdminTab)) setSelectedModule('settings');
      }
    }
  }, [activeAdminTab, selectedModule]);

  // Auto-sync live Inova / /api/products stock into Firestore whenever Admin enters Catalog, Audit, Stock, or Sourcing tabs
  useEffect(() => {
    if (
      activeAdminTab === 'products' ||
      activeAdminTab === 'stock-audit' ||
      activeAdminTab === 'stock' ||
      activeAdminTab === 'sourcing'
    ) {
      syncInovaAndApiProductsToFirestore({ forceInovaRefresh: false, silent: true }).catch(console.warn);
    }
  }, [activeAdminTab, syncInovaAndApiProductsToFirestore]);

  // Editing Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState<boolean>(false);
  const [productFormData, setProductFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    categoryId: 'accesorios',
    images: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80'],
    costPrice: 5000,
    salePrice: 7990,
    originalPrice: 9990,
    stock: 20,
    stockStatus: 'available',
    hideIfOutOfStock: false,
    description: '',
    shortFeatures: ['Calidad garantizada', 'Diseño moderno'],
    supplier: 'Inova ARG',
    isFeatured: false,
    isOnSale: true,
    isNew: true,
    rating: 5.0,
    reviewCount: 0,
    salesCount: 0,
  });

  // AI URL Extraction State for Products
  const [importUrlInput, setImportUrlInput] = useState<string>('');
  const [isExtractingAi, setIsExtractingAi] = useState<boolean>(false);
  const [aiExtractError, setAiExtractError] = useState<string | null>(null);
  const [aiExtractSuccess, setAiExtractSuccess] = useState<string | null>(null);
  const [showAiImport, setShowAiImport] = useState<boolean>(false);
  const [productFormImageError, setProductFormImageError] = useState<string | null>(null);

  // Variant photo upload helper with client-side compression
  const handleVariantPhotoUpload = async (vIdx: number, file: File) => {
    try {
      const res = await compressProductImage(file, 700, 700, 0.74);
      const updatedVars = [...(productFormData.variants || [])];
      updatedVars[vIdx] = { ...updatedVars[vIdx], imageUrl: res.dataUrl };
      setProductFormData({ ...productFormData, variants: updatedVars });
    } catch {
      alert('No se pudo procesar la imagen de la variante.');
    }
  };

  const scrollToModalSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Shipping threshold state
  const [freeShippingThresholdInput, setFreeShippingThresholdInput] = useState<number>(
    settings.freeShippingThreshold ?? 100000
  );
  const [shippingSavedSuccess, setShippingSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (settings.freeShippingThreshold !== undefined) {
      setFreeShippingThresholdInput(settings.freeShippingThreshold);
    }
  }, [settings.freeShippingThreshold]);

  // Custom Logo URL & File Upload State
  const [customLogoUrlInput, setCustomLogoUrlInput] = useState<string>(settings?.logoUrl || '');
  const [logoSaveSuccess, setLogoSaveSuccess] = useState<boolean>(false);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen de logo no debe superar los 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateSettings({ logoUrl: dataUrl });
        setCustomLogoUrlInput(dataUrl);
        triggerHaptic();
        setLogoSaveSuccess(true);
        setTimeout(() => setLogoSaveSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogoUrl = () => {
    updateSettings({ logoUrl: customLogoUrlInput.trim() });
    triggerHaptic();
    setLogoSaveSuccess(true);
    setTimeout(() => setLogoSaveSuccess(false), 3000);
  };

  const handleRemoveLogo = () => {
    if (confirm('¿Estás seguro de eliminar el logo personalizado? Se restablecerá la cabecera original.')) {
      updateSettings({ logoUrl: '' });
      setCustomLogoUrlInput('');
      triggerHaptic();
      setLogoSaveSuccess(true);
      setTimeout(() => setLogoSaveSuccess(false), 3000);
    }
  };

  // Selected order modal for detail view & fast edit
  const [adminSelectedOrder, setAdminSelectedOrder] = useState<Order | null>(null);
  const [showMoreModulesSheet, setShowMoreModulesSheet] = useState<boolean>(false);

  const metricsResetMs = useMemo(() => getEffectiveMetricsResetMs(settings), [settings?.metricsResetAt]);
  const activeOrders = useMemo(
    () => orders.filter(o => isOrderAfterMetricsBaseline(o, metricsResetMs)),
    [orders, metricsResetMs]
  );

  // Memoized KPIs & badge counts (zero per-render scans)
  const {
    totalSalesRevenue,
    totalCompletedOrders,
    averageTicket,
    totalProductsSold,
    uniqueCustomerEmails,
    pendingOrdersBadgeCount,
    pendingTransfersBadgeCount
  } = useMemo(() => {
    let rev = 0;
    let completed = 0;
    let prodsSold = 0;
    let pendingOrders = 0;
    let pendingTransfers = 0;
    const customerSet = new Set<string>();

    for (let i = 0; i < activeOrders.length; i++) {
      const o = activeOrders[i];
      if (o.status !== 'cancelled') {
        rev += o.total || 0;
        completed++;
      }
      if (Array.isArray(o.items)) {
        for (let j = 0; j < o.items.length; j++) {
          prodsSold += o.items[j]?.quantity || 0;
        }
      }
      const contactKey = o.customer?.email || o.customer?.phone;
      if (contactKey) customerSet.add(contactKey);
      if (isPendingOrderStatus(o.status)) pendingOrders++;
      if (o.paymentMethod === 'bank_transfer' && o.paymentStatus === 'pending') pendingTransfers++;
    }

    return {
      totalSalesRevenue: rev,
      totalCompletedOrders: completed,
      averageTicket: completed > 0 ? Math.round(rev / completed) : 0,
      totalProductsSold: prodsSold,
      uniqueCustomerEmails: customerSet.size,
      pendingOrdersBadgeCount: pendingOrders,
      pendingTransfersBadgeCount: pendingTransfers
    };
  }, [activeOrders]);

  // Margin calculation helper
  const calculateMargin = (cost: number, sale: number) => {
    if (sale <= 0) return { profit: 0, marginPercent: 0 };
    const profit = sale - cost;
    const marginPercent = ((profit / sale) * 100).toFixed(1);
    return { profit, marginPercent };
  };

  const currentMargin = calculateMargin(
    productFormData.costPrice || 0,
    productFormData.salePrice || 0
  );

  // AI Extraction from Product Link
  const handleExtractFromUrl = async () => {
    if (!importUrlInput || !importUrlInput.startsWith('http')) {
      setAiExtractError('Ingresá un enlace válido que comience con http:// o https://');
      return;
    }

    setIsExtractingAi(true);
    setAiExtractError(null);
    setAiExtractSuccess(null);

    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/admin/extract-product-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({ url: importUrlInput })
      });

      const result = await res.json();

      if (result.success && result.data) {
        setProductFormData(prev => ({
          ...prev,
          name: result.data.name || prev.name,
          costPrice: result.data.costPrice || prev.costPrice,
          salePrice: result.data.salePrice || prev.salePrice,
          originalPrice: result.data.originalPrice || prev.originalPrice,
          stock: result.data.stock !== undefined ? result.data.stock : prev.stock,
          supplier: result.data.supplier || 'Inova ARG',
          images: result.data.images && result.data.images.length > 0 ? result.data.images : prev.images,
          description: result.data.description || prev.description,
          shortFeatures: result.data.shortFeatures || prev.shortFeatures,
          categoryId: result.data.categoryId || prev.categoryId,
          sku: result.data.sku || prev.sku,
          supplierProductUrl: importUrlInput
        }));
        setAiExtractSuccess('¡Producto reconocido por IA! Título, costos, precios, fotos y descripción cargados automáticamente.');
      } else {
        setAiExtractError(result.error || 'No se pudo extraer la información del producto.');
      }
    } catch (err: any) {
      setAiExtractError('Error de conexión al procesar el enlace.');
    } finally {
      setIsExtractingAi(false);
    }
  };

  // Handle Product Form Submit
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();

    // Strict requirement: Never upload or save a product without images
    const validImages = (productFormData.images || []).filter(img => typeof img === 'string' && img.trim().length > 0);
    if (validImages.length === 0) {
      setProductFormImageError('No se puede subir el producto sin imagen. Es obligatorio cargar al menos una foto real del producto.');
      scrollToModalSection('modal-sec-photos');
      return;
    }

    setProductFormImageError(null);

    const discount = productFormData.originalPrice && productFormData.originalPrice > (productFormData.salePrice || 0)
      ? Math.round((((productFormData.originalPrice - (productFormData.salePrice || 0)) / productFormData.originalPrice) * 100))
      : 0;

    const finalData = {
      ...productFormData,
      images: validImages,
      discountPercentage: discount,
      slug: (productFormData.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    } as any;

    if (editingProduct) {
      updateProduct(editingProduct.id, finalData);
      setEditingProduct(null);
    } else if (isCreatingProduct) {
      addProduct(finalData);
      setIsCreatingProduct(false);
    }
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductFormData(prod);
    setIsCreatingProduct(false);
    setImportUrlInput(prod.supplierProductUrl || '');
    setAiExtractError(null);
    setAiExtractSuccess(null);
    setProductFormImageError(null);
  };

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setIsCreatingProduct(true);
    setImportUrlInput('');
    setAiExtractError(null);
    setAiExtractSuccess(null);
    setProductFormImageError(null);
    setProductFormData({
      name: '',
      sku: `INO-${Math.floor(100 + Math.random() * 900)}`,
      categoryId: categories[0]?.id || 'accesorios',
      images: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80'],
      costPrice: 5000,
      salePrice: 7990,
      originalPrice: 9990,
      stock: 20,
      stockStatus: 'available',
      hideIfOutOfStock: false,
      description: '',
      shortFeatures: ['Calidad garantizada', 'Diseño moderno'],
      supplier: 'Inova ARG',
      isFeatured: false,
      isOnSale: true,
      isNew: true,
      rating: 5.0,
      reviewCount: 0,
      salesCount: 0,
    });
  };

  const handleTriggerSyncCategories = async () => {
    setIsSyncingCategories(true);
    setCategoriesSyncSuccess(null);
    try {
      await syncCategoriesWithInovaCatalog();
      setCategoriesSyncSuccess('¡Las 24 categorías oficiales de Inova fueron sincronizadas correctamente con Firestore y el sistema!');
      setTimeout(() => setCategoriesSyncSuccess(null), 5000);
    } catch (err) {
      console.warn('Error syncing categories:', err);
    } finally {
      setIsSyncingCategories(false);
    }
  };

  const handleSyncInovaToFirestore = async () => {
    triggerHaptic();
    setFirestoreSyncMessage(null);
    const res = await syncInovaAndApiProductsToFirestore({ forceInovaRefresh: true, silent: false });
    if (res.error) {
      setFirestoreSyncMessage(`Error al sincronizar: ${res.error}`);
    } else if (res.syncedCount > 0) {
      setFirestoreSyncMessage(`Se actualizaron ${res.syncedCount} productos en Firestore con el stock real de Inova.`);
    } else {
      setFirestoreSyncMessage('El catálogo en Firestore ya está al día con el stock real de Inova.');
    }
    setTimeout(() => setFirestoreSyncMessage(null), 6000);
  };

  const handleSaveShippingSettings = () => {
    updateSettings({ freeShippingThreshold: freeShippingThresholdInput });
    setShippingSavedSuccess(true);
    setTimeout(() => setShippingSavedSuccess(false), 2000);
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-3 sm:px-6 pt-3 space-y-6">
      {/* Top Admin Header */}
      <AdminHeader activeTab={activeAdminTab} onSelectTab={setActiveAdminTab} />

      {/* Sub-page Navigation Header for Active Tab */}
      {activeAdminTab !== 'dashboard' && (
        <div className="bg-[#0e1626]/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => {
                triggerHaptic();
                setActiveAdminTab('dashboard');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 shadow-xs shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <div className="h-4 w-px bg-slate-800 hidden sm:block shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold text-white truncate">
              {activeAdminTab === 'orders' ? 'Gestión de Pedidos' :
               activeAdminTab === 'products' ? 'Catálogo de Productos' :
               activeAdminTab === 'stock' ? 'Inventario & Stock' :
               activeAdminTab === 'stock-audit' ? 'Auditoría Diaria de Stock' :
               activeAdminTab === 'transfers' ? 'Verificación de Transferencias' :
               activeAdminTab === 'preparation' ? 'Preparación de Pedidos' :
               activeAdminTab === 'logistics' ? 'Logística & Reparto' :
               activeAdminTab === 'shipping' ? 'Zonas de Envío Córdoba' :
               activeAdminTab === 'suppliers' ? 'Gestión de Proveedores' :
               activeAdminTab === 'sourcing' ? 'Compras Mayoristas (Inova)' :
               activeAdminTab === 'bulk-import' ? 'Importar CSV / Ajuste de Precios' :
               activeAdminTab === 'flash-deals' ? 'Ofertas Relámpago' :
               activeAdminTab === 'abandoned-carts' ? 'Carritos Abandonados' :
               activeAdminTab === 'assistant' ? 'Asistente & Omnicanal' :
               activeAdminTab === 'users' ? 'Usuarios Registrados' :
               activeAdminTab === 'alerts' ? 'Alertas Operativas' :
               activeAdminTab === 'coupons' ? 'Cupones de Descuento' :
               activeAdminTab === 'android' ? 'App Android (PWA/APK)' :
               'Configuración de Tienda'}
            </span>
          </div>

          <button
            onClick={() => {
              triggerHaptic();
              setShowMoreModulesSheet(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Todos los</span> módulos
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. OVERVIEW / DASHBOARD TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'dashboard' && (
        <div className="animate-fadeIn">
          <AdminOverviewTab onSelectTab={setActiveAdminTab} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* BANK TRANSFER VERIFICATION & BOT TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'transfers' && (
        <div className="animate-fadeIn">
          <AdminTransferVerificationTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* OFERTAS RELÁMPAGO & BATCH ROTATION TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'flash-deals' && (
        <div className="animate-fadeIn">
          <AdminFlashDealsTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ORDER PREPARATION TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'preparation' && (
        <div className="animate-fadeIn">
          <AdminPreparationTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* LOGISTICS & SHIPPING DASHBOARD (FASE 6) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'logistics' && (
        <div className="animate-fadeIn">
          <LogisticsDashboard />
        </div>
      )}

      {/* ========================================================================= */}
      {/* REGISTERED USERS & CUSTOMERS TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'users' && (
        <div className="animate-fadeIn">
          <AdminUsersTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STOCK & LEDGER TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'stock' && (
        <div className="animate-fadeIn">
          <AdminStockTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* DAILY STOCK & CATALOG AUDIT TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'stock-audit' && (
        <div className="animate-fadeIn">
          <AdminStockAuditTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* FASE 7: INOVA SOURCING & PURCHASE ORDERS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'sourcing' && (
        <div className="animate-fadeIn">
          <AdminInovaSourcingTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUPPLIERS TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'suppliers' && (
        <div className="animate-fadeIn">
          <AdminSuppliersTab onSelectTab={setActiveAdminTab} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* FASE 7.5: ASSISTANT & OMNICHANNEL TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'assistant' && (
        <div className="animate-fadeIn">
          <AssistantManagementTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* FASE 8: ABANDONED CARTS & RECOVERY */}
      {/* ========================================================================= */}
      {activeAdminTab === 'abandoned-carts' && (
        <div className="animate-fadeIn">
          <AdminAbandonedCartsTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. BULK IMPORT & PRICING TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'bulk-import' && (
        <div className="animate-fadeIn">
          <AdminBulkImportTab />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ALERTS & NOTIFICATIONS TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'alerts' && (
        <div className="animate-fadeIn">
          <AdminAlertsTab onSelectTab={setActiveAdminTab} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PRODUCT & STOCK MANAGEMENT TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'products' && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* Controls Header: Search, Category Selector & New Product */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, SKU o categoría..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductPage(1);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>

              {/* Category Filter Selector */}
              <select
                value={productCategoryFilter}
                onChange={(e) => {
                  setProductCategoryFilter(e.target.value);
                  setProductPage(1);
                }}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-purple-200 max-w-[140px] sm:max-w-[180px] truncate"
              >
                <option value="all">Todas ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSyncInovaToFirestore}
                disabled={isSyncingFirestoreStock}
                title="Sincronizar stock real de Inova en Firestore"
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirestoreStock ? 'animate-spin text-purple-300' : ''}`} />
                <span>{isSyncingFirestoreStock ? 'Sincronizando...' : 'Sincronizar Inova'}</span>
              </button>

              <button
                id="btn-admin-add-product"
                onClick={handleOpenNewProduct}
                className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-700/20 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nuevo producto</span>
              </button>
            </div>
          </div>

          {firestoreSyncMessage && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2">
              <span>{firestoreSyncMessage}</span>
              <button
                type="button"
                onClick={() => setFirestoreSyncMessage(null)}
                className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Filter Status Chips (All, In Stock, Low Stock, Out of Stock) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => {
                setProductStockFilter('all');
                setProductPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                productStockFilter === 'all'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todos ({filteredCatalogProducts.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setProductStockFilter('in_stock');
                setProductPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                productStockFilter === 'in_stock'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              🟢 Disponibles
            </button>

            <button
              type="button"
              onClick={() => {
                setProductStockFilter('low_stock');
                setProductPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                productStockFilter === 'low_stock'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              🟡 Stock bajo
            </button>

            <button
              type="button"
              onClick={() => {
                setProductStockFilter('out_of_stock');
                setProductPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                productStockFilter === 'out_of_stock'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              🔴 Agotados
            </button>
          </div>

          {/* Pagination Toolbar Header: Fast Page Switcher */}
          <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200/80 px-3 py-2 rounded-xl text-xs">
            <span className="text-slate-600 font-medium">
              Mostrando <strong>{(currentCatalogPage - 1) * PRODUCTS_PER_PAGE + 1} - {Math.min(currentCatalogPage * PRODUCTS_PER_PAGE, filteredCatalogProducts.length)}</strong> de <strong>{filteredCatalogProducts.length}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setProductPage(p => Math.max(1, p - 1))}
                disabled={currentCatalogPage <= 1}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 px-1">
                {currentCatalogPage} / {totalCatalogPages}
              </span>
              <button
                type="button"
                onClick={() => setProductPage(p => Math.min(totalCatalogPages, p + 1))}
                disabled={currentCatalogPage >= totalCatalogPages}
                className="p-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* High-Density Compact Catalog List (Massively reduced scroll height, zero truncation) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden divide-y divide-slate-100">
            {paginatedCatalogProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No se encontraron productos con los filtros seleccionados.
              </div>
            ) : (
              paginatedCatalogProducts.map((product) => {
                const { profit, marginPercent } = calculateMargin(product.costPrice, product.salePrice);
                const isOutOfStock = product.stock <= 0 || product.stockStatus === 'out_of_stock';
                const isLowStock = !isOutOfStock && product.stock <= (product.minimumStock || 5);

                return (
                  <div key={product.id} className="p-2.5 sm:p-3 hover:bg-purple-50/20 transition-colors flex items-center gap-2.5 sm:gap-3">
                    {/* Left: Compact Image (46x46) */}
                    <img
                      src={product.images[0] || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=100'}
                      alt={product.name}
                      loading="lazy"
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover bg-slate-100 border border-slate-200/70 shrink-0"
                    />

                    {/* Center: Detailed Info (Compact 3 rows) */}
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Row 1: Title and Stock Pill */}
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={product.name}>
                          {product.name}
                        </h4>
                        {isOutOfStock ? (
                          <span className="shrink-0 text-[9.5px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.5 rounded-md">
                            Agotado
                          </span>
                        ) : isLowStock ? (
                          <span className="shrink-0 text-[9.5px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded-md">
                            Bajo ({product.stock})
                          </span>
                        ) : (
                          <span className="shrink-0 text-[9.5px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-md">
                            🟢 {product.stock} un.
                          </span>
                        )}
                      </div>

                      {/* Row 2: Cost, Sale Price & Margin (Always fully visible, responsive) */}
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] flex-wrap">
                        <span className="text-slate-500">
                          Costo: <strong className="text-slate-700">${(product.costPrice ?? 0).toLocaleString('es-AR')}</strong>
                        </span>
                        <span className="text-slate-300">➔</span>
                        <span className="text-purple-700 font-bold">
                          Venta: ${(product.salePrice ?? 0).toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-1.5 py-0.2 rounded-md shrink-0">
                          +${(profit ?? 0).toLocaleString('es-AR')} ({marginPercent}%)
                        </span>
                      </div>

                      {/* Row 3: SKU & Inline Stepper / Actions */}
                      <div className="flex items-center justify-between gap-2 pt-0.5 text-[10.5px]">
                        <span className="font-mono text-[10px] text-slate-400 truncate">
                          {product.sku}
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Inline Compact Stepper */}
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/70">
                            <button
                              type="button"
                              onClick={() => updateStock(product.id, Math.max(0, product.stock - 1))}
                              className="w-5 h-5 bg-white rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center shadow-2xs cursor-pointer active:scale-90"
                              title="Restar stock"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-[10px] font-black text-slate-800">
                              {product.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateStock(product.id, product.stock + 1)}
                              className="w-5 h-5 bg-white rounded text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center shadow-2xs cursor-pointer active:scale-90"
                              title="Sumar stock"
                            >
                              +
                            </button>
                          </div>

                          {/* Direct Supplier Link Button to Inova ARG (Requested in green mark) */}
                          <a
                            href={
                              product.slug
                                ? `https://inovaarg.com/producto/${product.slug}/`
                                : `https://inovaarg.com/?s=${encodeURIComponent((product.sku || '').replace('INO-', ''))}&post_type=product`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200/90 rounded-lg font-extrabold text-[10.5px] transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
                            title="Abrir este producto en la página web oficial del proveedor Inova ARG"
                          >
                            <span>Inova</span>
                            <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                          </a>

                          {/* Quick Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(product)}
                            className="p-1 text-slate-400 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar producto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar producto "${product.name}"?`)) {
                                deleteProduct(product.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Pagination Bar */}
          {totalCatalogPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setProductPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentCatalogPage <= 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 font-medium">Página</span>
                <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                  {currentCatalogPage}
                </span>
                <span className="text-slate-500 font-medium">de {totalCatalogPages}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProductPage(p => Math.min(totalCatalogPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentCatalogPage >= totalCatalogPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ORDERS MANAGEMENT TAB (Matching reference UI mockup) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'orders' && (() => {
        const archivedCount = Math.max(0, orders.length - activeOrders.length);
        const visibleOrders = showArchivedOrders ? orders : activeOrders;
        return (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-slate-900">
              Pedidos recibidos ({visibleOrders.length})
            </h2>
            <div className="flex items-center gap-2">
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchivedOrders(prev => !prev)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  {showArchivedOrders ? 'Ocultar historial anterior' : `Ver historial anterior (${archivedCount})`}
                </button>
              )}
              <span className="text-xs text-slate-500">
                Clic en cualquier pedido para gestionar entrega
              </span>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-8 text-center space-y-2">
              <p className="text-sm font-extrabold text-slate-800">Sin pedidos pendientes (0)</p>
              <p className="text-xs text-slate-500">
                Los nuevos pedidos de prueba que realices aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden divide-y divide-slate-100">
            {visibleOrders.map((order) => {
              const cleanPhone = order.customer.phone.replace(/\D/g, '');
              const waText = encodeURIComponent(`¡Hola ${order.customer.firstName}! Te contactamos desde ${settings.storeName} sobre tu pedido ${order.orderNumber}.`);

              return (
                <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-900">
                        {order.orderNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {order.customer.firstName} {order.customer.lastName}
                      </span>
                      <span className="text-xs text-slate-400 hidden sm:inline">
                        • {order.customer.neighborhood}, Córdoba
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 1-Tap Status Selector */}
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl outline-none border transition-all ${
                          order.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : order.status === 'shipped'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : order.status === 'preparing'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : order.status === 'payment_received'
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        <option value="pending_payment">🟣 Pendiente de pago</option>
                        <option value="payment_received">🔵 Pago recibido</option>
                        <option value="checking_stock">🟡 Verificando stock</option>
                        <option value="preparing">🟠 Preparando pedido</option>
                        <option value="shipped">🚚 Enviado</option>
                        <option value="delivered">🟢 Entregado</option>
                        <option value="cancelled">🔴 Cancelado</option>
                      </select>

                      <span className="text-sm font-black text-purple-700 shrink-0">
                        ${(order.total ?? 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  {/* Customer details row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                    <div className="space-y-0.5">
                      <p>📍 {order.customer.street} {order.customer.number}, Barrio {order.customer.neighborhood} ({order.shippingZoneName})</p>
                      <p>📦 {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {order.paymentMethod === 'bank_transfer' && order.paymentStatus === 'pending' && (
                        <span className="text-[10.5px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Comprobante por autorizar
                        </span>
                      )}
                      <a
                        href={`https://wa.me/${cleanPhone}?text=${waText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-emerald-700"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>WhatsApp</span>
                      </a>

                      <button
                        onClick={() => setAdminSelectedOrder(order)}
                        className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg font-bold text-xs hover:bg-purple-200 cursor-pointer"
                      >
                        {order.transferReceiptImage ? 'Ver y Autorizar' : 'Ver completo'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 4. SHIPPING & ZONES TAB (Matching mockup) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'shipping' && (
        <div className="space-y-5 animate-fadeIn max-w-2xl">
          {/* Free shipping threshold editor */}
          <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-700" />
              <span>Estrategia de Envío Gratis</span>
            </h3>

            <p className="text-xs text-slate-500">
              Configura el monto mínimo de carrito a partir del cual el cliente obtiene envío 100% bonificado en Córdoba Capital.
            </p>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  step="1000"
                  value={freeShippingThresholdInput}
                  onChange={(e) => setFreeShippingThresholdInput(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm font-extrabold text-purple-800 outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <button
                onClick={handleSaveShippingSettings}
                className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-700/20 active:scale-95 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Guardar monto</span>
              </button>
            </div>

            {shippingSavedSuccess && (
              <p className="text-xs font-bold text-emerald-600 animate-fadeIn">
                ✓ ¡Monto mínimo actualizado con éxito!
              </p>
            )}
          </div>

          {/* Zones Price Editor (Matching mockup: Zona 1 Centro $3.500, Zona 2 Norte $4.500, etc.) */}
          <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Zonas de Entrega en Córdoba Capital
              </h3>
              <span className="text-xs text-slate-400">Precios editables</span>
            </div>

            <div className="space-y-3">
              {shippingZones.map((zone) => (
                <div key={zone.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-900 block">{zone.name}</span>
                    <span className="text-[11px] text-slate-500">{zone.description}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">$</span>
                    <input
                      type="number"
                      step="500"
                      value={zone.price}
                      onChange={(e) => updateShippingZone(zone.id, { price: Number(e.target.value) })}
                      className="w-24 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-purple-700 text-right outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => alert('¡Precios de zonas de envío guardados correctamente!')}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-700/20 active:scale-95 transition-all"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. COUPONS TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'coupons' && (
        <div className="space-y-4 animate-fadeIn max-w-2xl">
          <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Cupones de Descuento</h3>
            <div className="space-y-2">
              {coupons.map((c) => (
                <div key={c.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-purple-900 text-sm">{c.code}</span>
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                        {c.discountType === 'percentage' ? `${c.value}% OFF` : `$${c.value} OFF`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{c.description} • {c.usedCount} usos</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCouponStatus(c.id)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                        c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {c.active ? 'Activo' : 'Pausado'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SETTINGS TAB */}
      {/* ========================================================================= */}
      {activeAdminTab === 'settings' && (
        <div className="space-y-4 animate-fadeIn max-w-2xl">
          <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">Datos de la Tienda</h3>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Nombre de la Tienda</label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => updateSettings({ storeName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Eslogan de la Tienda</label>
              <input
                type="text"
                value={settings.tagline || ''}
                onChange={(e) => updateSettings({ tagline: e.target.value })}
                placeholder="Ej: Todo lo que necesitás, más cerca."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white outline-none"
              />
            </div>

            {/* Logo / Custom Brand Header Section (Img WA0017) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Logo de Encabezado / Marca</h4>
                    <p className="text-[11px] text-slate-500">Modificá, agregá o eliminá el logo del recuadro de la marca</p>
                  </div>
                </div>
                {settings?.logoUrl ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> Logo activo
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    Estándar
                  </span>
                )}
              </div>

              {/* Logo Preview Box */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-[11px] font-bold text-slate-600 block mb-1">Vista previa del recuadro del encabezado:</div>
                <div className="w-full bg-white rounded-2xl p-4 border border-purple-100 shadow-2xs flex flex-col items-center justify-center text-center relative min-h-[140px]">
                  {settings?.logoUrl ? (
                    <div className="relative group flex flex-col items-center justify-center w-full">
                      <img 
                        src={settings.logoUrl} 
                        alt="Logo de la tienda" 
                        className="max-h-36 sm:max-h-40 max-w-full w-auto object-contain rounded-lg drop-shadow-xs"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#4C1D95] flex items-center justify-center shadow-md text-white font-black text-xl mb-1">
                        V
                      </div>
                      <span className="text-sm font-black text-[#1E0E3D]">{settings.storeName || 'VONDRO'}</span>
                      <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-0.5">
                        {settings.tagline || 'TODO LO QUE NECESITÁS, MÁS CERCA.'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Upload & Management Actions */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* File Upload Button */}
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-[#7C3AED] hover:bg-purple-700 active:scale-[0.98] text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-2xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{settings?.logoUrl ? 'Modificar Logo (Subir)' : 'Agregar Logo (Subir)'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoFileUpload} 
                        className="hidden" 
                      />
                    </label>

                    {/* Delete Logo Button (if exists) */}
                    {settings?.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 active:scale-[0.98] rounded-xl text-xs font-extrabold transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Eliminar Logo</span>
                      </button>
                    )}
                  </div>

                  {/* URL Input Box */}
                  <div className="pt-1">
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">O ingresar enlace URL directo de la imagen:</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="url"
                          placeholder="https://ejemplo.com/logo.png"
                          value={customLogoUrlInput}
                          onChange={(e) => setCustomLogoUrlInput(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-purple-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveLogoUrl}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-extrabold transition-colors shrink-0"
                      >
                        Guardar URL
                      </button>
                    </div>
                  </div>

                  {logoSaveSuccess && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>¡Logo actualizado con éxito!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Número de WhatsApp (Córdoba)</label>
              <input
                type="text"
                value={settings?.whatsappNumber || ''}
                onChange={(e) => updateSettings({ whatsappNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white outline-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800">Datos Bancarios para Transferencias</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Alias</label>
                  <input
                    type="text"
                    value={settings.bankDetails.alias}
                    onChange={(e) => updateSettings({ bankDetails: { ...settings.bankDetails, alias: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">CBU</label>
                  <input
                    type="text"
                    value={settings.bankDetails.cbu}
                    onChange={(e) => updateSettings({ bankDetails: { ...settings.bankDetails, cbu: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Mercado Pago Settings Panel */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-lg bg-[#009EE3] text-white flex items-center justify-center text-[10px] font-black">
                    MP
                  </div>
                  <span>Integración de Mercado Pago</span>
                </h4>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  settings?.mercadoPago?.mode === 'production' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-sky-100 text-[#009EE3]'
                }`}>
                  Modo: {(settings?.mercadoPago?.mode || 'test').toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Modo de Operación</label>
                  <select
                    value={settings.mercadoPago.mode}
                    onChange={(e) => updateSettings({ 
                      mercadoPago: { 
                        ...settings.mercadoPago, 
                        mode: e.target.value as 'test' | 'production' 
                      } 
                    })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="test">Sandbox / Modo Pruebas</option>
                    <option value="production">Producción en Vivo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Estado de la Pasarela</label>
                  <div className="flex items-center gap-2 p-1.5 bg-emerald-50 text-emerald-800 rounded-xl font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Activa y Segura</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed">
                🛡️ <strong>Seguridad VONDRO:</strong> Las credenciales privadas y claves API se validan exclusivamente en el servidor backend (Node.js/Express) para prevenir manipulaciones de precios y accesos indebidos.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  if (confirm('¿Restablecer todos los datos del catálogo y pedidos a los valores iniciales de prueba?')) {
                    resetAllData();
                    alert('Datos restablecidos exitosamente.');
                  }
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer catálogo inicial</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRODUCT CREATE / EDIT MODAL - Mobile-First Sheet & Desktop Dialog */}
      {/* ========================================================================= */}
      {(editingProduct || isCreatingProduct) && (
        <div 
          id="product-form-modal-overlay"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain"
        >
          <div 
            id="product-form-modal-card"
            className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[94vh] sm:h-auto sm:max-h-[90vh] overflow-hidden animate-scaleIn border border-slate-100"
          >
            {/* STICKY HEADER WITH QUICK NAV PILLS */}
            <div className="bg-white px-4 pt-3.5 pb-2.5 sm:px-6 sm:pt-5 border-b border-slate-100 shrink-0 z-10 shadow-xs">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {productFormData.supplier || 'Inova ARG'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Completá precios, stock, fotos optimizadas y variantes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsCreatingProduct(false);
                  }}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* QUICK SECTION SCROLL CHIPS */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAiImport(true);
                    scrollToModalSection('modal-sec-ai');
                  }}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Link IA
                </button>
                <button
                  type="button"
                  onClick={() => scrollToModalSection('modal-sec-basic')}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Datos básicos
                </button>
                <button
                  type="button"
                  onClick={() => scrollToModalSection('modal-sec-pricing')}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Precios & Margen
                </button>
                <button
                  type="button"
                  onClick={() => scrollToModalSection('modal-sec-stock')}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Stock
                </button>
                <button
                  type="button"
                  onClick={() => scrollToModalSection('modal-sec-photos')}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 transition-colors"
                >
                  <Camera className="w-3 h-3 text-amber-600" />
                  Fotos
                </button>
                <button
                  type="button"
                  onClick={() => scrollToModalSection('modal-sec-variants')}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Colores & Variantes
                </button>
              </div>
            </div>

            {/* SCROLLABLE MODAL BODY */}
            <form 
              id="product-edit-form"
              onSubmit={handleSaveProduct} 
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 space-y-4 touch-pan-y text-xs"
            >
              {/* SECTION: AI URL IMPORT */}
              <div id="modal-sec-ai" className="rounded-2xl border border-purple-200 overflow-hidden shadow-xs">
                <div 
                  onClick={() => setShowAiImport(!showAiImport)}
                  className="p-3 bg-gradient-to-r from-purple-900 to-slate-900 text-white flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span className="font-extrabold text-xs text-purple-100">
                      Importar datos automáticamente con IA
                    </span>
                    <span className="text-[10px] bg-purple-800/90 text-purple-200 px-2 py-0.5 rounded-full font-bold">
                      Gemini
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-purple-300 text-[11px] font-semibold">
                    <span>{showAiImport ? 'Ocultar' : 'Pegar Link'}</span>
                    {showAiImport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {showAiImport && (
                  <div className="p-3.5 bg-slate-900 text-white space-y-2.5 border-t border-purple-800/40">
                    <p className="text-[11px] text-purple-200/90 leading-relaxed">
                      Pegá el enlace del producto (proveedor, Mercado Libre o tienda web) para extraer título, precios y fotos:
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        placeholder="https://ejemplo.com/producto-o-proveedor"
                        value={importUrlInput}
                        onChange={(e) => setImportUrlInput(e.target.value)}
                        className="w-full min-w-0 flex-1 bg-slate-950/90 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
                      />
                      <button
                        type="button"
                        disabled={isExtractingAi}
                        onClick={handleExtractFromUrl}
                        className="w-full sm:w-auto justify-center px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-md active:scale-95 transition-all"
                      >
                        {isExtractingAi ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-300" />
                            <span>Analizando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Cargar con IA</span>
                          </>
                        )}
                      </button>
                    </div>

                    {aiExtractError && (
                      <p className="text-[11px] font-bold text-rose-300 bg-rose-950/60 p-2 rounded-xl border border-rose-800/50">
                        ⚠️ {aiExtractError}
                      </p>
                    )}

                    {aiExtractSuccess && (
                      <p className="text-[11px] font-bold text-emerald-300 bg-emerald-950/60 p-2 rounded-xl border border-emerald-800/50">
                        ✓ {aiExtractSuccess}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: BASIC INFO */}
              <div id="modal-sec-basic" className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span>📝</span> Información Básica
                </h4>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nombre del producto *</label>
                  <input
                    type="text"
                    required
                    value={productFormData.name || ''}
                    onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    placeholder="Ej. Organizador de ropa plegable"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Categoría ({categories.length}) *
                    </label>
                    <select
                      value={productFormData.categoryId || 'accesorios'}
                      onChange={(e) => setProductFormData({ 
                        ...productFormData, 
                        categoryId: e.target.value,
                        subcategoryId: undefined
                      })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-purple-500 outline-none shadow-xs"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatCategoryName(c.name)} {c.subcategories && c.subcategories.length > 0 ? `(${c.subcategories.length} subcats)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const currentCategory = categories.find(c => c.id === (productFormData.categoryId || 'accesorios'));
                    const hasSubcats = currentCategory?.subcategories && currentCategory.subcategories.length > 0;
                    if (hasSubcats) {
                      return (
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Subcategoría</label>
                          <select
                            value={productFormData.subcategoryId || ''}
                            onChange={(e) => setProductFormData({ ...productFormData, subcategoryId: e.target.value || undefined })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-purple-500 outline-none shadow-xs"
                          >
                            <option value="">(Sin subcategoría específica)</option>
                            {currentCategory.subcategories!.map((sub) => (
                              <option key={sub.id} value={sub.id}>{formatCategoryName(sub.name)}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">SKU / Código</label>
                        <input
                          type="text"
                          value={productFormData.sku || ''}
                          onChange={(e) => setProductFormData({ ...productFormData, sku: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-purple-500 outline-none shadow-xs"
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* If subcategory was shown in the grid above, also provide SKU input below */}
                {(() => {
                  const currentCategory = categories.find(c => c.id === (productFormData.categoryId || 'accesorios'));
                  const hasSubcats = currentCategory?.subcategories && currentCategory.subcategories.length > 0;
                  if (hasSubcats) {
                    return (
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">SKU / Código</label>
                        <input
                          type="text"
                          value={productFormData.sku || ''}
                          onChange={(e) => setProductFormData({ ...productFormData, sku: e.target.value })}
                          placeholder="Ej. INO-101"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-purple-500 outline-none shadow-xs"
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Description */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    value={productFormData.description || ''}
                    onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                    placeholder="Descripción detallada del producto..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:border-purple-500 outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* SECTION: PRICING & MARGIN (INOVA ARG) */}
              <div id="modal-sec-pricing" className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <span>💰</span> Cálculo de Precios & Margen
                  </span>
                  <span className="text-[10px] text-purple-700 bg-purple-100 font-bold px-2 py-0.5 rounded-full">
                    Inova ARG
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Costo proveedor ($) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productFormData.costPrice || 0}
                      onChange={(e) => setProductFormData({ ...productFormData, costPrice: Number(e.target.value) })}
                      className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 focus:border-purple-500 outline-none shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Precio de venta ($) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productFormData.salePrice || 0}
                      onChange={(e) => setProductFormData({ ...productFormData, salePrice: Number(e.target.value) })}
                      className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-xs font-black text-purple-800 focus:border-purple-500 outline-none shadow-xs"
                    />
                  </div>
                </div>

                {/* Live Profit & Margin Indicator */}
                <div className="flex items-center justify-between pt-2 border-t border-purple-200/80 text-xs">
                  <div>
                    <span className="text-slate-600 block text-[11px]">Ganancia bruta:</span>
                    <strong className="text-emerald-700 font-black text-sm flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 inline" />
                      +${(currentMargin?.profit ?? 0).toLocaleString('es-AR')}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-600 block text-[11px]">Margen sobre venta:</span>
                    <strong className="text-purple-700 font-black text-sm">
                      {currentMargin.marginPercent}%
                    </strong>
                  </div>
                </div>

                {/* Suggested Prices */}
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">Precios sugeridos rápidos:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[1.3, 1.4, 1.5, 1.6].map((multiplier) => {
                      const suggested = Math.round(((productFormData.costPrice || 0) * multiplier) / 100) * 100 + 90;
                      return (
                        <button
                          key={multiplier}
                          type="button"
                          onClick={() => setProductFormData({ ...productFormData, salePrice: suggested })}
                          className="flex-1 min-w-[85px] px-2 py-1.5 bg-white border border-purple-200 rounded-lg text-[10px] font-bold text-purple-800 hover:bg-purple-100 text-center transition-colors shadow-2xs active:scale-95"
                        >
                          ${(suggested ?? 0).toLocaleString('es-AR')} (+{(multiplier * 100 - 100).toFixed(0)}%)
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SECTION: STOCK & STATUS */}
              <div id="modal-sec-stock" className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span>📦</span> Stock & Disponibilidad
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Stock disponible</label>
                    <input
                      type="number"
                      min="0"
                      value={productFormData.stock || 0}
                      onChange={(e) => setProductFormData({ ...productFormData, stock: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-purple-500 outline-none shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Estado manual</label>
                    <select
                      value={productFormData.stockStatus || 'available'}
                      onChange={(e) => setProductFormData({ ...productFormData, stockStatus: e.target.value as StockStatus })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-purple-500 outline-none shadow-xs"
                    >
                      <option value="available">🟢 Disponible</option>
                      <option value="low_stock">🟡 Stock bajo</option>
                      <option value="out_of_stock">🔴 Agotado</option>
                      <option value="hidden">⚪ Oculto</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION: REAL SALES & REVIEWS METRICS */}
              <div id="modal-sec-metrics" className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <span>📊</span> Métricas Reales (Ventas y Calificación)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Métricas limpias para el lanzamiento. Ponelas en 0 para que suban según compras reales.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProductFormData({
                        ...productFormData,
                        salesCount: 0,
                        reviewCount: 0,
                        rating: 5.0
                      });
                    }}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer"
                  >
                    🔄 Poner en 0
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">Ventas Totales</label>
                    <input
                      type="number"
                      min="0"
                      value={productFormData.salesCount ?? 0}
                      onChange={(e) => setProductFormData({ ...productFormData, salesCount: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-purple-500 outline-none shadow-xs"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">Estrellas (1 - 5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={productFormData.rating ?? 5.0}
                      onChange={(e) => setProductFormData({ ...productFormData, rating: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-purple-500 outline-none shadow-xs"
                      placeholder="5.0"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 text-[11px]">Cant. Opiniones</label>
                    <input
                      type="number"
                      min="0"
                      value={productFormData.reviewCount ?? 0}
                      onChange={(e) => setProductFormData({ ...productFormData, reviewCount: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-purple-500 outline-none shadow-xs"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PRODUCT PHOTOS (CAMERA, GALLERY, GOOGLE DRIVE, COMPRESSOR) */}
              <div id="modal-sec-photos" className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <span>📸</span> Fotos del Producto
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Subí desde cámara, galería o link de Google Drive. Compresión automática para máxima velocidad.
                    </p>
                  </div>
                </div>

                {productFormImageError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{productFormImageError}</span>
                  </div>
                )}

                <ProductImagePicker
                  images={productFormData.images || []}
                  onChange={(newImages) => {
                    setProductFormImageError(null);
                    setProductFormData({ ...productFormData, images: newImages });
                  }}
                />
              </div>

              {/* SECTION: VARIANTS */}
              <div id="modal-sec-variants" className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                      <span>🎨</span> Variantes y Sub-productos
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Configurá colores, medidas o modelos con foto individual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentVars = productFormData.variants || [];
                      const newVar: ProductVariant = {
                        id: `var-${Date.now()}`,
                        name: '',
                        imageUrl: ''
                      };
                      setProductFormData({
                        ...productFormData,
                        variants: [...currentVars, newVar]
                      });
                    }}
                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs flex items-center gap-1 border border-purple-200 shadow-2xs active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar color
                  </button>
                </div>

                {productFormData.variants && productFormData.variants.length > 0 ? (
                  <div className="space-y-2">
                    {productFormData.variants.map((variant, vIdx) => (
                      <div key={variant.id || vIdx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            placeholder="Nombre (ej. Negro, Rosa, XL)"
                            value={variant.name}
                            onChange={(e) => {
                              const updatedVars = [...(productFormData.variants || [])];
                              updatedVars[vIdx] = { ...updatedVars[vIdx], name: e.target.value };
                              setProductFormData({ ...productFormData, variants: updatedVars });
                            }}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:bg-white outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2 flex-1">
                          {variant.imageUrl && (
                            <img
                              src={variant.imageUrl}
                              alt={variant.name}
                              className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}

                          <input
                            type="text"
                            placeholder="URL o link foto..."
                            value={variant.imageUrl || ''}
                            onChange={(e) => {
                              const updatedVars = [...(productFormData.variants || [])];
                              updatedVars[vIdx] = { ...updatedVars[vIdx], imageUrl: e.target.value };
                              setProductFormData({ ...productFormData, variants: updatedVars });
                            }}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:bg-white outline-none"
                          />

                          {/* Quick Camera/File upload for variant */}
                          <label className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 cursor-pointer shrink-0 transition-colors" title="Subir foto para esta variante">
                            <Camera className="w-4 h-4" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleVariantPhotoUpload(vIdx, file);
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              const updatedVars = (productFormData.variants || []).filter((_, idx) => idx !== vIdx);
                              setProductFormData({ ...productFormData, variants: updatedVars });
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                            title="Eliminar variante"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 bg-white p-3 rounded-xl border border-dashed border-slate-200 text-center">
                    Sin variantes adicionales. El producto se venderá como modelo único.
                  </div>
                )}
              </div>
            </form>

            {/* STICKY FOOTER ACTION BUTTONS */}
            <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center gap-2.5 shrink-0 z-10 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setIsCreatingProduct(false);
                }}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="product-edit-form"
                className="flex-1 py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 active:scale-[0.98] text-white font-extrabold rounded-xl text-xs shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 transition-all"
              >
                <Check className="w-4 h-4" />
                {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER COMPLETE DETAIL MODAL */}
      {adminSelectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">
                Pedido {adminSelectedOrder.orderNumber}
              </h3>
              <button
                onClick={() => setAdminSelectedOrder(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl">
                <span><strong>Estado de Pago:</strong></span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  adminSelectedOrder.paymentStatus === 'approved' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : adminSelectedOrder.paymentStatus === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {adminSelectedOrder.paymentStatus === 'approved' ? '✓ Pago Aprobado' : adminSelectedOrder.paymentStatus === 'pending' ? '⏳ Pago Pendiente' : '✕ Pago Rechazado / Cancelado'}
                </span>
              </div>

              {adminSelectedOrder.paymentId && (
                <p><strong>ID Mercado Pago:</strong> <span className="font-mono font-bold text-slate-800">{adminSelectedOrder.paymentId}</span></p>
              )}
              <p><strong>Cliente:</strong> {adminSelectedOrder.customer.firstName} {adminSelectedOrder.customer.lastName}</p>
              <p><strong>Teléfono:</strong> {adminSelectedOrder.customer.phone}</p>
              <p><strong>Dirección:</strong> {adminSelectedOrder.customer.street} {adminSelectedOrder.customer.number}, Barrio {adminSelectedOrder.customer.neighborhood}</p>
              <p><strong>Zona:</strong> {adminSelectedOrder.shippingZoneName}</p>
              <p><strong>Método de pago:</strong> {adminSelectedOrder.paymentMethod === 'mercadopago' ? '💳 Mercado Pago' : adminSelectedOrder.paymentMethod === 'bank_transfer' ? '🏛️ Transferencia' : '💵 Efectivo'}</p>
              
              <div className="pt-2 border-t border-slate-100">
                <strong>Artículos:</strong>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  {adminSelectedOrder.items.map((it, idx) => (
                    <li key={idx}>
                      {it.quantity}x {it.name} (${(it.subtotal ?? 0).toLocaleString('es-AR')})
                    </li>
                  ))}
                </ul>
              </div>
              {adminSelectedOrder.transferReceiptImage && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                  <span className="font-extrabold text-purple-950 block">Comprobante de Transferencia Adjuntado:</span>
                  <div className="flex items-center gap-3">
                    <a 
                      href={adminSelectedOrder.transferReceiptImage} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block group relative shrink-0"
                      title="Abrir en pestaña nueva"
                    >
                      <img 
                        src={adminSelectedOrder.transferReceiptImage} 
                        alt="Comprobante" 
                        className="w-16 h-16 object-cover rounded-xl border border-purple-300 shadow-2xs group-hover:opacity-90"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-[9px] font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver
                      </span>
                    </a>
                    <div className="space-y-0.5 text-[11px] text-slate-600 flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 leading-tight">Cotejá la acreditación en la cuenta bancaria antes de autorizar.</p>
                      {adminSelectedOrder.paymentStatus === 'approved' ? (
                        <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> Pago Verificado & Aprobado
                        </span>
                      ) : (
                        <span className="text-amber-800 font-extrabold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> Pendiente de Aprobación
                        </span>
                      )}
                    </div>
                  </div>

                  {adminSelectedOrder.paymentStatus !== 'approved' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          updateOrderStatus(adminSelectedOrder.id, 'payment_received');
                          setAdminSelectedOrder(prev => prev ? { ...prev, paymentStatus: 'approved', status: 'payment_received' } : null);
                        }}
                        className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Aprobar Pago</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const reason = prompt('Motivo de rechazo del comprobante (ej: importe no acreditado en cuenta):') || 'Comprobante no acreditado';
                          updateOrderStatus(adminSelectedOrder.id, 'pending_payment');
                          setAdminSelectedOrder(prev => prev ? { ...prev, paymentStatus: 'rejected', status: 'pending_payment', adminNotes: reason } : null);
                        }}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex justify-between font-black text-sm text-purple-800">
                <span>Total:</span>
                <span>${(adminSelectedOrder.total ?? 0).toLocaleString('es-AR')}</span>
              </div>
            </div>

            <button
              onClick={() => setAdminSelectedOrder(null)}
              className="w-full py-2.5 bg-purple-700 text-white font-bold text-xs rounded-xl"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN BOTTOM NAVIGATION BAR - EXACT MATCH TO FLYER */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1d]/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-2 shadow-2xl safe-area-inset-bottom">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          {/* 1. Inicio */}
          <button
            onClick={() => {
              triggerHaptic();
              setActiveAdminTab('dashboard');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeAdminTab === 'dashboard' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeAdminTab === 'dashboard' ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40 shadow-sm shadow-purple-500/20' : ''}`}>
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Inicio</span>
          </button>

          {/* 2. Pedidos */}
          <button
            onClick={() => {
              triggerHaptic();
              setActiveAdminTab('orders');
            }}
            className={`relative flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeAdminTab === 'orders' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl relative transition-all ${activeAdminTab === 'orders' ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40 shadow-sm shadow-purple-500/20' : ''}`}>
              <ClipboardList className="w-5 h-5" />
              {pendingOrdersBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1.5 px-1 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-[#0a0f1d] animate-pulse">
                  {pendingOrdersBadgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Pedidos</span>
          </button>

          {/* 3. Catálogo */}
          <button
            onClick={() => {
              triggerHaptic();
              setActiveAdminTab('products');
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeAdminTab === 'products' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeAdminTab === 'products' ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40 shadow-sm shadow-purple-500/20' : ''}`}>
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Catálogo</span>
          </button>

          {/* 4. Estadísticas */}
          <button
            onClick={() => {
              triggerHaptic();
              setActiveAdminTab('dashboard');
              setTimeout(() => {
                const el = document.getElementById('admin-weekly-sales-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 120);
            }}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <div className="p-1.5 rounded-xl transition-all hover:bg-slate-800">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Estadísticas</span>
          </button>

          {/* 5. Más */}
          <button
            onClick={() => {
              triggerHaptic();
              setShowMoreModulesSheet(true);
            }}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              showMoreModulesSheet ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${showMoreModulesSheet ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40' : 'hover:bg-slate-800'}`}>
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight">Más</span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* ALL MODULES BOTTOM SHEET MODAL */}
      {/* ========================================================================= */}
      {showMoreModulesSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowMoreModulesSheet(false)} 
          />
          <div className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
            {/* Sheet Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Todos los Módulos</h3>
                  <p className="text-xs text-slate-400">Panel de operaciones y herramientas</p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreModulesSheet(false)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sheet Body: Categorized Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {[
                {
                  category: 'Ventas & Finanzas',
                  items: [
                    { id: 'dashboard', label: 'Dashboard General', icon: Home, desc: 'Métricas, KPIs y accesos rápidos' },
                    { id: 'orders', label: 'Gestión de Pedidos', icon: ShoppingBag, desc: `Seguimiento de compras (${activeOrders.length})`, badge: pendingOrdersBadgeCount },
                    { id: 'transfers', label: 'Verificar Transferencias', icon: Landmark, desc: 'Comprobantes y bot bancario', badge: pendingTransfersBadgeCount },
                    { id: 'flash-deals', label: 'Ofertas Relámpago', icon: Zap, desc: 'Descuentos con temporizador' },
                    { id: 'abandoned-carts', label: 'Carritos Abandonados', icon: ShoppingBag, desc: 'Recuperación vía WhatsApp' },
                  ]
                },
                {
                  category: 'Catálogo & Inventario',
                  items: [
                    { id: 'products', label: 'Catálogo de Productos', icon: Package, desc: `Crear y editar artículos (${products.length})` },
                    { id: 'stock', label: 'Inventario & Stock', icon: Boxes, desc: 'Niveles críticos y movimientos', badge: products.filter(p => (p.stock <= (p.minimumStock || 3)) || p.stockStatus === 'out_of_stock').length },
                    { id: 'stock-audit', label: 'Auditoría Diaria de Stock', icon: Calendar, desc: 'Análisis diario: nuevos, agotados y cambios', badge: latestDailyAudit?.outOfStockCount || 0 },
                    { id: 'sourcing', label: 'Compras Mayoristas (Inova)', icon: Building2, desc: 'Catálogo exterior y órdenes' },
                    { id: 'bulk-import', label: 'Importar CSV / % Precios', icon: FileSpreadsheet, desc: 'Ajuste masivo porcentual' },
                    { id: 'suppliers', label: 'Proveedores', icon: Users, desc: `Fabricantes y distribuidores (${suppliers.length})` },
                  ]
                },
                {
                  category: 'Logística & Envíos',
                  items: [
                    { id: 'preparation', label: 'Preparar Pedidos', icon: CheckSquare, desc: 'Picking, packing y despacho' },
                    { id: 'logistics', label: 'Logística & Reparto', icon: Truck, desc: 'Rutas y cadetería local' },
                    { id: 'shipping', label: 'Zonas de Envío Córdoba', icon: Truck, desc: 'Tarifas y umbral gratis' },
                  ]
                },
                {
                  category: 'Clientes & IA',
                  items: [
                    { id: 'assistant', label: 'Asistente & Omnicanal', icon: Bot, desc: 'Bot de WhatsApp y chat IA' },
                    { id: 'users', label: 'Usuarios Registrados', icon: Users, desc: `Base de clientes (${registeredUsers.length})` },
                    { id: 'alerts', label: 'Alertas Operativas', icon: Bell, desc: 'Notificaciones del sistema', badge: unreadNotificationsCount },
                  ]
                },
                {
                  category: 'Configuración de Tienda',
                  items: [
                    { id: 'settings', label: 'Configuración General', icon: Settings, desc: 'Logo, horarios, métodos de pago' },
                    { id: 'coupons', label: 'Cupones de Descuento', icon: Tag, desc: `Promociones y códigos (${coupons.length})` },
                    { id: 'android', label: 'App Android (PWA/APK)', icon: Smartphone, desc: 'Instalación y acceso móvil' },
                  ]
                }
              ].map((group, gIdx) => (
                <div key={gIdx} className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400/90 px-1">
                    {group.category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const isActive = activeAdminTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            triggerHaptic();
                            setActiveAdminTab(item.id as any);
                            setShowMoreModulesSheet(false);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isActive
                              ? 'bg-purple-600/20 border-purple-500/50 text-white shadow-md shadow-purple-600/20 ring-1 ring-purple-400/30'
                              : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-300'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{item.label}</p>
                              <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                            </div>
                          </div>
                          {Boolean(item.badge && item.badge > 0) && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px] shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
