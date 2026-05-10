import React, { useRef, useState } from 'react';
import {
  parseCategoryCsv,    importCategories,    cleanCategories,
  parseCustomerCsv,    importCustomers,     cleanCustomers,
  parseAddressCsv,     importAddresses,     cleanAddresses,
  parseSupplierCsv,    importSuppliers,     cleanSuppliers,
  parseBrandCsv,       importBrands,        cleanBrands,
  parseCombinationCsv, importCombinations,  cleanCombinations,
} from '../services/otherImportService';
import type { ImportResult, CleanResult } from '../services/otherImportService';
import './ProductImport.css';

// ── Types d'import disponibles ────────────────────────────────────────────────

type ImportType = 'categories' | 'customers' | 'addresses' | 'suppliers' | 'brands' | 'combinations';

interface ImportConfig {
  label: string;
  endpoint: string;
  previewHeaders: string[];
  parse: (content: string) => Record<string, string>[];
  run:   (file: File, onProgress: (d: number, t: number) => void) => Promise<ImportResult[]>;
  clean: (onProgress?: (d: number, t: number) => void) => Promise<CleanResult>;
}

const IMPORT_TYPES: Record<ImportType, ImportConfig> = {
  categories: {
    label: 'Catégories',
    endpoint: '/api/categories',
    previewHeaders: ['Nom', 'Parent', 'URL rewrite', 'Actif'],
    parse: (content) => parseCategoryCsv(content).map((r) => ({
      Nom: r.name, Parent: r.parentCategory,
      'URL rewrite': r.linkRewrite || r.name.toLowerCase().replace(/\s+/g, '-'),
      Actif: r.active === '1' ? 'Oui' : 'Non',
    })),
    run:   importCategories,
    clean: cleanCategories,
  },
  customers: {
    label: 'Clients',
    endpoint: '/api/customers',
    previewHeaders: ['Prénom', 'Nom', 'Email', 'Actif'],
    parse: (content) => parseCustomerCsv(content).map((r) => ({
      Prénom: r.firstName, Nom: r.lastName, Email: r.email,
      Actif: r.active === '1' ? 'Oui' : 'Non',
    })),
    run:   importCustomers,
    clean: cleanCustomers,
  },
  addresses: {
    label: 'Adresses',
    endpoint: '/api/addresses',
    previewHeaders: ['Prénom', 'Nom', 'Ville', 'Pays'],
    parse: (content) => parseAddressCsv(content).map((r) => ({
      Prénom: r.firstName, Nom: r.lastName, Ville: r.city, Pays: r.country,
    })),
    run:   importAddresses,
    clean: cleanAddresses,
  },
  suppliers: {
    label: 'Fournisseurs',
    endpoint: '/api/suppliers',
    previewHeaders: ['Nom', 'Actif'],
    parse: (content) => parseSupplierCsv(content).map((r) => ({
      Nom: r.name, Actif: r.active === '1' ? 'Oui' : 'Non',
    })),
    run:   importSuppliers,
    clean: cleanSuppliers,
  },
  brands: {
    label: 'Marques',
    endpoint: '/api/manufacturers',
    previewHeaders: ['Nom', 'Actif'],
    parse: (content) => parseBrandCsv(content).map((r) => ({
      Nom: r.name, Actif: r.active === '1' ? 'Oui' : 'Non',
    })),
    run:   importBrands,
    clean: cleanBrands,
  },
  combinations: {
    label: 'Déclinaisons',
    endpoint: '/api/combinations',
    previewHeaders: ['Produit ID', 'Attributs', 'Valeurs', 'Réf.'],
    parse: (content) => parseCombinationCsv(content).map((r) => ({
      'Produit ID': r.productId, Attributs: r.attributeSpec,
      Valeurs: r.valueSpec, 'Réf.': r.reference,
    })),
    run:   importCombinations,
    clean: cleanCombinations,
  },
};

type Step = 'idle' | 'preview' | 'importing' | 'done';

const CatalogImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importType,   setImportType]   = useState<ImportType>('categories');
  const [step,         setStep]         = useState<Step>('idle');
  const [file,         setFile]         = useState<File | null>(null);
  const [previewRows,  setPreviewRows]  = useState<Record<string, string>[]>([]);
  const [progress,     setProgress]     = useState({ done: 0, total: 0 });
  const [results,      setResults]      = useState<ImportResult[]>([]);
  const [dragOver,     setDragOver]     = useState(false);

  type CleanStatus = 'idle' | 'running' | 'done';
  const [cleanStatus,   setCleanStatus]   = useState<CleanStatus>('idle');
  const [cleanProgress, setCleanProgress] = useState({ done: 0, total: 0 });
  const [cleanResult,   setCleanResult]   = useState<CleanResult | null>(null);

  const config = IMPORT_TYPES[importType];

  // ── Sélection / drag-drop ──────────────────────────────────────────────────
  function handleFile(f: File) {
    if (!f.name.endsWith('.csv')) {
      alert('Veuillez sélectionner un fichier .csv');
      return;
    }
    setFile(f);
    f.text().then((content) => {
      setPreviewRows(config.parse(content).slice(0, 5));
      setStep('preview');
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!file) return;
    setStep('importing');
    setResults([]);
    setProgress({ done: 0, total: 0 });
    const res = await config.run(file, (done, total) => setProgress({ done, total }));
    setResults(res);
    setStep('done');
  }

  function handleReset() {
    setFile(null);
    setPreviewRows([]);
    setProgress({ done: 0, total: 0 });
    setResults([]);
    setStep('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleTypeChange(type: ImportType) {
    setImportType(type);
    handleReset();
    setCleanStatus('idle');
    setCleanResult(null);
  }

  async function handleClean() {
    const confirmed = window.confirm(
      `Supprimer TOUTES les entrées de type "${config.label}" de la base de données ?\n\nCette action est irréversible.`
    );
    if (!confirmed) return;
    setCleanStatus('running');
    setCleanProgress({ done: 0, total: 0 });
    setCleanResult(null);
    try {
      const result = await config.clean((done, total) => setCleanProgress({ done, total }));
      setCleanResult(result);
    } catch {
      setCleanResult({ total: 0, deleted: 0, errors: 1 });
    }
    setCleanStatus('done');
  }

  const successCount   = results.filter((r) => r.success).length;
  const errorCount     = results.filter((r) => !r.success).length;
  const progressPct    = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="import-page">

      {/* ── SÉLECTEUR DE TYPE ── */}
      <div className="import-type-selector">
        <label className="import-type-label">Type d'entité à importer</label>
        <div className="import-type-tabs">
          {(Object.keys(IMPORT_TYPES) as ImportType[]).map((type) => (
            <button
              key={type}
              className={`import-type-tab${importType === type ? ' import-type-tab--active' : ''}`}
              onClick={() => handleTypeChange(type)}
            >
              {IMPORT_TYPES[type].label}
            </button>
          ))}
        </div>
        <p className="import-type-hint">
          Endpoint : <code>{config.endpoint}</code>
        </p>
      </div>

      {/* ── ZONE DE DÉPÔT ── */}
      {(step === 'idle' || step === 'preview') && (
        <div
          className={`import-dropzone${dragOver ? ' import-dropzone--over' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
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
              <p className="import-dropzone-text">
                Glissez votre fichier <strong>{config.label}</strong> CSV ici
              </p>
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
          <h2 className="import-section-title">Aperçu — 5 premières lignes</h2>
          <div className="import-table-wrapper">
            <table className="import-table">
              <thead>
                <tr>
                  {config.previewHeaders.map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {config.previewHeaders.map((h) => (
                      <td key={h}>
                        {h === 'Actif' ? (
                          <span className={`import-badge ${row[h] === 'Oui' ? 'import-badge--success' : 'import-badge--muted'}`}>
                            {row[h]}
                          </span>
                        ) : (
                          <span title={row[h]} className="import-cell-truncate">{row[h]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>Changer de fichier</button>
            <button className="btn btn-primary"   onClick={handleImport}>Lancer l'import</button>
          </div>
        </div>
      )}

      {/* ── PROGRESSION ── */}
      {step === 'importing' && (
        <div className="import-progress-block">
          <p className="import-progress-label">
            Import {config.label} en cours… {progress.done} / {progress.total}
          </p>
          <div className="import-progress-bar">
            <div className="import-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="import-progress-pct">{progressPct}%</p>
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
                <tr><th>#</th><th>Entrée</th><th>Statut</th><th>Détail</th></tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.rowIndex} className={r.success ? 'import-row--success' : 'import-row--error'}>
                    <td>{r.rowIndex + 2}</td>
                    <td>{r.label}</td>
                    <td>
                      <span className={`import-badge ${r.success ? 'import-badge--success' : 'import-badge--error'}`}>
                        {r.success ? 'OK' : 'Erreur'}
                      </span>
                    </td>
                    <td className="import-detail">
                      {r.success ? (r.id ? `Créé (ID ${r.id})` : 'Créé') : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-actions">
            <button className="btn btn-secondary" onClick={handleReset}>Nouvel import</button>
          </div>
        </div>
      )}
      {/* ── ZONE DE NETTOYAGE ── */}
      <div className="import-danger-zone">
        <div className="import-danger-header">
          <span className="import-danger-title">Zone de nettoyage — {config.label}</span>
          <span className="import-danger-warning">
            Supprime toutes les entrées de type <strong>{config.label}</strong> via l'API.
            {importType === 'categories' && ' Les catégories Root (1) et Home (2) sont protégées.'}
          </span>
        </div>

        {cleanStatus === 'idle' && (
          <button className="btn btn-danger" onClick={handleClean}>
            Nettoyer les {config.label.toLowerCase()}
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

export default CatalogImport;
