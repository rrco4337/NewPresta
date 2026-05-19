# Mouvements de stock — Ce qui a été fait

---

## Contexte

L'objectif : chaque opération qui touche le stock (ajout manuel, validation de commande, annulation) doit créer une ligne visible :
- dans **l'onglet Mouvements** de l'app React
- dans **`ps_stock_mvt`** (table native PrestaShop visible dans le back-office)

---

## 1. `stockapi.php` — Nouvelles routes

Le fichier standalone `/var/www/html/stockapi.php` a été étendu avec 3 nouvelles routes, en plus de la route stock update existante.

### CORS étendu

```php
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
```

### Fonction helper `insertStockMvt`

Insère dans `ps_stock_mvt`. Aucune contrainte FK sur `id_stock` → on passe `0` (la table `ps_stock` est vide, gestion de stock avancée non utilisée).

```php
function insertStockMvt(Db $db, string $prefix, int $physQty, int $sign, int $reason): void {
    $db->execute(
        "INSERT INTO `{$prefix}stock_mvt`"
        . " (id_stock, id_order, id_stock_mvt_reason, id_employee, employee_lastname, employee_firstname, physical_quantity, date_add, sign, price_te)"
        . " VALUES (0, NULL, {$reason}, 1, 'Stock', 'API', " . (int)$physQty . ", NOW(), " . (int)$sign . ", 0)"
    );
}
```

**Raisons utilisées (`ps_stock_mvt_reason`) :**

| `id` | Libellé | `sign` | Quand |
|------|---------|--------|-------|
| `1` | Augmentation | +1 | Ajout manuel de stock |
| `2` | Diminution | -1 | Retrait manuel |
| `3` | Commande client | -1 | Sortie lors d'une commande validée |
| `10` | Retour produit | +1 | Entrée lors d'une annulation de commande |

---

### Route GET — lire les mouvements

```
GET /stockapi.php?action=movements
X-Api-Key: <clé>
```

Retourne les mouvements de `ps_stock_movements_app` (table custom) triés par date décroissante.

```xml
<prestashop>
  <movements>
    <movement>
      <movement_id><![CDATA[abc_001]]></movement_id>
      <line_key><![CDATA[336_248]]></line_key>
      <id_product><![CDATA[336]]></id_product>
      <product_name><![CDATA[T-shirt]]></product_name>
      <combination_label><![CDATA[Bleu / M]]></combination_label>
      <id_stock_available><![CDATA[608]]></id_stock_available>
      <quantity_before><![CDATA[10]]></quantity_before>
      <quantity_added><![CDATA[-2]]></quantity_added>
      <quantity_after><![CDATA[8]]></quantity_after>
      <date_add><![CDATA[2026-05-16 10:30:00]]></date_add>
      <note><![CDATA[Sortie commande PANIER-123]]></note>
    </movement>
  </movements>
</prestashop>
```

---

### Route POST — enregistrer un mouvement

```
POST /stockapi.php?action=add_movement
Content-Type: application/xml
X-Api-Key: <clé>
```

Corps XML :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
  <movement>
    <id>abc_001</id>
    <key>336_248</key>
    <id_product>336</id_product>
    <product_name>T-shirt</product_name>
    <combination_label>Bleu / M</combination_label>
    <id_stock_available>608</id_stock_available>
    <quantity_before>10</quantity_before>
    <quantity_added>-2</quantity_added>   <!-- négatif = sortie -->
    <quantity_after>8</quantity_after>
    <date>2026-05-16T10:30:00.000Z</date>
    <note>Sortie commande PANIER-123</note>
  </movement>
</prestashop>
```

Ce que fait le PHP :
1. Insère dans `ps_stock_movements_app` (table custom de l'app)
2. Insère dans `ps_stock_mvt` avec la raison déduite du champ `note` et du signe de `quantity_added` :
   - `quantity_added < 0` + note contient "commande" → raison `3`
   - `quantity_added >= 0` + note contient "annulation" → raison `10`
   - sinon `quantity_added >= 0` → raison `1`, sinon raison `2`

---

### Route DELETE — vider l'historique

```
DELETE /stockapi.php?action=movements
X-Api-Key: <clé>
```

Fait un `TRUNCATE` de `ps_stock_movements_app`. Ne touche pas `ps_stock_mvt`.

---

### Route POST stock update — enrichie

```
POST /stockapi.php
Content-Type: application/xml
X-Api-Key: <clé>
```

Comportement inchangé pour `ps_stock_available`, mais maintenant insère aussi dans `ps_stock_mvt` :

```php
$sign   = $delta > 0 ? 1 : -1;
$reason = $delta > 0 ? 1 : 2;
insertStockMvt($db, $prefix, abs($delta), $sign, $reason);
```

---

## 2. Table `ps_stock_movements_app`

Créée automatiquement au premier appel si elle n'existe pas :

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
  `quantity_added`     INT          NOT NULL,  -- négatif pour sortie
  `quantity_after`     INT          NOT NULL,
  `date_add`           DATETIME     NOT NULL,
  `note`               VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_date` (`date_add`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Pas de module, pas de migration : le `CREATE TABLE IF NOT EXISTS` est exécuté à chaque requête (aucun impact si la table existe déjà).

---

## 3. `stockService.ts` — Plus de localStorage

Les mouvements ne sont plus dans le localStorage. Toutes les opérations passent par `stockapi.php`.

### `writeMovement` (interne, async)

```ts
async function writeMovement(m: StockMovement): Promise<void> {
  await moduleApi.post('/stockapi.php', buildMovementXml(m), {
    params: { action: 'add_movement' },
  });
}
```

### `getMovements` (async)

```ts
getMovements: async (productId?: string): Promise<StockMovement[]> => {
  const { data } = await moduleApi.get('/stockapi.php', { params: { action: 'movements' } });
  const all = parseMovementsXml(data);
  return productId ? all.filter(m => m.productId === productId) : all;
},
```

### `clearMovements` (async)

```ts
clearMovements: async (): Promise<void> => {
  await moduleApi.delete('/stockapi.php', { params: { action: 'movements' } });
},
```

---

## 4. `orderService.ts` — Lignes du panier transmises

`PSOrder` a un nouveau champ `cartRows?: CartRow[]` (rempli par `parseCartsXml`).  
Nouvelle fonction exportée `fetchOrderRows(orderId)` pour lire les lignes d'une commande existante.

---

## 5. `OrderList.tsx` — Déclenchement automatique

Après chaque changement de statut réussi :

```ts
if (newValue === 2) {
  // Validation → sortie stock
  const rows = order.cartRows?.length ? order.cartRows : await fetchOrderRows(order.id);
  stockService.recordOrderMovements(rows, ref, 'sortie').catch(() => {});
} else if (newValue === 6 && oldValue === 2) {
  // Annulation → entrée stock (retour)
  const rows = await fetchOrderRows(order.id);
  stockService.recordOrderMovements(rows, ref, 'entree').catch(() => {});
}
```

---

## 6. `StockUpdate.tsx` — Affichage des sorties en rouge

Colonne "Ajout" renommée "Mouvement". Valeurs négatives (sorties) en rouge :

```tsx
<td className={`su-td-num ${m.quantityAdded >= 0 ? 'su-td-added' : 'su-td-removed'}`}>
  {m.quantityAdded >= 0 ? '+' : ''}{m.quantityAdded}
</td>
```

CSS ajouté : `.su-td-removed { color: var(--su-danger); font-weight: 600; }`

---

## 7. Flux complet

```
Validation commande (état → 2)
  → OrderList appelle recordOrderMovements(..., 'sortie')
    → stockService appelle writeMovement() pour chaque produit
      → POST /stockapi.php?action=add_movement
        → INSERT ps_stock_movements_app  (visible onglet Mouvements)
        → INSERT ps_stock_mvt reason=3   (visible back-office PS)

Ajout manuel de stock (bouton "+ Ajouter")
  → stockService.addStock()
    → POST /stockapi.php  (delta positif)
      → UPDATE ps_stock_available
      → INSERT ps_stock_mvt reason=1
    → writeMovement()
      → POST /stockapi.php?action=add_movement
        → INSERT ps_stock_movements_app
        → INSERT ps_stock_mvt reason=1

Annulation commande (état 2 → 6)
  → OrderList appelle recordOrderMovements(..., 'entree')
    → POST /stockapi.php?action=add_movement
      → INSERT ps_stock_movements_app
      → INSERT ps_stock_mvt reason=10
```
