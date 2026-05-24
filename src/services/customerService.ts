import axios from 'axios';


const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  secureKey: string;
}

export interface CustomerSummary {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
}

export interface Address {
  id: string;
  alias: string;
  firstname: string;
  lastname: string;
  address1: string;
  address2: string;
  postcode: string;
  city: string;
  phone: string;
}

export interface CreateAddressData {
  id_customer: string;
  alias: string;
  firstname: string;
  lastname: string;
  address1: string;
  address2?: string;
  postcode: string;
  city: string;
  phone?: string;
}

export interface CheckoutItem {
  id: string;
  name: string;
  priceHt: number;
  priceTtc: number;
  taxRate: number;
  qty: number;
  attributeId?: string;
}

export interface PSCustomerOrder {
  id: string;
  reference: string;
  totalPaid: number;
  currentState: number;
  dateAdd: string;
}
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

// ── Customers ─────────────────────────────────────────────────────────────────

export async function fetchSecureKey(customerId: string): Promise<string> {
  try {
    const res = await api.get(`/customers/${customerId}?display=[id,secure_key]`);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const key = doc.querySelector('secure_key')?.textContent?.trim() ?? '';
    return key;
  } catch {
    console.error('[fetchSecureKey] Failed for customer', customerId);
    return '';
  }
}

export async function fetchCustomerList(): Promise<CustomerSummary[]> {
  try {
    const res = await api.get(
      '/customers?display=[id,firstname,lastname,email,active]&filter[active]=[1]'
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const list: CustomerSummary[] = [];
    doc.querySelectorAll('customer').forEach((el) => {
      const id = el.querySelector('id')?.textContent?.trim();
      if (!id) return;
      list.push({
        id,
        email: el.querySelector('email')?.textContent?.trim() ?? '',
        firstname: el.querySelector('firstname')?.textContent?.trim() ?? '',
        lastname: el.querySelector('lastname')?.textContent?.trim() ?? '',
      });
    });
    return list;
  } catch {
    return [];
  }
}

export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  try {
    const res = await api.get(
      `/customers?display=[id,firstname,lastname,email,active]&filter[email]=[${email}]&filter[active]=[1]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const el = doc.querySelector('customer');
    if (!el) return null;
    const id = el.querySelector('id')?.textContent?.trim();
    if (!id) return null;
    const secureKey = await fetchSecureKey(id);
    return {
      id,
      email: el.querySelector('email')?.textContent?.trim() ?? email,
      firstname: el.querySelector('firstname')?.textContent?.trim() ?? '',
      lastname: el.querySelector('lastname')?.textContent?.trim() ?? '',
      secureKey,
    };
  } catch { return null; }
}

export async function registerCustomer(data: {
  email: string;
  firstname: string;
  lastname: string;
  passwd: string;
}): Promise<Customer> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<customer>
  <id_default_group><![CDATA[3]]></id_default_group>
  <id_lang><![CDATA[1]]></id_lang>
  <passwd><![CDATA[${data.passwd}]]></passwd>
  <lastname><![CDATA[${data.lastname}]]></lastname>
  <firstname><![CDATA[${data.firstname}]]></firstname>
  <email><![CDATA[${data.email}]]></email>
  <id_gender><![CDATA[1]]></id_gender>
  <newsletter><![CDATA[0]]></newsletter>
  <optin><![CDATA[0]]></optin>
  <active><![CDATA[1]]></active>
  <is_guest><![CDATA[0]]></is_guest>
  <id_shop><![CDATA[1]]></id_shop>
  <id_shop_group><![CDATA[1]]></id_shop_group>
</customer>
</prestashop>`;
  const res = await api.post('/customers', xml);
  const doc = new DOMParser().parseFromString(res.data, 'text/xml');
  const el = doc.querySelector('customer');
  if (!el) throw new Error('Échec de création du compte');
  const id = el.querySelector('id')?.textContent?.trim();
  if (!id) throw new Error('Échec de création du compte');
  const secureKey = await fetchSecureKey(id);
  return { id, email: data.email, firstname: data.firstname, lastname: data.lastname, secureKey };
}

// ── Addresses ─────────────────────────────────────────────────────────────────

export async function getCustomerAddresses(customerId: string): Promise<Address[]> {
  try {
    const res = await api.get(
      `/addresses?display=[id,alias,firstname,lastname,address1,address2,postcode,city,phone]&filter[id_customer]=[${customerId}]&filter[deleted]=[0]`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const list: Address[] = [];
    doc.querySelectorAll('address').forEach(el => {
      const id = el.querySelector('id')?.textContent?.trim();
      if (!id) return;
      list.push({
        id,
        alias: el.querySelector('alias')?.textContent?.trim() ?? '',
        firstname: el.querySelector('firstname')?.textContent?.trim() ?? '',
        lastname: el.querySelector('lastname')?.textContent?.trim() ?? '',
        address1: el.querySelector('address1')?.textContent?.trim() ?? '',
        address2: el.querySelector('address2')?.textContent?.trim() ?? '',
        postcode: el.querySelector('postcode')?.textContent?.trim() ?? '',
        city: el.querySelector('city')?.textContent?.trim() ?? '',
        phone: el.querySelector('phone')?.textContent?.trim() ?? '',
      });
    });
    return list;
  } catch { return []; }
}

export async function createAddress(data: CreateAddressData): Promise<string> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<address>
  <id_customer><![CDATA[${data.id_customer}]]></id_customer>
  <id_country><![CDATA[8]]></id_country>
  <id_state><![CDATA[0]]></id_state>
  <alias><![CDATA[${data.alias}]]></alias>
  <lastname><![CDATA[${data.lastname}]]></lastname>
  <firstname><![CDATA[${data.firstname}]]></firstname>
  <address1><![CDATA[${data.address1}]]></address1>
  <address2><![CDATA[${data.address2 ?? ''}]]></address2>
  <postcode><![CDATA[${data.postcode}]]></postcode>
  <city><![CDATA[${data.city}]]></city>
  <phone><![CDATA[${data.phone ?? ''}]]></phone>
  <deleted><![CDATA[0]]></deleted>
</address>
</prestashop>`;
  const res = await api.post('/addresses', xml);
  const doc = new DOMParser().parseFromString(res.data, 'text/xml');
  const id = doc.querySelector('address > id')?.textContent?.trim();
  if (!id) throw new Error('Échec de création de l\'adresse');
  return id;
}

// ── Cart ──────────────────────────────────────────────────────────────────────
export async function createPSCart(
  customerId: string,
  addressId: string,
  carrierId: string,
  items: CheckoutItem[],
  dateAdd?: string,  // Nouveau paramètre optionnel
  secureKey?: string
): Promise<string> {
  // Récupérer le secure_key si non fourni
  const key = secureKey || await fetchSecureKey(customerId);
  
  // Gérer la date : utiliser dateAdd si fournie, sinon date actuelle
  let cartDate = dateAdd;
  if (!cartDate) {
    cartDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    console.log(`[createPSCart] Aucune date fournie, utilisation de la date courante: ${cartDate}`);
  } else {
    console.log(`[createPSCart] Utilisation de la date fournie: ${cartDate}`);
  }

  const rowsXml = items.map(item => `
    <cart_row>
      <id_product><![CDATA[${item.id}]]></id_product>
      <id_product_attribute><![CDATA[${item.attributeId ?? '0'}]]></id_product_attribute>
      <id_address_delivery><![CDATA[${addressId}]]></id_address_delivery>
      <id_customization><![CDATA[0]]></id_customization>
      <quantity><![CDATA[${item.qty}]]></quantity>
    </cart_row>`).join('');

  console.log('[createPSCart] Debug payload:', {
    customerId, secureKey: key, addressId, carrierId,
    currencyId: 1, langId: 1, shopId: 1, shopGroupId: 1,
    cartRowsCount: items.length,
    dateAdd: cartDate
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<cart>
  <id_address_delivery><![CDATA[${addressId}]]></id_address_delivery>
  <id_address_invoice><![CDATA[${addressId}]]></id_address_invoice>
  <id_currency><![CDATA[1]]></id_currency>
  <id_customer><![CDATA[${customerId}]]></id_customer>
  <id_guest><![CDATA[0]]></id_guest>
  <id_lang><![CDATA[1]]></id_lang>
  <id_shop_group><![CDATA[1]]></id_shop_group>
  <id_shop><![CDATA[1]]></id_shop>
  <id_carrier><![CDATA[${carrierId}]]></id_carrier>
  <date_add><![CDATA[${cartDate}]]></date_add>
  <date_upd><![CDATA[${cartDate}]]></date_upd>
  <secure_key><![CDATA[${key}]]></secure_key>
  <recyclable><![CDATA[0]]></recyclable>
  <gift><![CDATA[0]]></gift>
  <mobile_theme><![CDATA[0]]></mobile_theme>
  <allow_seperated_package><![CDATA[0]]></allow_seperated_package>
  <associations>
    <cart_rows>${rowsXml}
    </cart_rows>
  </associations>
</cart>
</prestashop>`;
  
  // 1. Création du panier
  const res = await api.post('/carts', xml);
  const doc = new DOMParser().parseFromString(res.data, 'text/xml');
  const id = doc.querySelector('cart > id')?.textContent?.trim();
  if (!id) throw new Error('Échec de création du panier');
  
  // 2. FORCER LA DATE APRÈS CRÉATION (comme pour les commandes)
  if (dateAdd) {
    try {
      console.log(`Récupération panier ${id} pour mise à jour date...`);
      
      // Récupérer le XML complet du panier créé
      const getRes = await api.get(`/carts/${id}`);
      let cartXml = getRes.data as string;
      
      // Remplacer date_add et date_upd dans le XML retourné
      cartXml = cartXml
        .replace(
          /<date_add><!\[CDATA\[.*?\]\]><\/date_add>/,
          `<date_add><![CDATA[${dateAdd}]]></date_add>`
        )
        .replace(
          /<date_upd><!\[CDATA\[.*?\]\]><\/date_upd>/,
          `<date_upd><![CDATA[${dateAdd}]]></date_upd>`
        );
      
      // PUT avec le XML complet modifié
      await api.put(`/carts/${id}`, cartXml);
      console.log(`✅ Date mise à jour pour panier ${id}: ${dateAdd}`);
      
    } catch (updateError: any) {
      console.warn(`⚠️ Impossible de corriger la date du panier ${id}:`, 
        updateError?.response?.data ?? updateError.message);
      // Non bloquant
    }
  }
  
  return id;
}


export async function createPSOrder(params: {
  customerId: string;
  addressId: string;
  cartId: string;
  carrierId: string;
  items: CheckoutItem[];
  shippingCost: number;
  dateAdd?: string; 
}): Promise<string> {
  const totalProductsHt = params.items.reduce((s, i) => s + i.priceHt * i.qty, 0);
  const totalProductsTtc = params.items.reduce((s, i) => s + i.priceTtc * i.qty, 0);
  const shippingTaxRate = 0;
  const shippingHt = params.shippingCost;
  const shippingTtc = params.shippingCost;
  const totalPaidTtc = totalProductsTtc + shippingTtc;
  const totalPaidHt = totalProductsHt + shippingHt;
  const now = params.dateAdd || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const secureKey = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const rowsXml = params.items.map(item => `
    <order_row>
      <product_id><![CDATA[${item.id}]]></product_id>
      <product_attribute_id><![CDATA[${item.attributeId ?? '0'}]]></product_attribute_id>
      <product_quantity><![CDATA[${item.qty}]]></product_quantity>
      <product_name><![CDATA[${item.name}]]></product_name>
      <product_reference><![CDATA[]]></product_reference>
      <product_ean13><![CDATA[]]></product_ean13>
      <product_isbn><![CDATA[]]></product_isbn>
      <product_upc><![CDATA[]]></product_upc>
      <product_price><![CDATA[${item.priceHt.toFixed(6)}]]></product_price>
      <id_customization><![CDATA[0]]></id_customization>
      <unit_price_tax_incl><![CDATA[${item.priceTtc.toFixed(6)}]]></unit_price_tax_incl>
      <unit_price_tax_excl><![CDATA[${item.priceHt.toFixed(6)}]]></unit_price_tax_excl>
    </order_row>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<order>
  <id_address_delivery><![CDATA[${params.addressId}]]></id_address_delivery>
  <id_address_invoice><![CDATA[${params.addressId}]]></id_address_invoice>
  <id_cart><![CDATA[${params.cartId}]]></id_cart>
  <id_currency><![CDATA[1]]></id_currency>
  <id_lang><![CDATA[1]]></id_lang>
  <id_customer><![CDATA[${params.customerId}]]></id_customer>
  <id_carrier><![CDATA[${params.carrierId}]]></id_carrier>
  <current_state><![CDATA[1]]></current_state>
  <module><![CDATA[ps_checkpayment]]></module>
  <payment><![CDATA[Paiement accepté]]></payment>
  <invoice_number><![CDATA[0]]></invoice_number>
  <invoice_date><![CDATA[0000-00-00 00:00:00]]></invoice_date>
  <delivery_number><![CDATA[0]]></delivery_number>
  <delivery_date><![CDATA[0000-00-00 00:00:00]]></delivery_date>
  <valid><![CDATA[0]]></valid>
  <date_add><![CDATA[${now}]]></date_add>
  <date_upd><![CDATA[${now}]]></date_upd>
  <shipping_number><![CDATA[]]></shipping_number>
  <note><![CDATA[]]></note>
  <id_shop_group><![CDATA[1]]></id_shop_group>
  <id_shop><![CDATA[1]]></id_shop>
  <secure_key><![CDATA[${secureKey}]]></secure_key>
  <recyclable><![CDATA[0]]></recyclable>
  <gift><![CDATA[0]]></gift>
  <gift_message><![CDATA[]]></gift_message>
  <mobile_theme><![CDATA[0]]></mobile_theme>
  <total_discounts><![CDATA[0.000000]]></total_discounts>
  <total_discounts_tax_incl><![CDATA[0.000000]]></total_discounts_tax_incl>
  <total_discounts_tax_excl><![CDATA[0.000000]]></total_discounts_tax_excl>
  <total_paid><![CDATA[${totalPaidTtc.toFixed(6)}]]></total_paid>
  <total_paid_tax_incl><![CDATA[${totalPaidTtc.toFixed(6)}]]></total_paid_tax_incl>
  <total_paid_tax_excl><![CDATA[${totalPaidHt.toFixed(6)}]]></total_paid_tax_excl>
  <total_paid_real><![CDATA[0.000000]]></total_paid_real>
  <total_products><![CDATA[${totalProductsHt.toFixed(6)}]]></total_products>
  <total_products_wt><![CDATA[${totalProductsTtc.toFixed(6)}]]></total_products_wt>
  <total_shipping><![CDATA[${shippingTtc.toFixed(6)}]]></total_shipping>
  <total_shipping_tax_incl><![CDATA[${shippingTtc.toFixed(6)}]]></total_shipping_tax_incl>
  <total_shipping_tax_excl><![CDATA[${shippingHt.toFixed(6)}]]></total_shipping_tax_excl>
  <carrier_tax_rate><![CDATA[${(shippingTaxRate * 100).toFixed(6)}]]></carrier_tax_rate>
  <total_wrapping><![CDATA[0.000000]]></total_wrapping>
  <total_wrapping_tax_incl><![CDATA[0.000000]]></total_wrapping_tax_incl>
  <total_wrapping_tax_excl><![CDATA[0.000000]]></total_wrapping_tax_excl>
  <round_mode><![CDATA[2]]></round_mode>
  <round_type><![CDATA[1]]></round_type>
  <conversion_rate><![CDATA[1.000000]]></conversion_rate>
  <reference><![CDATA[]]></reference>
  <associations>
    <order_rows>${rowsXml}
    </order_rows>
  </associations>
</order>
</prestashop>`;

  // Création de la commande
  const res = await api.post('/orders', xml);
  const doc = new DOMParser().parseFromString(res.data, 'text/xml');
  const id = doc.querySelector('order > id')?.textContent?.trim();
  
  if (!id) throw new Error('Échec de création de la commande');

  // Force l'état 2 "Paiement accepté" via order_history — PS ignore current_state au POST
  try {
    const stateXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order_history>
    <id_order><![CDATA[${id}]]></id_order>
    <id_order_state><![CDATA[2]]></id_order_state>
    <id_employee><![CDATA[0]]></id_employee>
  </order_history>
</prestashop>`;
    await api.post('/order_histories', stateXml);
  } catch (stateErr: any) {
    console.warn('[createPSOrder] Impossible de forcer l\'état 2:', stateErr?.response?.data ?? stateErr.message);
  }

  // ✅ FIX : Forcer la date après création car PrestaShop ignore date_add au POST
  if (params.dateAdd) {
    try {
      console.log(`Récupération commande ${id} pour mise à jour date...`);
      
      // 1. Récupérer le XML complet de la commande créée
      const getRes = await api.get(`/orders/${id}`);
      let orderXml = getRes.data as string;
      
      // 2. Remplacer date_add et date_upd dans le XML retourné
      orderXml = orderXml
        .replace(
          /<date_add><!\[CDATA\[.*?\]\]><\/date_add>/,
          `<date_add><![CDATA[${params.dateAdd}]]></date_add>`
        )
        .replace(
          /<date_upd><!\[CDATA\[.*?\]\]><\/date_upd>/,
          `<date_upd><![CDATA[${params.dateAdd}]]></date_upd>`
        );

      // 3. PUT avec le XML complet modifié
      await api.put(`/orders/${id}`, orderXml);
      console.log(`✅ Date mise à jour pour commande ${id}: ${params.dateAdd}`);
      
    } catch (updateError: any) {
      console.warn(`⚠️ Impossible de corriger la date de la commande ${id}:`, 
        updateError?.response?.data ?? updateError.message);
      // Non bloquant
    }
  }

  
  
  return id;
}
// ── Order ─────────────────────────────────────────────────────────────────────


// ── Stock ─────────────────────────────────────────────────────────────────────

export async function updateStockAfterOrder(items: CheckoutItem[]): Promise<void> {
  for (const item of items) {
    const attributeId = item.attributeId ?? '0';
    try {
      const stockRes = await api.get(
        `/stock_availables?display=[id,quantity,id_product,id_product_attribute,depends_on_stock,out_of_stock]&filter[id_product]=[${item.id}]&filter[id_product_attribute]=[${attributeId}]`
      );
      const doc = new DOMParser().parseFromString(stockRes.data, 'text/xml');
      const el = doc.querySelector('stock_available');
      if (!el) continue;
      const stockId = el.querySelector('id')?.textContent?.trim();
      const currentQty = parseInt(el.querySelector('quantity')?.textContent ?? '0', 10);
      if (!stockId) continue;
      const newQty = Math.max(0, currentQty - item.qty);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<stock_available>
  <id><![CDATA[${stockId}]]></id>
  <id_product><![CDATA[${item.id}]]></id_product>
  <id_product_attribute><![CDATA[${attributeId}]]></id_product_attribute>
  <quantity><![CDATA[${newQty}]]></quantity>
  <depends_on_stock><![CDATA[0]]></depends_on_stock>
  <out_of_stock><![CDATA[2]]></out_of_stock>
</stock_available>
</prestashop>`;
      await api.put(`/stock_availables/${stockId}`, xml);
    } catch { /* continue */ }
  }
}

// ── Customer orders ───────────────────────────────────────────────────────────
export async function getCustomerOrders(customerId: string): Promise<PSCustomerOrder[]> {
  try {
    // Format correct qui fonctionne avec votre PrestaShop
    const url = `/orders?display=[id,reference,total_paid,current_state,date_add,id_customer]&filter[id_customer]=${customerId}`;

    const res = await api.get(url);
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    
    const orders: PSCustomerOrder[] = [];
    
    doc.querySelectorAll('order').forEach(el => {
      const id = el.querySelector('id')?.textContent?.trim();
      if (!id) return;
      
      orders.push({
        id,
        reference: el.querySelector('reference')?.textContent?.trim() ?? `#${id}`,
        totalPaid: parseFloat(el.querySelector('total_paid')?.textContent ?? '0'),
        currentState: parseInt(el.querySelector('current_state')?.textContent ?? '0', 10),
        dateAdd: el.querySelector('date_add')?.textContent?.trim() ?? '',
      });
    });

    return orders;
  } catch (error) {
    console.error('Failed to fetch customer orders:', error);
    return [];
  }
}
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