import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCustomer } from '../contexts/CustomerContext';
import { formatPrice } from '../services/shopService';
import './CartPage.css';

const CartPage: React.FC = () => {
  const { items, removeItem, updateQty, totalPrice, totalPriceHt, totalTax, totalItems } = useCart();
  const { customer } = useCustomer();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (!customer) {
      navigate('/shop/auth?next=/shop/checkout');
    } else {
      navigate('/shop/checkout');
    }
  };

  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
        </svg>
        <p>Votre panier est vide</p>
        <Link to="/shop" className="cart-btn-shop">Découvrir nos produits</Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <nav className="cart-breadcrumb">
        <Link to="/shop">Boutique</Link>
        <span>/</span>
        <span>Panier</span>
      </nav>

      <h1 className="cart-title">Panier <span className="cart-count">({totalItems} article{totalItems > 1 ? 's' : ''})</span></h1>

      <div className="cart-layout">
        {/* ── Liste des articles ── */}
        <div className="cart-items">
          {items.map(item => (
            <div key={item.id} className="cart-item">
              <div className="cart-item-img">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} onError={e => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                )}
              </div>

              <div className="cart-item-info">
                <Link to={`/shop/${item.id}`} className="cart-item-name">{item.name}</Link>
                <span className="cart-item-price">{formatPrice(item.priceTtc)}</span>
              </div>

              <div className="cart-item-qty">
                <button
                  className="cart-qty-btn"
                  onClick={() => item.qty > 1 ? updateQty(item.id, item.qty - 1) : removeItem(item.id)}
                >−</button>
                <span className="cart-qty-val">{item.qty}</span>
                <button
                  className="cart-qty-btn"
                  onClick={() => updateQty(item.id, item.qty + 1)}
                >+</button>
              </div>

              <div className="cart-item-subtotal">{formatPrice(item.priceTtc * item.qty)}</div>

              <button className="cart-item-remove" onClick={() => removeItem(item.id)} title="Retirer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* ── Récapitulatif ── */}
        <div className="cart-summary">
          <h2 className="cart-summary-title">Récapitulatif</h2>

          <div className="cart-summary-row">
            <span>Sous-total HT</span>
            <span>{formatPrice(totalPriceHt)}</span>
          </div>
          <div className="cart-summary-row">
            <span>TVA</span>
            <span>{formatPrice(totalTax)}</span>
          </div>
          <div className="cart-summary-row cart-summary-row--muted">
            <span>Livraison</span>
            <span>Calculé à l'étape suivante</span>
          </div>

          <div className="cart-summary-total">
            <span>Total TTC</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>

          <button className="cart-checkout-btn" onClick={handleCheckout}>
            Commander
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          <Link to="/shop" className="cart-continue-link">← Continuer mes achats</Link>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
