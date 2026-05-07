import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import type { AuthUser } from '../services/authService';

// ==========================================
// 1. TYPES DU CONTEXTE
// ==========================================
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ==========================================
// 2. CRÉATION DU CONTEXTE
// ==========================================
const AuthContext = createContext<AuthContextType | null>(null);

// ==========================================
// 3. PROVIDER
// ==========================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaure la session depuis localStorage au montage
  useEffect(() => {
    setUser(authService.getCurrentUser());
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const loggedUser = await authService.login({ email, password });
    setUser(loggedUser);
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ==========================================
// 4. HOOK D'ACCÈS AU CONTEXTE
// ==========================================
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de AuthProvider');
  return ctx;
};
