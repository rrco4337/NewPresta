import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCustomer } from '../contexts/CustomerContext';
import { findCustomerByEmail, registerCustomer } from '../services/customerService';
import './CustomerAuthPage.css';

type Tab = 'login' | 'register';

const CustomerAuthPage: React.FC = () => {
  const { customer, setCustomer } = useCustomer();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? '/shop';

  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');

  // Register fields
  const [regFirstname, setRegFirstname] = useState('');
  const [regLastname, setRegLastname] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPasswd, setRegPasswd] = useState('');

  useEffect(() => {
    if (customer) navigate(next, { replace: true });
  }, [customer, navigate, next]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) { setError('Veuillez saisir votre email.'); return; }
    setLoading(true);
    setError(null);
    try {
      const found = await findCustomerByEmail(loginEmail.trim());
      if (!found) {
        setError('Aucun compte trouvé avec cet email. Veuillez créer un compte.');
        return;
      }
      setCustomer(found);
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstname.trim() || !regLastname.trim() || !regEmail.trim() || !regPasswd.trim()) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    if (regPasswd.length < 5) {
      setError('Le mot de passe doit comporter au moins 5 caractères.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const existing = await findCustomerByEmail(regEmail.trim());
      if (existing) {
        setError('Un compte existe déjà avec cet email. Connectez-vous.');
        return;
      }
      const newCustomer = await registerCustomer({
        email: regEmail.trim(),
        firstname: regFirstname.trim(),
        lastname: regLastname.trim(),
        passwd: regPasswd,
      });
      setCustomer(newCustomer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création du compte.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Link to="/shop" className="auth-back">← Retour à la boutique</Link>
          <h1 className="auth-title">Mon compte</h1>
        </div>

        {/* ── Tabs ── */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' auth-tab--active' : ''}`}
            onClick={() => { setTab('login'); setError(null); }}
          >Se connecter</button>
          <button
            className={`auth-tab${tab === 'register' ? ' auth-tab--active' : ''}`}
            onClick={() => { setTab('register'); setError(null); }}
          >Créer un compte</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {/* ── Login ── */}
        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label className="auth-label">Adresse email</label>
              <input
                type="email"
                className="auth-input"
                placeholder="votre@email.com"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <p className="auth-hint">Authentification via l'API PrestaShop — aucun mot de passe requis.</p>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <p className="auth-switch">
              Pas encore de compte ?{' '}
              <button type="button" className="auth-switch-link" onClick={() => { setTab('register'); setError(null); }}>
                Créer un compte
              </button>
            </p>
          </form>
        )}

        {/* ── Register ── */}
        {tab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-row">
              <div className="auth-field">
                <label className="auth-label">Prénom</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Jean"
                  value={regFirstname}
                  onChange={e => setRegFirstname(e.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Nom</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Dupont"
                  value={regLastname}
                  onChange={e => setRegLastname(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="auth-label">Adresse email</label>
              <input
                type="email"
                className="auth-input"
                placeholder="votre@email.com"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Mot de passe</label>
              <input
                type="password"
                className="auth-input"
                placeholder="5 caractères minimum"
                value={regPasswd}
                onChange={e => setRegPasswd(e.target.value)}
                minLength={5}
                required
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
            <p className="auth-switch">
              Déjà un compte ?{' '}
              <button type="button" className="auth-switch-link" onClick={() => { setTab('login'); setError(null); }}>
                Se connecter
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default CustomerAuthPage;
