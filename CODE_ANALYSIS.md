# Analyse du code du projet NewPresta

## 1. Présentation générale
- Projet React + TypeScript construit avec Vite.
- Application de gestion e-commerce centrée sur PrestaShop.
- Interface composée d'un backoffice protégé et d'un frontoffice public.
- Utilise React Router v7 pour naviguer entre les pages.

## 2. Stack technique
- React 19
- TypeScript 6
- Vite 8
- Axios pour les appels HTTP
- ESLint pour la qualité du code
- React Router DOM 7

## 3. Structure du projet
- `src/main.tsx` : point d'entrée principal, insertion du composant `App`.
- `src/App.tsx` : définition des routes et des layouts.
- `src/contexts/` : providers pour l'authentification, le panier et le client.
- `src/components/` : pages et composants visuels de l'application.
- `src/services/` : services métier, accès API et logique d'import/export.
- `docs/` : documentation du projet existante.

## 4. Architecture des pages
### Backoffice (protégé)
Routes protégées sous `ProtectedRoute` :
- `/` → `ProductList`
- `/products/add` → `ProductCreate`
- `/products/import` → `ProductImport`
- `/products/:id` → `ProductCreate` en édition
- `/import` → `CatalogImport`
- `/import/fichiers` → `FichiersImport`
- `/orders` → `OrderList`
- `/reset` → `DataReset`
- `/audit/import` → `ImportAudit`

### Frontoffice public
- `/shop` → `ShopHome`
- `/shop/:id` → `ProductDetail`
- `/shop/cart` → `CartPage`
- `/shop/auth` → `CustomerAuthPage`
- `/shop/checkout` → `CheckoutPage`
- `/shop/confirmation/:id` → `OrderConfirmation`
- `/shop/my-orders` → `MyOrders`

### Authentification
- `/login` → `Login`
- Les routes backoffice utilisent `ProtectedRoute` qui redirige vers `/login` si l'utilisateur n'est pas authentifié.

## 5. Contextes globaux
### AuthContext
- Gère l'utilisateur connecté (`user`) et l'état de chargement (`isLoading`).
- Fournit `login` et `logout`.
- Restaure la session à partir d'un service d'authentification.

### CartContext
- Gère les éléments du panier et leur synchronisation avec un back-end distant.
- Persist en `sessionStorage` pour le panier local.
- Charge le panier distant lorsqu'un client est connecté.
- Calcule les totaux HT, TTC et taxes.
- Opérations de base : `addItem`, `removeItem`, `updateQty`, `clear`.
- Synchronisation décalée (`debounce`) avec le service `cartSyncService`.

### CustomerContext
- Stocke le client actuellement actif en `sessionStorage`.
- Garde aussi une clé `customerSecureKey` pour les besoins d'API.
- Permet le logout du client.

## 6. Services métiers importants
### `PrestashopApi.tsx`
- Fournit des helpers API vers `/api/prestashop`.
- Actions supportées : création de produit, combinaison, client, adresse, commande, upload d'image.

### `produitApi.ts`
- Probablement responsable des opérations CRUD produit (lecture/écriture) via API.
- Utilisé dans l'import CSV.

### `csvImportService.ts`
- Analyse et valide les CSV PrestaShop.
- Convertit chaque ligne CSV en objet produit.
- Gère les catégories : recherche, création automatique si nécessaire.
- Envoie des requêtes XML à PrestaShop pour créer des catégories et des produits.
- Retourne un rapport d'import avec succès/erreur par ligne.

### Autres services
- `cartSyncService.ts` : synchronise le panier client avec le serveur.
- `customerService.ts` : gestion des clients frontoffice/backoffice.
- `orderService.ts` : traitement des commandes.
- `shopService.ts` : récupération des produits pour le shop public.
- `taxService.ts` : probablement calcul des taxes.
- `importAuditService.ts` : audit des opérations d'import.
- `fichierImportService.ts`, `otherImportService.ts` : gestion d'autres importations de fichiers.

## 7. Flux fonctionnels principaux
### Import de catalogue / produits
- Le backoffice permet d'importer des produits depuis un CSV PrestaShop.
- La validation CSV inclut les contrôles de prix, quantité, référence, taxe et doublons.
- Les catégories textuelles peuvent être créées automatiquement.
- Le système collecte des résultats détaillés pour chaque ligne importée.

### Gestion du panier
- Le panier est maintenu localement et synchronisé à distance pour les clients identifiés.
- Les détails produits sont récupérés dynamiquement lors du chargement du panier distant.

### Backoffice produit
- Ajout et modification de produits.
- Import de produits depuis CSV.
- Liste des produits.
- Gestion des commandes et audit d'import.

### Frontoffice shop
- Affichage de la liste des produits et détail produit.
- Panier et tunnel de commande.
- Authentification client pour le checkout et les commandes.
- Historique des commandes (`MyOrders`).

## 8. Points de qualité observés
- Bonne séparation entre logique métier (`services/`) et interface (`components/`).
- Utilisation de contextes pour partager les états auth, panier et client.
- Routes bien organisées avec layouts dédiés (`AppLayout`, `ShopLayout`).
- Format TypeScript appliqué pour améliorer la robustesse.
- Ajout de validations et de parsing CSV avec retours d'erreur structurés.

## 9. Suggestions rapides
- Vérifier que les routes API PrestaShop (`/api/prestashop`) correspondent au proxy Vite ou au serveur backend.
- Centraliser les constantes d'URL d'API si plusieurs services utilisent des bases différentes.
- Ajouter des tests unitaires / d'intégration sur le parsing CSV et la synchronisation du panier.
- Confirmer la gestion des erreurs réseau/format XML dans tous les services.

## 10. Conclusion
Ce projet est une application e-commerce hybride avec :
- un backoffice de gestion (produits, commandes, import),
- un frontoffice de vente (catalogue, panier, checkout),
- des intégrations PrestaShop et des importations CSV avancées.

Le fichier `CODE_ANALYSIS.md` contient l'analyse complète du code du projet.
