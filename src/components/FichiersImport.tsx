import React, { useState, useRef } from 'react';
import {
  importFichier1,
  importFichier2,
  importFichier3,
  importImagesZip,
  prevalidateFichiersImport,
  type FichierImportResult,
  type ImageImportResult,
} from '../services/fichierImportService';
import './FichiersImport.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZoneState {
  file: File | null;
  phase: 'idle' | 'running' | 'done' | 'error';
  progress: number;
  progressLabel: string;
  results: FichierImportResult[] | ImageImportResult[];
}

const INITIAL_ZONE: ZoneState = {
  file: null,
  phase: 'idle',
  progress: 0,
  progressLabel: '',
  results: [],
};

// ── Dropzone simple ───────────────────────────────────────────────────────────

interface DropzoneProps {
  accept: string;
  label: string;
  sublabel: string;
  file: File | null;
  disabled?: boolean;
  onChange: (f: File) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ accept, label, sublabel, file, disabled, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onChange(f);
  };

  return (
    <div
      className={`fz-dropzone${over ? ' fz-dropzone--over' : ''}${disabled ? ' fz-dropzone--disabled' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="fz-file-input"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }}
      />
      <svg className="fz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 0l-3 3m3-3l3 3"/>
      </svg>
      {file ? (
        <p className="fz-filename">{file.name}</p>
      ) : (
        <>
          <p className="fz-label">{label}</p>
          <p className="fz-sublabel">{sublabel}</p>
        </>
      )}
    </div>
  );
};

// ── Résultats génériques ───────────────────────────────────────────────────────

interface ResultsTableProps {
  results: FichierImportResult[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  const ok  = results.filter((r) => r.success).length;
  const err = results.filter((r) => !r.success).length;

  return (
    <div className="fz-results">
      <div className="fz-stats">
        <div className="fz-stat fz-stat--total"><span className="fz-stat-val">{results.length}</span><span className="fz-stat-lbl">Total</span></div>
        <div className="fz-stat fz-stat--ok">   <span className="fz-stat-val">{ok}</span>           <span className="fz-stat-lbl">Succès</span></div>
        {err > 0 && <div className="fz-stat fz-stat--err"><span className="fz-stat-val">{err}</span><span className="fz-stat-lbl">Erreurs</span></div>}
      </div>
      {err > 0 && (
        <div className="fz-table-wrapper">
          <table className="fz-table">
            <thead><tr><th>N° CSV</th><th>Entrée</th><th>Statut</th><th>Détail</th></tr></thead>
            <tbody>
              {results.filter((r) => !r.success).map((r, i) => (
                <tr key={i} className="fz-row--err">
                  <td className="fz-line-num">{r.lineNumber != null ? `L.${r.lineNumber}` : '—'}</td>
                  <td>{r.label}</td>
                  <td><span className="fz-badge fz-badge--err">Erreur</span></td>
                  <td className="fz-detail">{r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface ImageResultsTableProps {
  results: ImageImportResult[];
}

const ImageResultsTable: React.FC<ImageResultsTableProps> = ({ results }) => {
  const ok  = results.filter((r) => r.success).length;
  const err = results.filter((r) => !r.success).length;
  const skip = 0;

  return (
    <div className="fz-results">
      <div className="fz-stats">
        <div className="fz-stat fz-stat--total"><span className="fz-stat-val">{results.length}</span><span className="fz-stat-lbl">Total</span></div>
        <div className="fz-stat fz-stat--ok">   <span className="fz-stat-val">{ok}</span>            <span className="fz-stat-lbl">Succès</span></div>
        {skip > 0 && <div className="fz-stat fz-stat--skip"><span className="fz-stat-val">{skip}</span><span className="fz-stat-lbl">Ignorés</span></div>}
        {err  > 0 && <div className="fz-stat fz-stat--err"><span className="fz-stat-val">{err}</span> <span className="fz-stat-lbl">Erreurs</span></div>}
      </div>
    </div>
  );
};

// ── Progress bar ──────────────────────────────────────────────────────────────

interface ProgressProps {
  pct: number;
  label: string;
}

const ProgressBar: React.FC<ProgressProps> = ({ pct, label }) => (
  <div className="fz-progress-block">
    <p className="fz-progress-label">{label || 'Traitement…'}</p>
    <div className="fz-progress-bar">
      <div className="fz-progress-fill" style={{ width: `${pct}%` }} />
    </div>
    <span className="fz-progress-pct">{pct}%</span>
  </div>
);

// ── Composant principal ───────────────────────────────────────────────────────

const FichiersImport: React.FC = () => {
  const [z1, setZ1] = useState<ZoneState>(INITIAL_ZONE);
  const [z2, setZ2] = useState<ZoneState>(INITIAL_ZONE);
  const [z3, setZ3] = useState<ZoneState>(INITIAL_ZONE);
  const [zImg, setZImg] = useState<ZoneState>(INITIAL_ZONE);
  const [formPhase, setFormPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [formError, setFormError] = useState('');

  const allIdle = [z1, z2, z3, zImg].every((z) => z.phase === 'idle');
  const hasAllFiles = Boolean(z1.file && z2.file && z3.file && zImg.file);
  const inputsLocked = formPhase === 'running' || !allIdle;

  // ── Helpers run ───────────────────────────────────────────────────────────────

  const runFichier1 = async (): Promise<boolean> => {
    if (!z1.file || z1.phase === 'running') return false;
    setZ1((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: '', results: [] }));
    try {
      const results = await importFichier1(z1.file, (done, total, label) => {
        setZ1((p) => ({
          ...p,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
          progressLabel: label,
        }));
      });
      setZ1((p) => ({ ...p, phase: 'done', progress: 100, results }));
      return true;
    } catch (e) {
      setZ1((p) => ({ ...p, phase: 'error', progressLabel: String(e) }));
      return false;
    }
  };

  const runFichier2 = async (): Promise<boolean> => {
    if (!z2.file || z2.phase === 'running') return false;
    setZ2((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: '', results: [] }));
    try {
      const results = await importFichier2(z2.file, (done, total, label) => {
        setZ2((p) => ({
          ...p,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
          progressLabel: label,
        }));
      });
      setZ2((p) => ({ ...p, phase: 'done', progress: 100, results }));
      return true;
    } catch (e) {
      setZ2((p) => ({ ...p, phase: 'error', progressLabel: String(e) }));
      return false;
    }
  };

  const runFichier3 = async (): Promise<boolean> => {
    if (!z3.file || z3.phase === 'running') return false;
    setZ3((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: '', results: [] }));
    try {
      const results = await importFichier3(z3.file, (done, total, label) => {
        setZ3((p) => ({
          ...p,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
          progressLabel: label,
        }));
      });
      setZ3((p) => ({ ...p, phase: 'done', progress: 100, results }));
      return true;
    } catch (e) {
      setZ3((p) => ({ ...p, phase: 'error', progressLabel: String(e) }));
      return false;
    }
  };

  const runImages = async (): Promise<boolean> => {
    if (!zImg.file || zImg.phase === 'running') return false;
    setZImg((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: '', results: [] }));
    try {
      const results = await importImagesZip(zImg.file, (done, total, label) => {
        setZImg((p) => ({
          ...p,
          progress: total > 0 ? Math.round((done / total) * 100) : 0,
          progressLabel: label,
        }));
      });
      setZImg((p) => ({ ...p, phase: 'done', progress: 100, results }));
      return true;
    } catch (e) {
      setZImg((p) => ({ ...p, phase: 'error', progressLabel: String(e) }));
      return false;
    }
  };

  const runPrevalidation = async (): Promise<boolean> => {
    if (!z1.file || !z2.file || !z3.file || !zImg.file) return false;

    setZ1((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: 'Pré-validation…', results: [] }));
    setZ2((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: 'Pré-validation…', results: [] }));
    setZ3((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: 'Pré-validation…', results: [] }));
    setZImg((p) => ({ ...p, phase: 'running', progress: 0, progressLabel: 'Pré-validation…', results: [] }));

    const validation = await prevalidateFichiersImport(
      { fichier1: z1.file, fichier2: z2.file, fichier3: z3.file, images: zImg.file },
      {
        fichier1: (done, total, label) => {
          setZ1((p) => ({
            ...p,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
            progressLabel: label,
          }));
        },
        fichier2: (done, total, label) => {
          setZ2((p) => ({
            ...p,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
            progressLabel: label,
          }));
        },
        fichier3: (done, total, label) => {
          setZ3((p) => ({
            ...p,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
            progressLabel: label,
          }));
        },
        images: (done, total, label) => {
          setZImg((p) => ({
            ...p,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
            progressLabel: label,
          }));
        },
      },
    );

    setZ1((p) => ({ ...p, phase: 'done', progress: 100, results: validation.fichier1 }));
    setZ2((p) => ({ ...p, phase: 'done', progress: 100, results: validation.fichier2 }));
    setZ3((p) => ({ ...p, phase: 'done', progress: 100, results: validation.fichier3 }));
    setZImg((p) => ({ ...p, phase: 'done', progress: 100, results: validation.images }));

    if (validation.hasErrors) {
      setFormError('Pré-validation échouée : aucune donnée n\'a été importée.');
      return false;
    }
    return true;
  };

  const resetAll = () => {
    setZ1(INITIAL_ZONE);
    setZ2(INITIAL_ZONE);
    setZ3(INITIAL_ZONE);
    setZImg(INITIAL_ZONE);
    setFormPhase('idle');
    setFormError('');
  };

  const runAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPhase === 'running') return;
    setFormError('');

    if (!hasAllFiles) {
      setFormError('Veuillez sélectionner les 4 fichiers avant de lancer l\'import.');
      return;
    }

    if (!allIdle) {
      setFormError('Réinitialisez le formulaire avant de relancer un import complet.');
      return;
    }

    setFormPhase('running');
    const prevalidationOk = await runPrevalidation();
    if (!prevalidationOk) { setFormPhase('error'); return; }

    const ok1 = await runFichier1();
    if (!ok1) { setFormPhase('error'); return; }

    const ok2 = await runFichier2();
    if (!ok2) { setFormPhase('error'); return; }

    const ok3 = await runFichier3();
    if (!ok3) { setFormPhase('error'); return; }

    const okImg = await runImages();
    if (!okImg) { setFormPhase('error'); return; }

    setFormPhase('done');
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="fz-page">
      <form className="fz-form" onSubmit={runAll}>
        {/* ── Fichier 1 : produits ─────────────────────────────────────────────── */}
        <section className="fz-section">
        <div className="fz-section-header">
          <div className="fz-section-title-group">
            <span className="fz-step-badge">1</span>
            <div>
              <h2 className="fz-section-title">Fichier 1 — Produits</h2>
              <p className="fz-section-sub">Colonnes : <code>date_produit, nom, reference, prix_ttc, taxe, categorie, prix_achat</code></p>
            </div>
          </div>
        </div>

        {z1.phase === 'running' ? (
          <ProgressBar pct={z1.progress} label={z1.progressLabel} />
        ) : z1.phase === 'done' ? (
          <>
            <ResultsTable results={z1.results as FichierImportResult[]} />
            <button className="btn btn-secondary fz-reset-btn" onClick={() => setZ1(INITIAL_ZONE)}>
              Réimporter
            </button>
          </>
        ) : z1.phase === 'error' ? (
          <div className="fz-error-msg">Erreur : {z1.progressLabel}</div>
        ) : (
          <Dropzone
            accept=".csv,text/csv"
            label="Glisser le fichier CSV produits ici"
            sublabel="fichier1.csv"
            file={z1.file}
            disabled={inputsLocked}
            onChange={(f) => setZ1((p) => ({ ...p, file: f }))}
          />
        )}
        </section>

        {/* ── Fichier 2 : déclinaisons / stock ─────────────────────────────────── */}
        <section className="fz-section">
          <div className="fz-section-header">
            <div className="fz-section-title-group">
              <span className="fz-step-badge">2</span>
              <div>
                <h2 className="fz-section-title">Fichier 2 — Déclinaisons &amp; Stock</h2>
                <p className="fz-section-sub">Colonnes : <code>reference, specificité, karazany, stock_initial, prix_vente_ttc</code></p>
              </div>
            </div>
          </div>

          {z2.phase === 'running' ? (
            <ProgressBar pct={z2.progress} label={z2.progressLabel} />
          ) : z2.phase === 'done' ? (
            <ResultsTable results={z2.results as FichierImportResult[]} />
          ) : z2.phase === 'error' ? (
            <div className="fz-error-msg">Erreur : {z2.progressLabel}</div>
          ) : (
            <Dropzone
              accept=".csv,text/csv"
              label="Glisser le fichier CSV déclinaisons ici"
              sublabel="fichier2.csv"
              file={z2.file}
              disabled={inputsLocked}
              onChange={(f) => setZ2((p) => ({ ...p, file: f }))}
            />
          )}
        </section>

        {/* ── Fichier 3 : clients / commandes ──────────────────────────────────── */}
        <section className="fz-section">
        <div className="fz-section-header">
          <div className="fz-section-title-group">
            <span className="fz-step-badge">3</span>
            <div>
              <h2 className="fz-section-title">Fichier 3 — Clients &amp; Commandes</h2>
              <p className="fz-section-sub">Colonnes : <code>date, nom, email, pwd, adresse, achat, etat</code></p>
            </div>
          </div>
        </div>

        {z3.phase === 'running' ? (
          <ProgressBar pct={z3.progress} label={z3.progressLabel} />
        ) : z3.phase === 'done' ? (
          <>
            <ResultsTable results={z3.results as FichierImportResult[]} />
            <button className="btn btn-secondary fz-reset-btn" onClick={() => setZ3(INITIAL_ZONE)}>
              Réimporter
            </button>
          </>
        ) : z3.phase === 'error' ? (
          <div className="fz-error-msg">Erreur : {z3.progressLabel}</div>
        ) : (
          <Dropzone
            accept=".csv,text/csv"
            label="Glisser le fichier CSV clients ici"
            sublabel="fichier3.csv"
            file={z3.file}
            disabled={inputsLocked}
            onChange={(f) => setZ3((p) => ({ ...p, file: f }))}
          />
        )}
        </section>

        {/* ── Images ZIP ───────────────────────────────────────────────────────── */}
        <section className="fz-section">
        <div className="fz-section-header">
          <div className="fz-section-title-group">
            <span className="fz-step-badge fz-step-badge--img">IMG</span>
            <div>
              <h2 className="fz-section-title">Images produits</h2>
              <p className="fz-section-sub">Archive ZIP contenant les images nommées par référence produit (ex: <code>T_01.png</code>)</p>
            </div>
          </div>
        </div>

        {zImg.phase === 'running' ? (
          <ProgressBar pct={zImg.progress} label={zImg.progressLabel} />
        ) : zImg.phase === 'done' ? (
          <ImageResultsTable results={zImg.results as ImageImportResult[]} />
        ) : zImg.phase === 'error' ? (
          <div className="fz-error-msg">Erreur : {zImg.progressLabel}</div>
        ) : (
          <Dropzone
            accept=".zip,application/zip"
            label="Glisser l'archive ZIP ici"
            sublabel="images.zip"
            file={zImg.file}
            disabled={inputsLocked}
            onChange={(f) => setZImg((p) => ({ ...p, file: f }))}
          />
        )}
        </section>

        {formError && <div className="fz-error-msg">{formError}</div>}
        {formPhase === 'done' && <div className="fz-success-msg">Import terminé avec succès.</div>}

        <div className="fz-form-actions">
          <button className="btn btn-secondary" type="button" onClick={resetAll} disabled={formPhase === 'running'}>
            Réinitialiser le formulaire
          </button>
          <button className="btn btn-primary" type="submit" disabled={!hasAllFiles || !allIdle || formPhase === 'running'}>
            {formPhase === 'running' ? 'Import en cours…' : 'Importer tous les fichiers'}
          </button>
        </div>
          <p className="fz-form-hint">
            Une pré-validation est lancée sur tous les fichiers. Si une erreur est détectée, rien n'est importé. Ensuite l'import s'exécute dans l'ordre 1 → 2 → 3 → Images.
          </p>
      </form>
    </div>
  );
};

export default FichiersImport;
