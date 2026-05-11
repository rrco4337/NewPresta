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

  // Quand l'utilisateur choisit un nouveau statut dans le select
  const handleSelectChange = (order: PSOrder, newValue: string) => {
    setPendingChange({ order, newValue: parseInt(newValue, 10) });
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
        <span className="orders-count">{orders.length} commande(s)</span>
      </div>

      {error && <p className="orders-error">{error}</p>}

      {loading && orders.length === 0 ? (
        <div className="orders-loading">Chargement des commandes…</div>
      ) : orders.length === 0 ? (
        <div className="orders-empty">Aucune commande trouvée.</div>
      ) : (
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>N° commande</th>
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

                return (
                  <tr key={order.id}>
                    <td className="orders-cell-ref">#{order.reference || order.id}</td>
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
                        {/* Option placeholder si statut courant n'est pas dans ALLOWED */}
                        {!ALLOWED_PS_STATES.some((o) => String(o.value) === currentValue) && (
                          <option value={currentValue} disabled>
                            {psStatusLabel(order.currentState)}
                          </option>
                        )}
                        {ALLOWED_PS_STATES.map((opt) => (
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
