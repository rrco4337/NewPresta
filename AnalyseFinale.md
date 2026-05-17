 # prestashop-app - code analysis

 ## Project structure and roles

 | Path | Role | Notes |
 |---|---|---|
 | `src/` | Application source (React + TypeScript) | Contient composants, contextes, hooks, services et styles. Point d'entrée `main.tsx`. |
 | `public/` | Actifs statiques | Contenu servi en production (images, index.html pour certaines configurations). |
 | `src/components/` | Composants React UI | Pages et composants métier (produit, import, dashboard, auth, etc.). |
 | `src/contexts/` | Context providers | Gestion de l'authentification, du panier et du client. |
 | `src/services/` | Services applicatifs | Appels API, logique de communication avec PrestaShop, parsing XML/JSON. |
 | `src/hooks/` | Hooks personnalisés | Logique réutilisable (ex: `useDashboardData`). |
 | `src/styles/` | Styles globaux et CSS modules | Fichiers CSS importés par composants. |
 | `tsconfig.*` | Configuration TypeScript | Ciblage ES2023, JSX React, paramètres de build et lint. |
 | `vite.config.ts` | Configuration du serveur de développement | Proxy vers PrestaShop, injection d'en-têtes Basic Auth pour développement local. |
 | `.env` / variables Vite | Configuration d'environnement | `VITE_API_BASE_URL`, `VITE_PRESTASHOP_URL`, `VITE_PRESTASHOP_API_KEY`, `VITE_ADMIN_DIR`. |
 | `package.json` | Scripts et dépendances | Scripts `dev`, `build`, `lint`, `preview` et dépendances du projet. |

 ## Overview / Fonctionnement global

 L'application est une interface d'administration et d'outillage front-end qui communique avec une instance PrestaShop via deux mécanismes principaux :

 - Proxy Vite (`/api` et l'admin route) pour contourner les problèmes CORS et injecter l'authentification nécessaire en développement.
 - Appels HTTP REST/XML vers l'API Webservice de PrestaShop (retourne XML) et vers un module custom (JSON) selon les endpoints.

 L'application gère une authentification côté Back Office (BO) PrestaShop en utilisant les endpoints administrateur (login via `AdminLogin`) et stocke un token CSRF extrait de la réponse pour les actions nécessitant la session BO. Les données produits sont récupérées, mappées et transformées depuis des payloads XML, puis exposées aux composants React via des services et contextes.

 ## Routing and layout

 - `src/App.tsx` configure le routage avec `react-router` (`BrowserRouter`).
 - Routes publiques : `/login`.
 - Routes protégées : `/` (liste des produits), `/products/add`, `/products/:id`.
 - Les routes protégées sont encapsulées par `ProtectedRoute` qui vérifie la présence de l'utilisateur administrateur (via `AuthContext`).
 - `AppLayout` fournit la structure globale (sidebar, topbar, titre, avatar, bouton logout). `LayoutWrapper` calcule le titre de page selon l'URL.

 ## Authentication flow

 - `src/contexts/AuthContext.tsx` expose `user`, `isLoading`, `login(email,password)` et `logout()`.
 - `src/services/authService.ts` réalise la logique d'authentification BO : POST vers `/{ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1&action=login` en envoyant `email`, `passwd`, `submitLogin`, `ajax`, `stay_logged_in`, `redirect`.
 - Si la réponse contient `hasErrors: true`, `authService` lève une erreur typée `AuthError` avec le code `INVALID_CREDENTIALS`.
 - En cas de succès, `authService` extrait le `adminToken` (CSRF-like) depuis le paramètre `redirect` (`token=...`) et persiste `{ email, adminToken }` dans `localStorage` sous la clé `ps_admin_user`.
 - `logout()` appelle l'URL `/{ADMIN_DIR}/index.php?controller=AdminLogin&logout&token={adminToken}` puis efface le stockage local.
 - `ProtectedRoute` redirige vers `/login` en stockant la destination initiale pour un redirect post-login.

 ## API flow

 - Les appels vers PrestaShop Webservice utilisent une instance Axios configurée dans `src/services/produitApi.ts` :
   - `baseURL` = `VITE_API_BASE_URL` (typiquement `/api`, proxied).
   - En-têtes par défaut : `Content-Type: application/xml`, `Accept: application/xml`.
 - Les réponses XML sont parsées en JSON via un utilitaire `parseXMLToJSON` (DOMParser + parcours récursif). Les noeuds répétés sont transformés en tableaux.
 - Un `PrestashopMapper` convertit les objets dérivés du XML vers le modèle front-end `Product` en gérant :
   - les champs multilang (`<name><language id="1"><![CDATA[...]`) via `getLangValue`.
   - la conversion de types (`price`, `wholesale_price` en nombres, `active` en bool).
   - normalisation des tableaux et cas singuliers.
 - Opérations CRUD produits :
   - `getAllProducts()` : GET `/products?display=full` → parse XML → map to `Product[]`.
   - `getProduct(id)` : GET `/products/{id}?display=full` → parse → map.
   - `create(product)` : POST `/products` (XML body) → parse réponse → map. Si `quantity > 0` effectue `updateStock`.
   - `update(id,product)` : PUT `/products/{id}` (XML body, incluant `<id>`) → parse → map. Puis mise à jour de stock si nécessaire.
   - `deleteProduct(id)` : DELETE `/products/{id}`.
 - Stock : `updateStock(stockId, productId, quantity)` POST/PUT vers `/stock_availables/{stockId}` avec payload XML spécifique.

 ## Services

 Dossier : `src/services/`

 - `authService.ts` : logique d'authentification BO (login/logout, extraction token, stockage local).
 - `produitApi.ts` / `productService` : configuration Axios, parsing XML → JSON, mappage via `PrestashopMapper`, opérations CRUD produits et gestion de stock.
 - `csvImportService.ts`, `fichierImportService.ts`, `importAuditService.ts`, `importValidationService.ts` : services liés à l'import CSV et audit (présents et nommés dans l'arborescence) — ils gèrent lecture, validation, audit et appels vers endpoints d'import.
 - `customerService.ts`, `orderService.ts` : services pour la gestion client et commandes (interfaces vers l'API PrestaShop ou modules custom quand applicable).

 Interactions : Les composants UI appellent ces services pour effectuer des actions. Les services retournent des modèles front-end typés.

 ## Components

 Répertoire : `src/components/`

 Composants principaux (liste non-exhaustive) :
 - `Login.tsx` : formulaire contrôlé (email + password). Appelle `AuthContext.login()` et gère erreurs `AuthError`.
 - `ProtectedRoute.tsx` : wrapper route guard pour protéger les routes privées.
 - `AppLayout.tsx` : layout global, sidebar et topbar, gestion de la navigation et du logout.
 - `ProductList.tsx` : chargement via `productService.getAllProducts()`, filtres (nom, référence, prix, état actif), tris, actions (éditer, supprimer, rafraîchir).
 - `ProductCreate.tsx` : formulaire de création/édition ; charge la ressource si `id` présent et appelle `create` ou `update` selon le cas.
 - `ShopHome.tsx`, `ShopLayout.tsx`, `Order*`, `CustomerAuthPage.tsx` et autres : pages fonctionnelles pour commandes, panier, etc.

 Chaque composant importe les services nécessaires, affiche les données mappées par les `PrestashopMapper` et déclenche des actions (CRUD, import, audit).

 ## Contexts

 - `src/contexts/AuthContext.tsx` : principal provider d'authentification BO ; restaure la session depuis `localStorage` au montage.
 - `src/contexts/CartContext.tsx` : gestion du panier côté front (ajout, suppression, quantité) et synchronisation (via `cartSyncService`).
 - `src/contexts/CustomerContext.tsx` : informations sur le client courant (si applicables dans le backoffice / B2C flows).

 Les contexts exposent des hooks et valeurs (ex: `useAuth()`) pour être consommés par les composants enfants et guards.

 ## Hooks

 - `useDashboardData.ts` : hook pour agréger et fournir les données de tableau de bord (enseignes, métriques, appels API vers `dashboardApi.ts`).
 - D'autres hooks utilitaires peuvent exister pour la pagination, la gestion de formulaires ou la synchronisation des données côté client.

 ## State management

 - L'application utilise les Contexts React pour l'état global minimal (auth, panier, client).
 - L'état local est géré via `useState`, `useEffect` dans les composants pages (chargement, filtres, formulaires).
 - Il n'y a pas de store externe (Redux/MobX) visible dans l'arborescence fournie ; l'approche privilégie contexts + hooks + services.

 ## Data flow

 1. Composant monte (ex: `ProductList`) et appelle `productService.getAllProducts()`.
 2. `produitApi` effectue un GET vers `/products?display=full` via le proxy Vite.
 3. Réponse XML retournée par PrestaShop est parsée par `parseXMLToJSON` et normalisée.
 4. `PrestashopMapper.mapToFrontend()` transforme l'objet brut en `Product` front-end.
 5. `ProductList` reçoit le `Product[]`, affiche, filtre et peut déclencher actions (delete, update).
 6. Pour création ou mise à jour, la donnée front est transformée en XML via `buildXml(product)` et envoyée en POST/PUT.
 7. Après création, si `quantity > 0`, un appel additionnel met à jour l'entité `stock_available`.

 Le flux est synchrone d'un point de vue applicatif (appel → parse → map → UI) avec gestion d'etats `loading` / `error` côté composants.

 ## Configurations

 - `vite.config.ts` :
   - Définit des proxies pour `VITE_API_BASE_URL` → `VITE_PRESTASHOP_URL`.
   - Injecte l'en-tête `Authorization: Basic <apiKey:>` pour les proxys.
   - Rewrites cookie domain en `localhost` pour le développement local.
 - `tsconfig.app.json` et `tsconfig.node.json` : configuration TypeScript séparée (app vs node/vite).

 ## Environment variables

 Variables attendues (via `.env` et accessibles en runtime Vite) :
 - `VITE_API_BASE_URL` : base path proxifié (ex: `/api`).
 - `VITE_PRESTASHOP_URL` : URL cible PrestaShop.
 - `VITE_PRESTASHOP_API_KEY` : clé wsKey utilisée par le proxy pour Basic Auth.
 - `VITE_ADMIN_DIR` : nom du dossier admin PrestaShop (ex: `admin123xyz`).

 Ces valeurs sont utilisées par `vite.config.ts` et par la logique d'appel HTTP afin d'atteindre les endpoints PrestaShop en développement.

 ## Build system

 - Outil principal : Vite (configuration `vite.config.ts`).
 - TypeScript comme langage source.
 - Scripts `npm` définis dans `package.json` pour `dev`, `build`, `preview`, `lint`.

 ## TypeScript config

 - `tsconfig.app.json` :
   - `target: es2023`, `module: esnext`, `moduleResolution: bundler`.
   - `noEmit: true` (transpilation gérée par Vite lors du build).
   - `jsx: react-jsx`.
   - Flags stricts pour éviter variables non utilisées.
 - `tsconfig.node.json` : configuration pour `vite.config.ts` et tâches node.

 ## NPM scripts

 Extraits typiques (dans `package.json`) :

 - `dev` : démarre Vite en mode développement.
 - `build` : compile et bundle pour production.
 - `preview` : lance un serveur local pour tester la build.
 - `lint` : exécute ESLint selon `eslint.config.js`.

 ## Dépendances

 - React + React DOM (TypeScript + JSX): base UI.
 - Axios : requêtes HTTP.
 - Vite : dev server, build.
 - ESLint + plugins TypeScript/React : linting.
 - Divers utilitaires JS/TS présents dans `package.json` (non listés exhaustivement ici).

 Pour une liste exacte, consulter `package.json` (dépendances et devDependencies).

 ## Logic business (métier)

 - Gestion des produits PrestaShop : affichage, filtrage, création, édition, suppression et mise à jour des stocks.
 - Import CSV : services et composants dédiés pour importer des catalogues et journaux d'importation avec audits et validations.
 - Authentification BO : accès administrateur aux actions nécessitant session BO.
 - Dashboard / métriques : agrégation de données via `dashboardApi` pour affichage dans `dashboardPage`.

 Le cœur métier s'articule autour de la transformation entre la représentation XML de PrestaShop et le modèle front-end utilisé par les composants React.

 ## Fichiers importants — description et interactions

 - `src/main.tsx`
   - Rôle : point d'entrée React ; monte l'application dans `#root` et active `StrictMode`.
   - Interaction : importe `App.tsx` et styles globaux.

 - `src/App.tsx`
   - Rôle : déclaration des routes et du layout global.
   - Fonctionnement : construit `BrowserRouter`, définit `/login`, routes protégées, et encapsule les vues dans `ProtectedRoute` + `AppLayout`.
   - Interactions : utilise `AuthContext`, `ProtectedRoute`, et composants de pages.

 - `src/contexts/AuthContext.tsx`
   - Rôle : gestion de session administrateur.
   - Fonctionnement : restaure la session depuis `localStorage` (`ps_admin_user`), fournit `login`/`logout` en appelant `authService`.
   - Interactions : consommé par `ProtectedRoute`, `AppLayout`, `Login.tsx`.

 - `src/services/authService.ts`
   - Rôle : encapsule les appels HTTP vers les endpoints BO pour login/logout.
   - Fonctionnement : POST avec `URLSearchParams`, gère `hasErrors`/erreurs, extrait `token` depuis `redirect` et persiste en `localStorage`.
   - Interactions : appelé depuis `AuthContext` et potentiellement depuis des utilitaires de test/diagnostic.

 - `src/services/produitApi.ts` (et mapper)
   - Rôle : adapter la Webservice PrestaShop (XML) au front-end.
   - Fonctionnement : configure Axios, parse XML via `parseXMLToJSON`, normalise/règle multilangues via `PrestashopMapper`, expose méthodes CRUD produits et gestion de stock.
   - Interactions : utilisé par `ProductList`, `ProductCreate`, et autres composants qui modifient ou lisent les produits.

 - `src/components/Login.tsx`
   - Rôle : interface de login administrateur.
   - Fonctionnement : collecte email/password, appelle `AuthContext.login`, gère états `loading`/`error` et redirections.
   - Interactions : `AuthContext`, `authService` via le context.

 - `src/components/ProtectedRoute.tsx`
   - Rôle : protéger l'accès aux routes privées.
   - Fonctionnement : attend `isLoading`, si `user` absent redirige vers `/login` et sauvegarde la destination.
   - Interactions : utilise `AuthContext`.

 - `src/components/AppLayout.tsx`
   - Rôle : barre latérale, topbar, affichage contexte utilisateur.
   - Fonctionnement : rend des menus (certains désactivés), affiche titre fourni par `LayoutWrapper`, propose logout.
   - Interactions : `AuthContext.logout()` pour terminer la session.

 - `vite.config.ts`
   - Rôle : config de proxy et en-têtes Basic Auth pour le développement.
   - Fonctionnement : proxifie `VITE_API_BASE_URL` vers `VITE_PRESTASHOP_URL`, injecte `Authorization` et réécrit cookie domain.
   - Interactions : facilite les appels Axios côté client sans CORS et avec credentials.

 - `postman_collection.json` / `collection_postman.json`
   - Rôle : collections utilitaires pour tester les endpoints categories et produits/modules.
   - Fonctionnement : fournissent des exemples de payloads XML/JSON et d'authentification Basic.

 ## Observations techniques (factuelles)

 - L'application traduit de façon robuste les payloads XML PrestaShop en modèles JS/TS via un mapper et un parseur XML explicite.
 - Le proxy Vite est utilisé pour injecter l'authentification Basic et résoudre les limitations CORS en développement.
 - L'approche de persistance de session (`localStorage` + token extrait) est utilisée pour conserver l'état admin entre rechargements.

 ## Annexes

 - Pour explorer le mapping XML → Product, consulter `src/services/produitApi.ts` et le mapper qui contient `getLangValue`, `mapToFrontend`, `buildXml`.
 - Pour la configuration du dev server et du proxy : `vite.config.ts`.
 - Pour la logique d'authentification BO : `src/services/authService.ts` et `src/contexts/AuthContext.tsx`.

 ---
 
 Document généré automatiquement : analyse descriptive du code source et de l'architecture logicielle.
