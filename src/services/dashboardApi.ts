import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/prestashop',
  headers: {
    'Accept': 'application/xml',
    'Content-Type': 'application/xml',
  },
  // Important : on reçoit du texte (XML) et non du JSON
  responseType: 'text',
});

export interface OrderFromApi {
  id: string;
  reference: string;
  total_paid_tax_incl: string;
  date_add: string;
  current_state: string;
}

/**
 * Parse la réponse XML de PrestaShop
 * Structure typique : <prestashop><orders><order>...</order>...</orders></prestashop>
 */
function parseOrdersXml(xmlString: string): OrderFromApi[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const orders: OrderFromApi[] = [];

  const orderNodes = xmlDoc.getElementsByTagName('order');
  for (let i = 0; i < orderNodes.length; i++) {
    const order = orderNodes[i];
    const id = order.getElementsByTagName('id')[0]?.textContent || '';
    const reference = order.getElementsByTagName('reference')[0]?.textContent || '';
    const total_paid_tax_incl = order.getElementsByTagName('total_paid_tax_incl')[0]?.textContent || '0';
    const date_add = order.getElementsByTagName('date_add')[0]?.textContent || '';
    const current_state = order.getElementsByTagName('current_state')[0]?.textContent || '';

    if (id && reference) {
      orders.push({ id, reference, total_paid_tax_incl, date_add, current_state });
    }
  }
  return orders;
}

export async function fetchOrders(dateFrom?: string, dateTo?: string): Promise<OrderFromApi[]> {
  try {
    // AUCUN paramètre pour tester la connectivité de base
    const response = await apiClient.get('/orders');
    console.log('Réponse brute :', response.data);
    const orders = parseOrdersXml(response.data);
    return orders;
  } catch (error) {
    console.error('Erreur fetchOrders:', error);
    throw error;
  }
}