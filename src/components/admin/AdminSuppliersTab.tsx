import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  MessageCircle, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Package, 
  Search,
  X,
  Building2,
  FileText,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Supplier } from '../../types';
import { triggerHaptic } from '../../utils/native';

interface AdminSuppliersTabProps {
  onSelectTab?: (tab: any) => void;
}

export const AdminSuppliersTab: React.FC<AdminSuppliersTabProps> = ({ onSelectTab }) => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, products } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add / Edit Modal State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    location: 'Córdoba Capital',
    cuit: '',
    leadTimeDays: 2,
    notes: '',
    active: true
  });

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contactName && s.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.location && s.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenNew = () => {
    triggerHaptic();
    setEditingSupplier(null);
    setIsCreatingSupplier(true);
    setFormData({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      location: 'Córdoba Capital',
      cuit: '',
      leadTimeDays: 2,
      notes: '',
      active: true
    });
  };

  const handleOpenEdit = (supplier: Supplier) => {
    triggerHaptic();
    setEditingSupplier(supplier);
    setIsCreatingSupplier(false);
    setFormData(supplier);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();

    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, formData);
    } else {
      await addSupplier(formData as any);
    }

    setEditingSupplier(null);
    setIsCreatingSupplier(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar al proveedor "${name}"?`)) {
      triggerHaptic();
      await deleteSupplier(id);
    }
  };

  const handleWhatsApp = (phone: string, contactName: string) => {
    triggerHaptic();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('549') ? cleanPhone : cleanPhone.startsWith('54') ? `549${cleanPhone.slice(2)}` : `549${cleanPhone}`;
    const message = `Hola ${contactName || ''}, te escribo desde *VONDRO Córdoba* sobre reposición de mercadería.`;
    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Gestión de Proveedores
            </span>
            <span className="text-xs text-slate-400">• {suppliers.length} distribuidores</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Directorio Mayorista y Proveedores</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Contactos directos, tiempos de entrega (lead time) y vinculación con el catálogo de productos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-48 sm:w-56"
            />
          </div>

          <button
            id="supplier-btn-add-new"
            onClick={handleOpenNew}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Inova Sourcing Callout Banner */}
      {onSelectTab && (
        <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/50 border border-purple-800/40 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Abastecimiento Mayorista con Inova ARG</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/30 text-purple-200 border border-purple-500/40">FASE 7</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Control de pedido mínimo ($80.000), verificación de costos en tiempo real y generación de Órdenes de Compra (PO).
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic();
              onSelectTab('sourcing');
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 flex items-center gap-1.5 shrink-0 transition-all"
          >
            <span>Abrir Inova Sourcing</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Supplier Cards Grid */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Building2 className="w-12 h-12 mx-auto text-purple-400 mb-3 opacity-90" />
          <h3 className="text-base font-semibold text-white">No se encontraron proveedores</h3>
          <p className="text-xs text-slate-400 mt-1">
            Puedes agregar un nuevo distribuidor haciendo clic en "Nuevo Proveedor".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuppliers.map((supplier) => {
            const linkedProducts = products.filter(p => p.supplierId === supplier.id || p.supplier === supplier.name);

            return (
              <div 
                key={supplier.id} 
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-purple-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-base text-white">{supplier.name}</h3>
                        {supplier.active && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Activo" />
                        )}
                      </div>
                      <p className="text-xs text-purple-300 font-medium mt-0.5">{supplier.contactName || 'Contacto comercial'}</p>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEdit(supplier)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Editar proveedor"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id, supplier.name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Details List */}
                  <div className="mt-3 space-y-2 text-xs text-slate-300">
                    {supplier.location && (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>{supplier.location}</span>
                      </p>
                    )}
                    {supplier.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{supplier.phone}</span>
                      </p>
                    )}
                    {supplier.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{supplier.email}</span>
                      </p>
                    )}
                    {supplier.leadTimeDays !== undefined && (
                      <p className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Tiempo estimado de entrega: <strong>{supplier.leadTimeDays} días</strong></span>
                      </p>
                    )}
                    {supplier.cuit && (
                      <p className="flex items-center gap-2 text-slate-400 text-[11px]">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>CUIT: {supplier.cuit}</span>
                      </p>
                    )}
                  </div>

                  {supplier.notes && (
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 italic">
                      "{supplier.notes}"
                    </div>
                  )}
                </div>

                {/* Bottom Actions & Linked Products */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                    <Package className="w-3.5 h-3.5 text-purple-400" />
                    <span>{linkedProducts.length} productos</span>
                  </div>

                  <div className="flex gap-1.5">
                    {supplier.phone && (
                      <button
                        onClick={() => handleWhatsApp(supplier.phone!, supplier.contactName || '')}
                        className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    {supplier.email && (
                      <a
                        href={`mailto:${supplier.email}`}
                        className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white transition-colors"
                        title="Enviar Email"
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {(isCreatingSupplier || editingSupplier) && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base text-white">
                  {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor Mayorista'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setEditingSupplier(null);
                  setIsCreatingSupplier(false);
                }} 
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Razón Social / Empresa*:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Inova ARG Mayorista"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nombre del Contacto:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Laura Gómez"
                    value={formData.contactName || ''}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Teléfono / WhatsApp*:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 3515998877"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email de Pedidos:
                  </label>
                  <input
                    type="email"
                    placeholder="ventas@proveedor.com"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ubicación / Ciudad:
                  </label>
                  <input
                    type="text"
                    placeholder="Córdoba Capital"
                    value={formData.location || ''}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Entrega (Días):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.leadTimeDays || 2}
                    onChange={e => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CUIT:
                  </label>
                  <input
                    type="text"
                    placeholder="30-71829384-8"
                    value={formData.cuit || ''}
                    onChange={e => setFormData({ ...formData, cuit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notas de condiciones comerciales (descuentos, pagos, mínimos):
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Descuento del 10% por pago contra entrega en efectivo."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setIsCreatingSupplier(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  {editingSupplier ? 'Guardar Cambios' : 'Crear Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
