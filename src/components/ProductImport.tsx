import React, { useRef, useState } from 'react';
import { parseCSV, importProducts } from '../services/csvImportService';
import type { CsvRow, ImportResult } from '../services/csvImportService';
import { cleanProducts } from '../services/otherImportService';
import type { CleanResult } from '../services/otherImportService';
import './ProductImport.css';

// ── États de la page ──────────────────────────────────────────────────────────
type Step = 'idle' | 'preview' | 'importing' | 'done';

const ProductImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
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
      setPreviewRows(rows.slice(0, 5));
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
    setPreviewRows([]);
    setProgress({ done: 0, total: 0 });
    setResults([]);
    setStep('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Stats du rapport ──────────────────────────────────────────────────────
  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;
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

      {/* ── PRÉVISUALISATION ── */}
      {step === 'preview' && previewRows.length > 0 && (
        <div className="import-preview">
          <h2 className="import-section-title">
            Aperçu — 5 premières lignes
          </h2>
          <div className="import-table-wrapper">
            <table className="import-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prix HT</th>
                  <th>Prix achat</th>
                  <th>Référence</th>
                  <th>Qté</th>
                  <th>Condition</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.name}</td>
                    <td>{row.price}</td>
                    <td>{row.wholesalePrice}</td>
                    <td>{row.reference}</td>
                    <td>{row.quantity}</td>
                    <td>{row.condition}</td>
                    <td>
                      <span className={`import-badge ${row.active === '1' ? 'import-badge--success' : 'import-badge--muted'}`}>
                        {row.active === '1' ? 'Oui' : 'Non'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              Changer de fichier
            </button>
            <button className="btn btn-primary" onClick={handleImport}>
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
              <span className="import-stat-value">{successCount}</span>
              <span className="import-stat-label">Importé{successCount > 1 ? 's' : ''} avec succès</span>
            </div>
            <div className="import-stat import-stat--error">
              <span className="import-stat-value">{errorCount}</span>
              <span className="import-stat-label">Erreur{errorCount > 1 ? 's' : ''}</span>
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
