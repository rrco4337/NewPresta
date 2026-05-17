import axios from 'axios';

const apiClient = axios.create({
  baseURL: '' + (import.meta.env.VITE_API_BASE_URL || '/api'),
  headers: {
    'Accept': 'application/xml',
    'Content-Type': 'application/xml',
  },
  responseType: 'text',
});

export interface OrderFromApi {
  id: string;
  reference: string;
  total_paid_tax_incl: string;
  date_add: string;
  current_state: string;
}

export interface CartFromApi {
  id: string;
  date_add: string;
  date_upd: string;
  id_customer: string;
}

export interface DailyStats {
  date: string;
  orderCount: number;
  cartCount: number;
  orderRevenue: number;
  cartRevenue: number;
  totalCount: number;
  totalRevenue: number;
}

export interface GlobalStats {
  totalOrders: number;
  totalCarts: number;
  orderRevenue: number;
  cartRevenue: number;
  totalCount: number;
  totalRevenue: number;
  averageOrderValue: number;
  averageCartValue: number;
  dailyStats: DailyStats[];
}

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

function parseCartsXml(xmlString: string): CartFromApi[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  const carts: CartFromApi[] = [];

  const cartNodes = xmlDoc.getElementsByTagName('cart');
  for (let i = 0; i < cartNodes.length; i++) {
    const cart = cartNodes[i];
    const id = cart.getElementsByTagName('id')[0]?.textContent || '';
    const date_add = cart.getElementsByTagName('date_add')[0]?.textContent || '';
    const date_upd = cart.getElementsByTagName('date_upd')[0]?.textContent || '';
    const id_customer = cart.getElementsByTagName('id_customer')[0]?.textContent || '';

    if (id) {
      carts.push({ id, date_add, date_upd, id_customer });
    }
  }
  return carts;
}

function extractDate(dateStr: string): string {
  return dateStr.split(' ')[0] || dateStr.split('T')[0];
}

function filterByDateRange(dateStr: string, dateFrom?: string, dateTo?: string): boolean {
  const date = extractDate(dateStr);
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

export function computeGlobalStats(
  orders: OrderFromApi[],
  carts: CartFromApi[],
  dateFrom?: string,
  dateTo?: string
): GlobalStats {
  const filteredOrders = orders.filter(o => filterByDateRange(o.date_add, dateFrom, dateTo));
  const filteredCarts = carts.filter(c => filterByDateRange(c.date_add, dateFrom, dateTo));

  const orderRevenue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.total_paid_tax_incl || '0'), 0);
  // Pas de montant disponible pour les paniers sans total_price — on met 0
  const cartRevenue = 0;

  const dailyMap = new Map<string, DailyStats>();

  for (const order of filteredOrders) {
    const date = extractDate(order.date_add);
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, orderCount: 0, cartCount: 0, orderRevenue: 0, cartRevenue: 0, totalCount: 0, totalRevenue: 0 });
    }
    const day = dailyMap.get(date)!;
    day.orderCount += 1;
    day.orderRevenue += parseFloat(order.total_paid_tax_incl || '0');
  }

  for (const cart of filteredCarts) {
    const date = extractDate(cart.date_add);
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, orderCount: 0, cartCount: 0, orderRevenue: 0, cartRevenue: 0, totalCount: 0, totalRevenue: 0 });
    }
    const day = dailyMap.get(date)!;
    day.cartCount += 1;
    // cartRevenue restera 0 jusqu'à ce qu'on connaisse le bon champ API
  }

  for (const day of dailyMap.values()) {
    day.totalCount = day.orderCount + day.cartCount;
    day.totalRevenue = day.orderRevenue + day.cartRevenue;
  }

  const dailyStats = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  const totalOrders = filteredOrders.length;
  const totalCarts = filteredCarts.length;

  return {
    totalOrders,
    totalCarts,
    orderRevenue,
    cartRevenue,
    totalCount: totalOrders + totalCarts,
    totalRevenue: orderRevenue + cartRevenue,
    averageOrderValue: totalOrders > 0 ? orderRevenue / totalOrders : 0,
    averageCartValue: 0,
    dailyStats,
  };
}

export async function fetchOrders(): Promise<OrderFromApi[]> {
  try {
    const response = await apiClient.get('/orders?display=[id,reference,total_paid_tax_incl,date_add,current_state]');
    console.log('📦 Réponse API orders brute :', response.data);
    return parseOrdersXml(response.data);
  } catch (error) {
    console.error('Erreur fetchOrders:', error);
    throw error;
  }
}

export async function fetchCarts(): Promise<CartFromApi[]> {
  try {
    // On ne demande que les champs sûrs — pas de total_price qui cause le 500
    const response = await apiClient.get('/carts?display=[id,date_add,date_upd,id_customer]');
    console.log('🛒 Réponse API carts brute :', response.data);
    return parseCartsXml(response.data);
  } catch (error) {
    console.error('Erreur fetchCarts:', error);
    // On retourne un tableau vide plutôt que de faire planter tout le dashboard
    return [];
  }
}

export async function fetchDashboardData(dateFrom?: string, dateTo?: string): Promise<GlobalStats> {
  const [orders, carts] = await Promise.all([
    fetchOrders(),
    fetchCarts(),
  ]);
  return computeGlobalStats(orders, carts, dateFrom, dateTo);
}