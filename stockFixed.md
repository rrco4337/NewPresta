# stockFixed.md — Mouvements de stock : tout ce qui a été fait

Ce document retrace **tout ce qui a été mis en place** pour que les mouvements de stock fonctionnent : côté PrestaShop (Docker) et côté NewApp (TypeScript/React).

---

## Vue d'ensemble de l'architecture

```
NewApp (React/Vite)
    │
    ├── /api/*  ──────────────────────────────────────────────────────────►  PS Webservice natif
    │   (proxy Vite ajoute Authorization: Basic automatiquement)             /api/stock_availables
    │                                                                        /api/stock_movements
    │                                                                        /api/combinations
    │                                                                        /api/products …
    │
    └── stockapi.php  ────────────────────────────────────────────────────►  Fichier PHP standalone
        (auth X-Api-Key, moduleApi dans stockService.ts)                     à la racine PS Docker
                                                                             gère delta stock + historique
```

### Trois tables PS impliquées

| Table | Rôle |
|---|---|
| `ps_stock_available` | Stock courant par produit/déclinaison (source de vérité PS) |
| `ps_stock_movements_app` | Historique custom créé par `stockapi.php` (lecture dans l'onglet Mouvements) |
| `ps_stock_mvt` | Historique natif PS (débloqué pour écriture, alimenté en parallèle) |

---

## Partie 1 — Ce qui a été fait dans PrestaShop (Docker)

### 1.1 Débloquer le POST sur `/api/stock_movements`

Par défaut, PrestaShop interdit le POST sur `stock_movements` via le webservice.  
Le fichier core `/var/www/html/classes/webservice/WebserviceRequest.php` avait la clé `forbidden_method` qui bloquait `PUT`, `POST`, `PATCH`, `DELETE`.

**Commande appliquée :**
```bash
docker exec prestashop_app sed -i \
  "s/'stock_movements' => \['description' => 'Stock movements', 'class' => 'StockMvtWS', 'forbidden_method' => \['PUT', 'POST', 'PATCH', 'DELETE'\]\]/'stock_movements' => ['description' => 'Stock movements', 'class' => 'StockMvtWS']/" \
  /var/www/html/classes/webservice/WebserviceRequest.php
```

**Vérification :**
```bash
docker exec prestashop_app grep 'stock_movements' /var/www/html/classes/webservice/WebserviceRequest.php
# Résultat attendu : 'stock_movements' => ['description' => 'Stock movements', 'class' => 'StockMvtWS'],
```

> ⚠️ Ce fichier est dans le core PS. Une mise à jour de PS écrase cette modification. Il faut la refaire.

---

### 1.2 Déposer `stockapi.php` à la racine PS

Pas de module installé (interdit en prod). À la place, un fichier PHP standalone `stockapi.php` est déposé directement à `/var/www/html/stockapi.php`.

Ce fichier gère **4 routes** selon `method` + paramètre `action` :

| Méthode | `?action=` | Ce que ça fait |
|---|---|---|
| `POST` | _(absent)_ | Met à jour `ps_stock_available` en **delta** (atomique) |
| `POST` | `add_movement` | Insère une ligne dans `ps_stock_movements_app` |
| `GET` | `movements` | Renvoie tout l'historique `ps_stock_movements_app` en XML |
| `DELETE` | `movements` | Vide (TRUNCATE) `ps_stock_movements_app` |

**Authentification :** header `X-Api-Key` comparé à la valeur de `Configuration::get('STOCKAPI_SECRET_KEY')` en base PS.

**La table `ps_stock_movements_app` est créée automatiquement** au premier appel si elle n'existe pas :
```sql
CREATE TABLE IF NOT EXISTS `ps_stock_movements_app` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `movement_id`        VARCHAR(60)  NOT NULL,
  `line_key`           VARCHAR(100) NOT NULL,
  `id_product`         INT UNSIGNED NOT NULL,
  `product_name`       VARCHAR(255) NOT NULL,
  `combination_label`  VARCHAR(255) NOT NULL DEFAULT '',
  `id_stock_available` INT UNSIGNED NOT NULL DEFAULT 0,
  `quantity_before`    INT          NOT NULL,
  `quantity_added`     INT          NOT NULL,
  `quantity_after`     INT          NOT NULL,
  `date_add`           DATETIME     NOT NULL,
  `note`               VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date_add`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Logique delta stock (route POST principale) :**
```sql
UPDATE `ps_stock_available`
SET `quantity` = `quantity` + {delta}
WHERE `id_product` = {idProduct}
AND `id_product_attribute` = {idProductAttribute}
```
→ Mise à jour atomique, aucun read-then-write, pas de race condition.

---

### 1.3 Initialiser la clé secrète dans PS

```bash
docker exec prestashop_app php -r "
define('_PS_ROOT_DIR_', '/var/www/html');
require_once '/var/www/html/config/config.inc.php';
Configuration::updateValue('STOCKAPI_SECRET_KEY', 'ta_cle_secrete');
echo Configuration::get('STOCKAPI_SECRET_KEY');
"
```

La même valeur va dans le `.env` de l'app :
```env
VITE_STOCKAPI_KEY=ta_cle_secrete
```

---

### 1.4 Raisons `ps_stock_mvt_reason` utilisées

| id | Libellé PS | sign | Déclencheur |
|----|-----------|------|-------------|
| 1 | Augmentation | +1 | Ajout manuel (`addStock`) |
| 3 | Commande client | -1 | Validation commande (`recordOrderMovements`) |
| 10 | Retour produit | +1 | Annulation commande (`recordOrderMovements`) |

---

## Partie 2 — Ce qui a été fait dans l'application (TypeScript/React)

### 2.1 Proxy Vite (`vite.config.ts`)

Le proxy Vite intercepte toutes les requêtes vers `VITE_API_BASE_URL` (typiquement `/api`) et :
- Les redirige vers `VITE_PRESTASHOP_URL` (ex. `http://localhost:8080`)
- Injecte automatiquement le header `Authorization: Basic <base64(VITE_PRESTASHOP_API_KEY:)>`

```typescript
proxy: {
  [env.VITE_API_BASE_URL]: {
    target: env.VITE_PRESTASHOP_URL,
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        const auth = 'Basic ' + Buffer.from(env.VITE_PRESTASHOP_API_KEY + ':').toString('base64');
        proxyReq.setHeader('Authorization', auth);
      });
    }
  }
}
```

Résultat : les appels `/api/stock_movements`, `/api/stock_availables`, etc. n'ont **pas besoin de gérer l'auth manuellement** côté TS.

---

### 2.2 `src/services/stockService.ts` — Le service principal

C'est le cœur de la gestion des stocks dans l'app.

#### Deux instances axios

```typescript
// Pour /api/* (proxy Vite → PS webservice natif)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
});

// Pour stockapi.php (hors /api, auth X-Api-Key)
const moduleApi = axios.create({
  baseURL: import.meta.env.VITE_PRESTASHOP_URL,
  headers: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml',
    'X-Api-Key': import.meta.env.VITE_STOCKAPI_KEY,
  },
});
```

#### Types principaux

```typescript
interface StockLine {
  key: string;              // "${productId}_${combinationId ?? '0'}"
  productId: string;
  productName: string;
  productType: 'simple' | 'combinations';
  combinationId: string | null;
  combinationLabel: string; // ex. "Bleu / M", vide pour produit simple
  stockId: string;          // id de ps_stock_available
  quantity: number;
  reference: string;
  ean13: string;
}

interface StockMovement {
  id: string;
  key: string;
  productId: string;
  productName: string;
  combinationLabel: string;
  stockId: string;
  quantityBefore: number;
  quantityAdded: number;    // négatif pour une sortie
  quantityAfter: number;
  date: string;             // ISO 8601
  note: string;
}
```

#### `getAllStockLines()` — Chargement des lignes de stock

Fait 4 appels PS en parallèle :
1. `GET /products?display=full` → tous les produits actifs + leurs IDs de déclinaisons
2. `GET /combinations?display=full` → toutes les déclinaisons avec leurs `optionValueIds`
3. `GET /stock_availables?display=full` → tous les stocks
4. `GET /product_option_values?display=full` → noms des options (Bleu, M, XL…)

Puis :
- **Produit simple** : cherche `ps_stock_available` avec `id_product_attribute=0`
- **Produit à déclinaisons** : une ligne par déclinaison, cherche le stock avec `id_product_attribute=combo.id`
- Le label de déclinaison est construit en joignant les noms d'options : `"Bleu / M"`

#### `addStock(line, qty, note)` — Ajout de stock

**Flux complet :**

```
1. buildStockUpdateXml(productId, combinationId ?? 0, qty)
   → XML avec <delta>qty</delta>

2. POST /stockapi.php (moduleApi)
   → stockapi.php fait UPDATE ps_stock_available SET quantity = quantity + delta
   → renvoie <new_quantity>X</new_quantity>

3. En parallèle :
   a. POST /stockapi.php?action=add_movement (moduleApi)
      → insère dans ps_stock_movements_app
   b. POST /api/stock_movements (api, proxy Vite)
      → insère dans ps_stock_mvt natif PS (raison 1 = Augmentation)

4. Retourne { ...line, quantity: newQty }
```

#### `recordOrderMovements(rows, orderRef, direction)` — Mouvements commande

Utilisé pour les sorties (validation commande) et retours (annulation).

```
direction = 'sortie' → delta négatif, raison PS = 3 (Commande client), sign = -1
direction = 'entree' → delta positif, raison PS = 10 (Retour produit), sign = +1
```

Pour chaque ligne de commande :
- Calcule `quantityBefore = quantityAfter - delta` (le stock après a déjà été mis à jour par PS natif)
- Écrit dans `ps_stock_movements_app` via `stockapi.php`
- Écrit dans `ps_stock_mvt` via le webservice natif

#### `getMovements()` / `clearMovements()`

- `GET /stockapi.php?action=movements` → renvoie tout l'historique `ps_stock_movements_app` en XML
- `DELETE /stockapi.php?action=movements` → TRUNCATE `ps_stock_movements_app`

---

### 2.3 `src/services/shopService.ts` — Affichage du stock en boutique

#### Problème résolu : `parseStockXml` et `fetchStockMap`

**Contexte de la base :**
- Produits anciens (créés dans le BO PS) : ont des enregistrements `ps_stock_available` avec `id_shop=0`
- Produits importés via l'app (PUT webservice avec `<id_shop>1</id_shop>`) : ont des enregistrements avec `id_shop=1`
- Aucun produit n'a les deux simultanément
- Produits à déclinaisons : ont un enregistrement `id_product_attribute=0` (cache périmé) ET des enregistrements par déclinaison (`id_product_attribute=combo_id`) — la source de vérité est la somme des déclinaisons

**Ancienne logique (cassée) :**
```typescript
// Filtrait sur id_product_attribute=0 → excluait les déclinaisons
api.get('/stock_availables?filter[id_product_attribute]=[0]&display=...')
// ou filtrait sur id_shop=0 → excluait tous les produits importés
```

**Nouvelle logique (`parseStockXml`) :**
```typescript
function parseStockXml(xml: string): Map<string, number> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const baseMap  = new Map<string, number>(); // attr=0 (produits simples)
  const comboMap = new Map<string, number>(); // somme des déclinaisons

  doc.querySelectorAll('stock_available').forEach(el => {
    const pid  = el.querySelector('id_product')?.textContent?.trim();
    const attr = el.querySelector('id_product_attribute')?.textContent?.trim() ?? '0';
    const qty  = parseInt(el.querySelector('quantity')?.textContent ?? '0', 10);
    if (!pid) return;
    if (attr === '0') {
      baseMap.set(pid, qty);
    } else {
      comboMap.set(pid, (comboMap.get(pid) ?? 0) + qty); // somme des déclinaisons
    }
  });

  // Règle : si le produit a des déclinaisons → utiliser comboMap (source de vérité)
  //         sinon → utiliser baseMap (produit simple)
  const result = new Map<string, number>();
  comboMap.forEach((qty, pid) => result.set(pid, qty));
  baseMap.forEach((qty, pid) => { if (!comboMap.has(pid)) result.set(pid, qty); });
  return result;
}
```

**Requête sans filtre id_shop :**
```typescript
api.get('/stock_availables?display=[id_product,id_product_attribute,quantity]')
// Pas de filter[id_shop] → récupère TOUS les enregistrements quelle que soit la shop
```

**Exemple de stocks corrects obtenus :**
| Produit | id | Stock affiché |
|---|---|---|
| Tshirt (combinaisons) | 348 | 21 (combo 260=14 + combo 261=7) |
| Pantalon (combinaisons) | 349 | 8 (combo 262=5 + combo 263=3) |
| Casquette (simple) | 350 | 9 |
| Produits anciens | 2, 4, 6 | 2100, 1497, 299 |

---

### 2.4 `src/services/fichierImportService.ts` — Mise à jour stock lors d'un import

Lors de l'import de fichiers, le stock est mis à jour via **PUT webservice natif** (valeur absolue) :

```typescript
async function setStock(stockId, productId, combinationId, qty): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id><![CDATA[${stockId}]]></id>
    <id_product><![CDATA[${productId}]]></id_product>
    <id_product_attribute><![CDATA[${combinationId}]]></id_product_attribute>
    <id_shop><![CDATA[1]]></id_shop>
    <id_shop_group><![CDATA[0]]></id_shop_group>
    <quantity><![CDATA[${qty}]]></quantity>
    <depends_on_stock><![CDATA[0]]></depends_on_stock>
    <out_of_stock><![CDATA[0]]></out_of_stock>
  </stock_available>
</prestashop>`;
  await api.put(`/stock_availables/${stockId}`, xml);
}
```

> ⚠️ `<id_shop>1</id_shop>` dans le body du PUT → PS crée/met à jour l'enregistrement avec `id_shop=1`. C'est pourquoi les produits importés ont `id_shop=1` dans `ps_stock_available`.

---

### 2.5 `src/services/produitApi.ts` — Mise à jour stock depuis la page produit

```typescript
updateStock: async (stockId, productId, quantity) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <stock_available>
      <id><![CDATA[${stockId}]]></id>
      <id_product><![CDATA[${productId}]]></id_product>
      <quantity><![CDATA[${quantity}]]></quantity>
      <id_product_attribute><![CDATA[0]]></id_product_attribute>
      <id_shop><![CDATA[1]]></id_shop>
      <id_shop_group><![CDATA[0]]></id_shop_group>
      <depends_on_stock><![CDATA[0]]></depends_on_stock>
      <out_of_stock><![CDATA[0]]></out_of_stock>
    </stock_available>
  </prestashop>`;
  return api.put(`/stock_availables/${stockId}`, xml);
},
```

---

### 2.6 `src/components/StockUpdate.tsx` — Interface de gestion des stocks

Composant React à la route `/stock`. Deux onglets :

**Onglet "Stocks" :**
- Charge toutes les lignes via `stockService.getAllStockLines()`
- Affiche les produits groupés (un groupe par produit, N lignes pour N déclinaisons)
- Badges colorés : vert (>5), orange (1-5), rouge (0)
- Champ quantité + note, bouton "+ Ajouter" → appelle `stockService.addStock()`
- Filtres : Tous / Épuisé / Bas stock (≤5)

**Onglet "Mouvements" :**
- Charge l'historique via `stockService.getMovements()`
- Tableau : date, produit, déclinaison, avant, mouvement (+/-), après, motif
- Bouton "Vider l'historique" → `stockService.clearMovements()`

---

## Partie 3 — Variables d'environnement requises

Fichier `.env` à la racine du projet :

```env
# URL de base du webservice PS (proxy Vite)
VITE_API_BASE_URL=/api

# Clé webservice PrestaShop (sans les deux-points)
VITE_PRESTASHOP_API_KEY=<ta_cle_webservice_PS>

# URL PS directe (sans /api) — pour stockapi.php et le proxy Vite
VITE_PRESTASHOP_URL=http://localhost:8080

# Clé secrète stockapi.php (doit correspondre à STOCKAPI_SECRET_KEY dans PS)
VITE_STOCKAPI_KEY=ta_cle_secrete

# Répertoire admin PS (pour le proxy d'auth admin)
VITE_ADMIN_DIR=<nom_du_dossier_admin>
```

---

## Partie 4 — Flux complets

### Ajout manuel de stock (page `/stock`)

```
Utilisateur saisit qty + note → handleAddStock()
  → stockService.addStock(line, qty, note)
    → POST stockapi.php             (delta +qty sur ps_stock_available)
    → POST stockapi.php?action=add_movement  (historique ps_stock_movements_app)
    → POST /api/stock_movements     (historique natif ps_stock_mvt, raison 1)
    → UI mise à jour avec new_quantity
```

### Validation d'une commande

```
Commande validée → stockService.recordOrderMovements(rows, ref, 'sortie')
  Pour chaque ligne produit :
    → POST stockapi.php?action=add_movement  (delta négatif, ps_stock_movements_app)
    → POST /api/stock_movements     (ps_stock_mvt, raison 3, sign=-1)
```

### Annulation / retour commande

```
Commande annulée → stockService.recordOrderMovements(rows, ref, 'entree')
  Pour chaque ligne produit :
    → POST stockapi.php?action=add_movement  (delta positif, ps_stock_movements_app)
    → POST /api/stock_movements     (ps_stock_mvt, raison 10, sign=+1)
```

### Import fichier (mise à jour stock absolue)

```
Import CSV → setStock(stockId, productId, combinationId, qty)
  → PUT /api/stock_availables/{stockId}  (valeur absolue, id_shop=1)
```

---

## Partie 5 — Points de vigilance

### `id_shop` dans `ps_stock_available`

PS peut stocker les disponibilités de stock avec `id_shop=0` (anciens produits BO) ou `id_shop=1` (produits modifiés via webservice avec `<id_shop>1</id_shop>` dans le XML). Ne jamais filtrer sur `id_shop` lors de la lecture : récupérer tous les enregistrements et laisser la logique applicative décider.

### Produits à déclinaisons

L'enregistrement `id_product_attribute=0` d'un produit à déclinaisons est un **cache périmé** (il reflète une ancienne valeur totale, pas forcément correcte). La source de vérité est la **somme des enregistrements individuels** par déclinaison (`id_product_attribute=combo_id`). La fonction `parseStockXml` dans `shopService.ts` gère ce cas.

### `stockapi.php` n'est pas un module PS

C'est un fichier PHP standalone sans déclaration de module. Il charge le framework PS (`config.inc.php`) pour accéder à `Db::getInstance()` et `Configuration::get()`. Aucune installation de module n'est requise, ce qui le rend compatible avec les environnements de production restreints.

### Mise à jour de PS (core)

La modification de `WebserviceRequest.php` (étape 1.1) est sur un fichier core. Une mise à jour de PS écrase cette modification. Il faut la réappliquer.
