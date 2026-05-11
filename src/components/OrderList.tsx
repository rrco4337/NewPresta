import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchPSOrders,
  getLocalOrders,
  updateLocalOrderStatus,
  updatePSOrderStatus,
  localStatusLabel,
  ALLOWED_PS_STATES,
  ALLOWED_LOCAL_STATUSES,
  PS_STATE_LABELS,
  type AnyOrder,
  type LocalOrder,
  type PSOrder,
  type LocalOrderStatus,
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

function orderStatusClass(order: AnyOrder): string {
  if (order.source === 'local') {
    const s = (order as LocalOrder).status;
    if (s === 'paid')      return 'status-badge--paid';
    if (s === 'error')     return 'status-badge--error';
    if (s === 'cancelled') return 'status-badge--cancelled';
    return 'status-badge--pending';
  }
  const state = (order as PSOrder).currentState;
  if (state === 2) return 'status-badge--paid';
  if (state === 8) return 'status-badge--error';
  if (state === 6) return 'status-badge--cancelled';
  return 'status-badge--default';
}

function orderLabel(order: AnyOrder): string {
  if (order.source === 'local') return localStatusLabel((order as LocalOrder).status);
  return psStatusLabel((order as PSOrder).currentState);
}

function orderId(order: AnyOrder): string {
  return order.source === 'local' ? `LOC-${order.id}` : `#${(order as PSOrder).reference || order.id}`;
}

function orderDate(order: AnyOrder): string {
  return formatDate(order.date);
}

function orderCustomer(order: AnyOrder): string {
  return order.source === 'local'
    ? (order as LocalOrder).customerName
    : (order as PSOrder).customerName;
}

function orderAmount(order: AnyOrder): string {
  return order.source === 'local'
    ? formatAmount((order as LocalOrder).totalTTC)
    : formatAmount((order as PSOrder).totalPaid);
}

// ── Composant ─────────────────────────────────────────────────────────────────

const OrderList: React.FC = () => {
  const [orders, setOrders]         = useState<AnyOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Sélection en attente de confirmation
  const [pendingChange, setPendingChange] = useState<{
    order: AnyOrder;
    newValue: string; // LocalOrderStatus | string(number) for PS
  } | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ps, local] = await Promise.all([fetchPSOrders(), Promise.resolve(getLocalOrders())]);
      const all: AnyOrder[] = [
        ...ps,
        ...local,
      ];
      // Sort by date descending
      all.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      setOrders(all);
    } catch (e) {
      setError('Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Quand l'utilisateur choisit un nouveau statut dans le select
  const handleSelectChange = (order: AnyOrder, newValue: string) => {
    setPendingChange({ order, newValue });
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    setApplying(true);
    const { order, newValue } = pendingChange;

    if (order.source === 'local') {
      updateLocalOrderStatus(order.id, newValue as LocalOrderStatus);
      setOrders((prev) =>
        prev.map((o) =>
          o.source === 'local' && o.id === order.id
            ? { ...o, status: newValue as LocalOrderStatus }
            : o
        )
      );
    } else {
      const ok = await updatePSOrderStatus(order.id, parseInt(newValue, 10));
      if (ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.source === 'prestashop' && o.id === order.id
              ? { ...o, currentState: parseInt(newValue, 10) }
              : o
          )
        );
      }
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
              Modifier le statut de la commande <strong>{orderId(pendingChange.order)}</strong> ?
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
                <th>Source</th>
                <th>Statut</th>
                <th>Modifier</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const key = `${order.source}-${order.id}`;
                const allowedOptions = order.source === 'local'
                  ? ALLOWED_LOCAL_STATUSES.map((s) => ({ label: s.label, value: s.value }))
                  : ALLOWED_PS_STATES.map((s) => ({ label: s.label, value: String(s.value) }));

                const currentValue = order.source === 'local'
                  ? (order as LocalOrder).status
                  : String((order as PSOrder).currentState);

                return (
                  <tr key={key}>
                    <td className="orders-cell-ref">{orderId(order)}</td>
                    <td>{orderCustomer(order)}</td>
                    <td className="orders-cell-amount">{orderAmount(order)}</td>
                    <td>{orderDate(order)}</td>
                    <td>
                      <span className={`source-badge source-badge--${order.source}`}>
                        {order.source === 'local' ? 'Local' : 'PrestaShop'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${orderStatusClass(order)}`}>
                        {orderLabel(order)}
                      </span>
                    </td>
                    <td>
                      <select
                        className="orders-status-select"
                        value={currentValue}
                        onChange={(e) => handleSelectChange(order, e.target.value)}
                      >
                        {/* Option placeholder si statut courant n'est pas dans ALLOWED */}
                        {!allowedOptions.some((o) => String(o.value) === currentValue) && (
                          <option value={currentValue} disabled>
                            {orderLabel(order)}
                          </option>
                        )}
                        {allowedOptions.map((opt) => (
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
