import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCustomer } from '../contexts/CustomerContext';
import {
  getCustomerAddresses,
  createAddress,
  createPSCart,
  createPSOrder,
  updateStockAfterOrder,
  type Address,
  type CreateAddressData,
} from '../services/customerService';
import { formatPrice } from '../services/shopService';
import './CheckoutPage.css';

// ── Carriers ──────────────────────────────────────────────────────────────────
const CARRIERS = [
  { id: '1', name: 'Click and collect', desc: 'Retrait en magasin', price: 0 },
  { id: '2', name: 'My carrier',        desc: 'Livraison à domicile (3-5 jours)', price: 5.9 },
];

type Step = 'address' | 'delivery' | 'review';

// ── Address form ──────────────────────────────────────────────────────────────
interface AddressFormState {
  alias: string;
  address1: string;
  address2: string;
  postcode: string;
  city: string;
  phone: string;
}

const emptyForm = (): AddressFormState => ({
  alias: 'Domicile', address1: '', address2: '', postcode: '', city: '', phone: '',
});

// ── Component ─────────────────────────────────────────────────────────────────
const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { customer } = useCustomer();
  const { items, totalPrice, clear } = useCart();

  const [step, setStep] = useState<Step>('address');

  // Address
  const [addresses, setAddresses]       = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string>('');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState<AddressFormState>(emptyForm());
  const [addrLoading, setAddrLoading]   = useState(true);

  // Delivery
  const [carrierId, setCarrierId] = useState('1');

  // Confirm
  const [placing, setPlacing]   = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) { navigate('/shop/auth?next=/shop/checkout', { replace: true }); return; }
    if (items.length === 0) { navigate('/shop/cart', { replace: true }); return; }
    getCustomerAddresses(customer.id).then(list => {
      setAddresses(list);
      if (list.length > 0) setSelectedAddr(list[0].id);
      else setShowForm(true);
      setAddrLoading(false);
    });
  }, [customer, items, navigate]);

  const shippingCost = CARRIERS.find(c => c.id === carrierId)?.price ?? 0;
  const total = totalPrice + shippingCost;

  // ── Step 1: Address ────────────────────────────────────────────────────────

  const handleAddressNext = async () => {
    if (showForm) {
      if (!form.address1.trim() || !form.postcode.trim() || !form.city.trim()) {
        alert('Veuillez remplir les champs obligatoires.');
        return;
      }
      if (!customer) return;
      const data: CreateAddressData = {
        id_customer: customer.id,
        alias: form.alias || 'Domicile',
        firstname: customer.firstname,
        lastname: customer.lastname,
        address1: form.address1,
        address2: form.address2,
        postcode: form.postcode,
        city: form.city,
        phone: form.phone,
      };
      try {
        const newId = await createAddress(data);
        const newAddr: Address = { id: newId, ...data, address2: data.address2 ?? '', phone: data.phone ?? '' };
        setAddresses(prev => [...prev, newAddr]);
        setSelectedAddr(newId);
        setShowForm(false);
      } catch {
        alert('Erreur lors de la création de l\'adresse.');
        return;
      }
    }
    setStep('delivery');
  };

  // ── Step 3: Place order ────────────────────────────────────────────────────

  const handlePlaceOrder = async () => {
    if (!customer) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const checkoutItems = items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty }));
      const cartId = await createPSCart(customer.id, selectedAddr, carrierId, checkoutItems);
      const orderId = await createPSOrder({
        customerId: customer.id,
        addressId: selectedAddr,
        cartId,
        carrierId,
        items: checkoutItems,
        shippingCost,
      });
      await updateStockAfterOrder(checkoutItems);
      clear();
      navigate(`/shop/confirmation/${orderId}`, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la commande.';
      setPlaceError(msg);
    } finally {
      setPlacing(false);
    }
  };

  const selectedAddress = addresses.find(a => a.id === selectedAddr);
  const selectedCarrier = CARRIERS.find(c => c.id === carrierId)!;

  if (addrLoading) {
    return (
      <div className="checkout-loading">
        <div className="checkout-spinner" />
        <p>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <nav className="checkout-breadcrumb">
        <Link to="/shop">Boutique</Link>
        <span>/</span>
        <Link to="/shop/cart">Panier</Link>
        <span>/</span>
        <span>Commande</span>
      </nav>

      <h1 className="checkout-title">Finaliser la commande</h1>

      {/* ── Stepper ── */}
      <div className="checkout-stepper">
        {(['address', 'delivery', 'review'] as Step[]).map((s, i) => {
          const labels = ['Adresse', 'Livraison', 'Confirmation'];
          const idx = ['address', 'delivery', 'review'].indexOf(step);
          const done = i < idx;
          const active = s === step;
          return (
            <React.Fragment key={s}>
              <div className={`stepper-item${active ? ' stepper-item--active' : ''}${done ? ' stepper-item--done' : ''}`}>
                <div className="stepper-circle">{done ? '✓' : i + 1}</div>
                <span className="stepper-label">{labels[i]}</span>
              </div>
              {i < 2 && <div className={`stepper-line${done ? ' stepper-line--done' : ''}`} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="checkout-layout">
        <div className="checkout-main">

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1 — ADDRESS
          ══════════════════════════════════════════════════════════════════════ */}
          {step === 'address' && (
            <div className="checkout-section">
              <h2 className="checkout-section-title">Adresse de livraison</h2>

              {addresses.length > 0 && !showForm && (
                <div className="addr-list">
                  {addresses.map(addr => (
                    <label key={addr.id} className={`addr-card${selectedAddr === addr.id ? ' addr-card--active' : ''}`}>
                      <input
                        type="radio"
                        name="addr"
                        value={addr.id}
                        checked={selectedAddr === addr.id}
                        onChange={() => setSelectedAddr(addr.id)}
                      />
                      <div className="addr-card-body">
                        <strong>{addr.alias}</strong>
                        <span>{addr.firstname} {addr.lastname}</span>
                        <span>{addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}</span>
                        <span>{addr.postcode} {addr.city}</span>
                        {addr.phone && <span>{addr.phone}</span>}
                      </div>
                    </label>
                  ))}
                  <button className="addr-add-btn" onClick={() => setShowForm(true)}>
                    + Nouvelle adresse
                  </button>
                </div>
              )}

              {showForm && (
                <div className="addr-form">
                  {addresses.length > 0 && (
                    <button className="addr-back-btn" onClick={() => setShowForm(false)}>
                      ← Utiliser une adresse existante
                    </button>
                  )}
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Alias *</label>
                      <input className="form-input" value={form.alias}
                        onChange={e => setForm(p => ({ ...p, alias: e.target.value }))} placeholder="Domicile" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Adresse *</label>
                    <input className="form-input" value={form.address1}
                      onChange={e => setForm(p => ({ ...p, address1: e.target.value }))} placeholder="12 rue de la Paix" required />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Complément</label>
                    <input className="form-input" value={form.address2}
                      onChange={e => setForm(p => ({ ...p, address2: e.target.value }))} placeholder="Bât. B, Apt. 42" />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Code postal *</label>
                      <input className="form-input" value={form.postcode}
                        onChange={e => setForm(p => ({ ...p, postcode: e.target.value }))} placeholder="75001" required />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Ville *</label>
                      <input className="form-input" value={form.city}
                        onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Paris" required />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Téléphone</label>
                    <input className="form-input" value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="06 01 02 03 04" />
                  </div>
                </div>
              )}

              <button className="checkout-next-btn" onClick={handleAddressNext}>
                Continuer vers la livraison →
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2 — DELIVERY
          ══════════════════════════════════════════════════════════════════════ */}
          {step === 'delivery' && (
            <div className="checkout-section">
              <h2 className="checkout-section-title">Mode de livraison</h2>
              <div className="carrier-list">
                {CARRIERS.map(c => (
                  <label key={c.id} className={`carrier-card${carrierId === c.id ? ' carrier-card--active' : ''}`}>
                    <input
                      type="radio"
                      name="carrier"
                      value={c.id}
                      checked={carrierId === c.id}
                      onChange={() => setCarrierId(c.id)}
                    />
                    <div className="carrier-card-body">
                      <strong className="carrier-name">{c.name}</strong>
                      <span className="carrier-desc">{c.desc}</span>
                    </div>
                    <span className="carrier-price">
                      {c.price === 0 ? 'Gratuit' : formatPrice(c.price)}
                    </span>
                  </label>
                ))}
              </div>

              <div className="checkout-nav">
                <button className="checkout-back-btn" onClick={() => setStep('address')}>← Adresse</button>
                <button className="checkout-next-btn" onClick={() => setStep('review')}>
                  Continuer →
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3 — REVIEW & CONFIRM
          ══════════════════════════════════════════════════════════════════════ */}
          {step === 'review' && (
            <div className="checkout-section">
              <h2 className="checkout-section-title">Récapitulatif</h2>

              {/* Articles */}
              <div className="review-block">
                <h3 className="review-block-title">Articles ({items.length})</h3>
                {items.map(item => (
                  <div key={item.id} className="review-item">
                    <span className="review-item-name">{item.name}</span>
                    <span className="review-item-qty">× {item.qty}</span>
                    <span className="review-item-price">{formatPrice(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              {/* Adresse */}
              {selectedAddress && (
                <div className="review-block">
                  <h3 className="review-block-title">
                    Adresse de livraison
                    <button className="review-edit-btn" onClick={() => setStep('address')}>Modifier</button>
                  </h3>
                  <p className="review-addr">
                    {selectedAddress.firstname} {selectedAddress.lastname}<br />
                    {selectedAddress.address1}{selectedAddress.address2 ? `, ${selectedAddress.address2}` : ''}<br />
                    {selectedAddress.postcode} {selectedAddress.city}
                    {selectedAddress.phone && <><br />{selectedAddress.phone}</>}
                  </p>
                </div>
              )}

              {/* Transporteur */}
              <div className="review-block">
                <h3 className="review-block-title">
                  Livraison
                  <button className="review-edit-btn" onClick={() => setStep('delivery')}>Modifier</button>
                </h3>
                <p className="review-addr">
                  {selectedCarrier.name} — {selectedCarrier.price === 0 ? 'Gratuit' : formatPrice(selectedCarrier.price)}
                </p>
              </div>

              {/* Paiement */}
              <div className="review-block review-block--payment">
                <div className="cod-badge">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  Paiement à la livraison (espèces)
                </div>
                <p className="cod-note">Vous payez le livreur en espèces à la réception de votre colis.</p>
              </div>

              {placeError && <div className="checkout-error">{placeError}</div>}

              <div className="checkout-nav">
                <button className="checkout-back-btn" onClick={() => setStep('delivery')}>← Livraison</button>
                <button className="checkout-confirm-btn" onClick={handlePlaceOrder} disabled={placing}>
                  {placing ? (
                    <><span className="btn-spinner" /> Commande en cours…</>
                  ) : (
                    `Confirmer la commande — ${formatPrice(total)}`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Order sidebar ── */}
        <div className="checkout-sidebar">
          <h3 className="sidebar-title">Votre commande</h3>
          {items.map(item => (
            <div key={item.id} className="sidebar-item">
              <span className="sidebar-item-name">{item.name}</span>
              <span className="sidebar-item-qty">×{item.qty}</span>
              <span className="sidebar-item-price">{formatPrice(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="sidebar-sep" />
          <div className="sidebar-row">
            <span>Sous-total</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>
          <div className="sidebar-row">
            <span>Livraison</span>
            <span>{shippingCost === 0 ? 'Gratuit' : formatPrice(shippingCost)}</span>
          </div>
          <div className="sidebar-total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
