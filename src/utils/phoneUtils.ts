export const formatWhatsAppPhone = (phone?: string): string => {
  const raw = (phone || '3515948952').replace(/\D/g, '');
  if (!raw) return '5493515948952';
  if (raw.startsWith('549')) return raw;
  if (raw.startsWith('54')) return `549${raw.slice(2)}`;
  return `549${raw}`;
};
