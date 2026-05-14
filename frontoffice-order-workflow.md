# Workflow commande frontoffice (PrestaShop)

Ce document decrit le workflow de la recuperation des prix (avec declinaisons), puis la creation du panier et la commande via l API PrestaShop.

## Schema global (Mermaid)

```mermaid
flowchart LR
  subgraph Catalogue
    A[GET /products?display=full] --> B[Prix HT produit]
    A --> C[Ids declinaisons]
    D[GET /combinations/{id}?display=full] --> E[Impact prix declinaison]
    F[GET /tax_rules + /taxes] --> G[Taux TVA]
    B --> H[Prix HT final]
    E --> H
    H --> I[Prix TTC = HT * (1 + TVA)]
  end

  subgraph Panier
    I --> J[Ajout au panier (store local)]
    J --> K[Sync panier]
    K --> L[POST /carts ou PUT /carts/{id}]
  end

  subgraph Commande
    L --> M[Checkout: selection adresse]
    M --> N[Sync panier avec adresse]
    N --> O[POST /orders]
    O --> P[POST /order_details si besoin]
    O --> Q[POST /order_histories]
  end
```

## Etapes detaillees

- 1) Recuperation du catalogue
  - Appel: `GET /products?display=full&sort=[...]&limit=...`
  - Prix de base: `product.price` (HT)
  - Liste des declinaisons: `associations.combinations`

- 2) Recuperation des declinaisons
  - Appel: `GET /combinations/{id}?display=full`
  - L impact prix est porte par `combination.price`
  - Prix HT final: `product.price + combination.price`

- 3) Calcul TVA et prix TTC
  - Appels: `GET /tax_rules?display=[id_tax,id_tax_rules_group]` puis `GET /taxes?display=[id,rate]`
  - Taux TVA = tax_rules_group -> tax_id -> rate
  - Prix TTC = `HT * (1 + TVA/100)`

- 4) Ajout au panier
  - Le panier stocke: `productId`, `combinationId`, `quantity`, `price` (TTC), `taxRate`
  - Stock verifie avant ajout: `GET /stock_availables?display=full&filter[id_product]=[...]&filter[id_product_attribute]=[...]`

- 5) Sync panier PrestaShop
  - Appel: `POST /carts` (creation) ou `PUT /carts/{id}` (mise a jour)
  - Points cle: `id_customer` (0 si anonyme), `id_address_delivery`, `cart_rows`

- 6) Validation commande
  - Sync panier avec adresse selectionnee (mise a jour `id_address_delivery`)
  - Appel: `POST /orders` avec `id_cart`, `id_customer`, totals HT/TTC, `current_state`
  - Si besoin: `POST /order_details` (si PS ne cree pas les details automatiquement)
  - Historique: `POST /order_histories` pour forcer l etat cible

## Requetes API mises en valeur

- Catalogue
  - `GET /products?display=full&sort=[id_DESC]&limit=...`
  - `GET /products/{id}?display=full`
  - `GET /combinations/{id}?display=full`

- Taxes
  - `GET /tax_rules?display=[id_tax,id_tax_rules_group]`
  - `GET /taxes?display=[id,rate]`

- Stock
  - `GET /stock_availables?display=full&filter[id_product]=[...]&filter[id_product_attribute]=[...]`

- Panier
  - `POST /carts`
  - `PUT /carts/{id}`

- Commande
  - `POST /orders`
  - `POST /order_details`
  - `POST /order_histories`
