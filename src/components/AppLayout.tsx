import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AppLayout.css';

// ── Types ────────────────────────────────────────────────────────────────────
interface NavSubItem { label: string; path: string; end?: boolean; }
interface NavModule {
  label: string; path: string; icon: string; end?: boolean;
  disabled?: boolean; section?: string; children?: NavSubItem[];
}

// ── Navigation config ────────────────────────────────────────────────────────
const navModules: NavModule[] = [
  { label: 'Tableau de bord',   path: '/dashboard', icon: 'fa-solid fa-chart-pie',       end: true, section: 'Principal' },
  { label: 'Analyse financière',path: '/analytics',  icon: 'fa-solid fa-chart-line',                section: 'Ventes' },
  { label: 'Commandes',         path: '/orders',     icon: 'fa-solid fa-bag-shopping',              section: 'Ventes' },
  { label: 'Clients',           path: '/clients',    icon: 'fa-solid fa-users',          disabled: true, section: 'Ventes' },
  {
    label: 'Produits', path: '/products', icon: 'fa-solid fa-box', end: true, section: 'Catalogue',
    children: [
      { label: 'Liste des produits', path: '/products',         end: true },
      { label: 'Ajouter un produit', path: '/products/add' },
      { label: 'Import CSV',         path: '/products/import' },
    ],
  },
  {
    label: 'Stock', path: '/stock', icon: 'fa-solid fa-layer-group', section: 'Catalogue',
    children: [
      { label: 'Vue générale', path: '/stock',           end: true },
      { label: 'Catégories',   path: '/stock/category' },
      { label: 'Évolution',    path: '/stock/evolution' },
    ],
  },
  {
    label: 'Import CSV', path: '/import', icon: 'fa-solid fa-file-import', section: 'Catalogue',
    children: [
      { label: 'Import produits',  path: '/products/import' },
      { label: 'Import catalogue', path: '/import' },
      { label: 'Import fichiers',  path: '/import/fichiers' },
    ],
  },
  { label: 'Audit import',  path: '/audit/import', icon: 'fa-solid fa-clipboard-check',             section: 'Outils' },
  { label: 'Boutique',      path: '/shop',          icon: 'fa-solid fa-store',                       section: 'Aperçu' },
  { label: 'Modules',       path: '/modules',       icon: 'fa-solid fa-puzzle-piece', disabled: true, section: 'Configuration' },
  { label: 'Statistiques',  path: '/stats',         icon: 'fa-solid fa-chart-bar',    disabled: true, section: 'Configuration' },
  { label: 'Paramètres',    path: '/settings',      icon: 'fa-solid fa-gear',         disabled: true, section: 'Configuration' },
  { label: 'Réinitialisation', path: '/reset',      icon: 'fa-solid fa-rotate-left',                 section: 'Danger' },
];

function isModuleActive(mod: NavModule, pathname: string): boolean {
  if (mod.children) return mod.children.some(c => c.end ? pathname === c.path : pathname.startsWith(c.path));
  return mod.end ? pathname === mod.path : pathname.startsWith(mod.path);
}

// ── Composant principal ───────────────────────────────────────────────────────
interface AppLayoutProps { children: React.ReactNode; pageTitle?: string; }

const AppLayout: React.FC<AppLayoutProps> = ({ children, pageTitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const mod of navModules) {
      if (mod.children && isModuleActive(mod, pathname)) open.add(mod.label);
    }
    return open;
  });

  useEffect(() => {
    for (const mod of navModules) {
      if (mod.children && isModuleActive(mod, pathname)) {
        setOpenGroups(prev => new Set([...prev, mod.label]));
      }
    }
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const sections = navModules.reduce<Record<string, NavModule[]>>((acc, mod) => {
    const s = mod.section ?? 'Autre';
    if (!acc[s]) acc[s] = [];
    acc[s].push(mod);
    return acc;
  }, {});

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';
  const userEmail = user?.email ?? '';

  return (
    <div className={`itu-layout${collapsed ? ' itu-layout--collapsed' : ''}`}>

      {/* ══════ SIDEBAR ══════ */}
      <aside className="itu-sidebar">

        {/* Brand */}
        <div className="itu-sidebar-brand">
          <div className="itu-brand-logo">
            <i className="fa-solid fa-bolt-lightning"></i>
          </div>
          {!collapsed && (
            <div className="itu-brand-text">
              <span className="itu-brand-name">ITU Project</span>
              <span className="itu-brand-tag">Gestion Ventes</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="itu-sidebar-nav">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="itu-nav-section">
              {!collapsed && <span className="itu-nav-section-label">{section}</span>}

              {items.map((mod) => {
                if (mod.disabled) {
                  return (
                    <span key={mod.label} className="itu-nav-item itu-nav-item--disabled" title={mod.label}>
                      <i className={`${mod.icon} itu-nav-icon`}></i>
                      {!collapsed && <span className="itu-nav-label">{mod.label}</span>}
                      {!collapsed && <span className="itu-nav-soon">Bientôt</span>}
                    </span>
                  );
                }

                const active = isModuleActive(mod, pathname);

                if (mod.children) {
                  const isOpen = openGroups.has(mod.label);
                  return (
                    <div key={mod.label} className="itu-nav-group">
                      <button
                        className={`itu-nav-item itu-nav-item--parent${active ? ' itu-nav-item--active' : ''}`}
                        onClick={() => toggleGroup(mod.label)}
                        title={mod.label}
                      >
                        <i className={`${mod.icon} itu-nav-icon`}></i>
                        {!collapsed && <span className="itu-nav-label">{mod.label}</span>}
                        {!collapsed && (
                          <i className={`fa-solid fa-chevron-right itu-chevron${isOpen ? ' itu-chevron--open' : ''}`}></i>
                        )}
                      </button>
                      {isOpen && !collapsed && (
                        <div className="itu-nav-submenu">
                          {mod.children.map(child => (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              end={child.end}
                              className={({ isActive }) =>
                                `itu-nav-subitem${isActive ? ' itu-nav-subitem--active' : ''}`
                              }
                            >
                              <span className="itu-subitem-dot"></span>
                              {child.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={mod.label}
                    to={mod.path}
                    end={mod.end}
                    title={mod.label}
                    className={({ isActive }) =>
                      `itu-nav-item${isActive ? ' itu-nav-item--active' : ''}${mod.section === 'Danger' ? ' itu-nav-item--danger' : ''}`
                    }
                  >
                    <i className={`${mod.icon} itu-nav-icon`}></i>
                    {!collapsed && <span className="itu-nav-label">{mod.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer user */}
        <div className="itu-sidebar-footer">
          <div className="itu-sidebar-user">
            <div className="itu-user-avatar">{userInitial}</div>
            {!collapsed && (
              <div className="itu-user-info">
                <span className="itu-user-email" title={userEmail}>{userEmail}</span>
                <span className="itu-user-role">
                  <span className="itu-role-dot"></span>
                  Administrateur
                </span>
              </div>
            )}
          </div>
          <button className="itu-logout-btn" onClick={handleLogout} title="Déconnexion">
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ══════ MAIN CONTENT ══════ */}
      <div className="itu-layout-body">

        {/* Topbar */}
        <header className="itu-topbar">
          <div className="itu-topbar-left">
            <button
              className="itu-topbar-toggle"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Toggle menu"
            >
              <i className={`fa-solid ${collapsed ? 'fa-bars' : 'fa-bars'}`}></i>
            </button>
            {pageTitle && (
              <div className="itu-topbar-title-wrap">
                <h1 className="itu-topbar-title">{pageTitle}</h1>
              </div>
            )}
          </div>

          <div className="itu-topbar-right">
            {/* Notification bell */}
            <button className="itu-topbar-icon-btn" title="Notifications">
              <i className="fa-regular fa-bell"></i>
              <span className="itu-notif-dot"></span>
            </button>

            {/* Search */}
            <button className="itu-topbar-icon-btn" title="Recherche">
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>

            {/* Avatar */}
            <div className="itu-topbar-avatar" title={userEmail}>
              {userInitial}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="itu-layout-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
