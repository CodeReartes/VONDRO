import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatWhatsAppPhone } from '../utils/phoneUtils';

export const FloatingWhatsApp: React.FC = () => {
  const { settings, activeTab } = useStore();

  // Hide or adjust position if on checkout to avoid blocking payment buttons
  if (activeTab === 'checkout') {
    return null;
  }

  const cleanPhone = formatWhatsAppPhone(settings?.whatsappNumber || '3515948952');
  const message = encodeURIComponent(
    `¡Hola! Me comunico desde ${settings.storeName}. Quisiera hacer una consulta sobre los envíos en Córdoba o productos.`
  );

  return (
    <a
      id="btn-floating-whatsapp"
      href={`https://wa.me/${cleanPhone}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-[74px] left-4 md:bottom-6 md:left-6 z-30 w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="w-6 h-6 fill-white" />
      <span className="sr-only">WhatsApp</span>
    </a>
  );
};
