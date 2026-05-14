import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AppLayout.css';

// ── Icônes SVG inline ───────────────────────────────────────────────────────
const IconGrid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconBox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconCart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
  </svg>
);
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IconPuzzle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const IconShop = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);
const IconTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
  >
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ── Types ───────────────────────────────────────────────────────────────────
interface NavSubItem {
  label: string;
  path: string;
  end?: boolean;
}

interface NavModule {
  label: string;
  path: string;
  icon: React.ReactNode;
  end?: boolean;
  disabled?: boolean;
  section?: string;
  children?: NavSubItem[];
}

// ── Navigation ───────────────────────────────────────────────────────────────
const navModules: NavModule[] = [
  { label: 'Tableau de bord', path: '/dashboard', icon: <IconGrid />, end: true, section: 'Principal' },
  {
    label: 'Produits',
    path: '/products',
    icon: <IconBox />,
    end: true,
    section: 'Catalogue',
    children: [
      { label: 'Liste des produits', path: '/products',          end: true },
      { label: 'Ajouter un produit', path: '/products/add' },
      { label: 'Import CSV',         path: '/products/import' },
    ],
  },
  {
    label: 'Import CSV',
    path: '/import',
    icon: <IconChart />,
    section: 'Catalogue',
    children: [
      { label: 'Import produits',   path: '/products/import' },
      { label: 'Import catalogue',  path: '/import' },
      { label: 'Import fichiers',   path: '/import/fichiers' },
    ],
  },
  { label: 'Commandes', path: '/orders', icon: <IconCart />, section: 'Ventes' },
  { label: 'Clients',   path: '/clients', icon: <IconUsers />, disabled: true, section: 'Ventes' },
  { label: 'Audit import', path: '/audit/import', icon: <IconChart />, section: 'Outils' },
  { label: 'Modules',      path: '/modules',  icon: <IconPuzzle />,  disabled: true, section: 'Configuration' },
  { label: 'Statistiques', path: '/stats',    icon: <IconChart />,   disabled: true, section: 'Configuration' },
  { label: 'Paramètres',   path: '/settings', icon: <IconSettings />,disabled: true, section: 'Configuration' },
  { label: 'Boutique',         path: '/shop',  icon: <IconShop />,  section: 'Aperçu' },
  { label: 'Réinitialisation', path: '/reset', icon: <IconTrash />, section: 'Danger' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isModuleActive(mod: NavModule, pathname: string): boolean {
  if (mod.children) {
    return mod.children.some((child) =>
      child.end ? pathname === child.path : pathname.startsWith(child.path)
    );
  }
  return mod.end ? pathname === mod.path : pathname.startsWith(mod.path);
}

// ── Composant principal ──────────────────────────────────────────────────────
interface AppLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, pageTitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Groupes ouverts — initialisés avec les groupes actifs selon la route courante
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const mod of navModules) {
      if (mod.children && isModuleActive(mod, pathname)) open.add(mod.label);
    }
    return open;
  });

  // Auto-ouvre le groupe parent lors d'une navigation vers un sous-item
  useEffect(() => {
    for (const mod of navModules) {
      if (mod.children && isModuleActive(mod, pathname)) {
        setOpenGroups((prev) => new Set([...prev, mod.label]));
      }
    }
  }, [pathname]);

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

  return (
    <div className={`layout${collapsed ? ' layout--collapsed' : ''}`}>
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">PS</span>
          {!collapsed && <span className="sidebar-brand-name">PrestaShop</span>}
        </div>

        <nav className="sidebar-nav">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="nav-section">
              {!collapsed && <span className="nav-section-label">{section}</span>}

              {items.map((mod) => {
                if (mod.disabled) {
                  return (
                    <span key={mod.label} className="nav-item nav-item--disabled" title={mod.label}>
                      <span className="nav-item-icon">{mod.icon}</span>
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
                      {/* Parent — bouton toggle (rétractable) */}
                      <button
                        className={`nav-item nav-item--parent${active ? ' nav-item--active' : ''}`}
                        onClick={() => toggleGroup(mod.label)}
                        title={mod.label}
                      >
                        <span className="nav-item-icon">{mod.icon}</span>
                        {!collapsed && <span className="nav-item-label">{mod.label}</span>}
                        {!collapsed && <IconChevron open={isOpen} />}
                      </button>

                      {/* Sous-menu — visible quand groupe ouvert et sidebar non réduite */}
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
                    <span className="nav-item-icon">{mod.icon}</span>
                    {!collapsed && <span className="nav-item-label">{mod.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

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
            <IconLogout />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ── */}
      <div className="layout-body">
        <header className="topbar">
          <button className="topbar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Menu">
            <IconMenu />
          </button>
          {pageTitle && <h1 className="topbar-title">{pageTitle}</h1>}
          <div className="topbar-right">
            <div className="topbar-avatar" title={user?.email}>{userInitial}</div>
          </div>
        </header>

        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
