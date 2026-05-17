import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ==========================================
// 1. TYPES
// ==========================================

/** Une ligne de stock unitaire — produit simple ou déclinaison */
export interface StockLine {
  /** Clé unique : `${productId}_${combinationId ?? '0'}` */
  key: string;
  productId: string;
  productName: string;
  productType: 'simple' | 'combinations';
  combinationId: string | null;
  /** Libellé lisible de la déclinaison, ex. "Bleu / M". Vide pour produit simple. */
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
  stockId: string;
  quantityBefore: number;
  quantityAdded: number;
  quantityAfter: number;
  date: string; // ISO
  note: string;
}

// ==========================================
// 2. AXIOS
// ==========================================
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
});

// Client vers stockapi.php (fichier standalone à la racine PS, pas de module requis)
const moduleApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_PRESTASHOP_URL || 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/xml',
    'Accept':       'application/xml',
    'X-Api-Key':    import.meta.env.VITE_STOCKAPI_KEY ?? '',
  },
});

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
// 3. HELPERS XML
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
  const node   = parsed?.prestashop?.stock_update ?? parsed?.stock_update;
  if (!node) return { success: false, newQty: 0, error: 'Réponse XML invalide' };
  return {
    success: String(node.success ?? '0') === '1',
    newQty:  parseInt(String(node.new_quantity ?? '0'), 10),
    error:   node.error ? String(node.error) : undefined,
  };
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
  // Gère _cdata (parfois injecté), _text, ou string direct
  return String((target as any)._cdata ?? (target as any)._text ?? target ?? '');
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// ==========================================
// 4. FETCHERS INTERNES
// ==========================================

interface RawProduct {
  id: string;
  name: string;
  reference: string;
  ean13: string;
  /** 'simple' | 'combinations' | 'virtual' | 'pack' */
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

function extractId(field: unknown): string {
  if (!field) return '';
  if (typeof field === 'string' || typeof field === 'number') return String(field);
  if (typeof field === 'object') {
    const obj = field as Record<string, unknown>;
    // Most common PS shapes
    return String(
      obj['#text'] ?? obj['_cdata'] ?? obj['@_href']?.toString().split('/').pop() ?? ''
    );
  }
  return '';
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

    // ── Détection du type ──────────────────────────────────────────────
    // PS peut renvoyer : "combinations", "configurable", "1", "2"…
    // On s'appuie aussi sur la présence de l'association "combinations"
    const rawType = String(
      (p as any).type ?? (p as any).product_type ?? ''
    ).toLowerCase();

    const comboAssoc = toArray(
      (p as any).associations?.combinations?.combination
    );

    const isCombinations =
      rawType === 'combinations' ||
      rawType === 'configurable' ||
      rawType === '2' || // valeur numérique PS 1.7/8
      comboAssoc.length > 0;

    // IDs de déclinaisons extraits des associations (plus fiable que le
    // filtre global sur /combinations)
    const combinationIds = comboAssoc
      .map((c: any) => String(isObj(c) ? (c.id ?? '') : c))
      .filter(Boolean);

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
      // Extrait les IDs des valeurs d'options (attributs: couleur, taille…)
      const pov = isObj(c.associations?.product_option_values)
        ? c.associations.product_option_values
        : null;
      const ovItems = toArray((pov as any)?.product_option_value);
      const optionValueIds = ovItems
        .map((ov: any) => String(isObj(ov) ? (ov.id ?? '') : ov))
        .filter(Boolean);

      return {
        id: String(c.id ?? ''),
        id_product: String(c.id_product ?? ''),
        reference: String(c.reference ?? ''),
        ean13: String(c.ean13 ?? ''),
        optionValueIds,
      } as RawCombination;
    }).filter(c => c.id && c.id_product);
  } catch (err) {
    console.warn('[stockService] /combinations introuvable ou vide', err);
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
  } catch (err) {
    console.warn('[stockService] /product_option_values introuvable', err);
    return new Map();
  }
}

// ==========================================
// 5. MOUVEMENTS (stockage local)
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
// 6. SERVICE PUBLIC
// ==========================================
export const stockService = {

  /**
   * Récupère toutes les lignes de stock :
   * - Un enregistrement par produit simple
   * - Un enregistrement par déclinaison pour les produits à combinaisons
   */
  getAllStockLines: async (): Promise<StockLine[]> => {
    const [products, combinations, stockAvailables, optionValues] = await Promise.all([
      fetchProducts(),
      fetchCombinations(),
      fetchStockAvailables(),
      fetchOptionValueNames(),
    ]);

    // Index rapide : `${id_product}_${id_product_attribute}` → stock
    const stockMap = new Map<string, RawStockAvailable>();
    for (const s of stockAvailables) {
      stockMap.set(`${s.id_product}_${s.id_product_attribute}`, s);
    }

    const lines: StockLine[] = [];

    for (const [productId, product] of products) {
      // Filtre produits inactifs
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

  /**
   * Ajoute une quantité au stock d'une ligne et enregistre le mouvement.
   * Retourne la ligne mise à jour.
   */
  addStock: async (line: StockLine, qty: number, note = ''): Promise<StockLine> => {
  if (qty <= 0) throw new Error('La quantité doit être > 0');

  // 1. Mettre à jour ps_stock_available (via stockapi.php)
  const xml = buildStockUpdateXml(line.productId, line.combinationId ?? 0, qty);
  const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);

  const result = parseStockUpdateResponse(rawXml);
  if (!result.success) throw new Error(result.error ?? 'Erreur serveur');

  const newQty = result.newQty;

  // 2. Écrire dans ps_stock_mvt (API native PS) pour que le backoffice voit le mouvement
  const movementId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  // Construire le XML pour l'API native
  // 2. Écrire dans ps_stock_mvt (API native PS)
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
  const nativeResponse = await api.post('/stock_movements', nativeXml);
  console.log('✅ Mouvement enregistré dans backoffice PS', nativeResponse.data);
} catch (err: any) {
  console.error('❌ Erreur API native:', err.response?.status, err.response?.data);
}

  // 3. Envoyer le mouvement à ton historique custom (optionnel)
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
  /**
   * Retire une quantité du stock d'une ligne et enregistre le mouvement.
   * Retourne la ligne mise à jour.
   */
  removeStock: async (line: StockLine, qty: number, note = ''): Promise<StockLine> => {
    if (qty <= 0) throw new Error('La quantité doit être > 0');
    if (qty > line.quantity) throw new Error(`Stock insuffisant (disponible : ${line.quantity})`);

    // 1. Mettre à jour ps_stock_available via stockapi.php (delta négatif)
    const xml = buildStockUpdateXml(line.productId, line.combinationId ?? 0, -qty);
    const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);

    const result = parseStockUpdateResponse(rawXml);
    if (!result.success) throw new Error(result.error ?? 'Erreur serveur');

    const newQty = result.newQty;

    // 2. Écrire dans ps_stock_mvt (API native PS) — sign=-1 pour une sortie
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
      console.error('❌ Erreur API native (sortie):', err.response?.status, err.response?.data);
    }

    // 3. Envoyer le mouvement à l'historique custom
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

  /**
   * Enregistre les mouvements de stock pour toutes les lignes d'une commande.
   * direction='sortie' : commande validée (paiement OK)
   * direction='entree' : commande annulée (retour en stock)
   */
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
      const note = direction === 'sortie'
        ? `Sortie commande ${orderRef}`
        : `Retour commande ${orderRef}`;
      try {
        if (direction === 'sortie') {
          await stockService.removeStock(line, row.quantity, note);
        } else {
          await stockService.addStock(line, row.quantity, note);
        }
      } catch (err) {
        console.error(`[stockService] recordOrderMovements: erreur pour ${key}`, err);
      }
    }
  },

  // Enregistre un mouvement dans ps_stock_mvt (backoffice PS)
// Enregistre un mouvement dans ps_stock_mvt (backoffice PS)
addMouvementStock: async (
  stockId: string,
  productId: string,
  combinationId: string,
  quantityAdded: number,
  quantityBefore: number
): Promise<void> => {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_mvt>
    <id_employee><![CDATA[1]]></id_employee>
    <id_stock><![CDATA[${stockId}]]></id_stock>
    <id_stock_mvt_reason><![CDATA[1]]></id_stock_mvt_reason>
    <physical_quantity><![CDATA[${Math.abs(quantityAdded)}]]></physical_quantity>
    <sign><![CDATA[${quantityAdded > 0 ? 1 : -1}]]></sign>
    <price_te><![CDATA[0]]></price_te>
    <date_add><![CDATA[${now}]]></date_add>
  </stock_mvt>
</prestashop>`;
  
  try {
    await api.post('/stock_movements', xml);
  } catch (err) {
    console.warn('[setStock] Impossible d\'enregistrer le mouvement', err);
  }
},


  /** Récupère l'historique des mouvements, filtrables par produit */
  /**
 * Récupère l'historique des mouvements depuis l'API native PrestaShop
 * @param productId - ID du produit (optionnel)
 * @returns Liste des mouvements
 */

/**
 * Récupère l'historique des mouvements depuis l'API native PrestaShop
 * @param productId - ID du produit (optionnel)
 * @returns Liste des mouvements
 */
/**
 /**
 * Récupère l'historique (snapshot + tentative API PrestaShop)
 * @param productId - ID produit OU reference (ex: M_02)
 */

 // Version simplifiée : retourne tous les mouvements bruts
getMovements: async (productId?: string): Promise<StockMovement[]> => {
  console.log('[getMovements] === DÉBUT ===');

  try {
    if (!productId) {
      console.warn('[getMovements] productId manquant');
      return [];
    }

    // ======================================================
    // 1. STOCK AVAILABLE DU PRODUIT
    // ======================================================
    const stockUrl = `/stock_availables?filter[id_product]=${productId}&display=full`;
    console.log('[getMovements] stock URL:', stockUrl);

    const stockRes = await api.get(stockUrl);
    const stockParsed = parseXML(stockRes.data) as any;

    const stockRoot =
      stockParsed?.prestashop ||
      stockParsed?.Prestashop ||
      stockParsed;

    const stockAvailables = toArray(
      stockRoot?.stock_availables?.stock_available ?? []
    );

    console.log('[getMovements] stockAvailables:', stockAvailables.length);

    // MAP : id_stock_available => info produit
    const stockMap = new Map<
      string,
      { productId: string; attributeId: string }
    >();

    stockAvailables.forEach((s: any) => {
      
const idStock = String(s.id_stock_available ?? s.id ?? '').trim();

if (!idStock || idStock === 'undefined') {
  console.warn('[stock] idStock invalide', s);
  return;
}

stockMap.set(idStock, {
  productId: String(s.id_product ?? ''),
  attributeId: String(s.id_product_attribute ?? '0')
});
      
    });

    console.log('[getMovements] stockMap size:', stockMap.size);

    // ======================================================
    // 2. MOUVEMENTS STOCK (GLOBAL)
    // ======================================================
    const url = '/stock_movements?display=full';
    console.log('[getMovements] movements URL:', url);

    const res = await api.get(url);
    const parsed = parseXML(res.data) as any;

    const root =
      parsed?.prestashop ||
      parsed?.Prestashop ||
      parsed;

    const rawMovements = toArray(
      root?.stock_movements?.stock_mvt ??
      root?.stock_mvts?.stock_mvt ??
      []
    );
console.log('[DEBUG] stockMap keys:', [...stockMap.keys()]);
console.log('[DEBUG] sample movement stockIds:', rawMovements.slice(0, 5).map(m => m.id_stock));
    console.log('[getMovements] rawMovements:', rawMovements.length);

    // ======================================================
    // 3. TRANSFORMATION + FILTRE PRODUIT
    // ======================================================
    const movements: StockMovement[] = rawMovements
      .map((mvt: any) => {
        const stockId = String(
          mvt.id_stock?.['#text'] ?? mvt.id_stock ?? ''
        );

        const stockInfo = stockMap.get(stockId);

        if (!stockInfo) return null; // mouvement non lié au produit

        const physical = parseInt(
          mvt.physical_quantity?.['#text'] ??
          mvt.physical_quantity ?? '0',
          10
        );

        const sign = parseInt(
          mvt.sign?.['#text'] ?? mvt.sign ?? '1',
          10
        );

        const date = mvt.date_add?.['#text'] ?? mvt.date_add ?? '';

        return {
          id: String(mvt.id_stock_mvt ?? ''),
          key: String(mvt.id_stock_mvt ?? ''),

          productId: stockInfo.productId,
          combinationLabel: stockInfo.attributeId,

          stockId: stockId,

          quantityAdded: physical * sign,

          quantityBefore: 0,
          quantityAfter: 0,

          date,

          note: sign === 1
            ? `+${physical}`
            : `-${physical}`
        };
      })
      .filter(Boolean) as StockMovement[];

    console.log('[getMovements] FINAL movements:', movements.length);

    return movements;
  } catch (err: any) {
    console.error('[getMovements] ERROR:', err.message);
    return [];
  }
},
// Helper — handles all PS XML field shapes


  /** Supprime tous les mouvements locaux */
  clearMovements: (): void => {
    localStorage.removeItem(MOVEMENTS_KEY);
  },
};