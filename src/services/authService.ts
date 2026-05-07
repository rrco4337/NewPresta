import axios from 'axios';

// ==========================================
// 1. TYPES
// ==========================================
export interface AuthUser {
  email: string;
  adminToken: string; // token CSRF extrait de l'URL de redirection après login BO
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Réponse JSON du contrôleur AdminLogin (mode ajax=1)
interface AdminLoginResponse {
  hasErrors: boolean;   // NB: "hasErrors" avec 's', différent du front-office ("hasError")
  errors: string[];
  redirect?: string;    // ex: "/admin.../index.php?controller=AdminDashboard&token=abc123"
}

// ==========================================
// 2. CLASSE D'ERREUR MÉTIER
// ==========================================
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED';

export class AuthError extends Error {
  constructor(message: string, public readonly code: AuthErrorCode) {
    super(message);
    this.name = 'AuthError';
  }
}

// ==========================================
// 3. CONFIGURATION AXIOS (back-office)
// ==========================================
const ADMIN_DIR = import.meta.env.VITE_ADMIN_DIR as string;

// Instance dédiée aux endpoints admin BO PrestaShop (/{adminDir}/index.php),
// distincts du WebService REST (/api/*) qui utilise Basic Auth.
const authApi = axios.create({
  withCredentials: true, // nécessaire pour le cookie de session admin
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// ==========================================
// 4. STOCKAGE LOCAL
// ==========================================
const STORAGE_KEY = 'ps_admin_user';

function persistUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function extractAdminToken(redirectUrl: string): string {
  const match = redirectUrl.match(/token=([a-f0-9]+)/i);
  return match?.[1] ?? '';
}

// ==========================================
// 5. SERVICE D'AUTHENTIFICATION
// ==========================================
export const authService = {

  /**
   * Authentifie un administrateur PrestaShop via le contrôleur AdminLogin.
   * POST /{adminDir}/index.php?controller=AdminLogin&ajax=1&action=login
   * En cas de succès, stocke l'utilisateur + le token CSRF dans localStorage.
   */
  login: async (credentials: LoginCredentials): Promise<AuthUser> => {
    try {
      const body = new URLSearchParams({
        email: credentials.email,
        passwd: credentials.password, // le BO utilise "passwd", pas "password"
        submitLogin: '1',
        ajax: '1',
        stay_logged_in: '1',
        redirect: 'AdminDashboard',
      });

      const response = await authApi.post<AdminLoginResponse>(
        `/${ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1&action=login`,
        body.toString()
      );

      const data = response.data;

      if (data.hasErrors) {
        const message = data.errors?.[0] || 'Identifiants invalides.';
        throw new AuthError(message, 'INVALID_CREDENTIALS');
      }

      // Le token CSRF admin est encodé dans l'URL de redirection
      const adminToken = data.redirect ? extractAdminToken(data.redirect) : '';

      const user: AuthUser = { email: credentials.email, adminToken };
      persistUser(user);
      return user;

    } catch (error: unknown) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Impossible de contacter le serveur.', 'NETWORK_ERROR');
    }
  },

  /**
   * Déconnecte l'administrateur du BO et vide le localStorage.
   * GET /{adminDir}/index.php?controller=AdminLogin&logout&token={adminToken}
   */
  logout: async (): Promise<void> => {
    const user = authService.getCurrentUser();
    try {
      if (user?.adminToken) {
        await authApi.get(
          `/${ADMIN_DIR}/index.php?controller=AdminLogin&logout&token=${user.adminToken}`
        );
      }
    } finally {
      clearUser();
    }
  },

  /** Retourne l'admin stocké localement, ou null si non connecté. */
  getCurrentUser: (): AuthUser | null => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      clearUser();
      return null;
    }
  },

  /** Indique si un administrateur est actuellement connecté. */
  isAuthenticated: (): boolean => !!authService.getCurrentUser(),
};
