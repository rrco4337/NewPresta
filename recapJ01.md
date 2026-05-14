# Récap J01

## Vue d'ensemble
Cette application est une interface React/Vite connectée à une API PrestaShop. Elle couvre deux zones principales : un BackOffice protégé pour gérer le catalogue, les imports et les commandes, et un FrontOffice public pour parcourir les produits, gérer le panier et passer commande.

L'application s'appuie surtout sur des échanges XML avec PrestaShop via `axios`, avec plusieurs services dédiés au catalogue, aux clients, aux commandes, au panier et aux imports CSV.

## Démarrage et structure globale
- Le point d'entrée est `src/main.tsx`, qui charge les styles globaux puis rend `App` dans `StrictMode`.
- Le routage est défini dans `src/App.tsx` avec `react-router-dom`.
- Trois contextes enveloppent l'application : `AuthProvider` pour l'admin, `CustomerProvider` pour le client, et `CartProvider` pour le panier.
- Le BackOffice est protégé par `ProtectedRoute` et affiché dans `AppLayout`.
- Le FrontOffice est affiché dans `ShopLayout`.

## Logique de navigation
### BackOffice
Le BackOffice expose les écrans de gestion suivants :
- liste des produits
- création et modification de produit
- import CSV produits
- import catalogue générique
- import de fichiers
- liste des commandes
- réinitialisation des données
- audit des imports

Le titre de page est résolu selon l'URL dans `App.tsx` via `resolvePageTitle`, puis injecté dans `AppLayout`.

### FrontOffice
Le FrontOffice gère :
- la page d'accueil boutique
- la fiche produit
- le panier
- l'authentification client
- le tunnel de checkout
- la confirmation de commande
- l'historique de commandes du client

## Gestion de l'état
### Auth admin
`src/contexts/AuthContext.tsx` gère l'utilisateur BackOffice.
- la session est restaurée depuis le stockage local au chargement
- `login` délègue à `authService`
- `logout` efface la session active

### Client boutique
`src/contexts/CustomerContext.tsx` gère le client connecté côté boutique.
- le client est restauré depuis `sessionStorage`
- la `secureKey` est aussi stockée séparément pour les synchronisations panier
- `logout` supprime les données client et la clé associée

### Panier
`src/contexts/CartContext.tsx` centralise le panier.
- les items sont persistés en session
- les montants sont calculés en HT, TTC et taxes
- le panier local peut être synchronisé avec le panier distant PrestaShop
- le contexte suit aussi l'état de chargement du panier distant et son identifiant

## Flux métier principaux
### Catalogue et produits
`src/services/produitApi.ts` contient la logique produit principale.
- mapping des objets PrestaShop vers le frontend
- transformation des champs multilingues
- construction des XML pour la création et la mise à jour
- récupération des images produit via l'API

`ProductList`, `ProductCreate` et `ProductDetail` exploitent cette couche pour l'affichage et l'édition.

### Import CSV produits
`src/components/ProductImport.tsx` orchestre l'import produit.
- sélection ou glisser-déposer d'un fichier CSV
- parsing des lignes
- validation avant import
- exécution de l'import avec progression
- nettoyage/suppression des produits si besoin

La logique bas niveau est dans `src/services/csvImportService.ts`.
- lecture des colonnes spécifiques au CSV PrestaShop
- validation des données
- import produit ligne par ligne

### Imports catalogue et fichiers
`src/components/CatalogImport.tsx` regroupe plusieurs types d'import :
- catégories
- clients
- adresses
- fournisseurs
- marques
- déclinaisons

La logique de parsing/import/nettoyage est portée par `src/services/otherImportService.ts`.

`src/components/FichiersImport.tsx` et `src/services/fichierImportService.ts` servent aux imports de fichiers spécifiques, notamment les lots et images.

### Commandes et checkout
`src/components/CheckoutPage.tsx` pilote le tunnel d'achat.
- vérifie que le client est connecté
- vérifie que le panier n'est pas vide
- charge les adresses existantes du client
- permet de créer une nouvelle adresse si nécessaire
- sélectionne un transporteur
- prépare les lignes de commande
- appelle la création de panier et de commande côté PrestaShop
- met à jour le stock après commande

La logique serveur correspondante est dans `src/services/customerService.ts`.
- recherche/création de client
- récupération et création d'adresses
- création de panier PrestaShop
- création de commande
- mise à jour de stock après validation

### Synchronisation panier
`src/services/cartSyncService.ts` synchronise le panier local avec PrestaShop.
- récupère la `secureKey`
- résout l'adresse de livraison
- récupère le dernier panier existant du client si présent
- crée ou met à jour le panier distant avec les lignes produit

### Commandes BackOffice
`src/services/orderService.ts` récupère les commandes PrestaShop et permet de modifier leur statut.
- lecture des commandes
- récupération du nom du client associé
- changement d'état via historique de commande

## Points techniques importants
- Les échanges avec PrestaShop se font principalement en XML.
- Plusieurs services utilisent `DOMParser` pour lire les réponses API XML.
- Les données sensibles ou de session sont gardées dans `sessionStorage` ou `localStorage` selon le contexte.
- L'application est organisée par domaines métier plutôt que par couche technique stricte.

## Résumé opérationnel
Si tu dois modifier le comportement global, les zones à regarder en premier sont :
- `src/App.tsx` pour le routage
- `src/contexts/CartContext.tsx` pour le panier
- `src/services/customerService.ts` pour checkout et clients
- `src/services/produitApi.ts` pour le catalogue
- `src/services/csvImportService.ts` et `src/services/otherImportService.ts` pour les imports

## Evolutions recentes
### Page de selection utilisateur (nouvel accueil)
- L'accueil `"/"` affiche une page de selection d'utilisateur avec cartes, etats de chargement et etat vide.
- Connexion en 1 clic : selectionne un client, recupere le `secure_key`, puis ouvre la session boutique.
- Option `Utilisateur anonyme` : acces a la boutique sans compte.
- Acces admin conserve via un bouton vers `/login`.
- La liste BackOffice des produits est desormais sur `/products` (routage et navigation ajustes).
- Fichiers principaux : `src/components/UserSelectPage.tsx`, `src/services/customerService.ts`, `src/App.tsx`, `src/components/AppLayout.tsx`.

### Badges produits HOT / NEW
- Un badge automatique est calcule a partir de `date_availability_produit` (fallback `date_available`).
- Regles : `HOT` si < 24h, sinon `NEW` si < 7 jours, sinon aucun badge.
- Gestion du fuseau horaire et formats de date, avec rejet des dates vides (`0000-00-00`).
- Affiche sur les cartes boutique, la liste produits BackOffice et la fiche produit.
- Composant reutilisable et extensible : `src/components/ProductBadge.tsx` + `src/utils/productBadges.ts`.
- Styles + animation legere : `src/components/ProductBadge.css`.
- Mapping du champ date dans `src/services/produitApi.ts`.
