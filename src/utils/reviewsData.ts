import { Product, ProductReview } from '../types';

interface ReviewTemplate {
  categoryKeywords: string[];
  reviews: Array<{
    author: string;
    avatarColor: string;
    country: string;
    daysAgo: number;
    rating: number;
    title?: string;
    comment: string;
    likes: number;
    hasPhotos?: boolean;
    photoKeywords?: string[];
  }>;
}

const REVIEW_TEMPLATES: ReviewTemplate[] = [
  {
    categoryKeywords: ['herramienta', 'llave', 'destornillador', 'taladro', 'kit', 'reparacion', 'tester', 'sierra', 'ferreteria'],
    reviews: [
      {
        author: 'Martín Almada',
        avatarColor: 'bg-blue-600',
        country: '🇦🇷 Argentina (Córdoba)',
        daysAgo: 4,
        rating: 5,
        title: 'Excelente calidad y resistencia',
        comment: 'Superó mis expectativas. El material es bien sólido, los encastres son precisos y la funda para guardarlas es de muy buena calidad. Ideal para el taller y uso diario.',
        likes: 18,
        hasPhotos: true
      },
      {
        author: 'Esteban Gomez',
        avatarColor: 'bg-emerald-600',
        country: '🇦🇷 Argentina (Río Cuarto)',
        daysAgo: 12,
        rating: 5,
        title: 'Muy práctico y completo',
        comment: 'Llegó en 24 horas a Córdoba Capital. Muy buena relación precio-calidad. Lo probé ajustando varias tuercas difíciles y no se deforma para nada.',
        likes: 11
      },
      {
        author: 'Claudio R.',
        avatarColor: 'bg-amber-600',
        country: '🇦🇷 Argentina (Villa María)',
        daysAgo: 26,
        rating: 4,
        title: 'Buena herramienta',
        comment: 'Muy conforme con la compra. Cumple perfectamente su función. El envío fue súper rápido.',
        likes: 5
      },
      {
        author: 'Lucas Ferreyra',
        avatarColor: 'bg-purple-600',
        country: '🇦🇷 Argentina (Carlos Paz)',
        daysAgo: 38,
        rating: 5,
        title: 'Recomendadísimo',
        comment: 'Es tal cual se describe en las fotos. El agarre es cómodo y las terminaciones son prolijas.',
        likes: 9
      }
    ]
  },
  {
    categoryKeywords: ['mixer', 'licuadora', 'cocina', 'termo', 'pote', 'condimento', 'hogar', 'bazar', 'taza', 'botella'],
    reviews: [
      {
        author: 'Valeria Soria',
        avatarColor: 'bg-rose-500',
        country: '🇦🇷 Argentina (Córdoba)',
        daysAgo: 2,
        rating: 5,
        title: 'Hermoso y muy funcional',
        comment: 'Excelente producto, muy buena potencia y fácil de limpiar. Llegó muy bien embalado y antes de lo esperado.',
        likes: 14,
        hasPhotos: true
      },
      {
        author: 'Mariana Peralta',
        avatarColor: 'bg-teal-600',
        country: '🇦🇷 Argentina (Alta Gracia)',
        daysAgo: 9,
        rating: 5,
        title: 'Súper práctico',
        comment: 'Lo uso todos los días en la cocina, es un 10. Materiales de primera calidad y muy estético.',
        likes: 8
      },
      {
        author: 'Gonzalo F.',
        avatarColor: 'bg-indigo-600',
        country: '🇦🇷 Argentina (San Francisco)',
        daysAgo: 20,
        rating: 4,
        title: 'Muy buen producto',
        comment: 'Buena relación precio calidad. Cumple con creces lo que promete.',
        likes: 4
      }
    ]
  },
  {
    categoryKeywords: ['parlante', 'auricular', 'cable', 'cargador', 'adaptador', 'electronica', 'audio', 'bluetooth', 'tecnologia'],
    reviews: [
      {
        author: 'Karina Rach',
        avatarColor: 'bg-pink-600',
        country: '🇦🇷 Argentina (Córdoba)',
        daysAgo: 5,
        rating: 5,
        title: 'Excelente conectividad y sonido',
        comment: 'Funciona impecable. Conexión rápida por Bluetooth, sonido nítido y la batería dura un montón.',
        likes: 21,
        hasPhotos: true
      },
      {
        author: 'Rodrigo Mansilla',
        avatarColor: 'bg-sky-600',
        country: '🇦🇷 Argentina (Jesús María)',
        daysAgo: 15,
        rating: 5,
        title: '100% recomendable',
        comment: 'Muy buena calidad de construcción. Lo probé ni bien llegó y anduvo perfecto.',
        likes: 12
      },
      {
        author: 'Pato Gutierrez',
        avatarColor: 'bg-emerald-600',
        country: '🇦🇷 Argentina (Córdoba)',
        daysAgo: 30,
        rating: 4,
        title: 'Muy buen equipo',
        comment: 'Buen volumen y fidelidad. El tamaño es ideal para llevar a todos lados.',
        likes: 7
      }
    ]
  },
  {
    categoryKeywords: ['maquillaje', 'belleza', 'cuidado', 'skincare', 'perfume', 'espejo', 'cepillo'],
    reviews: [
      {
        author: 'Florencia Benitez',
        avatarColor: 'bg-fuchsia-600',
        country: '🇦🇷 Argentina (Córdoba)',
        daysAgo: 3,
        rating: 5,
        title: 'Me encantó!',
        comment: 'Viene completísimo y la presentación es hermosa. Los colores pigmentan genial.',
        likes: 19,
        hasPhotos: true
      },
      {
        author: 'Camila Rossini',
        avatarColor: 'bg-violet-600',
        country: '🇦🇷 Argentina (Villa Allende)',
        daysAgo: 14,
        rating: 5,
        title: 'Excelente calidad',
        comment: 'Hermoso set, fue un regalo para mi hermana y quedó fascinada. Llegó rapidísimo.',
        likes: 15
      },
      {
        author: 'Sofia Diaz',
        avatarColor: 'bg-pink-500',
        country: '🇦🇷 Argentina (Río Ceballos)',
        daysAgo: 28,
        rating: 5,
        title: 'Divino',
        comment: 'Muy lindo diseño y calidad. Todo impecable.',
        likes: 6
      }
    ]
  },
  {
    categoryKeywords: ['juguete', 'rompecabezas', 'nene', 'nena', 'bebe', 'burbujero', 'juego', 'infantil'],
    reviews: [
      {
        author: 'Gabriela Casas',
        avatarColor: 'bg-teal-600',
        country: '🇦🇷 Argentina (Córdoba)',
        daysAgo: 6,
        rating: 5,
        title: 'A mis nenes les encantó',
        comment: 'Muy entretenido, piezas seguras sin bordes filosos y colores bien vivos. Recomiendo!',
        likes: 16,
        hasPhotos: true
      },
      {
        author: 'Micaela Vera',
        avatarColor: 'bg-amber-600',
        country: '🇦🇷 Argentina (Cosquín)',
        daysAgo: 18,
        rating: 5,
        title: 'Muy buena compra',
        comment: 'Llegó en perfecto estado, tal cual la foto. El material es resistente.',
        likes: 8
      }
    ]
  }
];

const DEFAULT_GENERAL_REVIEWS = [
  {
    author: 'Facundo Rossi',
    avatarColor: 'bg-emerald-600',
    country: '🇦🇷 Argentina (Córdoba Capital)',
    daysAgo: 4,
    rating: 5,
    title: 'Excelente compra, llegó rápido',
    comment: 'Llegó en impecables condiciones por cadetería a Nueva Córdoba. Producto 100% original y coincide exacto con las fotos de la publicación.',
    likes: 15,
    hasPhotos: true
  },
  {
    author: 'Silvia Maidana',
    avatarColor: 'bg-purple-600',
    country: '🇦🇷 Argentina (Villa Carlos Paz)',
    daysAgo: 16,
    rating: 5,
    title: 'Muy satisfecha con la atención',
    comment: 'Muy conforme con la compra. El envío fue súper rápido y la atención excelente por WhatsApp.',
    likes: 9,
    hasPhotos: true
  },
  {
    author: 'Jorge Luque',
    avatarColor: 'bg-blue-600',
    country: '🇦🇷 Argentina (Río Cuarto)',
    daysAgo: 29,
    rating: 4,
    title: 'Buen producto',
    comment: 'Buena relación calidad-precio. Cumple con lo esperado y funciona perfecto.',
    likes: 4
  }
];

function formatDateAgo(daysAgo: number): string {
  if (daysAgo <= 0) return 'Hoy';
  if (daysAgo === 1) return 'Ayer';
  if (daysAgo < 7) return `hace ${daysAgo} días`;
  if (daysAgo < 30) return `hace ${Math.floor(daysAgo / 7)} semanas`;
  return `hace ${Math.floor(daysAgo / 30)} meses`;
}

/**
 * Generates category-accurate initial reviews for a given product.
 */
export function generateRealisticInitialReviews(product: Product): ProductReview[] {
  const query = `${product.name} ${product.categoryId} ${product.description}`.toLowerCase();
  
  const matchedTemplate = REVIEW_TEMPLATES.find(t => 
    t.categoryKeywords.some(kw => query.includes(kw))
  );

  const rawReviews = matchedTemplate ? matchedTemplate.reviews : DEFAULT_GENERAL_REVIEWS;
  
  const variantName = product.variants && product.variants.length > 0 
    ? product.variants[0].name 
    : 'Estándar';

  return rawReviews.map((rev, index) => {
    // Generate realistic product photos from product's actual gallery if available
    const reviewImages: string[] = [];
    if (rev.hasPhotos && product.images && product.images.length > 0) {
      if (product.images.length > 1) {
        reviewImages.push(product.images[1]);
        if (product.images.length > 2) {
          reviewImages.push(product.images[2]);
        }
      } else {
        reviewImages.push(product.images[0]);
      }
    }

    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - rev.daysAgo);

    return {
      id: `rev-${product.id}-${index + 1}`,
      productId: product.id,
      author: rev.author,
      avatarColor: rev.avatarColor,
      country: rev.country,
      date: formatDateAgo(rev.daysAgo),
      rating: rev.rating,
      title: rev.title,
      comment: rev.comment,
      boughtVariant: variantName,
      verified: true,
      images: reviewImages.length > 0 ? reviewImages : undefined,
      likes: rev.likes,
      createdAt: createdDate.toISOString()
    };
  });
}

/**
 * Calculates rating summary statistics from an array of reviews.
 */
export function calculateProductRatingSummary(reviews: ProductReview[], fallbackRating = 0) {
  if (!reviews || reviews.length === 0) {
    return {
      rating: fallbackRating,
      reviewCount: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      verifiedCount: 0,
      withPhotosCount: 0,
      percentage5: 0,
      percentage4: 0,
      percentage3: 0,
      percentage2: 0,
      percentage1: 0
    };
  }

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  let verifiedCount = 0;
  let withPhotosCount = 0;

  for (const rev of reviews) {
    const r = Math.min(5, Math.max(1, Math.round(rev.rating)));
    distribution[r as keyof typeof distribution] = (distribution[r as keyof typeof distribution] || 0) + 1;
    sum += rev.rating;
    if (rev.verified) verifiedCount++;
    if (rev.images && rev.images.length > 0) withPhotosCount++;
  }

  const total = reviews.length;
  const avg = Number((sum / total).toFixed(1));

  return {
    rating: avg,
    reviewCount: total,
    distribution,
    verifiedCount,
    withPhotosCount,
    percentage5: Math.round((distribution[5] / total) * 100),
    percentage4: Math.round((distribution[4] / total) * 100),
    percentage3: Math.round((distribution[3] / total) * 100),
    percentage2: Math.round((distribution[2] / total) * 100),
    percentage1: Math.round((distribution[1] / total) * 100)
  };
}
