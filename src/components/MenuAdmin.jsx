import React, { useState, useMemo } from 'react';
import { Search, Plus, Edit3, Eye, EyeOff, Trash2, Check, X, Image as ImageIcon, AlertTriangle, Upload } from 'lucide-react';
import { menuCategories, getProductImage } from '../menu.js';
import { rs, parseAmount } from '../money.js';
import { generateId } from '../id.js';

export default function MenuAdmin({ products = [], onSaveProduct, onToggleActive, onDeleteProduct }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [editingProduct, setEditingProduct] = useState(null);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (category !== 'All' && p.category !== category) return false;
      if (!q) return true;
      return (p.name + ' ' + p.category + ' ' + (p.description || '')).toLowerCase().includes(q);
    });
  }, [products, category, search]);

  const handleAddNew = () => {
    setEditingProduct({
      id: `product-${generateId()}`,
      name: '',
      category: 'Burgers',
      description: '',
      active: true,
      needsConfirmation: false,
      image: '',
      variants: [
        { id: `v-${generateId().slice(0, 8)}`, label: 'Regular', price: 0 }
      ]
    });
  };

  return (
    <div className="menu-admin-container">
      <div className="page-heading">
        <div>
          <h1>Menu & Price Management</h1>
          <p>{products.length} products · Changes apply immediately to new orders</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleAddNew}>
          <Plus size={17} />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="filter-toolbar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search products by name or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select-field"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="All">All Categories ({products.length})</option>
          {menuCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>IMAGE</th>
              <th>PRODUCT NAME</th>
              <th>CATEGORY</th>
              <th>PRICING & SIZES</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => {
              const imgSrc = getProductImage(p);
              const hasMultiple = p.variants.length > 1;
              const minPrice = Math.min(...p.variants.map(v => v.price));

              return (
                <tr key={p.id}>
                  <td className="table-col-img">
                    <img src={imgSrc} alt={p.name} className="menu-admin-thumb" />
                  </td>
                  <td>
                    <strong>{p.name}</strong>
                    {p.needsConfirmation && (
                      <span className="requires-review-pill">Needs review</span>
                    )}
                    {p.description && (
                      <small className="admin-desc-sub">{p.description}</small>
                    )}
                  </td>
                  <td>{p.category}</td>
                  <td>
                    <strong>
                      {hasMultiple ? `From ${rs(minPrice)}` : rs(p.variants[0]?.price || 0)}
                    </strong>
                    <small>
                      {hasMultiple ? `${p.variants.length} sizes/options` : (p.variants[0]?.label || 'Regular')}
                    </small>
                  </td>
                  <td>
                    <span className={`status-pill status-${p.active ? 'paid' : 'unpaid'}`}>
                      {p.active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td>
                    <div className="inline-action-btns">
                      <button
                        type="button"
                        className="btn-icon-subtle"
                        title="Edit product"
                        onClick={() => setEditingProduct(p)}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-subtle"
                        title={p.active ? 'Hide from POS' : 'Show on POS'}
                        onClick={() => onToggleActive(p)}
                      >
                        {p.active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        className="btn-icon-subtle"
                        style={{ color: '#f87171' }}
                        title="Delete product permanently"
                        onClick={() => {
                          if (window.confirm(`Delete "${p.name}" from menu permanently?`)) {
                            onDeleteProduct?.(p.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Product Editor Modal */}
      {editingProduct && (
        <ProductEditorModal
          product={editingProduct}
          isExisting={products.some(p => p.id === editingProduct.id)}
          onClose={() => setEditingProduct(null)}
          onDelete={(id) => {
            onDeleteProduct?.(id);
            setEditingProduct(null);
          }}
          onSave={async (saved) => {
            const ok = await onSaveProduct(saved);
            if (ok) setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

function ProductEditorModal({ product, isExisting, onClose, onDelete, onSave }) {
  const [draft, setDraft] = useState(structuredClone(product));
  const [imageProcessing, setImageProcessing] = useState(false);

  const editField = (field, val) => setDraft(prev => ({ ...prev, [field]: val }));

  const updateVariant = (index, field, val) => {
    setDraft(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, [field]: val } : v))
    }));
  };

  const addVariant = () => {
    setDraft(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        { id: `v-${generateId().slice(0, 8)}`, label: '', price: 0 }
      ]
    }));
  };

  const removeVariant = (index) => {
    if (draft.variants.length <= 1) return;
    setDraft(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  // Image Upload with client-side compression to avoid giant base64 in IndexedDB
  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP).');
      return;
    }

    setImageProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/webp', 0.82);
        editField('image', compressedDataUrl);
        setImageProcessing(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      alert('Please enter a product name.');
      return;
    }
    if (!draft.variants.length) {
      alert('Product must have at least one size/variant.');
      return;
    }
    for (const v of draft.variants) {
      if (!v.label.trim()) {
        alert('All variants must have a label (e.g. Regular, Small, Large).');
        return;
      }
      const priceVal = parseAmount(v.price);
      if (priceVal === null || priceVal <= 0) {
        alert(`Variant "${v.label}" must have a valid positive whole-rupee price.`);
        return;
      }
    }

    onSave({
      ...draft,
      name: draft.name.trim(),
      variants: draft.variants.map(v => ({ ...v, price: Number(v.price) }))
    });
  };

  const previewImage = draft.image || getProductImage(draft);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-product-editor" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h2>{product.name ? `Edit ${product.name}` : 'New Menu Product'}</h2>
            <p>Product edits preserve prices on historical orders</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-content stack gap-3">
          <div className="field">
            <label>Product Name</label>
            <input
              required
              value={draft.name}
              onChange={e => editField('name', e.target.value)}
              placeholder="e.g. Zinger Burger"
            />
          </div>

          <div className="field">
            <label>Category</label>
            <select
              value={draft.category}
              onChange={e => editField('category', e.target.value)}
            >
              {menuCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Description / Contents (Optional)</label>
            <textarea
              rows="2"
              value={draft.description}
              onChange={e => editField('description', e.target.value)}
              placeholder="e.g. Crispy chicken fillet, fresh lettuce, sauce"
            />
          </div>

          {/* Image Upload & Offline Storage Preview */}
          <div className="field">
            <label>Product Photograph (Saved offline)</label>
            <div className="image-upload-preview-box">
              <img src={previewImage} alt="Preview" className="img-editor-thumb" />
              <div className="upload-controls">
                <label className="btn btn-outline file-upload-label">
                  <Upload size={16} />
                  <span>{imageProcessing ? 'Compressing…' : 'Upload custom photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFile}
                    disabled={imageProcessing}
                  />
                </label>
                {draft.image && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => editField('image', '')}
                  >
                    Reset to category default
                  </button>
                )}
                <small className="upload-tip">
                  Auto-compressed locally for fast offline display.
                </small>
              </div>
            </div>
          </div>

          {/* Sizes and Prices */}
          <div className="variants-editor-section">
            <div className="form-label-row">
              <label>Sizes & Prices (PKR)</label>
              <button
                type="button"
                className="btn btn-ghost text-accent-btn"
                onClick={addVariant}
              >
                <Plus size={15} />
                <span>Add Size / Option</span>
              </button>
            </div>

            <div className="variants-list-editor">
              {draft.variants.map((v, i) => (
                <div key={v.id || i} className="variant-row-edit">
                  <input
                    type="text"
                    placeholder="Size name (e.g. Regular, Small, Large)"
                    value={v.label}
                    onChange={e => updateVariant(i, 'label', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Price (Rs.)"
                    value={v.price}
                    onChange={e => updateVariant(i, 'price', e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn-icon-danger"
                    disabled={draft.variants.length <= 1}
                    onClick={() => removeVariant(i)}
                    title="Remove size"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="checkbox-options-stack">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={e => editField('active', e.target.checked)}
              />
              <span>Available for ordering in POS</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={draft.needsConfirmation}
                onChange={e => editField('needsConfirmation', e.target.checked)}
              />
              <span>Flagged for owner price or portion review</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            {isExisting && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ borderColor: '#7c2d12', color: '#f87171' }}
                onClick={() => {
                  if (window.confirm(`Delete "${draft.name}" permanently from menu?`)) {
                    onDelete?.(draft.id);
                  }
                }}
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            )}
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Check size={18} />
              <span>Save Product Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
