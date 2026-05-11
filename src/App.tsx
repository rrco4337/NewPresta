import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './components/Login';
import ProductList from './components/ProductList';
import ProductCreate from './components/ProductCreate';
import ProductImport from './components/ProductImport';
import CatalogImport from './components/CatalogImport';
import FichiersImport from './components/FichiersImport';
import OrderList from './components/OrderList';
import DataReset from './components/DataReset';

// Résout le titre de page selon la route courante
function resolvePageTitle(pathname: string): string {
  if (pathname === '/') return 'Produits';
  if (pathname === '/products/add') return 'Ajouter un produit';
  if (pathname === '/products/import') return 'Import CSV Produits';
  if (pathname.startsWith('/products/')) return 'Modifier le produit';
  if (pathname === '/import') return 'Import CSV Catalogue';
  if (pathname === '/import/fichiers') return 'Import Fichiers';
  if (pathname === '/orders') return 'Commandes';
  if (pathname === '/reset') return 'Réinitialisation';
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
            path="/products/import"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <ProductImport />
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
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <CatalogImport />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/import/fichiers"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <FichiersImport />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <OrderList />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reset"
            element={
              <ProtectedRoute>
                <LayoutWrapper>
                  <DataReset />
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
