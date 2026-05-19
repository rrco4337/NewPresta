import type { CategoryStats } from '../../types/financial.types';

interface CategorySelectorProps {
  allCategories: CategoryStats[];
  value: number | null;
  onChange: (id: number | null) => void;
}

export function CategorySelector({ allCategories, value, onChange }: CategorySelectorProps) {
  return (
    <div className="fa-cat-filter">
      <span className="fa-filter-label">Catégorie :</span>
      <select
        className="fa-cat-select"
        value={value ?? ''}
        onChange={e => onChange(Number(e.target.value) || null)}
      >
        <option value="">Toutes les catégories</option>
        {allCategories.map(cat => (
          <option key={cat.categoryId} value={cat.categoryId}>{cat.categoryName}</option>
        ))}
      </select>
    </div>
  );
}
