# Mouvements de stock — Ce qui a été fait

## Contexte

Il fallait que les mouvements de stock (entrée et sortie) fonctionnent correctement dans les deux sens :
- **Entrée** : ajout manuel de stock depuis le backoffice (StockUpdate)
- **Sortie** : déclenchée automatiquement lors de la validation d'une commande (front office ou backoffice)

---

## 1. Analyse du flux existant (`addStock`)

Le `stockService.ts` avait déjà une fonction `addStock` pour les entrées de stock. Elle effectue 3 appels API dans l'ordre :

| Étape | Appel | Rôle |
|---|---|---|
| 1 | `POST /stockapi.php` | Met à jour `ps_stock_available` (quantité réelle dans PS) |
| 2 | `POST /api/stock_movements` | Crée une ligne dans `ps_stock_mvt` (visible dans le backoffice PS) |
| 3 | `POST /stockapi.php?action=add_movement` | Enregistre dans l'historique custom |

---

## 2. Ajout de `removeStock` — `src/services/stockService.ts`

Fonction symétrique de `addStock` pour les sorties de stock.

**Différences clés par rapport à `addStock` :**

| Paramètre | `addStock` | `removeStock` |
|---|---|---|
| Delta envoyé à `stockapi.php` | `+qty` | `-qty` |
| `sign` dans `stock_mvt` | `1` | `-1` |
| `id_stock_mvt_reason` | `1` (réapprovisionnement) | `2` (vente/sortie) |
| `quantity_added` dans l'historique | `+qty` | `-qty` |
| Validation supplémentaire | aucune | `qty <= stock actuel` (évite stock négatif) |

Les 3 mêmes appels API sont effectués dans le même ordre.

---

## 3. Ajout de `recordOrderMovements` — `src/services/stockService.ts`

Cette méthode était déjà appelée dans `OrderList.tsx` (backoffice) mais n'existait pas encore.

```
stockService.recordOrderMovements(rows, ref, 'sortie')  // commande validée
stockService.recordOrderMovements(rows, ref, 'entree')  // commande annulée → retour stock
```

**Ce qu'elle fait :**
1. Récupère toutes les lignes de stock actuelles via `getAllStockLines()`
2. Pour chaque ligne de la commande (`CartRow`), retrouve la `StockLine` correspondante
3. Appelle `removeStock` (sortie) ou `addStock` (entrée) avec comme note : `"Sortie commande REF-XXX"` ou `"Retour commande REF-XXX"`

**Déclenchement depuis `OrderList.tsx` :**
- État `1 → 2` (panier → paiement validé) → `recordOrderMovements(..., 'sortie')`
- État `2 → 6` (payé → annulé) → `recordOrderMovements(..., 'entree')`

---

## 4. Correction du double décrément — `src/components/CheckoutPage.tsx`

**Bug identifié :** le stock était décrémenté deux fois lors d'une commande front office.

**Cause :**
1. `createPSOrder` appelle `POST /order_histories` avec l'état 2 → PrestaShop décrémente automatiquement `ps_stock_available`
2. `updateStockAfterOrder` était appelé juste après → décrémentait à nouveau manuellement

**Fix :** suppression de l'import et de l'appel à `updateStockAfterOrder` dans `CheckoutPage.tsx`. PrestaShop gère le décrément du stock seul via `order_histories`.

---

## 5. Enregistrement des mouvements de sortie côté front office — `src/services/customerService.ts`

**Problème :** quand PS décrémente le stock automatiquement via `order_histories` (état 2), il ne crée **pas** de ligne dans `ps_stock_mvt`. Le backoffice PS ne voyait donc aucune "Diminution" après une commande front office.

**Fix :** dans `createPSOrder`, après l'appel à `order_histories`, on boucle sur chaque article commandé et on crée explicitement un enregistrement `stock_mvt` :

```
Pour chaque article :
    GET /stock_availables?filter[id_product]=[x]&filter[id_product_attribute]=[y]
        → récupère l'id_stock
    POST /stock_movements
        → sign=-1, physical_quantity=qty, id_stock_mvt_reason=2
        → crée la ligne "Diminution" visible dans le backoffice PS
```

---

## Récapitulatif des flux complets

### Commande front office (CheckoutPage)
```
Client valide sa commande
    ├─ createPSOrder()
    │       ├─ POST /orders                    → crée la commande (état initial 1)
    │       ├─ POST /order_histories (état 2)  → PS décrémente ps_stock_available
    │       └─ Pour chaque article :
    │               GET /stock_availables      → récupère id_stock
    │               POST /stock_movements      → ligne "Diminution" dans backoffice PS
    └─ clear()                                 → vide le panier local
```

### Validation backoffice (OrderList — panier → paiement)
```
Admin passe commande de état 1 → état 2
    ├─ transformCartToOrder()                  → crée la commande dans PS
    └─ recordOrderMovements(rows, ref, 'sortie')
            └─ Pour chaque ligne :
                    removeStock(line, qty, note)
                        ├─ POST /stockapi.php (-delta)         → met à jour ps_stock_available
                        ├─ POST /api/stock_movements (sign=-1) → ligne backoffice PS
                        └─ POST /stockapi.php?action=add_movement → historique custom
```

### Annulation backoffice (OrderList — payé → annulé)
```
Admin passe commande de état 2 → état 6
    ├─ updatePSOrderStatus()                   → met à jour le statut PS
    └─ recordOrderMovements(rows, ref, 'entree')
            └─ Pour chaque ligne :
                    addStock(line, qty, note)
                        ├─ POST /stockapi.php (+delta)         → remet le stock
                        ├─ POST /api/stock_movements (sign=+1) → ligne backoffice PS
                        └─ POST /stockapi.php?action=add_movement → historique custom
```

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/services/stockService.ts` | Ajout de `removeStock` et `recordOrderMovements` |
| `src/components/CheckoutPage.tsx` | Suppression de `updateStockAfterOrder` (double décrément) |
| `src/services/customerService.ts` | Ajout des `POST /stock_movements` dans `createPSOrder` |
