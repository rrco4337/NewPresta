# prestashop-app - analyse du code

Ce document explique les fonctionnalités implémentées et le fonctionnement du code, en se basant sur l’état actuel du dépôt. Les valeurs sensibles (clés API, tokens) sont volontairement omises ou masquées.

## Structure du projet et rôles

| Chemin                              | Rôle                          | Notes                                                                                                                             |
| ----------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`                      | Point d’entrée React          | Monte l’application dans `#root` et active `StrictMode`.                                                                          |
| `src/App.tsx`                       | Routage et layout             | Déclare les routes, encapsule les pages protégées avec le garde d’authentification et le layout, puis définit le titre des pages. |
| `src/contexts/AuthContext.tsx`      | État d’authentification       | Stocke l’utilisateur admin courant, restaure la session depuis `localStorage`, expose `login/logout`.                             |
| `src/services/authService.ts`       | Authentification BO           | Connecte l’admin au back-office PrestaShop via `AdminLogin`, extrait le token CSRF et persiste la session.                        |
| `src/services/produitApi.ts`        | API Produit                   | Configuration Axios, génération XML, parseur XML->JSON, mapping vers `Product`, CRUD + mise à jour du stock.                      |
| `src/components/Login.tsx`          | Interface de connexion        | Formulaire email/mot de passe, gestion des erreurs, redirection après connexion.                                                  |
| `src/components/ProtectedRoute.tsx` | Protection des routes         | Bloque les routes privées tant que la session n’est pas connue, redirige vers `/login` si nécessaire.                             |
| `src/components/AppLayout.tsx`      | Interface globale             | Sidebar, topbar, avatar utilisateur, bouton logout, menu rétractable.                                                             |
| `src/components/ProductList.tsx`    | Liste des produits            | Charge les produits, filtres, tri, suppression.                                                                                   |
| `src/components/ProductCreate.tsx`  | Création/modification produit | Formulaire produit, chargement par id, création ou mise à jour.                                                                   |
| `vite.config.ts`                    | Proxy de développement        | Redirige `/api` vers PrestaShop et injecte le header Basic Auth, redirige aussi `/admin...` pour le BO.                           |
| `.env`                              | Configuration runtime         | Contient l’URL API, l’URL PrestaShop, le dossier admin et la clé API (masquée ici).                                               |
| `postman_collection.json`           | Collection API Catégories     | CRUD et recherche de catégories via Basic Auth (`wsKey`).                                                                         |
| `collection_postman.json`           | Collection module Produit     | CRUD et recherche pour les endpoints du module (payloads JSON).                                                                   |
| `2_Categories.json`                 | Exemple de données            | Exemple de données catégories utilisé pour les tests ou comme référence.                                                          |

---

# Routage et layout

`App.tsx` configure un `BrowserRouter` et définit :

* `/login` comme route publique.
* `/` (liste produits), `/products/add` et `/products/:id` comme routes protégées.

Les routes protégées sont encapsulées par `ProtectedRoute` puis par `AppLayout`. `LayoutWrapper` lit l’URL courante et transmet un titre de page au layout :

* `/` → "Produits"
* `/products/add` → "Ajouter un produit"
* `/products/:id` → "Modifier le produit"

`AppLayout` affiche la sidebar et la topbar. La majorité des modules de la sidebar sont désactivés (fonctionnalités futures) et affichent un badge "Soon", tandis que "Produits" est actif.

---

# Flux d’authentification (Back Office)

## AuthContext

`AuthContext.tsx` fournit :

* `user` : l’utilisateur admin courant, ou `null`.
* `isLoading` : `true` pendant la restauration de session.
* `login(email, password)` : appelle `authService.login`, puis met à jour `user`.
* `logout()` : appelle `authService.logout`, puis vide `user`.

Au montage du composant, il charge l’utilisateur depuis `localStorage`, puis passe `isLoading` à `false`.

## authService

`authService.ts` est la couche d’authentification BO (Back Office) :

* Utilise une instance Axios dédiée avec `withCredentials: true` afin que le cookie de session BO soit stocké par le navigateur.
* Endpoint de connexion :
  `/{ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1&action=login`
* Envoie un `URLSearchParams` contenant les champs attendus par le BO PrestaShop :

  * `email`
  * `passwd` (et non `password`)
  * `submitLogin`, `ajax`, `stay_logged_in`, `redirect`
* Si `hasErrors` vaut `true` dans la réponse, une `AuthError` typée avec le code `INVALID_CREDENTIALS` est levée.
* En cas de succès, le token CSRF admin est extrait du champ `redirect` grâce à une regex du type `token=...`.
* Les données `{ email, adminToken }` sont stockées dans `localStorage` sous `ps_admin_user`.

La déconnexion appelle :
`/{ADMIN_DIR}/index.php?controller=AdminLogin&logout&token={adminToken}`
et vide `localStorage` dans un bloc `finally`, ce qui garantit le nettoyage local même en cas d’échec réseau.

## Interface de connexion et garde de route

`Login.tsx` :

* Inputs contrôlés pour email/mot de passe.
* `handleSubmit` appelle `login` et affiche les erreurs issues de `AuthError`.
* Un `useEffect` redirige vers la route cible originale (sauvegardée par `ProtectedRoute`) si l’utilisateur est déjà connecté.

`ProtectedRoute.tsx` :

* Pendant `isLoading`, affiche un écran de chargement simple.
* Si `user` est absent, redirige vers `/login` et stocke la route d’origine.
* Si `user` existe, affiche la route enfant.

---

# Flux des données Produit (PrestaShop Webservice)

## Configuration Axios

`produitApi.ts` définit une instance Axios :

* `baseURL = VITE_API_BASE_URL` (généralement `/api`, proxyfié par Vite)
* `Content-Type: application/xml`
* `Accept: application/xml`

Cela correspond au Webservice PrestaShop qui retourne des payloads XML.

## Parsing XML vers JSON

`parseXMLToJSON(xmlString)` utilise `DOMParser` et une fonction récursive `parseNode` :

* Si un nœud n’a pas d’enfants, il retourne `textContent`.
* Si un nœud possède des enfants, il construit un objet avec les noms des nœuds enfants comme clés.
* Si un même nom de nœud apparaît plusieurs fois, la valeur est convertie en tableau.

Le résultat est un objet JavaScript classique où la structure XML est conservée et les nœuds répétés deviennent des tableaux.

## Mapping XML vers les modèles frontend

`PrestashopMapper` fournit :

### `getLangValue(field)`

* Gère les champs multilingues PrestaShop comme :
  `<name><language id="1"><![CDATA[...]]></language></name>`
* Supporte les formats objet unique ou tableau.
* Retourne `_cdata`, `_text` ou la chaîne brute disponible.

### `mapToFrontend(p)`

* Convertit l’objet brut dérivé du XML vers l’interface `Product`.
* Parse les champs numériques (`price`, `wholesale_price`, `id_category_default`, `id_tax_rules_group`).
* Convertit `active` en booléen via `p.active === '1'`.
* Initialise `quantity` à `0` (le stock est mis à jour séparément).

---

# Génération XML pour création/mise à jour

`buildXml(product)` génère le payload XML pour PrestaShop :

* Construit `link_rewrite` sous forme de slug :

  * en minuscules
  * suppression des accents
  * remplacement des caractères non alphanumériques par `-`
* Inclut `<ean13>` uniquement s’il correspond à `^\d{13}$`.
* Encapsule les champs traduisibles dans `<language id="1">` avec CDATA.

---

# Méthodes CRUD

`productService` expose :

### `getAllProducts()`

GET `/products?display=full`

* Parse XML → JSON
* Lit `prestashop.products.product`
* Normalise en tableau puis mappe chaque élément

### `getProduct(id)`

GET `/products/{id}?display=full`

* Lit `prestashop.product` ou `product`

### `create(data)`

POST `/products` avec XML

* Parse la réponse et mappe le produit créé
* Si `quantity > 0`, met à jour le stock via `updateStock`

### `update(id, data)`

PUT `/products/{id}` avec XML + `<id>`

* Parse la réponse et mappe le produit mis à jour
* Si `quantity > 0`, met à jour le stock

### `deleteProduct(id)`

DELETE `/products/{id}`

`updateStock(stockId, productId, quantity)` envoie un XML spécifique vers `/stock_availables/{stockId}`.

---

# Interface Produit

## ProductList

* Charge les produits au montage via `productService.getAllProducts()`.
* Filtres :

  * Recherche par nom ou référence
  * Prix min/max
  * Actif / inactif
  * Stock (`quantity`)
* Tri :

  * Par nom, prix ou référence
  * Ordre croissant ou décroissant
* Actions :

  * Rafraîchir
  * Ajouter un produit
  * Modifier un produit
  * Supprimer un produit (avec confirmation)

## ProductCreate

* Sert à la fois de formulaire de création et de modification.
* Si `id` existe dans l’URL, le produit est chargé et le formulaire pré-rempli.
* À la soumission :

  * Si modification : `productService.update(id, formData)`
  * Si création : `productService.create(formData)`
* Affiche un statut succès/erreur puis redirige après succès.

---

# Layout et navigation

`AppLayout` fournit :

* Une sidebar avec modules groupés.
* Seul "Produits" est actif ; les autres sont désactivés (placeholders futurs).
* Une topbar avec titre de page et avatar utilisateur.
* Un bouton logout qui appelle `logout()` puis redirige vers `/login`.

---

# Proxy Vite et configuration environnement

`vite.config.ts` :

* Proxy `VITE_API_BASE_URL` (par défaut `/api`) vers `VITE_PRESTASHOP_URL`.
* Ajoute `Authorization: Basic <apiKey:>` à chaque requête proxyfiée.
* Proxy `/{VITE_ADMIN_DIR}` vers la même URL PrestaShop pour les endpoints BO.
* Réécrit le domaine des cookies vers `localhost` pour le développement local.

`.env` fournit :

* `VITE_API_BASE_URL`
* `VITE_PRESTASHOP_URL`
* `VITE_PRESTASHOP_API_KEY` (masqué)
* `VITE_ADMIN_DIR`

---

# Collections Postman et fichiers de données

## `postman_collection.json` (CRUD Catégories)

* Basic Auth avec variable `wsKey`.
* Endpoints CRUD pour les catégories et requêtes filtrées.
* Exemples XML pour création/mise à jour.

## `collection_postman.json` (Module Produit)

* Endpoints CRUD exposés par un module PrestaShop personnalisé.
* Utilise des payloads JSON pour create/update/delete.
* Inclut des endpoints de recherche multicritères.

## `2_Categories.json`

* JSON statique contenant des données catégories, probablement utilisé comme exemple ou référence.

---

# Configuration TypeScript et lint

`tsconfig.json` référence :

* `tsconfig.app.json` pour le code applicatif dans `src/`
* `tsconfig.node.json` pour la configuration Vite

## `tsconfig.app.json`

* `target: es2023`, `module: esnext`, `moduleResolution: bundler`
* `noEmit: true`
* `jsx: react-jsx`
* Règles de lint :

  * `noUnusedLocals`
  * `noUnusedParameters`
  * `noFallthroughCasesInSwitch`

## `tsconfig.node.json`

* Configuration similaire pour le fichier Vite config.

## `eslint.config.js`

* ESLint recommended de base
* TypeScript recommended
* Règles React hooks
* Règles React refresh

---

# Scripts NPM

`package.json` scripts :

* `dev` : lance le serveur Vite en développement
* `build` : build TypeScript + build Vite
* `lint` : exécute ESLint
* `preview` : lance le serveur de prévisualisation Vite

---

# Analyse détaillée — Login (Back Office) et logique métier

Cette section détaille précisément comment le login admin est implémenté et comment la logique métier "Produits" est orchestrée entre l'UI, les services, et l'API PrestaShop.

## Login Back Office : flux complet

### 1) Routage et garde d'accès

Le point d'entrée est dans `src/App.tsx` :

1. Les routes privées (`/`, `/products/add`, `/products/:id`) sont enveloppées dans `ProtectedRoute`.
2. La route `/login` reste publique.
3. Le layout global (`AppLayout`) est appliqué uniquement après la garde.

`ProtectedRoute` (`src/components/ProtectedRoute.tsx`) :

1. Attend la restauration de session (`isLoading`) avant toute décision.
2. Si aucun utilisateur n'est chargé, redirige vers `/login` en mémorisant la route demandée dans `location.state`.
3. Si l'utilisateur existe, il rend la page demandée.

### 2) UI de connexion

`Login.tsx` (`src/components/Login.tsx`) :

1. Formulaire contrôlé (email / password) avec état `loading` et `error`.
2. `handleSubmit` appelle `login(email, password)` du contexte.
3. En cas d'erreur, affiche un message basé sur le type d'erreur métier (`AuthError`) ou un message générique.
4. Un `useEffect` redirige automatiquement vers la route originale (si stockée par `ProtectedRoute`) ou `/` si déjà connecté.

### 3) Contexte d'authentification

`AuthContext.tsx` (`src/contexts/AuthContext.tsx`) :

1. `user` stocke l'admin courant.
2. `isLoading` est `true` pendant la restauration depuis `localStorage`.
3. `login()` appelle le service, puis met à jour `user`.
4. `logout()` délègue au service, puis remet `user` à `null`.

### 4) Service d'authentification (logique métier)

`authService.ts` (`src/services/authService.ts`) :

**Objectif :** se connecter au Back Office PrestaShop via le contrôleur `AdminLogin`, récupérer le cookie de session et extraire le token CSRF.

**Points clés :**

1. **Axios BO dédié** : instance séparée de l'API REST (`withCredentials: true` pour le cookie).
2. **Endpoint login** :
   `/{ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1&action=login`
3. **Payload exact attendu par PrestaShop** :
   * `email`
   * `passwd` (obligatoire, pas `password`)
   * `submitLogin=1`, `ajax=1`, `stay_logged_in=1`, `redirect=AdminDashboard`
4. **Gestion d'erreur métier** :
   * Si `hasErrors=true`, on lève `AuthError('INVALID_CREDENTIALS')`.
   * Si erreur réseau ou inconnue, `AuthError('NETWORK_ERROR')`.
5. **Token CSRF admin** :
   * Extrait depuis `data.redirect` via regex `token=...`.
6. **Session persistée** :
   * Stockage `{ email, adminToken }` dans `localStorage` (`ps_admin_user`).

### 5) Déconnexion

1. Appel du endpoint BO :
   `/{ADMIN_DIR}/index.php?controller=AdminLogin&logout&token={adminToken}`
2. Nettoyage local toujours garanti (`finally`).

### 6) Résumé du flux (chronologie)

1. L'utilisateur tente d'accéder à une route privée.
2. `ProtectedRoute` redirige vers `/login` si nécessaire.
3. `Login.tsx` envoie `email + password`.
4. `AuthContext` délègue au `authService`.
5. `authService` :
   * crée la session BO
   * extrait le token
   * persiste l'utilisateur.
6. `AuthContext` met à jour `user` → redirection automatique vers la route demandée.

---

## Logique métier "Produits" (UI + Service + API)

La logique produit est répartie entre :

1. **UI** : `ProductList.tsx` et `ProductCreate.tsx`
2. **Service** : `produitApi.ts`
3. **Proxy Vite** : `vite.config.ts` (auth Basic côté Webservice)

### 1) Modèle métier côté front

`Product` (`src/services/produitApi.ts`) :

* Champs standards PrestaShop : `price`, `wholesale_price`, `active`, `id_category_default`, `id_tax_rules_group`, etc.
* Les champs textuels multilingues sont normalisés côté mapper.

### 2) Mapping XML → modèle frontend

`PrestashopMapper.getLangValue()` :

1. Gère les structures `language` (objet ou tableau).
2. Récupère `_cdata` / `_text` / valeur brute.

`PrestashopMapper.mapToFrontend()` :

1. Convertit `price`, `wholesale_price` en nombres.
2. Convertit `active` en booléen.
3. Force `quantity` à `0` (stock géré séparément).

### 3) Génération XML (création / mise à jour)

`PrestashopMapper.buildXml()` :

1. Crée `link_rewrite` (slug) à partir du nom :
   * minuscules
   * suppression des accents
   * non-alphanumériques → `-`
2. Ajoute `<ean13>` uniquement si 13 chiffres.
3. Injecte les champs traduits via `<language id="1">`.

### 4) CRUD côté service

`productService` (`src/services/produitApi.ts`) :

1. `getAllProducts()` :
   * GET `/products?display=full`
   * XML → JSON via `parseXMLToJSON`
   * mapping vers `Product[]`
2. `getProduct(id)` :
   * GET `/products/{id}?display=full`
3. `create(data)` :
   * POST `/products` avec XML
   * mappe la réponse
   * si `quantity > 0`, met à jour le stock (`updateStock`)
4. `update(id, data)` :
   * PUT `/products/{id}` (XML + balise `<id>`)
   * met à jour le stock si nécessaire
5. `deleteProduct(id)` :
   * DELETE `/products/{id}`

### 5) Mise à jour du stock

`updateStock(stockId, productId, quantity)` :

1. Construit un XML `stock_available`.
2. PUT `/stock_availables/{stockId}`.
3. Le stock est géré après création/mise à jour produit (PrestaShop dissocie stock et produit).

### 6) UI — ProductList (logique métier côté écran)

`ProductList.tsx` :

1. Charge tous les produits au montage (`getAllProducts`).
2. Filtre par :
   * nom / référence
   * prix min/max
   * statut actif/inactif
   * stock (en stock / rupture)
3. Trie par :
   * nom / prix / référence
   * ordre asc/desc
4. Supprime un produit avec confirmation et recharge la liste.

### 7) UI — ProductCreate (création et édition)

`ProductCreate.tsx` :

1. Si `id` existe :
   * charge le produit
   * pré-remplit le formulaire
2. `handleSubmit` :
   * mode édition → `productService.update`
   * mode création → `productService.create`
3. Affiche un message de succès/erreur puis redirige vers `/`.

---

## Auth côté Webservice (API REST) — Proxy Vite

`vite.config.ts` :

1. Toutes les requêtes `/api` sont proxyfiées vers `VITE_PRESTASHOP_URL`.
2. L'en-tête `Authorization: Basic <apiKey:>` est injecté à chaque requête.
3. Les endpoints BO (`/{VITE_ADMIN_DIR}`) sont aussi proxyfiés et acceptent les cookies de session.

---

## Synthèse "métier"

**Login BO** :

* Front → `Login.tsx`
* Contexte → `AuthContext`
* Service → `authService` (AdminLogin, token CSRF, cookie session)

**Produits** :

* UI → `ProductList` et `ProductCreate`
* Service → XML + mapping + stock
* API → Webservice PrestaShop via proxy Vite
