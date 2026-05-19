import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCustomer } from '../contexts/CustomerContext';
import { formatPrice } from '../services/shopService';
import './OrderConfirmation.css';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

interface OrderSummary {
  id: string;
  reference: string;
  totalPaid: number;
  currentState: number;
  dateAdd: string;
}

const OrderConfirmation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { customer } = useCustomer();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/orders/${id}?display=[id,reference,total_paid,current_state,date_add]`)
      .then(res => {
        const doc = new DOMParser().parseFromString(res.data, 'text/xml');
        const el = doc.querySelector('order');
        if (el) {
          setOrder({
            id,
            reference: el.querySelector('reference')?.textContent?.trim() || `#${id}`,
            totalPaid: parseFloat(el.querySelector('total_paid')?.textContent ?? '0'),
            currentState: parseInt(el.querySelector('current_state')?.textContent ?? '0', 10),
            dateAdd: el.querySelector('date_add')?.textContent?.trim() ?? '',
          });
        }
      })
      .catch(() => { /* show generic success even if fetch fails */ })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>

        <h1 className="confirm-title">Commande confirmée !</h1>
        <p className="confirm-sub">Merci {customer?.firstname ?? ''} pour votre commande.</p>

        {!loading && order && (
          <div className="confirm-details">
            <div className="confirm-row">
              <span>Référence</span>
              <strong>{order.reference}</strong>
            </div>
            <div className="confirm-row">
              <span>Total</span>
              <strong>{formatPrice(order.totalPaid)}</strong>
            </div>
            <div className="confirm-row">
              <span>Paiement</span>
              <strong>À la livraison</strong>
            </div>
          </div>
        )}

        {loading && (
          <div className="confirm-details">
            <div className="confirm-row">
              <span>Numéro de commande</span>
              <strong>#{id}</strong>
            </div>
            <div className="confirm-row">
              <span>Paiement</span>
              <strong>À la livraison</strong>
            </div>
          </div>
        )}

        <div className="confirm-cod-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="4" width="22" height="16" rx="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          <div>
            <strong>Paiement à la livraison</strong>
            <p>Préparez le règlement en espèces lors de la réception de votre colis.</p>
          </div>
        </div>

        <div className="confirm-actions">
          <Link to="/shop/my-orders" className="confirm-btn confirm-btn--outline">
            Voir mes commandes
          </Link>
          <Link to="/shop" className="confirm-btn confirm-btn--primary">
            Continuer mes achats
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
