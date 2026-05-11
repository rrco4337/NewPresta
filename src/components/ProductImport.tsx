import React, { useRef, useState } from 'react';
import { parseCSV, validateAllRows, importProducts } from '../services/csvImportService';
import type { CsvRow, ImportResult, RowValidation } from '../services/csvImportService';
import { cleanProducts } from '../services/otherImportService';
import type { CleanResult } from '../services/otherImportService';
import './ProductImport.css';

// ── États de la page ──────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'importing' | 'done';

const ProductImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [dragOver, setDragOver] = useState(false);

  type CleanStatus = 'idle' | 'running' | 'done';
  const [cleanStatus,   setCleanStatus]   = useState<CleanStatus>('idle');
  const [cleanProgress, setCleanProgress] = useState({ done: 0, total: 0 });
  const [cleanResult,   setCleanResult]   = useState<CleanResult | null>(null);

  // ── Sélection / drag-drop du fichier ─────────────────────────────────────
  function handleFile(selectedFile: File) {
    if (!selectedFile.name.endsWith('.csv')) {
      alert('Veuillez sélectionner un fichier .csv');
      return;
    }

    setFile(selectedFile);

    selectedFile.text().then((content) => {
      const rows = parseCSV(content);
      setAllRows(rows);
      const vals = validateAllRows(rows);
      setValidations(vals);
      setStep('preview');
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  // ── Lancement de l'import ─────────────────────────────────────────────────
  async function handleImport() {
    if (!file) return;
    setStep('importing');
    setResults([]);
    setProgress({ done: 0, total: 0 });

    const importResults = await importProducts(file, (done, total) => {
      setProgress({ done, total });
    });

    setResults(importResults);
    setStep('done');
  }

  // ── Nettoyage produits ────────────────────────────────────────────────────
  async function handleCleanProducts() {
    const confirmed = window.confirm(
      'Supprimer TOUS les produits de la base de données ?\n\nCette action est irréversible.'
    );
    if (!confirmed) return;
    setCleanStatus('running');
    setCleanProgress({ done: 0, total: 0 });
    setCleanResult(null);
    try {
      const result = await cleanProducts((done, total) => setCleanProgress({ done, total }));
      setCleanResult(result);
    } catch {
      setCleanResult({ total: 0, deleted: 0, errors: 1 });
    }
    setCleanStatus('done');
  }

  // ── Réinitialisation ──────────────────────────────────────────────────────
  function handleReset() {
    setFile(null);
    setAllRows([]);
    setValidations([]);
    setProgress({ done: 0, total: 0 });
    setResults([]);
    setStep('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Stats de validation ───────────────────────────────────────────────────
  const errorCount = validations.filter((v) => v.errors.length > 0).length;
  const warningCount = validations.filter((v) => v.warnings.length > 0 && v.errors.length === 0).length;
  const validCount = validations.filter((v) => v.errors.length === 0).length;
  const hasBlockingErrors = errorCount > 0;

  // ── Stats du rapport ──────────────────────────────────────────────────────
  const reportSuccess = results.filter((r) => r.success).length;
  const reportErrors = results.filter((r) => !r.success).length;
  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="import-page">

      {/* ── ZONE DE DÉPÔT ── */}
      {(step === 'idle' || step === 'preview') && (
        <div
          className={`import-dropzone${dragOver ? ' import-dropzone--over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="import-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
          </svg>
          {file ? (
            <p className="import-dropzone-text">
              <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} Ko
            </p>
          ) : (
            <>
              <p className="import-dropzone-text">Glissez votre fichier CSV ici</p>
              <p className="import-dropzone-sub">ou cliquez pour parcourir</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="import-file-input"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* ── PRÉVISUALISATION AVEC VALIDATION ── */}
      {step === 'preview' && allRows.length > 0 && (
        <div className="import-preview">
          <h2 className="import-section-title">
            Pré-validation — {allRows.length} ligne{allRows.length > 1 ? 's' : ''} détectée{allRows.length > 1 ? 's' : ''}
          </h2>

          {/* Résumé de validation */}
          <div className="import-validation-summary">
            <div className="import-validation-chip import-validation-chip--valid">
              <span className="import-validation-chip-icon">✓</span>
              <span>{validCount} valide{validCount > 1 ? 's' : ''}</span>
            </div>
            {warningCount > 0 && (
              <div className="import-validation-chip import-validation-chip--warning">
                <span className="import-validation-chip-icon">⚠</span>
                <span>{warningCount} avertissement{warningCount > 1 ? 's' : ''}</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="import-validation-chip import-validation-chip--error">
                <span className="import-validation-chip-icon">✕</span>
                <span>{errorCount} erreur{errorCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {hasBlockingErrors && (
            <div className="import-blocking-banner">
              Corrigez les erreurs dans le fichier CSV avant de lancer l'import.
            </div>
          )}

          {/* Tableau complet avec erreurs ligne par ligne */}
          <div className="import-table-wrapper" style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <table className="import-table">
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Statut</th>
                  <th>Nom</th>
                  <th>Référence</th>
                  <th>Prix HT</th>
                  <th>Prix achat</th>
                  <th>Qté</th>
                  <th>Catégorie</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, i) => {
                  const v = validations[i];
                  const hasErrors = v && v.errors.length > 0;
                  const hasWarnings = v && v.warnings.length > 0 && !hasErrors;
                  const rowClass = hasErrors
                    ? 'import-row--error'
                    : hasWarnings
                      ? 'import-row--warning'
                      : 'import-row--valid';

                  return (
                    <React.Fragment key={i}>
                      <tr className={rowClass}>
                        <td>{i + 2}</td>
                        <td>
                          {hasErrors && (
                            <span className="import-badge import-badge--error">Erreur</span>
                          )}
                          {hasWarnings && (
                            <span className="import-badge import-badge--warning">Alerte</span>
                          )}
                          {!hasErrors && !hasWarnings && (
                            <span className="import-badge import-badge--success">OK</span>
                          )}
                        </td>
                        <td>{row.name}</td>
                        <td><code>{row.reference || '—'}</code></td>
                        <td>{row.price}</td>
                        <td>{row.wholesalePrice || '—'}</td>
                        <td>{row.quantity || '0'}</td>
                        <td>{row.categories || '—'}</td>
                        <td>
                          <span className={`import-badge ${row.active === '1' ? 'import-badge--success' : 'import-badge--muted'}`}>
                            {row.active === '1' ? 'Oui' : 'Non'}
                          </span>
                        </td>
                      </tr>
                      {/* Ligne d'erreurs/warnings en dessous */}
                      {v && (v.errors.length > 0 || v.warnings.length > 0) && (
                        <tr className={`${rowClass} import-detail-row`}>
                          <td></td>
                          <td colSpan={8}>
                            <ul className="import-error-list">
                              {v.errors.map((err, j) => (
                                <li key={`e-${j}`} className="import-error-item">
                                  <span className="import-error-icon">✕</span> {err}
                                </li>
                              ))}
                              {v.warnings.map((warn, j) => (
                                <li key={`w-${j}`} className="import-warning-item">
                                  <span className="import-warning-icon">⚠</span> {warn}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Changer de fichier
            </button>
            <button
              className={`btn btn-primary${hasBlockingErrors ? ' btn--disabled' : ''}`}
              onClick={handleImport}
              disabled={hasBlockingErrors}
              title={hasBlockingErrors ? 'Corrigez les erreurs avant de lancer l\'import' : ''}
            >
              Lancer l'import
            </button>
          </div>
        </div>
      )}

      {/* ── PROGRESSION ── */}
      {step === 'importing' && (
        <div className="import-progress-block">
          <p className="import-progress-label">
            Import en cours… {progress.done} / {progress.total}
          </p>
          <div className="import-progress-bar">
            <div
              className="import-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="import-progress-pct">{progressPercent}%</p>
        </div>
      )}

      {/* ── RAPPORT ── */}
      {step === 'done' && (
        <div className="import-report">
          <div className="import-stats">
            <div className="import-stat import-stat--success">
              <span className="import-stat-value">{reportSuccess}</span>
              <span className="import-stat-label">Importé{reportSuccess > 1 ? 's' : ''} avec succès</span>
            </div>
            <div className="import-stat import-stat--error">
              <span className="import-stat-value">{reportErrors}</span>
              <span className="import-stat-label">Erreur{reportErrors > 1 ? 's' : ''}</span>
            </div>
            <div className="import-stat import-stat--total">
              <span className="import-stat-value">{results.length}</span>
              <span className="import-stat-label">Total traité{results.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <h2 className="import-section-title">Détail ligne par ligne</h2>
          <div className="import-table-wrapper">
            <table className="import-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produit</th>
                  <th>Statut</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.rowIndex} className={r.success ? 'import-row--success' : 'import-row--error'}>
                    <td>{r.rowIndex + 2}</td>
                    <td>{r.productName}</td>
                    <td>
                      <span className={`import-badge ${r.success ? 'import-badge--success' : 'import-badge--error'}`}>
                        {r.success ? 'OK' : 'Erreur'}
                      </span>
                    </td>
                    <td className="import-detail">
                      {r.success
                        ? r.productId
                          ? `Créé (ID ${r.productId})`
                          : 'Créé'
                        : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Nouvel import
            </button>
          </div>
        </div>
      )}

      {/* ── ZONE DE NETTOYAGE PRODUITS ── */}
      <div className="import-danger-zone">
        <div className="import-danger-header">
          <span className="import-danger-title">Zone de nettoyage — Produits</span>
          <span className="import-danger-warning">
            Supprime <strong>tous les produits</strong> de la base via l'API PrestaShop.
            Cette action est irréversible.
          </span>
        </div>

        {cleanStatus === 'idle' && (
          <button className="btn btn-danger" onClick={handleCleanProducts}>
            Nettoyer les produits
          </button>
        )}

        {cleanStatus === 'running' && (
          <div className="import-progress-block" style={{ padding: '20px' }}>
            <p className="import-progress-label">
              Suppression… {cleanProgress.done} / {cleanProgress.total}
            </p>
            <div className="import-progress-bar">
              <div
                className="import-progress-fill"
                style={{
                  width: cleanProgress.total > 0
                    ? `${Math.round((cleanProgress.done / cleanProgress.total) * 100)}%`
                    : '0%',
                  background: '#ef4444',
                }}
              />
            </div>
          </div>
        )}

        {cleanStatus === 'done' && cleanResult && (
          <div className="import-clean-result">
            <span className="import-clean-ok">{cleanResult.deleted} supprimé{cleanResult.deleted > 1 ? 's' : ''}</span>
            {cleanResult.errors > 0 && (
              <span className="import-clean-err">{cleanResult.errors} erreur{cleanResult.errors > 1 ? 's' : ''}</span>
            )}
            <button className="btn btn-secondary" style={{ marginLeft: 'auto' }}
              onClick={() => { setCleanStatus('idle'); setCleanResult(null); }}>
              Réinitialiser
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImport;
