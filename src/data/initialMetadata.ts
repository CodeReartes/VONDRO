import { 
  AbandonedCart,
  AssistantConversation,
  AssistantMessage,
  Category, 
  Coupon, 
  Courier, 
  FAQItem,
  LogisticsProvider, 
  Order, 
  Product, 
  PurchaseOrder,
  ShippingExpense, 
  ShippingZone, 
  StoreSettings, 
  Supplier, 
  SupplierCheck,
  SupplierReturn,
  SupportTicket,
  UnresolvedQuery,
  UserAccount 
} from '../types';

export const INITIAL_COURIERS: Courier[] = [
  {
    "id": "courier-diego",
    "name": "Diego (Administrador / Reparto Central)",
    "phone": "+54 9 351 594-8952",
    "email": "reparto@vondro.com.ar",
    "active": true,
    "vehicleType": "UTILITARIO",
    "notes": "Reparto propio de VONDRO en Córdoba Capital (Centro, Nva Córdoba, Güemes, Alberdi).",
    "createdAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "courier-norte",
    "name": "Lucas Repartos (Zona Norte CBA)",
    "phone": "+54 9 351 777-2233",
    "email": "lucas.repartos@gmail.com",
    "active": true,
    "vehicleType": "MOTO",
    "notes": "Cadete contratado para entregas exprés en Cerro de las Rosas, Urca y Villa Belgrano.",
    "createdAt": "2026-08-10T12:00:00.000Z"
  },
  {
    "id": "courier-sur",
    "name": "Marcos Envíos (Zona Sur CBA)",
    "phone": "+54 9 351 888-4455",
    "email": "marcos.envios@gmail.com",
    "active": true,
    "vehicleType": "MOTO",
    "notes": "Cadetería para Barrio Jardín, San Vicente y Empalme.",
    "createdAt": "2026-08-12T14:00:00.000Z"
  }
];

export const INITIAL_LOGISTICS_PROVIDERS: LogisticsProvider[] = [
  {
    "id": "log-vondro-own",
    "name": "VONDRO Reparto Propio Córdoba",
    "type": "MANUAL",
    "phone": "+54 9 351 234-5678",
    "email": "logistica@vondro.com.ar",
    "website": "https://vondro.com.ar",
    "apiEnabled": false,
    "active": true,
    "notes": "Flota propia y cadetería directa para Córdoba Capital y Gran Córdoba.",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "log-andreani",
    "name": "Andreani Logística (Futura Integración)",
    "type": "EXTERNAL_API",
    "phone": "0810-122-1111",
    "email": "empresas@andreani.com",
    "website": "https://www.andreani.com",
    "apiEnabled": false,
    "active": false,
    "notes": "Preparado para envíos a toda la provincia de Córdoba y resto del país.",
    "createdAt": "2026-08-20T00:00:00.000Z"
  },
  {
    "id": "log-moova",
    "name": "Moova Same Day (Futura Integración)",
    "type": "EXTERNAL_API",
    "phone": "+54 11 5000-0000",
    "email": "soporte@moova.io",
    "website": "https://moova.io",
    "apiEnabled": false,
    "active": false,
    "notes": "Entregas ultra-rápidas en el mismo día mediante geolocalización urbana.",
    "createdAt": "2026-08-20T00:00:00.000Z"
  }
];

export const INITIAL_SHIPPING_ZONES: ShippingZone[] = [
  {
    "id": "zona-1",
    "name": "Zona 1 - Cercana / Manantiales y Suroeste (Hasta 4 km)",
    "description": "Manantiales, Alberdi, Alto Alberdi, Rosedal, Los Plátanos, Las Palmas, Santa Ana",
    "price": 3000,
    "cost": 3000,
    "active": true,
    "estimatedDelivery": "24 a 48 hs hábiles",
    "order": 1
  },
  {
    "id": "zona-2",
    "name": "Zona 2 - Centro y Macrocentro (4 a 8 km)",
    "description": "Centro, Nueva Córdoba, Güemes, Alta Córdoba, General Paz, Cofico, Observatorio",
    "price": 5000,
    "cost": 5000,
    "active": true,
    "estimatedDelivery": "24 a 48 hs hábiles",
    "order": 2
  },
  {
    "id": "zona-3",
    "name": "Zona 3 - Periférica / Circunvalación (8 a 15 km)",
    "description": "Cerro de las Rosas, Argüello, Villa Belgrano, Urca, Poeta Lugones, San Vicente, Guiñazú",
    "price": 7500,
    "cost": 7500,
    "active": true,
    "estimatedDelivery": "24 a 72 hs hábiles",
    "order": 3
  },
  {
    "id": "zona-4",
    "name": "Zona 4 - Gran Córdoba / Fuera de Circunvalación (> 15 km)",
    "description": "Villa Allende, Saldán, La Calera, Malvinas Argentinas, Mendiolaza, Unquillo",
    "price": 10000,
    "cost": 10000,
    "active": true,
    "estimatedDelivery": "48 a 72 hs hábiles",
    "order": 4
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    "id": "sup-inova",
    "name": "Inova ARG",
    "contactName": "Atención Mayorista Inova",
    "phone": "+54 9 11 5555-4321",
    "email": "ventas@inovaarg.com",
    "website": "https://inovaarg.com/",
    "type": "MAYORISTA",
    "minimumOrder": 80000,
    "integrationType": "MANUAL",
    "apiEnabled": false,
    "location": "Buenos Aires (Envíos a Córdoba Capital)",
    "cuit": "30-71649201-4",
    "leadTimeDays": 3,
    "notes": "Proveedor mayorista principal de bazar, hogar, organización y tecnología. Compra mínima mayorista $80.000 (requisito de abastecimiento interno). Gestión y verificación manual.",
    "active": true,
    "createdAt": "2026-01-10T10:00:00.000Z",
    "updatedAt": "2026-08-26T10:00:00.000Z"
  },
  {
    "id": "sup-cordoba-dist",
    "name": "Distribuidora Centro CBA",
    "contactName": "Gonzalo Fernández",
    "phone": "+54 9 351 444-8899",
    "email": "contacto@distribuidoracentrocba.com.ar",
    "website": "https://distribuidoracentrocba.com.ar",
    "type": "DISTRIBUIDOR",
    "minimumOrder": 30000,
    "integrationType": "MANUAL",
    "apiEnabled": false,
    "location": "Córdoba Capital (Zona Centro)",
    "cuit": "30-68934512-8",
    "leadTimeDays": 1,
    "notes": "Distribuidor local de Córdoba para reposiciones rápidas de insumos.",
    "active": true,
    "createdAt": "2026-02-15T09:00:00.000Z",
    "updatedAt": "2026-08-15T15:00:00.000Z"
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    "id": "po-inova-1001",
    "orderNumber": "PO-INOVA-0001",
    "supplierId": "sup-inova",
    "supplierName": "Inova ARG",
    "items": [
      {
        "productId": "prod-inova-adaptador-universal",
        "productName": "Adaptador universal viajero",
        "productSku": "INO-ADAPT-UNIV",
        "supplierSku": "INO-ADAPT-UNIV",
        "supplierProductUrl": "https://inovaarg.com/producto/adaptador-universal-viajero/",
        "quantity": 20,
        "estimatedCostPrice": 4500,
        "subtotal": 90000
      }
    ],
    "totalEstimatedCost": 90000,
    "status": "READY",
    "notes": "Orden consolidada que supera el mínimo de $80.000 de Inova ARG para compras mayoristas.",
    "createdAt": "2026-09-15T03:03:00.000Z",
    "updatedAt": "2026-09-15T03:03:00.000Z"
  }
];

export const INITIAL_SUPPLIER_RETURNS: SupplierReturn[] = [];

export const INITIAL_CATEGORIES: Category[] = [
  {
    "id": "electrodomesticos",
    "name": "Electrodomésticos",
    "slug": "electrodomesticos",
    "icon": "Zap",
    "imageUrl": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80",
    "order": 5,
    "subcategories": [
      { "id": "elec-clima", "name": "Ventiladores, Climatizadores y Aire", "slug": "ventiladores-clima" },
      { "id": "elec-cocina", "name": "Batidoras, Licuadoras y Cocina Eléctrica", "slug": "cocina-electrica" },
      { "id": "elec-cuidado", "name": "Aspiradoras, Costura y Hogar", "slug": "hogar-y-costura" }
    ]
  },
  {
    "id": "seguridad",
    "name": "Seguridad y Protección",
    "slug": "seguridad",
    "icon": "ShieldCheck",
    "imageUrl": "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&auto=format&fit=crop&q=80",
    "order": 14,
    "subcategories": [
      { "id": "seg-candados", "name": "Lingas, Candados y Cadenas", "slug": "lingas-candados" },
      { "id": "seg-alarmas", "name": "Alarmas y Sensores", "slug": "alarmas-sensores" }
    ]
  },

  {
    "id": "accesorios",
    "name": "Accesorios",
    "slug": "accesorios",
    "icon": "Layers",
    "imageUrl": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-purple-100 text-purple-800",
    "order": 1,
    "subcategories": [
      {
        "id": "acc-teclados-mouse",
        "name": "Teclados y Mouse",
        "slug": "teclados-mouse"
      },
      {
        "id": "acc-mousepads",
        "name": "Mousepads Gamer",
        "slug": "mousepads-gamer"
      },
      {
        "id": "acc-soportes",
        "name": "Soportes Celular / Notebook / TV",
        "slug": "soportes"
      },
      {
        "id": "acc-cables",
        "name": "Cables, Hubs y Adaptadores",
        "slug": "cables-adaptadores"
      },
      {
        "id": "acc-electricidad",
        "name": "Zapatillas y Tomas Eléctricas",
        "slug": "zapatillas-tomas"
      },
      {
        "id": "acc-fundas",
        "name": "Fundas y Protectores",
        "slug": "fundas-protectores"
      }
    ]
  },
  {
    "id": "audio-y-sonido",
    "name": "Audio y Sonido",
    "slug": "audio-y-sonido",
    "icon": "Volume2",
    "imageUrl": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-blue-100 text-blue-800",
    "order": 2,
    "subcategories": [
      {
        "id": "aud-parlantes-bt",
        "name": "Parlantes Bluetooth",
        "slug": "parlantes-bluetooth"
      },
      {
        "id": "aud-barras-sonido",
        "name": "Barras de Sonido",
        "slug": "barras-sonido"
      },
      {
        "id": "aud-microfonos",
        "name": "Micrófonos y Streaming",
        "slug": "microfonos-streaming"
      },
      {
        "id": "aud-auto-stereo",
        "name": "Estéreos y Audio para Auto",
        "slug": "estereos-auto"
      },
      {
        "id": "aud-radios",
        "name": "Radios y Reproductores",
        "slug": "radios-reproductores"
      }
    ]
  },
  {
    "id": "auriculares",
    "name": "Auriculares",
    "slug": "auriculares",
    "icon": "Headphones",
    "imageUrl": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-indigo-100 text-indigo-800",
    "order": 3,
    "subcategories": [
      {
        "id": "aur-tws",
        "name": "Auriculares TWS Inalámbricos",
        "slug": "auriculares-tws"
      },
      {
        "id": "aur-vincha",
        "name": "Auriculares Vincha Bluetooth",
        "slug": "auriculares-vincha"
      },
      {
        "id": "aur-gamer",
        "name": "Auriculares Gamer con Micrófono",
        "slug": "auriculares-gamer"
      },
      {
        "id": "aur-cable",
        "name": "Auriculares In-Ear con Cable",
        "slug": "auriculares-cable"
      }
    ]
  },
  {
    "id": "capibara",
    "name": "Capibara",
    "slug": "capibara",
    "icon": "Smile",
    "imageUrl": "https://images.unsplash.com/photo-1588165171080-c89acfa5ee83?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-amber-100 text-amber-800",
    "order": 4
  },
  {
    "id": "cargadores",
    "name": "Cargadores",
    "slug": "cargadores",
    "icon": "Zap",
    "imageUrl": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-yellow-100 text-yellow-800",
    "order": 5,
    "subcategories": [
      {
        "id": "carg-gan-pd",
        "name": "Cargadores Rápidos GaN / PD",
        "slug": "cargadores-rapidos"
      },
      {
        "id": "carg-cables",
        "name": "Cables Tipo C y Lightning",
        "slug": "cables-tipo-c-lightning"
      },
      {
        "id": "carg-qi",
        "name": "Cargadores Inalámbricos Qi",
        "slug": "cargadores-inalambricos"
      },
      {
        "id": "carg-auto",
        "name": "Cargadores para Auto",
        "slug": "cargadores-auto"
      }
    ]
  },
  {
    "id": "entretenimiento",
    "name": "Entretenimiento",
    "slug": "entretenimiento",
    "icon": "Gamepad2",
    "imageUrl": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-violet-100 text-violet-800",
    "order": 6,
    "subcategories": [
      {
        "id": "ent-consolas",
        "name": "Consolas Retro y Portátiles",
        "slug": "consolas-retro"
      },
      {
        "id": "ent-joysticks",
        "name": "Joysticks y Mandos Gaming",
        "slug": "joysticks-mandos"
      },
      {
        "id": "ent-juegos-mesa",
        "name": "Juegos de Mesa y Cartas",
        "slug": "juegos-mesa"
      },
      {
        "id": "ent-antiestres",
        "name": "Gadgets Antiestrés",
        "slug": "antiestres"
      }
    ]
  },
  {
    "id": "escolar",
    "name": "Escolar",
    "slug": "escolar",
    "icon": "BookOpen",
    "imageUrl": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-emerald-100 text-emerald-800",
    "order": 7,
    "subcategories": [
      {
        "id": "esc-cuadernos",
        "name": "Cuadernos, Libretas y Diarios",
        "slug": "cuadernos-libretas"
      },
      {
        "id": "esc-cartucheras",
        "name": "Cartucheras y Lapiceros",
        "slug": "cartucheras-lapiceros"
      },
      {
        "id": "esc-marcadores",
        "name": "Marcadores, Fibras y Resaltadores",
        "slug": "marcadores-resaltadores"
      },
      {
        "id": "esc-mochilas",
        "name": "Mochilas Escolares 3D",
        "slug": "mochilas-escolares"
      }
    ]
  },
  {
    "id": "estetica",
    "name": "Estética",
    "slug": "estetica",
    "icon": "Sparkles",
    "imageUrl": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-rose-100 text-rose-800",
    "order": 8,
    "subcategories": [
      {
        "id": "est-pelo",
        "name": "Cortadoras, Planchitas y Secadores",
        "slug": "cortadoras-planchitas-secadores"
      },
      {
        "id": "est-limpieza-facial",
        "name": "Skincare y Limpieza Facial",
        "slug": "skincare-limpieza-facial"
      },
      {
        "id": "est-maquillaje",
        "name": "Maquillaje, Labiales y Rubores",
        "slug": "maquillaje-labiales-rubores"
      },
      {
        "id": "est-perfumeria",
        "name": "Perfumes Árabes y Fragancias",
        "slug": "perfumes-arabes"
      },
      {
        "id": "est-masajeadores",
        "name": "Masajeadores y Bienestar",
        "slug": "masajeadores-bienestar"
      },
      {
        "id": "est-manicuria",
        "name": "Manicuría y Cuidado Personal",
        "slug": "manicuria-cuidado-personal"
      }
    ]
  },
  {
    "id": "griferia",
    "name": "Grifería",
    "slug": "griferia",
    "icon": "Droplets",
    "imageUrl": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-cyan-100 text-cyan-800",
    "order": 9,
    "subcategories": [
      {
        "id": "gri-monocomando",
        "name": "Canillas Monocomando",
        "slug": "canillas-monocomando"
      },
      {
        "id": "gri-duchadores",
        "name": "Duchadores y Cabezales",
        "slug": "duchadores-cabezales"
      },
      {
        "id": "gri-accesorios",
        "name": "Accesorios y Flexibles",
        "slug": "accesorios-flexibles"
      }
    ]
  },
  {
    "id": "iluminacion",
    "name": "Iluminación",
    "slug": "iluminacion",
    "icon": "Lightbulb",
    "imageUrl": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-amber-100 text-amber-800",
    "order": 10,
    "subcategories": [
      {
        "id": "ilu-lamparas",
        "name": "Lámparas de Noche y Veladores",
        "slug": "lamparas-veladores"
      },
      {
        "id": "ilu-tiras-led",
        "name": "Tiras LED RGB y Neón",
        "slug": "tiras-led-rgb-neon"
      },
      {
        "id": "ilu-sensor",
        "name": "Luces LED con Sensor y Emergencia",
        "slug": "luces-sensor-emergencia"
      },
      {
        "id": "ilu-exterior-solar",
        "name": "Faroles Solares y Reflectores",
        "slug": "faroles-solares-reflectores"
      },
      {
        "id": "ilu-proyectores",
        "name": "Proyectores de Galaxia y Efectos",
        "slug": "proyectores-galaxia"
      }
    ]
  },
  {
    "id": "importacion-china",
    "name": "Importación China",
    "slug": "importacion-china",
    "icon": "Plane",
    "imageUrl": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-red-100 text-red-800",
    "order": 11
  },
  {
    "id": "indumentaria-y-blanqueria",
    "name": "Indumentaria y Blanquería",
    "slug": "indumentaria-y-blanqueria",
    "icon": "Bed",
    "imageUrl": "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-teal-100 text-teal-800",
    "order": 12,
    "subcategories": [
      {
        "id": "ind-sabanas",
        "name": "Juegos de Sábanas y Fundas",
        "slug": "sabanas-fundas"
      },
      {
        "id": "ind-acolchados",
        "name": "Acolchados, Frazadas y Mantas",
        "slug": "acolchados-frazadas-mantas"
      },
      {
        "id": "ind-toallas",
        "name": "Toallas y Toallones",
        "slug": "toallas-toallones"
      },
      {
        "id": "ind-cortinas",
        "name": "Cortinas y Blackout",
        "slug": "cortinas-blackout"
      },
      {
        "id": "ind-indumentaria",
        "name": "Prendas, Pijamas y Medias",
        "slug": "prendas-pijamas-medias"
      }
    ]
  },
  {
    "id": "iphone",
    "name": "iPhone",
    "slug": "iphone",
    "icon": "Smartphone",
    "imageUrl": "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-slate-200 text-slate-800",
    "order": 13
  },
  {
    "id": "labubu",
    "name": "Labubu",
    "slug": "labubu",
    "icon": "Gift",
    "imageUrl": "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-fuchsia-100 text-fuchsia-800",
    "order": 14
  },
  {
    "id": "marroquineria",
    "name": "Marroquinería",
    "slug": "marroquineria",
    "icon": "ShoppingBag",
    "imageUrl": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-amber-100 text-amber-900",
    "order": 15,
    "subcategories": [
      {
        "id": "mar-valijas",
        "name": "Valijas y Sets de Viaje",
        "slug": "valijas-viaje"
      },
      {
        "id": "mar-mochilas",
        "name": "Mochilas Urbanas Impermeables",
        "slug": "mochilas-urbanas"
      },
      {
        "id": "mar-bolsos-termicos",
        "name": "Bolsos Térmicos y Conservadoras",
        "slug": "bolsos-termicos-conservadoras"
      },
      {
        "id": "mar-billeteras",
        "name": "Billeteras y Tarjeteros",
        "slug": "billeteras-tarjeteros"
      },
      {
        "id": "mar-rinoneras",
        "name": "Riñoneras, Bandoleras y Carteras",
        "slug": "rinoneras-bandoleras-carteras"
      }
    ]
  },
  {
    "id": "novedades",
    "name": "Novedades",
    "slug": "novedades",
    "icon": "Flame",
    "imageUrl": "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-orange-100 text-orange-800",
    "order": 16,
    "subcategories": [
      {
        "id": "nov-destacados",
        "name": "Nuevos Ingresos y Destacados",
        "slug": "nuevos-ingresos-destacados"
      }
    ]
  },
  {
    "id": "productos-varios",
    "name": "Productos Varios",
    "slug": "productos-varios",
    "icon": "LayoutGrid",
    "imageUrl": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-sky-100 text-sky-800",
    "order": 17,
    "subcategories": [
      {
        "id": "var-organizadores",
        "name": "Organizadores Prácticos",
        "slug": "organizadores-practicos"
      },
      {
        "id": "var-bazar",
        "name": "Bazar Práctico",
        "slug": "bazar-practico"
      },
      {
        "id": "var-herramientas",
        "name": "Ferretería y Seguridad",
        "slug": "ferreteria-seguridad"
      },
      {
        "id": "var-limpieza",
        "name": "Limpieza y Mantenimiento",
        "slug": "limpieza-mantenimiento"
      }
    ]
  },
  {
    "id": "stitch",
    "name": "Stitch",
    "slug": "stitch",
    "icon": "Heart",
    "imageUrl": "https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-blue-100 text-blue-800",
    "order": 18
  },
  {
    "id": "termos-y-mates",
    "name": "Termos y Mates",
    "slug": "termos-y-mates",
    "icon": "Coffee",
    "imageUrl": "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-stone-200 text-stone-800",
    "order": 19,
    "subcategories": [
      {
        "id": "ter-termos-acero",
        "name": "Termos de Acero Inoxidable",
        "slug": "termos-acero-inoxidable"
      },
      {
        "id": "ter-matermos",
        "name": "Matermos y Mates Autocebantes",
        "slug": "matermos-mates-autocebantes"
      },
      {
        "id": "ter-mates-termicos",
        "name": "Mates Térmicos con Bombilla",
        "slug": "mates-termicos-bombilla"
      },
      {
        "id": "ter-bombillas-accesorios",
        "name": "Bombillas y Accesorios Materos",
        "slug": "bombillas-accesorios"
      },
      {
        "id": "ter-vasos-cafe",
        "name": "Vasos Cafeteros Doble Pared",
        "slug": "vasos-cafeteros"
      }
    ]
  },
  {
    "id": "vajillas",
    "name": "Vajillas",
    "slug": "vajillas",
    "icon": "Utensils",
    "imageUrl": "https://images.unsplash.com/photo-1516715094483-75da7dee9758?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-orange-100 text-orange-800",
    "order": 20,
    "subcategories": [
      {
        "id": "vaj-tazas-platos",
        "name": "Tazas, Mugs y Platos",
        "slug": "tazas-mugs-platos"
      },
      {
        "id": "vaj-cubiertos",
        "name": "Cubiertos y Sets de Mesa",
        "slug": "cubiertos-sets-mesa"
      }
    ]
  },
  {
    "id": "vasos-y-botellas",
    "name": "Vasos y Botellas",
    "slug": "vasos-y-botellas",
    "icon": "CupSoda",
    "imageUrl": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-emerald-100 text-emerald-800",
    "order": 21,
    "subcategories": [
      {
        "id": "vas-quencher",
        "name": "Vasos Quencher Tumbler 1.2L",
        "slug": "vasos-quencher-tumbler"
      },
      {
        "id": "vas-botellas-parlante",
        "name": "Botellas Térmicas con Parlante",
        "slug": "botellas-parlante"
      },
      {
        "id": "vas-botellas-sport",
        "name": "Botellas Deportivas Motivacionales",
        "slug": "botellas-deportivas"
      },
      {
        "id": "vas-vasos-sorbete",
        "name": "Vasos con Tapa y Sorbete",
        "slug": "vasos-tapa-sorbete"
      }
    ]
  },
  {
    "id": "verano",
    "name": "Verano",
    "slug": "verano",
    "icon": "Sun",
    "imageUrl": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-yellow-100 text-yellow-800",
    "order": 22,
    "subcategories": [
      {
        "id": "ver-playa",
        "name": "Playa, Piletas y Aire Libre",
        "slug": "playa-piletas"
      }
    ]
  },
  {
    "id": "reventon-de-quencher",
    "name": "Reventón de Quencher",
    "slug": "reventon-de-quencher",
    "icon": "Flame",
    "imageUrl": "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-pink-100 text-pink-800",
    "order": 23,
    "subcategories": [
      {
        "id": "vas-quencher",
        "name": "Vasos Quencher 1200ml",
        "slug": "vasos-quencher"
      }
    ]
  },
  {
    "id": "infantil",
    "name": "Infantil",
    "slug": "infantil",
    "icon": "Smile",
    "imageUrl": "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-rose-100 text-rose-800",
    "order": 24,
    "subcategories": [
      {
        "id": "inf-juguetes",
        "name": "Juguetes, Muñecas y Figuras",
        "slug": "juguetes-figuras"
      },
      {
        "id": "inf-didacticos",
        "name": "Juegos Didácticos, Puzzles y Arte",
        "slug": "juegos-didacticos-puzzles"
      },
      {
        "id": "inf-pistas-autos",
        "name": "Autos, Pistas y Control Remoto",
        "slug": "autos-pistas-control-remoto"
      },
      {
        "id": "inf-belleza",
        "name": "Maquillaje y Accesorios Kids",
        "slug": "maquillaje-accesorios-kids"
      },
      {
        "id": "inf-deportes",
        "name": "Deportes y Aire Libre",
        "slug": "deportes-aire-libre"
      },
      {
        "id": "inf-bebes",
        "name": "Primera Infancia y Bebés",
        "slug": "primera-infancia-bebes"
      }
    ]
  },
  {
    "id": "hogar",
    "name": "Hogar",
    "slug": "hogar",
    "icon": "Home",
    "imageUrl": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-amber-100 text-amber-800",
    "order": 25,
    "subcategories": [
      {
        "id": "hog-decoracion",
        "name": "Decoración y Confort",
        "slug": "decoracion-confort"
      },
      {
        "id": "hog-aromatizacion",
        "name": "Humidificadores y Difusores",
        "slug": "humidificadores-difusores"
      },
      {
        "id": "hog-bano",
        "name": "Baño y Sanitarios",
        "slug": "bano-sanitarios"
      },
      {
        "id": "hog-limpieza",
        "name": "Limpieza y Lavandería",
        "slug": "limpieza-lavanderia"
      },
      {
        "id": "hog-jardin",
        "name": "Jardín, Gazebos y Exteriores",
        "slug": "jardin-gazebos-exteriores"
      },
      {
        "id": "hog-organizacion",
        "name": "Organizadores del Hogar",
        "slug": "organizadores-hogar"
      }
    ]
  },
  {
    "id": "cocina",
    "name": "Cocina",
    "slug": "cocina",
    "icon": "UtensilsCrossed",
    "imageUrl": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-orange-100 text-orange-800",
    "order": 26,
    "subcategories": [
      {
        "id": "coc-ollas-sartenes",
        "name": "Ollas, Sartenes y Woks",
        "slug": "ollas-sartenes-woks"
      },
      {
        "id": "coc-utensilios",
        "name": "Cuchillos y Utensilios",
        "slug": "cuchillos-utensilios"
      },
      {
        "id": "coc-reposteria",
        "name": "Moldes y Repostería",
        "slug": "moldes-reposteria"
      },
      {
        "id": "coc-hermeticos",
        "name": "Herméticos y Contenedores",
        "slug": "hermeticos-contenedores"
      },
      {
        "id": "coc-bazar",
        "name": "Bazar y Accesorios de Cocina",
        "slug": "bazar-accesorios"
      }
    ]
  },
  {
    "id": "organizacion",
    "name": "Organización",
    "slug": "organizacion",
    "icon": "Box",
    "imageUrl": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-blue-100 text-blue-800",
    "order": 27,
    "subcategories": [
      {
        "id": "org-cajas-cestos",
        "name": "Cajas y Canastos",
        "slug": "cajas-canastos"
      },
      {
        "id": "org-percheros-zapateros",
        "name": "Percheros y Zapateros",
        "slug": "percheros-zapateros"
      },
      {
        "id": "org-estantes",
        "name": "Estantes, Repisas y Muebles",
        "slug": "estantes-repisas"
      }
    ]
  },
  {
    "id": "tecnologia",
    "name": "Tecnología",
    "slug": "tecnologia",
    "icon": "Smartphone",
    "imageUrl": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-indigo-100 text-indigo-800",
    "order": 28,
    "subcategories": [
      {
        "id": "tec-seguridad",
        "name": "Cámaras de Seguridad y Alarmas",
        "slug": "camaras-seguridad-alarmas"
      },
      {
        "id": "tec-smart",
        "name": "Timbres y Domótica",
        "slug": "timbres-domotica"
      },
      {
        "id": "tec-gadgets",
        "name": "TV Box, Gadgets y Contadores",
        "slug": "tv-box-gadgets"
      }
    ]
  },
  {
    "id": "herramientas",
    "name": "Herramientas",
    "slug": "herramientas",
    "icon": "Wrench",
    "imageUrl": "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-yellow-100 text-yellow-800",
    "order": 29,
    "subcategories": [
      {
        "id": "her-manuales",
        "name": "Herramientas Manuales y Sets",
        "slug": "herramientas-manuales"
      },
      {
        "id": "her-electricas",
        "name": "Herramientas Eléctricas y Batería",
        "slug": "herramientas-electricas"
      },
      {
        "id": "her-jardin-riego",
        "name": "Riego, Mangueras y Jardinería",
        "slug": "riego-mangueras-jardineria"
      },
      {
        "id": "her-medicion",
        "name": "Medición, Balanzas y Precisión",
        "slug": "medicion-balanzas"
      },
      {
        "id": "her-seguridad-auto",
        "name": "Compresores y Accesorios Auto",
        "slug": "compresores-auto"
      }
    ]
  },
  {
    "id": "ofertas",
    "name": "Ofertas",
    "slug": "ofertas",
    "icon": "Percent",
    "imageUrl": "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&auto=format&fit=crop&q=80",
    "badgeColor": "bg-red-100 text-red-700",
    "order": 30
  }
];

export const INITIAL_ORDERS: Order[] = [
];

export const INITIAL_COUPONS: Coupon[] = [
  {
    "id": "coup-vondro10",
    "code": "VONDRO10",
    "discountType": "percentage",
    "value": 10,
    "minPurchaseAmount": 15000,
    "usedCount": 42,
    "maxUses": 200,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "10% de descuento en toda la tienda (mínimo $15.000)",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-1",
    "code": "PRIMERACOMPRA",
    "discountType": "percentage",
    "value": 10,
    "minPurchaseAmount": 15000,
    "usedCount": 24,
    "maxUses": 100,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "10% de descuento en tu primera compra (mínimo $15.000)",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-2",
    "code": "ENVIOCBA",
    "discountType": "fixed",
    "value": 3500,
    "minPurchaseAmount": 40000,
    "usedCount": 19,
    "maxUses": 150,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "$3.500 de descuento especial Córdoba (mínimo $40.000)",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-3",
    "code": "SUPERPROMO",
    "discountType": "percentage",
    "value": 15,
    "minPurchaseAmount": 60000,
    "usedCount": 8,
    "maxUses": 50,
    "startDate": "2026-08-15",
    "expiresAt": "2026-11-30",
    "active": true,
    "description": "15% OFF en compras mayores a $60.000",
    "createdAt": "2026-08-15T00:00:00.000Z"
  },
  {
    "id": "coup-bienvenida",
    "code": "BIENVENIDA",
    "discountType": "percentage",
    "value": 10,
    "minPurchaseAmount": 20000,
    "usedCount": 31,
    "maxUses": 300,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "Cupón especial de bienvenida para nuevos clientes",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-cordoba",
    "code": "CORDOBAENVIO",
    "discountType": "fixed",
    "value": 3500,
    "minPurchaseAmount": 35000,
    "usedCount": 12,
    "maxUses": 100,
    "startDate": "2026-08-10",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "Bonificación de envío urbano en compras desde $35.000",
    "createdAt": "2026-08-10T00:00:00.000Z"
  },
  {
    "id": "coup-pack5000",
    "code": "PACK5000",
    "discountType": "fixed",
    "value": 5000,
    "minPurchaseAmount": 0,
    "usedCount": 0,
    "maxUses": 1000,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "🎁 Pack de Bienvenida: $5.000 OFF directo en tu pedido",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-promo15",
    "code": "PROMO15",
    "discountType": "percentage",
    "value": 15,
    "minPurchaseAmount": 0,
    "usedCount": 0,
    "maxUses": 1000,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "🎉 15% OFF Extra en tu compra de hoy",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-bono2000",
    "code": "BONO2000",
    "discountType": "fixed",
    "value": 2000,
    "minPurchaseAmount": 0,
    "usedCount": 0,
    "maxUses": 1000,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "✨ Bono Ruleta: $2.000 de descuento directo",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-regalo3000",
    "code": "REGALO3000",
    "discountType": "fixed",
    "value": 3000,
    "minPurchaseAmount": 0,
    "usedCount": 0,
    "maxUses": 1000,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "🎁 Regalo Especial: $3.000 OFF en tu orden",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-enviogratis",
    "code": "ENVIOGRATIS",
    "discountType": "fixed",
    "value": 4500,
    "minPurchaseAmount": 0,
    "usedCount": 0,
    "maxUses": 1000,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "🚚 Cupón Envío Gratis en Córdoba Capital",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-vip20",
    "code": "VIP20",
    "discountType": "percentage",
    "value": 20,
    "minPurchaseAmount": 0,
    "usedCount": 0,
    "maxUses": 1000,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "👑 Cupón VIP: 20% OFF en todo el catálogo",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  {
    "id": "coup-bienvenido",
    "code": "BIENVENIDO",
    "discountType": "fixed",
    "value": 2500,
    "minPurchaseAmount": 0,
    "usedCount": 0,
    "maxUses": 1000,
    "startDate": "2026-08-01",
    "expiresAt": "2026-12-31",
    "active": true,
    "description": "🌟 $2.500 de Bienvenida para nuevos usuarios",
    "createdAt": "2026-08-01T00:00:00.000Z"
  }
];

export const INITIAL_SETTINGS: StoreSettings = {
  "storeName": "VONDRO",
  "tagline": "Todo lo que necesitás, más cerca.",
  "logoUrl": "",
  "whatsappNumber": "+5493515948952",
  "whatsappGreeting": "¡Hola! Te contacto desde la tienda online VONDRO.",
  "supportEmail": "contacto@vondro.com.ar",
  "address": "Centro de Distribución VONDRO, Córdoba Capital",
  "city": "Córdoba Capital, Argentina",
  "freeShippingThreshold": 100000,
  "deliveryTimeSlotsEnabled": true,
  "availableTimeSlots": [
    "09:00 - 13:00 (Mañana)",
    "14:00 - 18:00 (Tarde)",
    "18:00 - 21:00 (Noche)"
  ],
  "dailyDeliveryCapacity": 25,
  "supplierMinimumOrder": 80000,
  "supplierCheckExpirationHours": 24,
  "requireSupplierUrl": false,
  "defaultPriceRounding": 100,
  "defaultTargetMargin": 30,
  "defaultMinimumMargin": 15,
  "bankDetails": {
    "bankName": "Banco Santander Río / Bancor Córdoba",
    "accountHolder": "VONDRO Tienda Online",
    "cbu": "0720123488000034567890",
    "alias": "VONDRO.CORDOBA",
    "cuit": "20-38492014-9"
  },
  "mercadoPago": {
    "enabled": true,
    "publicKey": "TEST-348920-vondro-public-key",
    "accessToken": "TEST-348920-vondro-access-token",
    "mode": "test",
    "sandbox": true
  },
  "zones": [
    {
      "id": "zona-1",
      "name": "Zona 1 - Cercana / Villa Martínez (Hasta 4 km)",
      "description": "Villa Martínez, Las Palmas, Santa Ana, Los Plátanos, Rosedal, San Rafael, Villa Unión",
      "price": 3000,
      "cost": 3000,
      "active": true,
      "estimatedDelivery": "24 a 48 hs hábiles",
      "order": 1
    },
    {
      "id": "zona-2",
      "name": "Zona 2 - Alberdi, Centro y Macrocentro (4 a 8 km)",
      "description": "Alberdi, Alto Alberdi, Observatorio, Centro, Nueva Córdoba, Güemes, Manantiales",
      "price": 5000,
      "cost": 5000,
      "active": true,
      "estimatedDelivery": "24 a 48 hs hábiles",
      "order": 2
    },
    {
      "id": "zona-3",
      "name": "Zona 3 - Periférica / Circunvalación / Norte (8 a 15 km)",
      "description": "Cerro de las Rosas, Urca, Alta Córdoba, General Paz, Cofico, Villa Belgrano, Argüello",
      "price": 7500,
      "cost": 7500,
      "active": true,
      "estimatedDelivery": "24 a 72 hs hábiles",
      "order": 3
    },
    {
      "id": "zona-4",
      "name": "Zona 4 - Gran Córdoba / Fuera de Circunvalación (> 15 km)",
      "description": "Villa Allende, Saldán, La Calera, Malvinas Argentinas, Mendiolaza, Unquillo",
      "price": 10000,
      "cost": 10000,
      "active": true,
      "estimatedDelivery": "48 a 72 hs hábiles",
      "order": 4
    }
  ]
};

export const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    "id": "tck-001",
    "ticketNumber": "TCK-0001",
    "userId": "user-juan",
    "customerName": "Juan Pérez",
    "customerEmail": "juanperez@gmail.com",
    "customerPhone": "351 123 4567",
    "orderId": "ord-1",
    "orderNumber": "#VON-000001",
    "reason": "DAMAGED_PRODUCT",
    "reasonLabel": "Producto con falla / daño",
    "message": "El cable USB-C de la caja parece no hacer buen contacto al conectar.",
    "priority": "HIGH",
    "status": "IN_PROGRESS",
    "conversationId": "conv-101",
    "adminNotes": "Contactado por WhatsApp. Se envía cable de reemplazo en el reparto de la tarde sin costo.",
    "createdAt": "2026-08-26T08:50:00.000Z",
    "updatedAt": "2026-08-26T09:10:00.000Z"
  },
  {
    "id": "tck-002",
    "ticketNumber": "TCK-0002",
    "userId": "user-marcos",
    "customerName": "Marcos Toledo",
    "customerEmail": "mtoledo@gmail.com",
    "customerPhone": "351 998 1234",
    "orderId": "ord-2",
    "orderNumber": "#VON-000002",
    "reason": "NOT_RECEIVED",
    "reasonLabel": "Demora en la entrega",
    "message": "Estaba programado para ayer a la tarde y aún no lo recibí.",
    "priority": "MEDIUM",
    "status": "WAITING_CLIENT",
    "adminNotes": "El cadete pasó a las 18:30 hs pero no atendieron el timbre. Reprogramado para hoy con cliente.",
    "createdAt": "2026-08-25T19:00:00.000Z",
    "updatedAt": "2026-08-26T08:30:00.000Z"
  },
  {
    "id": "tck-003",
    "ticketNumber": "TCK-0003",
    "userId": "user-laura",
    "customerName": "Laura Medina",
    "customerEmail": "laura.m@yahoo.com.ar",
    "customerPhone": "351 776 5544",
    "orderId": "ord-3",
    "orderNumber": "#VON-000003",
    "reason": "CANCELLATION",
    "reasonLabel": "Cancelación de pedido",
    "message": "Me equivoqué de modelo al elegir el soporte de auto, solicito cancelar antes del envío.",
    "priority": "HIGH",
    "status": "RESOLVED",
    "resolutionNotes": "Pedido cancelado y stock reintegrado al catálogo. Reintegro emitido por Mercado Pago.",
    "createdAt": "2026-08-24T14:10:00.000Z",
    "updatedAt": "2026-08-24T15:00:00.000Z"
  }
];

export const INITIAL_FAQS: FAQItem[] = [
  {
    "id": "faq-compras-1",
    "category": "compras",
    "question": "¿Cómo comprar en VONDRO?",
    "answer": "Elegí tus productos navegando el catálogo o usando el buscador, agregalos al carrito con \"Agregar al carrito\", revisá tu pedido y hacé clic en \"Iniciar Compra\". Completá tus datos de envío en Córdoba y elegí tu medio de pago favorito.",
    "order": 1,
    "active": true,
    "viewsCount": 142,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-compras-2",
    "category": "compras",
    "question": "¿Hay compra mínima para pedir en la tienda?",
    "answer": "No tenemos monto mínimo de compra para clientes minoristas. Podés comprar desde 1 unidad. Si tu compra supera los $100.000 ARS, el envío es 100% GRATIS en Córdoba Capital.",
    "order": 2,
    "active": true,
    "viewsCount": 88,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-compras-3",
    "category": "compras",
    "question": "¿Puedo comprar como invitado sin crear cuenta?",
    "answer": "¡Sí! Podés realizar tu compra como invitado ingresando solo tu nombre, teléfono y dirección de entrega. Si creás cuenta podrás ver el historial completo y guardar tus direcciones.",
    "order": 3,
    "active": true,
    "viewsCount": 65,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-pagos-1",
    "category": "pagos",
    "question": "¿Cuáles son los medios de pago aceptados?",
    "answer": "Aceptamos Mercado Pago (tarjetas de crédito, débito y dinero en cuenta), Transferencia Bancaria Directa con acreditación inmediata (CBU/Alias Bancor y Santander), y Pago en Efectivo contra entrega para zonas seleccionadas de Córdoba Capital.",
    "order": 1,
    "active": true,
    "viewsCount": 210,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-pagos-2",
    "category": "pagos",
    "question": "¿Cómo informo un pago por transferencia bancaria?",
    "answer": "Al finalizar tu pedido seleccionando \"Transferencia Bancaria\", verás en pantalla nuestro CBU y Alias oficial (VONDRO.CORDOBA). Una vez hecha la transferencia, podés enviar el comprobante por WhatsApp con tu número de pedido.",
    "order": 2,
    "active": true,
    "viewsCount": 95,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-pagos-3",
    "category": "pagos",
    "question": "¿Es seguro pagar con Mercado Pago en VONDRO?",
    "answer": "Totalmente seguro. Todas las transacciones se procesan mediante los servidores certificados de Mercado Pago con cifrado SSL de extremo a extremo.",
    "order": 3,
    "active": true,
    "viewsCount": 54,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-envios-1",
    "category": "envios",
    "question": "¿Cuánto cuesta el envío en Córdoba Capital?",
    "answer": "Las tarifas vigentes son: Centro, Nueva Córdoba y Güemes: $3.500 ARS. Zona Norte y Zona Sur: $4.500 ARS. Gran Córdoba (Villa Allende, Carlos Paz, La Calera): $6.500 ARS. ¡En compras mayores a $100.000 ARS el envío es GRATIS!",
    "order": 1,
    "active": true,
    "viewsCount": 320,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-envios-2",
    "category": "envios",
    "question": "¿Hacen envíos en el día (Same Day)?",
    "answer": "Sí. Para pedidos confirmados y abonados antes de las 14:00 hs en Córdoba Capital (Centro, Nva Córdoba, Güemes, Alberdi), entregamos en el mismo día entre las 15:00 y las 20:00 hs.",
    "order": 2,
    "active": true,
    "viewsCount": 180,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-envios-3",
    "category": "envios",
    "question": "¿Cómo funciona el seguimiento de mi envío?",
    "answer": "Con tu código de seguimiento (ej. VON-TRK-000001) o ingresando a \"Mis Pedidos\", podés ver el estado en tiempo real (Preparando, En camino, Entregado) con el cadete asignado.",
    "order": 3,
    "active": true,
    "viewsCount": 115,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-cambios-1",
    "category": "cambios",
    "question": "¿Puedo cambiar un producto si no era lo que esperaba?",
    "answer": "Sí, tenés 10 días corridos desde que recibís tu compra para solicitar un cambio. El producto debe estar sin uso, con su embalaje original y accesorios completos.",
    "order": 1,
    "active": true,
    "viewsCount": 76,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-cambios-2",
    "category": "cambios",
    "question": "¿Cómo solicito un cambio?",
    "answer": "Podés solicitarlo directamente a través del Asistente VONDRO diciendo \"Quiero cambiar un producto\" o creando un Ticket de Soporte desde tu cuenta o el chat.",
    "order": 2,
    "active": true,
    "viewsCount": 48,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-devoluciones-1",
    "category": "devoluciones",
    "question": "¿Qué hago si mi producto llegó defectuoso o fallado?",
    "answer": "Comunicate de inmediato por el Asistente VONDRO o WhatsApp indicando tu número de pedido y foto/video de la falla. Si el producto presenta falla de fábrica dentro de los 30 días, lo reemplazamos sin costo o te reintegramos el dinero.",
    "order": 1,
    "active": true,
    "viewsCount": 130,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-devoluciones-2",
    "category": "devoluciones",
    "question": "¿Cuánto demora el reintegro de dinero por devolución?",
    "answer": "Una vez recibido y verificado el producto devuelto, el reintegro se efectiviza en un plazo máximo de 24 a 48 horas hábiles mediante el mismo medio de pago utilizado.",
    "order": 2,
    "active": true,
    "viewsCount": 42,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-pedidos-1",
    "category": "pedidos",
    "question": "¿Dónde encuentro mi número de pedido?",
    "answer": "Tu número de pedido comienza con #VON- (ejemplo: #VON-000001) y podés verlo en la pantalla de confirmación de compra, en la sección \"Mis Pedidos\" de tu perfil o consultando al Asistente VONDRO con \"Mi pedido\".",
    "order": 1,
    "active": true,
    "viewsCount": 92,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-pedidos-2",
    "category": "pedidos",
    "question": "¿Puedo cancelar un pedido?",
    "answer": "Podés solicitar la cancelación de tu pedido antes de que salga a reparto diciendo \"Quiero cancelar mi compra\" en el chat del asistente.",
    "order": 2,
    "active": true,
    "viewsCount": 60,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-cuenta-1",
    "category": "cuenta",
    "question": "¿Cómo recupero mi contraseña?",
    "answer": "En la pantalla de inicio de sesión, hacé clic en \"¿Olvidaste tu contraseña?\". Ingresá tu correo electrónico registrado y te enviaremos un enlace seguro para restablecerla.",
    "order": 1,
    "active": true,
    "viewsCount": 35,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  },
  {
    "id": "faq-cuenta-2",
    "category": "cuenta",
    "question": "¿Cómo actualizo mi dirección de entrega habitual?",
    "answer": "Desde tu perfil de usuario, en la pestaña \"Mis Datos y Direcciones\", podés agregar, editar o seleccionar tu dirección predeterminada para que se complete automáticamente al comprar.",
    "order": 2,
    "active": true,
    "viewsCount": 28,
    "createdAt": "2026-08-01T10:00:00.000Z",
    "updatedAt": "2026-08-01T10:00:00.000Z"
  }
];

export const INITIAL_SUPPLIER_CHECKS: SupplierCheck[] = [
  {
    "id": "chk-1",
    "productId": "prod-inova-adaptador-universal",
    "productName": "Adaptador universal viajero",
    "productSku": "INO-ADAPT-UNIV",
    "supplierId": "sup-inova",
    "supplierName": "Inova ARG",
    "availability": "AVAILABLE",
    "costPriceObserved": 4500,
    "checkedBy": "Diego (Admin)",
    "checkedAt": "2026-09-15T03:03:00.000Z",
    "notes": "Verificado en inovaarg.com/producto/adaptador-universal-viajero/. Stock abundante de 800 disponibles y precio mayorista de $4.500."
  }
];

export const INITIAL_SHIPPING_EXPENSES: ShippingExpense[] = [
  {
    "id": "exp-1",
    "orderId": "ord-1024",
    "amount": 1800,
    "type": "COURIER",
    "description": "Pago por envío en moto - Centro Nva Cba",
    "createdAt": "2026-08-20T11:30:00.000Z"
  },
  {
    "id": "exp-2",
    "amount": 5000,
    "type": "FUEL",
    "description": "Carga de combustible para ronda de repartos semanal",
    "createdAt": "2026-08-19T09:00:00.000Z"
  },
  {
    "id": "exp-3",
    "amount": 3200,
    "type": "PACKAGING",
    "description": "Compra de 50 bolsas e-commerce y cinta de embalar reforzada",
    "createdAt": "2026-08-15T16:00:00.000Z"
  }
];

export const INITIAL_ABANDONED_CARTS: AbandonedCart[] = [
  {
    "id": "ab-cart-01",
    "customerName": "Santiago Rossi",
    "customerPhone": "+54 9 351 445-8921",
    "customerEmail": "santiago.rossi@gmail.com",
    "items": [
      {
        "product": {
          "id": "prod-inova-adaptador-universal",
          "sku": "INO-ADAPT-UNIV",
          "name": "Adaptador universal viajero",
          "slug": "adaptador-universal-viajero",
          "description": "Adaptador universal de viaje todo en uno (All-in-One).",
          "shortFeatures": [
            "Compatible con 150+ países",
            "Protección contra sobrecargas"
          ],
          "categoryId": "accesorios",
          "images": [
            "/adaptador-universal-viajero.jpg"
          ],
          "costPrice": 4500,
          "salePrice": 4500,
          "originalPrice": 6500,
          "stock": 800,
          "stockStatus": "available",
          "hideIfOutOfStock": false,
          "isFeatured": true,
          "isOnSale": true,
          "isNew": true,
          "rating": 5,
          "reviewCount": 0,
          "supplier": "Inova ARG",
          "lastUpdated": "2026-09-15",
          "salesCount": 0
        },
        "quantity": 2
      }
    ],
    "subtotal": 9000,
    "discountAmount": 0,
    "shippingZoneId": "zona-1",
    "status": "ABANDONED",
    "recoveryCouponCode": "VONDRO10",
    "notes": "Llegó hasta la pantalla de selección de método de pago.",
    "createdAt": "2026-09-14T20:30:00.000Z",
    "lastActivityAt": "2026-09-14T20:45:00.000Z"
  },
  {
    "id": "ab-cart-02",
    "customerName": "Florencia Benítez",
    "customerPhone": "+54 9 351 632-1100",
    "customerEmail": "flor.benitez.cba@hotmail.com",
    "items": [
      {
        "product": {
          "id": "prod-inova-adaptador-universal",
          "sku": "INO-ADAPT-UNIV",
          "name": "Adaptador universal viajero",
          "slug": "adaptador-universal-viajero",
          "description": "Adaptador universal de viaje todo en uno (All-in-One).",
          "shortFeatures": [
            "Compatible con 150+ países",
            "Protección contra sobrecargas"
          ],
          "categoryId": "accesorios",
          "images": [
            "/adaptador-universal-viajero.jpg"
          ],
          "costPrice": 4500,
          "salePrice": 4500,
          "originalPrice": 6500,
          "stock": 800,
          "stockStatus": "available",
          "hideIfOutOfStock": false,
          "isFeatured": true,
          "isOnSale": true,
          "isNew": true,
          "rating": 5,
          "reviewCount": 0,
          "supplier": "Inova ARG",
          "lastUpdated": "2026-09-15",
          "salesCount": 0
        },
        "quantity": 1
      }
    ],
    "subtotal": 4500,
    "discountAmount": 0,
    "shippingZoneId": "zona-2",
    "status": "ABANDONED",
    "recoveryCouponCode": "VONDRO10",
    "notes": "Abandonó en paso de dirección de envío (Zona Norte CBA).",
    "createdAt": "2026-09-14T17:10:00.000Z",
    "lastActivityAt": "2026-09-14T17:25:00.000Z"
  }
];

export const INITIAL_UNRESOLVED_QUERIES: UnresolvedQuery[] = [
  {
    "id": "unres-001",
    "queryText": "¿Tienen local a la calle para retirar personalmente en el centro?",
    "customerName": "Gonzalo R.",
    "conversationId": "conv-102",
    "channel": "WEB",
    "category": "envios",
    "resolved": false,
    "adminAnswer": "VONDRO opera 100% online con envíos rápidos a domicilio en Córdoba Capital para garantizar los mejores precios directos de distribuidor.",
    "convertedToFaq": false,
    "createdAt": "2026-08-26T08:10:00.000Z"
  },
  {
    "id": "unres-002",
    "queryText": "¿Hacen factura A para empresas?",
    "customerName": "Distribuidora Norte",
    "channel": "WHATSAPP",
    "category": "pagos",
    "resolved": true,
    "adminAnswer": "Sí, emitimos Factura A y B. Podés ingresar tu CUIT al finalizar la compra o enviarnos la constancia de AFIP/ARCA.",
    "convertedToFaq": true,
    "createdAt": "2026-08-25T11:20:00.000Z",
    "resolvedAt": "2026-08-25T14:00:00.000Z"
  }
];

export const INITIAL_USER: UserAccount = {
  "id": "user-diego-admin",
  "name": "Diego Reartes",
  "email": "reartes17diego@gmail.com",
  "phone": "+54 9 351 594-8952",
  "role": "admin",
  "addresses": [],
  "favorites": [],
  "createdAt": "2026-08-01T00:00:00.000Z"
};

export const INITIAL_ASSISTANT_CONVERSATIONS: AssistantConversation[] = [
  {
    "id": "conv-welcome",
    "userId": "anonymous",
    "customerName": "Cliente VONDRO",
    "channel": "WEB",
    "status": "NUEVO",
    "lastMessageText": "¡Hola! 👋 Soy tu asistente inteligente de VONDRO Córdoba. ¿En qué te puedo ayudar hoy?",
    "lastMessageAt": "2026-09-20T12:00:00.000Z",
    "unreadByAdminCount": 0,
    "unreadByUserCount": 0,
    "createdAt": "2026-09-20T12:00:00.000Z",
    "updatedAt": "2026-09-20T12:00:00.000Z"
  }
];
