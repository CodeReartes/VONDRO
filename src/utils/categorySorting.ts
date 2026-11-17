import { Category, Product, Subcategory } from '../types';

export interface CategoryWithStats extends Category {
  productCount: number; // Active products with available stock
  totalSales: number;   // Sum of salesCount of those products
  totalProducts: number; // Total valid products (including out of stock)
}

export interface SubcategoryWithStats extends Subcategory {
  productCount: number;
  totalSales: number;
  totalProducts: number;
}

export const isAvailableInStock = (p: Product): boolean => {
  return (p.stock ?? 0) > 0 && p.stockStatus !== 'out_of_stock';
};

export const isValidCatalogProduct = (p: Product): boolean => {
  if (p.stockStatus === 'hidden' || (p as any).status === 'inactive') return false;
  if (p.hideIfOutOfStock && (p.stock ?? 0) <= 0) return false;
  return true;
};

export const matchProductCategory = (p: Product, categoryId: string, categorySlug?: string): boolean => {
  if (!p.categoryId) return false;
  const pCat = p.categoryId.toLowerCase().trim();
  const targetId = categoryId.toLowerCase().trim();
  if (pCat === targetId) return true;
  if (categorySlug && pCat === categorySlug.toLowerCase().trim()) return true;
  return false;
};

export const matchProductSubcategory = (p: Product, subcategoryId: string, subcategorySlug?: string): boolean => {
  if (!p.subcategoryId) return false;
  const pSub = p.subcategoryId.toLowerCase().trim();
  const targetId = subcategoryId.toLowerCase().trim();
  if (pSub === targetId) return true;
  if (subcategorySlug && pSub === subcategorySlug.toLowerCase().trim()) return true;
  return false;
};

export const formatAutoName = (str: string): string => {
  if (!str) return '';
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Intelligent sorting of categories:
 * 1. Automatically includes any new category discovered from products.
 * 2. Categories with stock available (productCount > 0):
 *    - Descending by productCount (available stock items)
 *    - Descending by totalSales (sales volume)
 *    - Alphabetical by name
 * 3. Categories without stock (productCount === 0, e.g. "capibara"):
 *    - Automatically displaced to the end of the horizontal list
 *    - Alphabetical by name
 */
export const getSortedCategoriesWithStats = (
  categories: Category[],
  products: Product[],
  hideEmpty: boolean = true
): {
  categories: CategoryWithStats[];
  totalAvailableCount: number;
} => {
  const activeProducts = products.filter(isValidCatalogProduct);
  const totalAvailableCount = activeProducts.filter(isAvailableInStock).length;

  const fullCategories: Category[] = [...(categories || [])];
  const knownCatIds = new Set(fullCategories.map(c => (c.id || '').toLowerCase()));

  // Dynamically auto-discover and register any new category present in products
  for (const p of activeProducts) {
    if (p.categoryId && !knownCatIds.has(p.categoryId.toLowerCase())) {
      knownCatIds.add(p.categoryId.toLowerCase());
      fullCategories.push({
        id: p.categoryId,
        name: formatAutoName(p.categoryId),
        slug: p.categoryId,
        icon: 'Package',
        badgeColor: 'bg-purple-100 text-purple-800',
        order: 99
      });
    }
  }

  const categoriesWithStats: CategoryWithStats[] = fullCategories.map(cat => {
    const catProducts = activeProducts.filter(p => matchProductCategory(p, cat.id, cat.slug));
    const availableCount = catProducts.filter(isAvailableInStock).length;
    const totalSales = catProducts.reduce((sum, p) => sum + (p.salesCount || 0), 0);

    return {
      ...cat,
      productCount: availableCount,
      totalSales,
      totalProducts: catProducts.length
    };
  });

  const withStock = categoriesWithStats.filter(c => c.productCount > 0);
  const emptyCategories = categoriesWithStats.filter(c => c.productCount === 0);

  // 1. Categories with stock: ordered descending by count of available items and sales volume
  withStock.sort((a, b) => {
    if (b.productCount !== a.productCount) {
      return b.productCount - a.productCount;
    }
    if (b.totalSales !== a.totalSales) {
      return b.totalSales - a.totalSales;
    }
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  if (hideEmpty) {
    return {
      categories: withStock,
      totalAvailableCount
    };
  }

  // 2. Categories without stock: moved to the end
  emptyCategories.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  return {
    categories: [...withStock, ...emptyCategories],
    totalAvailableCount
  };
};

/**
 * Intelligent sorting of subcategories for a given category:
 * 1. Automatically includes any new subcategory discovered from products in this category.
 * 2. Subcategories with stock available (productCount > 0):
 *    - Descending by productCount
 *    - Descending by totalSales
 *    - Alphabetical by name
 * 3. Subcategories without stock (productCount === 0):
 *    - Automatically excluded if hideEmpty = true, otherwise placed at the end
 */
export const getSortedSubcategoriesWithStats = (
  category: Category,
  products: Product[],
  hideEmpty: boolean = true
): {
  subcategories: SubcategoryWithStats[];
  totalAvailableCount: number;
} => {
  const categoryProducts = products.filter(p => {
    if (!matchProductCategory(p, category.id, category.slug)) return false;
    return isValidCatalogProduct(p);
  });

  const totalAvailableCount = categoryProducts.filter(isAvailableInStock).length;

  // Build subcategories map and auto-discover any new subcategories present in category products
  const knownSubs = new Map<string, Subcategory>();
  (category.subcategories || []).forEach(sub => {
    if (sub && sub.id) {
      knownSubs.set(sub.id.toLowerCase(), sub);
    }
  });

  for (const p of categoryProducts) {
    if (p.subcategoryId && !knownSubs.has(p.subcategoryId.toLowerCase())) {
      const autoSub: Subcategory = {
        id: p.subcategoryId,
        name: formatAutoName(p.subcategoryId),
        slug: p.subcategoryId
      };
      knownSubs.set(p.subcategoryId.toLowerCase(), autoSub);
    }
  }

  const allSubcategories = Array.from(knownSubs.values());
  if (allSubcategories.length === 0) {
    return { subcategories: [], totalAvailableCount: 0 };
  }

  const subcategoriesWithStats: SubcategoryWithStats[] = allSubcategories.map(sub => {
    const subProducts = categoryProducts.filter(p => matchProductSubcategory(p, sub.id, sub.slug));
    const availableCount = subProducts.filter(isAvailableInStock).length;
    const totalSales = subProducts.reduce((sum, p) => sum + (p.salesCount || 0), 0);

    return {
      ...sub,
      productCount: availableCount,
      totalSales,
      totalProducts: subProducts.length
    };
  });

  const withStock = subcategoriesWithStats.filter(s => s.productCount > 0);
  const emptySubcategories = subcategoriesWithStats.filter(s => s.productCount === 0);

  withStock.sort((a, b) => {
    if (b.productCount !== a.productCount) {
      return b.productCount - a.productCount;
    }
    if (b.totalSales !== a.totalSales) {
      return b.totalSales - a.totalSales;
    }
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  if (hideEmpty) {
    return {
      subcategories: withStock,
      totalAvailableCount
    };
  }

  emptySubcategories.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  return {
    subcategories: [...withStock, ...emptySubcategories],
    totalAvailableCount
  };
};
