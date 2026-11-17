import { Product, ProductSpecifications } from '../types/index';

export interface StructuredSpecItem {
  id: string;
  label: string;
  sublabel?: string;
  value: string;
  iconType: 'dimensions' | 'capacity' | 'material' | 'assembly' | 'tools' | 'pieces' | 'usage' | 'power' | 'pressure' | 'voltage' | 'accessories' | 'connectivity' | 'battery' | 'speed' | 'warranty';
}

export interface ResolvedProductSpecs {
  dimensions?: string;
  capacity?: string;
  material?: string;
  assemblySystem?: string;
  power?: string;
  voltage?: string;
  pressureOrCapacity?: string;
  accessoriesIncluded?: string;
  items: StructuredSpecItem[];
  additionalHighlights: string[];
}

/**
 * Resolves structured specifications dynamically from the SKU database record,
 * reading explicit fields from `product.specifications`, `product.technicalSpecs`, `product.attributes`,
 * or intelligently deriving domain-specific attributes for Electrodomésticos, Herramientas,
 * Tecnología, Belleza, Termos y Organizadores.
 */
export function getProductSpecifications(product: Product): ResolvedProductSpecs {
  if (!product) {
    return {
      items: [],
      additionalHighlights: []
    };
  }

  const explicit: ProductSpecifications | undefined = product.specifications;
  const nameLower = (product.name || '').toLowerCase();
  const descLower = (product.description || '').toLowerCase();
  const catLower = (product.categoryId || '').toLowerCase();
  const subCatLower = (product.subcategoryId || '').toLowerCase();
  const sku = (product.sku || '').toUpperCase();

  // 1. DIRECT CUSTOM SPECS ARRAY FROM DATABASE
  if (explicit?.customSpecs && explicit.customSpecs.length > 0) {
    const items: StructuredSpecItem[] = explicit.customSpecs.map(cs => ({
      id: cs.id,
      label: cs.label,
      sublabel: cs.sublabel,
      value: cs.value,
      iconType: cs.iconType || 'dimensions'
    }));

    return {
      dimensions: explicit.dimensions || explicit.measuresIncluded,
      capacity: explicit.capacity || explicit.piecesIncluded,
      material: explicit.material,
      assemblySystem: explicit.assemblySystem || explicit.usage,
      power: explicit.power,
      voltage: explicit.voltage,
      pressureOrCapacity: explicit.pressureOrCapacity || explicit.pressure,
      accessoriesIncluded: explicit.accessoriesIncluded,
      items,
      additionalHighlights: explicit.additionalFeatures || []
    };
  }

  // 2. DYNAMIC RECORD / ATTRIBUTES OBJECT FROM DATABASE (product.technicalSpecs or product.attributes)
  const rawTechSpecs = product.technicalSpecs || product.attributes;
  if (rawTechSpecs) {
    const itemsFromRaw: StructuredSpecItem[] = [];

    if (Array.isArray(rawTechSpecs)) {
      rawTechSpecs.forEach((attr: any, idx: number) => {
        if (!attr) return;
        const label = attr.label || attr.name || attr.key || `Atributo ${idx + 1}`;
        const val = String(attr.value || attr.val || '');
        if (val) {
          const lLower = label.toLowerCase();
          let iconType: StructuredSpecItem['iconType'] = 'dimensions';
          if (lLower.includes('potencia') || lLower.includes('watt') || lLower.includes('w')) iconType = 'power';
          else if (lLower.includes('presi') || lLower.includes('bar') || lLower.includes('vapor') || lLower.includes('agua')) iconType = 'pressure';
          else if (lLower.includes('volt') || lLower.includes('v') || lLower.includes('tensi') || lLower.includes('eléctr')) iconType = 'voltage';
          else if (lLower.includes('accesorio') || lLower.includes('incluid') || lLower.includes('kit')) iconType = 'accessories';
          else if (lLower.includes('material') || lLower.includes('acero') || lLower.includes('cuerpo')) iconType = 'material';
          else if (lLower.includes('pieza') || lLower.includes('set') || lLower.includes('capacidad')) iconType = 'capacity';
          else if (lLower.includes('bater') || lLower.includes('autonom')) iconType = 'battery';
          else if (lLower.includes('conec') || lLower.includes('bluetooth')) iconType = 'connectivity';
          else if (lLower.includes('medida') || lLower.includes('dimensi') || lLower.includes('tam')) iconType = 'dimensions';
          else if (lLower.includes('uso') || lLower.includes('taller') || lLower.includes('herramienta')) iconType = 'usage';

          itemsFromRaw.push({
            id: `attr-${idx}`,
            label,
            sublabel: attr.sublabel,
            value: val,
            iconType: attr.iconType || iconType
          });
        }
      });
    } else if (typeof rawTechSpecs === 'object') {
      Object.entries(rawTechSpecs).forEach(([key, val], idx) => {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const kLower = key.toLowerCase();
          let iconType: StructuredSpecItem['iconType'] = 'dimensions';
          if (kLower.includes('potencia') || kLower.includes('watt') || kLower.includes('w')) iconType = 'power';
          else if (kLower.includes('presi') || kLower.includes('bar') || kLower.includes('vapor') || kLower.includes('agua')) iconType = 'pressure';
          else if (kLower.includes('volt') || kLower.includes('v') || kLower.includes('tensi')) iconType = 'voltage';
          else if (kLower.includes('accesorio') || kLower.includes('incluid') || kLower.includes('kit')) iconType = 'accessories';
          else if (kLower.includes('material') || kLower.includes('acero')) iconType = 'material';
          else if (kLower.includes('pieza') || kLower.includes('set') || kLower.includes('capacidad')) iconType = 'capacity';
          else if (kLower.includes('bater') || kLower.includes('autonom')) iconType = 'battery';
          else if (kLower.includes('conec') || kLower.includes('bluetooth')) iconType = 'connectivity';
          else if (kLower.includes('medida') || kLower.includes('dimensi')) iconType = 'dimensions';
          else if (kLower.includes('uso') || kLower.includes('taller')) iconType = 'usage';

          itemsFromRaw.push({
            id: `tech-${idx}`,
            label: key,
            value: String(val),
            iconType
          });
        }
      });
    }

    if (itemsFromRaw.length > 0) {
      return {
        items: itemsFromRaw,
        additionalHighlights: explicit?.additionalFeatures || []
      };
    }
  }

  // 3. EXPLICIT APPLIANCE / ELECTRODOMÉSTICO SPECIFICATIONS IN DATABASE (power, pressure, voltage, accessories)
  if (explicit && (explicit.power || explicit.pressure || explicit.pressureOrCapacity || explicit.voltage || explicit.accessoriesIncluded)) {
    const items: StructuredSpecItem[] = [];

    if (explicit.power) {
      items.push({
        id: 'power',
        label: 'Potencia',
        sublabel: 'Rendimiento y consumo eléctrico',
        value: explicit.power,
        iconType: 'power'
      });
    }

    if (explicit.pressureOrCapacity || explicit.pressure || explicit.waterCapacity) {
      items.push({
        id: 'pressure',
        label: 'Presión / Capacidad de agua',
        sublabel: 'Bares de vapor y volumen de caldera/tanque',
        value: explicit.pressureOrCapacity || explicit.pressure || explicit.waterCapacity || '',
        iconType: 'pressure'
      });
    } else if (explicit.capacity) {
      items.push({
        id: 'capacity',
        label: 'Capacidad',
        sublabel: 'Volumen útil de trabajo',
        value: explicit.capacity,
        iconType: 'capacity'
      });
    }

    if (explicit.voltage) {
      items.push({
        id: 'voltage',
        label: 'Voltaje',
        sublabel: 'Tensión eléctrica de red y frecuencia',
        value: explicit.voltage,
        iconType: 'voltage'
      });
    }

    if (explicit.accessoriesIncluded) {
      items.push({
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Kit y boquillas de trabajo',
        value: explicit.accessoriesIncluded,
        iconType: 'accessories'
      });
    }

    if (explicit.material && items.length < 4) {
      items.push({
        id: 'material',
        label: 'Material',
        sublabel: 'Composición y estructura',
        value: explicit.material,
        iconType: 'material'
      });
    }

    if (explicit.usage && items.length < 4) {
      items.push({
        id: 'usage',
        label: 'Uso recomendado',
        sublabel: 'Aplicación y destino',
        value: explicit.usage,
        iconType: 'usage'
      });
    }

    return {
      power: explicit.power,
      pressureOrCapacity: explicit.pressureOrCapacity || explicit.pressure,
      voltage: explicit.voltage,
      accessoriesIncluded: explicit.accessoriesIncluded,
      material: explicit.material,
      items,
      additionalHighlights: explicit.additionalFeatures || [
        'Componentes con certificación de seguridad eléctrica IRAM',
        'Protección térmica automática contra sobrecalentamiento',
        'Garantía oficial y servicio de soporte técnico nacional'
      ]
    };
  }

  // --- 4. IDENTIFICACIÓN DE DOMINIO Y CATEGORÍAS ---
  // A. Secadores de Pelo (Hair Dryers) - Prioridad alta para evitar colisiones
  const isHairDryer = 
    product.id === 'prod-inova-secador-de-pelo-oryx-or-7015p' ||
    product.id === 'prod-inova-secador-de-pelo-oryx-con-difusor' ||
    product.id === 'prod-inova-secador-de-pelo-osr-or9046' ||
    nameLower.includes('secador de pelo') ||
    nameLower.includes('secador para pelo') ||
    nameLower.includes('secador de cabello') ||
    nameLower.includes('secador para cabello') ||
    ((nameLower.includes('secador') || nameLower.includes('dryer') || nameLower.includes('blow dryer')) &&
      !nameLower.includes('plato') &&
      !nameLower.includes('vajilla') &&
      !nameLower.includes('piso') &&
      !nameLower.includes('ropa') &&
      !nameLower.includes('manos') &&
      (catLower.includes('estetica') ||
        catLower.includes('belleza') ||
        subCatLower.includes('pelo') ||
        nameLower.includes('oryx') ||
        nameLower.includes('osr') ||
        descLower.includes('pelo') ||
        descLower.includes('cabello') ||
        nameLower.includes('difusor')));

  // B. Planchitas y Alisadores
  const isHairStraightener =
    (nameLower.includes('planchita') ||
      nameLower.includes('plancha de pelo') ||
      nameLower.includes('alisador') ||
      nameLower.includes('cepillo secador') ||
      nameLower.includes('bucleadora')) &&
    !isHairDryer;

  // C. Trimmers, Afeitadoras, Cortadoras y Barbería
  const isTrimmerOrShaver =
    (nameLower.includes('afeitadora') ||
      nameLower.includes('cortadora de pelo') ||
      nameLower.includes('cortadora de cabello') ||
      nameLower.includes('cortadora') ||
      nameLower.includes('patillera') ||
      nameLower.includes('trimmer') ||
      nameLower.includes('barber') ||
      nameLower.includes('barba') ||
      nameLower.includes('clipper') ||
      nameLower.includes('shaver') ||
      nameLower.includes('depiladora')) &&
    !isHairDryer &&
    !isHairStraightener;

  // D. Secaplatos y Escurridores de Cocina
  const isDishDryingRack =
    nameLower.includes('secador de plato') ||
    nameLower.includes('secador de platos') ||
    nameLower.includes('escurridor') ||
    nameLower.includes('secaplatos') ||
    (nameLower.includes('secador') && (nameLower.includes('plato') || nameLower.includes('vajilla') || nameLower.includes('cubierto')));

  // E. Limpiadora a Vapor / Calderas
  const isSteamCleaner = 
    product.id === 'prod-inova-limpiadora-a-vapor-hytoshy-1200w' ||
    nameLower.includes('vapor') ||
    nameLower.includes('hytoshy') ||
    nameLower.includes('limpiadora a vapor') ||
    nameLower.includes('vaporera') ||
    descLower.includes('vaporizador') ||
    descLower.includes('caldera de vapor');

  // F. Minipimer, Batidora, Mixer
  const isMinipimerOrMixer =
    product.id === 'prod-inova-minipimer-acero-s-8885' ||
    nameLower.includes('minipimer') ||
    nameLower.includes('mixer') ||
    nameLower.includes('batidora') ||
    nameLower.includes('procesadora') ||
    nameLower.includes('licuadora');

  // G. Electrodomésticos de Cocina
  const isKitchenAppliance =
    (catLower === 'electrodomesticos' ||
      catLower === 'cocina' ||
      subCatLower.includes('coc-') ||
      nameLower.includes('pava') ||
      nameLower.includes('cafetera') ||
      nameLower.includes('freidora') ||
      nameLower.includes('tostadora') ||
      nameLower.includes('sandwichera') ||
      nameLower.includes('horno') ||
      nameLower.includes('anafe') ||
      nameLower.includes('wafflera') ||
      nameLower.includes('calentador de agua')) &&
    !isSteamCleaner &&
    !isMinipimerOrMixer &&
    !isHairDryer &&
    !isHairStraightener &&
    !isTrimmerOrShaver;

  // H. Herramientas Metálicas
  const isWrenchSet = 
    product.id === 'prod-inova-juego-de-llaves-combinadas-sr2619' ||
    (nameLower.includes('llave') && (nameLower.includes('combinada') || nameLower.includes('sr2619'))) ||
    (nameLower.includes('juego') && nameLower.includes('llave') && !nameLower.includes('25'));

  const isWrench25Pcs = 
    product.id === 'prod-inova-juego-de-llaves-25-pcs-sr2612' ||
    (nameLower.includes('llave') && (nameLower.includes('25 pcs') || nameLower.includes('sr2612')));

  const isGeneralTool = 
    (catLower === 'herramientas' || 
      subCatLower.includes('her-') || 
      nameLower.includes('herramienta') ||
      nameLower.includes('llave') ||
      nameLower.includes('destornillador') ||
      nameLower.includes('pinza') ||
      nameLower.includes('tubo') ||
      nameLower.includes('taladro') ||
      nameLower.includes('amoladora') ||
      nameLower.includes('atornillador') ||
      nameLower.includes('set de tubos')) &&
    !isKitchenAppliance &&
    !isSteamCleaner &&
    !isHairDryer;

  // I. Organizadores de Calzado Oryx
  const isShoesOrganizer3 = 
    ((nameLower.includes('organizador') || nameLower.includes('zapatero') || nameLower.includes('estante') || nameLower.includes('mueble') || nameLower.includes('caja')) &&
      (nameLower.includes('zapato') || nameLower.includes('calzado')) &&
      (nameLower.includes('3 nivel') || nameLower.includes('3 niv') || nameLower.includes('3p'))) ||
    product.id === 'prod-inova-organizador-de-zapatos-3-niveles-oryx';

  const isShoesOrganizer6 = 
    ((nameLower.includes('organizador') || nameLower.includes('zapatero') || nameLower.includes('estante') || nameLower.includes('mueble') || nameLower.includes('caja')) &&
      (nameLower.includes('zapato') || nameLower.includes('calzado')) &&
      (nameLower.includes('6 nivel') || nameLower.includes('6 niv') || nameLower.includes('6p'))) ||
    product.id === 'prod-inova-organizador-de-zapatos-6-niveles-oryx';

  // J. Calzado (Zapatillas, Zapatos, etc.)
  const isFootwear =
    (nameLower.includes('zapatilla') ||
      nameLower.includes('zapato') ||
      nameLower.includes('sandalia') ||
      nameLower.includes('ojota') ||
      nameLower.includes('botin') ||
      nameLower.includes('borcego') ||
      nameLower.includes('calzado') ||
      catLower === 'calzado') &&
    !isShoesOrganizer3 &&
    !isShoesOrganizer6 &&
    !nameLower.includes('organizador') &&
    !nameLower.includes('estante') &&
    !nameLower.includes('caja') &&
    !nameLower.includes('zapatero') &&
    !nameLower.includes('bolso') &&
    !nameLower.includes('mueble');

  // K. Otros Organizadores y Almacenaje
  const isStorageOrganizer =
    (nameLower.includes('organizador') || nameLower.includes('caja organizadora') || nameLower.includes('canasto') || nameLower.includes('cesto') || catLower.includes('organizacion')) &&
    !isSteamCleaner &&
    !isMinipimerOrMixer &&
    !isKitchenAppliance &&
    !isGeneralTool &&
    !isDishDryingRack &&
    !isShoesOrganizer3 &&
    !isShoesOrganizer6 &&
    !isHairDryer;

  // L. Audio y Tecnología
  const isAudioTech = 
    (nameLower.includes('auricular') ||
      nameLower.includes('parlante') ||
      nameLower.includes('bluetooth') ||
      nameLower.includes('smartwatch') ||
      nameLower.includes('reloj') ||
      nameLower.includes('headset') ||
      nameLower.includes('in-ear') ||
      catLower === 'audio' ||
      catLower === 'tecnologia') &&
    !isKitchenAppliance &&
    !isHairDryer &&
    !isHairStraightener &&
    !isTrimmerOrShaver &&
    !isGeneralTool;

  // M. Belleza General
  const isBeautyPersonalCare =
    (catLower === 'belleza' ||
      catLower === 'cuidado-personal' ||
      subCatLower.includes('est-')) &&
    !isHairDryer &&
    !isHairStraightener &&
    !isTrimmerOrShaver;

  // N. Botellas y Termos
  const isBottleOrThermos = 
    nameLower.includes('termo') || 
    nameLower.includes('botella') || 
    nameLower.includes('vaso térmico') || 
    nameLower.includes('vaso termico') ||
    descLower.includes('aislamiento al vacio');

  // --- A. LIMPIADORA A VAPOR / VAPORIZADORES (Potencia, Presión/Capacidad de agua, Voltaje, Accesorios) ---
  if (isSteamCleaner) {
    const power = explicit?.power || '1200W (Calentamiento ultrarrápido en caldera interna presurizada)';
    const pressureOrCapacity = explicit?.pressureOrCapacity || explicit?.pressure || '3.5 Bares de presión de vapor continuo • Capacidad de agua: 350 ml';
    const voltage = explicit?.voltage || '220V - 50Hz (Ficha IRAM normalizada homologada)';
    const accessories = explicit?.accessoriesIncluded || 'Kit multiuso completo de 9 accesorios (manguera flexible, boquillas curvas/rectas, limpiavidrios, cepillo redondo, paño microfibra, embudo y vaso medidor)';

    const items: StructuredSpecItem[] = [
      {
        id: 'power',
        label: 'Potencia',
        sublabel: 'Capacidad de calentamiento',
        value: power,
        iconType: 'power'
      },
      {
        id: 'pressure',
        label: 'Presión / Capacidad de agua',
        sublabel: 'Bares de vapor y tanque',
        value: pressureOrCapacity,
        iconType: 'pressure'
      },
      {
        id: 'voltage',
        label: 'Voltaje',
        sublabel: 'Tensión eléctrica de red',
        value: voltage,
        iconType: 'voltage'
      },
      {
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Kit multiuso de trabajo',
        value: accessories,
        iconType: 'accessories'
      }
    ];

    return {
      power,
      pressureOrCapacity,
      voltage,
      accessoriesIncluded: accessories,
      material: 'Carcasa ignífuga de alta resistencia térmica y caldera presurizada de aleación de aluminio',
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Desinfección ecológica a más de 100°C: elimina 99.9% de gérmenes, bacterias, ácaros y hongos sin químicos',
        'Tapa de seguridad con válvula antipresión que previene aperturas accidentales con vapor acumulado',
        'Calentamiento express en solo 3 minutos con emisión continua de vapor de 28 g/min',
        'Apta para pisos, tapizados, azulejos, cocinas, baños, juntas y vidrios'
      ]
    };
  }

  // --- B. MINIPIMER / MIXER / BATIDORA (Potencia, Capacidad/Vaso, Voltaje, Accesorios/Cuchillas) ---
  if (isMinipimerOrMixer) {
    const power = explicit?.power || '600W (Motor potente de alto torque con bajo nivel sonoro)';
    const capacity = explicit?.capacity || explicit?.waterCapacity || 'Vaso graduado dosificador de 700 ml con base firme';
    const voltage = explicit?.voltage || '220V - 50Hz (Tensión de red estándar argentina homologada)';
    const accessories = explicit?.accessoriesIncluded || 'Brazo mixer en acero inoxidable desmontable y vaso medidor graduado';

    const items: StructuredSpecItem[] = [
      {
        id: 'power',
        label: 'Potencia',
        sublabel: 'Fuerza de motor y torque',
        value: power,
        iconType: 'power'
      },
      {
        id: 'capacity',
        label: 'Capacidad',
        sublabel: 'Vaso dosificador',
        value: capacity,
        iconType: 'capacity'
      },
      {
        id: 'voltage',
        label: 'Voltaje',
        sublabel: 'Alimentación eléctrica',
        value: voltage,
        iconType: 'voltage'
      },
      {
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Componentes de corte y mezcla',
        value: accessories,
        iconType: 'accessories'
      }
    ];

    return {
      power,
      capacity,
      voltage,
      accessoriesIncluded: accessories,
      material: 'Cuchillas cuádruples de acero quirúrgico SUS 304 y cuerpo en acero inoxidable cepillado',
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        '2 velocidades regulables con función Turbo para triturado instantáneo',
        'Campana antisalpicaduras que previene manchas en la cocina',
        'Encastre tipo bayoneta de liberación rápida para fácil lavado',
        'Apta para picar hielo, preparar papillas, mayonesas, batidos y sopas calientes'
      ]
    };
  }

  // --- C. ELECTRODOMÉSTICOS DE COCINA / HOGAR GENERAL (Potencia, Capacidad/Presión, Voltaje, Accesorios) ---
  if (isKitchenAppliance) {
    // Extract wattage from name if present (e.g. 1500W, 2000W)
    const wattMatch = product.name?.match(/(\d{3,4})\s*W/i);
    const powerVal = explicit?.power || (wattMatch ? `${wattMatch[1]}W (Alta eficiencia energética)` : '1500W - 1800W (Alta potencia y calentamiento rápido)');
    const voltVal = explicit?.voltage || '220V - 50Hz (Tensión eléctrica argentina con ficha normalizada)';
    const capVal = explicit?.capacity || explicit?.waterCapacity || 'Capacidad optimizada de grado familiar con indicador de nivel';
    const accVal = explicit?.accessoriesIncluded || 'Cable reforzado, manual en español y accesorios originales de fábrica';

    const items: StructuredSpecItem[] = [
      {
        id: 'power',
        label: 'Potencia',
        sublabel: 'Rendimiento y consumo',
        value: powerVal,
        iconType: 'power'
      },
      {
        id: 'capacity',
        label: 'Capacidad / Volumen',
        sublabel: 'Capacidad útil de trabajo',
        value: capVal,
        iconType: 'capacity'
      },
      {
        id: 'voltage',
        label: 'Voltaje',
        sublabel: 'Alimentación eléctrica',
        value: voltVal,
        iconType: 'voltage'
      },
      {
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Contenido y equipamiento',
        value: accVal,
        iconType: 'accessories'
      }
    ];

    return {
      power: powerVal,
      capacity: capVal,
      voltage: voltVal,
      accessoriesIncluded: accVal,
      material: explicit?.material || 'Cuerpo térmico reforzado con materiales aptos para uso alimentario (BPA Free)',
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Sistema de corte térmico automático por sobrecalentamiento',
        'Materiales libres de BPA y aptos para contacto con alimentos',
        'Fácil limpieza y bajo consumo energético'
      ]
    };
  }

  // --- D. JUEGO DE LLAVES COMBINADAS SR2619 / HERRAMIENTAS METÁLICAS ---
  if (isWrenchSet) {
    const material = explicit?.material || 'Acero Cromo Vanadio (Cr-V) de alta resistencia forjado en caliente con acabado cromado anticorrosión';
    const pieces = explicit?.piecesIncluded || explicit?.capacity || 'Set de 11 llaves combinadas + Estuche organizador de tela/lona reforzada';
    const measures = explicit?.measuresIncluded || explicit?.dimensions || 'Rango de 8 mm a 24 mm (8, 9, 10, 11, 12, 13, 14, 15, 17, 22 y 24 mm)';
    const usage = explicit?.usage || explicit?.assemblySystem || 'Profesional y taller mecánico, automotriz y mantenimiento general';

    const items: StructuredSpecItem[] = [
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Aleación y forja de alta resistencia',
        value: material,
        iconType: 'material'
      },
      {
        id: 'pieces',
        label: 'Piezas incluidas',
        sublabel: 'Set completo',
        value: pieces,
        iconType: 'pieces'
      },
      {
        id: 'dimensions',
        label: 'Medidas incluidas',
        sublabel: 'Rango milimétrico (mm)',
        value: measures,
        iconType: 'dimensions'
      },
      {
        id: 'usage',
        label: 'Uso',
        sublabel: 'Destino recomendado',
        value: usage,
        iconType: 'usage'
      }
    ];

    return {
      dimensions: measures,
      capacity: pieces,
      material,
      assemblySystem: usage,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Extremo boca abierta y corona estriada acodada a 15° para torque óptimo',
        'Estuche de lona reforzada con ojales metálicos para colgar en pared o banco de trabajo',
        'Grabado en bajorrelieve en cada llave para rápida identificación de medida',
        'Tratamiento térmico integral para evitar deformación bajo alta torsión'
      ]
    };
  }

  if (isWrench25Pcs) {
    const material = explicit?.material || 'Acero Cromo Vanadio (Cr-V) de alta resistencia forjado';
    const pieces = explicit?.piecesIncluded || explicit?.capacity || 'Set de 25 llaves combinadas + Estuche organizador enrollable';
    const measures = explicit?.measuresIncluded || explicit?.dimensions || 'Rango de 6 mm a 32 mm completo';
    const usage = explicit?.usage || explicit?.assemblySystem || 'Profesional y taller mecánico pesado e industrial';

    const items: StructuredSpecItem[] = [
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Composición y forja',
        value: material,
        iconType: 'material'
      },
      {
        id: 'pieces',
        label: 'Piezas incluidas',
        sublabel: 'Contenido del juego',
        value: pieces,
        iconType: 'pieces'
      },
      {
        id: 'dimensions',
        label: 'Medidas incluidas',
        sublabel: 'Rango milimétrico completo',
        value: measures,
        iconType: 'dimensions'
      },
      {
        id: 'usage',
        label: 'Uso',
        sublabel: 'Destino recomendado',
        value: usage,
        iconType: 'usage'
      }
    ];

    return {
      dimensions: measures,
      capacity: pieces,
      material,
      assemblySystem: usage,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Doble boca fija y estriada para máxima versatilidad',
        'Estuche transportable de alta durabilidad con compartimentos',
        'Aleación de cromo vanadio de grado industrial'
      ]
    };
  }

  if (isGeneralTool) {
    const material = explicit?.material || 'Acero Cromo Vanadio (Cr-V) / Acero forjado de alta resistencia mecánica';
    const pieces = explicit?.piecesIncluded || explicit?.capacity || 'Herramienta de precisión manual con empaque protector';
    const measures = explicit?.measuresIncluded || explicit?.dimensions || 'Medidas y encastres calibrados estándar de taller';
    const usage = explicit?.usage || explicit?.assemblySystem || 'Profesional y taller mecánico, mantenimiento y obra';

    const items: StructuredSpecItem[] = [
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Composición y acabado',
        value: material,
        iconType: 'material'
      },
      {
        id: 'pieces',
        label: 'Piezas incluidas',
        sublabel: 'Presentación',
        value: pieces,
        iconType: 'pieces'
      },
      {
        id: 'dimensions',
        label: 'Medidas incluidas',
        sublabel: 'Dimensiones y especificaciones',
        value: measures,
        iconType: 'dimensions'
      },
      {
        id: 'usage',
        label: 'Uso',
        sublabel: 'Aplicación recomendada',
        value: usage,
        iconType: 'usage'
      }
    ];

    return {
      dimensions: measures,
      capacity: pieces,
      material,
      assemblySystem: usage,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Diseño ergonómico para uso continuo en taller o industria',
        'Acabado anticorrosivo de alta durabilidad'
      ]
    };
  }

  // --- E. ORGANIZADORES DE CALZADO ORYX (3 Y 6 NIVELES) ---
  if (isShoesOrganizer3) {
    const dimensions = explicit?.dimensions || '53 cm (Ancho) x 51 cm (Alto) x 34 cm (Profundidad) • 17 cm por nivel';
    const capacity = explicit?.capacity || 'Hasta 6 pares de calzado (2 pares por nivel hasta talle 45)';
    const material = explicit?.material || 'Plástico PP virgen + ABS de alta resistencia y compuertas acrílicas translúcidas';
    const assemblySystem = explicit?.assemblySystem || 'Estructura 100% plegable modular ("One-piece"), armado rápido en 1 minuto sin herramientas';

    const items: StructuredSpecItem[] = [
      {
        id: 'dimensions',
        label: 'Medidas exactas',
        sublabel: 'Ancho x Alto x Profundidad en cm',
        value: dimensions,
        iconType: 'dimensions'
      },
      {
        id: 'capacity',
        label: 'Capacidad',
        sublabel: 'Capacidad y volumen útil',
        value: capacity,
        iconType: 'capacity'
      },
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Composición y estructura',
        value: material,
        iconType: 'material'
      },
      {
        id: 'assembly',
        label: 'Sistema de armado / plegado',
        sublabel: 'Ensamble y modo de uso',
        value: assemblySystem,
        iconType: 'assembly'
      }
    ];

    return {
      dimensions,
      capacity,
      material,
      assemblySystem,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Puertas frontales transparentes con cierre magnético y visor antipolvo',
        'Plegable modular: cuando no se usa se colapsa a menos de 10 cm de espesor',
        'Estructura firme y apilable con otros módulos de la línea Oryx',
        'Superficie lisa y lavable, resistente al agua y humedad'
      ]
    };
  }

  if (isShoesOrganizer6) {
    const dimensions = explicit?.dimensions || '53 cm (Ancho) x 102 cm (Alto) x 34 cm (Profundidad) • 17 cm por nivel';
    const capacity = explicit?.capacity || 'Hasta 12 pares de calzado (2 pares por nivel hasta talle 45)';
    const material = explicit?.material || 'Plástico PP virgen + ABS de alta resistencia y puertas de acrílico translúcido antipolvo';
    const assemblySystem = explicit?.assemblySystem || 'Estructura colapsable modular tipo acordeón, despliegue vertical instantáneo sin tornillos';

    const items: StructuredSpecItem[] = [
      {
        id: 'dimensions',
        label: 'Medidas exactas',
        sublabel: 'Ancho x Alto x Profundidad en cm',
        value: dimensions,
        iconType: 'dimensions'
      },
      {
        id: 'capacity',
        label: 'Capacidad',
        sublabel: 'Capacidad y volumen útil',
        value: capacity,
        iconType: 'capacity'
      },
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Composición y estructura',
        value: material,
        iconType: 'material'
      },
      {
        id: 'assembly',
        label: 'Sistema de armado / plegado',
        sublabel: 'Ensamble y modo de uso',
        value: assemblySystem,
        iconType: 'assembly'
      }
    ];

    return {
      dimensions,
      capacity,
      material,
      assemblySystem,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Puertas transparentes con cierre magnético antipolvo y ventilación trasera',
        'Apto para todo tipo de calzado: zapatillas deportivas, botines y borcegos',
        'Despliegue y armado instantáneo sin necesidad de herramientas',
        'Modular y apilable para organizar vestidores, pasillos o dormitorios'
      ]
    };
  }

  // --- F. OTROS ORGANIZADORES DE HOGAR / CAJAS DE ALMACENAJE (GENUINOS) ---
  if (isStorageOrganizer) {
    const dimensions = explicit?.dimensions || '38 cm (Ancho) x 26 cm (Alto) x 25 cm (Profundidad)';
    const capacity = explicit?.capacity || 'Gran capacidad de almacenaje (soporta hasta 15 kg de carga distribuida)';
    const material = explicit?.material || 'Plástico PP virgen de alta densidad libre de BPA';
    const assemblySystem = explicit?.assemblySystem || 'Cuerpo colapsable para guardado plano cuando no está en uso';

    const items: StructuredSpecItem[] = [
      {
        id: 'dimensions',
        label: 'Medidas exactas',
        sublabel: 'Ancho x Alto x Profundidad en cm',
        value: dimensions,
        iconType: 'dimensions'
      },
      {
        id: 'capacity',
        label: 'Capacidad',
        sublabel: 'Capacidad y volumen útil',
        value: capacity,
        iconType: 'capacity'
      },
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Composición y estructura',
        value: material,
        iconType: 'material'
      },
      {
        id: 'assembly',
        label: 'Sistema de armado / plegado',
        sublabel: 'Ensamble y modo de uso',
        value: assemblySystem,
        iconType: 'assembly'
      }
    ];

    return {
      dimensions,
      capacity,
      material,
      assemblySystem,
      items,
      additionalHighlights: explicit?.additionalFeatures || []
    };
  }

  // --- G. AUDIO Y TECNOLOGÍA (Conectividad, Batería, Compatibilidad, Funciones) ---
  if (isAudioTech) {
    const connectivity = explicit?.connectivity || 'Bluetooth 5.3 con sincronización automática y alcance de 10 metros';
    const battery = explicit?.batteryLife || 'Hasta 24 horas de reproducción total con estuche de carga USB-C';
    const compatibility = 'Universal (Android, iOS, Windows, macOS, Smart TV)';
    const features = explicit?.accessoriesIncluded || 'Estuche de carga, cable USB-C y almohadillas de silicona intercambiables';

    const items: StructuredSpecItem[] = [
      {
        id: 'connectivity',
        label: 'Conectividad',
        sublabel: 'Protocolo inalámbrico',
        value: connectivity,
        iconType: 'connectivity'
      },
      {
        id: 'battery',
        label: 'Autonomía / Batería',
        sublabel: 'Tiempo de uso continuo',
        value: battery,
        iconType: 'battery'
      },
      {
        id: 'material',
        label: 'Compatibilidad',
        sublabel: 'Sistemas operativos',
        value: compatibility,
        iconType: 'material'
      },
      {
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Kit de carga y estuche',
        value: features,
        iconType: 'accessories'
      }
    ];

    return {
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Micrófono HD incorporado con reducción de ruido ambiente para llamadas claras',
        'Controles táctiles intuitivos de reproducción y volumen',
        'Emparejamiento instantáneo al abrir el estuche'
      ]
    };
  }

  // --- H. SECADORES DE PELO (Potencia, Alimentación, Accesorios, Funciones/Velocidades) ---
  if (isHairDryer) {
    const power = explicit?.power || '1400W';
    const voltage = explicit?.voltage || 'Cable a red eléctrica 220V (No batería USB)';
    const accessories = explicit?.accessoriesIncluded || (nameLower.includes('difusor') ? 'Boquilla concentradora de aire + Difusor de volumen' : 'Boquilla concentradora de aire');
    const functions = explicit?.functions || 'Secado rápido, control de temperatura, flujo de aire optimizado';

    const items: StructuredSpecItem[] = [
      {
        id: 'power',
        label: 'Potencia',
        sublabel: 'Rendimiento y secado',
        value: power,
        iconType: 'power'
      },
      {
        id: 'voltage',
        label: 'Alimentación',
        sublabel: 'Tensión y conexión',
        value: voltage,
        iconType: 'voltage'
      },
      {
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Boquillas y complementos',
        value: accessories,
        iconType: 'accessories'
      },
      {
        id: 'speed',
        label: 'Funciones y Control',
        sublabel: 'Velocidad y temperatura',
        value: functions,
        iconType: 'speed'
      }
    ];

    return {
      power,
      voltage,
      accessoriesIncluded: accessories,
      material: explicit?.material || 'Carcasa en polímero ABS térmico de alta durabilidad con filtro trasero removible',
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Secado rápido, control de temperatura y flujo de aire optimizado',
        'Cable a red eléctrica 220V con protección térmica inteligente',
        'Boquilla concentradora de aire para peinado y secado parejo',
        'Filtro posterior desmontable para fácil mantenimiento y anilla para colgar'
      ]
    };
  }

  // --- I. PLANCHITAS Y ALISADORES DE PELO ---
  if (isHairStraightener) {
    const power = explicit?.power || '45W - 60W (Calentamiento cerámico ultrarrápido)';
    const voltage = explicit?.voltage || '220V - 50Hz (Cable giratorio 360° antinudos)';
    const material = explicit?.material || 'Placas flotantes de cerámica y turmalina con emisión de iones';
    const functions = explicit?.functions || 'Temperatura profesional hasta 230°C con calentamiento en 30s';

    const items: StructuredSpecItem[] = [
      {
        id: 'power',
        label: 'Potencia',
        sublabel: 'Consumo y calentamiento',
        value: power,
        iconType: 'power'
      },
      {
        id: 'material',
        label: 'Placas / Material',
        sublabel: 'Tecnología de calor',
        value: material,
        iconType: 'material'
      },
      {
        id: 'speed',
        label: 'Temperatura / Control',
        sublabel: 'Rango térmico',
        value: functions,
        iconType: 'speed'
      },
      {
        id: 'voltage',
        label: 'Alimentación',
        sublabel: 'Conexión eléctrica',
        value: voltage,
        iconType: 'voltage'
      }
    ];

    return {
      power,
      voltage,
      material,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Deslizamiento ultra suave que reduce el frizz y protege el brillo natural',
        'Cable giratorio 360° para máxima libertad de movimiento',
        'Apagado automático de seguridad contra sobrecalentamiento'
      ]
    };
  }

  // --- J. CORTADORAS, AFEITADORAS Y TRIMMERS (Barbería) ---
  if (isTrimmerOrShaver) {
    const power = explicit?.power || 'Motor rotativo de alto rendimiento y bajo nivel sonoro';
    const battery = explicit?.batteryLife || 'Batería de litio recargable USB con 90 minutos de uso continuo';
    const material = explicit?.material || 'Cuchillas autoafilables de acero inoxidable quirúrgico SUS 304';
    const accessories = explicit?.accessoriesIncluded || 'Peines guía de distintas medidas, cable de carga USB y cepillo de limpieza';

    const items: StructuredSpecItem[] = [
      {
        id: 'power',
        label: 'Potencia / Motor',
        sublabel: 'Fuerza de corte constante',
        value: power,
        iconType: 'power'
      },
      {
        id: 'battery',
        label: 'Autonomía / Batería',
        sublabel: 'Carga y duración',
        value: battery,
        iconType: 'battery'
      },
      {
        id: 'material',
        label: 'Cuchillas / Material',
        sublabel: 'Cabezal de corte',
        value: material,
        iconType: 'material'
      },
      {
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Peines y kit de mantenimiento',
        value: accessories,
        iconType: 'accessories'
      }
    ];

    return {
      power,
      material,
      accessoriesIncluded: accessories,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Corte suave al ras sin tirones ni irritación en la piel',
        'Cabezal lavable desmontable para higiene rápida',
        'Diseño ergonómico con agarre antideslizante'
      ]
    };
  }

  // --- K. SECADOR DE PLATOS / ESCURRIDORES DE COCINA ---
  if (isDishDryingRack) {
    const material = explicit?.material || 'Acero cromado inoxidable + Bandeja colectora plástica';
    const capacity = explicit?.capacity || 'Capacidad para platos, cubiertero lateral y soporte de vasos';
    const dimensions = explicit?.dimensions || 'Medidas estándar adaptables para mesada de cocina';
    const assembly = explicit?.assemblySystem || 'Estructura rígida antideslizante con fácil desmonte para limpieza';

    const items: StructuredSpecItem[] = [
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Estructura y bandeja',
        value: material,
        iconType: 'material'
      },
      {
        id: 'capacity',
        label: 'Capacidad',
        sublabel: 'Distribución de vajilla',
        value: capacity,
        iconType: 'capacity'
      },
      {
        id: 'dimensions',
        label: 'Medidas exactas',
        sublabel: 'Ancho x Alto x Profundidad',
        value: dimensions,
        iconType: 'dimensions'
      },
      {
        id: 'assembly',
        label: 'Sistema de armado',
        sublabel: 'Ensamble y limpieza',
        value: assembly,
        iconType: 'assembly'
      }
    ];

    return {
      dimensions,
      capacity,
      material,
      assemblySystem: assembly,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Bandeja de goteo removible que mantiene la mesada seca e higiénica',
        'Recubrimiento resistente a la corrosión y humedad continua',
        'Patas antideslizantes que protegen la superficie de apoyo'
      ]
    };
  }

  // --- L. CALZADO (Zapatillas, Zapatos, etc.) ---
  if (isFootwear) {
    const material = explicit?.material || 'Material exterior textil/sintético transpirable con suela antideslizante';
    const dimensions = explicit?.dimensions || 'Talles estándar argentinos con horma anatómica confortable';
    const capacity = explicit?.capacity || 'Par de calzado con plantilla acolchada de alta absorción de impacto';
    const usage = explicit?.usage || explicit?.assemblySystem || 'Uso urbano diario, deportivo y tiempo libre';

    const items: StructuredSpecItem[] = [
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Capellada y suela',
        value: material,
        iconType: 'material'
      },
      {
        id: 'dimensions',
        label: 'Medidas / Talles',
        sublabel: 'Calce y horma',
        value: dimensions,
        iconType: 'dimensions'
      },
      {
        id: 'capacity',
        label: 'Presentación',
        sublabel: 'Contenido del empaque',
        value: capacity,
        iconType: 'capacity'
      },
      {
        id: 'usage',
        label: 'Uso recomendado',
        sublabel: 'Destino y confort',
        value: usage,
        iconType: 'usage'
      }
    ];

    return {
      dimensions,
      capacity,
      material,
      assemblySystem: usage,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Diseño ergonómico y liviano para máxima comodidad durante todo el día',
        'Suela flexible con excelente tracción y amortiguación'
      ]
    };
  }

  // --- M. BELLEZA Y CUIDADO PERSONAL GENERAL ---
  if (isBeautyPersonalCare) {
    const power = explicit?.power || 'Motor eléctrico de alto rendimiento y bajo consumo';
    const battery = explicit?.batteryLife || 'Alimentación estándar con certificación eléctrica oficial';
    const material = explicit?.material || 'Materiales hipoalergénicos de grado estético y fácil higiene';
    const accessories = explicit?.accessoriesIncluded || 'Kit de accesorios y manual de uso oficial';

    const items: StructuredSpecItem[] = [
      {
        id: 'power',
        label: 'Rendimiento',
        sublabel: 'Funcionamiento óptimo',
        value: power,
        iconType: 'power'
      },
      {
        id: 'battery',
        label: 'Alimentación',
        sublabel: 'Conexión / Batería',
        value: battery,
        iconType: 'battery'
      },
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Cuerpo y cabezal',
        value: material,
        iconType: 'material'
      },
      {
        id: 'accessories',
        label: 'Accesorios incluidos',
        sublabel: 'Kit y complementos',
        value: accessories,
        iconType: 'accessories'
      }
    ];

    return {
      power,
      material,
      accessoriesIncluded: accessories,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Diseño ergonómico y liviano para uso diario confortable',
        'Fácil limpieza y mantenimiento con Garantía Oficial VONDRO'
      ]
    };
  }

  // --- I. TERMOS Y BOTELLAS TÉRMICAS (Material, Capacidad, Dimensiones, Sistema de tapa) ---
  if (isBottleOrThermos) {
    const material = explicit?.material || 'Doble capa de acero inoxidable SUS 304 con aislamiento térmico al vacío (BPA Free)';
    const capacity = explicit?.capacity || '1.0 Litro (1000 ml) • Mantiene frío 24h y calor 12h continuas';
    const dimensions = explicit?.dimensions || 'Ø 8.5 cm (Diámetro base) x 29.5 cm (Alto total)';
    const assembly = explicit?.assemblySystem || 'Tapa a rosca con pico cebador 360° vertedor hermético antiderrame';

    const items: StructuredSpecItem[] = [
      {
        id: 'material',
        label: 'Material',
        sublabel: 'Composición térmica',
        value: material,
        iconType: 'material'
      },
      {
        id: 'capacity',
        label: 'Capacidad',
        sublabel: 'Volumen y retención térmica',
        value: capacity,
        iconType: 'capacity'
      },
      {
        id: 'dimensions',
        label: 'Medidas exactas',
        sublabel: 'Diámetro x Altura',
        value: dimensions,
        iconType: 'dimensions'
      },
      {
        id: 'assembly',
        label: 'Sistema de tapa',
        sublabel: 'Pico cebador y cierre',
        value: assembly,
        iconType: 'assembly'
      }
    ];

    return {
      dimensions,
      capacity,
      material,
      assemblySystem: assembly,
      items,
      additionalHighlights: explicit?.additionalFeatures || [
        'Cámara de vacío que evita la condensación exterior y no quema las manos',
        'Pintura electrostática micropulverizada de alta resistencia a golpes y rayones',
        'Libre de BPA y sustancias tóxicas, no altera sabores'
      ]
    };
  }

  // --- J. GENERAL / OTROS ARTÍCULOS (Atributos limpios y neutrales adaptados al producto) ---
  const dynamicTitle = product.name || 'Producto';
  const dimensions = explicit?.dimensions || 'Dimensiones estándar de fábrica certificadas según catálogo oficial';
  const capacity = explicit?.capacity || 'Capacidad y rendimiento testeados bajo normas de Calidad Garantizada VONDRO';
  const material = explicit?.material || 'Materiales de ingeniería de alta resistencia y durabilidad comprobada';
  const usage = explicit?.usage || explicit?.assemblySystem || 'Listo para usar, funcionamiento intuitivo';

  const items: StructuredSpecItem[] = [
    {
      id: 'material',
      label: 'Material y Calidad',
      sublabel: 'Composición estructural',
      value: material,
      iconType: 'material'
    },
    {
      id: 'dimensions',
      label: 'Medidas y Formato',
      sublabel: 'Dimensiones generales',
      value: dimensions,
      iconType: 'dimensions'
    },
    {
      id: 'capacity',
      label: 'Rendimiento',
      sublabel: 'Desempeño operativo',
      value: capacity,
      iconType: 'capacity'
    },
    {
      id: 'usage',
      label: 'Uso y Aplicación',
      sublabel: 'Modo de empleo',
      value: usage,
      iconType: 'usage'
    }
  ];

  return {
    dimensions,
    capacity,
    material,
    assemblySystem: usage,
    items,
    additionalHighlights: explicit?.additionalFeatures || [
      'Producto 100% original con respaldo y Garantía Oficial VONDRO',
      'Control de calidad verificado antes del despacho'
    ]
  };
}
