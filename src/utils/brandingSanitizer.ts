/**
 * Branding Sanitizer Utility for VONDRO
 * Cleans any supplier/third-party supplier branding mentions (Inova ARG, Inova)
 * from descriptions, titles, badges, and specifications, ensuring 100% VONDRO branding.
 */

import { decodeHtmlEntities } from './imageOptimizer';

export function cleanBrandingText(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';

  const cleaned = decodeHtmlEntities(text);

  return cleaned
    .replace(/con garantía y certificación oficial Inova ARG\./gi, 'con Garantía y Calidad Oficial VONDRO.')
    .replace(/con garantía y certificación oficial Inova\./gi, 'con Garantía y Calidad Oficial VONDRO.')
    .replace(/de calidad garantizada Inova ARG\./gi, 'con Calidad y Garantía Oficial VONDRO.')
    .replace(/de calidad garantizada Inova\./gi, 'con Calidad y Garantía Oficial VONDRO.')
    .replace(/con garantía oficial Inova ARG/gi, 'con Garantía Oficial VONDRO')
    .replace(/con garantía oficial Inova/gi, 'con Garantía Oficial VONDRO')
    .replace(/Garantía y calidad oficial Inova ARG/gi, 'Garantía y Calidad Oficial VONDRO')
    .replace(/Garantía y calidad oficial Inova/gi, 'Garantía y Calidad Oficial VONDRO')
    .replace(/Categoría oficial Inova:/gi, 'Categoría:')
    .replace(/catálogo Inova ARG/gi, 'catálogo oficial VONDRO')
    .replace(/catálogo Inova/gi, 'catálogo oficial VONDRO')
    .replace(/calidad garantizada Inova ARG/gi, 'Calidad Garantizada VONDRO')
    .replace(/calidad garantizada Inova/gi, 'Calidad Garantizada VONDRO')
    .replace(/oficial Inova ARG/gi, 'oficial VONDRO')
    .replace(/oficial Inova/gi, 'oficial VONDRO')
    .replace(/\bInova ARG\b/gi, 'VONDRO')
    .replace(/\bInova\b/gi, 'VONDRO')
    .trim();
}
