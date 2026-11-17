import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Sparkles, 
  Save, 
  X, 
  RotateCcw,
  Percent,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { triggerHaptic } from '../../utils/native';

export const AdminBulkImportTab: React.FC = () => {
  const { products, categories, suppliers, importProductsCSV, bulkUpdateProducts } = useStore();
  
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; errors: string[] } | null>(null);

  // Bulk Price Adjuster State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceChangePercent, setPriceChangePercent] = useState<number>(10);
  const [isApplyingBulkPrice, setIsApplyingBulkPrice] = useState<boolean>(false);
  const [bulkPriceSuccess, setBulkPriceSuccess] = useState<boolean>(false);

  // Download Sample CSV
  const handleDownloadSampleCSV = () => {
    triggerHaptic();
    const sampleContent = `sku,name,salePrice,costPrice,stock,minimumStock,category,supplier,image_url\nINO-ASP-01,Aspiradora Robot Inteligente VONDRO,64990,38000,15,3,hogar,Inova ARG,https://images.unsplash.com/photo-1518770660439-4636190af475?w=800\nINO-HUM-02,Humidificador Ultrasónico LED,18990,11000,25,5,bienestar,Inova ARG,https://images.unsplash.com/photo-1543512214-318c7553f230?w=800\nINO-TER-03,Termo Inteligente Digital 500ml,14990,8500,30,5,hogar,TechCord Mayorista,https://images.unsplash.com/photo-1544816155-12df9643f363?w=800\nINO-PRO-04,Proyector Portátil Full HD Cinema,89990,52000,8,2,tecnologia,Inova ARG,https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800`;

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_productos_vondro.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV function
  const parseCSV = (content: string) => {
    const lines = content.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      setParseErrors(['El archivo CSV debe tener al menos una fila de encabezados y una de datos.']);
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV splitter handling commas inside quotes
      const values: string[] = [];
      let inQuotes = false;
      let currentVal = '';

      for (let char of line) {
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ''));

      const rowObj: any = {};
      headers.forEach((header, index) => {
        rowObj[header] = values[index] !== undefined ? values[index] : '';
      });

      // Basic validation
      const name = rowObj.name || rowObj.nombre || rowObj.producto;
      const salePrice = parseFloat(rowObj.saleprice || rowObj.precio || rowObj.precio_venta || '0');
      const costPrice = parseFloat(rowObj.costprice || rowObj.costo || '0');
      const stock = parseInt(rowObj.stock || rowObj.cantidad || '10', 10);
      const sku = rowObj.sku || rowObj.codigo;
      const categoryId = (rowObj.category || rowObj.categoria || 'hogar').toLowerCase();
      const supplier = rowObj.supplier || rowObj.proveedor || 'Inova ARG';
      const imageUrl = rowObj.image_url || rowObj.image || rowObj.imagen || rowObj.images || rowObj.foto || rowObj.fotos || '';
      const images = imageUrl ? imageUrl.split(';').map((s: string) => s.trim()).filter(Boolean) : [];

      if (!name) {
        errors.push(`Fila ${i + 1}: Falta el nombre del producto.`);
        continue;
      }
      if (isNaN(salePrice) || salePrice <= 0) {
        errors.push(`Fila ${i + 1} (${name}): El precio de venta debe ser un número mayor a 0.`);
        continue;
      }

      // Check existing product if updating; if new product and has no image, reject upload
      const isExisting = products.some(p => (sku && p.sku === sku));
      if (!isExisting && images.length === 0) {
        errors.push(`Fila ${i + 1} (${name}): Omitido porque no tiene imagen. Todo producto nuevo debe tener imagen para subirse.`);
        continue;
      }

      rows.push({
        sku,
        name,
        salePrice,
        costPrice: isNaN(costPrice) ? Math.round(salePrice * 0.6) : costPrice,
        stock: isNaN(stock) ? 10 : stock,
        minimumStock: parseInt(rowObj.minimumstock || '3', 10),
        categoryId,
        supplier,
        images: images.length > 0 ? images : undefined
      });
    }

    setParsedRows(rows);
    setParseErrors(errors);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    triggerHaptic();

    try {
      const result = await importProductsCSV(parsedRows);
      setImportResult(result);
      setParsedRows([]);
      setCsvText('');
    } catch (err: any) {
      setParseErrors([err.message || 'Error durante la importación.']);
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk Price multiplier
  const handleApplyBulkPriceIncrease = async () => {
    if (priceChangePercent === 0) return;
    const targetProds = selectedCategory === 'all' 
      ? products 
      : products.filter(p => p.categoryId === selectedCategory);

    const multiplier = 1 + (priceChangePercent / 100);
    const updates = targetProds.map(p => ({
      id: p.id,
      priceMultiplier: multiplier
    }));

    if (window.confirm(`¿Confirmas aplicar un ajuste de ${priceChangePercent > 0 ? `+${priceChangePercent}%` : `${priceChangePercent}%`} a ${targetProds.length} productos?`)) {
      triggerHaptic();
      setIsApplyingBulkPrice(true);
      await bulkUpdateProducts(updates);
      setIsApplyingBulkPrice(false);
      setBulkPriceSuccess(true);
      setTimeout(() => setBulkPriceSuccess(false), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Operaciones Masivas
            </span>
            <span className="text-xs text-slate-400">• Importador y Ajuste de Precios</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Importación y Actualización Masiva</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Carga listas de productos en CSV/Excel y actualiza precios por porcentaje ante inflación o listas de proveedores.
          </p>
        </div>

        <button
          onClick={handleDownloadSampleCSV}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-purple-400" />
          <span>Descargar Plantilla CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bulk Price Increment Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
              <Percent className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-sm text-white">Aumento Porcentual Masivo</h3>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Aplica un incremento o descuento automático a todos los precios de venta de forma instantánea.
            </p>

            <div className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Categoría a afectar:
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-purple-500 focus:outline-none"
                >
                  <option value="all">Todas las categorías ({products.length} productos)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Porcentaje de variación (%):
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[5, 10, 15, 20].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPriceChangePercent(pct)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        priceChangePercent === pct ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      +{pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={priceChangePercent}
                  onChange={e => setPriceChangePercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Sample preview calculation */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <span className="text-slate-400">Ejemplo de cálculo:</span>
                <div className="flex items-center justify-between font-mono mt-1">
                  <span className="text-slate-300">$10.000</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-bold text-emerald-400">
                    ${Math.round(10000 * (1 + (priceChangePercent / 100))).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              {bulkPriceSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>¡Precios actualizados exitosamente!</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleApplyBulkPriceIncrease}
            disabled={isApplyingBulkPrice || priceChangePercent === 0}
            className="w-full mt-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center space-x-2"
          >
            <TrendingUp className="w-4 h-4" />
            <span>{isApplyingBulkPrice ? 'Aplicando...' : `Aplicar ${priceChangePercent > 0 ? `+${priceChangePercent}%` : `${priceChangePercent}%`} a Precios`}</span>
          </button>
        </div>

        {/* CSV File Upload Section */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
            <Upload className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-white">Cargar Archivo CSV de Productos</h3>
          </div>

          {/* Drag and drop upload zone */}
          <div className="border-2 border-dashed border-slate-800 hover:border-purple-500/60 rounded-2xl p-6 text-center transition-colors bg-slate-950/40">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              id="csv-file-input"
              className="hidden"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-purple-400 mb-2 opacity-80" />
              <p className="text-xs font-medium text-slate-200">
                Arrastra tu archivo CSV aquí o <span className="text-purple-400 underline">haz clic para examinar</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Columnas admitidas: sku, name, salePrice, costPrice, stock, category, supplier
              </p>
            </label>
          </div>

          {/* Or Paste CSV text */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              O pega el contenido CSV directamente:
            </label>
            <textarea
              rows={3}
              placeholder="sku,name,salePrice,costPrice,stock,category,supplier..."
              value={csvText}
              onChange={e => {
                setCsvText(e.target.value);
                if (e.target.value.trim().length > 0) {
                  parseCSV(e.target.value);
                } else {
                  setParsedRows([]);
                  setParseErrors([]);
                }
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Observaciones en el archivo:</span>
              </div>
              {parseErrors.map((err, idx) => (
                <p key={idx} className="text-[11px] pl-5">• {err}</p>
              ))}
            </div>
          )}

          {/* Import Result Feedback */}
          {importResult && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <p className="font-bold">✓ Proceso de importación finalizado:</p>
              <p className="text-[11px] mt-0.5">
                • {importResult.added} productos nuevos creados.<br />
                • {importResult.updated} productos existentes actualizados por SKU.
              </p>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Vista Previa ({parsedRows.length} productos listos):
                </span>
                <button
                  onClick={handleProcessImport}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isProcessing ? 'Procesando...' : `Confirmar Importación (${parsedRows.length})`}</span>
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5">SKU</th>
                      <th className="py-2 px-2.5">Producto</th>
                      <th className="py-2 px-2.5">Costo</th>
                      <th className="py-2 px-2.5">Venta</th>
                      <th className="py-2 px-2.5 text-center">Stock</th>
                      <th className="py-2 px-2.5">Proveedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400">{r.sku || '-'}</td>
                        <td className="py-2 px-2.5 font-medium text-slate-200 truncate max-w-[150px]">{r.name}</td>
                        <td className="py-2 px-2.5">${(r.costPrice ?? 0).toLocaleString('es-AR')}</td>
                        <td className="py-2 px-2.5 font-bold text-emerald-400">${(r.salePrice ?? 0).toLocaleString('es-AR')}</td>
                        <td className="py-2 px-2.5 text-center font-bold">{r.stock}</td>
                        <td className="py-2 px-2.5 text-slate-400">{r.supplier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
