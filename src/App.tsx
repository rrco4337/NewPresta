import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './components/Login';
import ProductList from './components/ProductList';
import ProductCreate from './components/ProductCreate';

// Résout le titre de page selon la route courante
function resolvePageTitle(pathname: string): string {
  if (pathname === '/') return 'Produits';
  if (pathname === '/products/add') return 'Ajouter un produit';
  if (pathname.startsWith('/products/')) return 'Modifier le produit';
  return '';
}

// Layout wrapper qui lit l'URL pour passer le bon titre
function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <AppLayout pageTitle={resolvePageTitle(location.pathname)}>
      {children}
    </AppLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Route publique */}
          <Route path="/login" element={<Login />} />

          {/* Routes protégées — enveloppées dans le layout avec sidebar */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <ProductList />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/products/add"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <ProductCreate />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/products/:id"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <ProductCreate />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
