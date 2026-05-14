import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchPSOrders,
  updatePSOrderStatus,
  ALLOWED_PS_STATES,
  PS_STATE_LABELS,
  type PSOrder,
} from '../services/orderService';
import './OrderList.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function psStatusLabel(state: number): string {
  return PS_STATE_LABELS[state] ?? `État ${state}`;
}

function orderStatusClass(state: number): string {
  // Nouvel état "dans le panier" (exemple: state = 1)
  if (state === 1) return 'status-badge--cart';
  if (state === 2) return 'status-badge--paid';
  if (state === 8) return 'status-badge--error';
  if (state === 6) return 'status-badge--cancelled';
  return 'status-badge--default';
}

// ── Composant ─────────────────────────────────────────────────────────────────

const OrderList: React.FC = () => {
  const [orders, setOrders]         = useState<PSOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Sélection en attente de confirmation
  const [pendingChange, setPendingChange] = useState<{
    order: PSOrder;
    newValue: number;
    oldValue: number;
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ps = await fetchPSOrders();
      // Sort by date descending
      ps.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      setOrders(ps);
    } catch {
      setError('Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Vérifier si la transition est autorisée
  const isTransitionAllowed = (oldState: number, newState: number): boolean => {
    // Règle: "dans le panier" (1) → paiement effectué (2) ou annulé (6) : OK
    if (oldState === 1 && (newState === 2 || newState === 6)) {
      return true;
    }
    // paiement effectué (2) → annulé (6) : OK
    if (oldState === 2 && newState === 6) {
      return true;
    }
    // annulé (6) → paiement effectué (2) : rare mais possible
    if (oldState === 6 && newState === 2) {
      return true;
    }
    // Même état : pas de changement
    if (oldState === newState) {
      return false;
    }
    // TOUT VERS "dans le panier" (1) : INTERDIT
    if (newState === 1) {
      return false;
    }
    // Autres cas non autorisés
    return false;
  };

  const handleSelectChange = (order: PSOrder, newValue: string) => {
    const newState = parseInt(newValue, 10);
    const oldState = order.currentState;
    
    // Vérifier si la transition est autorisée
    if (!isTransitionAllowed(oldState, newState)) {
      alert(`Transition impossible : "${psStatusLabel(oldState)}" → "${psStatusLabel(newState)}" n'est pas autorisée.`);
      return;
    }
    
    setPendingChange({ order, newValue: newState, oldValue: oldState });
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    setApplying(true);
    const { order, newValue } = pendingChange;

    const ok = await updatePSOrderStatus(order.id, newValue);
    if (ok) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, currentState: newValue }
            : o
        )
      );
    }

    setApplying(false);
    setPendingChange(null);
  };

  const handleCancelChange = () => setPendingChange(null);

  // Déterminer les options disponibles selon l'état actuel
  const getAvailableOptions = (currentState: number): { value: number; label: string }[] => {
    const allOptions = ALLOWED_PS_STATES;
    
    // Filtrer selon les transitions autorisées
    return allOptions.filter(opt => {
      // Même état : on le garde (option courante)
      if (opt.value === currentState) return true;
      // Vérifier si la transition est autorisée
      return isTransitionAllowed(currentState, opt.value);
    });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="orders-page">
      {/* Confirmation modale */}
      {pendingChange && (
        <div className="orders-modal-overlay">
          <div className="orders-modal">
            <h3 className="orders-modal-title">Confirmer le changement</h3>
            <p className="orders-modal-text">
              Modifier le statut de la commande <strong>#{pendingChange.order.reference || pendingChange.order.id}</strong> ?
            </p>
            <div className="orders-modal-state-change">
              <span className="old-state">{psStatusLabel(pendingChange.oldValue)}</span>
              <span className="arrow">→</span>
              <span className="new-state">{psStatusLabel(pendingChange.newValue)}</span>
            </div>
            <div className="orders-modal-actions">
              <button className="btn btn-secondary" onClick={handleCancelChange} disabled={applying}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleConfirmChange} disabled={applying}>
                {applying ? 'En cours…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="orders-toolbar">
        <button className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
        <span className="orders-count">
          {orders.length} élément(s) ({orders.filter(o => o.currentState === 1).length} panier(s), {orders.filter(o => o.currentState === 2).length} payée(s), {orders.filter(o => o.currentState === 6).length} annulée(s))
        </span>
      </div>

      {error && <p className="orders-error">{error}</p>}

      {loading && orders.length === 0 ? (
        <div className="orders-loading">Chargement des commandes…</div>
      ) : orders.length === 0 ? (
        <div className="orders-empty">Aucune commande ou panier trouvé.</div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Montant TTC</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Modifier</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const currentValue = String(order.currentState);
                const availableOptions = getAvailableOptions(order.currentState);

                return (
                  <tr key={order.id} className={order.currentState === 1 ? 'order-row--cart' : ''}>
                    <td className="orders-cell-ref">
                      {order.currentState === 1 && <span className="cart-icon">🛒</span>}
                      #{order.reference || order.id}
                    </td>
                    <td>{order.customerName}</td>
                    <td className="orders-cell-amount">{formatAmount(order.totalPaid)}</td>
                    <td>{formatDate(order.date)}</td>
                    <td>
                      <span className={`status-badge ${orderStatusClass(order.currentState)}`}>
                        {psStatusLabel(order.currentState)}
                      </span>
                    </td>
                    <td>
                      <select
                        className="orders-status-select"
                        value={currentValue}
                        onChange={(e) => handleSelectChange(order, e.target.value)}
                      >
                        {availableOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrderList;