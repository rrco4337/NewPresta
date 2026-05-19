import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ==========================================
// 1. TYPES
// ==========================================

/** Une ligne de stock unitaire — produit simple ou déclinaison */
export interface StockLine {
  key: string;
  productId: string;
  productName: string;
  productType: 'simple' | 'combinations';
  combinationId: string | null;
  combinationLabel: string;
  stockId: string;
  quantity: number;
  reference: string;
  ean13: string;
}

/** Un mouvement de stock enregistré localement */
export interface StockMovement {
  id: string;
  key: string;
  productId: string;
  productName: string;
  combinationLabel: string;
  combinationId: string | null;
  stockId: string;
  quantityBefore: number;
  quantityAdded: number;
  quantityAfter: number;
  date: string;
  note: string;
}

/** Stock par catégorie */
export interface CategoryStock {
  categoryId: string;
  categoryName: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

// ==========================================
// 2. AXIOS INSTANCES
// ==========================================

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
});

const moduleApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_PRESTASHOP_URL || 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml',
    'X-Api-Key': import.meta.env.VITE_STOCKAPI_KEY ?? '',
  },
});

// ==========================================
// 3. HELPERS XML GÉNÉRIQUES
// ==========================================

function parseXML(xmlString: string): unknown {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  function walk(node: Element): unknown {
    if (node.children.length === 0) return node.textContent ?? '';
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const key = child.nodeName;
      const val = walk(child);
      if (key in obj) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        (obj[key] as unknown[]).push(val);
      } else {
        obj[key] = val;
      }
    }
    return obj;
  }

  return walk(doc.documentElement);
}

function getRoot(parsed: unknown): Record<string, unknown> | null {
  if (!isObj(parsed)) return null;
  const ps = isObj(parsed.prestashop) ? parsed.prestashop : parsed;
  return isObj(ps) ? ps : null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getLang(field: unknown): string {
  if (!isObj(field)) return typeof field === 'string' ? field : '';
  const lang = field.language;
  if (!lang) return '';
  const target = Array.isArray(lang) ? lang[0] : lang;
  if (!isObj(target)) return typeof target === 'string' ? target : '';
  return String((target as any)._cdata ?? (target as any)._text ?? target ?? '');
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function buildStockUpdateXml(
  idProduct: string | number,
  idProductAttribute: string | number,
  delta: number
): string {
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<prestashop><stock_update>' +
    '<id_product><![CDATA[' + idProduct + ']]></id_product>' +
    '<id_product_attribute><![CDATA[' + idProductAttribute + ']]></id_product_attribute>' +
    '<delta><![CDATA[' + delta + ']]></delta>' +
    '</stock_update></prestashop>';
}

function parseStockUpdateResponse(xmlString: string): {
  success: boolean;
  newQty: number;
  error?: string;
} {
  const parsed = parseXML(xmlString) as any;
  const node = parsed?.prestashop?.stock_update ?? parsed?.stock_update;
  if (!node) return { success: false, newQty: 0, error: 'Réponse XML invalide' };
  return {
    success: String(node.success ?? '0') === '1',
    newQty: parseInt(String(node.new_quantity ?? '0'), 10),
    error: node.error ? String(node.error) : undefined,
  };
}

// ==========================================
// 4. FETCHERS INTERNES
// ==========================================

interface RawProduct {
  id: string;
  name: string;
  reference: string;
  ean13: string;
  type: string;
  active: string;
  combinationIds: string[];
}

interface RawCombination {
  id: string;
  id_product: string;
  reference: string;
  ean13: string;
  optionValueIds: string[];
}

interface RawStockAvailable {
  id: string;
  id_product: string;
  id_product_attribute: string;
  quantity: number;
}

async function fetchProducts(): Promise<Map<string, RawProduct>> {
  const res = await api.get('/products?display=full');
  const root = getRoot(parseXML(res.data));
  const container = root && isObj(root.products) ? root.products : null;
  const raw = toArray((container as any)?.product);

  const map = new Map<string, RawProduct>();
  for (const p of raw) {
    if (!isObj(p)) continue;
    const id = String(p.id ?? '');
    if (!id) continue;

    const rawType = String((p as any).type ?? (p as any).product_type ?? '').toLowerCase();
    const comboAssoc = toArray((p as any).associations?.combinations?.combination);
    const isCombinations = rawType === 'combinations' || rawType === 'configurable' || rawType === '2' || comboAssoc.length > 0;
    const combinationIds = comboAssoc.map((c: any) => String(isObj(c) ? (c.id ?? '') : c)).filter(Boolean);

    map.set(id, {
      id,
      name: getLang(p.name),
      reference: String(p.reference ?? ''),
      ean13: String(p.ean13 ?? ''),
      type: isCombinations ? 'combinations' : 'simple',
      active: String(p.active ?? '0'),
      combinationIds,
    });
  }
  return map;
}

async function fetchCombinations(): Promise<RawCombination[]> {
  try {
    const res = await api.get('/combinations?display=full');
    const root = getRoot(parseXML(res.data));
    const container = root && isObj(root.combinations) ? root.combinations : null;
    const raw = toArray((container as any)?.combination);

    return raw.filter(isObj).map((c: any) => {
      const pov = isObj(c.associations?.product_option_values) ? c.associations.product_option_values : null;
      const ovItems = toArray((pov as any)?.product_option_value);
      const optionValueIds = ovItems.map((ov: any) => String(isObj(ov) ? (ov.id ?? '') : ov)).filter(Boolean);

      return {
        id: String(c.id ?? ''),
        id_product: String(c.id_product ?? ''),
        reference: String(c.reference ?? ''),
        ean13: String(c.ean13 ?? ''),
        optionValueIds,
      };
    }).filter(c => c.id && c.id_product);
  } catch {
    return [];
  }
}

async function fetchStockAvailables(): Promise<RawStockAvailable[]> {
  const res = await api.get('/stock_availables?display=full');
  const root = getRoot(parseXML(res.data));
  const container = root && isObj(root.stock_availables) ? root.stock_availables : null;
  const raw = toArray((container as any)?.stock_available);

  return raw.filter(isObj).map((s: any) => ({
    id: String(s.id ?? ''),
    id_product: String(s.id_product ?? ''),
    id_product_attribute: String(s.id_product_attribute ?? '0'),
    quantity: parseInt(String(s.quantity ?? '0'), 10),
  }));
}

async function fetchOptionValueNames(): Promise<Map<string, string>> {
  try {
    const res = await api.get('/product_option_values?display=full');
    const root = getRoot(parseXML(res.data));
    const container = root && isObj(root.product_option_values) ? root.product_option_values : null;
    const raw = toArray((container as any)?.product_option_value);

    const map = new Map<string, string>();
    for (const ov of raw) {
      if (!isObj(ov)) continue;
      const id = String(ov.id ?? '');
      const name = getLang(ov.name);
      if (id) map.set(id, name);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function sendMovementToAPI(movement: {
  id: string;
  key: string;
  id_product: number;
  product_name: string;
  combination_label: string;
  id_stock_available: number;
  quantity_before: number;
  quantity_added: number;
  quantity_after: number;
  note: string;
  date?: string;
}): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <movement>
    <id><![CDATA[${movement.id}]]></id>
    <key><![CDATA[${movement.key}]]></key>
    <id_product><![CDATA[${movement.id_product}]]></id_product>
    <product_name><![CDATA[${movement.product_name}]]></product_name>
    <combination_label><![CDATA[${movement.combination_label}]]></combination_label>
    <id_stock_available><![CDATA[${movement.id_stock_available}]]></id_stock_available>
    <quantity_before><![CDATA[${movement.quantity_before}]]></quantity_before>
    <quantity_added><![CDATA[${movement.quantity_added}]]></quantity_added>
    <quantity_after><![CDATA[${movement.quantity_after}]]></quantity_after>
    <date><![CDATA[${movement.date || new Date().toISOString()}]]></date>
    <note><![CDATA[${movement.note}]]></note>
  </movement>
</prestashop>`;

  await moduleApi.post('/stockapi.php?action=add_movement', xml);
}

// ==========================================
// 5. STOCK PAR CATÉGORIE - HELPERS
// ==========================================
function parseCategoriesXml(
  xmlString: string
): Array<{ id: string; name: string; depth: number }> {

  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');

  const categories: Array<{
    id: string;
    name: string;
    depth: number;
  }> = [];

  // IMPORTANT :
  // On récupère UNIQUEMENT les catégories racines
  // et pas les <category> imbriqués dans associations
  const categoriesRoot = doc.querySelector('categories');

  if (!categoriesRoot) {
    return [];
  }

  const categoryEls = Array.from(categoriesRoot.children)
    .filter((el) => el.tagName === 'category');

  for (const el of categoryEls) {
    const id =
      el.querySelector(':scope > id')
        ?.textContent
        ?.trim() ?? '';

    const name =
      el.querySelector(':scope > name')
        ?.textContent
        ?.trim() ?? '';

    const depth = parseInt(
      el.querySelector(':scope > level_depth')
        ?.textContent
        ?.trim() ?? '0',
      10
    );

    if (id && name) {
      categories.push({
        id,
        name,
        depth,
      });
    }
  }

  return categories;
}

async function parseProductsWithStockXml(xmlString: string): Promise<Array<{
  id: string;
  name: string;
  categoryDefaultId: string;
  physicalQuantity: number;
  outOfStock: boolean;
}>> {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const products: Array<{
    id: string;
    name: string;
    categoryDefaultId: string;
    physicalQuantity: number;
    outOfStock: boolean;
  }> = [];

  // Chercher les produits dans différentes structures possibles
  let productEls = doc.querySelectorAll('product');
  
  // Si pas trouvé, essayer une autre structure
  if (productEls.length === 0) {
    productEls = doc.querySelectorAll('prestashop product');
  }

  for (const el of productEls) {
    const id = el.querySelector('id')?.textContent?.trim() ?? '';
    const name = el.querySelector('name')?.textContent?.trim() ?? '';
    
    // Chercher id_category_default dans différentes structures
   const categoryDefaultId =
  el.querySelector('id_category_default')
    ?.textContent
    ?.trim() ?? '';

    if (!id || !categoryDefaultId) continue;

    try {
      // Récupérer les infos de stock détaillées pour ce produit
      const stockRes = await api.get(`/stock_availables?filter[id_product]=[${id}]&display=full`);
      const stockDoc = new DOMParser().parseFromString(stockRes.data, 'text/xml');
      
      let physicalQuantity = 0;
     const stockEls = stockDoc.querySelectorAll('stock_available');

 stockEls.forEach((stockEl) => {
  const attrId = stockEl.querySelector('id_product_attribute')
    ?.textContent?.trim() ?? '0';
  const qty = parseInt(
    stockEl.querySelector('quantity')?.textContent?.trim() ?? '0',
    10
  );
  const hasMultipleEntries = stockEls.length > 1;
  if (hasMultipleEntries && attrId === '0') return;

  physicalQuantity += qty;
 
  });
        
      const outOfStock = el.querySelector('out_of_stock')?.textContent?.trim() === '1';
      
      products.push({
        id,
        name,
        categoryDefaultId,
        physicalQuantity,
        outOfStock,
      });
    } catch (err) {
      console.warn(`Impossible de récupérer le stock pour le produit ${id}`);
      products.push({
        id,
        name,
        categoryDefaultId,
        physicalQuantity: 0,
        outOfStock: false,
      });
    }
  }
  
  return products;
}

async function getReservedQuantitiesByProductStatic(ordersXml: string): Promise<Map<string, number>> {
  const reservedMap = new Map<string, number>();
  const doc = new DOMParser().parseFromString(ordersXml, 'text/xml');

  const orders = Array.from(doc.querySelectorAll('order'));

  for (const order of orders) {
    const currentState = parseInt(order.querySelector('current_state')?.textContent?.trim() ?? '0', 10);

    // Seules les commandes non livrées (état 1 ou 2) réservent du stock
    if (currentState !== 1 && currentState !== 2) continue;

    const orderId = order.querySelector('id')?.textContent?.trim();
    if (!orderId) continue;

    try {
      const orderDetailsRes = await api.get(`/orders/${orderId}?display=full`);
      const orderDoc = new DOMParser().parseFromString(orderDetailsRes.data, 'text/xml');

      const orderRows = orderDoc.querySelectorAll('order_detail, order_row');

      orderRows.forEach((row) => {
        const productId = row.querySelector('product_id')?.textContent?.trim() ?? '';
        const quantity = parseInt(row.querySelector('product_quantity')?.textContent?.trim() ?? '0', 10);

        if (productId && quantity > 0) {
          const currentReserved = reservedMap.get(productId) || 0;
          reservedMap.set(productId, currentReserved + quantity);
        }
      });
    } catch (err) {
      console.warn(`Impossible de récupérer les détails de la commande ${orderId}`);
    }
  }

  return reservedMap;
}

async function getStockByCategoryStatic(): Promise<CategoryStock[]> {
  try {
    // 1️⃣ Récupérer toutes les catégories
    const categoriesRes = await api.get('/categories?display=full');
    const categories = parseCategoriesXml(categoriesRes.data);

    // 2️⃣ Récupérer tous les produits (sans filtre display complexe)
    const productsRes = await api.get('/products?display=full');
    const products = await parseProductsWithStockXml(productsRes.data);

    // 3️⃣ Récupérer toutes les commandes en cours
    const ordersRes = await api.get('/orders?display=full');
    const reservedQuantities = await getReservedQuantitiesByProductStatic(ordersRes.data);

    // 4️⃣ Créer un map des stocks par catégorie
    const categoryStockMap = new Map<string, CategoryStock>();

    for (const cat of categories) {
      categoryStockMap.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        physicalQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
      });
    }

    // 5️⃣ Agréger les stocks par catégorie
    for (const product of products) {
      const catId = product.categoryDefaultId;
      const stock = categoryStockMap.get(catId);

      if (stock) {
     const reserved = reservedQuantities.get(product.id) || 0;
// quantity PS = physique - réservé → physique réel = quantity + réservé
stock.physicalQuantity += product.physicalQuantity + reserved;
stock.reservedQuantity += reserved;
stock.availableQuantity = stock.physicalQuantity - stock.reservedQuantity;
      }
    }

    // 6️⃣ Convertir en tableau et trier
    const result = Array.from(categoryStockMap.values())
      .filter(cat => cat.physicalQuantity > 0 || cat.reservedQuantity > 0)
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    return result;
  } catch (error) {
    console.error('Erreur lors de la récupération des stocks par catégorie:', error);
    return [];
  }
}
// ==========================================
// 6. STOCKAGE LOCAL DES MOUVEMENTS
// ==========================================

const MOVEMENTS_KEY = 'ps_stock_movements_v1';
const MAX_MOVEMENTS = 1000;

function readMovements(): StockMovement[] {
  try {
    const raw = localStorage.getItem(MOVEMENTS_KEY);
    return raw ? (JSON.parse(raw) as StockMovement[]) : [];
  } catch {
    return [];
  }
}

function writeMovement(m: StockMovement): void {
  const all = readMovements();
  all.unshift(m);
  try {
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(all.slice(0, MAX_MOVEMENTS)));
  } catch {
    console.error('[stockService] Impossible de sauvegarder le mouvement');
  }
}

// ==========================================
// 7. SERVICE PUBLIC EXPORTÉ
// ==========================================

export const stockService = {
  getAllStockLines: async (): Promise<StockLine[]> => {
    const [products, combinations, stockAvailables, optionValues] = await Promise.all([
      fetchProducts(),
      fetchCombinations(),
      fetchStockAvailables(),
      fetchOptionValueNames(),
    ]);

    const stockMap = new Map<string, RawStockAvailable>();
    for (const s of stockAvailables) {
      stockMap.set(`${s.id_product}_${s.id_product_attribute}`, s);
    }

    const lines: StockLine[] = [];

    for (const [productId, product] of products) {
      if (product.active !== '1') continue;

      const isCombinations = product.type === 'combinations';

      if (isCombinations) {
        const productComboIds = new Set(product.combinationIds);
        const combos = combinations.filter(c =>
          c.id_product === productId &&
          (productComboIds.size === 0 || productComboIds.has(c.id))
        );

        for (const combo of combos) {
          const stock = stockMap.get(`${productId}_${combo.id}`);
          if (!stock) continue;

          const label = combo.optionValueIds
            .map(vid => optionValues.get(vid) ?? vid)
            .join(' / ');

          lines.push({
            key: `${productId}_${combo.id}`,
            productId,
            productName: product.name,
            productType: 'combinations',
            combinationId: combo.id,
            combinationLabel: label,
            stockId: stock.id,
            quantity: stock.quantity,
            reference: combo.reference || product.reference,
            ean13: combo.ean13 || product.ean13,
          });
        }
      } else {
        const stock = stockMap.get(`${productId}_0`);
        if (!stock) continue;

        lines.push({
          key: `${productId}_0`,
          productId,
          productName: product.name,
          productType: 'simple',
          combinationId: null,
          combinationLabel: '',
          stockId: stock.id,
          quantity: stock.quantity,
          reference: product.reference,
          ean13: product.ean13,
        });
      }
    }

    return lines;
  },

  addStock: async (line: StockLine, qty: number, note = ''): Promise<StockLine> => {
    if (qty <= 0) throw new Error('La quantité doit être > 0');

    const xml = buildStockUpdateXml(line.productId, line.combinationId ?? 0, qty);
    const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);
    const result = parseStockUpdateResponse(rawXml);
    if (!result.success) throw new Error(result.error ?? 'Erreur serveur');

    const newQty = result.newQty;

    const nativeXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_mvt>
    <id_employee><![CDATA[1]]></id_employee>
    <id_stock><![CDATA[${line.stockId}]]></id_stock>
    <id_stock_mvt_reason><![CDATA[1]]></id_stock_mvt_reason>
    <physical_quantity><![CDATA[${qty}]]></physical_quantity>
    <sign><![CDATA[1]]></sign>
    <price_te><![CDATA[0]]></price_te>
    <date_add><![CDATA[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]]></date_add>
  </stock_mvt>
</prestashop>`;

    try {
      await api.post('/stock_movements', nativeXml);
    } catch (err: any) {
      console.error('❌ Erreur API native:', err.response?.status);
    }

    const movementId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await sendMovementToAPI({
      id: movementId,
      key: line.key,
      id_product: parseInt(line.productId, 10),
      product_name: line.productName,
      combination_label: line.combinationLabel,
      id_stock_available: parseInt(line.stockId, 10),
      quantity_before: line.quantity,
      quantity_added: qty,
      quantity_after: newQty,
      note,
      date: new Date().toISOString(),
    });

    return { ...line, quantity: newQty };
  },

  removeStock: async (line: StockLine, qty: number, note = ''): Promise<StockLine> => {
    if (qty <= 0) throw new Error('La quantité doit être > 0');
    if (qty > line.quantity) throw new Error(`Stock insuffisant (disponible : ${line.quantity})`);

    const xml = buildStockUpdateXml(line.productId, line.combinationId ?? 0, -qty);
    const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);
    const result = parseStockUpdateResponse(rawXml);
    if (!result.success) throw new Error(result.error ?? 'Erreur serveur');

    const newQty = result.newQty;

    const nativeXml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_mvt>
    <id_employee><![CDATA[1]]></id_employee>
    <id_stock><![CDATA[${line.stockId}]]></id_stock>
    <id_stock_mvt_reason><![CDATA[2]]></id_stock_mvt_reason>
    <physical_quantity><![CDATA[${qty}]]></physical_quantity>
    <sign><![CDATA[-1]]></sign>
    <price_te><![CDATA[0]]></price_te>
    <date_add><![CDATA[${new Date().toISOString().slice(0, 19).replace('T', ' ')}]]></date_add>
  </stock_mvt>
</prestashop>`;

    try {
      await api.post('/stock_movements', nativeXml);
    } catch (err: any) {
      console.error('❌ Erreur API native (sortie):', err.response?.status);
    }

    const movementId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await sendMovementToAPI({
      id: movementId,
      key: line.key,
      id_product: parseInt(line.productId, 10),
      product_name: line.productName,
      combination_label: line.combinationLabel,
      id_stock_available: parseInt(line.stockId, 10),
      quantity_before: line.quantity,
      quantity_added: -qty,
      quantity_after: newQty,
      note,
      date: new Date().toISOString(),
    });

    return { ...line, quantity: newQty };
  },

  recordOrderMovements: async (
    rows: Array<{ productId: string; combinationId: string; quantity: number }>,
    orderRef: string,
    direction: 'sortie' | 'entree'
  ): Promise<void> => {
    const allLines = await stockService.getAllStockLines();
    const lineMap = new Map(allLines.map(l => [l.key, l]));

    for (const row of rows) {
      const attrId = row.combinationId === '0' ? '0' : row.combinationId;
      const key = `${row.productId}_${attrId}`;
      const line = lineMap.get(key);
      if (!line) {
        console.warn(`[stockService] recordOrderMovements: ligne introuvable pour ${key}`);
        continue;
      }
      try {
        if (direction === 'sortie') {
          // PS decrements stock_available automatically via order_history;
          // only record the movement to avoid double-decrement
          await stockService.addMouvementStock(
            line.stockId, line.productId, line.combinationId ?? '0',
            -row.quantity, line.quantity,
          );
        } else {
          const note = `Retour commande ${orderRef}`;
          await stockService.addStock(line, row.quantity, note);
        }
      } catch (err) {
        console.error(`[stockService] recordOrderMovements: erreur pour ${key}`, err);
      }
    }
  },

  addMouvementStock: async (
    stockId: string,
    productId: string,
    combinationId: string,
    quantityAdded: number,
    quantityBefore: number,
    customDate?: string
  ): Promise<void> => {
    const dateToUse = customDate ?? new Date().toISOString().slice(0, 19).replace('T', ' ');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_mvt>
    <id_employee><![CDATA[1]]></id_employee>
    <id_stock><![CDATA[${stockId}]]></id_stock>
    <id_stock_mvt_reason><![CDATA[${quantityAdded >= 0 ? 1 : 2}]]></id_stock_mvt_reason>
    <physical_quantity><![CDATA[${Math.abs(quantityAdded)}]]></physical_quantity>
    <sign><![CDATA[${quantityAdded >= 0 ? 1 : -1}]]></sign>
    <price_te><![CDATA[0]]></price_te>
    <date_add><![CDATA[${dateToUse}]]></date_add>
  </stock_mvt>
</prestashop>`;

    try {
      const postRes = await api.post('/stock_movements', xml);
      const postDoc = new DOMParser().parseFromString(postRes.data, 'text/xml');
      const mvtId = postDoc.querySelector('stock_mvt > id')?.textContent?.trim();

      if (customDate && mvtId) {
        try {
          const getRes = await api.get(`/stock_movements/${mvtId}`);
          let mvtXml = getRes.data as string;
          mvtXml = mvtXml.replace(
            /<date_add><!\[CDATA\[.*?\]\]><\/date_add>/,
            `<date_add><![CDATA[${customDate}]]></date_add>`
          );
          await api.put(`/stock_movements/${mvtId}`, mvtXml);
        } catch (updateErr: any) {
          console.warn(`⚠️ Impossible de corriger la date du mouvement ${mvtId}`);
        }
      }
    } catch (err: any) {
      console.warn('[addMouvementStock] Impossible d\'enregistrer le mouvement', err);
    }
  },

  getAllMovements: async (): Promise<StockMovement[]> => {
    try {
      // 1. stockId → {productId, attributeId}
      const stockRes = await api.get('/stock_availables?display=full');
      const stockParsed = parseXML(stockRes.data) as any;
      const stockRoot = stockParsed?.prestashop ?? stockParsed;
      const allStocks = toArray(stockRoot?.stock_availables?.stock_available ?? []);

      const stockMap = new Map<string, { productId: string; attributeId: string }>();
      for (const s of allStocks) {
        if (!isObj(s)) continue;
        const id = String((s as any).id ?? '').trim();
        const productId = String((s as any).id_product ?? '').trim();
        const attributeId = String((s as any).id_product_attribute ?? '0').trim();
        if (id && productId) stockMap.set(id, { productId, attributeId });
      }

      // 2. productId → name
      const products = await fetchProducts();

      // 3. All movements
      const mvtRes = await api.get('/stock_movements?display=full');
      const parsed = parseXML(mvtRes.data) as any;
      const root = parsed?.prestashop ?? parsed;
      const rawMovements = toArray(root?.stock_movements?.stock_mvt ?? root?.stock_mvts?.stock_mvt ?? []);

      const movements: StockMovement[] = rawMovements
        .map((mvt: any): StockMovement | null => {
          if (!isObj(mvt)) return null;
          const stockId = String((mvt as any).id_stock ?? '').trim();
          const stockInfo = stockMap.get(stockId);
          if (!stockInfo) return null;

          const product = products.get(stockInfo.productId);
          if (!product) return null; // produit supprimé — données fantômes, on ignore

          const physical = parseInt(String((mvt as any).physical_quantity ?? '0'), 10);
          const sign = parseInt(String((mvt as any).sign ?? '1'), 10);
          const date = String((mvt as any).date_add ?? '');
          const mvtId = String((mvt as any).id ?? '');

          return {
            id: mvtId,
            key: mvtId,
            productId: stockInfo.productId,
            productName: product.name,
            combinationLabel: stockInfo.attributeId !== '0' ? `Déclinaison #${stockInfo.attributeId}` : '',
            combinationId: stockInfo.attributeId !== '0' ? stockInfo.attributeId : null,
            stockId,
            quantityAdded: physical * sign,
            quantityBefore: 0,
            quantityAfter: 0,
            date,
            note: '',
          };
        })
        .filter((m): m is StockMovement => m !== null);

      movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return movements;
    } catch (err: any) {
      console.error('[getAllMovements] ERROR:', err.message);
      return [];
    }
  },

  getMovements: async (productId: string, combinationId?: string | null): Promise<StockMovement[]> => {
    console.log('[getMovements] === DÉBUT ===', { productId, combinationId });

    try {
      if (!productId) return [];

      const stockRes = await api.get(`/stock_availables?filter[id_product]=[${productId}]&display=full`);
      const stockParsed = parseXML(stockRes.data) as any;
      const stockRoot = stockParsed?.prestashop ?? stockParsed?.Prestashop ?? stockParsed;
      let stockAvailables = toArray(stockRoot?.stock_availables?.stock_available ?? []);

      const targetAttributeId = (combinationId && combinationId !== '0') ? combinationId : '0';

      stockAvailables = stockAvailables.filter((s: any) => {
        const attrId = String(s.id_product_attribute?.['#text'] ?? s.id_product_attribute ?? '0').trim();
        return attrId === targetAttributeId;
      });

      const stockMap = new Map<string, { productId: string; attributeId: string }>();
      stockAvailables.forEach((s: any) => {
        const idStock = String(s.id_stock_available?.['#text'] ?? s.id_stock_available ?? s.id?.['#text'] ?? s.id ?? '').trim();
        if (!idStock || idStock === 'undefined') return;
        const prodId = String(s.id_product?.['#text'] ?? s.id_product ?? '').trim();
        const attrId = String(s.id_product_attribute?.['#text'] ?? s.id_product_attribute ?? '0').trim();
        stockMap.set(idStock, { productId: prodId, attributeId: attrId });
      });

      const mvtRes = await api.get('/stock_movements?display=full');
      const parsed = parseXML(mvtRes.data) as any;
      const root = parsed?.prestashop ?? parsed?.Prestashop ?? parsed;
      const rawMovements = toArray(root?.stock_movements?.stock_mvt ?? root?.stock_mvts?.stock_mvt ?? []);

      const validStockIds = new Set(stockMap.keys());

      const movements: StockMovement[] = rawMovements
        .map((mvt: any): StockMovement | null => {
          const stockId = String(mvt.id_stock?.['#text'] ?? mvt.id_stock ?? '').trim();
          if (!validStockIds.has(stockId)) return null;

          const stockInfo = stockMap.get(stockId);
          if (!stockInfo) return null;

          const physical = parseInt(mvt.physical_quantity?.['#text'] ?? mvt.physical_quantity ?? '0', 10);
          const sign = parseInt(mvt.sign?.['#text'] ?? mvt.sign ?? '1', 10);
          const date = String(mvt.date_add?.['#text'] ?? mvt.date_add ?? '');
          const mvtId = String(mvt.id?.['#text'] ?? mvt.id ?? mvt.id_stock_mvt?.['#text'] ?? mvt.id_stock_mvt ?? '');

          return {
            id: mvtId,
            key: mvtId,
            productId: stockInfo.productId,
            productName: '',
            combinationLabel: stockInfo.attributeId !== '0' ? `Déclinaison ${stockInfo.attributeId}` : '',
            combinationId: stockInfo.attributeId !== '0' ? stockInfo.attributeId : null,
            stockId,
            quantityAdded: physical * sign,
            quantityBefore: 0,
            quantityAfter: 0,
            date,
            note: sign === 1 ? `+${physical}` : `-${physical}`,
          };
        })
        .filter((m): m is StockMovement => m !== null);

      movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return movements;
    } catch (err: any) {
      console.error('[getMovements] ERROR:', err.message);
      return [];
    }
  },

  clearMovements: (): void => {
    localStorage.removeItem(MOVEMENTS_KEY);
  },

  // ==========================================
  // STOCK PAR CATÉGORIE - MÉTHODES PUBLIQUES
  // ==========================================

  getStockByCategory: async (): Promise<CategoryStock[]> => {
    return getStockByCategoryStatic();
  },

  getReservedQuantitiesByProduct: async (ordersXml: string): Promise<Map<string, number>> => {
    return getReservedQuantitiesByProductStatic(ordersXml);
  },

  calculateStockByCategory: (
    products: Array<{
      id: string;
      categoryId: string;
      categoryName: string;
      physicalQuantity: number;
    }>,
    reservedQuantities: Map<string, number>
  ): CategoryStock[] => {
    const categoryMap = new Map<string, CategoryStock>();

    for (const product of products) {
      if (!categoryMap.has(product.categoryId)) {
        categoryMap.set(product.categoryId, {
          categoryId: product.categoryId,
          categoryName: product.categoryName,
          physicalQuantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
        });
      }

      const stock = categoryMap.get(product.categoryId)!;
      const reserved = reservedQuantities.get(product.id) || 0;

      stock.physicalQuantity += product.physicalQuantity;
      stock.reservedQuantity += reserved;
      stock.availableQuantity = stock.physicalQuantity - stock.reservedQuantity;
    }

    return Array.from(categoryMap.values())
      .filter(cat => cat.physicalQuantity > 0 || cat.reservedQuantity > 0)
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  },
};