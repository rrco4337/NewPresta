import React, { useState, useEffect } from 'react';
import './StockEvolution.css';
import { stockService, type StockLine } from '../services/stockService';

interface DailyStock {
  date: string;
  quantity: number;
  movement: number;
  note?: string;
}

interface SelectableItem {
  key: string;
  productId: string;
  combinationId: string | null;
  displayName: string;
  reference: string;
  combinationLabel: string;
}

const StockEvolution: React.FC = () => {
  const [items, setItems] = useState<SelectableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dailyData, setDailyData] = useState<DailyStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Charger la liste des produits ET déclinaisons
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const allLines = await stockService.getAllStockLines();
      
      const selectableItems: SelectableItem[] = allLines.map(line => ({
        key: line.key,
        productId: line.productId,
        combinationId: line.combinationId,
        displayName: line.combinationLabel 
          ? `${line.productName} - ${line.combinationLabel}`
          : line.productName,
        reference: line.reference,
        combinationLabel: line.combinationLabel,
      }));
      
      setItems(selectableItems);
    } catch (err) {
      console.error('Erreur chargement produits', err);
    }
  };

  // ⚠️ FONCTION MODIFIÉE : maintenant asynchrone avec await
  const fetchStockEvolution = async () => {
    if (!selectedItem) {
      setError('Veuillez sélectionner un produit');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Appel asynchrone vers l'API native PrestaShop
      const movements = await stockService.getMovements(selectedItem.productId, selectedItem.combinationId);
      
      // Transformer les mouvements en données journalières
      const dailyData = transformMovementsToDaily(movements);
      setDailyData(dailyData);
      
      console.log('Mouvements récupérés:', movements.length);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const transformMovementsToDaily = (movements: any[]): DailyStock[] => {
    const dailyMap = new Map<string, DailyStock>();
    
    // Trier les mouvements par date croissante pour calculer les stocks cumulés
    const sortedMovements = [...movements].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // État initial (on prend la première quantité disponible)
    let currentStock = 0;
    
    for (const movement of sortedMovements) {
      const date = movement.date.split('T')[0];
      
      // Mettre à jour le stock cumulé
      currentStock += movement.quantityAdded;
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          quantity: currentStock,
          movement: movement.quantityAdded,
          note: movement.note,
        });
      } else {
        const existing = dailyMap.get(date)!;
        existing.movement += movement.quantityAdded;
        existing.quantity = currentStock;
        if (movement.note && !existing.note) {
          existing.note = movement.note;
        }
      }
    }
    
    // Trier par date décroissante (plus récent en premier)
    return Array.from(dailyMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const handleSearch = () => {
    fetchStockEvolution();
  };

  const handleReset = () => {
    setSelectedItem(null);
    setSearchTerm('');
    setDailyData([]);
    setError(null);
  };

  const getMovementClass = (movement: number): string => {
    if (movement > 0) return 'positive';
    if (movement < 0) return 'negative';
    return 'neutral';
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const filteredItems = items.filter(item => 
    item.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productId.includes(searchTerm)
  );

  const totalMovement = dailyData.reduce((sum, d) => sum + d.movement, 0);
  const avgMovement = dailyData.length ? (totalMovement / dailyData.length).toFixed(1) : '0';
  const finalStock = dailyData[dailyData.length - 1]?.quantity || 0;
  const initialStock = dailyData[0]?.quantity || 0;

  return (
    <div className="stock-evolution-page">
      <div className="page-container">
        <h1 className="page-title">Évolution du stock</h1>
        
        <div className="filters-card">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Produit / Déclinaison *</label>
              <div className="autocomplete-container">
                <input
                  type="text"
                  placeholder="Rechercher un produit ou une déclinaison..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="product-input"
                />
                {showDropdown && filteredItems.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {filteredItems.map((item) => (
                      <div
                        key={item.key}
                        className={`dropdown-item ${selectedItem?.key === item.key ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedItem(item);
                          setSearchTerm(item.displayName);
                          setShowDropdown(false);
                        }}
                      >
                        <span className="product-name-dropdown">{item.displayName}</span>
                        <span className="product-ref-dropdown">{item.reference}</span>
                        {item.combinationLabel && (
                          <span className="combination-badge">Déclinaison</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedItem && (
                <div className="selected-product-badge">
                  ✓ {selectedItem.combinationLabel ? 'Déclinaison' : 'Produit'} sélectionné : {selectedItem.displayName}
                  <button onClick={() => {
                    setSelectedItem(null);
                    setSearchTerm('');
                  }}>×</button>
                </div>
              )}
            </div>

            <div className="filter-group buttons-group">
              <button 
                className="btn btn-primary" 
                onClick={handleSearch}
                disabled={!selectedItem}
              >
                Afficher l'évolution
              </button>
              <button className="btn btn-secondary" onClick={handleReset}>
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Résumé stats */}
        {dailyData.length > 0 && (
          <div className="stats-summary">
            <div className="stat-item">
              <span className="stat-label">Stock initial</span>
              <span className="stat-number">{initialStock}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Stock final</span>
              <span className="stat-number">{finalStock}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Variation</span>
              <span className={`stat-number ${getMovementClass(totalMovement)}`}>
                {totalMovement > 0 ? '+' : ''}{totalMovement}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Moyenne/jour</span>
              <span className="stat-number">{avgMovement}</span>
            </div>
          </div>
        )}

        {/* Tableau */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Chargement des données...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={handleSearch} className="btn btn-primary">Réessayer</button>
            </div>
          ) : dailyData.length === 0 ? (
            <div className="empty-state">
              <p>Aucune donnée à afficher</p>
              <p className="empty-hint">Sélectionnez un produit pour voir l'évolution du stock</p>
            </div>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Stock (quantité)</th>
                  <th>Mouvement</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day, idx) => (
                  <tr key={idx}>
                    <td className="date-cell">{formatDate(day.date)}</td>
                    <td className="quantity-cell">{day.quantity}</td>
                    <td className={`movement-cell ${getMovementClass(day.movement)}`}>
                      {day.movement !== 0 && (
                        <>{day.movement > 0 ? '+' : ''}{day.movement}</>
                      )}
                      {day.movement === 0 && '—'}
                    </td>
                    <td className="note-cell">{day.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockEvolution;