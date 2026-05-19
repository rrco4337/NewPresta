# Back-office PrestaShop — Documentation complète

## Vue d'ensemble

Application React (Vite + TypeScript) servant de back-office pour une boutique PrestaShop.  
Toutes les opérations passent par le **WebService REST PrestaShop** (XML) via un proxy Vite.

---

## Architecture

```
src/
├── components/
│   ├── Login.tsx / Login.css          — Page d'authentification
│   ├── AppLayout.tsx / AppLayout.css  — Layout avec sidebar
│   ├── ProductList.tsx / .css         — Liste et filtres produits
│   ├── ProductCreate.tsx / .css       — Création / édition produit
│   ├── ProductImport.tsx / .css       — Import CSV produits standard
│   ├── CatalogImport.tsx              — Import CSV catalogue (cat, clients…)
│   ├── FichiersImport.tsx / .css      — Import fichiers spécifiques (f1/f2/f3 + ZIP)
│   ├── OrderList.tsx / .css           — Gestion des commandes
│   └── DataReset.tsx / DataReset.css  — Réinitialisation globale des données
├── services/
│   ├── authService.ts                 — Authentification Basic Auth
│   ├── produitApi.ts                  — CRUD produits + filtres
│   ├── otherImportService.ts          — Import/clean catalogue (catégories, clients…)
│   ├── fichierImportService.ts        — Parsers fichier1/2/3 + upload images ZIP
│   └── orderService.ts                — Commandes PS (API) + commandes locales (localStorage)
└── contexts/
    └── AuthContext.tsx                — Contexte auth global
```

---

## Authentification (`Login.tsx`)

La page de connexion est pré-remplie avec les identifiants par défaut issus des variables d'environnement :

```env
VITE_DEFAULT_EMAIL=admin@prestashop.com
VITE_DEFAULT_PWD=monmotdepasse
```

Le mot de passe est ensuite encodé en MD5 côté client et envoyé à `POST /api/employees/login` (ou équivalent selon la config du WebService).

---

## Sidebar — Routes disponibles

| Label              | Route               | Description                              |
|--------------------|---------------------|------------------------------------------|
| Liste des produits | `/`                 | Tableau produits avec filtres            |
| Ajouter un produit | `/products/add`     | Formulaire de création                   |
| Import CSV         | `/products/import`  | Import CSV produits standard             |
| Import catalogue   | `/import`           | Import CSV catégories, clients, etc.     |
| Import fichiers    | `/import/fichiers`  | Import fichiers1/2/3 + images.zip        |
| Commandes          | `/orders`           | Liste et gestion des commandes           |
| Réinitialisation   | `/reset`            | Suppression de toutes les données        |

---

## Page : Import Fichiers (`FichiersImport.tsx`)

Import en 4 zones indépendantes, dans l'ordre recommandé :

### Fichier 1 — Produits

Format CSV : `reference, nom, categorie, prix_ttc, taux_tva`

- Trouve ou crée la catégorie (par nom)
- Calcule le prix HT : `prix_ht = prix_ttc / (1 + taux_tva)`
- Crée le produit via `POST /products`
- Cache interne `productRefCache` : référence → id PrestaShop

### Fichier 2 — Déclinaisons & Stock

Format CSV : `reference, specificité, karazany, stock_initial, prix_vente_ttc`

**Prérequis** : le fichier 1 doit être importé avant (les produits doivent exister).  
Le bouton est verrouillé tant que fichier 1 n'est pas terminé.

- Si `specificité` et `karazany` sont renseignés → crée une déclinaison (combination)  
  - Trouve ou crée le groupe d'attributs (`product_options`)  
  - Trouve ou crée la valeur d'attribut (`product_option_values`)  
  - Crée la combinaison avec impact prix = `variantHt - baseHt`  
  - Met à jour le stock de la combinaison via `stock_availables`
- Sinon → met à jour directement le stock du produit simple

### Fichier 3 — Clients & Commandes

Format CSV : `date, nom, email, pwd, adresse, achat, etat`

- Crée le client PrestaShop via `POST /customers`
- Parse le champ `achat` au format `[("ref";qty;"variant"),…]`
- Stocke les commandes en **localStorage** (`ps_local_orders`) avec statut mappé depuis `etat` :

| Valeur `etat`                | Statut local  |
|------------------------------|---------------|
| contient "accept" / "effectu"| `paid`        |
| contient "erreur" / "échec"  | `error`       |
| contient "annul"             | `cancelled`   |
| autre                        | `pending`     |

### Images ZIP

Archive ZIP avec des images nommées par référence produit (ex: `T_01.png`, `M_03.jpg`).

- Extraction en mémoire via **JSZip**
- Correspondance filename → référence → id PrestaShop
- Upload via `fetch()` avec `FormData` sur `/api/images/products/{id}`  
  (axios évité car il interfère avec le boundary multipart)

---

## Page : Commandes (`OrderList.tsx`)

Affiche deux types de commandes dans un tableau unifié :

| Colonne      | Source locale                  | Source PrestaShop              |
|--------------|-------------------------------|-------------------------------|
| N° commande  | `LOC-{id}`                    | `#{reference}`                |
| Client       | `customerName`                | Fetch `GET /customers/{id}`   |
| Montant TTC  | `totalTTC`                    | `total_paid_tax_incl`         |
| Date         | `date`                        | `date_add`                    |
| Source       | Badge "Local"                 | Badge "PrestaShop"            |
| Statut       | Badge coloré                  | Badge coloré                  |
| Modifier     | Dropdown 3 options            | Dropdown 3 options            |

### Statuts modifiables

| Label               | Local          | PrestaShop (id_order_state) |
|---------------------|----------------|-----------------------------|
| Paiement effectué   | `paid`         | `2`                         |
| Échec paiement      | `error`        | `8`                         |
| Annulé              | `cancelled`    | `6`                         |

Chaque changement déclenche une modale de confirmation.

**Commandes locales** : `updateLocalOrderStatus()` → mise à jour localStorage  
**Commandes PS** : `POST /order_histories` avec `{id_order, id_order_state, id_employee: 1}`

---

## Page : Réinitialisation (`DataReset.tsx`)

Suppression complète de toutes les données en 3 phases :

1. **idle** — Avertissement + liste des entités concernées + bouton "Réinitialiser"
2. **confirm** — Confirmation explicite requise
3. **running** — Barre de progression par étape + progression globale
4. **done** — Résumé (éléments supprimés, erreurs éventuelles)

### Ordre de suppression (respecte les dépendances FK)

1. Déclinaisons (`/combinations`)
2. Produits (`/products`)
3. Catégories (`/categories`, protège les ids 1 et 2)
4. Clients (`/customers`)
5. Adresses (`/addresses`)
6. Fournisseurs (`/suppliers`)
7. Marques (`/manufacturers`)
8. Commandes locales (`localStorage.removeItem('ps_local_orders')`)

La fonction `cleanEntities(endpoint, protectedIds, onProgress)` :
- `GET /endpoint?display=[id]` → liste tous les ids
- Filtre les ids protégés
- `DELETE /endpoint/{id}` pour chacun avec callback de progression

---

## Services techniques

### `orderService.ts`

```typescript
// Commandes PrestaShop
fetchPSOrders(): Promise<PSOrder[]>           // GET /orders?display=full + noms clients
updatePSOrderStatus(id, stateId): Promise<boolean>  // POST /order_histories

// Commandes locales (localStorage)
getLocalOrders(): LocalOrder[]
addLocalOrders(orders): void
updateLocalOrderStatus(id, status): void
clearLocalOrders(): void
```

### `fichierImportService.ts`

```typescript
importFichier1(file, onProgress?): Promise<FichierImportResult[]>
importFichier2(file, onProgress?): Promise<FichierImportResult[]>
importFichier3(file, onProgress?): Promise<FichierImportResult[]>
importImagesZip(file, onProgress?): Promise<ImageImportResult[]>
```

Callback de progression : `(done: number, total: number, label: string) => void`

### `otherImportService.ts`

```typescript
// Import
importCategories / importCustomers / importAddresses
importSuppliers / importBrands / importCombinations

// Nettoyage
cleanCategories / cleanCustomers / cleanAddresses
cleanSuppliers / cleanBrands / cleanCombinations / cleanProducts
// Chacun : (onProgress?: ProgressCallback) => Promise<CleanResult>
```

---

## Variables d'environnement

| Variable             | Description                          | Défaut                         |
|----------------------|--------------------------------------|--------------------------------|
| `VITE_API_BASE_URL`  | Base URL du WebService               | `http://127.0.0.1:8080/api`    |
| `VITE_DEFAULT_EMAIL` | Email pré-rempli sur Login           | `admin@prestashop.com`         |
| `VITE_DEFAULT_PWD`   | Mot de passe pré-rempli sur Login    | *(vide)*                       |

---

## Proxy Vite (authentification)

Le fichier `vite.config.ts` proxy `/api` vers le WebService PrestaShop et injecte l'en-tête `Authorization: Basic …` automatiquement. Ainsi :
- Axios n'a pas besoin de gérer l'auth
- `fetch()` bénéficie aussi de l'auth via le proxy (pour l'upload d'images)

---

## Filtres produits (`produitApi.ts`)

Syntaxe PrestaShop pour les filtres :

| Type           | Syntaxe URL                          | Exemple                              |
|----------------|--------------------------------------|--------------------------------------|
| Égalité exacte | `filter[champ]=[valeur]`             | `filter[active]=[1]`                 |
| Partiel (LIKE) | `filter[champ]=%[valeur]%`           | `filter[name]=%[shirt]%`             |
| Plage          | `filter[champ]=[min,max]`            | `filter[price]=[10,50]`              |
| IN             | `filter[champ]=[v1\|v2]`             | `filter[id]=[1\|2\|3]`               |

Les filtres texte (nom, référence) utilisent `%[valeur]%` pour une recherche partielle.

---

## Dépendances notables

| Package   | Usage                                      |
|-----------|--------------------------------------------|
| `jszip`   | Extraction du ZIP d'images en mémoire      |
| `axios`   | Requêtes XML vers le WebService            |
| `react-router-dom` | Navigation SPA                    |
