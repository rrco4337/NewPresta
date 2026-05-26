import React, { useState, useEffect } from 'react';
import './StockEvolution.css';
import { stockService, type StockLine, type StockMovement } from '../services/stockService';

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
  const [reservedStock, setReservedStock] = useState<number>(0);

  const [allMovements, setAllMovements] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    fetchItems();
    stockService.getAllMovements()
      .then(setAllMovements)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
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

  const fetchStockEvolution = async () => {
    if (!selectedItem) {
      setError('Veuillez sélectionner un produit');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const movements = await stockService.getMovements(selectedItem.productId, selectedItem.combinationId);
      const dailyData = transformMovementsToDaily(movements);
      setDailyData(dailyData);
      
      // Récupérer le stock réservé pour ce produit/déclinaison
      const reserved = await stockService.getReservedStock(selectedItem.productId, selectedItem.combinationId);
      setReservedStock(reserved);
      
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
    
    const sortedMovements = [...movements].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    let currentStock = 0;
    
    for (const movement of sortedMovements) {
      const date = movement.date.split('T')[0];
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
    setReservedStock(0);
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

  const filteredHistory = historySearch
    ? allMovements.filter(m =>
        m.productName.toLowerCase().includes(historySearch.toLowerCase()) ||
        m.combinationLabel.toLowerCase().includes(historySearch.toLowerCase())
      )
    : allMovements;

  const totalMovement = dailyData.reduce((sum, d) => sum + d.movement, 0);
  const avgMovement = dailyData.length ? (totalMovement / dailyData.length).toFixed(1) : '0';
  const finalStock = dailyData.length > 0 ? dailyData[dailyData.length - 1]?.quantity || 0 : 0;
  const initialStock = dailyData.length > 0 ? dailyData[0]?.quantity || 0 : 0;
  const finalRealStock = finalStock - reservedStock;

  return (
    <div className="stock-evolution-page">
      <div className="stock-evolution-header">
        <h1>Évolution du stock</h1>
      </div>

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
              <span className="stat-label">Stock réservé</span>
              <span className="stat-number">{reservedStock}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Stock final disponible</span>
              <span className={`stat-number ${finalRealStock < 0 ? 'negative' : finalRealStock > 0 ? 'positive' : 'neutral'}`}>
                {finalRealStock}
              </span>
            </div>
            {/* <div className="stat-item">
              <span className="stat-label">Variation</span>
              <span className={`stat-number ${getMovementClass(totalMovement)}`}>
                {totalMovement > 0 ? '+' : ''}{totalMovement}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Moyenne/jour</span>
              <span className="stat-number">{avgMovement}</span>
            </div> */}
          </div>
        )}

      <div className="table-wrapper">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Chargement des données…</p>
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

      {/* ── Historique global ── */}
      <div className="global-history-section">
        <div className="global-history-header">
          <div className="global-history-title-row">
            <h2 className="global-history-title">Historique global des mouvements</h2>
            {!historyLoading && (
              <span className="history-count">{filteredHistory.length} mouvement{filteredHistory.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <input
            type="text"
            className="history-search"
            placeholder="Filtrer par produit..."
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
          />
        </div>

        <div className="table-wrapper">
          {historyLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Chargement de l'historique…</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">
              <p>Aucun mouvement enregistré</p>
            </div>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Heure</th>
                  <th>Produit</th>
                  <th>Déclinaison</th>
                  <th>Type</th>
                  <th>Quantité</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((mvt, idx) => {
                  const d = new Date(mvt.date);
                  const isIn = mvt.quantityAdded >= 0;
                  return (
                    <tr key={mvt.id || idx}>
                      <td className="date-cell">
                        {d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="time-cell">
                        {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="product-cell">{mvt.productName}</td>
                      <td className="combo-cell">{mvt.combinationLabel || '—'}</td>
                      <td>
                        <span className={`movement-badge ${isIn ? 'badge-in' : 'badge-out'}`}>
                          {isIn ? 'Entrée' : 'Sortie'}
                        </span>
                      </td>
                      <td className={`movement-cell ${isIn ? 'positive' : 'negative'}`}>
                        {mvt.quantityAdded > 0 ? '+' : ''}{mvt.quantityAdded}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockEvolution;