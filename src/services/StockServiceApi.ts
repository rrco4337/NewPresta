import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ==========================================
// TYPES
// ==========================================

export interface Category {
  id: string;
  name: string;
  depth: number;
}

export interface ProductStock {
  productId: string;
  productName: string;
  combinationId: string | null;
  combinationLabel: string;
  stockId: string;
  reference: string;
  currentStock: number;
}

export interface RemovalCalculation {
  productId: string;
  productName: string;
  combinationId: string | null;
  combinationLabel: string;
  stockId: string;
  reference: string;
  currentStock: number;
  toRemove: number;       // quantité effectivement retirée
  deficit: number;        // manque si stock insuffisant (valeur positive)
  stockAfter: number;     // stock après retrait (0 si insuffisant)
}

export interface RemovalSummary {
  categoryId: string;
  categoryName: string;
  chosenQty: number;
  products: RemovalCalculation[];
  total: number;          // somme des stock actuels (avant retrait)
  realized: number;       // total - déficit total
  totalDeficit: number;   // somme des déficits
}

// ==========================================
// AXIOS INSTANCE
// ==========================================

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api',
  headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
});

const moduleApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_PRESTASHOP_URL || 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/xml',
    Accept: 'application/xml',
    'X-Api-Key': import.meta.env.VITE_STOCKAPI_KEY ?? '',
  },
});

// ==========================================
// XML HELPERS
// ==========================================

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function getLang(field: unknown): string {
  if (!isObj(field)) return typeof field === 'string' ? field : '';
  const lang = field.language;
  if (!lang) return '';
  const target = Array.isArray(lang) ? lang[0] : lang;
  if (!isObj(target)) return typeof target === 'string' ? target : '';
  return String((target as any)._cdata ?? (target as any)._text ?? target ?? '');
}

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
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<prestashop><stock_update>' +
    '<id_product><![CDATA[' + idProduct + ']]></id_product>' +
    '<id_product_attribute><![CDATA[' + idProductAttribute + ']]></id_product_attribute>' +
    '<delta><![CDATA[' + delta + ']]></delta>' +
    '</stock_update></prestashop>'
  );
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
// INTERNAL FETCHERS
// ==========================================

async function fetchAllCategories(): Promise<Category[]> {
  const res = await api.get('/categories?display=full');
  const doc = new DOMParser().parseFromString(res.data, 'text/xml');

  const categories: Category[] = [];
  const categoriesRoot = doc.querySelector('categories');
  if (!categoriesRoot) return [];

  const categoryEls = Array.from(categoriesRoot.children).filter(
    (el) => el.tagName === 'category'
  );

  for (const el of categoryEls) {
    const id = el.querySelector(':scope > id')?.textContent?.trim() ?? '';
    const nameEl = el.querySelector(':scope > name');
    const name = nameEl?.textContent?.trim() ?? '';
    const depth = parseInt(
      el.querySelector(':scope > level_depth')?.textContent?.trim() ?? '0',
      10
    );
    if (id && name) categories.push({ id, name, depth });
  }

  // Exclude root categories (depth 0 and 1) and Home
  return categories
    .filter((c) => c.depth >= 2 && c.name.toLowerCase() !== 'home' && c.name !== 'Accueil')
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchProductsByCategory(categoryId: string): Promise<
  Array<{ id: string; name: string; reference: string; type: string; combinationIds: string[] }>
> {
  const res = await api.get(
    `/products?filter[id_category_default]=[${categoryId}]&display=full`
  );
  const parsed = parseXML(res.data) as any;
  const ps = parsed?.prestashop ?? parsed;
  const raw = toArray(ps?.products?.product ?? []);

  return raw
    .filter(isObj)
    .map((p: any) => {
      const id = String(p.id ?? '');
      const comboAssoc = toArray(p.associations?.combinations?.combination ?? []);
      const isCombinations =
        String(p.type ?? '').toLowerCase() === 'combinations' || comboAssoc.length > 0;
      const combinationIds = comboAssoc
        .map((c: any) => String(isObj(c) ? (c.id ?? '') : c))
        .filter(Boolean);
      return {
        id,
        name: getLang(p.name) || String(p.name ?? ''),
        reference: String(p.reference ?? ''),
        type: isCombinations ? 'combinations' : 'simple',
        combinationIds,
      };
    })
    .filter((p) => p.id);
}

async function fetchStockForProduct(
  productId: string
): Promise<Array<{ stockId: string; attributeId: string; quantity: number }>> {
  const res = await api.get(
    `/stock_availables?filter[id_product]=[${productId}]&display=full`
  );
  const doc = new DOMParser().parseFromString(res.data, 'text/xml');
  const els = doc.querySelectorAll('stock_available');
  return Array.from(els).map((el) => ({
    stockId:
      el.querySelector('id')?.textContent?.trim() ?? '',
    attributeId:
      el.querySelector('id_product_attribute')?.textContent?.trim() ?? '0',
    quantity: parseInt(
      el.querySelector('quantity')?.textContent?.trim() ?? '0',
      10
    ),
  }));
}

async function fetchCombinationLabel(
  combinationId: string
): Promise<string> {
  try {
    const res = await api.get(
      `/combinations/${combinationId}?display=full`
    );
    const parsed = parseXML(res.data) as any;
    const combo =
      parsed?.prestashop?.combination ?? parsed?.combination ?? {};
    const ovAssoc = toArray(
      combo?.associations?.product_option_values?.product_option_value ?? []
    );
    const ovIds = ovAssoc
      .map((ov: any) => String(isObj(ov) ? (ov.id ?? '') : ov))
      .filter(Boolean);

    if (ovIds.length === 0) return `Déclinaison #${combinationId}`;

    const names = await Promise.all(
      ovIds.map(async (ovId: string) => {
        try {
          const ovRes = await api.get(
            `/product_option_values/${ovId}?display=full`
          );
          const ovParsed = parseXML(ovRes.data) as any;
          const ov =
            ovParsed?.prestashop?.product_option_value ??
            ovParsed?.product_option_value ??
            {};
          return getLang(ov.name) || String(ov.name ?? ovId);
        } catch {
          return ovId;
        }
      })
    );
    return names.join(' / ');
  } catch {
    return `Déclinaison #${combinationId}`;
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
// PUBLIC SERVICE
// ==========================================

export const stockServiceApi = {
  /**
   * Récupère toutes les catégories (depth >= 2, triées par nom)
   */
  getCategories: async (): Promise<Category[]> => {
    return fetchAllCategories();
  },

  /**
   * Récupère tous les produits (avec leur stock) pour une catégorie donnée.
   * Pour les produits avec déclinaisons, retourne une ligne par déclinaison.
   */
  getProductStockByCategory: async (categoryId: string): Promise<ProductStock[]> => {
    const products = await fetchProductsByCategory(categoryId);
    const lines: ProductStock[] = [];

    for (const product of products) {
      const stocks = await fetchStockForProduct(product.id);

      if (product.type === 'combinations' && product.combinationIds.length > 0) {
        // One line per combination
        for (const comboId of product.combinationIds) {
          const stockEntry = stocks.find((s) => s.attributeId === comboId);
          if (!stockEntry) continue;

          const label = await fetchCombinationLabel(comboId);
          lines.push({
            productId: product.id,
            productName: product.name,
            combinationId: comboId,
            combinationLabel: label,
            stockId: stockEntry.stockId,
            reference: product.reference,
            currentStock: stockEntry.quantity,
          });
        }
      } else {
        // Simple product — take the attribute 0 entry
        const stockEntry = stocks.find((s) => s.attributeId === '0') ?? stocks[0];
        if (!stockEntry) continue;
        lines.push({
          productId: product.id,
          productName: product.name,
          combinationId: null,
          combinationLabel: '',
          stockId: stockEntry.stockId,
          reference: product.reference,
          currentStock: stockEntry.quantity,
        });
      }
    }

    return lines;
  },

  /**
   * Calcule l'impact du retrait de `chosenQty` unités par produit dans la catégorie.
   *
   * Règle métier (exemple Sport, chosenQty=7) :
   *   produit1 stock=10 → retire 7 → reste 3,  deficit=0
   *   produit2 stock=5  → retire 5 → reste 0,  deficit=2
   *   produit3 stock=7  → retire 7 → reste 0,  deficit=0
   *   total    = 10+5+7 = 22   (stock avant retrait)
   *   realized = total - totalDeficit = 22 - 2 = 20   (quantité effectivement retirée)
   *
   * NB : « total » affiché = somme des retraits effectifs = realized.
   * Adapter selon besoin métier dans le composant.
   */
  calculateRemoval: (
    products: ProductStock[],
    chosenQty: number,
    categoryId: string,
    categoryName: string
  ): RemovalSummary => {
    let total = 0;
    let totalDeficit = 0;

    const calculations: RemovalCalculation[] = products.map((p) => {
      const stock = p.currentStock;
      const toRemove = Math.min(stock, chosenQty);
      const deficit = Math.max(0, chosenQty - stock);
      const stockAfter = Math.max(0, stock - chosenQty);

      total += stock;
      totalDeficit += deficit;

      return {
        productId: p.productId,
        productName: p.productName,
        combinationId: p.combinationId,
        combinationLabel: p.combinationLabel,
        stockId: p.stockId,
        reference: p.reference,
        currentStock: stock,
        toRemove,
        deficit,
        stockAfter,
      };
    });

    const realized = total - totalDeficit;

    return {
      categoryId,
      categoryName,
      chosenQty,
      products: calculations,
      total,
      realized,
      totalDeficit,
    };
  },

  /**
   * Applique réellement les retraits de stock sur PrestaShop
   * pour chaque produit où le stock le permet.
   */
  applyRemoval: async (
    summary: RemovalSummary,
    note = ''
  ): Promise<{ success: number; failed: number; errors: string[] }> => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const calc of summary.products) {
      if (calc.toRemove <= 0) continue;

      try {
        const xml = buildStockUpdateXml(
          calc.productId,
          calc.combinationId ?? 0,
          -calc.toRemove
        );
        const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);
        const result = parseStockUpdateResponse(rawXml);

        if (!result.success) {
          failed++;
          errors.push(`${calc.productName}: ${result.error ?? 'Erreur serveur'}`);
          continue;
        }

        // Record movement
        const movementId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await sendMovementToAPI({
          id: movementId,
          key: `${calc.productId}_${calc.combinationId ?? '0'}`,
          id_product: parseInt(calc.productId, 10),
          product_name: calc.productName,
          combination_label: calc.combinationLabel,
          id_stock_available: parseInt(calc.stockId, 10),
          quantity_before: calc.currentStock,
          quantity_added: -calc.toRemove,
          quantity_after: result.newQty,
          note: note || `Retrait catégorie ${summary.categoryName} (${summary.chosenQty}/produit)`,
          date: new Date().toISOString(),
        });

        success++;
      } catch (err: any) {
        failed++;
        errors.push(`${calc.productName}: ${err.message ?? 'Erreur inconnue'}`);
      }
    }

    return { success, failed, errors };
  },
};
