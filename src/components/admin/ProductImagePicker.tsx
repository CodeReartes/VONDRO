import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Link as LinkIcon, Trash2, Star, UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { compressProductImage, convertGoogleDriveUrl, formatFileSize } from '../../utils/imageCompressor';

interface ProductImagePickerProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export const ProductImagePicker: React.FC<ProductImagePickerProps> = ({
  images = [],
  onChange,
  maxImages = 8
}) => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);
  const [driveInputOpen, setDriveInputOpen] = useState(false);
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [driveUrlError, setDriveUrlError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Process a batch of File objects with smart client-side compression
  const handleProcessFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setIsCompressing(true);
    setCompressionStatus('Comprimiendo y optimizando calidad...');

    try {
      const newImages: string[] = [];
      let totalOriginal = 0;
      let totalCompressed = 0;

      for (const file of fileArray) {
        totalOriginal += file.size;
        const result = await compressProductImage(file, 800, 800, 0.76);
        totalCompressed += result.compressedSize;
        newImages.push(result.dataUrl);
      }

      const updated = [...images, ...newImages].slice(0, maxImages);
      onChange(updated);

      const savedPercent = totalOriginal > 0 
        ? Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100) 
        : 0;

      setCompressionStatus(
        `✓ ${newImages.length === 1 ? 'Foto optimizada' : `${newImages.length} fotos optimizadas`}: ${formatFileSize(totalOriginal)} ➔ ${formatFileSize(totalCompressed)} (${savedPercent}% más liviana, máxima nitidez)`
      );

      setTimeout(() => {
        setCompressionStatus(null);
      }, 5000);
    } catch (err: any) {
      setCompressionStatus(`⚠️ Error al procesar la imagen: ${err.message || 'Intenta nuevamente'}`);
      setTimeout(() => setCompressionStatus(null), 4000);
    } finally {
      setIsCompressing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  // Add from Google Drive or Direct URL
  const handleAddDriveOrWebUrl = () => {
    setDriveUrlError(null);
    const trimmed = driveUrlInput.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setDriveUrlError('Por favor ingresá un enlace válido que comience con https://');
      return;
    }

    const { directUrl, isDrive } = convertGoogleDriveUrl(trimmed);

    // Test loading image
    const testImg = new Image();
    testImg.src = directUrl;
    testImg.onload = () => {
      const updated = [...images, directUrl].slice(0, maxImages);
      onChange(updated);
      setDriveUrlInput('');
      setDriveInputOpen(false);
      setCompressionStatus(
        isDrive
          ? '✓ Foto de Google Drive vinculada en alta resolución.'
          : '✓ Foto por enlace agregada exitosamente.'
      );
      setTimeout(() => setCompressionStatus(null), 4000);
    };
    testImg.onerror = () => {
      if (isDrive) {
        setDriveUrlError(
          'No se pudo acceder a la imagen de Drive. Asegurate de que en Google Drive el archivo tenga permiso "Cualquiera que tenga el vínculo puede ver".'
        );
      } else {
        setDriveUrlError('No se pudo cargar la imagen desde ese enlace. Verificá que la URL sea directa.');
      }
    };
  };

  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    const item = images[index];
    const rest = images.filter((_, idx) => idx !== index);
    onChange([item, ...rest]);
  };

  const handleDelete = (index: number) => {
    const rest = images.filter((_, idx) => idx !== index);
    onChange(rest);
  };

  return (
    <div className="space-y-3">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && handleProcessFiles(e.target.files)}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleProcessFiles(e.target.files)}
      />

      {/* Action Buttons Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <span>Fotos del Producto</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
              {images.length}/{maxImages}
            </span>
          </label>
          <p className="text-[11px] text-slate-400">
            Carga fotos desde tu cámara, galería o Google Drive con compresión inteligente sin perder calidad.
          </p>
        </div>
      </div>

      {/* Source Buttons Bar */}
      <div className="grid grid-cols-3 gap-2">
        {/* Button 1: Camera */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isCompressing || images.length >= maxImages}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-gradient-to-b from-purple-50 to-purple-100/80 hover:from-purple-100 hover:to-purple-200 border border-purple-200 text-purple-900 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-xs"
        >
          <Camera className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="truncate">Cámara</span>
        </button>

        {/* Button 2: Gallery */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={isCompressing || images.length >= maxImages}
          className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-gradient-to-b from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-xs"
        >
          <ImageIcon className="w-4 h-4 text-slate-600 shrink-0" />
          <span className="truncate">Galería</span>
        </button>

        {/* Button 3: Drive / Link */}
        <button
          type="button"
          onClick={() => setDriveInputOpen(!driveInputOpen)}
          disabled={isCompressing || images.length >= maxImages}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 border rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-xs ${
            driveInputOpen
              ? 'bg-purple-700 border-purple-700 text-white'
              : 'bg-gradient-to-b from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 text-blue-900'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="truncate">Drive / URL</span>
        </button>
      </div>

      {/* Google Drive / Web URL Input Box */}
      {driveInputOpen && (
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
              Pegar enlace de Google Drive o URL web
            </span>
            <button
              type="button"
              onClick={() => setDriveInputOpen(false)}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              Cerrar
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://drive.google.com/file/d/... o https://ejemplo.com/foto.jpg"
              value={driveUrlInput}
              onChange={(e) => {
                setDriveUrlInput(e.target.value);
                setDriveUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDriveOrWebUrl();
                }
              }}
              className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={handleAddDriveOrWebUrl}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shrink-0 shadow-xs"
            >
              Agregar
            </button>
          </div>

          <p className="text-[10px] text-blue-800 leading-tight">
            💡 <strong>Tip Drive:</strong> En Google Drive, hacé clic derecho en la foto &gt; <em>Compartir</em> &gt; cambiar a <em>"Cualquiera con el enlace"</em> y pegá el link aquí. El sistema lo convertirá automáticamente en visualización directa.
          </p>

          {driveUrlError && (
            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl font-medium flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{driveUrlError}</span>
            </p>
          )}
        </div>
      )}

      {/* Compression progress or success badge */}
      {isCompressing && (
        <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl text-xs font-bold animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          <span>Optimizando foto: reduciendo peso manteniendo nitidez cristalina...</span>
        </div>
      )}

      {compressionStatus && !isCompressing && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="leading-tight">{compressionStatus}</span>
        </div>
      )}

      {/* Images Grid or Empty Dropzone */}
      {images.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
          {images.map((imgUrl, idx) => {
            const isPrimary = idx === 0;
            return (
              <div
                key={idx}
                className={`group relative rounded-2xl overflow-hidden aspect-square border-2 transition-all shadow-xs ${
                  isPrimary ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Producto ${idx + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback placeholder on broken link
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80';
                  }}
                />

                {/* Primary Tag */}
                {isPrimary && (
                  <span className="absolute top-1.5 left-1.5 bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    Portada
                  </span>
                )}

                {/* Action buttons overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      title="Fijar como portada"
                      className="w-7 h-7 rounded-full bg-white text-purple-700 hover:bg-purple-50 flex items-center justify-center shadow-md transition-transform active:scale-90"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    title="Eliminar foto"
                    className="w-7 h-7 rounded-full bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center shadow-md transition-transform active:scale-90"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Mobile tap button for delete (always visible on touch screens) */}
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  className="sm:hidden absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Add more button slot */}
          {images.length < maxImages && (
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-purple-600 transition-all text-xs font-semibold gap-1"
            >
              <span className="text-lg leading-none">+</span>
              <span className="text-[10px]">Agregar</span>
            </button>
          )}
        </div>
      ) : (
        /* Empty State Dropzone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleProcessFiles(e.dataTransfer.files);
          }}
          className={`p-5 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2 ${
            dragOver
              ? 'border-purple-500 bg-purple-50'
              : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-800">Sin fotos cargadas todavía</p>
            <p className="text-[11px] text-slate-400">
              Tomá una foto con la cámara, subí de la galería o pegá un enlace de Drive.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
