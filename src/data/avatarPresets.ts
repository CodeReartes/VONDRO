export interface AvatarPreset {
  id: string;
  name: string;
  category: string;
  svgUrl: string;
}

// Generate inline SVG Data URIs for colorful, fun, clean avatar presets
const createSvgAvatar = (emoji: string, bg1: string, bg2: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="100" fill="url(#g)"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="100" font-family="sans-serif">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'vondro-star', name: 'Estrella Vondro', category: 'VONDRO', svgUrl: createSvgAvatar('⭐', '#7C3AED', '#4C1D95') },
  { id: 'classic-user', name: 'Cliente Premium', category: 'Clásico', svgUrl: createSvgAvatar('👤', '#3B82F6', '#1E40AF') },
  { id: 'shopper', name: 'Comprador', category: 'Clásico', svgUrl: createSvgAvatar('🛍️', '#EC4899', '#831843') },
  { id: 'fox', name: 'Zorro', category: 'Animales', svgUrl: createSvgAvatar('🦊', '#F97316', '#C2410C') },
  { id: 'cat', name: 'Gato', category: 'Animales', svgUrl: createSvgAvatar('🐱', '#EAB308', '#A16207') },
  { id: 'dog', name: 'Perro', category: 'Animales', svgUrl: createSvgAvatar('🐶', '#10B981', '#047857') },
  { id: 'panda', name: 'Panda', category: 'Animales', svgUrl: createSvgAvatar('🐼', '#64748B', '#0F172A') },
  { id: 'lion', name: 'León', category: 'Animales', svgUrl: createSvgAvatar('🦁', '#F59E0B', '#B45309') },
  { id: 'rocket', name: 'Cohete Fast', category: 'Especial', svgUrl: createSvgAvatar('🚀', '#06B6D4', '#0E7490') },
  { id: 'crown', name: 'VIP Córdoba', category: 'Especial', svgUrl: createSvgAvatar('👑', '#8B5CF6', '#5B21B6') },
  { id: 'heart', name: 'Favoritos', category: 'Especial', svgUrl: createSvgAvatar('💖', '#F43F5E', '#BE123C') },
  { id: 'gem', name: 'Diamante', category: 'Especial', svgUrl: createSvgAvatar('💎', '#0EA5E9', '#0369A1') },
];
