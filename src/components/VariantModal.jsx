import React, { useState, useEffect } from 'react';
import { X, Plus, CupSoda } from 'lucide-react';
import { rs } from '../money.js';
import { getProductImage } from '../menu.js';
import { itemIncludesColdDrink } from './PosCatalog.jsx';

export default function VariantModal({
  product,
  drinkInventory = [],
  onClose,
  onSelectVariant
}) {
  const [selectedBottleId, setSelectedBottleId] = useState('');

  useEffect(() => {
    setSelectedBottleId('');
  }, [product?.id]);

  if (!product) return null;

  const imgSrc = getProductImage(product);
  const showBottlePicker = drinkInventory.length > 0 && itemIncludesColdDrink(product);
  const chosenBottle = drinkInventory.find(b => b.id === selectedBottleId) || null;

  const handleChoose = (variant) => {
    const linkedBeverage = chosenBottle
      ? {
          inventoryId: chosenBottle.id,
          name: chosenBottle.name,
          unit: chosenBottle.unit || 'bottles',
          quantityPerItem: 1
        }
      : null;
    onSelectVariant(product, variant, linkedBeverage);
  };

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

          {showBottlePicker && (
            <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#1f1b16', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: 800, color: 'var(--accent-light)' }}>
                <CupSoda size={15} />
                <span>Select Cold Drink Bottle from Stock (Auto-Deducts on Order):</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  className={`chip ${selectedBottleId === '' ? 'chip-selected' : ''}`}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  onClick={() => setSelectedBottleId('')}
                >
                  No bottle / Skip
                </button>
                {drinkInventory.map(drink => {
                  const isOut = Number(drink.quantity || 0) <= 0;
                  return (
                    <button
                      key={drink.id}
                      type="button"
                      className={`chip ${selectedBottleId === drink.id ? 'chip-selected' : ''}`}
                      style={{
                        fontSize: '12px',
                        padding: '6px 10px',
                        borderColor: isOut ? '#7f1d1d' : undefined,
                        opacity: isOut ? 0.65 : 1
                      }}
                      onClick={() => setSelectedBottleId(drink.id)}
                    >
                      <span>{drink.name}</span>
                      <span className="chip-counter" style={{ color: isOut ? '#fca5a5' : undefined }}>
                        {isOut ? '0 left' : `${drink.quantity}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="variant-choices-list">
            {product.variants.map(v => (
              <button
                key={v.id}
                type="button"
                className="variant-choice-btn"
                onClick={() => handleChoose(v)}
              >
                <div className="variant-choice-info">
                  <span className="variant-choice-label">{v.label}</span>
                  <span className="variant-choice-category">
                    {product.name}{chosenBottle ? ` · 🥤 ${chosenBottle.name}` : ''}
                  </span>
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
