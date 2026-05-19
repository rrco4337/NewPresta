import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AppLayout.css';

// ── Types ────────────────────────────────────────────────────────
interface NavSubItem {
  label: string;
  path: string;
  end?: boolean;
}

interface NavModule {
  label: string;
  path: string;
  icon: string;   // Bootstrap Icon class
  end?: boolean;
  disabled?: boolean;
  section?: string;
  children?: NavSubItem[];
}

// ── Navigation config ─────────────────────────────────────────────
const navModules: NavModule[] = [
  { label: 'Tableau de bord',   path: '/dashboard', icon: 'bi-grid-fill',     end: true, section: 'Principal' },
  { label: 'Analyse financière',path: '/analytics', icon: 'bi-bar-chart-fill', section: 'Ventes' },
  { label: 'Commandes',         path: '/orders',    icon: 'bi-bag-fill',       section: 'Ventes' },
  { label: 'Clients',           path: '/clients',   icon: 'bi-people-fill',    disabled: true, section: 'Ventes' },
  {
    label: 'Produits',
    path: '/products',
    icon: 'bi-box-fill',
    end: true,
    section: 'Catalogue',
    children: [
      { label: 'Liste des produits', path: '/products',       end: true },
      { label: 'Ajouter un produit', path: '/products/add' },
      { label: 'Import CSV',         path: '/products/import' },
    ],
  },
  {
    label: 'Import',
    path: '/import',
    icon: 'bi-cloud-upload-fill',
    section: 'Catalogue',
    children: [
      { label: 'Import produits',  path: '/products/import' },
      { label: 'Import catalogue', path: '/import' },
      { label: 'Import fichiers',  path: '/import/fichiers' },
    ],
  },
  {
    label: 'Stock',
    path: '/stock',
    icon: 'bi-layers-fill',
    section: 'Catalogue',
    children: [
      { label: 'Vue générale', path: '/stock',           end: true },
      { label: 'Catégories',   path: '/stock/category' },
      { label: 'Évolution',    path: '/stock/evolution' },
    ],
  },
  { label: 'Audit import',  path: '/audit/import', icon: 'bi-clipboard2-check-fill', section: 'Outils' },
  { label: 'Boutique',      path: '/shop',         icon: 'bi-shop',                  section: 'Aperçu' },
  { label: 'Modules',       path: '/modules',      icon: 'bi-puzzle-fill',            disabled: true, section: 'Configuration' },
  { label: 'Statistiques',  path: '/stats',        icon: 'bi-graph-up-arrow',         disabled: true, section: 'Configuration' },
  { label: 'Paramètres',    path: '/settings',     icon: 'bi-gear-fill',              disabled: true, section: 'Configuration' },
  { label: 'Réinitialisation', path: '/reset',     icon: 'bi-trash3-fill',            section: 'Danger' },
];

// ── Helpers ───────────────────────────────────────────────────────
function isModuleActive(mod: NavModule, pathname: string): boolean {
  if (mod.children) {
    return mod.children.some((child) =>
      child.end ? pathname === child.path : pathname.startsWith(child.path)
    );
  }
  return mod.end ? pathname === mod.path : pathname.startsWith(mod.path);
}

// ── ChevronIcon ───────────────────────────────────────────────────
const ChevronIcon = ({ open }: { open: boolean }) => (
  <i
    className="bi bi-chevron-right"
    style={{
      fontSize: '0.7rem',
      transition: 'transform 0.2s ease',
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      flexShrink: 0,
      opacity: 0.5,
    }}
  />
);

// ── Main component ────────────────────────────────────────────────
interface AppLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, pageTitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [time, setTime] = useState(new Date());

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
        setOpenGroups((prev) => new Set([...prev, mod.label]));
      }
    }
  }, [pathname]);

  // Live clock — the "bit of JS"
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sections = navModules.reduce<Record<string, NavModule[]>>((acc, mod) => {
    const s = mod.section ?? 'Autre';
    if (!acc[s]) acc[s] = [];
    acc[s].push(mod);
    return acc;
  }, {});

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  const clockStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr  = time.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className={`layout${collapsed ? ' layout--collapsed' : ''}`}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════ */}
      <aside className="sidebar">

        {/* Brand */}
        <div className="sidebar-brand">
          <span className="sidebar-logo">ETU</span>
          {!collapsed && (
            <div>
              <span className="sidebar-brand-name">ETU3209</span>
              <span className="sidebar-brand-sub">Gestion commerciale</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="nav-section">
              {!collapsed && <span className="nav-section-label">{section}</span>}

              {items.map((mod) => {
                if (mod.disabled) {
                  return (
                    <span key={mod.label} className="nav-item nav-item--disabled" title={mod.label}>
                      <span className="nav-item-icon"><i className={`bi ${mod.icon}`} /></span>
                      {!collapsed && <span className="nav-item-label">{mod.label}</span>}
                      {!collapsed && <span className="nav-badge-soon">Bientôt</span>}
                    </span>
                  );
                }

                const active = isModuleActive(mod, pathname);

                if (mod.children) {
                  const isOpen = openGroups.has(mod.label);
                  return (
                    <div key={mod.label} className="nav-group">
                      <button
                        className={`nav-item nav-item--parent${active ? ' nav-item--active' : ''}`}
                        onClick={() => toggleGroup(mod.label)}
                        title={mod.label}
                      >
                        <span className="nav-item-icon"><i className={`bi ${mod.icon}`} /></span>
                        {!collapsed && <span className="nav-item-label">{mod.label}</span>}
                        {!collapsed && <ChevronIcon open={isOpen} />}
                      </button>

                      {isOpen && !collapsed && (
                        <div className="nav-submenu">
                          {mod.children.map((child) => (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              end={child.end}
                              className={({ isActive }) =>
                                `nav-subitem${isActive ? ' nav-subitem--active' : ''}`
                              }
                            >
                              <span className="nav-subitem-dot" />
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
                    className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
                  >
                    <span className="nav-item-icon"><i className={`bi ${mod.icon}`} /></span>
                    {!collapsed && <span className="nav-item-label">{mod.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{userInitial}</div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-email" title={user?.email}>{user?.email}</span>
                <span className="sidebar-user-role">Administrateur</span>
              </div>
            )}
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Déconnexion">
            <i className="bi bi-box-arrow-right" style={{ fontSize: '0.95rem' }} />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ══ MAIN ════════════════════════════════════════════════ */}
      <div className="layout-body">

        {/* Topbar */}
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Menu">
            <i className={`bi ${collapsed ? 'bi-layout-sidebar' : 'bi-layout-sidebar-inset'}`} />
          </button>

          {pageTitle && <h1 className="topbar-title">{pageTitle}</h1>}

          <div className="topbar-right">
            {/* Live status */}
            <div className="topbar-status">
              <span className="topbar-status-dot" />
              Boutique en ligne
            </div>

            {/* Clock */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              lineHeight: 1.1,
              padding: '0 4px',
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-h)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {clockStr}
              </span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {dateStr}
              </span>
            </div>

            <div className="topbar-divider" />

            {/* Search */}
            <button className="topbar-icon-btn" title="Recherche">
              <i className="bi bi-search" />
            </button>

            {/* Notifications */}
            <button className="topbar-icon-btn" title="Notifications">
              <i className="bi bi-bell" />
              <span className="topbar-notif-dot" />
            </button>

            <div className="topbar-divider" />

            {/* Avatar */}
            <div className="topbar-avatar" title={user?.email}>{userInitial}</div>
          </div>
        </header>

        {/* Content */}
        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
