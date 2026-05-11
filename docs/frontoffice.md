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
