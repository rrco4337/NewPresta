# Stock — Mise à jour via endpoint XML custom

---

## Ce qui a été fait

### 1. Sidebar (`AppLayout.tsx`)

Ajout de l'entrée **Stock** dans la section Catalogue :

```tsx
const IconLayers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" ...>
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);

{ label: 'Stock', path: '/stock', icon: <IconLayers />, section: 'Catalogue' }
```

---

### 2. Fichier PHP standalone — `/var/www/html/stockapi.php`

**Pas de module, pas d'installation back-office.** Un seul fichier à déposer à la racine de PrestaShop.

```php
<?php
define("_PS_ROOT_DIR_", dirname(__FILE__));
require_once _PS_ROOT_DIR_ . "/config/config.inc.php";

header("Content-Type: application/xml; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Api-Key");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(204); exit; }

function buildXml(array $fields): string {
    $dom = new DOMDocument("1.0", "UTF-8");
    $dom->formatOutput = true;
    $root   = $dom->createElement("prestashop");
    $parent = $dom->createElement("stock_update");
    foreach ($fields as $tag => $value) {
        $el = $dom->createElement($tag);
        $el->appendChild($dom->createCDATASection((string)$value));
        $parent->appendChild($el);
    }
    $root->appendChild($parent);
    $dom->appendChild($root);
    return $dom->saveXML();
}

function xmlError(int $code, string $msg): void {
    http_response_code($code);
    echo buildXml(["success" => 0, "error" => $msg]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") xmlError(405, "Method Not Allowed");

$secret    = Configuration::get("STOCKAPI_SECRET_KEY");
$headerKey = $_SERVER["HTTP_X_API_KEY"] ?? "";
if (!$secret || !hash_equals($secret, $headerKey)) xmlError(401, "Unauthorized");

$rawBody = file_get_contents("php://input");
if (empty($rawBody)) xmlError(400, "Empty body");

libxml_use_internal_errors(true);
$xml = simplexml_load_string($rawBody);
if ($xml === false) xmlError(400, "Invalid XML");

$node               = $xml->stock_update;
$idProduct          = (int)($node->id_product          ?? 0);
$idProductAttribute = (int)($node->id_product_attribute ?? 0);
$delta              = (int)($node->delta                ?? 0);

if ($idProduct <= 0) xmlError(400, "id_product must be > 0");
if ($delta === 0)    xmlError(400, "delta must be != 0");

$db     = Db::getInstance();
$prefix = _DB_PREFIX_;

// UPDATE direct sur toutes les lignes du produit/combo (id_shop=0 et id_shop=1)
// Db::getValue() ajoute LIMIT 1 automatiquement en interne — ne pas le mettre ici
$db->execute(
    "UPDATE `" . $prefix . "stock_available`"
    . " SET `quantity` = `quantity` + " . (int)$delta
    . " WHERE `id_product` = " . (int)$idProduct
    . " AND `id_product_attribute` = " . (int)$idProductAttribute
);

$newQty = (int)$db->getValue(
    "SELECT `quantity` FROM `" . $prefix . "stock_available`"
    . " WHERE `id_product` = " . (int)$idProduct
    . " AND `id_product_attribute` = " . (int)$idProductAttribute
    . " ORDER BY `id_shop` DESC"
);

echo buildXml([
    "success"              => 1,
    "id_product"           => $idProduct,
    "id_product_attribute" => $idProductAttribute,
    "new_quantity"         => $newQty,
]);
exit;
```

---

### 3. Clé secrète dans PrestaShop

Initialiser ou synchroniser `STOCKAPI_SECRET_KEY` avec la valeur de `VITE_STOCKAPI_KEY` dans `.env` :

```bash
docker exec prestashop_app php -r "
define('_PS_ROOT_DIR_', '/var/www/html');
require_once '/var/www/html/config/config.inc.php';
Configuration::updateValue('STOCKAPI_SECRET_KEY', 'ta_cle_secrete');
echo Configuration::get('STOCKAPI_SECRET_KEY');
"
```

Ou via SQL / phpMyAdmin :

```sql
INSERT INTO ps_configuration (name, value, date_add, date_upd)
VALUES ('STOCKAPI_SECRET_KEY', 'ta_cle_secrete', NOW(), NOW())
ON DUPLICATE KEY UPDATE value = 'ta_cle_secrete';
```

---

### 4. Variables `.env` React

```env
VITE_PRESTASHOP_URL=http://localhost:8080
VITE_STOCKAPI_KEY=ta_cle_secrete
```

---

### 5. `stockService.ts` — ce qui a changé

#### Axios client ajouté

```ts
const moduleApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_PRESTASHOP_URL || 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/xml',
    'Accept':       'application/xml',
    'X-Api-Key':    import.meta.env.VITE_STOCKAPI_KEY ?? '',
  },
});
```

#### Helpers ajoutés

```ts
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
  success: boolean; newQty: number; error?: string;
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
```

#### `addStock` — implémentation finale

```ts
addStock: async (line: StockLine, qty: number, note = ''): Promise<StockLine> => {
  if (qty <= 0) throw new Error('La quantité doit être > 0');

  const xml = buildStockUpdateXml(line.productId, line.combinationId ?? 0, qty);
  const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);

  const result = parseStockUpdateResponse(rawXml);
  if (!result.success) throw new Error(result.error ?? 'Erreur serveur');

  const movement: StockMovement = {
    id:               `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    key:              line.key,
    productId:        line.productId,
    productName:      line.productName,
    combinationLabel: line.combinationLabel,
    stockId:          line.stockId,
    quantityBefore:   line.quantity,
    quantityAdded:    qty,
    quantityAfter:    result.newQty,
    date:             new Date().toISOString(),
    note,
  };
  writeMovement(movement);

  return { ...line, quantity: result.newQty };
},
```

---

## Pourquoi pas l'API native PS (`PUT /api/stock_availables`) ?

Le webservice PS liste les records `id_shop=0` mais refuse les PUT sur ceux-ci (`"This StockAvailable does not exist on this shop"`). Les produits importés ont souvent des records `id_shop=0` → la mise à jour échoue.

## `StockAvailable::updateQuantity()` — la fonction PS native

### Signature

```php
StockAvailable::updateQuantity(
    int $id_product,
    int $id_product_attribute,  // 0 pour produit simple
    int $delta_quantity,        // positif = entrée, négatif = sortie
    int $id_shop = null         // null = shop du contexte courant
);
```

### Ce qu'elle fait

1. Cherche le `stock_available` pour `(id_product, id_product_attribute, id_shop)`
2. Si trouvé → `UPDATE quantity = quantity + delta`
3. Si non trouvé → `INSERT` d'un nouveau record avec `quantity = delta`

### Quand elle fonctionne

Elle fonctionne correctement quand le record `stock_available` a `id_shop=1` (shop spécifique) et qu'on passe `id_shop=1` explicitement :

```php
Shop::setContext(Shop::CONTEXT_SHOP, 1);
StockAvailable::updateQuantity($idProduct, $idProductAttribute, $delta, 1);
```

### Pourquoi elle échoue ici (bug PS 8)

Les produits créés via import ont leurs records `stock_available` avec `id_shop=0` ("tous les shops"). Quand on appelle la fonction sans `$id_shop`, elle résout null → `Context::shop->id` (= 1), ne trouve pas de record `id_shop=1`, et tente un `INSERT (id_shop=0)` qui existe déjà → `Duplicate entry`.

```
StockAvailable::updateQuantity(336, 248, 1)
  → Core\StockManager::updateQuantity(product, 248, 1, NULL)
  → getStockAvailableByProduct(product, 248, NULL)
    → Context::shop->id = 1 → aucun record id_shop=1 trouvé
    → INSERT (336, 248, id_shop=0) → Duplicate key 💥
```

**Conclusion :** inutilisable de façon fiable dès qu'il existe un mélange de records `id_shop=0` et `id_shop=1` — ce qui est le cas après un import. Le SQL direct est la seule solution robuste.

---

## Test curl

```bash
curl -X POST http://localhost:8080/stockapi.php \
  -H "Content-Type: application/xml" \
  -H "X-Api-Key: ta_cle_secrete" \
  -d '<?xml version="1.0" encoding="UTF-8"?><prestashop><stock_update><id_product>1</id_product><id_product_attribute>0</id_product_attribute><delta>5</delta></stock_update></prestashop>'
```

Réponse attendue :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <stock_update>
    <success><![CDATA[1]]></success>
    <id_product><![CDATA[1]]></id_product>
    <id_product_attribute><![CDATA[0]]></id_product_attribute>
    <new_quantity><![CDATA[6]]></new_quantity>
  </stock_update>
</prestashop>
```

## Codes d'erreur

| Code | Message | Cause |
|------|---------|-------|
| 401 | Unauthorized | `X-Api-Key` ≠ `STOCKAPI_SECRET_KEY` en DB |
| 400 | delta must be != 0 | Quantité 0 envoyée |
| 400 | Invalid XML | Corps mal formé |
| 400 | id_product must be > 0 | ID produit manquant |
| 500 | — | Voir `/var/www/html/var/logs/` dans le container |

## Déploiement production

1. Copier `stockapi.php` à la racine de PrestaShop (FTP/SSH)
2. Insérer `STOCKAPI_SECRET_KEY` dans `ps_configuration` (SQL ou phpMyAdmin)
3. Mettre à jour `.env` avec l'URL et la clé de prod
4. Tester avec le curl ci-dessus
