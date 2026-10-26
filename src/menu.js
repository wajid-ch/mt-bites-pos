import source from './menu-source.json' with { type: 'json' };

export const menuCategories = [
  'Burgers', 'Classic Pizza', 'Special Pizza', 'Pizza Deals', 'BBQ',
  'Fish', 'Wings', 'Shawarma & Wraps', 'Snacks', 'Fries & Sides',
  'Combo Deals', 'Special Platters', 'Drinks & Shakes', 'Ice Cream Shakes',
  'MT Sips & Bites', 'Desserts'
];

export const categoryEmoji = {
  'Burgers': '🍔', 'Classic Pizza': '🍕', 'Special Pizza': '🍕', 'Pizza Deals': '🍕',
  'BBQ': '🍢', 'Fish': '🐟', 'Wings': '🍗', 'Shawarma & Wraps': '🌯',
  'Snacks': '🍗', 'Fries & Sides': '🍟', 'Combo Deals': '🍱',
  'Special Platters': '🍽️', 'Drinks & Shakes': '🥤', 'Ice Cream Shakes': '🥤',
  'MT Sips & Bites': '☕', 'Desserts': '🍰'
};

export const categoryImages = {
  'Burgers': '/images/food/burger.webp',
  'Classic Pizza': '/images/food/pizza.webp',
  'Special Pizza': '/images/food/pizza.webp',
  'Pizza Deals': '/images/food/pizza.webp',
  'BBQ': '/images/food/bbq.webp',
  'Fish': '/images/food/fish.webp',
  'Wings': '/images/food/wings.webp',
  'Shawarma & Wraps': '/images/food/wrap.webp',
  'Snacks': '/images/food/nuggets.webp',
  'Fries & Sides': '/images/food/fries.webp',
  'Combo Deals': '/images/food/platter.webp',
  'Special Platters': '/images/food/platter.webp',
  'Drinks & Shakes': '/images/food/drinks.webp',
  'Ice Cream Shakes': '/images/food/shakes.webp',
  'MT Sips & Bites': '/images/food/chai.webp',
  'Desserts': '/images/food/desserts.webp'
};

export const specificProductImages = {
  'M.T Special Paratha Twister': '/images/food/paratha-twister.webp',
  'M.T Loaded Pasta': '/images/food/loaded-pasta.webp',
  'M.T Special Pan Fries': '/images/food/special-pan-fries.webp',
  'Egg Fried Rice': '/images/food/egg-fried-rice.webp',
  'Chicken Fried Rice': '/images/food/chicken-fried-rice.webp',
  'Family Platter': '/images/food/family-platter-hero.webp',
  'M.T. Special Platter': '/images/food/platter.webp'
};

export function getProductImage(product) {
  if (product?.image) return product.image;
  if (product?.name && specificProductImages[product.name]) {
    return specificProductImages[product.name];
  }
  return categoryImages[product?.category] || '/images/food/burger.webp';
}

export function seedProducts() {
  const groups = new Map();
  source.menu_items.forEach((entry) => {
    const key = `${entry.category}::${entry.product_name}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `product-${groups.size + 1}`,
        name: entry.product_name,
        category: entry.category,
        description: entry.description || '',
        active: true,
        needsConfirmation: false,
        image: specificProductImages[entry.product_name] || categoryImages[entry.category] || '',
        variants: []
      });
    }
    const product = groups.get(key);
    if (entry.description && !product.description) product.description = entry.description;
    product.needsConfirmation ||= !!entry.needs_confirmation;
    product.variants.push({
      id: `v${product.variants.length + 1}`,
      label: entry.variant || 'Regular',
      price: Number(entry.price_pkr)
    });
  });
  return [...groups.values()];
}
