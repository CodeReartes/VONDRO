/**
 * Módulo de Geolocalización y Autocompletado Inteligente de Direcciones
 * Especializado para Córdoba Capital, Argentina (VONDRO Delivery)
 */

import { CORDOBA_SHIPPING_ZONES, calculateDistanceInKm, CORDOBA_ORIGIN_COORDINATES } from './cordobaShipping';

export interface GeocodedLocationResult {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  province: string;
  postalCode?: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  matchedZoneId?: string;
  distanceKm?: number;
}

export const KNOWN_CORDOBA_NEIGHBORHOODS = [
  'Villa Martínez',
  'Las Palmas',
  'Santa Ana',
  'Los Plátanos',
  'Rosedal',
  'San Rafael',
  'Residencial San Roque',
  'Villa Unión',
  'Estación Flores',
  'Parque Capital',
  'Alberdi',
  'Alto Alberdi',
  'Observatorio',
  'Centro',
  'Nueva Córdoba',
  'Güemes',
  'General Paz',
  'Alta Córdoba',
  'Cofico',
  'Providencia',
  'San Martín',
  'Crisol',
  'Ducasse',
  'Juniors',
  'Barrio Jardín',
  'Manantiales',
  'Manantiales II',
  'Cerro de las Rosas',
  'Argüello',
  'Villa Belgrano',
  'Urca',
  'Poeta Lugones',
  'San Vicente',
  'Empalme',
  'Iponá',
  'Villa El Libertador',
  'Guiñazú',
  'Los Boulevares',
  'Tablada Park',
  'Alejandro Centeno',
  'Villa Cabrera',
  'Villa Marta',
  'Villa Allende',
  'Villa Allende (Gran Cba)',
  'Saldán',
  'La Calera',
  'Malvinas Argentinas',
  'Mendiolaza',
  'Unquillo',
  'Otro'
];

/**
 * Normaliza nombres de barrios de Córdoba para hacer match flexible
 */
export function normalizeNeighborhoodName(rawName?: string): string {
  if (!rawName) return 'Centro';
  const clean = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  for (const nh of KNOWN_CORDOBA_NEIGHBORHOODS) {
    const normNh = nh.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (clean.includes(normNh) || normNh.includes(clean)) {
      return nh;
    }
  }

  if (clean.includes('martinez')) return 'Villa Martínez';
  if (clean.includes('nueva cba') || clean.includes('nva cba')) return 'Nueva Córdoba';
  if (clean.includes('guemes')) return 'Güemes';
  if (clean.includes('gral paz') || clean.includes('general paz')) return 'General Paz';
  if (clean.includes('alta cba')) return 'Alta Córdoba';
  if (clean.includes('cerro')) return 'Cerro de las Rosas';
  if (clean.includes('manantiales')) return 'Manantiales';
  if (clean.includes('rosedal')) return 'Rosedal';
  if (clean.includes('alberdi')) return 'Alberdi';

  return 'Centro';
}

/**
 * Obtiene las coordenadas GPS del navegador / dispositivo móvil
 */
export function getDeviceCoordinates(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La geolocalización no está soportada en tu navegador o dispositivo.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let msg = 'No se pudo obtener la ubicación.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            msg = 'Permiso de ubicación denegado. Por favor permite el acceso a la ubicación en tu navegador para detectar tu dirección automáticamente.';
            break;
          case error.POSITION_UNAVAILABLE:
            msg = 'La información de ubicación no está disponible en este momento.';
            break;
          case error.TIMEOUT:
            msg = 'Tiempo de espera agotado al obtener la ubicación.';
            break;
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  });
}

export const POPULAR_CORDOBA_LOCATIONS = [
  { street: 'Av. Hipólito Yrigoyen', number: '380', neighborhood: 'Nueva Córdoba', zoneId: 'zona-2' },
  { street: 'Bv. San Juan', number: '650', neighborhood: 'Centro', zoneId: 'zona-2' },
  { street: 'Av. Colón', number: '1450', neighborhood: 'Alberdi', zoneId: 'zona-1' },
  { street: 'Duarte Quirós', number: '2800', neighborhood: 'Alto Alberdi', zoneId: 'zona-1' },
  { street: 'Av. Rafael Núñez', number: '4200', neighborhood: 'Cerro de las Rosas', zoneId: 'zona-3' },
  { street: '24 de Septiembre', number: '1420', neighborhood: 'General Paz', zoneId: 'zona-2' },
  { street: 'Av. Vélez Sarsfield', number: '1100', neighborhood: 'Nueva Córdoba', zoneId: 'zona-2' },
  { street: 'Av. Poeta Lugones', number: '210', neighborhood: 'Nueva Córdoba', zoneId: 'zona-2' },
  { street: 'Av. Gauss', number: '5400', neighborhood: 'Villa Belgrano', zoneId: 'zona-3' },
  { street: 'Av. Cruz Roja Argentina', number: '200', neighborhood: 'Barrio Jardín', zoneId: 'zona-2' },
];

export interface VerifiedAddressCandidate {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source: 'georef_ar' | 'nominatim';
  hasExactNumber: boolean;
  matchedZoneId: string;
  distanceKm: number;
}

/**
 * Separa "Av. Colón 1450" en { street: "Av. Colón", number: "1450" }
 */
export function splitStreetAndNumber(rawStreet: string, explicitNumber?: string): { street: string; number: string } {
  const trimmed = String(rawStreet || '').trim();
  const explicit = String(explicitNumber || '').trim();
  if (explicit) {
    return { street: trimmed, number: explicit };
  }
  const match = trimmed.match(/^(.*?)\s+(\d{1,6}[a-zA-Z]?)$/);
  if (match && match[1].trim().length >= 2) {
    return {
      street: match[1].trim(),
      number: match[2].trim(),
    };
  }
  return { street: trimmed, number: '' };
}

/**
 * Verifica una dirección escrita contra Georef AR (Gobierno Argentino) + OpenStreetMap Nominatim
 * para confirmar que la calle y altura realmente existen en Córdoba y devolver sus coordenadas exactas.
 */
export async function verifyCordobaAddress(params: {
  query?: string;
  street?: string;
  number?: string;
  city?: string;
}): Promise<{
  verified: boolean;
  bestMatch: VerifiedAddressCandidate | null;
  suggestions: VerifiedAddressCandidate[];
  error?: string;
}> {
  const res = await fetch('/api/geo/verify-address', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      verified: false,
      bestMatch: null,
      suggestions: [],
      error: data?.error || 'No se pudo verificar la dirección.',
    };
  }

  const enrich = (item: any): VerifiedAddressCandidate => {
    const distanceKm = calculateDistanceInKm(
      CORDOBA_ORIGIN_COORDINATES.lat,
      CORDOBA_ORIGIN_COORDINATES.lng,
      Number(item.latitude),
      Number(item.longitude)
    );
    const matchedZone =
      CORDOBA_SHIPPING_ZONES.find((z) => distanceKm >= z.minKm && distanceKm <= z.maxKm) ||
      CORDOBA_SHIPPING_ZONES[CORDOBA_SHIPPING_ZONES.length - 1];
    return {
      street: String(item.street || ''),
      number: String(item.number || ''),
      neighborhood: String(item.neighborhood || 'Centro'),
      city: String(item.city || 'Córdoba Capital'),
      province: String(item.province || 'Córdoba'),
      postalCode: String(item.postalCode || '5000'),
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      formattedAddress: String(item.formattedAddress || ''),
      source: item.source === 'georef_ar' ? 'georef_ar' : 'nominatim',
      hasExactNumber: Boolean(item.hasExactNumber),
      matchedZoneId: matchedZone?.id || 'zona-2',
      distanceKm: Math.round(distanceKm * 10) / 10,
    };
  };

  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions.map(enrich) : [];
  return {
    verified: Boolean(data?.verified && suggestions.length > 0),
    bestMatch: suggestions[0] || null,
    suggestions,
  };
}

/**
 * Realiza reverse geocoding para convertir coordenadas (lat, lng) en dirección estructurada de Córdoba
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<GeocodedLocationResult> {
  const distanceKm = calculateDistanceInKm(
    CORDOBA_ORIGIN_COORDINATES.lat,
    CORDOBA_ORIGIN_COORDINATES.lng,
    lat,
    lng
  );

  // Buscar zona por distancia
  let matchedZone = CORDOBA_SHIPPING_ZONES.find(
    (z) => distanceKm >= z.minKm && distanceKm <= z.maxKm
  );
  if (!matchedZone) {
    matchedZone = CORDOBA_SHIPPING_ZONES[CORDOBA_SHIPPING_ZONES.length - 1];
  }

  let street = '';
  let houseNumber = '';
  let neighborhood = 'Centro';
  let city = 'Córdoba Capital';
  let province = 'Córdoba';
  let postalCode = '5000';
  let formatted = '';

  // 0. Try server-side proxy first (avoids browser CORS/User-Agent restrictions on Nominatim & Georef)
  try {
    const serverRes = await fetch('/api/geo/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData?.street) {
        street = serverData.street;
        houseNumber = serverData.number || '';
        neighborhood = serverData.neighborhood || 'Centro';
        city = serverData.city || 'Córdoba Capital';
        province = serverData.province || 'Córdoba';
        postalCode = serverData.postalCode || '5000';
        formatted = serverData.formattedAddress || '';
      }
    }
  } catch (proxyErr) {
    console.warn('Backend /api/geo/reverse fallback:', proxyErr);
  }

  // 1. Try OpenStreetMap Nominatim directly if backend didn't return street
  if (!street) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es`,
        {
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const addr = data.address || {};

        street = addr.road || addr.pedestrian || addr.street || addr.footway || addr.avenue || '';
        houseNumber = addr.house_number || '';
        const rawNeigh = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.residential || '';
        if (rawNeigh) {
          neighborhood = normalizeNeighborhoodName(rawNeigh);
        }
        city = addr.city || addr.town || 'Córdoba Capital';
        province = addr.state || 'Córdoba';
        postalCode = addr.postcode || '5000';
        formatted = data.display_name || '';
      }
    } catch (err) {
      console.warn('Reverse geocoding OSM fallback:', err);
    }
  }

  // 2. Secondary fallback via BigDataCloud client API if street is still missing
  if (!street) {
    try {
      const bdcController = new AbortController();
      const bdcTimeout = setTimeout(() => bdcController.abort(), 4000);
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`,
        { signal: bdcController.signal }
      );
      clearTimeout(bdcTimeout);
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        const streetCandidate = bdcData.locality || bdcData.principalSubdivision || '';
        if (bdcData.localityInfo?.administrative) {
          const roadPart = bdcData.localityInfo.administrative.find((a: any) => a.order >= 7 || a.name?.toLowerCase().includes('calle') || a.name?.toLowerCase().includes('av'));
          if (roadPart) street = roadPart.name;
        }
        if (!street && streetCandidate) {
          street = streetCandidate;
        }
        if (bdcData.locality) {
          neighborhood = normalizeNeighborhoodName(bdcData.locality);
        }
      }
    } catch (e) {
      console.warn('BigDataCloud reverse geocode fallback:', e);
    }
  }

  // 3. Fallback default if street could not be matched
  if (!street) {
    street = 'Av. Colón';
    houseNumber = '1200';
  }

  if (!formatted) {
    formatted = `${street} ${houseNumber}, Barrio ${neighborhood}, ${city}`;
  }

  return {
    street: street.trim(),
    number: houseNumber.trim(),
    neighborhood,
    city: 'Córdoba Capital',
    province: 'Córdoba',
    postalCode,
    formattedAddress: formatted,
    latitude: lat,
    longitude: lng,
    matchedZoneId: matchedZone?.id || 'zona-2',
    distanceKm: Math.round(distanceKm * 10) / 10,
  };
}
