import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[VONDRO ErrorBoundary caught]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      localStorage.removeItem('vondro_cart_v2');
      localStorage.removeItem('vondro_favorites_v2');
      localStorage.removeItem('vondro_products_v2');
      localStorage.removeItem('vondro_catalog_sync_version');
      localStorage.removeItem('vondro_recent_categories_v2');
      localStorage.removeItem('vondro_recent_products_v2');
    } catch (_) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mb-4 shadow-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black mb-1 tracking-tight">
            VONDRO Córdoba
          </h2>
          <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
            Se produjo una interrupción momentánea en la visualización. Podés reiniciar la app o limpiar el almacenamiento temporal para continuar navegando normalmente.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recargar aplicación</span>
            </button>

            <button
              onClick={this.handleResetCache}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Limpiar caché y reabrir</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
