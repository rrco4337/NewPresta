import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomer } from '../contexts/CustomerContext';
import { getCustomerOrders, type PSCustomerOrder } from '../services/customerService';
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

  return (
    <div className="myorders-page">
      <nav className="myorders-breadcrumb">
        <Link to="/shop">Boutique</Link>
        <span>/</span>
        <span>Mes commandes</span>
      </nav>

      <div className="myorders-header">
        <h1 className="myorders-title">Mes commandes</h1>
        {customer && (
          <span className="myorders-customer">
            {customer.firstname} {customer.lastname}
          </span>
        )}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
