import React from 'react';
import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';

interface ProductGridSkeletonProps {
  count?: number;
  layout?: 'grid' | 'horizontal';
}

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-2 sm:p-2.5 border border-slate-100/90 shadow-sm flex flex-col justify-between animate-pulse">
      {/* Media placeholder */}
      <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden mb-2">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200/50 to-slate-100 animate-shimmer" />
        {/* Fake discount badge */}
        <div className="absolute top-1.5 left-1.5 w-12 h-4 bg-slate-200 rounded-full" />
      </div>

      {/* Product metadata */}
      <div className="space-y-1.5 flex-1">
        {/* Stock / Category pill */}
        <div className="w-16 h-3 bg-slate-200 rounded" />
        
        {/* 2-line title */}
        <div className="w-full h-3.5 bg-slate-200 rounded" />
        <div className="w-3/4 h-3.5 bg-slate-200 rounded" />

        {/* Rating and reviews */}
        <div className="flex items-center gap-1 pt-1">
          <div className="w-3 h-3 bg-slate-200 rounded-full" />
          <div className="w-8 h-2.5 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Price & Action row */}
      <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between">
        <div className="space-y-1">
          <div className="w-10 h-2.5 bg-slate-200 rounded" />
          <div className="w-16 h-5 bg-slate-300 rounded font-semibold" />
        </div>
        <div className="w-8 h-8 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
};

export const ProductGridSkeleton: React.FC<ProductGridSkeletonProps> = ({ 
  count = 8,
  layout = 'grid' 
}) => {
  const items = Array.from({ length: count });

  if (layout === 'horizontal') {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {items.map((_, i) => (
          <div key={i} className="min-w-[155px] max-w-[170px] flex-shrink-0">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {items.map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
};

interface ProductGridErrorProps {
  message?: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

export const ProductGridError: React.FC<ProductGridErrorProps> = ({
  message = 'No se pudo sincronizar el catálogo con Firestore.',
  onRetry,
  isRetrying = false
}) => {
  return (
    <div className="my-8 mx-auto max-w-md p-6 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-center space-y-3 shadow-sm">
      <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
        <WifiOff className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-bold text-slate-800">Falla de conexión al catálogo</h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          {message} Verificá tu red o intentá nuevamente.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-rose-200 disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
        <span>{isRetrying ? 'Reintentando...' : 'Reintentar conexión'}</span>
      </button>
    </div>
  );
};
