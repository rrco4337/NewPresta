import { useEffect, useState } from 'react';
import { categoryService } from '../../services/categoryService';

export function CategorySelector({ value, onChange }) {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    categoryService.getAllCategories().then(setCategories);
  }, []);
  return (
    <select value={value || ''} onChange={(e) => onChange(Number(e.target.value) || null)}>
      <option value="">Toutes les catégories</option>
      {categories.map(cat => (
        <option key={cat.id} value={cat.id}>{cat.name}</option>
      ))}
    </select>
  );
}