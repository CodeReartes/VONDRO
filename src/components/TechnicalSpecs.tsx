import React from 'react';
import { 
  Ruler, 
  Layers, 
  ShieldCheck, 
  Wrench, 
  CheckCircle2, 
  BadgeCheck, 
  Zap, 
  Gauge, 
  Plug, 
  PackageCheck, 
  Wifi, 
  BatteryCharging, 
  Activity,
  Award,
  ExternalLink
} from 'lucide-react';
import { Product } from '../types/index';
import { getProductSpecifications, StructuredSpecItem } from '../utils/productSpecifications';

interface TechnicalSpecsProps {
  product: Product;
  className?: string;
}

export const TechnicalSpecs: React.FC<TechnicalSpecsProps> = ({ product, className = '' }) => {
  const specs = getProductSpecifications(product);

  const getIcon = (type: StructuredSpecItem['iconType']) => {
    switch (type) {
      case 'power':
        return <Zap className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'pressure':
        return <Gauge className="w-4 h-4 text-cyan-600 shrink-0" />;
      case 'voltage':
        return <Plug className="w-4 h-4 text-indigo-600 shrink-0" />;
      case 'accessories':
      case 'pieces':
        return <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'dimensions':
        return <Ruler className="w-4 h-4 text-purple-600 shrink-0" />;
      case 'capacity':
        return <Layers className="w-4 h-4 text-teal-600 shrink-0" />;
      case 'material':
        return <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />;
      case 'connectivity':
        return <Wifi className="w-4 h-4 text-sky-600 shrink-0" />;
      case 'battery':
        return <BatteryCharging className="w-4 h-4 text-green-600 shrink-0" />;
      case 'speed':
        return <Activity className="w-4 h-4 text-orange-600 shrink-0" />;
      case 'warranty':
        return <Award className="w-4 h-4 text-yellow-600 shrink-0" />;
      case 'assembly':
      case 'tools':
      case 'usage':
      default:
        return <Wrench className="w-4 h-4 text-slate-700 shrink-0" />;
    }
  };

  const getIconBg = (type: StructuredSpecItem['iconType']) => {
    switch (type) {
      case 'power':
        return 'bg-amber-50 border-amber-200/60';
      case 'pressure':
        return 'bg-cyan-50 border-cyan-200/60';
      case 'voltage':
        return 'bg-indigo-50 border-indigo-200/60';
      case 'accessories':
      case 'pieces':
        return 'bg-emerald-50 border-emerald-200/60';
      case 'dimensions':
        return 'bg-purple-50 border-purple-200/60';
      case 'capacity':
        return 'bg-teal-50 border-teal-200/60';
      case 'material':
        return 'bg-blue-50 border-blue-200/60';
      case 'connectivity':
        return 'bg-sky-50 border-sky-200/60';
      case 'battery':
        return 'bg-green-50 border-green-200/60';
      case 'speed':
        return 'bg-orange-50 border-orange-200/60';
      case 'warranty':
        return 'bg-yellow-50 border-yellow-200/60';
      case 'assembly':
      case 'tools':
      case 'usage':
      default:
        return 'bg-slate-100 border-slate-200/80';
    }
  };

  if (!specs || specs.items.length === 0) {
    return null;
  }

  return (
    <div className={`mt-3.5 space-y-3 ${className}`}>
      {/* Specifications Card */}
      <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/80 p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/70">
          <div className="flex items-center gap-1.5">
            <BadgeCheck className="w-4 h-4 text-purple-700" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Especificaciones Técnicas Clave
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
              Catálogo Oficial VONDRO
            </span>
          </div>
        </div>

        {/* Structured Bullets */}
        <ul className="space-y-2.5">
          {specs.items.map((item) => (
            <li 
              key={item.id} 
              className="flex items-start gap-2.5 bg-white/90 rounded-xl p-2.5 border border-slate-200/70 shadow-2xs transition-colors hover:border-slate-300"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${getIconBg(item.iconType)}`}>
                {getIcon(item.iconType)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-slate-400 font-bold select-none">•</span>
                  <span className="text-xs font-extrabold text-slate-900">
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      ({item.sublabel}):
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-700 leading-snug mt-0.5">
                  {item.value}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Extra highlights if available */}
        {specs.additionalHighlights.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-200/70 space-y-1.5">
            <span className="text-[11px] font-extrabold text-slate-700 block uppercase tracking-wider">
              Detalles adicionales destacados
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {specs.additionalHighlights.map((feat, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ProductStructuredSpecs = TechnicalSpecs;
export default TechnicalSpecs;
