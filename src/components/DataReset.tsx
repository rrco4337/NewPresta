import React, { useState } from 'react';
import {
  cleanCombinations,
  cleanProducts,
  cleanCategories,
  cleanCustomers,
  cleanAddresses,
  cleanSuppliers,
  cleanBrands,
  type CleanResult,
} from '../services/otherImportService';
import { clearLocalOrders } from '../services/orderService';
import './DataReset.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface StepResult {
  label: string;
  result: CleanResult | null;
  error?: string;
}

type ResetPhase = 'idle' | 'confirm' | 'running' | 'done';

// ── Étapes de suppression dans l'ordre correct ────────────────────────────────
const RESET_STEPS: Array<{
  label: string;
  run: (cb: (done: number, total: number) => void) => Promise<CleanResult>;
}> = [
  { label: 'Déclinaisons',  run: (cb) => cleanCombinations(cb) },
  { label: 'Produits',      run: (cb) => cleanProducts(cb) },
  { label: 'Catégories',    run: (cb) => cleanCategories(cb) },
  { label: 'Clients',       run: (cb) => cleanCustomers(cb) },
  { label: 'Adresses',      run: (cb) => cleanAddresses(cb) },
  { label: 'Fournisseurs',  run: (cb) => cleanSuppliers(cb) },
  { label: 'Marques',       run: (cb) => cleanBrands(cb) },
];

// ── Composant ─────────────────────────────────────────────────────────────────

const DataReset: React.FC = () => {
  const [phase, setPhase]           = useState<ResetPhase>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0); // 0-100
  const [stepResults, setStepResults]   = useState<StepResult[]>([]);

  const totalSteps = RESET_STEPS.length + 1; // +1 for local orders

  const handleConfirm = () => setPhase('confirm');
  const handleCancel  = () => setPhase('idle');

  const handleReset = async () => {
    setPhase('running');
    setCurrentStep(0);
    setStepProgress(0);
    setStepResults([]);

    const results: StepResult[] = [];

    for (let i = 0; i < RESET_STEPS.length; i++) {
      const step = RESET_STEPS[i];
      setCurrentStep(i);
      setStepProgress(0);

      try {
        const res = await step.run((done, total) => {
          setStepProgress(total > 0 ? Math.round((done / total) * 100) : 0);
        });
        results.push({ label: step.label, result: res });
      } catch (err) {
        results.push({
          label: step.label,
          result: null,
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }

      setStepResults([...results]);
    }

    // Dernière étape : commandes locales
    setCurrentStep(RESET_STEPS.length);
    setStepProgress(100);
    clearLocalOrders();
    results.push({ label: 'Commandes locales', result: { total: 0, deleted: 0, errors: 0 } });
    setStepResults([...results]);

    setPhase('done');
  };

  const handleRetry = () => {
    setPhase('idle');
    setStepResults([]);
  };

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (phase === 'confirm') {
    return (
      <div className="reset-page">
        <div className="reset-confirm-card">
          <div className="reset-confirm-icon">!</div>
          <h2 className="reset-confirm-title">Confirmer la réinitialisation</h2>
          <p className="reset-confirm-text">
            Cette action va supprimer <strong>toutes les données</strong> de la boutique PrestaShop
            (produits, catégories, clients, adresses, fournisseurs, marques, déclinaisons)
            ainsi que les commandes locales. Elle est <strong>irréversible</strong>.
          </p>
          <div className="reset-confirm-actions">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Annuler
            </button>
            <button className="btn btn-danger-large" onClick={handleReset}>
              Oui, tout supprimer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    const globalPct = Math.round((currentStep / totalSteps) * 100);
    const currentLabel = currentStep < RESET_STEPS.length
      ? RESET_STEPS[currentStep].label
      : 'Commandes locales';

    return (
      <div className="reset-page">
        <div className="reset-running-card">
          <div className="reset-spinner" aria-hidden="true" />
          <h2 className="reset-running-title">Réinitialisation en cours…</h2>

          {/* Étape courante */}
          <div className="reset-step-info">
            <span className="reset-step-label">Suppression : <strong>{currentLabel}</strong></span>
            <div className="reset-progress-bar">
              <div className="reset-progress-fill" style={{ width: `${stepProgress}%` }} />
            </div>
            <span className="reset-step-pct">{stepProgress}%</span>
          </div>

          {/* Progression globale */}
          <div className="reset-global-info">
            <span className="reset-global-label">Étape {currentStep + 1} / {totalSteps}</span>
            <div className="reset-progress-bar reset-progress-bar--global">
              <div className="reset-progress-fill reset-progress-fill--global" style={{ width: `${globalPct}%` }} />
            </div>
          </div>

          {/* Étapes terminées */}
          {stepResults.length > 0 && (
            <div className="reset-steps-done">
              {stepResults.map((s) => (
                <div key={s.label} className={`reset-step-row${s.error ? ' reset-step-row--error' : ' reset-step-row--ok'}`}>
                  <span className="reset-step-dot">{s.error ? '✗' : '✓'}</span>
                  <span className="reset-step-name">{s.label}</span>
                  {s.result && (
                    <span className="reset-step-count">{s.result.deleted} supprimé(s)</span>
                  )}
                  {s.error && <span className="reset-step-err">{s.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const totalDeleted = stepResults.reduce((n, s) => n + (s.result?.deleted ?? 0), 0);
    const totalErrors  = stepResults.reduce((n, s) => n + (s.result?.errors ?? 0) + (s.error ? 1 : 0), 0);

    return (
      <div className="reset-page">
        <div className="reset-done-card">
          <div className={`reset-done-icon${totalErrors > 0 ? ' reset-done-icon--warn' : ''}`}>
            {totalErrors > 0 ? '!' : '✓'}
          </div>
          <h2 className="reset-done-title">
            {totalErrors > 0 ? 'Réinitialisation partielle' : 'Réinitialisation terminée'}
          </h2>

          <div className="reset-done-stats">
            <div className="reset-done-stat reset-done-stat--ok">
              <span className="reset-done-stat-value">{totalDeleted}</span>
              <span className="reset-done-stat-label">Éléments supprimés</span>
            </div>
            {totalErrors > 0 && (
              <div className="reset-done-stat reset-done-stat--err">
                <span className="reset-done-stat-value">{totalErrors}</span>
                <span className="reset-done-stat-label">Erreurs</span>
              </div>
            )}
          </div>

          <div className="reset-steps-done">
            {stepResults.map((s) => (
              <div key={s.label} className={`reset-step-row${s.error ? ' reset-step-row--error' : ' reset-step-row--ok'}`}>
                <span className="reset-step-dot">{s.error ? '✗' : '✓'}</span>
                <span className="reset-step-name">{s.label}</span>
                {s.result && (
                  <span className="reset-step-count">{s.result.deleted} supprimé(s)</span>
                )}
                {s.error && <span className="reset-step-err">{s.error}</span>}
              </div>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={handleRetry}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  // ── Phase idle ───────────────────────────────────────────────────────────────
  return (
    <div className="reset-page">
      <div className="reset-idle-card">
        <div className="reset-warning-banner">
          <span className="reset-warning-icon">!</span>
          <div>
            <p className="reset-warning-title">Zone de danger</p>
            <p className="reset-warning-text">
              Cette opération supprime toutes les données de la boutique : produits, catégories,
              clients, adresses, fournisseurs, marques et déclinaisons. Les commandes locales sont
              également effacées. Cette action est <strong>irréversible</strong>.
            </p>
          </div>
        </div>

        <div className="reset-entity-list">
          <h3 className="reset-entity-title">Données qui seront supprimées</h3>
          <ul className="reset-entity-items">
            {RESET_STEPS.map((s) => (
              <li key={s.label} className="reset-entity-item">
                <span className="reset-entity-dot" />
                {s.label}
              </li>
            ))}
            <li className="reset-entity-item">
              <span className="reset-entity-dot" />
              Commandes locales (localStorage)
            </li>
          </ul>
        </div>

        <button className="btn btn-danger-large" onClick={handleConfirm}>
          Réinitialiser toutes les données
        </button>
      </div>
    </div>
  );
};

export default DataReset;
