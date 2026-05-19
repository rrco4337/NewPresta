import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCustomer } from '../contexts/CustomerContext';

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-slate-900 text-slate-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 text-[11px] uppercase tracking-[0.25em]">
          <span>Livraison offerte des 89€</span>
          <span className="hidden sm:inline">Retours sous 30 jours</span>
        </div>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto grid max-w-7xl items-center gap-4 px-6 py-4 lg:grid-cols-[auto,1fr,auto]">
          <Link to="/shop" className="flex items-center gap-3 text-slate-900 transition hover:text-slate-700">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <svg className="h-5 w-5" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 4h28v8H2z" />
                <path d="M4 12v12c0 2 1 4 3 4h18c2 0 3-2 3-4V12" />
                <line x1="12" y1="12" x2="12" y2="28" />
                <line x1="20" y1="12" x2="20" y2="28" />
              </svg>
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl tracking-tight">ShopPro</span>
              <span className="text-[11px] text-slate-500">Boutique moderne</span>
            </span>
          </Link>

          <div className="relative hidden w-full max-w-xl lg:block">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              placeholder="Rechercher un produit"
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-11 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
            />
          </div>

          <div className="flex items-center gap-2">
            {customer ? (
              <>
                <div className="hidden flex-col items-end gap-1 text-right sm:flex">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Bienvenue</span>
                  <span className="font-display text-sm">{customer.firstname}</span>
                </div>
                <Link
                  to="/shop/my-orders"
                  className="hidden rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 sm:inline-flex"
                >
                  Mes commandes
                </Link>
                <button
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  onClick={handleLogout}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link
                to="/shop/auth"
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Connexion
              </Link>
            )}

            <Link
              to="/shop/cart"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
              aria-label="Voir le panier"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="hidden border-t border-slate-200 lg:block">
          <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3 text-sm text-slate-600">
            <a href="#collection" className="transition hover:text-slate-900">Collection</a>
            <a href="#essentiels" className="transition hover:text-slate-900">Essentiels</a>
            <a href="#promos" className="transition hover:text-slate-900">Promos</a>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="border-b border-slate-200">
        <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">{children}</div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-100">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-3 lg:px-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">ShopPro</p>
            <h3 className="font-display text-lg">Votre boutique du quotidien</h3>
            <p className="text-sm leading-relaxed text-slate-300">
              Une sélection premium, des essentiels modernes et une expérience d'achat fluide sur tous vos appareils.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Support</p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><a className="transition hover:text-white" href="#contact">Contact</a></li>
              <li><a className="transition hover:text-white" href="#faq">FAQ</a></li>
              <li><a className="transition hover:text-white" href="#shipping">Livraison</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Légal</p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><a className="transition hover:text-white" href="#terms">CGU</a></li>
              <li><a className="transition hover:text-white" href="#privacy">Confidentialité</a></li>
              <li><a className="transition hover:text-white" href="#cookies">Cookies</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-xs text-slate-400 lg:px-8">
            <span>&copy; 2026 ShopPro. Tous droits réservés.</span>
            <span>Livraison internationale</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ShopLayout;
