import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthError } from '../services/authService';
import './Login.css';

const Login: React.FC = () => {
  const DEFAULT_EMAIL = import.meta.env.VITE_DEFAULT_EMAIL ?? 'cindyophelia2301@gmail.com';
  const DEFAULT_PWD   = import.meta.env.VITE_DEFAULT_PWD   ?? 'soobin0512';

  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PWD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Si déjà connecté, rediriger vers la page d'origine ou l'accueil
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
      // La redirection est gérée par le useEffect ci-dessus
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError('Une erreur inattendue est survenue. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">PS</div>
          <h1>PrestaShop</h1>
          <p>Gestion des produits</p>
        </div>

        {error && (
          <div className="login-error" role="alert">
            <span className="login-error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field">
            <label htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@exemple.com"
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true"></span>
                Connexion en cours…
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
