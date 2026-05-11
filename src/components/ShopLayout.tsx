import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCustomer } from '../contexts/CustomerContext';
import { formatPrice } from '../services/shopService';
import './ShopLayout.css';

// ── Mini panier ───────────────────────────────────────────────────────────────

const MiniCart: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { items, removeItem, updateQty, totalPrice, totalItems } = useCart();

  if (totalItems === 0) {
    return (
      <div className="minicart">
        <div className="minicart-header">
          <span>Panier</span>
          <button className="minicart-close" onClick={onClose}>✕</button>
        </div>
        <p className="minicart-empty">Votre panier est vide.</p>
      </div>
    );
  }

  return (
    <div className="minicart">
      <div className="minicart-header">
        <span>Panier ({totalItems})</span>
        <button className="minicart-close" onClick={onClose}>✕</button>
      </div>
      <ul className="minicart-list">
        {items.map(item => (
          <li key={item.id} className="minicart-item">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} className="minicart-img" />
            )}
            <div className="minicart-info">
              <span className="minicart-name">{item.name}</span>
              <span className="minicart-price">{formatPrice(item.price)}</span>
              <div className="minicart-qty">
                <button onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                <span>{item.qty}</span>
                <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
              </div>
            </div>
            <button className="minicart-remove" onClick={() => removeItem(item.id)} title="Supprimer">✕</button>
          </li>
        ))}
      </ul>
      <div className="minicart-footer">
        <div className="minicart-total">
          <span>Total</span>
          <span className="minicart-total-price">{formatPrice(totalPrice)}</span>
        </div>
        <Link to="/shop/cart" className="minicart-checkout-btn" onClick={onClose}>
          Voir le panier
        </Link>
      </div>
    </div>
  );
};

// ── Layout ────────────────────────────────────────────────────────────────────

interface ShopLayoutProps {
  children: React.ReactNode;
}

const ShopLayout: React.FC<ShopLayoutProps> = ({ children }) => {
  const { totalItems } = useCart();
  const { customer, logout } = useCustomer();
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/shop');
  };

  return (
    <div className="shop-layout">
      {/* ── NAVBAR ── */}
      <header className="shop-navbar">
        <div className="shop-navbar-inner">
          <Link to="/shop" className="shop-brand">
            <span className="shop-brand-logo">PS</span>
            <span className="shop-brand-name">Boutique</span>
          </Link>

          <nav className="shop-nav">
            <Link to="/shop" className="shop-nav-link">Produits</Link>
            {customer && (
              <Link to="/shop/my-orders" className="shop-nav-link">Mes commandes</Link>
            )}
          </nav>

          <div className="shop-navbar-right">
            {customer ? (
              <div className="shop-customer-menu">
                <span className="shop-customer-name">{customer.firstname}</span>
                <button className="shop-logout-btn" onClick={handleLogout} title="Déconnexion">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <Link to="/shop/auth" className="shop-login-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Connexion
              </Link>
            )}

            <button className="shop-cart-btn" onClick={() => setCartOpen(o => !o)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
              </svg>
              {totalItems > 0 && (
                <span className="shop-cart-badge">{totalItems}</span>
              )}
            </button>

            <button className="shop-admin-link" onClick={() => navigate('/')} title="Accès admin">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── MINI CART OVERLAY ── */}
      {cartOpen && (
        <>
          <div className="minicart-overlay" onClick={() => setCartOpen(false)} />
          <MiniCart onClose={() => setCartOpen(false)} />
        </>
      )}

      {/* ── CONTENU ── */}
      <main className="shop-main">
        {children}
      </main>

      {/* ── FOOTER ── */}
      <footer className="shop-footer">
        <p>© {new Date().getFullYear()} PrestaShop Boutique</p>
      </footer>
    </div>
  );
};

export default ShopLayout;
