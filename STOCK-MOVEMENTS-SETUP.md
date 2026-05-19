# Stock Movements — Guide de mise en place

Ce guide explique tout ce qu'il faut faire pour que les mouvements de stock fonctionnent : ajout manuel, sortie commande, retour annulation.

---

## Prérequis

- PrestaShop 8 dans Docker (`prestashop_app`)
- Clé webservice PS active (`VITE_PRESTASHOP_API_KEY` dans `.env`)
- `VITE_STOCKAPI_KEY` dans `.env` (clé custom pour `stockapi.php`)

---

## Étape 1 — Modifier `WebserviceRequest.php` (core PS)

Ce fichier bloque par défaut le POST sur `/api/stock_movements`.  
Il faut retirer la restriction `forbidden_method`.

```bash
docker exec prestashop_app sed -i \
  "s/'stock_movements' => \['description' => 'Stock movements', 'class' => 'StockMvtWS', 'forbidden_method' => \['PUT', 'POST', 'PATCH', 'DELETE'\]\]/'stock_movements' => ['description' => 'Stock movements', 'class' => 'StockMvtWS']/" \
  /var/www/html/classes/webservice/WebserviceRequest.php
```

**Vérification :**
```bash
docker exec prestashop_app grep 'stock_movements' /var/www/html/classes/webservice/WebserviceRequest.php
# Doit afficher (sans forbidden_method) :
# 'stock_movements' => ['description' => 'Stock movements', 'class' => 'StockMvtWS'],
```

> **Note :** Ce fichier est dans le core PS. Si PS est mis à jour, il faudra refaire cette modification.

---

## Étape 2 — Déposer `stockapi.php` à la racine de PrestaShop

Ce fichier gère :
- `PUT ps_stock_available` (mise à jour stock en delta)
- `GET/POST/DELETE ps_stock_movements_app` (historique custom de l'app)

```bash
docker exec prestashop_app bash -c "cat > /var/www/html/stockapi.php << 'PHPEOF'
<?php
define(\"_PS_ROOT_DIR_\", dirname(__FILE__));
require_once _PS_ROOT_DIR_ . \"/config/config.inc.php\";

header(\"Content-Type: application/xml; charset=utf-8\");
header(\"Access-Control-Allow-Origin: *\");
header(\"Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\");
header(\"Access-Control-Allow-Headers: Content-Type, X-Api-Key\");

if (\$_SERVER[\"REQUEST_METHOD\"] === \"OPTIONS\") { http_response_code(204); exit; }

function buildXml(array \$fields, string \$wrapper = \"stock_update\"): string {
    \$dom = new DOMDocument(\"1.0\", \"UTF-8\");
    \$dom->formatOutput = true;
    \$root   = \$dom->createElement(\"prestashop\");
    \$parent = \$dom->createElement(\$wrapper);
    foreach (\$fields as \$tag => \$value) {
        \$el = \$dom->createElement(\$tag);
        \$el->appendChild(\$dom->createCDATASection((string)\$value));
        \$parent->appendChild(\$el);
    }
    \$root->appendChild(\$parent);
    \$dom->appendChild(\$root);
    return \$dom->saveXML();
}

function xmlError(int \$code, string \$msg): void {
    http_response_code(\$code);
    echo buildXml([\"success\" => 0, \"error\" => \$msg]);
    exit;
}

\$secret    = Configuration::get(\"STOCKAPI_SECRET_KEY\");
\$headerKey = \$_SERVER[\"HTTP_X_API_KEY\"] ?? \"\";
if (!\$secret || !hash_equals(\$secret, \$headerKey)) xmlError(401, \"Unauthorized\");

\$db           = Db::getInstance();
\$prefix       = _DB_PREFIX_;
\$mvtTableRaw  = \"stock_movements_app\";
\$mvtTableFull = \$prefix . \$mvtTableRaw;

\$db->execute(\"CREATE TABLE IF NOT EXISTS \`{\$mvtTableFull}\` (
  \`id\`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`movement_id\`        VARCHAR(60)  NOT NULL,
  \`line_key\`           VARCHAR(100) NOT NULL,
  \`id_product\`         INT UNSIGNED NOT NULL,
  \`product_name\`       VARCHAR(255) NOT NULL,
  \`combination_label\`  VARCHAR(255) NOT NULL DEFAULT '',
  \`id_stock_available\` INT UNSIGNED NOT NULL DEFAULT 0,
  \`quantity_before\`    INT          NOT NULL,
  \`quantity_added\`     INT          NOT NULL,
  \`quantity_after\`     INT          NOT NULL,
  \`date_add\`           DATETIME     NOT NULL,
  \`note\`               VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (\`id\`),
  KEY \`idx_date\` (\`date_add\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\");

\$method = \$_SERVER[\"REQUEST_METHOD\"];
\$action = \$_GET[\"action\"] ?? \"\";

if (\$method === \"GET\") {
    if (\$action !== \"movements\") xmlError(400, \"Unknown action\");
    \$limit = min((int)(\$_GET[\"limit\"] ?? 1000), 1000);
    \$rows  = \$db->executeS(\"SELECT * FROM \`{\$mvtTableFull}\` ORDER BY \`date_add\` DESC LIMIT {\$limit}\");
    \$dom  = new DOMDocument(\"1.0\", \"UTF-8\");
    \$dom->formatOutput = true;
    \$root = \$dom->createElement(\"prestashop\");
    \$list = \$dom->createElement(\"movements\");
    foreach ((\$rows ?: []) as \$row) {
        \$m = \$dom->createElement(\"movement\");
        foreach (\$row as \$k => \$v) {
            if (\$k === \"id\") continue;
            \$el = \$dom->createElement(\$k);
            \$el->appendChild(\$dom->createCDATASection((string)\$v));
            \$m->appendChild(\$el);
        }
        \$list->appendChild(\$m);
    }
    \$root->appendChild(\$list);
    \$dom->appendChild(\$root);
    echo \$dom->saveXML();
    exit;
}

if (\$method === \"DELETE\") {
    if (\$action !== \"movements\") xmlError(400, \"Unknown action\");
    \$db->execute(\"TRUNCATE TABLE \`{\$mvtTableFull}\`\");
    echo buildXml([\"success\" => 1], \"result\");
    exit;
}

if (\$method !== \"POST\") xmlError(405, \"Method Not Allowed\");

\$rawBody = file_get_contents(\"php://input\");
if (empty(\$rawBody)) xmlError(400, \"Empty body\");
libxml_use_internal_errors(true);
\$xml = simplexml_load_string(\$rawBody);
if (\$xml === false) xmlError(400, \"Invalid XML\");

if (\$action === \"add_movement\") {
    \$n = \$xml->movement;
    if (!\$n) xmlError(400, \"Missing <movement> node\");
    \$dateRaw = (string)(\$n->date ?? date(\"Y-m-d\\TH:i:s\"));
    \$dateSql = date(\"Y-m-d H:i:s\", strtotime(\$dateRaw) ?: time());
    \$db->insert(\$mvtTableRaw, [
        \"movement_id\"        => pSQL((string)(\$n->id                ?? uniqid())),
        \"line_key\"           => pSQL((string)(\$n->key               ?? \"\")),
        \"id_product\"         => (int)(\$n->id_product                ?? 0),
        \"product_name\"       => pSQL((string)(\$n->product_name      ?? \"\")),
        \"combination_label\"  => pSQL((string)(\$n->combination_label ?? \"\")),
        \"id_stock_available\" => (int)(\$n->id_stock_available        ?? 0),
        \"quantity_before\"    => (int)(\$n->quantity_before           ?? 0),
        \"quantity_added\"     => (int)(\$n->quantity_added            ?? 0),
        \"quantity_after\"     => (int)(\$n->quantity_after            ?? 0),
        \"date_add\"           => \$dateSql,
        \"note\"               => pSQL((string)(\$n->note              ?? \"\")),
    ]);
    echo buildXml([\"success\" => 1], \"result\");
    exit;
}

\$node               = \$xml->stock_update;
\$idProduct          = (int)(\$node->id_product          ?? 0);
\$idProductAttribute = (int)(\$node->id_product_attribute ?? 0);
\$delta              = (int)(\$node->delta                ?? 0);
if (\$idProduct <= 0) xmlError(400, \"id_product must be > 0\");
if (\$delta === 0)    xmlError(400, \"delta must be != 0\");

\$db->execute(
    \"UPDATE \`{\$prefix}stock_available\`\"
    . \" SET \`quantity\` = \`quantity\` + \" . (int)\$delta
    . \" WHERE \`id_product\` = \" . (int)\$idProduct
    . \" AND \`id_product_attribute\` = \" . (int)\$idProductAttribute
);
\$newQty = (int)\$db->getValue(
    \"SELECT \`quantity\` FROM \`{\$prefix}stock_available\`\"
    . \" WHERE \`id_product\` = \" . (int)\$idProduct
    . \" AND \`id_product_attribute\` = \" . (int)\$idProductAttribute
    . \" ORDER BY \`id_shop\` DESC\"
);
echo buildXml([
    \"success\"              => 1,
    \"id_product\"           => \$idProduct,
    \"id_product_attribute\" => \$idProductAttribute,
    \"new_quantity\"         => \$newQty,
]);
exit;
PHPEOF
echo 'stockapi.php déposé'"
```

---

## Étape 3 — Initialiser la clé secrète dans PrestaShop

```bash
docker exec prestashop_app php -r "
define('_PS_ROOT_DIR_', '/var/www/html');
require_once '/var/www/html/config/config.inc.php';
Configuration::updateValue('STOCKAPI_SECRET_KEY', 'ta_cle_secrete');
echo Configuration::get('STOCKAPI_SECRET_KEY');
"
```

La même valeur doit être dans `.env` :
```env
VITE_STOCKAPI_KEY=ta_cle_secrete
```

---

## Étape 4 — Vérifier le `.env`

```env
VITE_API_BASE_URL=/api
VITE_PRESTASHOP_API_KEY=<ta_cle_webservice_PS>
VITE_PRESTASHOP_URL=http://localhost:8080
VITE_STOCKAPI_KEY=<meme_valeur_que_STOCKAPI_SECRET_KEY>
```

---

## Étape 5 — Tests rapides

### Ajout de stock (met à jour `ps_stock_available`)
```bash
curl -X POST http://localhost:8080/stockapi.php \
  -H "Content-Type: application/xml" \
  -H "X-Api-Key: ta_cle_secrete" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<prestashop><stock_update>
  <id_product>1</id_product>
  <id_product_attribute>0</id_product_attribute>
  <delta>5</delta>
</stock_update></prestashop>'
# Réponse attendue : <success>1</success> + <new_quantity>...</new_quantity>
```

### Lecture des mouvements custom
```bash
curl http://localhost:8080/stockapi.php?action=movements \
  -H "X-Api-Key: ta_cle_secrete"
# Réponse attendue : <prestashop><movements>...</movements></prestashop>
```

### Écriture dans `ps_stock_mvt` (endpoint natif PS)
```bash
curl -X POST http://localhost:8080/api/stock_movements \
  -u "ta_cle_webservice_PS:" \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><stock_mvt>
  <id_employee>1</id_employee>
  <id_stock>0</id_stock>
  <id_stock_mvt_reason>1</id_stock_mvt_reason>
  <physical_quantity>5</physical_quantity>
  <sign>1</sign>
  <price_te>0</price_te>
  <date_add>2026-01-01 10:00:00</date_add>
</stock_mvt></prestashop>'
# Réponse attendue : <stock_mvt><id>...</id>...</stock_mvt>
```

---

## Architecture finale

| Opération | `ps_stock_available` | `ps_stock_movements_app` | `ps_stock_mvt` |
|---|---|---|---|
| Ajout manuel (app) | `POST /stockapi.php` | `POST /stockapi.php?action=add_movement` | `POST /api/stock_movements` raison 1 |
| Validation commande | PS natif (création order) | `POST /stockapi.php?action=add_movement` | `POST /api/stock_movements` raison 3 |
| Annulation commande | PS natif | `POST /stockapi.php?action=add_movement` | `POST /api/stock_movements` raison 10 |

**Raisons `ps_stock_mvt_reason` utilisées :**

| id | Libellé | sign |
|----|---------|------|
| 1 | Augmentation | +1 |
| 3 | Commande client | -1 |
| 10 | Retour produit | +1 |

---

## Rappel — Proxy Vite

Le proxy dans `vite.config.ts` ajoute automatiquement `Authorization: Basic ...` sur les requêtes vers `/api`. C'est pour ça que les appels vers `/api/stock_movements` depuis le TS n'ont pas besoin de gérer l'auth manuellement.

Les appels vers `stockapi.php` (hors `/api`) utilisent le header `X-Api-Key` géré par l'instance `moduleApi` dans `stockService.ts`.
