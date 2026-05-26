import React, { useState, useEffect, useCallback } from 'react';
import {
  stockServiceApi,
  type Category,
  type ProductStock,
  type RemovalSummary,
} from '../services/stockServiceApi';
import './StockRemove.css';

type Step = 'form' | 'preview' | 'done';

const StockRemove: React.FC = () => {
  const [step, setStep] = useState<Step>('form');

  // Form state
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [chosenQty, setChosenQty] = useState<number | ''>('');
  const [note, setNote] = useState<string>('');

  // Loading
  const [catLoading, setCatLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  // Data
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [summary, setSummary] = useState<RemovalSummary | null>(null);
  const [applyResult, setApplyResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    stockServiceApi
      .getCategories()
      .then(setCategories)
      .catch(() => setError('Impossible de charger les catégories'))
      .finally(() => setCatLoading(false));
  }, []);

  // Load products when category changes
  useEffect(() => {
    if (!selectedCategoryId) {
      setProducts([]);
      setSummary(null);
      return;
    }
    setProductsLoading(true);
    setError(null);
    stockServiceApi
      .getProductStockByCategory(selectedCategoryId)
      .then((lines) => {
        setProducts(lines);
        setSummary(null);
      })
      .catch(() => setError('Impossible de charger les produits de cette catégorie'))
      .finally(() => setProductsLoading(false));
  }, [selectedCategoryId]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const handleCalculate = useCallback(() => {
    if (!selectedCategoryId || chosenQty === '' || chosenQty <= 0 || !selectedCategory) {
      setError('Veuillez remplir tous les champs correctement');
      return;
    }
    if (products.length === 0) {
      setError('Aucun produit trouvé dans cette catégorie');
      return;
    }
    const s = stockServiceApi.calculateRemoval(
      products,
      Number(chosenQty),
      selectedCategory.id,
      selectedCategory.name
    );
    setSummary(s);
    setStep('preview');
    setError(null);
  }, [selectedCategoryId, chosenQty, selectedCategory, products]);

  const handleApply = async () => {
    if (!summary) return;
    setApplying(true);
    try {
      const result = await stockServiceApi.applyRemoval(summary, note);
      setApplyResult(result);
      setStep('done');
    } catch {
      setError('Erreur lors de l\'application des retraits');
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setStep('form');
    setSummary(null);
    setApplyResult(null);
    setError(null);
    setChosenQty('');
    setNote('');
  };

  // ──────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ──────────────────────────────────────────────────────────

  const renderForm = () => (
    <div className="sr-form-card">
      <div className="sr-form-grid">
        {/* Catégorie */}
        <div className="sr-field">
          <label className="sr-label">
            <span className="sr-label-icon">📂</span>
            Catégorie
          </label>
          {catLoading ? (
            <div className="sr-skeleton" />
          ) : (
            <div className="sr-select-wrapper">
              <select
                className="sr-select"
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setSummary(null);
                }}
              >
                <option value="">— Choisir une catégorie —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="sr-select-arrow">▾</span>
            </div>
          )}
          {selectedCategoryId && productsLoading && (
            <p className="sr-hint">Chargement des produits…</p>
          )}
          {selectedCategoryId && !productsLoading && (
            <p className="sr-hint">
              {products.length} produit{products.length !== 1 ? 's' : ''} trouvé
              {products.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Quantité */}
        <div className="sr-field">
          <label className="sr-label">
            <span className="sr-label-icon">🔢</span>
            Quantité à retirer par produit
          </label>
          <input
            type="number"
            className="sr-input"
            min={1}
            value={chosenQty}
            onChange={(e) =>
              setChosenQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))
            }
            placeholder="ex: 7"
          />
        </div>

        {/* Note optionnelle */}
        <div className="sr-field sr-field--full">
          <label className="sr-label">
            <span className="sr-label-icon">📝</span>
            Note (optionnelle)
          </label>
          <input
            type="text"
            className="sr-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motif du retrait…"
          />
        </div>
      </div>

      {error && <p className="sr-error">{error}</p>}

      <div className="sr-form-actions">
        <button
          className="sr-btn sr-btn--primary"
          onClick={handleCalculate}
          disabled={
            !selectedCategoryId ||
            chosenQty === '' ||
            Number(chosenQty) <= 0 ||
            productsLoading ||
            products.length === 0
          }
        >
          Calculer le retrait
        </button>
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!summary) return null;
    return (
      <div className="sr-preview">
        {/* Summary cards */}
        <div className="sr-summary-cards">
          <div className="sr-summary-card">
            <span className="sr-summary-icon">📦</span>
            <div>
              <div className="sr-summary-label">Catégorie</div>
              <div className="sr-summary-value">{summary.categoryName}</div>
            </div>
          </div>
          <div className="sr-summary-card">
            <span className="sr-summary-icon">🔢</span>
            <div>
              <div className="sr-summary-label">Qté choisie/produit</div>
              <div className="sr-summary-value">{summary.chosenQty}</div>
            </div>
          </div>
          <div className="sr-summary-card">
            <span className="sr-summary-icon">📊</span>
            <div>
              <div className="sr-summary-label">Total (stock actuel)</div>
              <div className="sr-summary-value">{summary.total}</div>
            </div>
          </div>
          <div className="sr-summary-card sr-summary-card--realized">
            <span className="sr-summary-icon">✅</span>
            <div>
              <div className="sr-summary-label">Réalisé</div>
              <div className="sr-summary-value sr-summary-value--big">{summary.realized}</div>
            </div>
          </div>
          {summary.totalDeficit > 0 && (
            <div className="sr-summary-card sr-summary-card--deficit">
              <span className="sr-summary-icon">⚠️</span>
              <div>
                <div className="sr-summary-label">Déficit total</div>
                <div className="sr-summary-value sr-summary-value--deficit">
                  -{summary.totalDeficit}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="sr-table-wrapper">
          <table className="sr-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Déclinaison</th>
                <th>Stock actuel</th>
                <th>À retirer</th>
                <th>Déficit</th>
                <th>Stock après</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {summary.products.map((p, idx) => (
                <tr
                  key={`${p.productId}_${p.combinationId ?? 'simple'}_${idx}`}
                  className={p.deficit > 0 ? 'sr-row--deficit' : ''}
                >
                  <td className="sr-td-product">{p.productName}</td>
                  <td className="sr-td-combo">
                    {p.combinationLabel || <span className="sr-muted">—</span>}
                  </td>
                  <td className="sr-td-center">{p.currentStock}</td>
                  <td className="sr-td-center sr-remove">
                    {p.toRemove > 0 ? `-${p.toRemove}` : <span className="sr-muted">0</span>}
                  </td>
                  <td className="sr-td-center">
                    {p.deficit > 0 ? (
                      <span className="sr-deficit-badge">-{p.deficit}</span>
                    ) : (
                      <span className="sr-muted">—</span>
                    )}
                  </td>
                  <td className="sr-td-center">
                    <span className={p.stockAfter === 0 ? 'sr-zero' : ''}>{p.stockAfter}</span>
                  </td>
                  <td className="sr-td-center">
                    {p.deficit > 0 ? (
                      <span className="sr-badge sr-badge--partial">Stock partiel</span>
                    ) : p.toRemove === 0 ? (
                      <span className="sr-badge sr-badge--empty">Vide</span>
                    ) : (
                      <span className="sr-badge sr-badge--ok">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="sr-tfoot-total">
                <td colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td className="sr-td-center">
                  <strong>{summary.total}</strong>
                </td>
                <td className="sr-td-center">
                  <strong>
                    -{summary.products.reduce((s, p) => s + p.toRemove, 0)}
                  </strong>
                </td>
                <td className="sr-td-center">
                  {summary.totalDeficit > 0 ? (
                    <strong className="sr-deficit-badge">-{summary.totalDeficit}</strong>
                  ) : (
                    <span className="sr-muted">—</span>
                  )}
                </td>
                <td className="sr-td-center" colSpan={2}>
                  <strong className="sr-realized-total">Réalisé : {summary.realized}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {error && <p className="sr-error">{error}</p>}

        <div className="sr-preview-actions">
          <button className="sr-btn sr-btn--secondary" onClick={() => setStep('form')}>
            ← Modifier
          </button>
          <button
            className="sr-btn sr-btn--danger"
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? 'Application en cours…' : 'Confirmer le retrait'}
          </button>
        </div>
      </div>
    );
  };

  const renderDone = () => {
    if (!applyResult || !summary) return null;
    return (
      <div className="sr-done">
        <div className="sr-done-icon">
          {applyResult.failed === 0 ? '✅' : '⚠️'}
        </div>
        <h2 className="sr-done-title">
          {applyResult.failed === 0
            ? 'Retraits appliqués avec succès'
            : 'Retraits appliqués avec des erreurs'}
        </h2>
        <div className="sr-done-cards">
          <div className="sr-done-card sr-done-card--success">
            <span>{applyResult.success}</span>
            <label>Succès</label>
          </div>
          <div className="sr-done-card sr-done-card--fail">
            <span>{applyResult.failed}</span>
            <label>Échecs</label>
          </div>
          <div className="sr-done-card sr-done-card--realized">
            <span>{summary.realized}</span>
            <label>Réalisé</label>
          </div>
        </div>
        {applyResult.errors.length > 0 && (
          <div className="sr-done-errors">
            <p className="sr-done-errors-title">Détail des erreurs :</p>
            <ul>
              {applyResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <button className="sr-btn sr-btn--primary" onClick={handleReset}>
          Nouveau retrait
        </button>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────

  return (
    <div className="sr-page">
      {/* Header */}
      <div className="sr-header">
        <h1 className="sr-title">Retrait de stock par catégorie</h1>
        <p className="sr-subtitle">
          Sélectionnez une catégorie et une quantité à retirer de chaque produit.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="sr-steps">
        {(['form', 'preview', 'done'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`sr-step ${step === s ? 'sr-step--active' : ''} ${
              ['form', 'preview', 'done'].indexOf(step) > i ? 'sr-step--done' : ''
            }`}
          >
            <div className="sr-step-dot">{i + 1}</div>
            <span className="sr-step-label">
              {s === 'form' ? 'Paramètres' : s === 'preview' ? 'Aperçu' : 'Confirmé'}
            </span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="sr-content">
        {step === 'form' && renderForm()}
        {step === 'preview' && renderPreview()}
        {step === 'done' && renderDone()}
      </div>
    </div>
  );
};

export default StockRemove;
