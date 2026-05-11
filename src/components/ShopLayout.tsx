import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCustomer } from '../contexts/CustomerContext';
import './ShopLayout.css';

interface ShopLayoutProps {
  children: React.ReactNode;
}

const ShopLayout: React.FC<ShopLayoutProps> = ({ children }) => {
  const { totalItems } = useCart();
  const { customer, logout } = useCustomer();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="shop-layout">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header className="shop-header">
        <div className="shop-header-content">
          {/* Logo */}
          <Link to="/shop" className="shop-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 4h28v8H2z" />
              <path d="M4 12v12c0 2 1 4 3 4h18c2 0 3-2 3-4V12" />
              <line x1="12" y1="12" x2="12" y2="28" />
              <line x1="20" y1="12" x2="20" y2="28" />
            </svg>
            <span className="shop-logo-text">ShopPro</span>
          </Link>

          {/* Navigation */}
          <nav className="shop-nav">
            <Link to="/shop" className="shop-nav-link">
              Catalogue
            </Link>
          </nav>

          {/* Actions */}
          <div className="shop-actions">
            {customer ? (
              <div className="shop-user-menu">
                <span className="shop-user-name">{customer.firstname}</span>
                <Link to="/shop/my-orders" className="shop-nav-link">
                  Mes commandes
                </Link>
                <button className="btn btn-ghost" onClick={handleLogout}>
                  Déconnexion
                </button>
              </div>
            ) : (
              <Link to="/shop/auth" className="btn btn-primary">
                Connexion
              </Link>
            )}

            <Link to="/shop/cart" className="shop-cart-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {totalItems > 0 && <span className="shop-cart-badge">{totalItems}</span>}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="shop-main">
        <div className="shop-container">{children}</div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="shop-footer">
        <div className="shop-footer-content">
          <div className="shop-footer-col">
            <h3>À propos</h3>
            <p>Votre boutique e-commerce moderne et performante</p>
          </div>
          <div className="shop-footer-col">
            <h3>Support</h3>
            <ul>
              <li><a href="#contact">Contact</a></li>
              <li><a href="#faq">FAQ</a></li>
              <li><a href="#shipping">Livraison</a></li>
            </ul>
          </div>
          <div className="shop-footer-col">
            <h3>Légal</h3>
            <ul>
              <li><a href="#terms">CGU</a></li>
              <li><a href="#privacy">Confidentialité</a></li>
              <li><a href="#cookies">Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="shop-footer-bottom">
          <p>&copy; 2026 ShopPro. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
};

export default ShopLayout;
