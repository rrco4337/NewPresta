import axios from 'axios';
import type { CartItem } from '../contexts/CartContext';
import { fetchSecureKey, getCustomerAddresses } from './customerService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RemoteCartResult {
  cartId: string;
  items: { productId: string; quantity: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get the first valid address for a customer, or '0' if none found.
 */
async function resolveAddressId(customerId: string): Promise<string> {
  try {
    const addresses = await getCustomerAddresses(customerId);
    return addresses.length > 0 ? addresses[0].id : '0';
  } catch {
    return '0';
  }
}

/**
 * Get the secure_key: from sessionStorage first, then fetch if missing.
 */
async function resolveSecureKey(customerId: string): Promise<string> {
  const cached = sessionStorage.getItem('customerSecureKey');
  if (cached) return cached;
  const key = await fetchSecureKey(customerId);
  if (key) sessionStorage.setItem('customerSecureKey', key);
  return key;
}

// ── Fetch existing customer cart ──────────────────────────────────────────────

/**
 * Fetch the most recent cart for a given customer from PrestaShop.
 * Returns the cart ID and its product rows, or null if no cart exists.
 */
export async function fetchCustomerCart(customerId: string): Promise<RemoteCartResult | null> {
  try {
    const res = await api.get(
      `/carts?display=full&filter[id_customer]=[${customerId}]&sort=[id_DESC]&limit=1`
    );
    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const cartEl = doc.querySelector('cart');
    if (!cartEl) return null;

    const cartId = cartEl.querySelector('id')?.textContent?.trim();
    if (!cartId) return null;

    const items: RemoteCartResult['items'] = [];
    cartEl.querySelectorAll('cart_row').forEach(row => {
      const productId = row.querySelector('id_product')?.textContent?.trim();
      const quantity = parseInt(row.querySelector('quantity')?.textContent ?? '0', 10);
      if (productId && quantity > 0) {
        items.push({ productId, quantity });
      }
    });

    console.log('[fetchCustomerCart] Found remote cart:', { cartId, itemCount: items.length });
    return { cartId, items };
  } catch (err) {
    console.error('[fetchCustomerCart] Error:', err);
    return null;
  }
}

// ── Sync local cart to PrestaShop ─────────────────────────────────────────────

interface SyncParams {
  customerId: string;
  items: CartItem[];
  existingCartId?: string;
}

/**
 * Create or update a remote PrestaShop cart.
 * Returns the cart ID on success, or null on failure.
 */
export async function syncRemoteCart(params: SyncParams): Promise<string | null> {
  const { customerId, items, existingCartId } = params;

  if (items.length === 0) {
    console.log('[syncRemoteCart] Cart is empty, skipping sync.');
    return existingCartId ?? null;
  }

  try {
    // Resolve all required fields
    const secureKey = await resolveSecureKey(customerId);
    const addressId = await resolveAddressId(customerId);

    // Validate required fields
    if (!secureKey) {
      console.error('[syncRemoteCart] Missing secure_key — aborting sync.');
      return null;
    }

    const carrierId = '1'; // Default: Click and collect
    const currencyId = '1';
    const langId = '1';
    const shopId = '1';
    const shopGroupId = '1';

    // Debug log before API call
    console.log('[syncRemoteCart] Debug payload:', {
      customerId,
      secureKey,
      addressId,
      currencyId,
      langId,
      carrierId,
      shopId,
      shopGroupId,
      cartRowsCount: items.length,
      existingCartId: existingCartId ?? 'none (will create)',
    });

    // Build cart_rows XML
    const rowsXml = items.map(item => `
      <cart_row>
        <id_product><![CDATA[${item.id}]]></id_product>
        <id_product_attribute><![CDATA[0]]></id_product_attribute>
        <id_address_delivery><![CDATA[${addressId}]]></id_address_delivery>
        <quantity><![CDATA[${item.qty}]]></quantity>
      </cart_row>`).join('');

    // Build full cart XML
    const cartIdTag = existingCartId
      ? `<id><![CDATA[${existingCartId}]]></id>`
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
<cart>
  ${cartIdTag}
  <id_shop><![CDATA[${shopId}]]></id_shop>
  <id_shop_group><![CDATA[${shopGroupId}]]></id_shop_group>
  <id_currency><![CDATA[${currencyId}]]></id_currency>
  <id_lang><![CDATA[${langId}]]></id_lang>
  <id_customer><![CDATA[${customerId}]]></id_customer>
  <id_address_delivery><![CDATA[${addressId}]]></id_address_delivery>
  <id_address_invoice><![CDATA[${addressId}]]></id_address_invoice>
  <id_carrier><![CDATA[${carrierId}]]></id_carrier>
  <secure_key><![CDATA[${secureKey}]]></secure_key>
  <id_guest><![CDATA[0]]></id_guest>
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

    let res;
    if (existingCartId) {
      res = await api.put(`/carts/${existingCartId}`, xml);
    } else {
      res = await api.post('/carts', xml);
    }

    const doc = new DOMParser().parseFromString(res.data, 'text/xml');
    const newCartId = doc.querySelector('cart > id')?.textContent?.trim();
    if (!newCartId) {
      console.error('[syncRemoteCart] No cart ID in response.');
      return null;
    }

    console.log('[syncRemoteCart] Success — cart ID:', newCartId);
    return newCartId;
  } catch (err) {
    console.error('[syncRemoteCart] Error syncing cart:', err);
    return null;
  }
}
