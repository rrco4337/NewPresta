# Récap J04 — Modules non couverts par J01 et J02

Ce document documente les modules présents dans le code mais absents des recaps J01 et J02 : tableau de bord, analyse financière, gestion des stocks, et services transversaux.

---

## 1. Tableau de bord BackOffice (`/dashboard`)

### Vue d'ensemble
Page d'analytique commandes accessible dans le BackOffice. Elle affiche les KPIs globaux et un tableau quotidien, avec filtre par date et rafraîchissement automatique toutes les 60 secondes.

### Composants

| Fichier | Rôle |
|---|---|
| `src/components/dashboardPage.tsx` | Page principale : état filtre, agrégation globale, rendu conditionnel |
| `src/components/dashboard/StatsCards.tsx` | 4 KPIs : total commandes, CA, panier moyen, commandes annulées |
| `src/components/dashboard/OrdersTable.tsx` | Tableau par jour : date, nb commandes, CA |
| `src/components/dashboard/DashboardSkeleton.tsx` | Skeleton de chargement |
| `src/components/dashboard/SalesChart.tsx` | Graphique des ventes (non encore connecté à la page) |
| `src/components/dashboard/DateFilter.tsx` | Composant de filtre date (générique) |
| `src/components/dashboard/DatePickerFilter.tsx` | Filtre date avec picker |
| `src/components/dashboard/DatePickerInput.tsx` | Input date standalone |
| `src/components/dashboard/DateSelectFilter.tsx` | Filtre date via select |
| `src/components/Dashboard.css` | Styles de la page dashboard |

### Hook `useDashboardData`
`src/hooks/useDashboardData.ts`
- Reçoit `{ selectedDate }` et un intervalle d'auto-refresh (défaut 60 000 ms).
- Appelle `fetchOrders()` (toutes commandes), puis calcule :
  - stats **globales** : toutes dates, toutes commandes (y compris annulées comptées séparément)
  - stats **filtrées** : uniquement la date sélectionnée si `selectedDate` est défini
  - `dailyStats[]` : agrégation par jour (count toutes commandes, amount hors annulées)
- Expose `{ data, loading, error, refetch }`.

### Service `dashboardApi`
`src/services/dashboardApi.ts`
- Instance axios séparée, `responseType: 'text'` (XML).
- `CANCELED_STATE_ID = '6'` : constante partagée pour identifier les commandes annulées.
- `fetchOrders()` : GET `/orders?display=[id,reference,total_paid_tax_incl,date_add,current_state]`, parse XML → tableau `OrderFromApi[]`.

### Types
`src/types/dashboard.types.ts`
- `DashboardFilters` : `{ selectedDate: string | null }`
- `DailyOrderStat` : `{ date, orderCount, totalAmount }`
- `DashboardData` : `{ stats, dailyStats, allOrders }`

---

## 2. Analyse financière (`/analytics`)

### Vue d'ensemble
Page de statistiques commerciales : ventes HT, coût d'achat (COGS) et marge bénéficiaire, ventilés par catégorie de produit, avec filtres par période et par catégorie.

### Composants

| Fichier | Rôle |
|---|---|
| `src/pages/FinancialAnalytics.tsx` | Page principale : filtre période + catégorie, KPIs, graphique, tableau |
| `src/components/financial/GlobalCards.tsx` | KPIs globaux : CA HT, achats HT, bénéfice |
| `src/components/financial/CategoryTable.tsx` | Tableau par catégorie : ventes, achats, marge |
| `src/components/financial/CategoryChart.tsx` | Graphique barres par catégorie |
| `src/components/financial/CategorySelector.tsx` | Sélecteur de catégorie (filtre client-side) |
| `src/components/financial/PeriodFilter.tsx` | Filtre : jour / semaine / mois / année / tout / personnalisé |
| `src/components/financial/FinancialSkeleton.tsx` | Skeleton de chargement |
| `src/components/financial/Financial.css` | Styles de l'analyse financière |

### Hook `useFinancialData`
`src/hooks/useFinancialData.ts`
- Reçoit `FinancialFilters` : `{ period, dateFrom, dateTo, categoryId }`.
- Déclenche un re-fetch API quand `period`, `dateFrom` ou `dateTo` changent.
- Filtre par catégorie **côté client** (pas de re-fetch) et recalcule les totaux en conséquence.
- Expose `{ global, categories, allCategories, loading, error, refetch }`.

### Service `financialService`
`src/services/financialService.ts`
- États valides pour inclure une commande : **2 (payé) et 5 (livré)** — exclut paniers et annulées.
- `computeDateRange(filters)` : calcule `dateFrom`/`dateTo` selon la période sélectionnée.
- `fetchValidatedOrderIds()` : pagination sur `/orders`, ne retient que les IDs en état 2 ou 5.
- `fetchOrderDetailRows(orderId)` : récupère `/order_details`, extrait `productId`, `quantity`, `unitPriceHT`.
- Agrégation : pour chaque produit → ventes HT = `qty × prixHT`, COGS = `qty × wholesale_price`.
- Résultat groupé par `id_category_default` du produit, trié par ventes décroissantes.

### Types
`src/types/financial.types.ts`
- `FinancialFilters` : `{ period, dateFrom, dateTo, categoryId }`
- `FinancialGlobal` : `{ totalSales, totalPurchases, profit }`
- `CategoryStats` : `{ categoryId, categoryName, sales, purchases, profit }`

---

## 3. Gestion des stocks (BackOffice)

Trois écrans distincts, tous alimentés par `stockService`.

### 3.1 `StockUpdate` (`/stock`)
`src/components/StockUpdate.tsx`

Deux onglets :
- **Stocks** : liste de toutes les références (produits simples + déclinaisons), regroupées par produit.
  - Barre de recherche (nom, référence, EAN).
  - Filtre pills : Tous / Épuisé (qty = 0) / Bas (qty ≤ 5).
  - Par ligne : badge coloré (`ok` / `low` / `zero`), champ quantité à ajouter, champ motif, bouton `+ Ajouter`.
  - Soumission aussi via `Enter`.
- **Mouvements** : tableau historique (date, produit, déclinaison, avant/après, motif) avec bouton de vidage.

### 3.2 `StockCategory` (`/stock/categories`)
`src/components/StockCategory.tsx`

Tableau de stocks agrégés par catégorie :
- Colonnes : qté physique, qté réservée, qté disponible.
- Badges `Faible` (< 10) et `Rupture` (≤ 0) sur la colonne disponible.
- Ligne de total général en pied de tableau.

### 3.3 `StockEvolution` (`/stock/evolution`)
`src/components/StockEvolution.tsx`

Deux sections :
1. **Évolution par produit** : sélection via autocomplete (produit ou déclinaison), affiche l'évolution journalière (stock cumulé, mouvement du jour, note). Résumé : stock initial, stock final, variation totale, moyenne/jour.
2. **Historique global** : tous mouvements de tous produits, avec filtre texte, tri chronologique décroissant, badges Entrée/Sortie.

### Service `stockService`
`src/services/stockService.ts` — service central pour les trois écrans.

**Types exportés :**
- `StockLine` : ligne unitaire produit/déclinaison (`key`, `productId`, `combinationId`, `quantity`, `stockId`, `reference`, `ean13`, ...).
- `StockMovement` : mouvement horodaté (`quantityBefore`, `quantityAdded`, `quantityAfter`, `note`, ...).
- `CategoryStock` : agrégat par catégorie (`physicalQuantity`, `reservedQuantity`, `availableQuantity`).

**Deux instances axios :**
- `api` → REST PrestaShop standard (`/api`).
- `moduleApi` → module custom PrestaShop (`stockapi.php`) avec `X-Api-Key`.

**Méthodes principales :**
| Méthode | Description |
|---|---|
| `getAllStockLines()` | Charge produits + déclinaisons + stocks_availables + libellés options en parallèle, retourne `StockLine[]` |
| `addStock(line, qty, note)` | Envoie delta positif à `stockapi.php`, enregistre `stock_mvt` natif PS, poste le mouvement au module |
| `removeStock(line, qty, note)` | Même flux avec delta négatif, vérifie stock suffisant |
| `getMovements(productId, combinationId?)` | Mouvements natifs PS filtrés par stock_available du produit/déclinaison |
| `getAllMovements()` | Tous mouvements PS, résolution produit via `stock_availables` |
| `getStockByCategory()` | Agrégation par catégorie (produits + stock + commandes en cours) |
| `recordOrderMovements(rows, ref, direction)` | Enregistre les sorties/entrées liées à une commande |
| `addMouvementStock(...)` | POST `stock_movements` natif PS avec correction de date optionnelle |
| `clearMovements()` | Vide `localStorage` (clé `ps_stock_movements_v1`) |

**Stockage local des mouvements :** `localStorage` sous la clé `ps_stock_movements_v1`, max 1 000 entrées, ordre LIFO.

### Service `stockApi`
`src/services/stockApi.ts`
- Instance axios dédiée.
- Type `StockAvailable` : représente un enregistrement `stock_available` PrestaShop complet (`out_of_stock`, `depends_on_stock`, `id_shop`, ...).
- Utilisé comme couche bas niveau séparée de `stockService`.

---

## 4. Services transversaux

### `taxService`
`src/services/taxService.ts`
- Cache en mémoire (singleton) : `groupRate` (groupId → taux) et `rateGroup` (taux → groupId).
- `getTaxRateByGroup(groupId)` : retourne le taux décimal (ex. `0.2` pour 20 %) à partir d'un `id_tax_rules_group`.
- `resolveTaxRulesGroupIdByRate(rate)` : trouve le groupe correspondant à un taux.
- `ensureTaxRulesGroupIdByRate(rate)` : résout ou **crée automatiquement** taxe + groupe + règle si inexistants.
- Utilisé par `csvImportService` et `fichierImportService` lors des imports produits.

### `importAuditService`
`src/services/importAuditService.ts`
- Alimente la page `ImportAudit` (`/audit/import`).
- Fonctions `fetch*Sample(limit = 50)` pour chaque entité : produits, catégories, clients, adresses, fournisseurs, marques, déclinaisons, stock, taxes, groupes de taxe, règles de taxe.
- Chaque fonction : GET avec `display=[champs]` + `sort=[id_DESC]` + `limit=0,N`, retour tableau typé.

### `importValidationService`
`src/services/importValidationService.ts`
- Définit les specs de colonnes pour les trois fichiers d'import :
  - `FICHIER1_COLUMN_SPECS` : produits (nom, référence, prix TTC, taxe, catégorie, prix achat, date disponibilité).
  - `FICHIER2_COLUMN_SPECS` : déclinaisons/stock (référence, spécificité, stock initial, prix vente TTC).
  - `FICHIER3_COLUMN_SPECS` : clients/commandes (date, nom, email, pwd, adresse, achat, état).
- Chaque spec : `canonical` (nom interne), `aliases` (noms acceptés dans le CSV), `required`.
- Utilisé par `FichiersImport` pour valider les en-têtes avant import.

### `categoryService`
`src/services/categoryService.ts`
- Type `Category` : `{ id: number; name: string }`.
- Récupère les catégories PrestaShop via l'API REST (`/categories`), parse XML.
- Utilisé notamment par `financialService` et les composants de filtrage catégorie.

---

## 5. Infrastructure

### Design system
`src/styles/design-system.css`
- Tokens CSS globaux (variables `--` : couleurs, espacements, typographie, radii, shadows).
- Importé dans `index.css` pour être disponible partout.

### `formatCurrency`
`src/utils/formatCurrency.ts`
- Utilitaire de formatage monétaire (Intl.NumberFormat, locale fr-FR, devise EUR).
- Utilisé dans les composants financiers et dashboard pour afficher les montants.

### Routage BackOffice (mise à jour)
Routes ajoutées dans `src/App.tsx` depuis J01/J02 :

| Route | Composant | Titre |
|---|---|---|
| `/dashboard` | `DashboardPage` | Tableau de bord |
| `/analytics` | `FinancialAnalytics` | Analyse financière |
| `/stock` | `StockUpdate` | Stocks |
| `/stock/categories` | `StockByCategoryTable` | Stocks par catégorie |
| `/stock/evolution` | `StockEvolution` | Évolution du stock |

Toutes sont protégées par `ProtectedRoute` et wrappées dans `AppLayout`.

---

## Résumé opérationnel

Pour modifier ou déboguer les modules documentés ici :
- **Dashboard** → `dashboardPage.tsx` + `useDashboardData.ts` + `dashboardApi.ts`
- **Financier** → `FinancialAnalytics.tsx` + `useFinancialData.ts` + `financialService.ts`
- **Stocks** → `StockUpdate.tsx` / `StockCategory.tsx` / `StockEvolution.tsx` + `stockService.ts`
- **Taxes auto** → `taxService.ts`
- **Audit imports** → `importAuditService.ts` + `ImportAudit.tsx`
- **Validation colonnes CSV** → `importValidationService.ts`
