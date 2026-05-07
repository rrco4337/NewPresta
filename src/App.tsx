import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProductList from './components/ProductList';
import ProductCreate from './components/ProductCreate';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/products/add" element={<ProductCreate />} />
        <Route path="/products/:id" element={<ProductCreate />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;