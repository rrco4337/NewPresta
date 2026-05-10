## Filtres produits — implémentation (sans filtrage côté client)

### Objectif
Ajouter des filtres proches de la grille PrestaShop (ID, nom, référence, catégorie, prix HT, quantité, état) **sans filtrage JavaScript sur la liste** : la recherche doit se faire **via l'API**.

### Ce qui a été fait
1. **UI des filtres dans la liste produits**
   - Ajout d'un bloc de filtres (ID min/max, nom, référence, catégorie, montant HT min/max, quantité min/max, état, bouton Rechercher).
   - Les champs ne filtrent rien localement : ils déclenchent une requête serveur au clic sur **Rechercher**.

2. **Filtrage côté API (PrestaShop Webservice)**
   - `productService.getAllProducts()` accepte un objet `ProductFilters`.
   - Les filtres sont convertis en paramètres `filter[...]` du Webservice.
   - Les recherches texte (nom, référence) utilisent la syntaxe `%[valeur]%` → correspond à un `LIKE '%valeur%'` côté PrestaShop (recherche partielle, insensible à la casse).
   - Les plages numériques utilisent la syntaxe `[min,max]`.
   - Le filtre `filter[active]` prend `1` (actif) ou `0` (inactif).
   - Le filtre `filter[id_category_default]` prend l'ID numérique de la catégorie.

3. **Quantité (stock)**
   - La quantité ne se trouve pas directement dans la ressource `products`.
   - Un appel est fait sur `stock_availables` avec `filter[quantity]=[min,max]` pour récupérer les `id_product`.
   - Ces IDs sont ensuite passés au filtre `filter[id]` côté produits, afin de rester 100% côté API.

### Pourquoi `%[valeur]%` et non `[valeur]`
Le Webservice PrestaShop distingue deux syntaxes pour les filtres texte :

| Syntaxe          | Comportement SQL équivalent       | Usage                         |
|------------------|-----------------------------------|-------------------------------|
| `[valeur]`       | `= 'valeur'` (égalité stricte)   | Correspondance exacte totale  |
| `%[valeur]%`     | `LIKE '%valeur%'`                 | Recherche partielle (contient)|

Avec `[valeur]`, taper "shirt" ne retourne rien si le produit s'appelle "Blue Cotton Shirt". Avec `%[valeur]%`, toute sous-chaîne fonctionne.

### Fichiers modifiés
- `src/components/ProductList.tsx`
  - Remplacement du filtrage local par une soumission de filtres côté API.
  - Ajout du formulaire de filtres "type PrestaShop".
- `src/components/ProductList.css`
  - Styles du bloc de filtres (grille, champs min/max, bouton Rechercher).
- `src/services/produitApi.ts`
  - Ajout du type `ProductFilters`.
  - Construction des paramètres `filter[...]` pour `GET /products`.
  - Filtres texte (nom, référence) en `%[valeur]%` pour recherche partielle.
  - Recherche des IDs produits par quantité via `GET /stock_availables`.

### Comportement final
- Les filtres ne "filtrent" plus côté client : **chaque recherche refait un GET** sur l'API.
- Nom et référence : recherche partielle (contient la chaîne saisie).
- Prix, ID, quantité : plages numériques `[min,max]`.
- Le bouton **Actualiser** recharge les données avec les filtres appliqués.
- Le comptage "X produits" reflète la réponse serveur.
