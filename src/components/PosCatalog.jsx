import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Sparkles, Utensils, AlertCircle } from 'lucide-react';
import { menuCategories, categoryEmoji, getProductImage } from '../menu.js';
import { rs } from '../money.js';

export default function PosCatalog({
  products = [],
  cart = [],
  onAddToCart,
  onOpenVariantPicker,
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  onOpenCart
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [query, setQuery] = useState('');

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const activeProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(p => {
      if (!p.active) return false;
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (!q) return true;
      const haystack = `${p.name} ${p.category} ${p.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [products, selectedCategory, query]);

  const availableCategories = useMemo(() => {
    return ['All', ...menuCategories.filter(cat => products.some(p => p.active && p.category === cat))];
  }, [products]);

  const quickTables = ['1', '2', '3', '4', '5', '6', '7', '8'];

  return (
    <div className="pos-catalog-container">
      {/* Top Controls: Dine-in / Takeaway + Quick Table Selector */}
      <div className="pos-header-bar">
        <div className="order-type-pills">
          {['Dine-in', 'Takeaway', 'Delivery'].map(type => (
            <button
              key={type}
              type="button"
              className={`order-type-btn ${orderType === type ? 'active' : ''}`}
              onClick={() => setOrderType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {orderType === 'Dine-in' && (
          <div className="quick-tables-row">
            <span className="tables-label">Table:</span>
            <div className="quick-tables-scroll">
              {quickTables.map(num => (
                <button
                  key={num}
                  type="button"
                  className={`table-chip ${tableNumber === num ? 'table-chip-selected' : ''}`}
                  onClick={() => setOrderType('Dine-in') || setTableNumber(tableNumber === num ? '' : num)}
                >
                  T{num}
                </button>
              ))}
              <input
                type="text"
                className="custom-table-input"
                placeholder="Other #"
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                maxLength={6}
              />
            </div>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="pos-search-wrap">
        <div className="search-input">
          <Search size={18} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pizza, zinger burger, wings, bbq…"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQuery('')}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Sticky Category Tabs */}
      <div className="category-scroll-container">
        <div className="category-scroll">
          {availableCategories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`chip ${cat === selectedCategory ? 'chip-selected' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <span className="chip-icon">{cat === 'All' ? '✨' : (categoryEmoji[cat] || '🍽️')}</span>
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Title & Product Count */}
      <div className="results-row">
        <h2>{selectedCategory === 'All' ? 'Full Menu' : selectedCategory}</h2>
        <span className="results-count">{activeProducts.length} items</span>
      </div>

      {/* Product Cards Grid */}
      {activeProducts.length ? (
        <div className="product-grid">
          {activeProducts.map(product => {
            const hasMultipleVariants = product.variants.length > 1;
            const minPrice = Math.min(...product.variants.map(v => v.price));
            const imgSrc = getProductImage(product);

            return (
              <div
                key={product.id}
                className="product-card"
                onClick={() => {
                  if (hasMultipleVariants) {
                    onOpenVariantPicker(product);
                  } else {
                    onAddToCart(product, product.variants[0]);
                  }
                }}
              >
                <div className="product-img-wrap">
                  <img
                    src={imgSrc}
                    alt={product.name}
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'grid';
                    }}
                  />
                  <div className="img-fallback" style={{ display: 'none' }}>
                    <span>{categoryEmoji[product.category] || '🍽️'}</span>
                  </div>
                  {hasMultipleVariants && (
                    <span className="variant-tag">
                      {product.variants.length} sizes
                    </span>
                  )}
                  {product.needsConfirmation && (
                    <span className="review-tag" title="Owner confirmation needed">
                      Review
                    </span>
                  )}
                </div>

                <div className="product-details">
                  <h3 className="product-title">{product.name}</h3>
                  {product.description && (
                    <p className="product-desc">{product.description}</p>
                  )}
                  <div className="product-card-bottom">
                    <span className="product-price">
                      {hasMultipleVariants ? `From ${rs(minPrice)}` : rs(product.variants[0].price)}
                    </span>
                    <button
                      type="button"
                      className="product-add-btn"
                      aria-label={`Add ${product.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasMultipleVariants) {
                          onOpenVariantPicker(product);
                        } else {
                          onAddToCart(product, product.variants[0]);
                        }
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon">
            <Utensils size={28} />
          </div>
          <h3>No matching items</h3>
          <p>Try searching with another keyword or pick "All" categories.</p>
        </div>
      )}
    </div>
  );
}
