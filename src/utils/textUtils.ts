/**
 * Utility to format category and subcategory names into clean Title Case
 * (e.g., "HOGAR" -> "Hogar", "AUDIO Y SONIDO" -> "Audio y Sonido", "VASOS Y BOTELLAS" -> "Vasos y Botellas")
 */
export const formatCategoryName = (name: string): string => {
  if (!name) return '';
  const lowerWords = ['y', 'de', 'en', 'con', 'para', 'o', 'del', 'la', 'el', 'los', 'las'];
  
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (word.length === 0) return '';
      // Special acronyms/brands
      if (word === 'led') return 'LED';
      if (word === 'rgb') return 'RGB';
      if (word === 'usb') return 'USB';
      if (word === 'usb-c') return 'USB-C';
      if (word === '3d') return '3D';
      if (word === 'tws') return 'TWS';
      if (word === 'iphone') return 'iPhone';
      
      if (index > 0 && lowerWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

/**
 * Formats full user names into clean Title Case
 * (e.g. "catalina milagros reartes" -> "Catalina Milagros Reartes")
 */
export const formatUserName = (name?: string): string => {
  if (!name || !name.trim()) return 'Cliente VONDRO';
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
