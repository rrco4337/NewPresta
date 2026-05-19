# Documentation Technique & Fonctionnelle Complète — **NewApp / NewPresta**

> Documentation pédagogique destinée à un développeur **débutant**.
> Chaque concept est expliqué simplement, puis détaillé techniquement.
> Le projet entier est passé en revue, module par module, page par page, fonction par fonction.

---

## Table des matières

1. [Présentation générale du projet](#1-présentation-générale-du-projet)
2. [Structure technique du projet](#2-structure-technique-du-projet)
3. [Documentation détaillée par module](#3-documentation-détaillée-par-module)
4. [Explication page par page](#4-explication-page-par-page)
5. [Explication fonction par fonction](#5-explication-fonction-par-fonction)
6. [Flux complets de l'application](#6-flux-complets-de-lapplication)
7. [Partie API (Endpoints PrestaShop)](#7-partie-api)
8. [Base de données (tables PrestaShop)](#8-base-de-données)
9. [Guide développeur débutant](#9-guide-développeur-débutant)
10. [Recommandations techniques](#10-recommandations-techniques)

---

# 1. Présentation générale du projet

## 1.1 Qu'est-ce que NewApp / NewPresta ?

**NewApp** (techniquement nommé `prestashop-app` dans `package.json`) est une **application web frontend** construite avec **React**, **TypeScript** et **Vite**, qui sert d'**interface moderne pour gérer une boutique PrestaShop**.

**PrestaShop** est un logiciel open-source de e-commerce écrit en PHP, qui propose une API REST native (appelée **WebService**) répondant en XML. NewApp consomme cette API pour offrir :

- une **interface administrateur (BackOffice)** : gérer les produits, le stock, les commandes, importer des données en CSV.
- une **boutique côté client (FrontOffice)** : afficher les produits, gérer un panier, passer commande.

> **En clair** : PrestaShop fournit la base de données et la logique e-commerce ; NewApp est une "couche visuelle moderne" qui dialogue avec lui via HTTP.

## 1.2 Rôle de l'application

L'application permet :

| Pour qui ? | Quoi faire ? |
|---|---|
| Administrateur (boutique) | Créer/éditer des produits, importer des CSV, gérer stocks et mouvements, traiter les commandes, voir les statistiques |
| Client final | Naviguer dans le catalogue, ajouter au panier, créer un compte, payer (à la livraison) et suivre ses commandes |
| Opérateur logistique | Visualiser les niveaux de stock, ajouter du stock, voir l'historique des mouvements |

## 1.3 Objectifs métier

- **Remplacer le BackOffice PrestaShop natif** (jugé lourd) par une interface plus rapide et lisible.
- **Offrir une boutique légère** (FrontOffice), distincte du thème PrestaShop classique.
- **Faciliter l'import massif** de données depuis Excel/CSV (catalogue, déclinaisons, clients, commandes).
- **Tracer précisément les mouvements de stock** (entrées manuelles, sorties suite commande, retours).
- **Visualiser les performances** via un tableau de bord (KPIs commandes/CA par jour).

## 1.4 Utilisateurs cibles

1. **Administrateur boutique** — connecté via login/mot de passe, accède aux pages `/products`, `/orders`, `/stock`, `/dashboard`, `/import`, etc.
2. **Client connecté** — utilisateur final ayant créé un compte, peut commander et voir son historique.
3. **Client anonyme** — peut consulter la boutique mais doit s'authentifier pour finaliser un achat.

## 1.5 Architecture globale

```
┌───────────────────────────────────────────────────────────────┐
│                    NAVIGATEUR (utilisateur)                    │
│  ┌────────────┐                          ┌────────────────┐    │
│  │ FrontOffice│                          │   BackOffice   │    │
│  │  /shop/*   │                          │   /products,   │    │
│  │            │                          │   /orders, ... │    │
│  └────────────┘                          └────────────────┘    │
│                  React Router + Contextes                       │
└─────────────────────────────┬─────────────────────────────────┘
                              │ HTTP (axios)
                              ▼
┌───────────────────────────────────────────────────────────────┐
│              VITE DEV SERVER (port 5173)                        │
│  Reverse-proxy: /api → http://localhost:8080 (PrestaShop)       │
│  Ajoute automatiquement l'Authorization Basic (clé WebService)  │
└─────────────────────────────┬─────────────────────────────────┘
                              ▼
┌───────────────────────────────────────────────────────────────┐
│                  PRESTASHOP (port 8080, PHP)                    │
│  • WebService XML (/api/products, /api/customers, ...)          │
│  • Module custom : stockapi.php (mises à jour stock atomiques)  │
│  • BackOffice PHP (cookies) pour l'auth admin                   │
│  • Base MySQL (ps_product, ps_stock_available, ...)             │
└───────────────────────────────────────────────────────────────┘
```

### Composants techniques

- **React 19.2** : librairie UI à base de composants.
- **TypeScript** : superset de JavaScript ajoutant du typage statique → moins de bugs.
- **Vite 8** : outil de développement (dev-server ultra rapide + build de production).
- **React Router 7** : gestion des routes/URL côté navigateur (SPA = Single Page Application).
- **Axios 1.16** : librairie pour faire des requêtes HTTP (plus pratique que `fetch`).
- **Recharts 3.8** : graphiques (utilisés dans le dashboard).
- **JSZip 3.10** : lire/écrire des archives ZIP (pour l'import d'images).

---

# 2. Structure technique du projet

## 2.1 Arborescence des dossiers

```
NewPresta/
├── .env                       ← Variables d'environnement (clés API, URLs)
├── index.html                 ← Point d'entrée HTML (chargé par Vite)
├── vite.config.ts             ← Configuration Vite (notamment proxy /api)
├── tsconfig.json              ← Configuration TypeScript
├── eslint.config.js           ← Règles de linting
├── package.json               ← Dépendances et scripts npm
│
├── public/                    ← Fichiers statiques servis tels quels
├── images/                    ← Images de produits/démos
├── docs/                      ← Documentation Markdown du projet
│
├── src/                       ← TOUT LE CODE SOURCE REACT
│   ├── main.tsx               ← Point d'entrée JS (monte React sur <div id="root">)
│   ├── App.tsx                ← Composant racine : déclare TOUTES les routes
│   ├── index.css              ← Styles globaux (reset, variables)
│   ├── App.css                ← Styles complémentaires
│   │
│   ├── components/            ← Composants React (pages + UI)
│   │   ├── AppLayout.tsx      ← Layout BackOffice (sidebar + topbar)
│   │   ├── ShopLayout.tsx     ← Layout FrontOffice (header + footer)
│   │   ├── ProtectedRoute.tsx ← Garde d'authentification
│   │   ├── Login.tsx          ← Page connexion admin
│   │   ├── UserSelectPage.tsx ← Page d'accueil (choix mode/utilisateur)
│   │   ├── ProductList.tsx    ← Liste des produits BO
│   │   ├── ProductCreate.tsx  ← Création/édition produit
│   │   ├── ProductImport.tsx  ← Import CSV produits
│   │   ├── CatalogImport.tsx  ← Import CSV catalogue (catégories, marques, …)
│   │   ├── FichiersImport.tsx ← Import 3 fichiers + ZIP images
│   │   ├── ImportAudit.tsx    ← Audit / inspection de la BDD
│   │   ├── OrderList.tsx      ← Liste commandes BO
│   │   ├── StockUpdate.tsx    ← Gestion du stock
│   │   ├── DataReset.tsx      ← Réinitialisation des données
│   │   ├── ShopHome.tsx       ← Vitrine boutique
│   │   ├── ProductDetail.tsx  ← Page produit boutique
│   │   ├── CartPage.tsx       ← Panier
│   │   ├── CheckoutPage.tsx   ← Tunnel d'achat
│   │   ├── CustomerAuthPage.tsx ← Login/inscription client
│   │   ├── OrderConfirmation.tsx ← Page de confirmation
│   │   ├── MyOrders.tsx       ← Historique client
│   │   ├── ProductBadge.tsx   ← Badge "HOT"/"NEW"
│   │   ├── dashboardPage.tsx  ← Tableau de bord
│   │   └── dashboard/         ← Sous-composants graphiques du dashboard
│   │       ├── DashboardSkeleton.tsx
│   │       ├── DatePickerInput.tsx
│   │       ├── OrdersTable.tsx
│   │       ├── SalesChart.tsx
│   │       └── StatsCards.tsx
│   │
│   ├── contexts/              ← États globaux React (Context API)
│   │   ├── AuthContext.tsx    ← Session admin
│   │   ├── CartContext.tsx    ← Panier client
│   │   └── CustomerContext.tsx ← Session client
│   │
│   ├── services/              ← Couches d'accès API (logique métier)
│   │   ├── PrestashopApi.tsx  ← Wrapper brut générique
│   │   ├── authService.ts     ← Auth admin
│   │   ├── produitApi.ts      ← CRUD produits + parsing XML
│   │   ├── stockApi.ts        ← Stock natif PS
│   │   ├── stockService.ts    ← Stock custom (mouvements, historique)
│   │   ├── taxService.ts      ← Taxes (résolution + création)
│   │   ├── shopService.ts     ← Vitrine (catalogue + prix TTC)
│   │   ├── cartSyncService.ts ← Sync panier ↔ PrestaShop
│   │   ├── customerService.ts ← Clients/adresses/commandes
│   │   ├── orderService.ts    ← Gestion commandes/transitions d'état
│   │   ├── dashboardApi.ts    ← Données dashboard
│   │   ├── csvImportService.ts       ← Import CSV produits seuls
│   │   ├── fichierImportService.ts   ← Import 3 fichiers + images
│   │   ├── otherImportService.ts     ← Import autres entités
│   │   └── importValidationService.ts ← Validation CSV
│   │
│   ├── hooks/                 ← Hooks React personnalisés
│   │   └── useDashboardData.ts
│   │
│   ├── utils/                 ← Utilitaires purs
│   │   ├── formatCurrency.ts  ← Formate prix en EUR (fr-FR)
│   │   └── productBadges.ts   ← Calcule badge HOT/NEW
│   │
│   ├── types/                 ← Types TypeScript partagés
│   │   └── dashboard.types.ts
│   │
│   ├── styles/                ← Styles globaux (design system)
│   │   └── design-system.css
│   │
│   └── assets/                ← Images/SVG embarqués dans le bundle
│
└── (fichiers CSV d'exemple, JSON Postman, docs MD, etc.)
```

## 2.2 Rôle de chaque dossier

| Dossier | Rôle |
|---|---|
| `src/components/` | **Tout ce qui s'affiche à l'écran**. Chaque page = un composant. |
| `src/contexts/` | **États globaux** partagés entre composants (utilisateur connecté, panier…). |
| `src/services/` | **Communication avec PrestaShop**. Aucun JSX ici, uniquement de la logique. |
| `src/hooks/` | **Logique réutilisable** au format hook React (`useXxx`). |
| `src/utils/` | **Fonctions pures** (sans état) : formatage, calculs. |
| `src/types/` | **Définitions TypeScript** partagées (interfaces, types). |
| `src/styles/` | **CSS global** (couleurs, espacements…). |
| `docs/` | **Documentation textuelle** historique des fonctionnalités. |
| `public/` | Assets statiques servis directement par Vite (favicon, etc.). |

## 2.3 Fichiers importants

### `index.html`
Point d'entrée HTML. Charge `src/main.tsx`. Une seule balise `<div id="root">` que React va remplir.

### `src/main.tsx`
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
```
Démarre React et monte le composant `App` dans la page.

### `src/App.tsx`
Définit **toutes les routes** (URLs) de l'application via `react-router-dom`. Enveloppe l'app dans les `Providers` de contextes (Auth, Customer, Cart).

### `.env`
Variables d'environnement utilisées **à la compilation** :
```
VITE_API_BASE_URL=/api               ← chemin du proxy
VITE_PRESTASHOP_API_KEY=…            ← clé WebService PrestaShop
VITE_PRESTASHOP_URL=http://localhost:8080
VITE_STOCKAPI_KEY=…                  ← clé du module stockapi custom
VITE_ADMIN_DIR=admin97512pee6coofvkvbtu ← dossier admin PS (préfixe URL BO)
```
> Note : toutes les variables commençant par `VITE_` sont exposées au code frontend par Vite.

### `vite.config.ts`
Configure le serveur de développement :
- Port `5173`
- **Proxy `/api` → `http://localhost:8080`** : permet d'éviter les soucis CORS et d'**injecter automatiquement l'en-tête `Authorization: Basic <base64(API_KEY:)>`** dans toutes les requêtes vers PrestaShop.
- Proxy également vers le dossier admin PrestaShop pour la session de connexion BO.

> **Pourquoi un proxy ?** Le navigateur ne peut pas, par sécurité, appeler directement `localhost:8080`. Le proxy "reroute" la requête côté serveur Vite, ce qui contourne CORS et masque la clé API au client.

## 2.4 Séparation FrontOffice / BackOffice

| Zone | URL | Layout | Authentification |
|---|---|---|---|
| **FrontOffice** (boutique publique) | `/shop`, `/shop/:id`, `/shop/cart`, `/shop/checkout`, `/shop/my-orders`, `/shop/confirmation/:id`, `/shop/auth` | `ShopLayout` (header+footer) | Optionnelle (obligatoire pour commander) — gérée par `CustomerContext` |
| **BackOffice** (admin) | `/products`, `/products/add`, `/products/:id`, `/products/import`, `/import`, `/import/fichiers`, `/orders`, `/stock`, `/stock/categories`, `/stock/evolution`, `/reset`, `/audit/import`, `/dashboard`, `/analytics` | `AppLayout` (sidebar+topbar) via `LayoutWrapper` | **Obligatoire** — gérée par `AuthContext` + `ProtectedRoute` |
| **Page d'accueil** | `/` | Aucun | Aucune |
| **Login admin** | `/login` | Aucun | Aucune |

## 2.5 Communication frontend ↔ backend

Schéma typique d'un appel :

```
[Composant React]
   │   ex: ProductList.tsx
   │   useEffect → productService.getAllProducts()
   ▼
[Service métier]   src/services/produitApi.ts
   │   GET /api/products?display=full&filter[active]=[1]
   │   (axios)
   ▼
[Proxy Vite]   vite.config.ts
   │   Ajoute Authorization: Basic <base64(apiKey:)>
   │   Redirige vers http://localhost:8080
   ▼
[PrestaShop WebService]   /api/products
   │   Lit MySQL, renvoie XML
   ▼
[Service métier]
   │   Parse XML → JSON → Product[]
   ▼
[Composant React]
   │   setProducts(...)
   ▼
[UI mise à jour]
```

**À retenir :**
- Le composant **n'appelle jamais axios directement**, il passe par un service.
- Le service **renvoie des objets JS typés**, jamais du XML brut.
- Les contextes (Auth/Cart/Customer) **partagent l'état** entre plusieurs composants sans le passer en `props`.

---

# 3. Documentation détaillée par module

Cette section décrit chaque **module fonctionnel** (groupe cohérent de fonctionnalités). Pour chacun : description, pages, composants, logique, endpoints, validations, sécurité, workflow.

## Module 3.1 — Authentification administrateur

### Description fonctionnelle
Permet à un administrateur PrestaShop de se connecter à NewApp avec son email + mot de passe. Une fois connecté, il a accès à toutes les pages du BackOffice. La session est sauvegardée dans le navigateur (localStorage) pour éviter de se reconnecter à chaque rafraîchissement.

### Pages concernées
- [`Login.tsx`](src/components/Login.tsx) — formulaire de connexion.
- [`ProtectedRoute.tsx`](src/components/ProtectedRoute.tsx) — composant **wrapper** : refuse l'accès aux pages BO si non connecté.

### Composants UI nécessaires
- Champ email
- Champ password
- Bouton "Se connecter" (avec spinner pendant le chargement)
- Zone d'affichage des erreurs

### Logique métier
1. L'utilisateur saisit email + mot de passe.
2. Le service `authService.login()` envoie un POST vers le contrôleur **PrestaShop natif** `AdminLogin` (en `application/x-www-form-urlencoded`, **avec cookies** via `withCredentials: true`).
3. PrestaShop renvoie une redirection (`303`/`302`) dont l'URL contient un **token CSRF**.
4. Le service extrait ce token, construit un `AuthUser { email, adminToken }` et le sauvegarde dans `localStorage` sous la clé `ps_admin_user`.
5. Le `AuthContext` notifie tous les composants abonnés que `user` est désormais défini.
6. Le `ProtectedRoute` autorise l'accès aux pages BO.

### Endpoints API utilisés
| Méthode | URL | But |
|---|---|---|
| `POST` | `/{ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1` | Connexion |
| `GET` | `/{ADMIN_DIR}/index.php?controller=AdminLogin&logout&token={adminToken}` | Déconnexion |

### Format des requêtes/réponses
**Requête login** (body urlencoded) :
```
ajax=1
controller=AdminLogin
submitLogin=1
passwd=motdepasse123
email=admin@example.com
```

**Réponse PrestaShop** : redirection HTTP avec `Location: …&token=ABCDEF123…`

### Validations
- Email non vide
- Password non vide
- Si la réponse n'inclut pas de token → erreur "Identifiants invalides"

### Gestion des erreurs
- Network error → affiche message générique
- Token absent → identifiants incorrects
- Stockage `localStorage` indisponible (mode privé) → fallback à la session courante

### Sécurité
- La clé WebService PrestaShop **n'est jamais exposée au navigateur** (ajoutée côté proxy).
- Le cookie de session PrestaShop est `httpOnly` (sécurisé).
- `withCredentials: true` permet à axios de transmettre/recevoir les cookies.

### Permissions
Aucune granularité : un utilisateur est soit admin soit visiteur.

### Workflow (diagramme)

```
[Utilisateur ouvre /login]
        │
        ▼
[Saisit email + mdp]
        │
        ▼
[Click "Se connecter"]
        │
        ▼
[authService.login(email, pwd)]
        │
        ▼  POST /admin.../AdminLogin
[PrestaShop vérifie + renvoie token]
        │
        ▼
[localStorage.setItem('ps_admin_user', {...})]
        │
        ▼
[AuthContext.user mis à jour]
        │
        ▼
[Redirection /products]
```

---

## Module 3.2 — Gestion des produits (BackOffice)

### Description fonctionnelle
CRUD complet (Create / Read / Update / Delete) des produits. Recherche multi-critères. Pagination simple. Édition par fiche détaillée. Suppression avec confirmation.

### Pages
- [`ProductList.tsx`](src/components/ProductList.tsx) — liste filtrable.
- [`ProductCreate.tsx`](src/components/ProductCreate.tsx) — formulaire de création/édition (même composant, distinction par `useParams().id`).

### Composants UI
- Cartes produits (image, nom, référence, prix, badge actif/inactif, boutons Éditer/Supprimer).
- Barre de filtres (ID min/max, nom, référence, catégorie, prix min/max, quantité min/max, état).
- Formulaire produit avec sections : Informations de base / Tarifs / Stock / SEO & Descriptions.

### Logique métier
- Tout passe par `produitApi.ts` qui mappe **XML PrestaShop ⇄ objets JS**.
- À la création, après le `POST /products`, le service récupère automatiquement l'ID du `stock_available` créé par PrestaShop puis fait un `PUT /stock_availables/{id}` si une quantité a été fournie.
- Les filtres sont **envoyés au serveur** (pas de filtrage côté client) via la syntaxe WebService PS :
  - `filter[name]=%[recherche]%` → LIKE partiel
  - `filter[price]=[10,50]` → plage
  - `filter[id_category_default]=[3]` → exact
- Le filtre par quantité fait une **double requête** : d'abord `/stock_availables?filter[quantity]=[…]` pour récupérer les `id_product`, puis `/products?filter[id]=[ids…]`.

### Endpoints API
| Méthode | URL | But |
|---|---|---|
| GET | `/api/products?display=full&filter[…]=…` | Liste filtrée |
| GET | `/api/products/{id}?display=full` | Détail |
| POST | `/api/products` (XML) | Création |
| PUT | `/api/products/{id}` (XML avec `<id>{id}</id>`) | Mise à jour |
| DELETE | `/api/products/{id}` | Suppression |
| GET | `/api/stock_availables?filter[id_product]=[id]` | Récupère ID stock |
| PUT | `/api/stock_availables/{stockId}` | Mise à jour quantité |

### Format des données
**Modèle `Product` (TypeScript)** :
```ts
interface Product {
  id?: number;
  name: string;
  reference: string;
  ean13?: string;
  price: number;             // HT
  wholesale_price?: number;  // prix d'achat
  active: boolean;
  quantity: number;          // stock principal
  short_description?: string;
  description?: string;
  id_category_default: number;
  id_tax_rules_group: number;
  date_availability_produit?: string;
  imageUrl?: string;
}
```

### Validations
- `name` obligatoire
- `price` ≥ 0
- `ean13` doit être 13 chiffres si fourni (sinon ignoré)
- `id_tax_rules_group` doit pointer un groupe de taxe existant

### Gestion des erreurs
- Échec création → message remonté depuis le XML PrestaShop (balise `<message>` ou `<error>`).
- Échec suppression → confirmation puis affichage de l'erreur.

### Sécurité
Toutes les routes sont **derrière `ProtectedRoute`** (admin connecté requis).

### Workflow utilisateur
```
[Liste /products]
   │  saisit filtres → submit
   ▼
[getAllProducts(filters)] → renvoie tableau
   │
   ▼
[Affiche cartes]
   │  click "Éditer" sur une carte
   ▼
[/products/{id}] → getProduct(id) → préremplit
   │  saisie modifications → submit
   ▼
[update(id, data)] → PUT XML → succès → retour liste
```

---

## Module 3.3 — Gestion des stocks et mouvements

### Description fonctionnelle
Le module Stock permet (a) de visualiser l'état des stocks par produit ou déclinaison, (b) d'**ajouter du stock manuellement**, (c) de consulter l'historique des **mouvements** (entrées/sorties), avec traçabilité (note explicative).

Spécificité technique : à cause de bugs PrestaShop 8 sur `StockAvailable::updateQuantity()` et de la restriction sur `PUT /stock_availables`, NewApp utilise un **module custom `stockapi.php`** (déposé à la racine PrestaShop) qui effectue un `UPDATE` SQL direct.

### Pages
- [`StockUpdate.tsx`](src/components/StockUpdate.tsx) — deux onglets : "Stocks" (lignes filtrables) et "Mouvements" (historique).

### Composants UI
- Onglets stocks / mouvements
- Filtres : barre de recherche, boutons "Tous", "Bas", "Épuisé"
- Lignes par produit/déclinaison (référence, EAN, stock actuel, input quantité, input note, bouton "Ajouter")
- Tableau d'historique : Date / Produit / Déclinaison / Avant / Mouvement / Après / Motif

### Logique métier
- `stockService.getAllStockLines()` charge en parallèle : produits, déclinaisons, stocks. Il produit **une ligne par produit simple** ou **une ligne par déclinaison** si le produit en a.
- `stockService.addStock(line, qty, note)` effectue **3 appels en parallèle/séquence** :
  1. `POST /stockapi.php?action=add_movement` (module custom, header `X-Api-Key`) → modifie atomiquement le stock.
  2. `POST /api/stock_movements` (API PS native, débloquée dans `WebserviceRequest.php`).
  3. Sauvegarde locale dans `localStorage` (clé `stock_movements_history`, plafonné à 1000 entrées).
- `recordOrderMovements(rows, orderRef, direction)` : appelé lors d'une transition de statut commande (panier→payée enregistre une **sortie**, annulé→payée serait incohérent, etc.).

### Endpoints API
| Méthode | URL | But |
|---|---|---|
| GET | `/api/stock_availables` | Lecture |
| POST | `/stockapi.php?action=add_movement` | Update atomique (custom) |
| POST | `/api/stock_movements` | Mouvement PS (raison 1=in, 2=out, 3=commande, 10=retour) |

### Format requête `stockapi.php`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<stock>
  <id_product>42</id_product>
  <id_product_attribute>17</id_product_attribute>
  <delta>5</delta>
  <sign>1</sign>
  <reason>1</reason>
  <note>Réception fournisseur</note>
</stock>
```

### Validations
- Quantité > 0 (les retraits passent par `removeStock` avec `sign=-1`).
- Note optionnelle mais recommandée.

### Gestion des erreurs
- `stockapi.php` indisponible → l'appel `stock_movements` natif est tenté quand même ; sinon l'opération est marquée échouée.
- 401 → mauvaise clé `VITE_STOCKAPI_KEY`.

### Sécurité
- Header `X-Api-Key` validé côté PHP.
- Page derrière `ProtectedRoute`.

### Workflow

```
[Page /stock — onglet Stocks]
   │  recherche / filtre
   ▼
[getAllStockLines()] charge produits + déclinaisons + stocks
   │
   ▼
[Affiche cartes par produit, sous-lignes par déclinaison]
   │  saisit qty + note → click "Ajouter"
   ▼
[addStock(line, qty, note)]
   ├─ POST stockapi.php (update SQL)
   ├─ POST /stock_movements (historique PS)
   └─ localStorage push
   │
   ▼
[Re-fetch lignes → affichage à jour]
```

---

## Module 3.4 — Gestion des commandes (BackOffice)

### Description fonctionnelle
Liste unifiée des **commandes** PS et des **paniers** PS encore non transformés (état 1). L'admin peut changer le statut, transformer un panier en commande, supprimer les paniers "zombies" (panier d'état 1 avec total = 0 €).

### Pages
- [`OrderList.tsx`](src/components/OrderList.tsx)

### Composants UI
- Toolbar (Actualiser, Supprimer paniers vides, compteur)
- Modale de confirmation de transition d'état
- Tableau (Référence / Client / Montant / Date / Statut badge / Select de changement)

### Logique métier
- `orderService.fetchPSOrders()` fait `GET /orders?display=full` + `GET /carts?display=full`, filtre les carts non transformés (compare aux `id_cart` des orders), fusionne, enrichit avec le nom client.
- **Transitions autorisées** (`isTransitionAllowed`) :
  - 1 (panier) → 2 (payée) ou 6 (annulée)
  - 2 → 6 (annulation)
  - 6 → 2 (réactivation)
  - **Aucune transition n'est autorisée vers l'état 1** (un cart ne peut pas redevenir cart).
- Quand on passe d'un panier vers une commande, l'app appelle `transformCartToOrder()` : crée la commande, applique le statut via `/order_histories`, enregistre les mouvements de stock (sortie) via `stockService.recordOrderMovements()`.

### Endpoints API
| Méthode | URL | But |
|---|---|---|
| GET | `/api/orders?display=full` | Liste commandes |
| GET | `/api/carts?display=full` | Liste paniers |
| POST | `/api/orders` (XML minimal) | Crée commande à partir d'un panier |
| POST | `/api/order_histories` (XML) | Applique un nouvel état |
| DELETE | `/api/carts/{id}` | Supprime un panier |

### Validations
- Pas de transition vers état 1 (sécurité métier).
- Confirmation modale obligatoire.

### Gestion des erreurs
- Échec création de commande → annule visuellement le changement.
- Échec mouvement stock → log console mais n'empêche pas le changement de statut.

### Workflow

```
[/orders] → fetchPSOrders() → fusionne orders + carts pending
   │
   │   admin choisit nouveau statut dans <select>
   ▼
[Vérif isTransitionAllowed()]
   │   OUI →
   ▼
[Modale "Confirmer ?"]
   │   click "Confirmer"
   ▼
SI cart→commande :
   POST /orders + POST /order_histories + recordOrderMovements()
SINON :
   POST /order_histories
   │
   ▼
[Refetch → liste à jour]
```

---

## Module 3.5 — Import CSV de produits

### Description fonctionnelle
Import de produits depuis un fichier CSV au format PrestaShop natif (délimiteur `;`, 66 colonnes). Validation ligne par ligne avec preview avant import effectif. Création automatique des catégories manquantes.

### Pages
- [`ProductImport.tsx`](src/components/ProductImport.tsx)

### Composants UI
- Zone drag & drop pour le fichier CSV
- Tableau de preview avec statut par ligne (OK / Alerte / Erreur)
- Barre de progression pendant l'import
- Rapport final (succès/erreurs avec détail)
- Zone "Danger" pour nettoyer tous les produits (suppression en masse)

### Logique métier
Le service `csvImportService.ts` :
1. **Parse** le CSV → tableau de `CsvRow` (lignes typées).
2. **Valide** chaque ligne (`validateRow`) → renvoie `[errors, warnings]`.
3. **Mappe** chaque ligne valide vers un objet `Product` (`mapRowToProduct`).
4. **Résout ou crée** la catégorie (`resolveOrCreateCategory`) avec cache mémoire.
5. **Appelle** `productService.create()` pour chaque produit, accumule les résultats.

### Colonnes CSV attendues (indices fixes)
| Index | Champ | Type |
|---|---|---|
| 0 | `id` | optionnel |
| 1 | `active` | 0/1 |
| 2 | `name` | obligatoire |
| 3 | `categories` | nom ou ID |
| 4 | `price` | nombre > 0 |
| 5 | `taxRulesId` | ID groupe taxe |
| 6 | `wholesalePrice` | prix achat |
| 12 | `reference` | unique |
| 22 | `weight` | gramme |
| 25 | `quantity` | stock |
| … | descriptions etc. |

### Validations
- `name` non vide
- `price` > 0
- `taxRulesId` numérique
- Pas de référence dupliquée
- Catégorie résolue (sinon créée)

### Endpoints API
- `GET /api/categories?filter[name]=%[nom]%` → résolution catégorie
- `POST /api/categories` → création si absente
- `POST /api/products` → création produit (via `produitApi.create`)
- `PUT /api/stock_availables/{id}` → quantité initiale

### Workflow

```
[Drop CSV] → parseCSV() → CsvRow[]
   │
   ▼
[validateAllRows()] → preview affichée
   │
   │   admin click "Importer"
   ▼
[importProducts(file, onProgress)]
   POUR chaque ligne valide :
      ├─ resolveOrCreateCategory(name)
      ├─ mapRowToProduct(row, catId)
      └─ productService.create(prod)
   │
   ▼
[Rapport final : N succès / M erreurs]
```

---

## Module 3.6 — Import par 3 fichiers (Catalogue + Déclinaisons + Clients/Commandes)

### Description fonctionnelle
Le mode d'import le plus puissant : permet d'importer en une opération **3 CSV** plus optionnellement un **ZIP d'images** :
- **Fichier 1** : produits de base (avec prix TTC, taxe, catégorie, prix d'achat)
- **Fichier 2** : déclinaisons + stock initial
- **Fichier 3** : clients + adresses + paniers/commandes (avec un format texte spécifique pour le panier)
- **ZIP images** : nom de fichier = référence produit → upload via l'API images PS

Avant l'import, une **prévalidation transactionnelle** est lancée : vérification des en-têtes, contenus, et **références croisées** (les déclinaisons F2 doivent référencer des produits présents en F1 ou déjà en BDD, etc.). Si quoi que ce soit échoue, **rien n'est importé**.

### Pages
- [`FichiersImport.tsx`](src/components/FichiersImport.tsx)

### Composants UI
- 4 zones de dépôt (F1, F2, F3, Images ZIP)
- Barres de progression par zone
- Tableaux de résultats par zone
- Bouton "Importer tous les fichiers" (déclenche prévalidation puis import séquentiel)
- Bouton "Réinitialiser"

### Logique métier (séquence)
1. `prevalidateFichiersImport(files, callbacks)` exécute 3 passes :
   - Vérification des en-têtes (colonnes obligatoires/présentes)
   - Validation contenu (types, valeurs positives, dates)
   - Vérification des références croisées
2. Si OK, lance l'import dans l'ordre :
   - **F1** : `importFichier1()` crée produits + catégories + taxes (auto-résolution).
   - **F2** : `importFichier2()` crée options/valeurs + combinaisons + stock.
   - **F3** : `importFichier3()` crée clients (ou réutilise existants) + adresses + paniers/commandes selon l'état.
   - **ZIP** : `importImagesZip()` unzip + POST chaque image vers `/api/images/products/{id}`.

### Détail du Fichier 3 (le plus complexe)

Colonnes : `date`, `nom`, `email`, `pwd`, `adresse`, `achat`, `etat`.

Le champ `achat` est au format spécifique :
```
[("T_01";3;"ngoza"),("T_02";1;"")]
```
→ parsé en `[{reference: "T_01", qty: 3, variant: "ngoza"}, {reference: "T_02", qty: 1, variant: ""}]`.

Mapping de l'état :
| `etat` CSV | État PS |
|---|---|
| "dans le panier" | 1 (cart) |
| "paiement accepté" | 2 (payée) |
| "annulé" | 6 (annulée) |

Pour les états 2/6, l'app appelle `createPSOrder()` puis `POST /order_histories` pour forcer l'état (parce que PrestaShop ignore `current_state` au POST).

### Endpoints API
- `POST /api/products`, `POST /api/categories`
- `POST /api/taxes`, `POST /api/tax_rule_groups`, `POST /api/tax_rules`
- `POST /api/product_options`, `POST /api/product_option_values`, `POST /api/combinations`
- `POST /api/customers`, `POST /api/addresses`
- `POST /api/carts`, `POST /api/orders`, `POST /api/order_histories`
- `POST /api/images/products/{id}` (multipart/form-data)

### Validations
- En-têtes obligatoires présents
- Prix > 0, taux taxe ≥ 0
- Dates dans formats supportés (DD/MM/YYYY, YYYY-MM-DD, ISO)
- Références F2 doivent exister en F1 ou en BDD
- Email F3 unique (sinon réutilisation)

### Caches utilisés
| Cache | But |
|---|---|
| `categoryCache` | nom → id catégorie |
| `productRefCache` | référence → id produit |
| `optionCache` | nom option → id |
| `optionValueCache` | (idOption, valeur) → id |
| `taxRateCache` | référence → taxRate |

### Workflow

```
[4 fichiers déposés]
   │
   ▼
[prevalidateFichiersImport()]
   │   ÉCHEC → message d'erreur, STOP
   │   SUCCÈS ↓
   ▼
[importFichier1()] → produits + catégories + taxes
   │
   ▼
[importFichier2()] → options + déclinaisons + stocks
   │
   ▼
[importFichier3()] → clients + adresses + paniers/commandes
   │
   ▼
[importImagesZip()] → unzip → upload chaque image
   │
   ▼
[Rapport global par zone]
```

---

## Module 3.7 — Import catalogue (autres entités)

### Description fonctionnelle
Import générique pour 6 types d'entités :
- Catégories
- Clients
- Adresses
- Fournisseurs
- Marques (manufacturers)
- Déclinaisons (combinations)

Chaque type a son propre CSV et son propre parseur.

### Pages
- [`CatalogImport.tsx`](src/components/CatalogImport.tsx)

### Composants UI
- Sélecteur d'onglets (un par type)
- Zone de dépôt
- Preview (5 premières lignes)
- Barre de progression + rapport
- Zone "Danger" pour nettoyer toutes les entités du type sélectionné

### Logique métier
- Chaque pipeline a sa fonction `import<Entity>()` dans `otherImportService.ts`.
- Pour les catégories : résolution du parent (`Home`→2, `Root`→1, ou ID numérique).
- Pour les adresses : résolution du pays (cache) et du client (email→id).
- Pour les combinaisons : résolution/création des options et valeurs avant la combinaison.
- Le nettoyage (`cleanEntities`) protège les IDs spéciaux (ex : catégories 1 et 2 = Root et Home).

### Endpoints API
- `POST /api/categories`, `POST /api/customers`, `POST /api/addresses`, `POST /api/suppliers`, `POST /api/manufacturers`, `POST /api/combinations`
- `GET` + `DELETE` pour le nettoyage

---

## Module 3.8 — Audit d'import

### Description fonctionnelle
Affiche un échantillon (10 dernières entrées) de chaque entité présente en BDD, pour vérifier le résultat d'un import : produits, catégories, clients, adresses, fournisseurs, marques, déclinaisons, stocks, taxes, groupes de taxe, règles de taxe.

### Pages
- [`ImportAudit.tsx`](src/components/ImportAudit.tsx)

### Logique
- 11 fetches **parallèles** via `Promise.allSettled` (résiste aux échecs individuels).
- Affichage tableau par section.

### Endpoints
Toutes les routes `GET /api/<entity>?display=…&sort=[id_DESC]&limit=10`.

---

## Module 3.9 — Réinitialisation des données

### Description fonctionnelle
Supprime **toutes** les entités importées dans un ordre précis (pour respecter les contraintes de clés étrangères en BDD MySQL).

### Pages
- [`DataReset.tsx`](src/components/DataReset.tsx)

### Ordre de suppression
1. Commandes (`orders`)
2. Déclinaisons (`combinations`)
3. Produits (`products`)
4. Catégories (`categories`) — protège IDs 1 (Root) et 2 (Home)
5. Clients (`customers`)
6. Adresses (`addresses`)
7. Fournisseurs (`suppliers`)
8. Marques (`manufacturers`)

### UI 4 phases
1. **idle** : panneau d'avertissement avec liste des entités.
2. **confirm** : modale "Êtes-vous absolument sûr ?".
3. **running** : barre globale + étape en cours + barre par étape.
4. **done** : rapport (succès/erreur par étape, nb supprimés).

### Sécurité
- Page derrière `ProtectedRoute`.
- Double confirmation.
- Categories 1 et 2 jamais supprimées (protègent l'arborescence racine PrestaShop).

---

## Module 3.10 — Vitrine (FrontOffice)

### Description fonctionnelle
Catalogue public consultable sans connexion. Filtres : recherche texte (debounce 300 ms), catégorie, prix min/max, badges HOT/NEW, tri. URL synchronisée (utile pour partager un lien filtré).

### Pages
- [`ShopHome.tsx`](src/components/ShopHome.tsx) — vitrine.
- [`ProductDetail.tsx`](src/components/ProductDetail.tsx) — fiche produit.

### Composants UI
- Hero avec statistiques (nb produits, catégories, nouveautés, tendances)
- Panneau filtres + chips actifs
- Grille de cartes produits avec image, badge HOT/NEW, stock, prix
- Skeletons pendant chargement
- Galerie d'images (main + thumbnails) sur la fiche produit
- Sélecteur de déclinaison
- Sélecteur de quantité + bouton "Ajouter au panier"

### Logique métier
- `shopService.fetchShopProducts({categoryId?})` charge produits + agrège stock + applique TVA (via `taxService.getTaxRateByGroup`).
- Tri / filtres prix/badges effectués **côté client** (rapide après le fetch).
- Badge HOT : `date_availability` < 24 h ; NEW : < 7 j (cf. `productBadges.ts`).
- Les déclinaisons d'un produit sont chargées en lazy via `fetchProductCombinations(productId)`.

### Endpoints API
- `GET /api/products?display=full&filter[active]=[1]&filter[id_category_default]=[…]`
- `GET /api/stock_availables?display=[id_product,id_product_attribute,quantity]`
- `GET /api/images/products/{id}`
- `GET /api/categories?display=[id,name]&filter[active]=[1]`
- `GET /api/combinations?filter[id_product]=[…]`
- `GET /api/product_option_values?filter[id]=[…]`

### Calculs prix
```
priceHt = product.price                                ← natif PS
taxRate = getTaxRateByGroup(id_tax_rules_group)        ← en décimal (ex: 0.20)
priceTtc = roundMoney(priceHt * (1 + taxRate))
```

---

## Module 3.11 — Panier client

### Description fonctionnelle
Panier persistant dans le `sessionStorage` du navigateur, synchronisé automatiquement avec PrestaShop (`POST /carts` ou `PUT /carts/{id}`) **500 ms** après chaque modification (debounce).

### Pages
- [`CartPage.tsx`](src/components/CartPage.tsx)

### Contexte React
- [`CartContext.tsx`](src/contexts/CartContext.tsx) → `useCart()` expose `items`, `addItem`, `removeItem`, `updateQty`, `clear`, totaux.

### Logique métier
- Clé d'unicité par item : `id::attributeId` (un produit avec deux déclinaisons = deux lignes distinctes).
- À la connexion du client : on récupère le panier déjà présent côté PS (via `fetchCustomerCart(customerId)`), on hydrate les `CartItem` complets (avec images, prix TTC) en appelant `fetchShopProductDetail` pour chaque item.

### Workflow

```
[click "Ajouter au panier" sur ProductDetail]
   │  addItem(item, qty)
   ▼
[CartContext.items mis à jour]
   │  setItem(sessionStorage)
   │  setTimeout(syncRemote, 500ms)  ← debounce
   ▼
[syncRemoteCart(params)]
   POST/PUT /carts
   │
   ▼
[OK silencieux, prochain refresh OK]
```

### Calculs
- `totalPriceHt = Σ priceHt × qty`
- `totalPrice = Σ priceTtc × qty`
- `totalTax = totalPrice − totalPriceHt`

---

## Module 3.12 — Authentification client + Inscription

### Description fonctionnelle
Connexion par **email seul** (le mot de passe n'est pas vérifié — limitation API PS WebService) ou inscription complète (prénom, nom, email, mot de passe).

### Pages
- [`CustomerAuthPage.tsx`](src/components/CustomerAuthPage.tsx) — 2 onglets login/register

### Contexte React
- [`CustomerContext.tsx`](src/contexts/CustomerContext.tsx) → `useCustomer()` expose `customer`, `setCustomer`, `logout`.

### Logique
- **Login** : `findCustomerByEmail(email)` → si trouvé, `setCustomer({ id, firstname, lastname, email, secure_key })` + redirection (paramètre `?next=…`).
- **Register** : valide pwd ≥ 5 caractères, vérifie unicité email, `registerCustomer(data)` → `POST /customers`, récupère automatiquement la `secure_key`.

### Stockage
`sessionStorage`, clé `current_customer` ; clé `customerSecureKey` séparée pour accès rapide.

---

## Module 3.13 — Tunnel d'achat (Checkout)

### Description fonctionnelle
3 étapes :
1. **Adresse** : sélection adresse existante ou création.
2. **Livraison** : choix du transporteur (1 = retrait gratuit, 2 = livraison 5,90 €).
3. **Confirmation** : récap + placement de la commande.

### Pages
- [`CheckoutPage.tsx`](src/components/CheckoutPage.tsx)
- [`OrderConfirmation.tsx`](src/components/OrderConfirmation.tsx)

### Logique
- À l'étape "Adresse" : `getCustomerAddresses(customerId)` → liste, possibilité d'en créer une nouvelle (`createAddress`).
- À l'étape "Confirmation" : `createPSOrder()` agglomère tout (panier + adresse + transporteur + items), POST `/orders` + POST `/order_histories` (force état 2) + POST `/stock_movements` par item.
- Mode de paiement : **COD (Cash On Delivery)** uniquement.

### Endpoints
- `GET /api/addresses?filter[id_customer]=[…]`
- `POST /api/addresses` (XML)
- `POST /api/carts` (XML)
- `POST /api/orders` (XML détaillé)
- `POST /api/order_histories`
- `POST /api/stock_movements` (raison 3 = commande)

### Workflow

```
[Étape 1 : Adresse]
   getCustomerAddresses() → choix
   OU formulaire création
   │
   ▼
[Étape 2 : Livraison]
   choix carrier 1 (gratuit) ou 2 (5,90 €)
   │
   ▼
[Étape 3 : Récap + Confirmer]
   createPSCart() puis createPSOrder()
   │
   ▼
[/shop/confirmation/{orderId}]
   affichage du numéro + nom client
   panier vidé
```

---

## Module 3.14 — Tableau de bord

### Description fonctionnelle
Affiche les KPIs principaux : nombre de commandes, chiffre d'affaires total, panier moyen, ventilation jour par jour.

### Pages
- [`dashboardPage.tsx`](src/components/dashboardPage.tsx)

### Composants
- `StatsCards` : 3 cartes KPI
- `OrdersTable` : tableau ventilation
- `DashboardSkeleton` : squelette pendant chargement
- `SalesChart` : courbe Recharts (montant + nb commandes)
- `DatePickerInput` : sélecteur de date

### Hook
- `useDashboardData(filters, 60000)` : fetch toutes les commandes + agrège + re-fetch toutes les 60 secondes.

### Endpoints
- `GET /api/orders?display=[id,reference,total_paid_tax_incl,date_add,current_state]`

### Calculs
- `totalOrders = orders.length`
- `totalRevenue = Σ total_paid_tax_incl`
- `averageOrderValue = totalRevenue / totalOrders`
- `dailyStats` : groupé par `date_add.split(' ')[0]`

---

# 4. Explication page par page

Pour chaque page : rôle, éléments affichés, actions utilisateur, API appelées, hooks/fonctions à créer, états React, structure.

## 4.1 `/` — UserSelectPage

| | |
|---|---|
| **Composant** | [`UserSelectPage.tsx`](src/components/UserSelectPage.tsx) |
| **Rôle** | Choix entre se connecter en tant que client existant ou continuer en anonyme |
| **Éléments affichés** | Grille avec un avatar par client + carte "Anonyme" + lien "Accès BackOffice" |
| **Actions** | Click client → fetch secureKey → `setCustomer` → `/shop` ; click anonyme → `setCustomer(null)` → `/shop` |
| **API appelées** | `fetchCustomerList()`, `fetchSecureKey(id)` |
| **États** | `users[]`, `loading`, `error`, `selectingId` |
| **Hooks** | `useNavigate`, `useCustomer`, `useState`, `useEffect`, `useMemo` |

## 4.2 `/login` — Login admin

| | |
|---|---|
| **Composant** | [`Login.tsx`](src/components/Login.tsx) |
| **Rôle** | Connexion administrateur |
| **Éléments** | Logo PS, formulaire email+password, bouton "Se connecter" |
| **Actions** | Submit → `useAuth().login()` → redirection `/products` ou page précédente (`location.state.from`) |
| **API** | `authService.login()` |
| **États** | `email`, `password`, `error`, `loading` |
| **Hooks** | `useAuth`, `useNavigate`, `useLocation`, `useState`, `useEffect` |

## 4.3 `/products` — ProductList

| | |
|---|---|
| **Composant** | [`ProductList.tsx`](src/components/ProductList.tsx) |
| **Rôle** | Lister/filtrer/supprimer produits |
| **Éléments** | Bandeau "Actualiser/Ajouter", form filtres, grille cartes produits, boutons Éditer/Supprimer |
| **Actions** | Filtrer → re-fetch ; click Éditer → `/products/{id}` ; click Supprimer → confirm → `deleteProduct` |
| **API** | `productService.getAllProducts(filters)`, `productService.deleteProduct(id)` |
| **États** | `products[]`, `loading`, `error`, `filters`, `appliedFilters` |
| **Composants enfants** | `ProductBadge` |

## 4.4 `/products/add` et `/products/:id` — ProductCreate

| | |
|---|---|
| **Composant** | [`ProductCreate.tsx`](src/components/ProductCreate.tsx) |
| **Rôle** | Création (sans `:id`) ou Édition (avec `:id`) |
| **Éléments** | Sections (Infos / Tarifs / Stock / SEO & Descriptions) |
| **Actions** | Submit → create ou update → redirection auto vers `/products` après 2 s |
| **API** | `productService.getProduct(id)` si édition, `create()` ou `update(id, data)` |
| **États** | `formData`, `loading`, `loadingProduct`, `status` |

## 4.5 `/products/import` — ProductImport

| | |
|---|---|
| **Composant** | [`ProductImport.tsx`](src/components/ProductImport.tsx) |
| **Rôle** | Import CSV produits PrestaShop |
| **Phases** | `idle` → `preview` → `importing` → `done` |
| **API** | `parseCSV`, `validateAllRows`, `importProducts`, `cleanProducts` |
| **États** | `step`, `file`, `allRows`, `validations`, `progress`, `results`, `dragOver`, `cleanStatus`, `cleanProgress`, `cleanResult` |

## 4.6 `/import` — CatalogImport

| | |
|---|---|
| **Composant** | [`CatalogImport.tsx`](src/components/CatalogImport.tsx) |
| **Rôle** | Import CSV pour 6 types (catégories, clients, adresses, fournisseurs, marques, déclinaisons) |
| **Actions** | Change type → upload → preview → import → rapport ; bouton nettoyage |
| **API** | Fonctions de `otherImportService.ts` |
| **États** | `importType`, `step`, `file`, `previewRows`, `progress`, `results`, `cleanStatus`, `cleanProgress`, `cleanResult` |

## 4.7 `/import/fichiers` — FichiersImport

| | |
|---|---|
| **Composant** | [`FichiersImport.tsx`](src/components/FichiersImport.tsx) |
| **Rôle** | Import 3 CSV + ZIP images en une opération |
| **Composants enfants** | `Dropzone`, `ProgressBar`, `ResultsTable` (inline) |
| **Logique** | Pré-validation → import séquentiel F1→F2→F3→Images |
| **API** | `prevalidateFichiersImport`, `importFichier1/2/3`, `importImagesZip` |
| **États** | `z1, z2, z3, zImg`, `formPhase`, `formError` |

## 4.8 `/orders` — OrderList

| | |
|---|---|
| **Composant** | [`OrderList.tsx`](src/components/OrderList.tsx) |
| **Rôle** | Liste commandes/paniers + transitions d'état |
| **Actions** | Changer statut (validation transition) → confirmation → exécution ; supprimer paniers zombies |
| **API** | `fetchPSOrders`, `updatePSOrderStatus`, `transformCartToOrder`, `fetchOrderRows`, `recordOrderMovements`, `deleteZombieCarts` |
| **États** | `orders`, `loading`, `error`, `pendingChange`, `applying`, `deletingZombies` |

## 4.9 `/stock` — StockUpdate

| | |
|---|---|
| **Composant** | [`StockUpdate.tsx`](src/components/StockUpdate.tsx) |
| **Rôle** | Gérer stocks + voir mouvements |
| **Onglets** | "Stocks" + "Mouvements" |
| **Actions** | Filtrer ; ajouter du stock (qty + note) ; vider historique |
| **API** | `getAllStockLines`, `getMovements`, `addStock`, `clearMovements` |
| **États** | `tab`, `lines`, `movements`, `search`, `stockFilter`, `qtyInputs`, `noteInputs`, `updating` |

## 4.10 `/audit/import` — ImportAudit

| | |
|---|---|
| **Composant** | [`ImportAudit.tsx`](src/components/ImportAudit.tsx) |
| **Rôle** | Échantillonner les 11 entités principales |
| **Actions** | Bouton "Actualiser" |
| **API** | 11 fonctions `fetch*Sample()` en `Promise.allSettled` |

## 4.11 `/reset` — DataReset

| | |
|---|---|
| **Composant** | [`DataReset.tsx`](src/components/DataReset.tsx) |
| **Rôle** | Tout supprimer |
| **Phases** | `idle` → `confirm` → `running` → `done` |
| **API** | `cleanOrders`, `cleanCombinations`, `cleanProducts`, `cleanCategories`, … |

## 4.12 `/dashboard` — DashboardPage

| | |
|---|---|
| **Composant** | [`dashboardPage.tsx`](src/components/dashboardPage.tsx) |
| **Rôle** | KPI globaux + détails par jour |
| **Hooks** | `useDashboardData(filters, 60000)` |
| **Composants enfants** | `StatsCards`, `OrdersTable`, `DashboardSkeleton` |

## 4.13 `/shop` — ShopHome

| | |
|---|---|
| **Composant** | [`ShopHome.tsx`](src/components/ShopHome.tsx) |
| **Rôle** | Vitrine produits |
| **Filtres** | search (debounce 300 ms), tri, catégorie, prix min/max, badge HOT/NEW, date réf |
| **API** | `fetchShopCategories`, `fetchShopProducts(categoryId?)` |
| **États** | `allProducts`, `categories`, `loading`, `error`, `added`, plus 8 états de filtre |
| **URL synchronisée** | via `useSearchParams` |

## 4.14 `/shop/:id` — ProductDetail

| | |
|---|---|
| **Composant** | [`ProductDetail.tsx`](src/components/ProductDetail.tsx) |
| **Rôle** | Fiche produit complète |
| **Éléments** | Galerie image + sélecteur déclinaison + sélecteur qty + bouton "Ajouter" |
| **API** | `fetchShopProductDetail(id)`, `stockService.getStockQuantity(id, attrId)` |
| **États** | `product`, `images`, `combinations`, `selectedCombo`, `qty`, `realStock`, etc. |

## 4.15 `/shop/cart` — CartPage

| | |
|---|---|
| **Composant** | [`CartPage.tsx`](src/components/CartPage.tsx) |
| **Rôle** | Voir/modifier panier |
| **Actions** | +/- quantité, supprimer item, "Commander" (→ auth ou checkout) |
| **API** | aucune (lecture seule du contexte) |

## 4.16 `/shop/auth` — CustomerAuthPage

| | |
|---|---|
| **Composant** | [`CustomerAuthPage.tsx`](src/components/CustomerAuthPage.tsx) |
| **Rôle** | Login / Inscription client |
| **Actions** | Submit login → `findCustomerByEmail` ; submit register → `registerCustomer` |
| **Redirection** | `?next=/shop/checkout` |

## 4.17 `/shop/checkout` — CheckoutPage

| | |
|---|---|
| **Composant** | [`CheckoutPage.tsx`](src/components/CheckoutPage.tsx) |
| **Rôle** | Tunnel d'achat 3 étapes |
| **API** | `getCustomerAddresses`, `createAddress`, `createPSCart`, `createPSOrder` |
| **États** | `step`, addresses+selection, carrierId, placing, placeError |

## 4.18 `/shop/confirmation/:id` — OrderConfirmation

| | |
|---|---|
| **Composant** | [`OrderConfirmation.tsx`](src/components/OrderConfirmation.tsx) |
| **Rôle** | Page de remerciement |
| **API** | `GET /api/orders/{id}` |

## 4.19 `/shop/my-orders` — MyOrders

| | |
|---|---|
| **Composant** | [`MyOrders.tsx`](src/components/MyOrders.tsx) |
| **Rôle** | Historique du client |
| **API** | `getCustomerOrders(customerId)` |
| **Redirection** | `/shop/auth` si non connecté |

---

# 5. Explication fonction par fonction

Les fonctions sont regroupées par fichier. Pour chacune : emplacement, signature, but, exemple.

## 5.1 `src/services/authService.ts`

### `login(credentials: LoginCredentials): Promise<AuthUser>`
- **Emplacement** : `src/services/authService.ts`
- **Paramètres** : `{ email: string, password: string }`
- **Retour** : `AuthUser { email, adminToken }` (persistance localStorage)
- **Rôle** : Connecte l'admin via le contrôleur `AdminLogin` PrestaShop.
- **Pourquoi** : Réutiliser l'auth PS native évite de gérer une couche d'auth maison.
- **Exemple** :
```ts
const user = await login({ email: 'admin@…', password: '…' });
```

### `logout(): Promise<void>`
- Déconnecte côté serveur + supprime `localStorage.ps_admin_user`.

### `getCurrentUser(): AuthUser | null`
- Lit `localStorage` pour récupérer l'utilisateur courant.

### `isAuthenticated(): boolean`
- Booléen pratique.

## 5.2 `src/services/produitApi.ts`

### `getAllProducts(filters?: ProductFilters): Promise<Product[]>`
- Charge la liste avec filtres facultatifs.
- Filtre `quantity` fait une sous-requête à `/stock_availables`.

### `getProduct(id: number): Promise<Product>`
- Charge le détail.

### `create(data: Partial<Product>): Promise<Product>`
- POST XML, puis ajuste stock_available.

### `update(id: number, data: Partial<Product>): Promise<Product>`
- PUT XML avec `<id>{id}</id>`.

### `deleteProduct(id: number): Promise<void>`
- DELETE.

### `updateStock(stockId, productId, quantity)`
- PUT `/stock_availables/{stockId}`.

## 5.3 `src/services/stockService.ts`

### `getAllStockLines(): Promise<StockLine[]>`
- Agrège produits + déclinaisons + stocks.

### `addStock(line: StockLine, qty: number, note?: string)`
- Triple appel : stockapi.php + /stock_movements + localStorage.

### `removeStock(line, qty, note)`
- Idem avec `sign=-1`.

### `recordOrderMovements(rows, orderRef, direction)`
- Boucle sur les items d'une commande et applique add/remove.

### `getMovements(productId?)` / `clearMovements()`
- Lecture/effacement de l'historique local.

## 5.4 `src/services/customerService.ts`

### `findCustomerByEmail(email)`
- Recherche par email, retourne `Customer | null`.

### `registerCustomer(data)`
- Crée un nouveau client.

### `getCustomerAddresses(customerId)`
- Liste les adresses non supprimées.

### `createAddress(data)`
- Crée une adresse (avec pays France hardcodé id=8).

### `createPSCart(customerId, addressId, carrierId, items, secureKey)`
- POST `/carts` brut.

### `createPSOrder(params)`
- Crée la commande, force l'état via `/order_histories`, enregistre les mouvements, met à jour `date_add` si fournie.

### `getCustomerOrders(customerId)`
- Historique.

### `updateStockAfterOrder(items)`
- Décrémente le stock des items commandés.

## 5.5 `src/services/orderService.ts`

### `fetchPSOrders()`
- Union commandes + paniers non transformés.

### `transformCartToOrder(order, newState)`
- Convertit un cart en order.

### `updatePSOrderStatus(orderId, stateId)`
- POST `/order_histories`.

### `deletePSCart(cartId)` / `deleteZombieCarts(orders)`
- Suppressions.

### `getOrdersStats(orders)`
- Statistiques agrégées par état.

### `fetchOrderRows(orderId)`
- Détail lignes d'une commande.

### `isTransitionAllowed(from, to)`
- Booléen métier.

## 5.6 `src/services/shopService.ts`

### `fetchShopProducts(opts?)`
- Liste enrichie pour la vitrine (HT+TTC+stock).

### `fetchShopProductDetail(id)`
- `{ product, images[], combinations[] }`.

### `fetchProductCombinations(productId)`
- Déclinaisons + libellés.

### `fetchShopCategories()`
- Catégories actives (sans Root/Home).

### `formatPrice(price)`
- Formate en EUR FR.

### `stockStatus(qty)`
- "Rupture" / "Plus que X" / "En stock".

## 5.7 `src/services/cartSyncService.ts`

### `fetchCustomerCart(customerId)`
- Charge le panier existant côté PS.

### `syncRemoteCart(params)`
- Crée ou met à jour le cart.

## 5.8 `src/services/taxService.ts`

### `getTaxRateByGroup(groupId)`
- Retourne le taux (ex: 0.20).

### `ensureTaxRulesGroupIdByRate(rate)`
- Résout ou crée le groupe pour ce taux.

## 5.9 `src/services/csvImportService.ts`

### `parseCSV(content)` / `validateAllRows(rows)` / `mapRowToProduct(row, catId)` / `resolveOrCreateCategory(name)` / `importProducts(file, onProgress)`
- Pipeline complet.

## 5.10 `src/services/fichierImportService.ts`

### `importFichier1(file)` / `importFichier2(file)` / `importFichier3(file)` / `importImagesZip(file)` / `prevalidateFichiersImport(files, callbacks)`
- 4 pipelines + prévalidation.

### `parseAchat(raw)`
- Parse `[("REF";qty;"variant"),…]`.

### `buildCheckoutItems(items)`
- Convertit en `CheckoutItem` complet.

### `parseDateFlexible(s)`
- Parse multiples formats.

## 5.11 `src/services/importValidationService.ts`

### `validateHeaders(received, specs)`
- Détecte colonnes inconnues (avec suggestion Levenshtein).

### `resolveColumnIndex(header, aliases)`
- Trouve l'index par alias.

### `validateDateField`, `validatePositiveAmount`
- Validations atomiques.

## 5.12 `src/services/otherImportService.ts`

### `importCategories`, `importCustomers`, `importAddresses`, `importSuppliers`, `importBrands`, `importCombinations`
- 6 pipelines.

### `cleanEntities(endpoint, protectedIds, onProgress)`
- Suppression en masse avec protection.

## 5.13 `src/services/importAuditService.ts`

### `fetchProductsSample(limit)`, etc.
- 11 fonctions de sondage.

## 5.14 `src/services/dashboardApi.ts`

### `fetchOrders(dateFrom?, dateTo?)`
- Charge commandes brutes.

## 5.15 `src/hooks/useDashboardData.ts`

### `useDashboardData(filters, autoRefreshIntervalMs)`
- Retourne `{ data, loading, error, refetch }`.

### `aggregateOrdersByDay(orders)`
- Helper interne (groupe par `date_add`).

## 5.16 `src/contexts/AuthContext.tsx`

### `AuthProvider` (composant)
- Lit localStorage au mount.

### `useAuth()`
- Retourne `{ user, isLoading, login, logout }`.

## 5.17 `src/contexts/CartContext.tsx`

### `CartProvider`
- Initialise depuis sessionStorage, hydrate au login client.

### `useCart()`
- Retourne `{ items, addItem, removeItem, updateQty, clear, totalPrice, totalPriceHt, totalTax, totalItems }`.

## 5.18 `src/contexts/CustomerContext.tsx`

### `CustomerProvider` / `useCustomer()`
- Persistance session, helper logout.

## 5.19 `src/utils/formatCurrency.ts`

### `formatCurrency(amount: number): string`
- `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)`.

## 5.20 `src/utils/productBadges.ts`

### `getProductBadge(dateAvailability, nowMs)`
- Retourne `'HOT' | 'NEW' | null`.

### `parseAvailabilityDate(value)`
- Parse flexible.

---

# 6. Flux complets de l'application

Pour chaque flux : action utilisateur → étapes côté front → appels API → mises à jour côté serveur → réponse → mise à jour UI.

## 6.1 Flux : Connexion administrateur

```
[1] User ouvre http://localhost:5173/login
[2] Saisit email + password
[3] Click "Se connecter"
[4] Login.tsx:onSubmit() → useAuth().login(email, pwd)
[5] AuthContext.login() → authService.login()
[6] axios POST /{ADMIN_DIR}/index.php?controller=AdminLogin (form-urlencoded)
       Vite proxy injecte cookies
       PrestaShop vérifie en base ps_employee
[7] Réponse : redirection contenant `&token=ABC123`
[8] authService extrait token, construit { email, adminToken }
[9] localStorage.setItem('ps_admin_user', JSON)
[10] AuthContext.setUser → re-render des consommateurs
[11] Login.tsx useEffect détecte user défini → navigate('/products')
[12] ProtectedRoute autorise → ProductList monté
```

## 6.2 Flux : Ajout d'un produit (BackOffice)

```
[1] User va sur /products → click "Ajouter un produit"
[2] Navigate /products/add (sans :id)
[3] ProductCreate.tsx mode "création" (loadingProduct=false, formData vide)
[4] User remplit : name, reference, price, quantity, id_tax_rules_group, etc.
[5] Submit → productService.create(formData)
[6] PrestashopMapper.buildXml(formData) → XML
[7] axios POST /api/products avec Content-Type: text/xml
       Vite proxy ajoute Authorization Basic
       PS WebService insère en ps_product + ps_product_lang
[8] PS répond avec XML <product><id>123</id>...
[9] Service récupère l'ID, fait GET /stock_availables?filter[id_product]=[123]
[10] Trouve stockId auto-créé, fait PUT /stock_availables/{stockId} avec quantity
[11] Status: { type: 'success', msg: '...' }
[12] setTimeout 2s → navigate('/products')
[13] ProductList re-fetch → produit apparaît dans la grille
```

## 6.3 Flux : Synchronisation du panier client

```
[1] User connecté click "+" sur un item du panier
[2] CartPage.tsx onClick → useCart().updateQty(id, newQty, attrId)
[3] CartContext modifie state.items
[4] useEffect détecte changement → sessionStorage.setItem('cart', JSON)
[5] scheduleSyncRef.current = setTimeout(syncRemote, 500)
[6] 500ms plus tard sans nouveau changement → syncRemote() s'exécute
[7] syncRemote() → cartSyncService.syncRemoteCart({...})
       - récupère addressId via getCustomerAddresses
       - récupère secureKey via fetchSecureKey
       - construit XML <cart><cart_rows>...</cart_rows></cart>
       - SI cart existe : PUT /carts/{cartId}, sinon POST /carts
[8] PS répond avec cart à jour
[9] CartContext.cartId mis à jour si nouvelle création
[10] UI déjà à jour (state était modifié dès l'étape 3 — sync asynchrone)
```

## 6.4 Flux : Import CSV produits (BackOffice)

```
[1] User va sur /products/import
[2] Drop CSV → onChange handler stocke File
[3] readFileText(file) → string content
[4] parseCSV(content) → CsvRow[]
[5] validateAllRows(rows) → RowValidation[] avec errors[] et warnings[]
[6] Affichage tableau preview
[7] User click "Lancer l'import"
[8] step = 'importing', progress = { done: 0, total: rows.length }
[9] FOR each valid row :
       a) resolveOrCreateCategory(name) → cache hit ou GET puis POST
       b) mapRowToProduct(row, catId)
       c) productService.create(product) → POST /products
       d) progress.done++
[10] step = 'done', results affichés
[11] User peut nettoyer (cleanProducts) ou re-importer un autre fichier
```

## 6.5 Flux : Import 3 fichiers + images (le plus complet)

```
[1] User va sur /import/fichiers
[2] Drop 4 fichiers (F1, F2, F3, ZIP)
[3] Click "Importer tous les fichiers"
[4] PRÉVALIDATION : prevalidateFichiersImport(files)
       a) Lit en-têtes des 3 CSV → validateHeaders()
       b) Parse contenu → validateRow() pour chaque ligne
       c) Vérifie références croisées (F2.ref ∈ F1.ref ∪ DB ; F3.products ∈ ...)
       d) Si une erreur → STOP, affiche message
[5] IMPORT F1 :
       Boucle ligne par ligne :
         - resolveOrCreateCategory()
         - ensureTaxRulesGroupIdByRate() → cherche ou crée taxe
         - POST /api/products (HT calculé depuis TTC : ht = ttc/(1+rate))
         - PUT /stock_availables si quantity > 0
       progress update via callback
[6] IMPORT F2 :
       Pour chaque ligne :
         - Cherche productRefCache[reference]
         - Crée ou réutilise productOption (specificité)
         - Crée ou réutilise productOptionValue (karazany)
         - POST /api/combinations avec association
         - POST /api/stock_availables (ou PUT du stock auto-créé)
         - Calcule impact prix
[7] IMPORT F3 :
       Pour chaque ligne :
         - parseAchat(raw) → items
         - findCustomerByEmail() ou registerCustomer()
         - createAddress() pour la ligne d'adresse
         - buildCheckoutItems(items) → calcule prix HT/TTC
         - createPSCart()
         - Si etat = "paiement accepté" → createPSOrder() + /order_histories
         - Si etat = "annulé" → idem + transition vers 6
[8] IMPORT ZIP :
       - JSZip unzip
       - Pour chaque image (filename = reference) :
            - Cherche productId par reference
            - POST /api/images/products/{id} (multipart)
[9] Affiche les rapports zone par zone
```

## 6.6 Flux : Recherche produit (FrontOffice)

```
[1] User tape "robe" dans la barre de recherche /shop
[2] onChange → setSearchInput('robe')
[3] useEffect avec debounce 300ms → setDebouncedSearch('robe')
[4] useEffect [debouncedSearch, ...filtres] → re-calcule filteredProducts
[5] (Aucune nouvelle requête API : recherche purement client-side sur le tableau allProducts)
[6] Grille re-rendue avec produits correspondants
[7] searchParams URL synchronisée → /shop?q=robe (partageable)
```

## 6.7 Flux : Passage de commande COD

```
[1] User clique "Commander" sur /shop/cart
       Si pas connecté → navigate('/shop/auth?next=/shop/checkout')
       Sinon → navigate('/shop/checkout')
[2] ÉTAPE 1 - Adresse :
       getCustomerAddresses(customer.id) → liste
       User choisit ou crée → createAddress() → POST /addresses
[3] ÉTAPE 2 - Livraison :
       Affiche 2 options carrier (1=retrait gratuit, 2=livraison 5.90€)
       User choisit → setCarrierId(2)
[4] ÉTAPE 3 - Récap → "Confirmer la commande"
[5] customerService.createPSOrder({ customer, address, carrier, items })
       a) POST /api/carts (XML) → cartId
       b) POST /api/orders (XML) → orderId
       c) POST /api/order_histories (id_order, id_order_state=2) → état Payée forcé
       d) FOR each item : POST /api/stock_movements (raison 3, sign=-1)
       e) Si dateAdd fournie : PUT /orders/{id} pour corriger date_add
[6] cart.clear() → vide localStorage + state
[7] navigate(`/shop/confirmation/${orderId}`)
[8] OrderConfirmation.tsx fetch /api/orders/{id} → affiche récap
```

## 6.8 Flux : Mise à jour stock (manuel)

```
[1] User va sur /stock
[2] getAllStockLines() :
       a) GET /products?display=full&filter[active]=[1]
       b) GET /combinations?display=full
       c) GET /stock_availables?display=full
       d) Agrège : 1 ligne / produit simple OU 1 ligne / déclinaison
[3] User saisit qty=10, note="Réception"
[4] Click "Ajouter" → stockService.addStock(line, 10, "Réception")
       a) POST /stockapi.php?action=add_movement
            XML : delta=10, sign=1, reason=1, note
       b) POST /api/stock_movements (raison 1 = entrée)
       c) localStorage.append('stock_movements_history')
[5] Re-fetch lignes → stock affiché à jour
[6] Onglet "Mouvements" → affiche la nouvelle entrée
```

---

# 7. Partie API

Documentation de chaque endpoint utilisé. Tous les endpoints sont préfixés par `/api` côté frontend (proxy Vite → `http://localhost:8080/api`).

## 7.1 Produits

### `GET /api/products`
- **Paramètres** :
  - `display=full` ou `display=[id,name,price,…]`
  - `filter[<field>]=<value>` (syntaxes : exact `[v]`, plage `[min,max]`, LIKE `%[v]%`)
  - `sort=[id_DESC]`, `limit=10`
- **Réponse XML** :
```xml
<prestashop>
  <products>
    <product>
      <id><![CDATA[1]]></id>
      <name>
        <language id="1"><![CDATA[Produit A]]></language>
      </name>
      <price><![CDATA[19.99]]></price>
      ...
    </product>
  </products>
</prestashop>
```
- **Cas d'utilisation** : Liste BackOffice/FrontOffice, recherche.

### `GET /api/products/{id}?display=full`
- Détail.

### `POST /api/products` (Content-Type: text/xml)
- **Body** : XML construit par `PrestashopMapper.buildXml(data)`.
- **Réponse** : nouvel objet avec `<id>` généré.
- **Erreurs** : balise `<errors><error><message>...</message></error></errors>`.

### `PUT /api/products/{id}` (XML)
- Le body doit contenir `<id>{id}</id>` (PS l'exige).

### `DELETE /api/products/{id}`

## 7.2 Stock

### `GET /api/stock_availables`
- `?filter[id_product]=[X]&filter[id_product_attribute]=[Y]`

### `PUT /api/stock_availables/{stockId}` (XML)
- Met à jour `quantity`.

### `POST /api/stock_movements` (XML)
- Body :
```xml
<stock_movement>
  <id_stock_available>123</id_stock_available>
  <id_order>456</id_order>     <!-- optionnel -->
  <physical_quantity>5</physical_quantity>
  <id_stock_mvt_reason>1</id_stock_mvt_reason>  <!-- 1=in, 2=out, 3=order, 10=return -->
  <sign>1</sign>               <!-- 1 ou -1 -->
  <date_add>2026-05-17 10:00:00</date_add>
</stock_movement>
```

### `POST /stockapi.php?action=add_movement` (XML, header X-Api-Key)
- **Module custom**, à déployer à la racine PS.
- Effectue un `UPDATE ps_stock_available SET quantity = quantity + delta WHERE ...` atomique.
- Body :
```xml
<stock>
  <id_product>42</id_product>
  <id_product_attribute>17</id_product_attribute>
  <delta>5</delta>
  <sign>1</sign>
  <reason>1</reason>
  <note>...</note>
</stock>
```

## 7.3 Catégories

### `GET /api/categories`
- `?filter[name]=%[xxx]%`, `?filter[active]=[1]`

### `POST /api/categories` (XML)
- Body avec name multi-langue, id_parent, etc.

### `DELETE /api/categories/{id}`
- **Protégés** : 1 (Root), 2 (Home).

## 7.4 Clients / Adresses

### `GET /api/customers?filter[email]=[…]`

### `POST /api/customers` (XML)
- firstname, lastname, email, passwd, id_default_group=3

### `GET /api/addresses?filter[id_customer]=[id]&filter[deleted]=[0]`

### `POST /api/addresses` (XML)
- firstname, lastname, address1, postcode, city, id_country=8 (France), id_customer

## 7.5 Panier / Commandes

### `POST /api/carts` (XML)
- id_customer, id_address_delivery, id_address_invoice, id_carrier, secure_key, cart_rows[]

### `GET /api/carts?display=full&filter[id_customer]=[id]&sort=[id_DESC]&limit=1`

### `PUT /api/carts/{id}` (XML)

### `POST /api/orders` (XML)
- id_address_delivery, id_address_invoice, id_cart, id_currency, id_lang, id_customer, id_carrier, payment, module, total_paid_tax_incl, ...
- Note : `current_state` est **ignoré** au POST (PS bug).

### `POST /api/order_histories` (XML)
- id_order, id_order_state (2=payée, 6=annulée, 8=échec)
- **Indispensable** après création pour forcer l'état.

### `GET /api/orders/{id}?display=full`

### `DELETE /api/carts/{id}`

## 7.6 Taxes

### `GET /api/tax_rule_groups`, `/api/tax_rules`, `/api/taxes`

### `POST /api/taxes` (XML)
- rate (décimales sur 3 chiffres), active=1, name multi-langue

### `POST /api/tax_rule_groups` (XML)

### `POST /api/tax_rules` (XML)
- id_tax_rules_group, id_country=8, id_state=0, zip_code_from=0, zip_code_to=0, behavior=0, id_tax

## 7.7 Déclinaisons / Options

### `POST /api/product_options` (XML)
- name multi-langue, group_type (radio/select), public_name multi-langue

### `POST /api/product_option_values` (XML)
- id_attribute_group, name multi-langue

### `POST /api/combinations` (XML)
- id_product, reference, ean13, price (impact), wholesale_price, weight, quantity, associations.product_option_values[]

## 7.8 Images

### `POST /api/images/products/{productId}` (multipart/form-data)
- Champ `image` = fichier binaire

### `GET /api/images/products/{productId}`
- Renvoie la liste des id_image associés.

## 7.9 Autres entités

### `POST /api/suppliers` (XML)
### `POST /api/manufacturers` (XML)

## 7.10 Authentification admin (hors `/api`)

### `POST /{ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1`
- Body urlencoded : `ajax=1`, `controller=AdminLogin`, `submitLogin=1`, `passwd=…`, `email=…`
- **Important** : utiliser `withCredentials: true` pour transmettre les cookies.

### `GET /{ADMIN_DIR}/index.php?controller=AdminLogin&logout&token={token}`

## 7.11 Gestion des erreurs API (général)

PrestaShop renvoie les erreurs WebService sous la forme :
```xml
<prestashop>
  <errors>
    <error>
      <code>67</code>
      <message><![CDATA[Property Product->name is not valid]]></message>
    </error>
  </errors>
</prestashop>
```
Le helper `extractXmlError(xmlString)` parse cela et retourne le `<message>`.

---

# 8. Base de données

NewApp n'écrit/lit **pas directement** la base : tout passe par PrestaShop. Voici néanmoins les tables PS clés impactées.

## 8.1 Tables principales

| Table | Rôle | Champs clés |
|---|---|---|
| `ps_product` | Catalogue (données non-langue) | `id_product`, `id_category_default`, `id_tax_rules_group`, `reference`, `price`, `wholesale_price`, `active`, `date_add`, `date_upd` |
| `ps_product_lang` | Textes multi-langues | `id_product`, `id_lang`, `name`, `description`, `description_short`, `link_rewrite` |
| `ps_product_attribute` | Déclinaisons | `id_product_attribute`, `id_product`, `reference`, `price` (impact), `wholesale_price` |
| `ps_attribute` / `ps_attribute_group` | Options et leurs valeurs | (group = "Taille", attribute = "M") |
| `ps_stock_available` | Stock par produit (et combinaison) | `id_stock_available`, `id_product`, `id_product_attribute`, `quantity`, `out_of_stock`, `depends_on_stock` |
| `ps_stock_movements_app` | Module custom (mouvements détaillés) | `id_product`, `id_product_attribute`, `delta`, `sign`, `reason`, `note`, `date_add` |
| `ps_stock_mvt` | Mouvements PS natifs | `id_stock_mvt`, `id_stock_available`, `id_order`, `physical_quantity`, `id_stock_mvt_reason`, `sign` |
| `ps_category` / `ps_category_lang` | Arborescence catégories | `id_category`, `id_parent`, `level_depth`, `nleft`, `nright`, `active` |
| `ps_customer` | Clients | `id_customer`, `firstname`, `lastname`, `email`, `passwd`, `secure_key`, `active` |
| `ps_address` | Adresses | `id_address`, `id_customer`, `id_country`, `address1`, `city`, `postcode`, `deleted` |
| `ps_cart` | Paniers | `id_cart`, `id_customer`, `id_address_delivery`, `id_carrier`, `secure_key` |
| `ps_cart_product` | Lignes de panier | `id_cart`, `id_product`, `id_product_attribute`, `quantity` |
| `ps_orders` | Commandes | `id_order`, `id_customer`, `id_cart`, `id_carrier`, `current_state`, `total_paid_tax_incl`, `total_paid_tax_excl`, `payment`, `module`, `date_add` |
| `ps_order_detail` | Lignes commande | `id_order`, `product_id`, `product_attribute_id`, `product_quantity`, `unit_price_tax_incl`, `unit_price_tax_excl` |
| `ps_order_history` | Historique d'états | `id_order_history`, `id_order`, `id_order_state`, `date_add` |
| `ps_order_state` | Référentiel d'états | 1=Cart, 2=Payée, 6=Annulée, 8=Échec, etc. |
| `ps_tax` / `ps_tax_rule` / `ps_tax_rules_group` | Taxes | rate, id_country, id_state |
| `ps_supplier` / `ps_manufacturer` | Fournisseurs et marques | nom, adresse… |
| `ps_image` | Images produit | `id_image`, `id_product`, `position`, `cover` |

## 8.2 Relations (clés étrangères)

```
ps_product ──> ps_category (id_category_default)
ps_product ──> ps_tax_rules_group (id_tax_rules_group)
ps_product_attribute ──> ps_product (id_product)
ps_stock_available ──> ps_product (id_product) + ps_product_attribute (id_product_attribute)
ps_cart ──> ps_customer + ps_address + ps_carrier
ps_cart_product ──> ps_cart + ps_product + ps_product_attribute
ps_orders ──> ps_cart + ps_customer + ps_carrier + ps_address (delivery & invoice)
ps_order_detail ──> ps_orders + ps_product
ps_order_history ──> ps_orders + ps_order_state
ps_address ──> ps_customer + ps_country
ps_tax_rule ──> ps_tax_rules_group + ps_tax + ps_country
```

## 8.3 Pourquoi cet ordre de suppression dans DataReset ?

L'ordre respecte les **clés étrangères** : on supprime d'abord les entités qui dépendent des autres, puis on remonte.

1. **Commandes** → libère les références vers paniers, clients, adresses.
2. **Déclinaisons** → libère les références vers produits.
3. **Produits** → libère les références vers catégories, taxes, marques, fournisseurs.
4. **Catégories** → libère hiérarchie (sauf Root id=1 et Home id=2 protégés).
5. **Clients** → libère adresses.
6. **Adresses** → libère pays.
7. **Fournisseurs** et **Marques** → indépendants.

## 8.4 Exemple de données

`ps_product` :
| id_product | reference | price (HT) | id_tax_rules_group | active |
|---|---|---|---|---|
| 1 | TSHIRT_001 | 16.66 | 1 | 1 |
| 2 | MUG_001 | 9.99 | 1 | 1 |

`ps_stock_available` :
| id | id_product | id_product_attribute | quantity |
|---|---|---|---|
| 1 | 1 | 0 | 0 (parce que combinaisons) |
| 2 | 1 | 5 | 12 |
| 3 | 1 | 6 | 8 |
| 4 | 2 | 0 | 50 |

---

# 9. Guide développeur débutant

## 9.1 Comprendre le projet quand on débute

Cette section démystifie tout : si vous n'avez jamais codé en React, lisez-la **avant** d'aller plus loin.

### Concepts clés

- **Composant** : un "morceau" d'interface, écrit comme une fonction qui retourne du HTML. Ex : `<ProductBadge />`.
- **Props** : les paramètres qu'on passe à un composant. Ex : `<ProductBadge dateAvailability="2026-01-01" />`.
- **État (state)** : variable locale à un composant qui, quand elle change, redéclenche l'affichage. Ex : `const [count, setCount] = useState(0)`.
- **Hook** : fonction qui commence par `use` et qui permet d'utiliser des fonctionnalités React (`useState`, `useEffect`, `useMemo`...).
- **Context** : "boîte" partagée par tous les composants enveloppés par un `Provider`. Permet d'éviter de passer des props sur 10 niveaux.
- **JSX/TSX** : syntaxe qui ressemble à du HTML mais à l'intérieur d'un fichier `.tsx`. Compilé par Vite en JS.
- **TypeScript** : ajoute du **typage** au JavaScript. `let x: number = 3` empêche d'assigner un texte à `x`.
- **API REST** : façon standard de communiquer avec un serveur via HTTP (`GET /products` pour lire, `POST /products` pour créer, etc.).
- **Service** : fichier qui regroupe les appels API liés à un domaine (produits, commandes, …).
- **Proxy** : intermédiaire qui transfère les requêtes. Ici, Vite renvoie `/api/*` vers PrestaShop tout en ajoutant l'authentification.

### Glossaire technique

| Terme | Explication simple |
|---|---|
| **SPA** | Single Page Application — l'app ne recharge jamais la page, c'est React qui change le contenu. |
| **Bundle** | Fichier JS final produit par Vite, qui contient tout le code de l'app. |
| **CORS** | Sécurité du navigateur qui empêche d'appeler une URL d'un autre domaine. Le proxy le contourne. |
| **CDATA** | Notation XML qui permet d'inclure du texte avec caractères spéciaux sans les échapper. |
| **WebService** | Nom donné par PrestaShop à son API REST XML. |
| **CSRF token** | Jeton de sécurité contre les attaques inter-sites. Extrait du retour login PS. |
| **Debounce** | Technique pour ne pas exécuter trop souvent une action (ex : recherche). |
| **Memoization** | Cache de résultat : ne recalcule pas si entrées identiques (`useMemo`). |
| **Lifting state up** | Remonter un état dans le composant parent quand plusieurs enfants le partagent. |
| **Lazy loading** | Charger un module seulement quand on en a besoin. |
| **Skeleton** | Placeholder gris animé pendant qu'on charge la donnée. |

## 9.2 Lancer le projet localement

1. **Installer Node.js** ≥ 20.
2. Cloner le repo, puis :
```bash
cd NewPresta
npm install
```
3. Configurer le fichier `.env` (voir `2.3`).
4. Démarrer PrestaShop (port 8080) avec sa base.
5. Lancer le dev-server :
```bash
npm run dev
```
6. Ouvrir http://localhost:5173

## 9.3 Comment ajouter une nouvelle fonctionnalité ?

**Exemple** : ajouter une page "Liste des fournisseurs" dans le BackOffice.

1. **Créer le service** `src/services/supplierService.ts` :
```ts
import axios from 'axios';
const API = '/api';
export async function getAllSuppliers() {
  const { data } = await axios.get(`${API}/suppliers?display=full`);
  // parser le XML, retourner Supplier[]
}
```

2. **Créer le composant** `src/components/SupplierList.tsx` :
```tsx
import { useEffect, useState } from 'react';
import { getAllSuppliers } from '../services/supplierService';

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => { getAllSuppliers().then(setSuppliers); }, []);
  return (
    <div>
      <h1>Fournisseurs</h1>
      <ul>{suppliers.map(s => <li key={s.id}>{s.name}</li>)}</ul>
    </div>
  );
}
```

3. **Ajouter la route** dans `src/App.tsx` :
```tsx
<Route path="/suppliers" element={
  <ProtectedRoute>
    <LayoutWrapper><SupplierList /></LayoutWrapper>
  </ProtectedRoute>
} />
```

4. **Ajouter l'entrée dans la sidebar** dans `AppLayout.tsx`.

5. **Tester** : aller sur http://localhost:5173/suppliers.

## 9.4 Comment debugger ?

- **Console** : `console.log()` dans le code, observer la console du navigateur (F12).
- **DevTools React** (extension) : voir l'arbre des composants et leurs props/states.
- **Onglet Network** (F12) : observer les requêtes API et leurs réponses.
- **Breakpoints** : poser un point d'arrêt dans Source du DevTools.
- **Erreurs TypeScript** : `npm run build` les affichera toutes.
- **Erreurs PS** : regarder le XML de réponse → balise `<errors>`.

## 9.5 Bonnes pratiques

- ✅ Toujours typer ses fonctions et variables.
- ✅ Une fonction = une responsabilité.
- ✅ Un service par domaine (produits, commandes, …).
- ✅ Ne jamais mettre des secrets (clés API) dans le code commité.
- ✅ Préférer `useMemo`/`useCallback` quand un calcul est coûteux ou si l'identité d'une fonction compte (dépendances d'`useEffect`).
- ✅ Centraliser les appels axios par service.
- ✅ Gérer les états `loading` et `error` dans chaque page qui fait du fetch.
- ✅ Réinitialiser les caches mémoires (taxe, catégorie…) quand on importe à nouveau.

## 9.6 Erreurs fréquentes à éviter

| Erreur | Conséquence | Solution |
|---|---|---|
| Oublier le `key` dans un `.map()` | Warning React + re-renders inutiles | Ajouter `key={item.id}` |
| Modifier un state directement (`items.push(x)`) | Pas de re-render | Toujours créer un nouvel objet : `setItems([...items, x])` |
| `useEffect` sans tableau de dépendances | Boucle infinie | Toujours fournir `[]` ou la liste exacte |
| Faire `await` dans `useEffect` directement | Erreur React | Wrapper dans une fonction async interne |
| Envoyer un `password` au lieu de `passwd` à PS | Erreur 500 | Bien orthographier `passwd` |
| Oublier `withCredentials: true` au login admin | Cookies non posés → toujours 401 | Ajouter l'option à axios |
| Ne pas réinitialiser les caches après reset | Crash sur réimport | Vider `categoryCache`, `taxRateCache` etc. |
| Filtrer côté client une grosse liste | Lenteur | Utiliser la syntaxe filter PS pour filtrer côté serveur |
| Croire que PUT `/stock_availables` marche | Échec silencieux PS 8 | Passer par `stockapi.php` |
| Oublier `POST /order_histories` après création d'une commande | État reste 1 (panier) | Toujours appeler après POST `/orders` |

---

# 10. Recommandations techniques

## 10.1 Améliorations possibles

### Code
- **Centraliser la base URL API** dans `src/services/_config.ts` au lieu de la dupliquer.
- **Extraire le parser XML** dans un utilitaire commun (`src/utils/xmlParser.ts`) : actuellement, beaucoup de services parsent XML eux-mêmes.
- **Créer un client axios partagé** avec interceptor d'erreur (`src/services/_client.ts`).
- **Renommer `passwd` → `password`** au niveau interface utilisateur (interne uniquement, garder `passwd` pour PS).
- **Sortir le mapping XML/JSON** (PrestashopMapper) du fichier produit, le rendre générique.

### Tests
- Ajouter **Vitest** + **React Testing Library** pour les composants critiques (Panier, Login).
- Ajouter des tests pour `csvImportService.parseCSV` et `productBadges.getProductBadge`.

### Typages
- Remplacer `any` par des types précis quand c'est possible.
- Définir les types **réponses XML PrestaShop** une bonne fois pour toutes.

### UX
- Ajouter un toast de feedback (succès/erreur) au lieu des bandeaux statiques.
- Pagination côté serveur pour la liste produits (actuellement tout est chargé).
- Skeletons partout (pas seulement dashboard).

## 10.2 Optimisations

- **Memoization** des composants lourds (`React.memo` pour `ProductCard`).
- **Lazy load** des pages BO via `React.lazy` + `Suspense` (réduit le bundle initial).
- **Code splitting** par route.
- **Compression des images** côté upload (réduction côté client avant POST).
- **Cache du panier remote** plus malin (éviter de rappeler `fetchShopProductDetail` pour chaque item).

## 10.3 Sécurité

- ⚠️ **Clés API** : la `VITE_PRESTASHOP_API_KEY` n'est utilisée que côté proxy Vite **en développement**. En production, il faut un vrai reverse-proxy (nginx) qui injecte l'auth — ne **jamais** mettre la clé dans le bundle JS.
- ⚠️ **Mot de passe client** : actuellement le login client ne vérifie pas le mot de passe (limite API PS WebService). En production : remplacer par un endpoint d'auth dédié.
- ⚠️ **`adminToken`** stocké en `localStorage` : exposé au XSS. Préférer un cookie `httpOnly`.
- ⚠️ **Validation côté client uniquement** : ne jamais s'en contenter — PrestaShop valide aussi côté serveur.
- ✅ Ajouter un système de rôles (admin / opérateur / lecture seule).
- ✅ Activer la sanitization HTML pour `description` (évite XSS sur la fiche produit qui affiche `dangerouslySetInnerHTML`).

## 10.4 Performance

- Le proxy Vite est lent en dev : en production, déployer un build statique (`npm run build`) servi par un CDN ou nginx.
- Polling 60 s du dashboard : passer en SSE / WebSocket si possible.
- Limiter les fetchs simultanés (10 produits → 10 fetch d'images parallèles) en queue de 4-5.

## 10.5 Maintenabilité

- Documenter chaque service avec un en-tête JSDoc indiquant : but, dépendances, endpoints utilisés.
- Linter strict (`eslint --max-warnings 0` en CI).
- Conventions de nommage : `xxxService` (logique), `XxxPage` (page), `useXxx` (hook).
- Folders par feature (alternative future) : `src/features/products/{components, services, hooks}`.

## 10.6 Organisation du code

Proposition d'évolution :
```
src/
├── features/
│   ├── auth/             ← Login, AuthContext, authService
│   ├── products/         ← ProductList, ProductCreate, produitApi
│   ├── stock/            ← StockUpdate, stockService
│   ├── orders/           ← OrderList, orderService
│   ├── customers/        ← MyOrders, customerService
│   ├── shop/             ← ShopHome, ProductDetail, CartContext
│   └── imports/          ← *Import.tsx, *ImportService.ts
├── shared/
│   ├── components/       ← Composants UI génériques (Button, Modal)
│   ├── api/              ← Client axios + parsers XML
│   ├── hooks/            ← useDebounce, useFetch
│   └── utils/            ← formatCurrency, productBadges
└── App.tsx
```

Cette organisation par "feature" est plus scalable que par "type" quand l'app grandit (plus de 50+ fichiers).

---

## Conclusion

NewApp est une **interface web moderne** pour PrestaShop, séparée en BackOffice (gestion) et FrontOffice (boutique), reliée à PS via son **WebService XML** et un **module stock custom**. L'architecture sépare clairement :

- **Composants** (UI) ↔ **Contextes** (état global) ↔ **Services** (API)
- **Pages** routées par React Router avec garde d'authentification
- **Imports massifs** orchestrés par des pipelines validés en amont
- **Stocks** tracés via un module PHP custom (contournement des bugs PS 8)

La documentation ci-dessus couvre l'ensemble du code source actuel. Pour aller plus loin :
- consulter les fichiers Markdown du dossier `docs/`
- inspecter les collections Postman (`postman_collection.json`)
- lire les commentaires inline dans les services critiques (`fichierImportService.ts`, `stockService.ts`)

**Bon développement !**
