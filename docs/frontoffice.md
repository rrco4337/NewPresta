# FrontOffice — Documentation technique

## Vue d'ensemble

Le FrontOffice est une boutique e-commerce publique accessible à l'adresse `/shop`. Il permet aux visiteurs de parcourir les produits, de créer un compte, de passer commande et de suivre leurs achats. Tout repose sur l'API WebService PrestaShop via le proxy Vite.

---

## Routes

| Chemin | Composant | Protection |
|--------|-----------|------------|
| `/shop` | `ShopHome` | Public |
| `/shop/:id` | `ProductDetail` | Public |
| `/shop/cart` | `CartPage` | Public |
| `/shop/auth` | `CustomerAuthPage` | Public (redirige si déjà connecté) |
| `/shop/checkout` | `CheckoutPage` | Redirige vers `/shop/auth` si non connecté |
| `/shop/confirmation/:id` | `OrderConfirmation` | Public |
| `/shop/my-orders` | `MyOrders` | Redirige vers `/shop/auth` si non connecté |

---

## Contextes

### `CartContext` (`src/contexts/CartContext.tsx`)

Stockage panier dans `localStorage` (clé : `ps_shop_cart`).

| Valeur / Fonction | Type | Description |
|-------------------|------|-------------|
| `items` | `CartItem[]` | Articles dans le panier |
| `totalPrice` | `number` | Somme des `price × qty` |
| `totalItems` | `number` | Somme des `qty` |
| `addItem(product, qty)` | `void` | Ajoute ou incrémente un article |
| `removeItem(id)` | `void` | Supprime un article |
| `updateQty(id, qty)` | `void` | Modifie la quantité (supprime si qty ≤ 0) |
| `clear()` | `void` | Vide le panier |

### `CustomerContext` (`src/contexts/CustomerContext.tsx`)

Stockage session client dans `localStorage` (clé : `ps_shop_customer`).

| Valeur / Fonction | Type | Description |
|-------------------|------|-------------|
| `customer` | `Customer \| null` | Client connecté |
| `setCustomer(c)` | `void` | Connecte / met à jour |
| `logout()` | `void` | Déconnecte et efface le localStorage |

---

## Service client (`src/services/customerService.ts`)

Toutes les fonctions utilisent `axios` avec `baseURL=/api`, `Content-Type: application/xml`.

| Fonction | Endpoint PS | Description |
|----------|-------------|-------------|
| `findCustomerByEmail(email)` | `GET /customers?filter[email]=[email]` | Recherche par email, retourne `Customer \| null` |
| `registerCustomer(data)` | `POST /customers` | Crée un compte PS (groupe 3, actif, lang 1) |
| `getCustomerAddresses(customerId)` | `GET /addresses?filter[id_customer]=[id]` | Liste des adresses non supprimées |
| `createAddress(data)` | `POST /addresses` | Crée une adresse (pays FR = id 8) |
| `createPSCart(customerId, addressId, carrierId, items)` | `POST /carts` | Crée un panier PS avec les lignes |
| `createPSOrder(params)` | `POST /orders` | Crée la commande COD (état 13) |
| `updateStockAfterOrder(items)` | `GET+PUT /stock_availables` | Décrémente le stock produit |
| `getCustomerOrders(customerId)` | `GET /orders?filter[id_customer]=[id]` | Historique des commandes |

---

## Workflow complet d'achat

```
/shop  →  /shop/:id  →  /shop/cart  →  /shop/auth  →  /shop/checkout  →  /shop/confirmation/:id
                                              ↑
                                    (si non connecté)
```

### Étape détaillée

1. **Catalogue** (`ShopHome`) — grille de produits avec stock en temps réel, recherche client-side.
2. **Détail produit** (`ProductDetail`) — galerie d'images, sélecteur de quantité, bouton panier.
3. **Panier** (`CartPage`) — liste des articles, sous-total, bouton « Commander » → redirige vers `/shop/auth?next=/shop/checkout` si non connecté.
4. **Authentification** (`CustomerAuthPage`) :
   - **Connexion** : `GET /customers?filter[email]=[email]` — si trouvé → session créée (pas de vérification mot de passe via WebService)
   - **Inscription** : `POST /customers` avec prénom, nom, email, mot de passe
5. **Tunnel de commande** (`CheckoutPage`) — 3 étapes :
   - **Adresse** : sélection d'une adresse existante ou création (`POST /addresses`, pays France = id 8)
   - **Livraison** : 2 transporteurs
     - Transporteur 1 "Click and collect" (id=1) — Gratuit
     - Transporteur 2 "My carrier" (id=2) — 5,90 €
   - **Récapitulatif + confirmation** :
     - `POST /carts` → cartId
     - `POST /orders` (état 13 = COD, module `ps_cashondelivery`)
     - `PUT /stock_availables/{id}` pour chaque produit (décrémentation)
     - Vider le panier local (`clear()`)
     - Redirection vers `/shop/confirmation/:orderId`
6. **Confirmation** (`OrderConfirmation`) — récapitulatif de commande, instruction paiement à la livraison.
7. **Mes commandes** (`MyOrders`) — liste filtrée par `id_customer`.

---

## Transporteurs

| id | Nom | Prix | Type |
|----|-----|------|------|
| 1 | Click and collect | 0,00 € | Gratuit |
| 2 | My carrier | 5,90 € | Payant |

---

## Commande PrestaShop — champs clés

```xml
<current_state>13</current_state>           <!-- En attente de paiement à la livraison -->
<module>ps_cashondelivery</module>
<payment>Paiement à la livraison</payment>
<id_currency>1</id_currency>
<id_lang>1</id_lang>
<id_shop>1</id_shop>
<total_paid_real>0.000000</total_paid_real>  <!-- Non encore encaissé -->
```

---

## Authentification client — limitation WebService

L'API WebService PrestaShop **n'expose pas d'endpoint de login**. La connexion fonctionne donc ainsi :

1. `GET /customers?filter[email]=[email]&filter[active]=[1]` → si un client est trouvé, la session est créée
2. Le mot de passe n'est **pas vérifié** via l'API (limitation inhérente au WebService PS)
3. À l'inscription, le mot de passe est transmis en clair dans le XML ; PS le hash en interne

---

## Variables d'environnement

```env
VITE_API_BASE_URL=/api        # Proxy Vite → http://localhost:8080/api
VITE_PS_API_KEY=...           # Clé WebService PrestaShop (injectée par le proxy)
```

---

## Fichiers créés / modifiés (PROMPT 3)

| Fichier | Type |
|---------|------|
| `src/contexts/CustomerContext.tsx` | Nouveau |
| `src/services/customerService.ts` | Nouveau |
| `src/components/CartPage.tsx` + `.css` | Nouveau |
| `src/components/CustomerAuthPage.tsx` + `.css` | Nouveau |
| `src/components/CheckoutPage.tsx` + `.css` | Nouveau |
| `src/components/OrderConfirmation.tsx` + `.css` | Nouveau |
| `src/components/MyOrders.tsx` + `.css` | Nouveau |
| `src/App.tsx` | Modifié — 5 nouvelles routes + `CustomerProvider` |
| `src/components/ShopLayout.tsx` | Modifié — nav customer, logout, lien panier |
| `src/components/ShopLayout.css` | Modifié — styles customer nav + bouton panier minicart |


# Data reset (reinitialisation des donnees)

Ce document explique en detail comment la reinitialisation des donnees est implementee dans l application, cote UI et cote services.

---

## 1) Point d entree et objectif

- Route back office: /reset
- Composant UI: src/components/DataReset.tsx
- Objectif: supprimer les donnees principales de la boutique PrestaShop via l API Webservice (XML) dans un ordre securise.

La reinitialisation est **irreversible** et supprime:
- Commandes
- Declinaisons
- Produits
- Categories
- Clients
- Adresses
- Fournisseurs
- Marques

---

## 2) Flux global (UI)

Le composant DataReset est pilote par un etat `phase`:

- idle
  - Ecran d avertissement (zone de danger).
  - Liste des entites qui seront supprimees.
  - Bouton principal: "Reinitialiser toutes les donnees".

- confirm
  - Boite de confirmation avec rappel d irreversibilite.
  - Boutons: Annuler / Oui, tout supprimer.

- running
  - Affiche la progression de l etape courante et la progression globale.
  - Affiche en temps reel les etapes terminees avec succes ou en erreur.

- done
  - Resume global (nombre total d elements supprimes + erreurs).
  - Liste detaillee des etapes avec le resultat.
  - Bouton "Retour" pour repasser a l etat idle.

Transitions:
- idle -> confirm: clic sur "Reinitialiser toutes les donnees".
- confirm -> running: clic sur "Oui, tout supprimer".
- running -> done: quand toutes les etapes sont terminees.
- done -> idle: clic sur "Retour".

---

## 3) Ordre de suppression (RESET_STEPS)

Dans DataReset.tsx, la suppression est definie par `RESET_STEPS`.
L ordre est important pour limiter les contraintes de dependances:

1. Commandes
2. Declinaisons
3. Produits
4. Categories
5. Clients
6. Adresses
7. Fournisseurs
8. Marques

Justification generale:
- On supprime d abord les entites "dependantes" (commandes) avant les entites "sources" (produits, categories).
- Les declinaisons (combinations) sont liees aux produits, donc elles sont supprimees avant les produits.
- Les categories sont supprimees apres les produits.
- Les clients et adresses sont supprimes apres les commandes (qui referencent les clients).

Note: selon la configuration PrestaShop, l ordre Clients/Adresses pourrait etre inverse. Ici, on supprime les clients avant les adresses. Si l API refuse cette suppression dans certains cas, l etape "Adresses" peut renvoyer des erreurs apres coup.

---

## 4) Suivi de progression et erreurs

Pour chaque etape:
- `step.run(cb)` est appele avec un callback de progression.
- Le callback calcule `stepProgress` en pourcentage via done/total.
- En cas d erreur d une etape, l erreur est capturee et stockee dans `stepResults`, mais **la boucle continue** vers les etapes suivantes.

Resume final:
- totalDeleted = somme des `deleted` de chaque etape reussie.
- totalErrors = somme des `errors` + 1 si une etape a renvoye une exception globale.

Cela signifie que:
- La reinitialisation n est pas transactionnelle.
- On peut avoir un resultat "partiel".

---

## 5) Services utilises (otherImportService.ts)

### 5.1 cleanEntities(endpoint, protectedIds, onProgress)

C est la fonction generique de nettoyage:

1. GET /{endpoint}?display=[id]
   - Recupere la liste des ids via l API PrestaShop (XML).
2. parseIdList
   - Transforme la reponse XML en tableau d ids.
3. Filtre les ids proteges (ex: categories 1 et 2).
4. Boucle sur chaque id:
   - DELETE /{endpoint}/{id}
   - Incremente `deleted` si OK, `errors` sinon.
   - Appelle onProgress(done, total).

Retourne un `CleanResult`:
- total: nombre total d elements a supprimer
- deleted: nombre effectivement supprimes
- errors: nombre d echec API

### 5.2 Fonctions specialisees

Chaque fonction d entite appelle cleanEntities avec un endpoint fixe:

- cleanOrders       -> /orders
- cleanCombinations -> /combinations
- cleanProducts     -> /products
- cleanCategories   -> /categories (protectedIds = ["1", "2"])
- cleanCustomers    -> /customers
- cleanAddresses    -> /addresses
- cleanSuppliers    -> /suppliers
- cleanBrands       -> /manufacturers

Le cas special des categories:
- Les ids 1 et 2 sont proteges (Root + Home dans PrestaShop) et ne sont pas supprimes.

---

## 6) Ce que l UI affiche exactement

- Pendant l execution:
  - Etape courante + barre de progression locale.
  - Progression globale calculee sur l index d etape (pas sur la somme exacte des elements).
  - Historique des etapes terminees, avec succes/erreur.

- A la fin:
  - Resume total d elements supprimes.
  - Resume d erreurs.
  - Liste detaillee par etape (label, quantite supprimee, message d erreur si present).

---

## 7) Limites et points d attention

- Pas de transaction globale: une etape peut echouer et les suivantes s executent quand meme.
- Le pourcentage global est approximatif (index d etape), pas base sur le total reelle d elements.
- L ordre Clients/Adresses peut etre discutable selon la configuration PrestaShop.
- Les protections ne concernent que les categories (ids 1 et 2). Les autres entites n ont pas d exclusion.
- Les erreurs API sont simplement comptees et remontees, sans retry automatique.

---

## 8) Fichiers principaux

- src/components/DataReset.tsx
- src/services/otherImportService.ts
- src/App.tsx (route /reset via LayoutWrapper + ProtectedRoute)

---

## 9) Resume en une phrase

La reinitialisation des donnees est une suppression sequentielle d entites PrestaShop, pilotee par une UI multi-etapes qui affiche la progression et conserve un historique des succes/erreurs, en s appuyant sur un service generique de suppression par endpoint.
