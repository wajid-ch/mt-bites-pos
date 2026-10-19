import React from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { rs } from '../money.js';
import { getProductImage } from '../menu.js';

export default function VariantModal({ product, onClose, onSelectVariant }) {
  if (!product) return null;

  const imgSrc = getProductImage(product);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-variant" role="dialog" aria-modal="true" aria-label={`Select size for ${product.name}`}>
        <div className="modal-header">
          <div className="variant-header-info">
            <h2>{product.name}</h2>
            <p>{product.category} · Select size or serving</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="variant-product-preview">
            <img src={imgSrc} alt={product.name} className="variant-preview-thumb" />
            <div>
              <strong>{product.name}</strong>
              <p>{product.description || `Freshly prepared ${product.category.toLowerCase()}`}</p>
            </div>
          </div>

          <div className="variant-choices-list">
            {product.variants.map(v => (
              <button
                key={v.id}
                type="button"
                className="variant-choice-btn"
                onClick={() => onSelectVariant(product, v)}
              >
                <div className="variant-choice-info">
                  <span className="variant-choice-label">{v.label}</span>
                  <span className="variant-choice-category">{product.name}</span>
                </div>
                <div className="variant-choice-action">
                  <span className="variant-choice-price">{rs(v.price)}</span>
                  <span className="variant-add-badge">
                    <Plus size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
