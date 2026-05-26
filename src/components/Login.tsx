import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthError } from '../services/authService';

const Login: React.FC = () => {
  const DEFAULT_EMAIL = import.meta.env.VITE_DEFAULT_EMAIL ?? 'cindyophelia2301@gmail.com';
  const DEFAULT_PWD   = import.meta.env.VITE_DEFAULT_PWD   ?? 'soobin0512';

  const [email, setEmail]       = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PWD);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: Location })?.from?.pathname || '/products';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: '#f2f5fa',
    }}
      className="login-root"
    >

      {/* ── Panneau gauche : branding ── */}
      <div style={{
        background: 'linear-gradient(145deg, #4361ee 0%, #7c3aed 60%, #312e81 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}
        className="login-brand-panel"
      >
        {/* Orbs décoratifs */}
        <div style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: '-60px', right: '-60px',
            width: '340px', height: '340px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }} />
          <div style={{
            position: 'absolute', bottom: '60px', left: '-80px',
            width: '280px', height: '280px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '50%',
            width: '180px', height: '180px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }} />
        </div>

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
            borderRadius: '14px', padding: '10px 18px',
            border: '1px solid rgba(255,255,255,0.18)',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '0.9rem',
            }}>
              <i className="fa-solid fa-bolt-lightning"></i>
            </div>
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 700, fontSize: '1rem', color: '#fff', letterSpacing: '-0.2px',
            }}>ITU Project</span>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ position: 'relative', zIndex: 1, color: '#fff' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.15)', borderRadius: '999px',
            padding: '5px 14px', marginBottom: '24px',
            fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a3e635' }}></span>
            Plateforme de gestion ventes
          </div>

          <h1 style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
            fontWeight: 800, lineHeight: 1.15,
            marginBottom: '16px', color: '#fff',
            letterSpacing: '-0.5px',
          }}>
            Pilotez vos ventes<br />avec précision
          </h1>
          <p style={{
            fontSize: '0.92rem', lineHeight: 1.65,
            color: 'rgba(255,255,255,0.72)', maxWidth: '380px',
          }}>
            Dashboard temps réel, gestion produits, stock et commandes — tout ce qu'il vous faut pour performer.
          </p>

          {/* Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px', marginTop: '36px',
          }}>
            {[
              { icon: 'fa-solid fa-box', label: 'Produits', val: '5K+' },
              { icon: 'fa-solid fa-bag-shopping', label: 'Commandes', val: '∞' },
              { icon: 'fa-solid fa-chart-line', label: 'Analytics', val: 'Live' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px', padding: '14px 16px',
                backdropFilter: 'blur(8px)',
              }}>
                <i className={s.icon} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}></i>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.val}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div style={{
          position: 'relative', zIndex: 1,
          borderTop: '1px solid rgba(255,255,255,0.15)',
          paddingTop: '20px',
          fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
        }}>
          © 2026 ITU Project · Tous droits réservés
        </div>
      </div>

      {/* ── Panneau droit : formulaire ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px',
        background: '#fff',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Header */}
          <div style={{ marginBottom: '36px' }}>
            <h2 style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '1.6rem', fontWeight: 800,
              color: '#0f1620', marginBottom: '8px',
              letterSpacing: '-0.4px',
            }}>
              Bon retour 👋
            </h2>
            <p style={{ fontSize: '0.87rem', color: '#6b7a99', lineHeight: 1.5 }}>
              Connectez-vous à votre espace de gestion ITU Project.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#fff5f5', border: '1px solid #fecaca',
              borderLeft: '3px solid #dc2626', borderRadius: '10px',
              padding: '12px 16px', marginBottom: '20px',
              color: '#dc2626', fontSize: '0.84rem',
              animation: 'slide-up 0.2s ease',
            }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ flexShrink: 0 }}></i>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.8rem', fontWeight: 600,
                color: '#1e2240', marginBottom: '6px',
              }}>
                Adresse e-mail
              </label>
              <div style={{ position: 'relative' }}>
                <i className="fa-regular fa-envelope" style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a3b0c8', fontSize: '0.85rem',
                }}></i>
                <input
                  id="email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  required placeholder="vous@exemple.com"
                  autoComplete="email" autoFocus disabled={loading}
                  style={{
                    width: '100%', padding: '11px 14px 11px 38px',
                    border: '1.5px solid #d0d7e1', borderRadius: '10px',
                    fontSize: '0.875rem', color: '#0f1620',
                    background: '#f2f5fa', outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(67,97,238,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f2f5fa'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.8rem', fontWeight: 600,
                color: '#1e2240', marginBottom: '6px',
              }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-lock" style={{
                  position: 'absolute', left: '14px', top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a3b0c8', fontSize: '0.85rem',
                }}></i>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  autoComplete="current-password" disabled={loading}
                  style={{
                    width: '100%', padding: '11px 40px 11px 38px',
                    border: '1.5px solid #d0d7e1', borderRadius: '10px',
                    fontSize: '0.875rem', color: '#0f1620',
                    background: '#f2f5fa', outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(67,97,238,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f2f5fa'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#a3b0c8', fontSize: '0.85rem', padding: '4px',
                  }}
                  tabIndex={-1}
                >
                  <i className={showPwd ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'}></i>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#a3b0c8' : 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                color: '#fff', border: 'none', borderRadius: '10px',
                fontSize: '0.9rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(67,97,238,0.35)',
                transition: 'opacity 0.15s, transform 0.1s, box-shadow 0.15s',
                fontFamily: 'Inter, sans-serif',
                marginTop: '4px',
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(67,97,238,0.45)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = loading ? 'none' : '0 4px 14px rgba(67,97,238,0.35)'; }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: '16px', height: '16px',
                    border: '2.5px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }} />
                  Connexion en cours…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-arrow-right-to-bracket"></i>
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Divider info */}
          <div style={{
            marginTop: '28px', paddingTop: '24px',
            borderTop: '1px solid #ecedf5',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#f1f4f9', borderRadius: '10px',
            padding: '14px 16px',
          }}>
            <i className="fa-solid fa-shield-halved" style={{ color: '#4361ee', fontSize: '1rem' }}></i>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7a99', lineHeight: 1.4 }}>
              Connexion sécurisée via l'API PrestaShop.<br />
              Vos données restent confidentielles.
            </p>
          </div>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          .login-root { grid-template-columns: 1fr !important; }
          .login-brand-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
