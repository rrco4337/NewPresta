import React, { useEffect, useState } from 'react';
import { stockService, type CategoryStock } from '../services/stockService';
import './StockCategory.css';

export const StockByCategoryTable: React.FC = () => {
  const [stockData, setStockData] = useState<CategoryStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStockData();
  }, []);

  const loadStockData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await stockService.getStockByCategory();
      setStockData(data);
    } catch (err) {
      setError('Erreur lors du chargement des stocks par catégorie');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalPhysical  = stockData.reduce((sum, cat) => sum + cat.physicalQuantity,  0);
  const totalReserved  = stockData.reduce((sum, cat) => sum + cat.reservedQuantity,  0);
  const totalAvailable = stockData.reduce((sum, cat) => sum + cat.availableQuantity, 0);

  if (loading) {
    return (
      <div className="stock-category-page">
        <div className="stock-category-loading">
          <div className="spinner" />
          <p>Chargement des stocks…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-category-page">
        <div className="stock-category-error">
          <p>{error}</p>
          <button onClick={loadStockData} className="retry-btn">Réessayer</button>
        </div>
      </div>
    );
  }

  if (stockData.length === 0) {
    return (
      <div className="stock-category-page">
        <div className="stock-category-empty">
          <p>Aucun stock trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stock-category-page">
      <div className="stock-category-header">
        <h1>Stocks par catégorie</h1>
      </div>

      <div className="stock-category-table-wrapper">
        <table className="stock-category-table">
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Qté physique</th>
              <th>Qté réservée</th>
              <th>Qté disponible</th>
            </tr>
          </thead>
          <tbody>
            {stockData.map((cat) => (
              <tr key={cat.categoryId}>
                <td className="category-name">{cat.categoryName}</td>
                <td className="number">{cat.physicalQuantity.toLocaleString('fr-FR')}</td>
                <td className="number">{cat.reservedQuantity.toLocaleString('fr-FR')}</td>
                <td className="number">
                  <span className={cat.availableQuantity < 0 ? 'negative' : ''}>
                    {cat.availableQuantity.toLocaleString('fr-FR')}
                  </span>
                  {cat.availableQuantity < 10 && cat.availableQuantity > 0 && (
                    <span className="badge-warning">Faible</span>
                  )}
                  {cat.availableQuantity <= 0 && (
                    <span className="badge-danger">Rupture</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total général</td>
              <td className="number">{totalPhysical.toLocaleString('fr-FR')}</td>
              <td className="number">{totalReserved.toLocaleString('fr-FR')}</td>
              <td className="number">{totalAvailable.toLocaleString('fr-FR')}</td>
            </tr>
          </tfoot>
        </table>

        <div className="stock-legend">
          <div className="legend-item">
            <span className="badge-warning">Faible</span>
            Stock faible (&lt;10 unités)
          </div>
          <div className="legend-item">
            <span className="badge-danger">Rupture</span>
            Rupture de stock
          </div>
        </div>
      </div>
    </div>
  );
};
