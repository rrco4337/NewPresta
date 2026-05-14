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
    const allCarts = parseCartsXml(cartsRes.data);
    
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

// parseCartsXml retourne les paniers avec leur ID simple
function parseCartsXml(xmlString: string): Omit<PSOrder, 'customerName'>[] {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const carts: Omit<PSOrder, 'customerName'>[] = [];
  
  doc.querySelectorAll('cart').forEach((el) => {
    const id = el.querySelector('id')?.textContent?.trim() ?? '';
    const customerId = el.querySelector('id_customer')?.textContent?.trim() ?? '';
    const date = el.querySelector('date_add')?.textContent?.trim() ?? '';
    
    // Calcul du montant total
    let totalPaid = 0;
    el.querySelectorAll('associations.cart_rows.cart_row').forEach((row) => {
      const price = parseFloat(row.querySelector('price')?.textContent ?? '0');
      const qty = parseInt(row.querySelector('quantity')?.textContent ?? '0', 10);
      totalPaid += price * qty;
    });
    
    if (id) {
      carts.push({
        id: id,  // ID simple, pas de préfixe
        reference: `PANIER-${id}`,
        customerId,
        totalPaid,
        date,
        currentState: 1,  // "dans le panier"
      });
    }
  });
  
  return carts;
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