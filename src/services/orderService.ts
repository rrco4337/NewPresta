import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ==========================================
// TYPES
// ==========================================

export interface PSOrder {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  totalPaid: number;
  date: string;
  currentState: number;
  // Ajouts pour la transformation
  id_address_delivery?: string;
  id_address_invoice?: string;
  id_carrier?: string;
  id_currency?: string;
}

// 📦 Les 3 statuts selon les spécifications J2
export const PS_STATE_LABELS: Record<number, string> = {
  1:  '📦 Dans le panier',      // État panier (cart non validé)
  2:  '✅ Paiement effectué',    // Commande validée + paiement OK
  6:  '❌ Annulé',               // Commande annulée
};

// Liste des états modifiables dans le backoffice
export const ALLOWED_PS_STATES = [
  { label: '📦 Dans le panier',      value: 1 },
  { label: '✅ Paiement effectué',   value: 2 },
  { label: '❌ Annulé',              value: 6 },
];

// ✅ Vérifier si une transition est autorisée
export function isTransitionAllowed(oldState: number, newState: number): boolean {
  // Règle 1: Le panier (1) peut devenir payé (2) ou annulé (6)
  if (oldState === 1 && (newState === 2 || newState === 6)) {
    return true;
  }
  
  // Règle 2: Payé (2) peut devenir annulé (6)
  if (oldState === 2 && newState === 6) {
    return true;
  }
  
  // Règle 3: Annulé (6) peut redevenir payé (2) - cas rare mais possible
  if (oldState === 6 && newState === 2) {
    return true;
  }
  
  // Règle 4: Même état → pas de changement
  if (oldState === newState) {
    return false;
  }
  
  // Règle 5: TOUT VERS "dans le panier" (1) est INTERDIT
  if (newState === 1) {
    return false;
  }
  
  // Autres transitions non autorisées
  return false;
}

// ==========================================
// PRESTASHOP ORDERS
// ==========================================



async function fetchCustomerName(customerId: string): Promise<string> {
  try {
    const res = await api.get(`/customers/${customerId}?display=[firstname,lastname]`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const first = doc.querySelector('firstname')?.textContent?.trim() ?? '';
    const last  = doc.querySelector('lastname')?.textContent?.trim()  ?? '';
    return `${first} ${last}`.trim() || `Client #${customerId}`;
  } catch { 
    return `Client #${customerId}`; 
  }
}

function parseOrdersXml(xmlString: string): (Omit<PSOrder, 'customerName'> & { cartId?: string })[] {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const orders: (Omit<PSOrder, 'customerName'> & { cartId?: string })[] = [];
  
  doc.querySelectorAll('order').forEach((el) => {
    const id = el.querySelector('id')?.textContent?.trim() ?? '';
    const cartId = el.querySelector('id_cart')?.textContent?.trim() ?? '';  // 🔥 Clé !
    const reference = el.querySelector('reference')?.textContent?.trim() ?? '';
    const customerId = el.querySelector('id_customer')?.textContent?.trim() ?? '';
    const totalPaid = parseFloat(el.querySelector('total_paid_tax_incl')?.textContent ?? '0');
    const date = el.querySelector('date_add')?.textContent?.trim() ?? '';
    const currentState = parseInt(el.querySelector('current_state')?.textContent ?? '0', 10);
    
    if (id) {
      orders.push({ 
        id, 
        cartId,  // Sauvegarder pour le filtrage
        reference: reference || id,
        customerId, 
        totalPaid, 
        date, 
        currentState 
      });
    }
  });
  
  return orders;
}

export async function fetchPSOrders(): Promise<PSOrder[]> {
  try {
    // 1️⃣ Récupérer toutes les commandes
    const ordersRes = await api.get('/orders?display=full');
    const orders = parseOrdersXml(ordersRes.data);
    
    // 2️⃣ Extraire les IDs des paniers déjà transformés en commandes
    const cartIdsAlreadyOrdered = new Set(
      orders
        .map(o => o.cartId)      // Il faut récupérer id_cart depuis la commande
        .filter(id => id)        // Éliminer les vides
    );
    
    // 3️⃣ Récupérer les paniers
    const cartsRes = await api.get('/carts?display=full');
    const allCarts = await parseCartsXml(cartsRes.data);
    
    // 4️⃣ 🔥 FILTRER : garder uniquement les paniers NON transformés en commande
    const pendingCarts = allCarts.filter(
      cart => !cartIdsAlreadyOrdered.has(cart.id)
    );
    
    // 5️⃣ Fusionner commandes + paniers en attente
    const allItems = [...orders, ...pendingCarts];
    
    // 6️⃣ Enrichir avec noms clients
    const enriched = await Promise.all(
      allItems.map(async (item) => ({
        ...item,
        customerName: await fetchCustomerName(item.customerId),
      }))
    );
    
    return enriched;
  } catch {
    return [];
  }
}

// Cache pour éviter de re-fetcher le même produit plusieurs fois
const productPriceCache = new Map<string, number>();

async function fetchProductPrice(productId: string): Promise<number> {
  if (productPriceCache.has(productId)) {
    return productPriceCache.get(productId)!;
  }

  try {
    const res = await api.get(`/products/${productId}?display=full`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');

    // PrestaShop expose price HT + price_ttc selon la config.
    // Préfère price_ttc, sinon price (HT).
    const priceTtc = doc.querySelector('price_tax_incl')?.textContent?.trim();
    const priceHt  = doc.querySelector('price')?.textContent?.trim();

    const price = parseFloat(priceTtc ?? priceHt ?? '0') || 0;
    productPriceCache.set(productId, price);
    return price;
  } catch {
    console.warn(`Impossible de récupérer le prix du produit ${productId}`);
    return 0;
  }
}

async function parseCartsXml(
  xmlString: string
): Promise<Omit<PSOrder, 'customerName'>[]> {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const cartEls = Array.from(doc.querySelectorAll('cart'));

  const carts = await Promise.all(
    cartEls.map(async (el) => {
      const id = el.querySelector('id')?.textContent?.trim() ?? '';
      if (!id) return null;

      const customerId = el.querySelector('id_customer')?.textContent?.trim() ?? '';
      const date = el.querySelector('date_add')?.textContent?.trim() ?? '';
      
      // On garantit ici que ce sont des strings (jamais undefined)
      const id_address_delivery = el.querySelector('id_address_delivery')?.textContent?.trim() ?? '0';
      const id_address_invoice = el.querySelector('id_address_invoice')?.textContent?.trim() ?? '0';
      const id_carrier = el.querySelector('id_carrier')?.textContent?.trim() ?? '0';
      const id_currency = el.querySelector('id_currency')?.textContent?.trim() ?? '1';

      const rows = Array.from(
        el.querySelectorAll('associations cart_rows cart_row, cart_rows cart_row, cart_row')
      );

      const rowTotals = await Promise.all(
        rows.map(async (row) => {
          const productId = row.querySelector('id_product')?.textContent?.trim() ?? '';
          const qty = parseInt(row.querySelector('quantity')?.textContent?.trim() ?? '0', 10);
          if (!productId || isNaN(qty) || qty === 0) return 0;
          const unitPrice = await fetchProductPrice(productId);
          return unitPrice * qty;
        })
      );

      const totalPaid = rowTotals.reduce((sum, v) => sum + v, 0);

      // On retourne l'objet directement
      return {
        id,
        reference: `PANIER-${id}`,
        customerId,
        totalPaid,
        date,
        currentState: 1,
        id_address_delivery,
        id_address_invoice,
        id_carrier,
        id_currency
      };
    })
  );

  // Correction du filtre : on utilise un type assertion plus simple ici
  return carts.filter((c): c is NonNullable<typeof c> => c !== null);
}
// parseCartsXml retourne les paniers avec leur ID simple
// orderService.ts

export async function transformCartToOrder(order: PSOrder, newState: number): Promise<boolean> {
  try {
    // ── Étape 1 : Créer la commande (sans current_state, PS le gère) ──────────
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery><![CDATA[${order.id_address_delivery}]]></id_address_delivery>
    <id_address_invoice><![CDATA[${order.id_address_invoice}]]></id_address_invoice>
    <id_cart><![CDATA[${order.id}]]></id_cart>
    <id_currency><![CDATA[${order.id_currency || '1'}]]></id_currency>
    <id_lang><![CDATA[1]]></id_lang>
    <id_customer><![CDATA[${order.customerId}]]></id_customer>
    <id_carrier><![CDATA[${order.id_carrier}]]></id_carrier>
    <module><![CDATA[ps_checkpayment]]></module>
    <payment><![CDATA[Paiement manuel (Backoffice)]]></payment>
    <total_paid><![CDATA[${order.totalPaid}]]></total_paid>
    <total_paid_real><![CDATA[${order.totalPaid}]]></total_paid_real>
    <total_products><![CDATA[${order.totalPaid}]]></total_products>
    <total_products_wt><![CDATA[${order.totalPaid}]]></total_products_wt>
    <conversion_rate><![CDATA[1]]></conversion_rate>
  </order>
</prestashop>`;

    const createRes = await api.post('/orders', xml);

    // ── Étape 2 : Extraire le nouvel ID de commande depuis la réponse XML ─────
    const doc = new DOMParser().parseFromString(createRes.data, 'text/xml');
    const newOrderId = doc.querySelector('order > id')?.textContent?.trim();

    if (!newOrderId) {
      console.error('transformCartToOrder: impossible de lire le nouvel ID commande', createRes.data);
      return false;
    }

    // ── Étape 3 : Appliquer le bon état via order_histories ───────────────────
    const stateUpdated = await updatePSOrderStatus(newOrderId, newState);

    if (!stateUpdated) {
      console.warn(`Commande ${newOrderId} créée mais mise à jour du statut ${newState} échouée.`);
      // La commande existe quand même, on ne renvoie pas false
    }

    return true;
  } catch (error) {
    console.error(`Erreur transformation panier ${order.id}:`, error);
    return false;
  }
}

export async function updatePSOrderStatus(orderId: string, stateId: number): Promise<boolean> {
  // 🔒 Vérification supplémentaire avant envoi à l'API
  // On ne devrait jamais envoyer une transition vers panier (1)
  // car c'est interdit par isTransitionAllowed, mais sécurité supplémentaire
  
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order><![CDATA[${orderId}]]></id_order>
    <id_order_state><![CDATA[${stateId}]]></id_order_state>
    <id_employee><![CDATA[1]]></id_employee>
  </order_history>
</prestashop>`;
    
    await api.post('/order_histories', xml);
    return true;
  } catch (error) {
    console.error(`Erreur updatePSOrderStatus pour ${orderId} -> ${stateId}:`, error);
    return false;
  }
}

// ==========================================
// SUPPRESSION DES PANIERS
// ==========================================

export async function deletePSCart(cartId: string): Promise<boolean> {
  try {
    await api.delete(`/carts/${cartId}`);
    return true;
  } catch (error) {
    console.error(`Erreur suppression panier ${cartId}:`, error);
    return false;
  }
}

export async function deleteZombieCarts(orders: PSOrder[]): Promise<{ deleted: number; failed: number }> {
  const zombies = orders.filter(o => o.currentState === 1 && o.totalPaid === 0);
  let deleted = 0;
  let failed = 0;
  for (const cart of zombies) {
    const ok = await deletePSCart(cart.id);
    if (ok) deleted++; else failed++;
  }
  return { deleted, failed };
}

// ==========================================
// FONCTIONS UTILITAIRES POUR LE STATISTIQUES
// ==========================================

export function getOrdersStats(orders: PSOrder[]) {
  const paniers = orders.filter(o => o.currentState === 1);
  const payees = orders.filter(o => o.currentState === 2);
  const annulees = orders.filter(o => o.currentState === 6);
  
  const montantTotalPaye = payees.reduce((sum, o) => sum + o.totalPaid, 0);
  const montantTotalPaniers = paniers.reduce((sum, o) => sum + o.totalPaid, 0);
  
  return {
    total: orders.length,
    paniers: paniers.length,
    payees: payees.length,
    annulees: annulees.length,
    montantTotalPaye,
    montantTotalPaniers,
  };
}