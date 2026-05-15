# Guide complet — Endpoint stock PrestaShop (XML) + React

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Création du module PrestaShop](#2-création-du-module-prestashop)
3. [Fichier principal du module](#3-fichier-principal-du-module)
4. [Le contrôleur — l'unique endpoint](#4-le-contrôleur--lunique-endpoint)
5. [Installation du module](#5-installation-du-module)
6. [Récupérer la clé secrète](#6-récupérer-la-clé-secrète)
7. [Variables d'environnement React](#7-variables-denvironnement-react)
8. [Modifications dans StockService.ts](#8-modifications-dans-stockservicets)
9. [Quand appeler addStock — les 4 déclencheurs](#9-quand-appeler-addstock--les-4-déclencheurs)
10. [Où placer les appels dans le code React](#10-où-placer-les-appels-dans-le-code-react)
11. [Tester l'endpoint manuellement](#11-tester-lendpoint-manuellement)
12. [Résumé des flux](#12-résumé-des-flux)

---

## 1. Vue d'ensemble

```
React App
  │
  │  POST /module/stockapi/update
  │  Content-Type: application/xml
  │  X-Api-Key: ***
  │
  │  Body XML :
  │  <prestashop>
  │    <stock_update>
  │      <id_product>5</id_product>
  │      <id_product_attribute>3</id_product_attribute>
  │      <delta>10</delta>          ← ajout relatif, pas valeur absolue
  │    </stock_update>
  │  </prestashop>
  │
  ▼
PrestaShop Module (stockapi)
  │  Vérifie la clé secrète
  │  Parse le XML
  │  StockAvailable::updateQuantity($idProduct, $idAttr, $delta)
  │  Retourne XML avec new_quantity
  ▼
React reçoit la réponse XML et met à jour l'état local
```

**Pourquoi `updateQuantity` avec delta plutôt que PUT `/stock_availables` ?**

| Méthode | Comportement | Risque |
|---|---|---|
| `PUT /stock_availables` (valeur absolue) | Écrase le stock à une valeur fixe | Race condition si 2 utilisateurs simultanés |
| `updateQuantity($id, $attr, $delta)` | Ajoute ou soustrait atomiquement | Aucun — PS gère la concurrence |

---

## 2. Création du module PrestaShop

Créez cette arborescence **dans le dossier `modules/` de PrestaShop** : *deja dans ce projet , juste a copier

```
modules/
└── stockapi/
    ├── stockapi.php
    └── controllers/
        └── front/
            └── update.php
```

---

## 3. Fichier principal du module

**`modules/stockapi/stockapi.php`**

```php
name          = 'stockapi';
        $this->tab           = 'administration';
        $this->version       = '1.0.0';
        $this->author        = 'Custom';
        $this->need_instance = 0;
        parent::__construct();
        $this->displayName = $this->l('Stock API');
        $this->description = $this->l('Endpoint XML unique pour mise à jour de stock par delta');
    }

    public function install(): bool
    {
        // Génère une clé aléatoire de 32 caractères héxadécimaux
        Configuration::updateValue(
            'STOCKAPI_SECRET_KEY',
            bin2hex(random_bytes(16))
        );
        return parent::install();
    }

    public function uninstall(): bool
    {
        Configuration::deleteByName('STOCKAPI_SECRET_KEY');
        return parent::uninstall();
    }
}
```

---

## 4. Le contrôleur — l'unique endpoint

**`modules/stockapi/controllers/front/update.php`**

```php
<?php
class StockapiUpdateModuleFrontController extends ModuleFrontController
{
    public $ajax = true; // désactive le rendu du thème PS

    public function initContent(): void
    {
        // ── En-têtes ──────────────────────────────────────────────────
        header('Content-Type: application/xml; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Api-Key');

        // Pré-vol CORS (navigateur envoie OPTIONS avant le vrai POST)
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        // ── Vérification de la méthode ────────────────────────────────
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->xmlError(405, 'Method Not Allowed');
        }

        // ── Authentification par clé secrète ──────────────────────────
        $secret    = Configuration::get('STOCKAPI_SECRET_KEY');
        $headerKey = $_SERVER['HTTP_X_API_KEY'] ?? '';

        if (!$secret || !hash_equals($secret, $headerKey)) {
            $this->xmlError(401, 'Unauthorized');
        }

        // ── Lecture et parsing du body XML ────────────────────────────
        $rawBody = file_get_contents('php://input');
        if (empty($rawBody)) {
            $this->xmlError(400, 'Empty body');
        }

        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($rawBody);
        if ($xml === false) {
            $this->xmlError(400, 'Invalid XML');
        }

        // Structure attendue : ...
        $node               = $xml->stock_update;
        $idProduct          = (int)($node->id_product          ?? 0);
        $idProductAttribute = (int)($node->id_product_attribute ?? 0);
        $delta              = (int)($node->delta                ?? 0);

        // ── Validation ────────────────────────────────────────────────
        if ($idProduct <= 0) {
            $this->xmlError(400, 'id_product must be > 0');
        }
        if ($delta === 0) {
            $this->xmlError(400, 'delta must be != 0');
        }

        // ── Mise à jour du stock (méthode PS native) ──────────────────
        // delta positif  = entrée de stock
        // delta négatif  = sortie de stock
        StockAvailable::updateQuantity($idProduct, $idProductAttribute, $delta);

        // Lecture de la nouvelle quantité après mise à jour
        $newQty = (int) StockAvailable::getQuantityAvailableByProduct(
            $idProduct,
            $idProductAttribute
        );

        // ── Réponse XML ───────────────────────────────────────────────
        echo $this->buildXml([
            'success'              => 1,
            'id_product'           => $idProduct,
            'id_product_attribute' => $idProductAttribute,
            'new_quantity'         => $newQty,
        ]);
        exit;
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private function buildXml(array $fields): string
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;
        $root   = $dom->createElement('prestashop');
        $parent = $dom->createElement('stock_update');
        foreach ($fields as $tag => $value) {
            $el = $dom->createElement($tag);
            $el->appendChild($dom->createCDATASection((string)$value));
            $parent->appendChild($el);
        }
        $root->appendChild($parent);
        $dom->appendChild($root);
        return $dom->saveXML();
    }

    private function xmlError(int $code, string $msg): void
    {
        http_response_code($code);
        echo $this->buildXml(['success' => 0, 'error' => $msg]);
        exit;
    }
}
```

---

## 5. Installation du module

1. Déposez le dossier `stockapi/` dans `modules/` de votre PS
2. Allez dans **Back-Office → Modules → Gestionnaire de modules**
3. Recherchez **Stock API** et cliquez **Installer**

L'URL de l'endpoint devient alors :
```
https://votre-boutique.com/module/stockapi/update
```

---

## 6. Récupérer la clé secrète

**Option A — via le Back-Office PS :**  
Paramètres avancés → Paramètres → cherchez `STOCKAPI_SECRET_KEY`

**Option B — via SQL (phpMyAdmin ou CLI) :**
```sql
SELECT value
FROM ps_configuration
WHERE name = 'STOCKAPI_SECRET_KEY';
```

Copiez cette valeur, vous en aurez besoin à l'étape suivante.

---

## 7. Variables d'environnement React

Dans votre fichier **`.env`** (à la racine du projet Vite/React) :

```env
# URL de l'API XML native PS (déjà existant)
VITE_API_BASE_URL=https://votre-boutique.com/api

# URL de base PS (sans /api) — pour le module custom
VITE_PS_BASE_URL=https://votre-boutique.com

# Clé secrète copiée à l'étape 6
VITE_STOCKAPI_KEY=votre_cle_secrete_ici
```

> ⚠️ Ne commitez jamais `.env` dans Git. Ajoutez-le dans `.gitignore`.

---

## 8. Modifications dans StockService.ts

### 8a. Ajouter un second client Axios (XML, vers le module)

Ajoutez ceci **juste après la définition de `api`** (le client existant) :

```ts
// Client dédié au module stockapi (XML aussi, clé secrète)
const moduleApi: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_PS_BASE_URL || 'http://127.0.0.1:8080',
  headers: {
    'Content-Type': 'application/xml',
    'Accept':       'application/xml',
    'X-Api-Key':    import.meta.env.VITE_STOCKAPI_KEY ?? '',
  },
});
```

### 8b. Helper — construire le XML de requête

Ajoutez cette fonction utilitaire dans la section **HELPERS XML** :

```ts
/**
 * Construit le XML envoyé à /module/stockapi/update
 */
function buildStockUpdateXml(
  idProduct: string | number,
  idProductAttribute: string | number,
  delta: number
): string {
  return `

  
    <![CDATA[${idProduct}]]>
    <![CDATA[${idProductAttribute}]]>
    <![CDATA[${delta}]]>
  
`;
}
```

### 8c. Helper — parser la réponse XML

```ts
/**
 * Parse la réponse XML du module et retourne l'objet stock_update
 */
function parseStockUpdateResponse(xmlString: string): {
  success: boolean;
  newQty: number;
  error?: string;
} {
  const parsed = parseXML(xmlString) as any;
  const node   = parsed?.prestashop?.stock_update ?? parsed?.stock_update;

  if (!node) return { success: false, newQty: 0, error: 'Réponse XML invalide' };

  const success = String(node.success ?? '0') === '1';
  const newQty  = parseInt(String(node.new_quantity ?? '0'), 10);
  const error   = node.error ? String(node.error) : undefined;

  return { success, newQty, error };
}
```

### 8d. Remplacer la méthode `addStock` dans `stockService`

Remplacez **entièrement** la méthode `addStock` existante par :

```ts
addStock: async (line: StockLine, qty: number, note = ''): Promise => {
  if (qty <= 0) throw new Error('La quantité doit être > 0');

  // ── Appel du module PS via XML ───────────────────────────────────
  const xml = buildStockUpdateXml(
    line.productId,
    line.combinationId ?? 0,
    qty                       // delta positif = entrée de stock
  );

  const { data: rawXml } = await moduleApi.post(
    '/module/stockapi/update',
    xml
  );

  const result = parseStockUpdateResponse(rawXml);
  if (!result.success) {
    throw new Error(result.error ?? 'Erreur serveur');
  }

  const newQty = result.newQty;

  // ── Enregistrement du mouvement local (inchangé) ─────────────────
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
```

---

## 9. Quand appeler `addStock` — les 4 déclencheurs

### Déclencheur 1 — Mise à jour manuelle (déjà en place ✅)

**Qui ?** Gestionnaire de stock (composant `StockUpdate`)  
**Quand ?** Clic sur le bouton `+ Ajouter` ou `Enter` dans le champ quantité  
**Delta ?** Positif (entrée de marchandise)

```
Bouton "+ Ajouter"
  → handleAddStock(line)
    → stockService.addStock(line, qty, note)   ← déjà câblé
```

Rien à modifier, c'est déjà votre code existant.

---

### Déclencheur 2 — Import de produits

**Qui ?** Un composant ou un service d'import CSV/Excel  
**Quand ?** Après avoir créé/mis à jour des produits en masse  
**Delta ?** La quantité importée pour chaque ligne

Créez un helper dans votre service d'import :

```ts
// Dans votre service ou composant d'import
import { stockService } from './StockService';

interface ImportRow {
  productId:          string;
  combinationId?:     string | null;
  productName:        string;
  combinationLabel:   string;
  stockId:            string;
  currentQty:         number;   // quantité AVANT import (à récupérer via getAllStockLines)
  importQty:          number;   // quantité à AJOUTER
}

export async function applyImportedStock(rows: ImportRow[]): Promise {
  for (const row of rows) {
    if (row.importQty <= 0) continue;

    const line = {
      key:              `${row.productId}_${row.combinationId ?? '0'}`,
      productId:        row.productId,
      productName:      row.productName,
      productType:      row.combinationId ? 'combinations' : 'simple',
      combinationId:    row.combinationId ?? null,
      combinationLabel: row.combinationLabel,
      stockId:          row.stockId,
      quantity:         row.currentQty,
      reference:        '',
      ean13:            '',
    } as StockLine;

    await stockService.addStock(line, row.importQty, 'Import produits');
  }
}
```

**Où appeler ça ?** Dans la fonction qui traite votre import, après validation :

```ts
// Exemple dans un composant ImportProducts.tsx
const handleImportConfirm = async () => {
  setImporting(true);
  try {
    await applyImportedStock(parsedRows);   // ← ici
    alert('Import terminé, stocks mis à jour');
  } finally {
    setImporting(false);
  }
};
```

---

### Déclencheur 3 — Commande payée (sortie de stock)

**Qui ?** Un webhook ou un composant de suivi des commandes  
**Quand ?** Statut commande change vers `Paiement accepté` (id statut PS = 2)  
**Delta ?** **Négatif** (sortie de stock = `qty * -1`)

> ℹ️ **Note :** PrestaShop décrémente le stock automatiquement quand une commande est validée si l'option "Décrémentation à la commande" est activée. Ce déclencheur est utile **uniquement si vous gérez les commandes depuis React** (back-office custom) ou si PS n'est pas configuré pour le faire.

```ts
// Dans votre service de commandes
interface OrderLine {
  productId:          string;
  combinationId?:     string | null;
  productName:        string;
  combinationLabel:   string;
  stockId:            string;
  currentQty:         number;
  orderedQty:         number;
  orderId:            string;
}

export async function applyOrderPaid(lines: OrderLine[]): Promise {
  for (const line of lines) {
    const stockLine = {
      key:              `${line.productId}_${line.combinationId ?? '0'}`,
      productId:        line.productId,
      productName:      line.productName,
      productType:      line.combinationId ? 'combinations' : 'simple',
      combinationId:    line.combinationId ?? null,
      combinationLabel: line.combinationLabel,
      stockId:          line.stockId,
      quantity:         line.currentQty,
      reference:        '',
      ean13:            '',
    } as StockLine;

    // Delta NÉGATIF = sortie de stock
    await stockService.addStock(
      stockLine,
      -line.orderedQty,                    // ← négatif
      `Commande #${line.orderId} payée`
    );
  }
}
```

---

### Déclencheur 4 — Commande annulée (réintégration de stock)

**Qui ?** Même service de commandes  
**Quand ?** Statut change vers `Annulé` ou `Remboursé`  
**Delta ?** **Positif** (réintégration = stock revient)

```ts
export async function applyOrderCancelled(lines: OrderLine[]): Promise {
  for (const line of lines) {
    const stockLine = { /* idem */ } as StockLine;

    // Delta POSITIF = réintégration de stock
    await stockService.addStock(
      stockLine,
      +line.orderedQty,                    // ← positif
      `Commande #${line.orderId} annulée`
    );
  }
}
```

---

## 10. Où placer les appels dans le code React

```
src/
├── services/
│   ├── StockService.ts          ← modifier addStock (§8d)
│   │                               ajouter moduleApi (§8a)
│   │                               ajouter helpers XML (§8b, §8c)
│   │
│   ├── ImportService.ts         ← nouveau — applyImportedStock (§9 déclencheur 2)
│   └── OrderService.ts          ← nouveau — applyOrderPaid / applyOrderCancelled (§9 déclencheurs 3 & 4)
│
└── components/
    ├── StockUpdate.tsx           ← aucune modification nécessaire
    ├── ImportProducts.tsx        ← appeler applyImportedStock après parsing
    └── OrderList.tsx             ← appeler applyOrderPaid/Cancelled au changement de statut
```

**Règle simple :** `addStock` n'est **jamais appelé directement** dans les composants, toujours via un service intermédiaire (`ImportService`, `OrderService`) — sauf dans `StockUpdate.tsx` qui est déjà correct.

---

## 11. Tester l'endpoint manuellement

**Avec `curl` :**

```bash
# Récupérer votre clé (étape 6) et remplacer ci-dessous

curl -X POST https://votre-boutique.com/module/stockapi/update \
  -H "Content-Type: application/xml" \
  -H "X-Api-Key: VOTRE_CLE_SECRETE" \
  -d '

  
    
    
    
  
'
```

**Réponse attendue :**

```xml


  
    
    
    
    
  

```

**En cas d'erreur 401 :** La clé dans `.env` ne correspond pas.  
**En cas d'erreur 404 :** Le module n'est pas installé ou l'URL est incorrecte.  
**En cas d'erreur 400 :** Le XML envoyé est malformé ou `delta = 0`.

---

## 12. Résumé des flux

| Déclencheur | Fichier React | Delta | Note dans historique |
|---|---|---|---|
| Bouton `+ Ajouter` | `StockUpdate.tsx` | `+qty` | Saisie libre |
| Import produits | `ImportService.ts` | `+qty importée` | `"Import produits"` |
| Commande payée | `OrderService.ts` | `-qty commandée` | `"Commande #X payée"` |
| Commande annulée | `OrderService.ts` | `+qty commandée` | `"Commande #X annulée"` |

Tous ces cas passent par **la même méthode** `stockService.addStock()` qui appelle **le même endpoint** `/module/stockapi/update` — un seul point de vérité pour toutes les mutations de stock.
