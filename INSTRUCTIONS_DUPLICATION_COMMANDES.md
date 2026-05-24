# Instructions — Duplication de commandes (côté client)

## Fonctionnalités à ajouter

| Fonctionnalité | Description |
|---|---|
| **Bouton "Créer une nouvelle commande"** | Redirige vers la boutique (`/shop`) |
| **Bouton "Dupliquer"** | Sur chaque ligne de commande, ouvre un panneau de duplication |
| **Vérification du stock** | Vérifie si le stock est suffisant avant de valider |
| **Validation** | Crée la commande dupliquée, la marque automatiquement comme **payée** puis **livrée** |

## Flux complet

```
Client sur "Mes commandes"
│
├── [+ Créer une nouvelle commande] → redirige vers /shop
│
└── [Dupliquer] sur une ligne
    │
    ├─ ÉTAPE 1 : Champ numérique — "Combien de fois ?"
    │   └─ Bouton [Vérifier le stock]
    │
    ├─ ÉTAPE 2 : Tableau résultats
    │   ├─ Chaque produit : quantité nécessaire / stock dispo / ✔ ou ✘
    │   ├─ Tout OK    → bouton [Valider la duplication]
    │   └─ Stock nul  → message d'avertissement, validation bloquée
    │
    ├─ ÉTAPE 3 : Création en cours (spinner)
    │   1. Crée un panier PrestaShop (quantités × N)
    │   2. Crée la commande → automatiquement état 2 "Paiement accepté"
    │   3. Passe en état 5 "Livré" → déduit le stock automatiquement
    │
    └─ ÉTAPE 4 : Message de succès
```

---

## Fichiers à modifier (dans cet ordre)

1. [`src/services/customerService.ts`](#fichier-1--srvcservicescustomerservicets)
2. [`src/components/MyOrders.tsx`](#fichier-2--srccomponentsmyorderstsx)
3. [`src/components/MyOrders.css`](#fichier-3--srccomponentsmyorderscss)

---

## FICHIER 1 — `src/services/customerService.ts`

### Modification 1.1 — Ajouter 2 nouveaux types

**Où ?** Après la fermeture de l'interface `PSCustomerOrder` (cherche ce bloc) :

```ts
export interface PSCustomerOrder {
  id: string;
  reference: string;
  totalPaid: number;
  currentState: number;
  dateAdd: string;
}
```

**Ajoute juste après le `}` final (sans rien supprimer) :**

```ts
export interface OrderDetailRow {
  productId: string;
  combinationId: string;
  quantity: number;
  productName: string;
  unitPriceTaxIncl: number;
  unitPriceTaxExcl: number;
}

export interface StockCheckResult {
  productId: string;
  combinationId: string;
  productName: string;
  needed: number;
  available: number;
  ok: boolean;
}
```

> **Pourquoi ?** Ces types décrivent la structure des données pour la duplication : le détail d'une ligne de commande et le résultat de la vérification du stock.

---

### Modification 1.2 — Ajouter 2 nouvelles fonctions

**Où ?** À la toute fin du fichier, après le dernier `}` de `getCustomerOrders`.

**Ajoute :**

```ts
export async function getOrderFullDetail(orderId: string): Promise<{
  rows: OrderDetailRow[];
  addressId: string;
  carrierId: string;
  currencyId: string;
} | null> {
  try {
    const res = await api.get(`/orders/${orderId}?display=full`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');

    const addressId  = doc.querySelector('id_address_delivery')?.textContent?.trim() ?? '0';
    const carrierId  = doc.querySelector('id_carrier')?.textContent?.trim() ?? '0';
    const currencyId = doc.querySelector('id_currency')?.textContent?.trim() ?? '1';

    const rows: OrderDetailRow[] = [];
    doc.querySelectorAll('order_row').forEach(el => {
      const productId        = el.querySelector('product_id')?.textContent?.trim() ?? '';
      const combinationId    = el.querySelector('product_attribute_id')?.textContent?.trim() ?? '0';
      const quantity         = parseInt(el.querySelector('product_quantity')?.textContent?.trim() ?? '0', 10);
      const productName      = el.querySelector('product_name')?.textContent?.trim() ?? `Produit #${productId}`;
      const unitPriceTaxIncl = parseFloat(el.querySelector('unit_price_tax_incl')?.textContent?.trim() ?? '0');
      const unitPriceTaxExcl = parseFloat(el.querySelector('unit_price_tax_excl')?.textContent?.trim() ?? '0');
      if (productId && quantity > 0) {
        rows.push({ productId, combinationId, quantity, productName, unitPriceTaxIncl, unitPriceTaxExcl });
      }
    });

    return { rows, addressId, carrierId, currencyId };
  } catch {
    return null;
  }
}

export async function checkStockForRows(
  rows: OrderDetailRow[],
  times: number
): Promise<StockCheckResult[]> {
  const results: StockCheckResult[] = [];

  for (const row of rows) {
    const needed = row.quantity * times;
    try {
      const combFilter = row.combinationId !== '0'
        ? `&filter[id_product_attribute]=[${row.combinationId}]`
        : `&filter[id_product_attribute]=[0]`;
      const res = await api.get(
        `/stock_availables?display=[id,quantity]&filter[id_product]=[${row.productId}]${combFilter}`
      );
      const doc = new DOMParser().parseFromString(res.data, 'text/xml');
      const available = parseInt(doc.querySelector('quantity')?.textContent ?? '0', 10);
      results.push({
        productId:     row.productId,
        combinationId: row.combinationId,
        productName:   row.productName,
        needed,
        available,
        ok: available >= needed,
      });
    } catch {
      results.push({
        productId:     row.productId,
        combinationId: row.combinationId,
        productName:   row.productName,
        needed,
        available: 0,
        ok: false,
      });
    }
  }

  return results;
}
```

> **Pourquoi ?**
> - `getOrderFullDetail` — récupère les produits d'une commande avec l'adresse et le transporteur.
> - `checkStockForRows` — pour chaque produit, compare la quantité nécessaire (originale × N) avec le stock disponible.

---

## FICHIER 2 — `src/components/MyOrders.tsx`

### Modification 2.1 — Ligne 1 : ajouter `useCallback`

**Cherche :**
```ts
import React, { useEffect, useState } from 'react';
```

**Remplace par :**
```ts
import React, { useEffect, useState, useCallback } from 'react';
```

---

### Modification 2.2 — Modifier l'import des services (ligne 4)

**Cherche :**
```ts
import { getCustomerOrders, type PSCustomerOrder } from '../services/customerService';
```

**Remplace par :**
```ts
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
```

> **Pourquoi ?** On importe les nouvelles fonctions de `customerService.ts` et `updatePSOrderStatus` de `orderService.ts` qui passe la commande en "Livré" et déclenche la déduction du stock.

---

### Modification 2.3 — Ajouter les variables d'état de duplication

**Cherche :**
```ts
  const [error, setError]     = useState<string | null>(null);
```

**Ajoute juste APRÈS (sans rien supprimer) :**
```ts

  // État du panneau de duplication
  const [dupTarget, setDupTarget]             = useState<PSCustomerOrder | null>(null);
  const [dupTimes, setDupTimes]               = useState<number>(1);
  const [dupStep, setDupStep]                 = useState<'idle' | 'checking' | 'results' | 'creating' | 'done' | 'error'>('idle');
  const [dupStockResults, setDupStockResults] = useState<StockCheckResult[]>([]);
  const [dupOrderDetail, setDupOrderDetail]   = useState<{ rows: OrderDetailRow[]; addressId: string; carrierId: string } | null>(null);
  const [dupError, setDupError]               = useState<string>('');
```

---

### Modification 2.4 — Ajouter les fonctions de duplication

**Cherche :**
```tsx
  return (
    <div className="myorders-page">
```

**Ajoute juste AVANT ces lignes (sans rien supprimer) :**
```ts
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

```

> **Pourquoi ?**
> - `handleOpenDuplicate` — ouvre le panneau pour une commande donnée en réinitialisant l'état.
> - `handleCancelDuplicate` — ferme le panneau.
> - `handleCheckStock` — récupère les détails et vérifie le stock × N.
> - `handleValidateDuplication` — crée le panier, crée la commande (forcée en état 2), puis passe en état 5 (livré + déduction stock).

---

### Modification 2.5 — Ajouter le bouton "Créer une nouvelle commande" dans le header

**Cherche :**
```tsx
      <div className="myorders-header">
        <h1 className="myorders-title">Mes commandes</h1>
        {customer && (
          <span className="myorders-customer">
            {customer.firstname} {customer.lastname}
          </span>
        )}
      </div>
```

**Remplace par :**
```tsx
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
```

---

### Modification 2.6 — Ajouter la colonne "Actions" dans l'en-tête du tableau

**Cherche :**
```tsx
              <tr>
                <th>Référence</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Total</th>
                <th>Paiement</th>
              </tr>
```

**Remplace par :**
```tsx
              <tr>
                <th>Référence</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Total</th>
                <th>Paiement</th>
                <th>Actions</th>
              </tr>
```

---

### Modification 2.7 — Ajouter le bouton "Dupliquer" dans chaque ligne

**Cherche :**
```tsx
                  <td>À la livraison</td>
                </tr>
```

**Remplace par :**
```tsx
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
```

---

### Modification 2.8 — Ajouter le panneau de duplication avant la fermeture du composant

**Cherche (tout en bas du fichier) :**
```tsx
    </div>
  );
};

export default MyOrders;
```

**Remplace par :**
```tsx
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
```

---

## FICHIER 3 — `src/components/MyOrders.css`

**Où ?** À la toute fin du fichier, après la dernière ligne.

**Ajoute :**

```css
/* ── Bouton "Créer une nouvelle commande" ─────────────────────────────────── */
.myorders-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.myorders-new-btn {
  padding: 9px 20px;
  background: #6366f1;
  color: #fff;
  border-radius: 10px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s;
  white-space: nowrap;
}

.myorders-new-btn:hover {
  background: #4f46e5;
}

/* ── Bouton "Dupliquer" dans le tableau ───────────────────────────────────── */
.order-dup-btn {
  padding: 5px 14px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.order-dup-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

/* ── Panneau de duplication ───────────────────────────────────────────────── */
.dup-panel {
  margin-top: 32px;
  border: 2px solid #6366f1;
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.1);
}

.dup-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #f5f3ff;
  border-bottom: 1px solid #e0e7ff;
}

.dup-panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.dup-close-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.dup-close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

/* ── Étapes ───────────────────────────────────────────────────────────────── */
.dup-step {
  padding: 24px;
}

.dup-step--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  color: #64748b;
}

.dup-step-label {
  font-size: 15px;
  color: #334155;
  margin: 0 0 16px;
  font-weight: 500;
}

/* ── Champ nombre ─────────────────────────────────────────────────────────── */
.dup-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dup-number-input {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  text-align: center;
}

.dup-number-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.dup-times-label {
  font-size: 15px;
  color: #64748b;
}

.dup-check-btn {
  padding: 9px 22px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.dup-check-btn:hover:not(:disabled) {
  background: #4f46e5;
}

.dup-check-btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}

.dup-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

/* ── Tableau résultats stock ──────────────────────────────────────────────── */
.dup-results-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 14px;
}

.dup-stock-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}

.dup-stock-table thead {
  background: #f8fafc;
}

.dup-stock-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e2e8f0;
}

.dup-stock-table td {
  padding: 10px 14px;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}

.dup-stock-table tbody tr:last-child td {
  border-bottom: none;
}

.dup-badge-ok {
  display: inline-block;
  padding: 3px 10px;
  background: #dcfce7;
  color: #15803d;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.dup-badge-nok {
  display: inline-block;
  padding: 3px 10px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

/* ── Boutons résultats ────────────────────────────────────────────────────── */
.dup-results-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.dup-back-btn {
  padding: 8px 18px;
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.dup-back-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.dup-validate-btn {
  padding: 9px 24px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.dup-validate-btn:hover {
  background: #15803d;
}

/* ── Messages ─────────────────────────────────────────────────────────────── */
.dup-warning {
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  margin: 0;
}

.dup-success {
  color: #15803d;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 16px 24px;
  font-size: 15px;
  text-align: center;
  line-height: 1.6;
}

.dup-error {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 16px;
}

.dup-close-btn-lg {
  padding: 10px 28px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.dup-close-btn-lg:hover {
  background: #4f46e5;
}
```

---

## Récapitulatif des modifications

| Fichier | Nb de modifications | Type |
|---|---|---|
| `customerService.ts` | 2 | Ajout de types + fonctions |
| `MyOrders.tsx` | 8 | Imports, état, fonctions, JSX |
| `MyOrders.css` | 1 | Ajout de styles à la fin |

> **Note importante** : Toutes les modifications dans `MyOrders.tsx` sont des **ajouts** ou des **remplacements ciblés**. Aucune réécriture complète du fichier n'est nécessaire.
