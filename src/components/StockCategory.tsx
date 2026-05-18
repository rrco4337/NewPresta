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
  
  const totalPhysical = stockData.reduce((sum, cat) => sum + cat.physicalQuantity, 0);
  const totalReserved = stockData.reduce((sum, cat) => sum + cat.reservedQuantity, 0);
  const totalAvailable = stockData.reduce((sum, cat) => sum + cat.availableQuantity, 0);
  
  if (loading) {
    return (
      <div className="stock-category-loading">
        <div className="spinner"></div>
        <p>Chargement des stocks...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="stock-category-error">
        <p>❌ {error}</p>
        <button onClick={loadStockData} className="retry-btn">
          Réessayer
        </button>
      </div>
    );
  }
  
  if (stockData.length === 0) {
    return (
      <div className="stock-category-empty">
        <p>📦 Aucun stock trouvé</p>
      </div>
    );
  }
  
  return (
    <div className="stock-category-container">
      <h2>📊 État des stocks par catégorie</h2>
      
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
              <td className="number">
                {cat.physicalQuantity.toLocaleString('fr-FR')}
              </td>
              <td className="number">
                {cat.reservedQuantity.toLocaleString('fr-FR')}
              </td>
              <td className={`number ${cat.availableQuantity < 0 ? 'negative' : ''}`}>
                {cat.availableQuantity.toLocaleString('fr-FR')}
                {cat.availableQuantity < 10 && cat.availableQuantity > 0 && (
                  <span className="warning-icon">⚠️</span>
                )}
                {cat.availableQuantity <= 0 && (
                  <span className="danger-icon">🔴</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td><strong>Total général</strong></td>
            <td className="number">
              <strong>{totalPhysical.toLocaleString('fr-FR')}</strong>
            </td>
            <td className="number">
              <strong>{totalReserved.toLocaleString('fr-FR')}</strong>
            </td>
            <td className="number">
              <strong>{totalAvailable.toLocaleString('fr-FR')}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      
      <div className="stock-legend">
        <div className="legend-item">
          <span className="warning-icon">⚠️</span>
          <span>Stock faible (&lt;10 unités)</span>
        </div>
        <div className="legend-item">
          <span className="danger-icon">🔴</span>
          <span>Rupture de stock</span>
        </div>
      </div>
    </div>
  );
};