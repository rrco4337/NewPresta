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

    const xml = buildStockUpdateXml(line.productId, line.combinationId ?? 0, qty);
    const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);

    const result = parseStockUpdateResponse(rawXml);
    if (!result.success) throw new Error(result.error ?? 'Erreur serveur');

    const newQty = result.newQty;
    const movement: StockMovement = {
      id:               `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      key:              line.key,
      productId:        line.productId,
      productName:      line.productName,
      combinationLabel: line.combinationLabel,
      stockId:          line.stockId,
      quantityBefore:   line.quantity,
      quantityAdded:    qty,
      quantityAfter:    newQty,
      date:             new Date().toISOString(),
      note,
    };
    writeMovement(movement);

    return { ...line, quantity: newQty };
  },

  /** Récupère l'historique des mouvements, filtrables par produit */
  getMovements: (productId?: string): StockMovement[] => {
    const all = readMovements();
    return productId ? all.filter(m => m.productId === productId) : all;
  },

  /** Supprime tous les mouvements locaux */
  clearMovements: (): void => {
    localStorage.removeItem(MOVEMENTS_KEY);
  },
};