# Stock — Ce qui a été fait pour que ça marche

---

## 1. Sidebar

Ajout de l'entrée **Stock** dans `src/components/AppLayout.tsx` :

- Icône `IconLayers` (SVG inline)
- Route `/stock`
- Section **Catalogue**

Aucune autre modification côté React — `StockUpdate.tsx` existait déjà.

---

## 2. Fichier PHP côté PrestaShop — `stockapi.php`

**Pas de module, pas d'installation.** Un seul fichier PHP à déposer à la racine de PrestaShop.

### Pourquoi ne pas utiliser l'API native PS (`PUT /api/stock_availables`) ?

Le webservice PS liste les enregistrements `id_shop=0` mais refuse les PUT sur ceux-ci (`"This StockAvailable does not exist on this shop"`). Les produits à déclinaisons créés depuis l'import ont souvent des enregistrements `id_shop=0` uniquement → la mise à jour plante en silence ou retourne une erreur.

### Pourquoi ne pas utiliser `StockAvailable::updateQuantity()` ?

Sur PS 8, cette méthode tente un `INSERT` quand elle ne trouve pas d'entrée pour le shop courant, alors qu'un enregistrement `id_shop=0` existe déjà → `SQLSTATE[23000] Duplicate entry` → 500 sur tous les produits à déclinaisons.

### Solution retenue — UPDATE SQL direct

```
/var/www/html/stockapi.php
```

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

// UPDATE direct — atomique, pas de race condition, pas de bug duplicate key
$db->execute(
    "UPDATE `{$prefix}stock_available`" .
    " SET `quantity` = `quantity` + " . (int)$delta .
    " WHERE `id_product` = " . (int)$idProduct .
    " AND `id_product_attribute` = " . (int)$idProductAttribute
);

$newQty = (int)$db->getValue(
    "SELECT `quantity` FROM `{$prefix}stock_available`" .
    " WHERE `id_product` = " . (int)$idProduct .
    " AND `id_product_attribute` = " . (int)$idProductAttribute
);

echo buildXml([
    "success"              => 1,
    "id_product"           => $idProduct,
    "id_product_attribute" => $idProductAttribute,
    "new_quantity"         => $newQty,
]);
exit;
```

### Clé secrète

Le fichier lit `STOCKAPI_SECRET_KEY` depuis la table `ps_configuration`. Pour l'initialiser :

```sql
-- via phpMyAdmin ou CLI MySQL
INSERT INTO ps_configuration (name, value, date_add, date_upd)
VALUES ('STOCKAPI_SECRET_KEY', 'ta_cle_secrete', NOW(), NOW())
ON DUPLICATE KEY UPDATE value = 'ta_cle_secrete';
```

Ou via PHP CLI (Docker) :

```bash
docker exec prestashop_app php -r "
define('_PS_ROOT_DIR_', '/var/www/html');
require_once '/var/www/html/config/config.inc.php';
Configuration::updateValue('STOCKAPI_SECRET_KEY', 'ta_cle_secrete');
echo Configuration::get('STOCKAPI_SECRET_KEY');
"
```

La clé doit être identique à `VITE_STOCKAPI_KEY` dans `.env`.

---

## 3. Variables d'environnement React (`.env`)

```env
VITE_PRESTASHOP_URL=http://localhost:8080      # URL de base PS (sans /api)
VITE_STOCKAPI_KEY=f5904cd8c826e36981551520bc35bf0a  # clé secrète = STOCKAPI_SECRET_KEY dans PS
```

---

## 4. Modifications dans `stockService.ts`

### Axios client

```ts
// Client vers stockapi.php (à la racine PS, pas de module requis)
const moduleApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_PRESTASHOP_URL || 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/xml',
    'Accept':       'application/xml',
    'X-Api-Key':    import.meta.env.VITE_STOCKAPI_KEY ?? '',
  },
});
```

### Méthode `addStock`

```ts
addStock: async (line: StockLine, qty: number, note = ''): Promise<StockLine> => {
  if (qty <= 0) throw new Error('La quantité doit être > 0');

  const xml = buildStockUpdateXml(line.productId, line.combinationId ?? 0, qty);
  const { data: rawXml } = await moduleApi.post('/stockapi.php', xml);

  const result = parseStockUpdateResponse(rawXml);
  if (!result.success) throw new Error(result.error ?? 'Erreur serveur');

  const movement: StockMovement = { /* ... */ };
  writeMovement(movement);

  return { ...line, quantity: result.newQty };
},
```

### Format XML envoyé

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <stock_update>
    <id_product><![CDATA[336]]></id_product>
    <id_product_attribute><![CDATA[248]]></id_product_attribute>
    <delta><![CDATA[5]]></delta>
  </stock_update>
</prestashop>
```

### Réponse XML reçue

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <stock_update>
    <success><![CDATA[1]]></success>
    <id_product><![CDATA[336]]></id_product>
    <id_product_attribute><![CDATA[248]]></id_product_attribute>
    <new_quantity><![CDATA[20]]></new_quantity>
  </stock_update>
</prestashop>
```

---

## 5. Déploiement en production

1. **Copier** `stockapi.php` à la racine de PrestaShop (FTP, SSH, cPanel…)
2. **Insérer la clé** dans `ps_configuration` (SQL ci-dessus ou phpMyAdmin)
3. **Mettre à jour `.env`** avec l'URL de production et la même clé
4. Tester avec curl :

```bash
curl -X POST https://votre-boutique.com/stockapi.php \
  -H "Content-Type: application/xml" \
  -H "X-Api-Key: ta_cle_secrete" \
  -d '<?xml version="1.0" encoding="UTF-8"?><prestashop><stock_update><id_product>1</id_product><id_product_attribute>0</id_product_attribute><delta>1</delta></stock_update></prestashop>'
```

Réponse attendue : `<success><![CDATA[1]]></success>`

---

## 6. Codes d'erreur

| Code | Cause | Solution |
|------|-------|----------|
| 401 | Clé `X-Api-Key` incorrecte | Vérifier `VITE_STOCKAPI_KEY` = `STOCKAPI_SECRET_KEY` en DB |
| 400 `delta must be != 0` | Quantité = 0 envoyée | Normal — la validation bloque |
| 400 `Invalid XML` | Corps mal formé | Vérifier `buildStockUpdateXml` |
| 500 | Erreur PHP PS | Vérifier `/var/www/html/var/logs/` |
