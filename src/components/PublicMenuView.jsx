import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingBag,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  LogIn,
  LogOut,
  ChevronRight,
  X,
  Plus,
  Minus,
  Check,
  UtensilsCrossed,
  Info,
  Menu as MenuIcon,
  KeyRound,
  ShieldCheck,
  User
} from 'lucide-react';
import { rs } from '../money.js';
import { getProductImage } from '../menu.js';
import { Logo } from './Navigation.jsx';

const CATEGORY_META = {
  All: { emoji: '🍽️', urdu: 'تمام آئٹمز' },
  Burgers: { emoji: '🍔', urdu: 'برگرز' },
  Pizzas: { emoji: '🍕', urdu: 'پیزا' },
  Deals: { emoji: '🔥', urdu: 'ڈیلز' },
  BBQ: { emoji: '🍗', urdu: 'تکہ بار بی کیو' },
  Wings: { emoji: '🍗', urdu: 'ونگز' },
  Wraps: { emoji: '🌯', urdu: 'رول پراٹھا' },
  Fries: { emoji: '🍟', urdu: 'فرائز' },
  Fish: { emoji: '🐟', urdu: 'مچھلی' },
  Snacks: { emoji: '🍿', urdu: 'سنیکس' },
  Drinks: { emoji: '🥤', urdu: 'مشروبات' },
  Shakes: { emoji: '🍦', urdu: 'شیک' },
  Desserts: { emoji: '🍰', urdu: 'میٹھا' },
  Chai: { emoji: '☕', urdu: 'چائے' }
};

export default function PublicMenuView({
  products = [],
  shopName = 'MT Bites',
  onStaffLoginClick,
  onGoToPos,
  onLogout,
  currentStaff
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customerTray, setCustomerTray] = useState([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [publicDrawerOpen, setPublicDrawerOpen] = useState(false);

  // Extract table number from URL (e.g. ?table=4)
  const tableParam = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('table');
    }
    return null;
  }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p.active) return false;
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.variants && p.variants.some(v => v.name.toLowerCase().includes(q)));
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  // Price helper for display
  const getDisplayPrice = (product) => {
    if (!product.variants || product.variants.length === 0) {
      return rs(product.price || 0);
    }
    const prices = product.variants.map(v => v.price).filter(p => typeof p === 'number');
    if (prices.length === 0) return rs(product.price || 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return rs(min);
    return `From ${rs(min)}`;
  };

  // Add item to customer preview tray
  const addToTray = (product, variant = null) => {
    const itemPrice = variant ? variant.price : product.price;
    const itemVariantName = variant ? variant.name : '';
    const trayKey = `${product.id}_${itemVariantName}`;

    setCustomerTray(prev => {
      const idx = prev.findIndex(item => item.key === trayKey);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          key: trayKey,
          productId: product.id,
          name: product.name,
          variant: itemVariantName,
          price: itemPrice,
          quantity: 1,
          category: product.category
        }
      ];
    });
    setSelectedProduct(null);
  };

  const updateTrayQty = (key, delta) => {
    setCustomerTray(prev => {
      return prev
        .map(item => {
          if (item.key === key) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const trayTotal = customerTray.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const trayCount = customerTray.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="public-menu-page">
      {/* Top Banner / Restaurant Info */}
      <header className="public-header">
        <div className="public-header-top">
          {/* Left: Hamburger button for Drawer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="public-drawer-toggle-btn"
              onClick={() => setPublicDrawerOpen(true)}
              title="Open Navigation Menu"
            >
              <MenuIcon size={22} />
            </button>

            <div className="public-brand">
              <Logo size={32} />
              <div>
                <h1>{shopName}</h1>
                <p className="public-tagline">Fresh, Crispy & Delicious Fast Food</p>
              </div>
            </div>
          </div>

          {/* Right: Quick Actions */}
          <div className="public-header-actions">
            {tableParam && (
              <div className="table-badge">
                <UtensilsCrossed size={13} />
                <span>#{tableParam}</span>
              </div>
            )}

            {currentStaff ? (
              <div className="header-staff-actions">
                <button
                  type="button"
                  className="staff-portal-btn active"
                  onClick={onGoToPos || onStaffLoginClick}
                  title="Return to Staff Ordering POS"
                >
                  <ShoppingBag size={15} />
                  <span>POS</span>
                </button>
                {onLogout && (
                  <button
                    type="button"
                    className="staff-portal-btn icon-only"
                    onClick={onLogout}
                    title="Sign Out"
                  >
                    <LogOut size={15} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Info Strip */}
        <div className="public-info-strip">
          <div className="info-chip">
            <Clock size={13} />
            <span>12:00 PM – 12:00 AM</span>
          </div>
          <div className="info-chip">
            <MapPin size={13} />
            <span>Kashmir, Pakistan</span>
          </div>
          <div className="info-chip highlight">
            <Sparkles size={13} />
            <span>100% Fresh Halal Meat</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="public-content">
        {/* Search Bar */}
        <div className="public-search-bar">
          <Search size={20} className="public-search-icon" />
          <input
            type="text"
            placeholder="🔍 Search (Zinger, Pizza, BBQ, Wings)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Category Pills Bar with Emojis */}
        <div className="public-categories">
          {categories.map(cat => {
            const meta = CATEGORY_META[cat] || { emoji: '🍽️', urdu: '' };
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                className={`public-cat-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                <span style={{ fontSize: '16px' }}>{meta.emoji}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Results Count */}
        <div className="public-results-meta">
          <span>{filteredProducts.length} items available</span>
          {activeCategory !== 'All' && <strong>in {activeCategory}</strong>}
        </div>

        {/* Product Cards Grid */}
        <div className="public-product-grid">
          {filteredProducts.map(product => {
            const imgSrc = getProductImage(product);
            const hasVariants = product.variants && product.variants.length > 1;

            return (
              <div
                key={product.id}
                className="public-card"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="public-card-img-wrap">
                  {imgSrc ? (
                    <img src={imgSrc} alt={product.name} loading="lazy" />
                  ) : (
                    <div className="public-img-fallback">🍔</div>
                  )}
                  {product.category && (
                    <span className="public-category-badge">{product.category}</span>
                  )}
                </div>

                <div className="public-card-body">
                  <h3 className="public-card-title">{product.name}</h3>
                  <div className="public-card-footer">
                    <span className="public-price">{getDisplayPrice(product)}</span>
                    <button
                      type="button"
                      className="public-select-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasVariants) {
                          setSelectedProduct(product);
                        } else {
                          addToTray(product, product.variants?.[0] || null);
                        }
                      }}
                    >
                      {hasVariants ? 'Options' : '+ Add'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="public-empty-state">
            <UtensilsCrossed size={48} />
            <h3>No menu items found</h3>
            <p>Try searching for another dish or choose a different category above.</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SIDEBAR DRAWER (Requested: easy login access & navigation) */}
      {/* ========================================================= */}
      {publicDrawerOpen && (
        <div className="drawer-scrim" onClick={() => setPublicDrawerOpen(false)}>
          <aside className="public-sidebar-drawer" onClick={e => e.stopPropagation()}>
            <div className="public-drawer-header">
              <Logo size={32} />
              <button
                type="button"
                className="icon-button"
                onClick={() => setPublicDrawerOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Table Indicator */}
            {tableParam && (
              <div className="public-drawer-table-box">
                <UtensilsCrossed size={16} />
                <span>You are ordering at <strong>Table #{tableParam}</strong></span>
              </div>
            )}

            {/* Big Obvious Staff / Admin Login Button */}
            <div className="public-drawer-auth-box">
              {currentStaff ? (
                <div>
                  <div className="drawer-staff-card">
                    <div className="drawer-staff-avatar">
                      <User size={18} />
                    </div>
                    <div>
                      <strong>{currentStaff.name}</strong>
                      <span className="drawer-role-pill">{currentStaff.role.toUpperCase()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    style={{ marginTop: '10px' }}
                    onClick={() => {
                      setPublicDrawerOpen(false);
                      onGoToPos?.();
                    }}
                  >
                    <ShoppingBag size={18} />
                    <span>Open Waiter POS</span>
                  </button>
                  {onLogout && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-full"
                      style={{ marginTop: '6px' }}
                      onClick={() => {
                        setPublicDrawerOpen(false);
                        onLogout();
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="drawer-auth-caption">Restaurant Staff & Administration:</p>
                  <button
                    type="button"
                    className="btn btn-primary btn-full btn-large drawer-login-cta"
                    onClick={() => {
                      setPublicDrawerOpen(false);
                      onStaffLoginClick();
                    }}
                  >
                    <KeyRound size={20} />
                    <div>
                      <strong>Staff & Admin Login</strong>
                      <small>عملہ اور مینیجر لاگ ان</small>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Category Quick Links */}
            <div className="drawer-categories-section">
              <span className="drawer-section-title">MENU CATEGORIES</span>
              <div className="drawer-cat-list">
                {categories.map(cat => {
                  const meta = CATEGORY_META[cat] || { emoji: '🍽️', urdu: '' };
                  const isSelected = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`drawer-cat-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setActiveCategory(cat);
                        setPublicDrawerOpen(false);
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{meta.emoji}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <strong>{cat}</strong>
                        {meta.urdu && <small style={{ display: 'block', fontSize: '11px', opacity: 0.7 }}>{meta.urdu}</small>}
                      </div>
                      {isSelected && <Check size={16} color="#fb923c" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Restaurant Info Footer */}
            <div className="public-drawer-footer">
              <p><strong>MT Bites Fast Food</strong></p>
              <p>📞 Order / WhatsApp Support</p>
              <p>📍 Kashmir, Pakistan</p>
            </div>
          </aside>
        </div>
      )}

      {/* Floating Customer Tray Bar (if customer selected items) */}
      {trayCount > 0 && !trayOpen && (
        <button
          type="button"
          className="customer-tray-bar"
          onClick={() => setTrayOpen(true)}
        >
          <div className="tray-info">
            <div className="tray-badge">{trayCount}</div>
            <div>
              <strong>Your Selection</strong>
              <small>Show waiter to order</small>
            </div>
          </div>
          <div className="tray-price">
            <span>Est. Total:</span>
            <strong>{rs(trayTotal)}</strong>
            <ChevronRight size={18} />
          </div>
        </button>
      )}

      {/* Detail / Variant Modal */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="public-modal-card" onClick={e => e.stopPropagation()}>
            <div className="public-modal-header">
              <h3>{selectedProduct.name}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedProduct(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="public-modal-img">
              {getProductImage(selectedProduct) ? (
                <img src={getProductImage(selectedProduct)} alt={selectedProduct.name} />
              ) : (
                <div className="public-img-fallback large">🍔</div>
              )}
            </div>

            <div className="public-modal-body">
              <span className="public-cat-tag">{selectedProduct.category}</span>
              <p className="public-modal-desc">
                Prepared fresh on order with MT Bites signature secret sauces, premium cheese, and tender marinated meats.
              </p>

              {/* Variants / Sizes */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                <div className="public-variant-list">
                  <label className="variant-label">Choose Size / Serving:</label>
                  {selectedProduct.variants.map((v, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="public-variant-item"
                      onClick={() => addToTray(selectedProduct, v)}
                    >
                      <span className="v-name">{v.name}</span>
                      <strong className="v-price">{rs(v.price)}</strong>
                      <span className="v-add-tag">+ Add to Tray</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-full btn-large"
                  onClick={() => addToTray(selectedProduct)}
                >
                  Add to Tray · {rs(selectedProduct.price || 0)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Tray Drawer */}
      {trayOpen && (
        <div className="modal-overlay" onClick={() => setTrayOpen(false)}>
          <div className="customer-tray-drawer" onClick={e => e.stopPropagation()}>
            <div className="tray-drawer-header">
              <div>
                <h2>Your Order Selection</h2>
                {tableParam && <p>Table #{tableParam}</p>}
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setTrayOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="tray-drawer-items">
              {customerTray.map(item => (
                <div key={item.key} className="tray-drawer-row">
                  <div className="tray-item-info">
                    <strong>{item.name}</strong>
                    {item.variant && <small>Size: {item.variant}</small>}
                    <span className="tray-item-unit">{rs(item.price)} each</span>
                  </div>
                  <div className="tray-stepper">
                    <button
                      type="button"
                      onClick={() => updateTrayQty(item.key, -1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateTrayQty(item.key, 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <strong className="tray-item-subtotal">
                    {rs(item.price * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="tray-drawer-footer">
              <div className="tray-total-row">
                <span>Estimated Total:</span>
                <strong>{rs(trayTotal)}</strong>
              </div>
              <div className="tray-instructions">
                <Info size={16} />
                <span>Please show this screen to your waiter to place your order!</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => setTrayOpen(false)}
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
