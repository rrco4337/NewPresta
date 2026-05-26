import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomer } from '../contexts/CustomerContext';
import {
  getCustomerOrders,
  getOrderFullDetail,
  checkStockForRows,
  createPSCart,
  createPSOrder,
  type PSCustomerOrder,
  type OrderDetailRow,
  type StockCheckResult,
} from '../services/customerService';
import { updatePSOrderStatus } from '../services/orderService';
import { formatPrice } from '../services/shopService';
import './MyOrders.css';

const STATE_LABELS: Record<number, string> = {
  1: 'En attente',
  2: 'Paiement accepté',
  3: 'En préparation',
  4: 'Expédié',
  5: 'Livré',
  6: 'Annulé',
  7: 'Remboursé',
  8: 'Erreur paiement',
  13: 'En attente livraison',
};

const STATE_LEVEL: Record<number, string> = {
  1: 'pending', 2: 'success', 3: 'info', 4: 'info', 5: 'success',
  6: 'danger', 7: 'warning', 8: 'danger', 13: 'pending',
};

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === '0000-00-00 00:00:00') return '—';
  const d = new Date(dateStr.replace(' ', 'T'));
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MyOrders: React.FC = () => {
  const { customer } = useCustomer();
  const navigate = useNavigate();
  const [orders, setOrders]   = useState<PSCustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // État du panneau de duplication
  const [dupTarget, setDupTarget]             = useState<PSCustomerOrder | null>(null);
  const [dupTimes, setDupTimes]               = useState<number>(1);
  const [dupStep, setDupStep]                 = useState<'idle' | 'checking' | 'results' | 'creating' | 'done' | 'error'>('idle');
  const [dupStockResults, setDupStockResults] = useState<StockCheckResult[]>([]);
  const [dupOrderDetail, setDupOrderDetail]   = useState<{ rows: OrderDetailRow[]; addressId: string; carrierId: string } | null>(null);
  const [dupError, setDupError]               = useState<string>('');

  useEffect(() => {
    if (!customer) {
      navigate('/shop/auth?next=/shop/my-orders', { replace: true });
      return;
    }
    getCustomerOrders(customer.id)
      .then(setOrders)
      .catch(() => setError('Impossible de charger vos commandes.'))
      .finally(() => setLoading(false));
  }, [customer, navigate]);

  function handleOpenDuplicate(order: PSCustomerOrder) {
    setDupTarget(order);
    setDupTimes(1);
    setDupStep('idle');
    setDupStockResults([]);
    setDupOrderDetail(null);
    setDupError('');
  }

  function handleCancelDuplicate() {
    setDupTarget(null);
    setDupStep('idle');
  }

  async function handleCheckStock() {
    if (!dupTarget || dupTimes < 1) return;
    setDupStep('checking');
    setDupError('');

    const detail = await getOrderFullDetail(dupTarget.id);
    if (!detail || detail.rows.length === 0) {
      setDupError('Impossible de récupérer les détails de la commande. Réessayez plus tard.');
      setDupStep('error');
      return;
    }

    const stockResults = await checkStockForRows(detail.rows, dupTimes);
    setDupOrderDetail(detail);
    setDupStockResults(stockResults);
    setDupStep('results');
  }

  async function handleValidateDuplication() {
    if (!dupTarget || !dupOrderDetail || !customer) return;
    setDupStep('creating');
    setDupError('');

    try {
      const items = dupOrderDetail.rows.map(row => ({
        id:          row.productId,
        name:        row.productName,
        priceHt:     row.unitPriceTaxExcl,
        priceTtc:    row.unitPriceTaxIncl,
        taxRate:     0,
        qty:         row.quantity * dupTimes,
        attributeId: row.combinationId !== '0' ? row.combinationId : undefined,
      }));

      const cartId = await createPSCart(
        customer.id,
        dupOrderDetail.addressId,
        dupOrderDetail.carrierId,
        items
      );

      const orderId = await createPSOrder({
        customerId:   customer.id,
        addressId:    dupOrderDetail.addressId,
        cartId,
        carrierId:    dupOrderDetail.carrierId,
        items,
        shippingCost: 0,
      });

      // Passer en "Livré" (état 5) → déclenche la déduction automatique du stock
      await updatePSOrderStatus(orderId, 5);

      setDupStep('done');
      // Recharger la liste des commandes
      getCustomerOrders(customer.id).then(setOrders).catch(() => {});
    } catch {
      setDupError('Une erreur est survenue lors de la création de la commande. Réessayez plus tard.');
      setDupStep('error');
    }
  }

  return (
    <div className="myorders-page">
      <nav className="myorders-breadcrumb">
        <Link to="/shop">Boutique</Link>
        <span>/</span>
        <span>Mes commandes</span>
      </nav>

      <div className="myorders-header">
        <h1 className="myorders-title">Mes commandes</h1>
        <div className="myorders-header-right">
          {customer && (
            <span className="myorders-customer">
              {customer.firstname} {customer.lastname}
            </span>
          )}
          <Link to="/shop" className="myorders-new-btn">
            + Créer une nouvelle commande
          </Link>
        </div>
      </div>

      {loading && (
        <div className="myorders-loading">
          <div className="myorders-spinner" />
          <p>Chargement…</p>
        </div>
      )}

      {!loading && error && (
        <div className="myorders-error">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="myorders-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <p>Vous n'avez pas encore de commandes.</p>
          <Link to="/shop" className="myorders-shop-btn">Découvrir nos produits</Link>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="myorders-table-wrap">
          <table className="myorders-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Total</th>
                <th>Paiement</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>
                    <span className="order-ref">{order.reference}</span>
                  </td>
                  <td>{formatDate(order.dateAdd)}</td>
                  <td>
                    <span className={`order-badge order-badge--${STATE_LEVEL[order.currentState] ?? 'pending'}`}>
                      {STATE_LABELS[order.currentState] ?? `État ${order.currentState}`}
                    </span>
                  </td>
                  <td><strong>{formatPrice(order.totalPaid)}</strong></td>
                  <td>À la livraison</td>
                  <td>
                    <button
                      className="order-dup-btn"
                      onClick={() => handleOpenDuplicate(order)}
                    >
                      Dupliquer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Panneau de duplication ── */}
      {dupTarget && (
        <div className="dup-panel">
          <div className="dup-panel-header">
            <h2 className="dup-panel-title">
              Dupliquer la commande{' '}
              <span className="order-ref">{dupTarget.reference}</span>
            </h2>
            <button className="dup-close-btn" onClick={handleCancelDuplicate}>✕ Fermer</button>
          </div>

          {/* ÉTAPE 1 — Choisir le nombre de duplications */}
          {(dupStep === 'idle' || dupStep === 'checking') && (
            <div className="dup-step">
              <p className="dup-step-label">
                Combien de fois voulez-vous dupliquer cette commande ?
              </p>
              <div className="dup-input-row">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={dupTimes}
                  onChange={e => setDupTimes(Math.max(1, parseInt(e.target.value) || 1))}
                  className="dup-number-input"
                />
                <span className="dup-times-label">fois</span>
                <button
                  className="dup-check-btn"
                  onClick={handleCheckStock}
                  disabled={dupStep === 'checking'}
                >
                  {dupStep === 'checking' ? 'Vérification en cours…' : 'Vérifier le stock'}
                </button>
              </div>
              <p className="dup-hint">
                Les quantités de chaque produit seront multipliées par {dupTimes}.
              </p>
            </div>
          )}

          {/* ÉTAPE 2 — Résultats de la vérification du stock */}
          {dupStep === 'results' && dupStockResults.length > 0 && (
            <div className="dup-step">
              <h3 className="dup-results-title">Résultat de la vérification du stock</h3>
              <table className="dup-stock-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Quantité nécessaire</th>
                    <th>Stock disponible</th>
                    <th>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {dupStockResults.map((r, i) => (
                    <tr key={i}>
                      <td>{r.productName}</td>
                      <td>{r.needed}</td>
                      <td>{r.available}</td>
                      <td>
                        {r.ok
                          ? <span className="dup-badge-ok">✔ Suffisant</span>
                          : <span className="dup-badge-nok">✘ Insuffisant</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="dup-results-actions">
                <button className="dup-back-btn" onClick={() => setDupStep('idle')}>
                  ← Modifier le nombre
                </button>
                {dupStockResults.every(r => r.ok) ? (
                  <button className="dup-validate-btn" onClick={handleValidateDuplication}>
                    Valider la duplication
                  </button>
                ) : (
                  <p className="dup-warning">
                    ⚠ Stock insuffisant pour un ou plusieurs produits. Impossible de valider.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ÉTAPE 3 — Création en cours */}
          {dupStep === 'creating' && (
            <div className="dup-step dup-step--center">
              <div className="myorders-spinner" />
              <p>Création de la commande en cours…</p>
            </div>
          )}

          {/* ÉTAPE 4 — Succès */}
          {dupStep === 'done' && (
            <div className="dup-step dup-step--center">
              <p className="dup-success">
                ✔ Commande créée avec succès.<br />
                Elle est automatiquement marquée comme <strong>payée</strong> et <strong>livrée</strong>.
              </p>
              <button className="dup-close-btn-lg" onClick={handleCancelDuplicate}>
                Fermer
              </button>
            </div>
          )}

          {/* ERREUR */}
          {dupStep === 'error' && (
            <div className="dup-step">
              <p className="dup-error">{dupError}</p>
              <button className="dup-back-btn" onClick={() => setDupStep('idle')}>
                Réessayer
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default MyOrders;
