/**
 * Módulo Oficial de Cálculo Logístico y Costo de Envío - VONDRO Córdoba Capital
 * 
 * 📍 Punto Central de Origen y Despacho: Llanquelén 4741, Villa Martínez, Córdoba Capital
 * Coordenadas de Referencia: Lat -31.4340, Lng -64.2530
 * 
 * Sistema de cotización de cadetería por distancia estilo Uber en tiempo real.
 */

import { CustomerData } from '../types';

export interface ShippingZoneInfo {
  id: string;
  name: string;
  description: string;
  minKm: number;
  maxKm: number;
  basePrice: number;
  estimatedDelivery: string;
  neighborhoods: string[];
}

export interface ShippingCalculationResult {
  costoEnvio: number;
  esEnvioGratis: boolean;
  mensaje: string;
  zona?: ShippingZoneInfo;
  distanciaCalculadaKm?: number;
  subtotal: number;
  montoFaltanteParaGratis: number;
}

export interface UberShippingQuote {
  originAddress: string;
  destinationAddress: string;
  straightDistanceKm: number;
  drivingDistanceKm: number;
  estimatedMinutes: number;
  price: number;
  zoneId: string;
  zoneName: string;
  isCustomDistance: boolean;
}

/** Umbral oficial de envío gratis en Córdoba Capital: Solo gratis si supera los $100.000 ARS */
export const CORDOBA_FREE_SHIPPING_THRESHOLD = 100000;

/** Coordenadas oficiales del punto de origen (Depósito central VONDRO Villa Martínez) */
export const CORDOBA_ORIGIN_COORDINATES = {
  lat: -31.4340,
  lng: -64.2530,
  address: 'Centro de Distribución VONDRO, Córdoba Capital'
};

export const LLANQUELEN_4741_COORDS = CORDOBA_ORIGIN_COORDINATES;

/**
 * Calcula la distancia de viaje en km considerando factores urbanos
 */
export function calculateTripDistanceKm(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  const straightKm = calculateDistanceInKm(origin.lat, origin.lng, destination.lat, destination.lng);
  return Math.max(0.5, Math.round(straightKm * CORDOBA_DRIVING_FACTOR * 10) / 10);
}

/**
 * Estima los minutos de viaje urbano en cadetería
 */
export function estimateTripDurationMinutes(distanceKm: number): number {
  return Math.max(10, Math.round(8 + distanceKm * 2.2));
}

/**
 * Genera el enlace directo a Google Maps con la ruta de navegación trazada
 * desde Llanquelén 4741 (Villa Martínez) hasta el domicilio de entrega
 */
export function getCadeteGoogleMapsNavigationUrl(
  destination: string | { lat: number; lng: number } | Partial<CustomerData>
): string {
  const origin = `${CORDOBA_ORIGIN_COORDINATES.lat},${CORDOBA_ORIGIN_COORDINATES.lng}`;
  let destParam = '';

  if (typeof destination === 'string') {
    destParam = encodeURIComponent(`${destination}, Córdoba, Argentina`);
  } else if ('lat' in destination && 'lng' in destination && typeof destination.lat === 'number' && typeof destination.lng === 'number') {
    destParam = `${destination.lat},${destination.lng}`;
  } else {
    const cust = destination as Partial<CustomerData>;
    if (cust.coordinates?.lat && cust.coordinates?.lng) {
      destParam = `${cust.coordinates.lat},${cust.coordinates.lng}`;
    } else if (cust.latitude && cust.longitude) {
      destParam = `${cust.latitude},${cust.longitude}`;
    } else {
      const parts = [
        cust.address || `${cust.street || ''} ${cust.number || ''}`.trim(),
        cust.neighborhood,
        cust.city || 'Córdoba',
        'Argentina'
      ].filter(Boolean);
      destParam = encodeURIComponent(parts.join(', '));
    }
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destParam}&travelmode=driving`;
}

/**
 * Genera el enlace directo a Waze para navegación del cadete
 */
export function getCadeteWazeNavigationUrl(
  destination: string | { lat: number; lng: number } | Partial<CustomerData>
): string {
  if (typeof destination === 'object') {
    if ('lat' in destination && 'lng' in destination && typeof destination.lat === 'number') {
      return `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`;
    }
    const cust = destination as Partial<CustomerData>;
    if (cust.coordinates?.lat && cust.coordinates?.lng) {
      return `https://waze.com/ul?ll=${cust.coordinates.lat},${cust.coordinates.lng}&navigate=yes`;
    }
    if (cust.latitude && cust.longitude) {
      return `https://waze.com/ul?ll=${cust.latitude},${cust.longitude}&navigate=yes`;
    }
    const query = [cust.address || `${cust.street || ''} ${cust.number || ''}`.trim(), cust.neighborhood, 'Córdoba, Argentina'].filter(Boolean).join(', ');
    return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(`${destination}, Córdoba, Argentina`)}&navigate=yes`;
}

/**
 * Coordenadas de referencia para barrios populares de Córdoba Capital
 * para cálculo de distancia exacto respecto a Llanquelén 4741 (Villa Martínez)
 */
export const CORDOBA_NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  'Villa Martínez': { lat: -31.4340, lng: -64.2530 },
  'Las Palmas': { lat: -31.4172, lng: -64.2448 },
  'Santa Ana': { lat: -31.4285, lng: -64.2380 },
  'Los Plátanos': { lat: -31.4365, lng: -64.2320 },
  'Rosedal': { lat: -31.4420, lng: -64.2350 },
  'San Rafael': { lat: -31.4310, lng: -64.2280 },
  'Residencial San Roque': { lat: -31.4390, lng: -64.2460 },
  'Villa Unión': { lat: -31.4320, lng: -64.2490 },
  'Estación Flores': { lat: -31.4490, lng: -64.2380 },
  'Parque Capital': { lat: -31.4380, lng: -64.2150 },
  'Alto Alberdi': { lat: -31.4150, lng: -64.2180 },
  'Alberdi': { lat: -31.4080, lng: -64.2050 },
  'Manantiales': { lat: -31.4586, lng: -64.2255 },
  'Manantiales II': { lat: -31.4650, lng: -64.2280 },
  'Observatorio': { lat: -31.4250, lng: -64.1950 },
  'Centro': { lat: -31.4167, lng: -64.1833 },
  'Nueva Córdoba': { lat: -31.4290, lng: -64.1870 },
  'Güemes': { lat: -31.4250, lng: -64.1900 },
  'Alta Córdoba': { lat: -31.3980, lng: -64.1820 },
  'General Paz': { lat: -31.4120, lng: -64.1680 },
  'Cofico': { lat: -31.4020, lng: -64.1790 },
  'Providencia': { lat: -31.4020, lng: -64.1920 },
  'San Martín': { lat: -31.3940, lng: -64.1910 },
  'Crisol': { lat: -31.4380, lng: -64.1750 },
  'Ducasse': { lat: -31.4050, lng: -64.1860 },
  'Juniors': { lat: -31.4170, lng: -64.1620 },
  'Barrio Jardín': { lat: -31.4480, lng: -64.1880 },
  'Cerro de las Rosas': { lat: -31.3780, lng: -64.2350 },
  'Urca': { lat: -31.3850, lng: -64.2380 },
  'Villa Belgrano': { lat: -31.3650, lng: -64.2480 },
  'Argüello': { lat: -31.3480, lng: -64.2520 },
  'Poeta Lugones': { lat: -31.3700, lng: -64.2120 },
  'San Vicente': { lat: -31.4280, lng: -64.1550 },
  'Empalme': { lat: -31.4420, lng: -64.1480 },
  'Iponá': { lat: -31.4460, lng: -64.1980 },
  'Villa El Libertador': { lat: -31.4850, lng: -64.2050 },
  'Guiñazú': { lat: -31.3200, lng: -64.1750 },
  'Los Boulevares': { lat: -31.3450, lng: -64.2180 },
  'Tablada Park': { lat: -31.3720, lng: -64.2250 },
  'Alejandro Centeno': { lat: -31.3620, lng: -64.2280 },
  'Villa Cabrera': { lat: -31.3900, lng: -64.2080 },
  'Villa Marta': { lat: -31.3800, lng: -64.2150 },
  'Villa Allende': { lat: -31.2950, lng: -64.2960 },
  'Villa Allende (Gran Cba)': { lat: -31.2950, lng: -64.2960 },
  'Saldán': { lat: -31.3120, lng: -64.3050 },
  'La Calera': { lat: -31.3430, lng: -64.3350 },
  'Malvinas Argentinas': { lat: -31.3850, lng: -64.0750 },
  'Mendiolaza': { lat: -31.2650, lng: -64.3000 },
  'Unquillo': { lat: -31.2350, lng: -64.3150 },
  'Juárez Celman': { lat: -31.2750, lng: -64.1800 },
  'Río Ceballos': { lat: -31.1700, lng: -64.3200 },
  'Coronel Olmedo': { lat: -31.4880, lng: -64.1450 }
};

/**
 * Zonas Oficiales de Envío para Córdoba Capital (calibradas desde Llanquelén 4741, Villa Martínez)
 */
export const CORDOBA_SHIPPING_ZONES: ShippingZoneInfo[] = [
  {
    id: 'zona-1',
    name: 'Zona 1 - Cercana / Villa Martínez (Hasta 4 km)',
    description: 'Villa Martínez, Las Palmas, Santa Ana, Los Plátanos, Rosedal, San Rafael, Villa Unión',
    minKm: 0,
    maxKm: 4,
    basePrice: 3000,
    estimatedDelivery: '24 a 48 hs hábiles',
    neighborhoods: [
      'Villa Martínez',
      'Las Palmas',
      'Santa Ana',
      'Los Plátanos',
      'Rosedal',
      'San Rafael',
      'Residencial San Roque',
      'Villa Unión',
      'Estación Flores',
      'Parque Capital'
    ]
  },
  {
    id: 'zona-2',
    name: 'Zona 2 - Alberdi, Centro y Macrocentro (4 a 8 km)',
    description: 'Alberdi, Alto Alberdi, Observatorio, Centro, Nueva Córdoba, Güemes, Manantiales',
    minKm: 4.01,
    maxKm: 8,
    basePrice: 5000,
    estimatedDelivery: '24 a 48 hs hábiles',
    neighborhoods: [
      'Alberdi',
      'Alto Alberdi',
      'Observatorio',
      'Centro',
      'Nueva Córdoba',
      'Güemes',
      'Manantiales',
      'Manantiales II',
      'Providencia',
      'Ducasse',
      'Barrio Jardín',
      'Crisol'
    ]
  },
  {
    id: 'zona-3',
    name: 'Zona 3 - Periférica / Circunvalación / Norte (8 a 15 km)',
    description: 'Cerro de las Rosas, Urca, Alta Córdoba, General Paz, Cofico, Villa Belgrano, Argüello',
    minKm: 8.01,
    maxKm: 15,
    basePrice: 7500,
    estimatedDelivery: '24 a 72 hs hábiles',
    neighborhoods: [
      'Cerro de las Rosas',
      'Urca',
      'Alta Córdoba',
      'General Paz',
      'Cofico',
      'San Martín',
      'Villa Belgrano',
      'Argüello',
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
      'Juniors'
    ]
  },
  {
    id: 'zona-4',
    name: 'Zona 4 - Gran Córdoba / Fuera de Circunvalación (> 15 km)',
    description: 'Villa Allende, Saldán, La Calera, Malvinas Argentinas, Mendiolaza, Unquillo',
    minKm: 15.01,
    maxKm: 35,
    basePrice: 10000,
    estimatedDelivery: '48 a 72 hs hábiles',
    neighborhoods: [
      'Villa Allende',
      'Villa Allende (Gran Cba)',
      'Saldán',
      'La Calera',
      'Malvinas Argentinas',
      'Mendiolaza',
      'Unquillo',
      'Juárez Celman',
      'Río Ceballos',
      'Coronel Olmedo'
    ]
  }
];

/**
 * Calcula la distancia en línea recta (Haversine) en kilómetros entre 2 coordenadas
 */
export function calculateDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Factor de ruteo urbano para Córdoba Capital (similar a Uber / Waze)
 * La distancia recta Haversine se multiplica por 1.28x para reflejar calles reales y avenidas.
 */
export const CORDOBA_DRIVING_FACTOR = 1.28;

/**
 * 🚗 Sistema Uber de Cotización de Cadetería por Distancia en Tiempo Real
 * Origen: Llanquelén 4741, Villa Martínez
 */
export function calculateUberCadeteriaFare(
  destLat: number,
  destLng: number,
  destinationName?: string
): UberShippingQuote {
  const straightKm = calculateDistanceInKm(
    CORDOBA_ORIGIN_COORDINATES.lat,
    CORDOBA_ORIGIN_COORDINATES.lng,
    destLat,
    destLng
  );

  const drivingKm = Math.max(0.5, Math.round(straightKm * CORDOBA_DRIVING_FACTOR * 10) / 10);

  // Tarifa estilo Uber Flash en Córdoba:
  // Bajada de bandera base: $2.500 (hasta 2 km) + $450 por km adicional
  let fare = 2800;
  if (drivingKm > 2.5) {
    fare = 2800 + Math.round((drivingKm - 2.5) * 450);
  }
  // Redondeo comercial a la centena superior
  fare = Math.ceil(fare / 100) * 100;
  fare = Math.max(2800, fare);

  // Tiempo estimado de viaje en cadetería en moto/auto: 2.2 min por km + 8 min preparación
  const estMins = Math.max(12, Math.round(8 + drivingKm * 2.2));

  let zoneId = 'zona-1';
  let zoneName = 'Zona 1 - Villa Martínez y Alrededores';
  if (drivingKm > 15) {
    zoneId = 'zona-4';
    zoneName = 'Zona 4 - Gran Córdoba';
  } else if (drivingKm > 8) {
    zoneId = 'zona-3';
    zoneName = 'Zona 3 - Periférica / Norte';
  } else if (drivingKm > 4) {
    zoneId = 'zona-2';
    zoneName = 'Zona 2 - Alberdi, Centro y Macrocentro';
  }

  return {
    originAddress: CORDOBA_ORIGIN_COORDINATES.address,
    destinationAddress: destinationName || 'Domicilio en Córdoba',
    straightDistanceKm: Math.round(straightKm * 10) / 10,
    drivingDistanceKm: drivingKm,
    estimatedMinutes: estMins,
    price: fare,
    zoneId,
    zoneName,
    isCustomDistance: true
  };
}

/**
 * Coordenadas de referencia para avenidas principales de Córdoba
 * Útil para calcular distancia real cuando se ingresa la calle manualmente
 */
export const CORDOBA_MAIN_AVENUES_COORDS: Record<string, { lat: number; lng: number }> = {
  'japón': { lat: -31.3480, lng: -64.1950 },
  'japon': { lat: -31.3480, lng: -64.1950 },
  'la voz del interior': { lat: -31.3420, lng: -64.2080 },
  'monseñor pablo cabrera': { lat: -31.3650, lng: -64.2050 },
  'pablo cabrera': { lat: -31.3650, lng: -64.2050 },
  'rafael núñez': { lat: -31.3780, lng: -64.2350 },
  'rafael nunez': { lat: -31.3780, lng: -64.2350 },
  'recta martinolli': { lat: -31.3550, lng: -64.2550 },
  'martinolli': { lat: -31.3550, lng: -64.2550 },
  'juan b. justo': { lat: -31.3650, lng: -64.1750 },
  'juan b justo': { lat: -31.3650, lng: -64.1750 },
  'sabattini': { lat: -31.4420, lng: -64.1480 },
  'armada argentina': { lat: -31.4850, lng: -64.2050 },
  'o\'higgins': { lat: -31.4650, lng: -64.1700 },
  'ohiggins': { lat: -31.4650, lng: -64.1700 },
  'valparaíso': { lat: -31.4550, lng: -64.1850 },
  'valparaiso': { lat: -31.4550, lng: -64.1850 },
  'colón': { lat: -31.4120, lng: -64.2180 },
  'colon': { lat: -31.4120, lng: -64.2180 },
  'duarte quirós': { lat: -31.4250, lng: -64.2300 },
  'duarte quiros': { lat: -31.4250, lng: -64.2300 },
  'vélez sarsfield': { lat: -31.4320, lng: -64.1900 },
  'velez sarsfield': { lat: -31.4320, lng: -64.1900 },
  'santa ana': { lat: -31.4285, lng: -64.2380 },
  'fuerza aérea': { lat: -31.4380, lng: -64.2250 },
  'fuerza aerea': { lat: -31.4380, lng: -64.2250 },
};

/**
 * Obtener coordenadas aproximadas de una calle o avenida de Córdoba
 */
export function getCoordinatesForStreet(streetName?: string): { lat: number; lng: number } | null {
  if (!streetName) return null;
  const clean = streetName.toLowerCase().trim();

  for (const [avenue, coords] of Object.entries(CORDOBA_MAIN_AVENUES_COORDS)) {
    if (clean.includes(avenue)) {
      return coords;
    }
  }
  return null;
}

/**
 * Obtener coordenadas aproximadas de un barrio de Córdoba
 */
export function getCoordinatesForNeighborhood(neighborhoodName?: string): { lat: number; lng: number } {
  if (!neighborhoodName) {
    return CORDOBA_NEIGHBORHOOD_COORDS['Centro'] || { lat: -31.4167, lng: -64.1833 };
  }
  const clean = neighborhoodName.trim().toLowerCase();

  for (const [name, coords] of Object.entries(CORDOBA_NEIGHBORHOOD_COORDS)) {
    if (clean.includes(name.toLowerCase()) || name.toLowerCase().includes(clean)) {
      return coords;
    }
  }

  if (clean.includes('villa martinez') || clean.includes('martinez')) return CORDOBA_NEIGHBORHOOD_COORDS['Villa Martínez'];
  if (clean.includes('nueva cba') || clean.includes('nva cba')) return CORDOBA_NEIGHBORHOOD_COORDS['Nueva Córdoba'];
  if (clean.includes('guemes')) return CORDOBA_NEIGHBORHOOD_COORDS['Güemes'];
  if (clean.includes('gral paz') || clean.includes('general paz')) return CORDOBA_NEIGHBORHOOD_COORDS['General Paz'];
  if (clean.includes('alta cba')) return CORDOBA_NEIGHBORHOOD_COORDS['Alta Córdoba'];
  if (clean.includes('cerro')) return CORDOBA_NEIGHBORHOOD_COORDS['Cerro de las Rosas'];

  return CORDOBA_NEIGHBORHOOD_COORDS['Centro'] || { lat: -31.4167, lng: -64.1833 };
}

export interface RequiredZoneResult {
  requiredZone: {
    id: string;
    name: string;
    price: number;
    description?: string;
  };
  minimumPrice: number;
  drivingDistanceKm: number;
  reason: string;
}

/**
 * 🔒 Determina la zona mínima obligatoria según la distancia real en km y ubicación geográfica
 * Impide que un cliente con domicilio distante elija una zona más barata evadiendo el costo real.
 */
export function getRequiredMinimumZone(
  drivingDistanceKm: number,
  shippingZones: Array<{ id: string; name: string; price: number; description?: string; neighborhoods?: string[] }>,
  neighborhood?: string,
  latitude?: number,
  longitude?: number,
  street?: string
): RequiredZoneResult {
  const fallback = {
    requiredZone: { id: 'zona-1', name: 'Zona 1', price: 3500 },
    minimumPrice: 3500,
    drivingDistanceKm,
    reason: 'Tarifa base'
  };

  if (!shippingZones || shippingZones.length === 0) {
    return fallback;
  }

  // Ordenar zonas disponibles por precio de menor a mayor
  const sorted = [...shippingZones].sort((a, b) => (a.price || 0) - (b.price || 0));

  // Comprobar cuadrante geográfico si las zonas tienen nombres descriptivos (Norte, Sur, Periferia, etc.)
  const isNorth = (latitude && latitude > -31.41) || 
    (street && /jap[oó]n|aeropuerto|newbery|gui[ñn]az[uú]|arg[uü]ello|cerro|belgrano|urca|poeta/i.test(street)) ||
    (neighborhood && /norte|arg[uü]ello|cerro|belgrano|urca|poeta|gui[ñn]az[uú]/i.test(neighborhood));

  const isSouth = (latitude && latitude < -31.45) ||
    (street && /sabattini|armada|v[eé]lez sarsfield.*(3|4|5|6)\d{3}|o'higgins|jard[ií]n/i.test(street)) ||
    (neighborhood && /sur|jard[ií]n|empalme|libertador|san vicente|ipon[aá]/i.test(neighborhood));

  // Asignación por umbral de distancia en ruta:
  // Zona 1 (e.g. $3.500): 0 a 4.5 km (Cercana / Centro / Suroeste)
  // Zona 2 (e.g. $4.500): 4.51 a 9.0 km (Norte / Macrocentro)
  // Zona 3 (e.g. $5.500): 9.01 a 15.0 km (Sur / Periférica)
  // Zona 4 (e.g. $6.500): > 15.0 km (Periferia y Gran Córdoba)
  let targetTier = 0;
  if (drivingDistanceKm > 15.0) {
    targetTier = Math.min(3, sorted.length - 1);
  } else if (drivingDistanceKm > 8.5) {
    targetTier = Math.min(2, sorted.length - 1);
  } else if (drivingDistanceKm > 4.5) {
    targetTier = Math.min(1, sorted.length - 1);
  }

  // Si está en el cuadrante Norte y hay una zona explícita "Norte" (como Zona 2 - Norte $4.500 en la captura)
  if (isNorth) {
    const northZoneIdx = sorted.findIndex(z => z.name.toLowerCase().includes('norte') || z.description?.toLowerCase().includes('norte'));
    if (northZoneIdx !== -1 && northZoneIdx >= 1) {
      targetTier = Math.max(targetTier, northZoneIdx);
    }
  } else if (isSouth) {
    const southZoneIdx = sorted.findIndex(z => z.name.toLowerCase().includes('sur') || z.description?.toLowerCase().includes('sur'));
    if (southZoneIdx !== -1 && southZoneIdx >= 1) {
      targetTier = Math.max(targetTier, southZoneIdx);
    }
  }

  // Si el barrio coincide explícitamente con la descripción o lista de una zona:
  if (neighborhood && neighborhood !== 'Otro') {
    const cleanN = neighborhood.toLowerCase();
    const explicitIdx = sorted.findIndex(z => 
      z.description?.toLowerCase().includes(cleanN) ||
      z.neighborhoods?.some(n => n.toLowerCase().includes(cleanN))
    );
    if (explicitIdx !== -1) {
      targetTier = Math.max(targetTier, explicitIdx);
    }
  }

  const selectedTarget = sorted[targetTier] || sorted[0];

  return {
    requiredZone: selectedTarget,
    minimumPrice: selectedTarget.price || 0,
    drivingDistanceKm,
    reason: `Distancia calculada: ${drivingDistanceKm} km desde Villa Martínez`
  };
}

/**
 * Obtener zona por distancia en kilómetros desde Llanquelén 4741 (Villa Martínez)
 */
export function getZoneByDistance(distanceKm: number): ShippingZoneInfo {
  if (distanceKm <= 4) {
    return CORDOBA_SHIPPING_ZONES[0]; // Zona 1 ($3.000)
  }
  if (distanceKm <= 8) {
    return CORDOBA_SHIPPING_ZONES[1]; // Zona 2 ($5.000)
  }
  if (distanceKm <= 15) {
    return CORDOBA_SHIPPING_ZONES[2]; // Zona 3 ($7.500)
  }
  return CORDOBA_SHIPPING_ZONES[3]; // Zona 4 ($10.000)
}

/**
 * Obtener zona por nombre de barrio de Córdoba Capital
 */
export function getZoneByNeighborhood(neighborhoodName: string): ShippingZoneInfo {
  if (!neighborhoodName) return CORDOBA_SHIPPING_ZONES[1]; // Default Zona 2 Centro

  const normalized = neighborhoodName.toLowerCase().trim();

  for (const zone of CORDOBA_SHIPPING_ZONES) {
    const match = zone.neighborhoods.some(n => normalized.includes(n.toLowerCase()) || n.toLowerCase().includes(normalized));
    if (match) {
      return zone;
    }
  }

  // Fallbacks adaptados al origen Llanquelén 4741, Villa Martínez
  if (
    normalized.includes('martinez') || 
    normalized.includes('palmas') || 
    normalized.includes('santa ana') || 
    normalized.includes('plátanos') || 
    normalized.includes('rosedal') ||
    normalized.includes('san rafael') ||
    normalized.includes('villa union')
  ) {
    return CORDOBA_SHIPPING_ZONES[0];
  }
  if (
    normalized.includes('alberdi') || 
    normalized.includes('centro') || 
    normalized.includes('nueva') || 
    normalized.includes('güemes') || 
    normalized.includes('manantiales') ||
    normalized.includes('observatorio')
  ) {
    return CORDOBA_SHIPPING_ZONES[1];
  }
  if (
    normalized.includes('cerro') || 
    normalized.includes('argüello') || 
    normalized.includes('belgrano') || 
    normalized.includes('urca') || 
    normalized.includes('general paz') ||
    normalized.includes('alta') ||
    normalized.includes('vicente')
  ) {
    return CORDOBA_SHIPPING_ZONES[2];
  }
  if (
    normalized.includes('allende') || 
    normalized.includes('calera') || 
    normalized.includes('saldan') || 
    normalized.includes('malvinas') ||
    normalized.includes('mendiolaza')
  ) {
    return CORDOBA_SHIPPING_ZONES[3];
  }

  return CORDOBA_SHIPPING_ZONES[1];
}

/**
 * 🎯 Función Principal de Cálculo de Costo de Envío
 * - Envío GRATIS si el subtotal supera o iguala los $100.000 ARS.
 * - Si es menor a $100.000, se cobra la tarifa de cadetería por distancia desde Llanquelén 4741 (Villa Martínez).
 */
export function calculateCordobaShipping(
  subtotalPedido: number,
  distanciaOBarrio: number | string
): ShippingCalculationResult {
  const safeSubtotal = Math.max(0, Number(subtotalPedido) || 0);
  const faltanteParaGratis = Math.max(0, CORDOBA_FREE_SHIPPING_THRESHOLD - safeSubtotal);
  const esEnvioGratis = safeSubtotal >= CORDOBA_FREE_SHIPPING_THRESHOLD;

  let zone: ShippingZoneInfo;
  let km: number | undefined;

  if (typeof distanciaOBarrio === 'number') {
    km = Math.max(0, distanciaOBarrio);
    if (km > 35) {
      return {
        costoEnvio: esEnvioGratis ? 0 : 15000,
        esEnvioGratis,
        mensaje: esEnvioGratis
          ? `¡Envío GRATIS aplicado por superar los $${CORDOBA_FREE_SHIPPING_THRESHOLD.toLocaleString('es-AR')}!`
          : `Ubicación fuera del radio urbano estándar (${km.toFixed(1)} km). Tarifa especial Gran Córdoba.`,
        distanciaCalculadaKm: km,
        subtotal: safeSubtotal,
        montoFaltanteParaGratis: faltanteParaGratis
      };
    }
    zone = getZoneByDistance(km);
  } else {
    const byId = CORDOBA_SHIPPING_ZONES.find(z => z.id === distanciaOBarrio);
    if (byId) {
      zone = byId;
    } else {
      zone = getZoneByNeighborhood(distanciaOBarrio);
    }
  }

  if (esEnvioGratis) {
    return {
      costoEnvio: 0,
      esEnvioGratis: true,
      mensaje: `¡Envío GRATIS en Córdoba Capital por superar los $${CORDOBA_FREE_SHIPPING_THRESHOLD.toLocaleString('es-AR')}!`,
      zona: zone,
      distanciaCalculadaKm: km,
      subtotal: safeSubtotal,
      montoFaltanteParaGratis: 0
    };
  }

  return {
    costoEnvio: zone.basePrice,
    esEnvioGratis: false,
    mensaje: `Cadetería por distancia: $${zone.basePrice.toLocaleString('es-AR')} (${zone.name}) desde Centro de Distribución VONDRO. ¡Sumá $${faltanteParaGratis.toLocaleString('es-AR')} para Envío GRATIS (desde $100.000)!`,
    zona: zone,
    distanciaCalculadaKm: km,
    subtotal: safeSubtotal,
    montoFaltanteParaGratis: faltanteParaGratis
  };
}

/**
 * Integración opcional con Google Maps Distance Matrix API
 */
export async function calculateDistanceWithGoogleMaps(
  destinationAddressOrCoords: string | { lat: number; lng: number },
  apiKey?: string
): Promise<{ distanceKm: number; durationText: string } | null> {
  try {
    const origin = `${CORDOBA_ORIGIN_COORDINATES.lat},${CORDOBA_ORIGIN_COORDINATES.lng}`;
    const destination = typeof destinationAddressOrCoords === 'string'
      ? encodeURIComponent(`${destinationAddressOrCoords}, Córdoba, Argentina`)
      : `${destinationAddressOrCoords.lat},${destinationAddressOrCoords.lng}`;

    if (!apiKey) {
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&language=es&region=ar&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
      const element = data.rows[0].elements[0];
      const distanceMeters = element.distance.value;
      const durationText = element.duration.text;
      const distanceKm = distanceMeters / 1000;

      return {
        distanceKm,
        durationText
      };
    }
    return null;
  } catch (err) {
    console.warn('Error al consultar Google Maps Distance Matrix:', err);
    return null;
  }
}
