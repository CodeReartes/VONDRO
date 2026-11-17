import React from 'react';
import { Home, Search, Heart, ShoppingCart, User } from 'lucide-react';
import { useStore, ActiveTab } from '../context/StoreContext';
import { triggerHaptic } from '../utils/native';
import { scrollToTop } from '../utils/scrollHelper';

export const BottomNavigation: React.FC = () => {
  const { activeTab, setActiveTab, cartCount, favorites } = useStore();

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'search', label: 'Buscar', icon: Search },
    { id: 'favorites', label: 'Favoritos', icon: Heart },
    { id: 'cart', label: 'Carrito', icon: ShoppingCart },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <nav 
      id="bottom-navigation-bar" 
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-lg pb-[env(safe-area-inset-bottom)] w-full max-w-full"
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || 
            (item.id === 'home' && activeTab === 'categories') ||
            (item.id === 'home' && activeTab === 'product-detail') ||
            (item.id === 'cart' && activeTab === 'checkout') ||
            (item.id === 'profile' && (activeTab === 'orders' || activeTab === 'order-detail' || activeTab === 'security' || activeTab === 'legal' || activeTab === 'help' || activeTab === 'personal-data'));

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => {
                triggerHaptic('selection');
                scrollToTop();
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative active:scale-90 ${
                isActive ? 'text-purple-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                
                {/* Cart Badge */}
                {item.id === 'cart' && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-purple-600 text-white text-[10px] font-extrabold min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}

                {/* Favorites Badge */}
                {item.id === 'favorites' && favorites.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold min-w-3.5 h-3.5 px-0.5 rounded-full flex items-center justify-center">
                    {favorites.length > 99 ? '99+' : favorites.length}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 bg-purple-600 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
