import React, { useState, useEffect, useMemo } from 'react';
import { stockService, type StockLine, type StockMovement } from '../services/stockService';
import './StockUpdate.css';

type Tab = 'stock' | 'movements';
type StockFilter = 'all' | 'low' | 'zero';

const LOW_STOCK_THRESHOLD = 5;

// ──────────────────────────────────────────
// Sous-composant : Badge stock
// ──────────────────────────────────────────
function QtyBadge({ qty }: { qty: number }) {
  const cls =
    qty === 0 ? 'badge-qty zero'
    : qty <= LOW_STOCK_THRESHOLD ? 'badge-qty low'
    : 'badge-qty ok';
  return <span className={cls}>{qty}</span>;
}

// ──────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────
export function StockUpdate() {
  const [lines, setLines] = useState<StockLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('stock');
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Filtres
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  // État par ligne (clé = StockLine.key)
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  // ──────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await stockService.getAllStockLines();
      setLines(data);
      setMovements(await stockService.getMovements());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const refreshMovements = async () => setMovements(await stockService.getMovements());

  // ──────────────────────────────────────────
  // Filtrage + regroupement par produit
  // ──────────────────────────────────────────
  const filteredLines = useMemo(() => {
    let result = lines;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.productName.toLowerCase().includes(q) ||
        l.combinationLabel.toLowerCase().includes(q) ||
        l.reference.toLowerCase().includes(q) ||
        l.ean13.includes(q)
      );
    }

    if (stockFilter === 'zero') result = result.filter(l => l.quantity === 0);
    else if (stockFilter === 'low') result = result.filter(l => l.quantity > 0 && l.quantity <= LOW_STOCK_THRESHOLD);

    return result;
  }, [lines, search, stockFilter]);

  /** Map productId → lignes, dans l'ordre d'apparition */
  const grouped = useMemo(() => {
    const map = new Map<string, StockLine[]>();
    for (const l of filteredLines) {
      const arr = map.get(l.productId) ?? [];
      arr.push(l);
      map.set(l.productId, arr);
    }
    return map;
  }, [filteredLines]);

  // Compteurs pour les onglets de filtre
  const counts = useMemo(() => ({
    zero: lines.filter(l => l.quantity === 0).length,
    low: lines.filter(l => l.quantity > 0 && l.quantity <= LOW_STOCK_THRESHOLD).length,
  }), [lines]);

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────
  const handleAddStock = async (line: StockLine) => {
    const qty = parseInt(qtyInputs[line.key] ?? '0', 10);
    if (isNaN(qty) || qty <= 0) return;

    setUpdating(prev => ({ ...prev, [line.key]: true }));
    try {
      const updated = await stockService.addStock(line, qty, noteInputs[line.key] ?? '');
      setLines(prev => prev.map(l => l.key === line.key ? updated : l));
      setQtyInputs(prev => ({ ...prev, [line.key]: '' }));
      setNoteInputs(prev => ({ ...prev, [line.key]: '' }));
      refreshMovements();
    } catch (err) {
      alert(`❌ ${err instanceof Error ? err.message : 'Erreur de mise à jour'}`);
    } finally {
      setUpdating(prev => ({ ...prev, [line.key]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, line: StockLine) => {
    if (e.key === 'Enter') handleAddStock(line);
  };

  const handleClearMovements = async () => {
    if (!confirm('Vider tout l\'historique des mouvements ?')) return;
    await stockService.clearMovements();
    setMovements([]);
  };

  // ──────────────────────────────────────────
  // Rendus conditionnels
  // ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="su-root">
        <div className="su-loading">
          <span className="su-spinner" />
          Chargement des stocks…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="su-root">
        <div className="su-error">
          <span className="su-error-icon">⚠</span>
          <p>{error}</p>
          <button className="su-btn su-btn-primary" onClick={loadData}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="su-root">
      {/* ── En-tête ── */}
      <header className="su-header">
        <div className="su-header-left">
          <h2 className="su-title">Gestion des stocks disponibles</h2>
          <span className="su-meta">{lines.length} référence{lines.length > 1 ? 's' : ''}</span>
        </div>
        <nav className="su-tabs">
          <button
            className={`su-tab ${tab === 'stock' ? 'active' : ''}`}
            onClick={() => setTab('stock')}
          >
            Stocks
          </button>
          <button
            className={`su-tab ${tab === 'movements' ? 'active' : ''}`}
            onClick={() => setTab('movements')}
          >
            Mouvements
            {movements.length > 0 && <span className="su-tab-badge">{movements.length}</span>}
          </button>
        </nav>
        <button className="su-btn su-btn-ghost su-btn-refresh" onClick={loadData} title="Actualiser">
          ↺
        </button>
      </header>

      {/* ═══════════════ ONGLET STOCKS ═══════════════ */}
      {tab === 'stock' && (
        <>
          {/* ── Barre d'outils ── */}
          <div className="su-toolbar">
            <div className="su-search-wrap">
              <span className="su-search-icon">⌕</span>
              <input
                type="search"
                placeholder="Nom, référence, EAN…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="su-search"
              />
            </div>
            <div className="su-filter-pills">
              {(['all', 'zero', 'low'] as StockFilter[]).map(f => (
                <button
                  key={f}
                  className={`su-pill ${stockFilter === f ? 'active' : ''} pill-${f}`}
                  onClick={() => setStockFilter(f)}
                >
                  {f === 'all'  && `Tous (${lines.length})`}
                  {f === 'zero' && `Épuisé (${counts.zero})`}
                  {f === 'low'  && `Bas ≤${LOW_STOCK_THRESHOLD} (${counts.low})`}
                </button>
              ))}
            </div>
          </div>

          {/* ── Liste des produits ── */}
          <div className="su-list">
            {grouped.size === 0 && (
              <div className="su-empty">Aucun produit trouvé pour cette recherche.</div>
            )}

            {[...grouped.entries()].map(([productId, productLines]) => {
              const first = productLines[0];
              const isCombinations = first.productType === 'combinations';

              return (
                <div key={productId} className="su-group">
                  {/* En-tête groupe produit */}
                  <div className="su-group-header">
                    <span className="su-group-name">{first.productName}</span>
                    {isCombinations && (
                      <span className="su-tag su-tag-combo">
                        {productLines.length} déclinaison{productLines.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Lignes (1 par produit simple, N par déclinaison) */}
                  {productLines.map(line => (
                    <div
                      key={line.key}
                      className={`su-line ${line.quantity === 0 ? 'is-zero' : line.quantity <= LOW_STOCK_THRESHOLD ? 'is-low' : ''}`}
                    >
                      {/* Infos */}
                      <div className="su-line-info">
                        {line.combinationLabel
                          ? <span className="su-combo-label">{line.combinationLabel}</span>
                          : <span className="su-combo-label su-combo-label--simple">Produit simple</span>
                        }
                        <div className="su-line-meta">
                          {line.reference && <span>Réf : {line.reference}</span>}
                          {line.ean13 && <span>EAN : {line.ean13}</span>}
                        </div>
                      </div>

                      {/* Stock actuel */}
                      <div className="su-line-stock">
                        <span className="su-stock-label">Stock</span>
                        <QtyBadge qty={line.quantity} />
                      </div>

                      {/* Actions */}
                      <div className="su-line-actions">
                        <input
                          type="number"
                          min={1}
                          placeholder="Qté"
                          value={qtyInputs[line.key] ?? ''}
                          onChange={e => setQtyInputs(p => ({ ...p, [line.key]: e.target.value }))}
                          onKeyDown={e => handleKeyDown(e, line)}
                          disabled={updating[line.key]}
                          className="su-input su-input-qty"
                          aria-label="Quantité à ajouter"
                        />
                        <input
                          type="text"
                          placeholder="Motif (optionnel)"
                          value={noteInputs[line.key] ?? ''}
                          onChange={e => setNoteInputs(p => ({ ...p, [line.key]: e.target.value }))}
                          onKeyDown={e => handleKeyDown(e, line)}
                          disabled={updating[line.key]}
                          className="su-input su-input-note"
                          aria-label="Note ou motif du mouvement"
                        />
                        <button
                          onClick={() => handleAddStock(line)}
                          disabled={updating[line.key] || !qtyInputs[line.key]}
                          className="su-btn su-btn-primary su-btn-add"
                        >
                          {updating[line.key] ? <span className="su-spinner su-spinner-sm" /> : '+ Ajouter'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ═══════════════ ONGLET MOUVEMENTS ═══════════════ */}
      {tab === 'movements' && (
        <div className="su-movements">
          <div className="su-movements-toolbar">
            <span className="su-meta">{movements.length} mouvement{movements.length > 1 ? 's' : ''} enregistré{movements.length > 1 ? 's' : ''}</span>
            <button
              onClick={handleClearMovements}
              className="su-btn su-btn-danger"
              disabled={movements.length === 0}
            >
              Vider l'historique
            </button>
          </div>

          {movements.length === 0 ? (
            <div className="su-empty">Aucun mouvement enregistré. Ajoutez du stock pour commencer.</div>
          ) : (
            <div className="su-table-wrap">
              <table className="su-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Produit</th>
                    <th>Déclinaison</th>
                    <th className="su-th-num">Avant</th>
                    <th className="su-th-num">Mouvement</th>
                    <th className="su-th-num">Après</th>
                    <th>Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td className="su-td-date">
                        {new Date(m.date).toLocaleDateString('fr-FR')}<br />
                        <span className="su-td-time">{new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="su-td-product">{m.productName}</td>
                      <td>{m.combinationLabel || <span className="su-muted">—</span>}</td>
                      <td className="su-td-num">{m.quantityBefore}</td>
                      <td className={`su-td-num ${m.quantityAdded >= 0 ? 'su-td-added' : 'su-td-removed'}`}>
                        {m.quantityAdded >= 0 ? '+' : ''}{m.quantityAdded}
                      </td>
                      <td className="su-td-num su-td-after">{m.quantityAfter}</td>
                      <td className="su-td-note">{m.note || <span className="su-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StockUpdate;