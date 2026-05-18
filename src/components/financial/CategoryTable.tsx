import { formatCurrency } from '../../utils/formatCurrency';
export function CategoryTable({ categories }) {
  return (
    <table className="min-w-full">
      <thead><tr><th>Catégorie</th><th>Ventes</th><th>Achats (stock)</th><th>Bénéfice</th></tr></thead>
      <tbody>
        {categories.map(cat => (
          <tr key={cat.categoryId}>
            <td>{cat.categoryName}</td>
            <td>{formatCurrency(cat.sales)}</td>
            <td>{formatCurrency(cat.purchases)}</td>
            <td className={cat.profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(cat.profit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}