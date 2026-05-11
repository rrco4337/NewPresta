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

// Statuts PrestaShop (défauts)
export const PS_STATE_LABELS: Record<number, string> = {
  1:  'En attente de chèque',
  2:  'Paiement accepté',
  3:  'En préparation',
  4:  'Expédié',
  5:  'Livré',
  6:  'Annulé',
  7:  'Remboursé',
  8:  'Échec paiement',
  9:  'En rupture (payé)',
  10: 'En attente virement',
  11: 'Paiement à la livraison',
  13: 'En attente COD',
};

// Les 3 statuts modifiables demandés
export const ALLOWED_PS_STATES = [
  { label: 'Paiement effectué', value: 2 },
  { label: 'Échec paiement',    value: 8 },
  { label: 'Annulé',            value: 6 },
];

// ==========================================
// PRESTASHOP ORDERS
// ==========================================

function parseOrdersXml(xmlString: string): Omit<PSOrder, 'customerName'>[] {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const orders: Omit<PSOrder, 'customerName'>[] = [];
  doc.querySelectorAll('order').forEach((el) => {
    const id         = el.querySelector('id')?.textContent?.trim() ?? '';
    const reference  = el.querySelector('reference')?.textContent?.trim() ?? '';
    const customerId = el.querySelector('id_customer')?.textContent?.trim() ?? '';
    const totalPaid  = parseFloat(el.querySelector('total_paid_tax_incl')?.textContent ?? '0');
    const date       = el.querySelector('date_add')?.textContent?.trim() ?? '';
    const state      = parseInt(el.querySelector('current_state')?.textContent ?? '0', 10);
    if (id) orders.push({ id, reference, customerId, totalPaid, date, currentState: state });
  });
  return orders;
}

async function fetchCustomerName(customerId: string): Promise<string> {
  try {
    const res = await api.get(`/customers/${customerId}?display=[firstname,lastname]`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const first = doc.querySelector('firstname')?.textContent?.trim() ?? '';
    const last  = doc.querySelector('lastname')?.textContent?.trim()  ?? '';
    return `${first} ${last}`.trim() || `Client #${customerId}`;
  } catch { return `Client #${customerId}`; }
}

export async function fetchPSOrders(): Promise<PSOrder[]> {
  try {
    const res    = await api.get('/orders?display=full');
    const raw    = parseOrdersXml(res.data);
    const orders = await Promise.all(
      raw.map(async (o) => ({
        ...o,
        customerName: await fetchCustomerName(o.customerId),
      }))
    );
    return orders;
  } catch {
    return [];
  }
}

export async function updatePSOrderStatus(orderId: string, stateId: number): Promise<boolean> {
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
  } catch { return false; }
}
