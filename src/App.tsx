import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import ProductList from './components/ProductList';
import ProductCreate from './components/ProductCreate';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Route publique */}
          <Route path="/login" element={<Login />} />

          {/* Routes protégées — accès refusé si non connecté */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ProductList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products/add"
            element={
              <ProtectedRoute>
                <ProductCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products/:id"
            element={
              <ProtectedRoute>
                <ProductCreate />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
