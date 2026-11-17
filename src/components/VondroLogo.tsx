import React from 'react';

interface VondroLogoProps {
  variant?: 'full' | 'horizontal' | 'icon' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  className?: string;
}

export const VondroLogo: React.FC<VondroLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  showSlogan = false,
  className = ''
}) => {
  // Dimensions based on size
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20'
  };

  const textSizes = {
    sm: 'text-base font-black',
    md: 'text-xl font-black tracking-tight',
    lg: 'text-2xl font-black tracking-tight',
    xl: 'text-4xl font-black tracking-wider'
  };

  // Icon SVG rendering the official VONDRO dynamic bag logo
  const renderIconSvg = () => (
    <svg 
      viewBox="0 0 200 200" 
      className={`${iconSizes[size]} shrink-0 transition-transform duration-200`}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="vondroBagGrad" x1="40" y1="30" x2="170" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
        <linearGradient id="vondroSpeedGrad" x1="10" y1="90" x2="80" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id="vondroShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#4C1D95" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Speed Motion Lines on Left */}
      <rect x="24" y="76" width="38" height="7" rx="3.5" fill="url(#vondroSpeedGrad)" />
      <rect x="12" y="94" width="54" height="8" rx="4" fill="url(#vondroSpeedGrad)" />
      <rect x="28" y="113" width="30" height="7" rx="3.5" fill="url(#vondroSpeedGrad)" />

      {/* Bag Handle */}
      <path 
        d="M74 58 C74 34, 126 34, 126 58" 
        stroke="url(#vondroBagGrad)" 
        strokeWidth="11" 
        strokeLinecap="round" 
        fill="none" 
      />

      {/* Bag Body */}
      <path 
        d="M62 60 H138 C146 60, 153 66, 154 74 L162 144 C163 154, 155 162, 145 162 H55 C45 162, 37 154, 38 144 L46 74 C47 66, 54 60, 62 60 Z" 
        fill="url(#vondroBagGrad)" 
        filter="url(#vondroShadow)"
      />

      {/* Stylized Dynamic White "V" Cutout with speed flow */}
      <path 
        d="M48 84 C72 84, 82 92, 102 146 C118 96, 138 72, 172 68 C150 82, 134 116, 114 162 C104 162, 94 158, 90 148 L62 94 C56 86, 50 84, 48 84 Z" 
        fill="#FFFFFF" 
      />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{renderIconSvg()}</div>;
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center text-center select-none ${className}`}>
        {renderIconSvg()}
        <div className="mt-3">
          <span className={`${textSizes[size]} font-black text-slate-900 tracking-wider font-sans uppercase`}>
            VONDRO
          </span>
        </div>
        {showSlogan && (
          <div className="w-full mt-2 pt-1 border-t border-purple-300 max-w-[200px]">
            <p className="text-[9px] font-bold text-purple-900 tracking-wider uppercase">
              TODO LO QUE NECESITÁS, MÁS CERCA.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Horizontal variant (Ideal for header and navbar)
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {renderIconSvg()}
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`${textSizes[size]} text-slate-950 font-black tracking-tight font-sans`}>
            VONDRO
          </span>
          <span className="text-[10px] font-extrabold text-purple-700 bg-purple-100/90 px-1.5 py-0.5 rounded-md leading-none">
            CBA
          </span>
        </div>
        {showSlogan && (
          <span className="text-[9px] font-bold text-slate-500 tracking-tight mt-0.5 leading-tight">
            Todo lo que necesitás, más cerca.
          </span>
        )}
      </div>
    </div>
  );
};
