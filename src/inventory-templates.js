/**
 * Standard inventory categories, cold drink brand/size presets, and measurement
 * units tailored for MT Bites restaurant.
 */
export const INVENTORY_CATEGORIES = [
  'Beverages & Cold Drinks',
  'Raw Meat',
  'Dairy & Cheese',
  'Bakery & Breads',
  'Sauces & Oils',
  'Fresh Produce',
  'Packaging',
  'Supplies'
];

export const COLD_DRINK_BRANDS = [
  'Pepsi',
  'Coca-Cola',
  '7Up',
  'Sprite',
  'Mountain Dew',
  'Mirinda',
  'Fanta',
  'Sting',
  'Next Cola',
  'Mineral Water',
  'Custom'
];

export const BOTTLE_SIZES = [
  '250ml / Regular',
  '345ml',
  '500ml',
  '1L',
  '1.5L',
  '2.25L',
  'Can (250ml)',
  'Custom'
];

export const restaurantInventoryTemplates = [
  // Raw Meats & Proteins
  { name: 'Boneless Chicken (Breast/Thigh)', category: 'Raw Meat', unit: 'kg', quantity: 25, minimum: 10 },
  { name: 'Whole Broiler Chicken', category: 'Raw Meat', unit: 'kg', quantity: 15, minimum: 8 },
  { name: 'Fish Fillets (Fry & Grill)', category: 'Seafood', unit: 'kg', quantity: 12, minimum: 5 },

  // Flours, Cheese & Dairy
  { name: 'Maida / White Flour (Dough & Breading)', category: 'Dry Goods', unit: 'kg', quantity: 50, minimum: 20 },
  { name: 'Mozzarella Pizza Cheese', category: 'Dairy', unit: 'kg', quantity: 15, minimum: 8 },
  { name: 'Ice Cream Tubs (Vanilla & Choc)', category: 'Dairy', unit: 'L', quantity: 10, minimum: 4 },

  // Sauces & Cooking Essentials
  { name: 'Cooking Oil / Deep Fry Shortening', category: 'Oils', unit: 'L', quantity: 40, minimum: 15 },
  { name: 'Pizza Sauce / Marinara', category: 'Sauces', unit: 'kg', quantity: 10, minimum: 5 },
  { name: 'Garlic Mayo & Zinger Sauce', category: 'Sauces', unit: 'kg', quantity: 12, minimum: 5 },

  // Bakery & Breads
  { name: 'Zinger Burger Buns (Sesame)', category: 'Bakery', unit: 'pcs', quantity: 100, minimum: 30 },
  { name: 'Regular Burger Buns', category: 'Bakery', unit: 'pcs', quantity: 60, minimum: 20 },
  { name: 'Shawarma Wraps / Tortillas', category: 'Bakery', unit: 'pcs', quantity: 80, minimum: 25 },

  // Fresh Produce
  { name: 'Fresh Onions (Sliced)', category: 'Produce', unit: 'kg', quantity: 15, minimum: 5 },
  { name: 'Fresh Tomatoes', category: 'Produce', unit: 'kg', quantity: 10, minimum: 4 },
  { name: 'Green Bell Peppers (Capsicum)', category: 'Produce', unit: 'kg', quantity: 8, minimum: 3 },

  // Beverages
  { name: 'Soft Drink Cans (Pepsi/7Up/Mirinda)', category: 'Beverages', unit: 'cans', quantity: 48, minimum: 24 },

  // Packaging & Disposables
  { name: 'Small Pizza Boxes (7")', category: 'Packaging', unit: 'pcs', quantity: 100, minimum: 30 },
  { name: 'Large Pizza Boxes (13")', category: 'Packaging', unit: 'pcs', quantity: 100, minimum: 30 },
  { name: 'Burger Wrapper Sheets', category: 'Packaging', unit: 'packets', quantity: 10, minimum: 3 },
  { name: 'French Fry Serving Pouches', category: 'Packaging', unit: 'pcs', quantity: 200, minimum: 50 },
  { name: 'Thermal Receipt Rolls (80mm/58mm)', category: 'Supplies', unit: 'rolls', quantity: 10, minimum: 4 }
];
