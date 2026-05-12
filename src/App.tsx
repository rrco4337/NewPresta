import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { CustomerProvider } from './contexts/CustomerContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import ShopLayout from './components/ShopLayout';
import Login from './components/Login';
import ProductList from './components/ProductList';
import ProductCreate from './components/ProductCreate';
import ProductImport from './components/ProductImport';
import CatalogImport from './components/CatalogImport';
import FichiersImport from './components/FichiersImport';
import OrderList from './components/OrderList';
import DataReset from './components/DataReset';
import ShopHome from './components/ShopHome';
import ProductDetail from './components/ProductDetail';
import CartPage from './components/CartPage';
import CustomerAuthPage from './components/CustomerAuthPage';
import CheckoutPage from './components/CheckoutPage';
import OrderConfirmation from './components/OrderConfirmation';
import MyOrders from './components/MyOrders';
import ImportAudit from './components/ImportAudit';
import DashboardPage from './components/dashboardPage';
import UserSelectPage from './components/UserSelectPage';

// Résout le titre de page selon la route courante
function resolvePageTitle(pathname: string): string {
  if (pathname === '/products') return 'Produits';
  if (pathname === '/products/add') return 'Ajouter un produit';
  if (pathname === '/products/import') return 'Import CSV Produits';
  if (pathname.startsWith('/products/')) return 'Modifier le produit';
  if (pathname === '/import') return 'Import CSV Catalogue';
  if (pathname === '/import/fichiers') return 'Import Fichiers';
  if (pathname === '/orders') return 'Commandes';
  if (pathname === '/reset') return 'Réinitialisation';
  if (pathname === '/audit/import') return 'Audit import';
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
        <CustomerProvider>
        <CartProvider>
          <Routes>
            {/* ── Page de selection utilisateur ── */}
            <Route path="/" element={<UserSelectPage />} />

            {/* ── Route publique login ── */}
            <Route path="/login" element={<Login />} />

            {/* ── FrontOffice (public, sans sidebar) ── */}
            <Route
              path="/shop"
              element={
                <ShopLayout>
                  <ShopHome />
                </ShopLayout>
              }
            />
            <Route
              path="/shop/:id"
              element={
                <ShopLayout>
                  <ProductDetail />
                </ShopLayout>
              }
            />

            {/* ── BackOffice (protégé, avec sidebar) ── */}
            <Route
              path="/products"
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
            <Route
              path="/audit/import"
              element={
                <ProtectedRoute>
                  <LayoutWrapper>
                    <ImportAudit />
                  </LayoutWrapper>
                </ProtectedRoute>
              }
            />

            {/* ── FrontOffice — panier & tunnel d'achat ── */}
            <Route
              path="/shop/cart"
              element={<ShopLayout><CartPage /></ShopLayout>}
            />
            <Route
              path="/shop/auth"
              element={<CustomerAuthPage />}
            />
            <Route
              path="/shop/checkout"
              element={<ShopLayout><CheckoutPage /></ShopLayout>}
            />
            <Route
              path="/shop/confirmation/:id"
              element={<ShopLayout><OrderConfirmation /></ShopLayout>}
            />
            // À l'intérieur des routes protégées :
<Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/shop/my-orders"
              element={<ShopLayout><MyOrders /></ShopLayout>}
            />
          </Routes>
        </CartProvider>
        </CustomerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
