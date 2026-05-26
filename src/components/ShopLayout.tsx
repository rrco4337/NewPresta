import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCustomer } from '../contexts/CustomerContext';

interface ShopLayoutProps { children: React.ReactNode; }

const ShopLayout: React.FC<ShopLayoutProps> = ({ children }) => {
  const { totalItems } = useCart();
  const { customer, logout } = useCustomer();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => { await logout(); };

  return (
    <div style={{ minHeight: '100vh', background: '#f2f5fa', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Barre d'annonce ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #4361ee 0%, #7c3aed 100%)',
        color: '#fff', textAlign: 'center',
        padding: '8px 16px', fontSize: '0.77rem',
        fontWeight: 500, letterSpacing: '0.02em',
      }}>
        <i className="fa-solid fa-truck-fast" style={{ marginRight: '8px' }}></i>
        Livraison offerte dès 89 € &nbsp;·&nbsp;
        <i className="fa-solid fa-rotate-left" style={{ marginRight: '6px' }}></i>
        Retours sous 30 jours &nbsp;·&nbsp;
        <i className="fa-solid fa-headset" style={{ marginRight: '6px' }}></i>
        Support 7j/7
      </div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #d0d7e1',
        boxShadow: '0 2px 12px rgba(15,22,40,0.06)',
      }}>
        <div style={{
          maxWidth: '1280px', margin: '0 auto',
          padding: '0 24px',
        }}>
          {/* Ligne principale */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: '20px',
            height: '68px',
          }}>
            {/* Logo */}
            <Link to="/shop" style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              textDecoration: 'none', flexShrink: 0,
            }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '1rem',
                boxShadow: '0 4px 12px rgba(67,97,238,0.3)',
              }}>
                <i className="fa-solid fa-bolt-lightning"></i>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '1.05rem', fontWeight: 800,
                  color: '#0f1620', letterSpacing: '-0.3px',
                }}>ITU Project</span>
                <span style={{ fontSize: '0.65rem', color: '#6b7a99', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Boutique
                </span>
              </div>
            </Link>

            {/* Search bar (desktop) */}
            <div style={{
              flex: 1, maxWidth: '500px', position: 'relative',
              display: 'none',
            }}
              className="shop-search-wrap"
            >
              <i className="fa-solid fa-magnifying-glass" style={{
                position: 'absolute', left: '14px', top: '50%',
                transform: 'translateY(-50%)', color: '#a3b0c8', fontSize: '0.85rem',
              }}></i>
              <input
                type="search" placeholder="Rechercher un produit…"
                style={{
                  width: '100%', padding: '10px 14px 10px 38px',
                  border: '1.5px solid #d0d7e1', borderRadius: '999px',
                  background: '#f1f4f9', fontSize: '0.85rem',
                  color: '#0f1620', outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(67,97,238,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {customer ? (
                <>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                    gap: '1px',
                  }}
                    className="shop-customer-info"
                  >
                    <span style={{ fontSize: '0.65rem', color: '#a3b0c8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Bienvenue</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f1620', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{customer.firstname}</span>
                  </div>
                  <Link to="/shop/my-orders" style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '999px',
                    border: '1.5px solid #d0d7e1', background: '#f1f4f9',
                    fontSize: '0.8rem', fontWeight: 600, color: '#4a5568',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                    className="shop-orders-btn"
                  >
                    <i className="fa-solid fa-receipt" style={{ fontSize: '0.8rem' }}></i>
                    Mes commandes
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', borderRadius: '999px',
                      border: 'none', background: '#f1f4f9',
                      fontSize: '0.8rem', fontWeight: 600, color: '#6b7a99',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket"></i>
                    <span className="shop-logout-text">Déconnexion</span>
                  </button>
                </>
              ) : (
                <Link to="/shop/auth" style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '9px 20px', borderRadius: '999px',
                  background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                  color: '#fff', fontSize: '0.82rem', fontWeight: 700,
                  textDecoration: 'none', letterSpacing: '0.01em',
                  boxShadow: '0 3px 12px rgba(67,97,238,0.3)',
                  transition: 'box-shadow 0.15s, transform 0.1s',
                }}>
                  <i className="fa-solid fa-right-to-bracket"></i>
                  Connexion
                </Link>
              )}

              {/* Cart */}
              <Link to="/shop/cart" style={{
                position: 'relative', width: '42px', height: '42px',
                borderRadius: '12px', border: '1.5px solid #d0d7e1',
                background: '#fff', color: '#4a5568',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none', fontSize: '1rem',
                transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                boxShadow: '0 1px 4px rgba(15,22,40,0.06)',
              }}
                aria-label="Panier"
              >
                <i className="fa-solid fa-cart-shopping"></i>
                {totalItems > 0 && (
                  <span style={{
                    position: 'absolute', top: '-6px', right: '-6px',
                    minWidth: '20px', height: '20px',
                    background: 'linear-gradient(135deg, #4361ee, #7c3aed)',
                    color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                    borderRadius: '999px', padding: '0 5px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #fff',
                    boxShadow: '0 2px 6px rgba(67,97,238,0.4)',
                  }}>
                    {totalItems}
                  </span>
                )}
              </Link>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  display: 'none', width: '42px', height: '42px',
                  borderRadius: '10px', border: '1.5px solid #d0d7e1',
                  background: '#f1f4f9', color: '#4a5568',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '0.95rem',
                }}
                className="shop-mobile-toggle"
                aria-label="Menu"
              >
                <i className={mobileMenuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
              </button>
            </div>
          </div>

          {/* Nav secondaire (desktop) */}
          <nav style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            borderTop: '1px solid #f1f4f9', padding: '0 0 10px',
          }}
            className="shop-nav-secondary"
          >
            {[
              { label: 'Collection', icon: 'fa-solid fa-star', href: '#collection' },
              { label: 'Essentiels',  icon: 'fa-solid fa-gem',  href: '#essentiels' },
              { label: 'Nouveautés', icon: 'fa-solid fa-fire-flame-curved', href: '#essentiels' },
              { label: 'Promos',     icon: 'fa-solid fa-tag',  href: '#promos' },
            ].map(nav => (
              <a key={nav.label} href={nav.href} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '999px',
                fontSize: '0.8rem', fontWeight: 600, color: '#6b7a99',
                textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ecedf5'; (e.currentTarget as HTMLElement).style.color = '#0f1620'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7a99'; }}
              >
                <i className={nav.icon} style={{ fontSize: '0.75rem', color: '#4361ee' }}></i>
                {nav.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div style={{
            borderTop: '1px solid #ecedf5',
            background: '#fff', padding: '16px 24px',
            display: 'flex', flexDirection: 'column', gap: '8px',
            animation: 'slide-up 0.18s ease',
          }}>
            {[
              { label: 'Collection', href: '#collection' },
              { label: 'Essentiels', href: '#essentiels' },
              { label: 'Nouveautés', href: '#essentiels' },
              { label: 'Promos', href: '#promos' },
            ].map(nav => (
              <a key={nav.label} href={nav.href}
                style={{
                  padding: '10px 14px', borderRadius: '10px',
                  fontSize: '0.875rem', fontWeight: 600, color: '#4a5568',
                  textDecoration: 'none', background: '#f1f4f9',
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {nav.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── Contenu principal ──────────────────────────────────────── */}
      <main>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          {children}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{
        marginTop: '80px',
        background: '#0f1620',
        color: '#fff',
      }}>
        {/* CTA band */}
        <div style={{
          background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
          padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <h3 style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800,
              color: '#fff', marginBottom: '12px', letterSpacing: '-0.3px',
            }}>
              Prêt à découvrir notre catalogue ?
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', marginBottom: '24px' }}>
              Des milliers de produits, sélectionnés avec soin pour vous.
            </p>
            <a href="#collection" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 28px', borderRadius: '999px',
              background: '#fff', color: '#4361ee',
              fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}>
              <i className="fa-solid fa-arrow-right"></i>
              Explorer le catalogue
            </a>
          </div>
        </div>

        {/* Links */}
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  background: 'linear-gradient(135deg, #4361ee, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '0.85rem',
                }}>
                  <i className="fa-solid fa-bolt-lightning"></i>
                </div>
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: '0.95rem' }}>ITU Project</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Votre boutique de référence pour des produits de qualité au meilleur prix.
              </p>
              {/* Social */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                {['fa-brands fa-instagram', 'fa-brands fa-x-twitter', 'fa-brands fa-facebook'].map(ic => (
                  <div key={ic} style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', cursor: 'pointer',
                  }}>
                    <i className={ic}></i>
                  </div>
                ))}
              </div>
            </div>

            {[
              { title: 'Boutique', links: ['Collection', 'Nouveautés', 'Promos', 'Essentiels'] },
              { title: 'Support',  links: ['Contact', 'FAQ', 'Livraison', 'Retours'] },
              { title: 'Légal',    links: ['CGU', 'Confidentialité', 'Cookies', 'Mentions légales'] },
            ].map(col => (
              <div key={col.title}>
                <p style={{
                  fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)',
                  marginBottom: '14px',
                }}>{col.title}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.links.map(l => (
                    <li key={l}>
                      <a href="#" style={{
                        fontSize: '0.83rem', color: 'rgba(255,255,255,0.55)',
                        textDecoration: 'none', transition: 'color 0.15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                      >{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{
            marginTop: '40px', paddingTop: '24px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '12px',
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)',
          }}>
            <span>© 2026 ITU Project. Tous droits réservés.</span>
            <div style={{ display: 'flex', gap: '16px' }}>
              {['fa-brands fa-cc-visa', 'fa-brands fa-cc-mastercard', 'fa-brands fa-cc-paypal'].map(ic => (
                <i key={ic} className={ic} style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.25)' }}></i>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 768px) {
          .shop-search-wrap { display: block !important; }
          .shop-customer-info { display: flex !important; }
          .shop-orders-btn { display: flex !important; }
          .shop-logout-text { display: inline !important; }
          .shop-nav-secondary { display: flex !important; }
        }
        @media (max-width: 767px) {
          .shop-search-wrap { display: none !important; }
          .shop-customer-info { display: none !important; }
          .shop-orders-btn { display: none !important; }
          .shop-logout-text { display: none; }
          .shop-nav-secondary { display: none !important; }
          .shop-mobile-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default ShopLayout;
