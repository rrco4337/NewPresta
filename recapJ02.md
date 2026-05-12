# Récap J02

## Fonctionnalités ajoutées

---

### 1. Badges produits HOT / NEW

Affichage automatique d'une étiquette visuelle sur les produits selon leur date de sortie.

#### Règles

| Badge | Condition |
|---|---|
| **HOT** | Produit sorti il y a moins de 24 heures |
| **NEW** | Produit sorti il y a moins de 7 jours |

Un seul badge à la fois. Si HOT, NEW n'est pas affiché. Si aucune condition n'est remplie, rien n'est affiché.

#### Fichiers

- `src/utils/productBadges.ts` — logique pure
  - `parseAvailabilityDate()` : parse la date en gérant les fuseaux horaires et rejette les valeurs vides ou `0000-00-00`
  - `getProductBadge()` : retourne `'HOT'`, `'NEW'` ou `null` selon l'âge du produit
  - Architecture extensible via `BADGE_RULES` : ajouter un badge = ajouter une ligne dans le tableau
- `src/components/ProductBadge.tsx` — composant React réutilisable
  - Timer partagé (singleton) rafraîchissant tous les badges toutes les 60 secondes sans re-render inutile
  - Prop `className` pour le positionnement (coin sur image, inline dans une liste)
- `src/components/ProductBadge.css` — styles et animations
  - HOT : dégradé rouge/orange + animation `badge-pulse` infinie
  - NEW : dégradé bleu/vert + animation `badge-pop` à l'apparition

#### Intégration

| Composant | Emplacement du badge |
|---|---|
| `ShopHome.tsx` | Coin supérieur gauche de chaque carte + produit phare |
| `ProductList.tsx` | Liste BackOffice |
| `ProductDetail.tsx` | Fiche produit |

#### Champ source

Le badge est calculé à partir du champ `date_availability_produit` sur le type `Product`/`ShopProduct`, lui-même lu depuis le champ PrestaShop `available_date` (colonne DB `available_date`).

Le mapping est dans `src/services/produitApi.ts` → `mapToFrontend` :
```ts
const dateAvailability = p.available_date || p.date_available || '';
```

#### Import CSV

`src/services/fichierImportService.ts` lit la colonne `date_availability_produit` (ou `date_produit`) du fichier 1 et envoie la date à PrestaShop via la balise XML `<available_date>`.

Le parsing de date est français (DD/MM/YYYY) : le regex est tenté avant `Date.parse` pour éviter l'inversion MM/DD du moteur JavaScript.

---

### 2. Recherche et filtrage multicritère (FrontOffice)

Panneau de filtres avancé dans `src/components/ShopHome.tsx`, connecté à l'API PrestaShop et synchronisé avec l'URL.

#### Critères disponibles

| Filtre | Méthode | Comportement |
|---|---|---|
| Recherche texte | Client-side | Debounce 300 ms, insensible à la casse, sur nom et référence |
| Catégorie | API (`filter[id_category_default]`) | Refetch produits quand la catégorie change |
| Prix min TTC | Client-side | Filtre après récupération (API stocke HT) |
| Prix max TTC | Client-side | Validation : min ≤ max, message d'erreur sinon |
| HOT / NEW / Tout | Client-side | Compteurs dynamiques, basés sur `getProductBadge` |
| Tri | Client-side | Prix ↑, Prix ↓, Nouveautés d'abord, Défaut |
| Date de simulation | Client-side | Simule les badges à n'importe quelle date passée ou future |

Tous les filtres sont combinables simultanément.

#### Fonctionnalités UX

- **Chips actifs** : chaque filtre appliqué apparaît comme une étiquette supprimable individuellement
- **Réinitialiser** : bouton visible uniquement quand au moins un filtre est actif, efface tout en un clic
- **Compteur de résultats** : mis à jour en temps réel à chaque changement de filtre
- **Synchronisation URL** : tous les filtres sont encodés dans les paramètres de l'URL (`?q=&cat=&pmin=&pmax=&sort=&badge=&date=`) — lien partageable et persistant au rechargement
- **Message vide intelligent** : le message d'état explique la raison selon le filtre actif (HOT, NEW, ou critères généraux)
- **Titre de grille dynamique** : affiche le nom de la catégorie sélectionnée ou "Les collections du moment"

#### Fichiers modifiés

- `src/components/ShopHome.tsx` — panneau de filtres, état, useMemo de filtrage/tri, synchronisation URL
- `src/services/shopService.ts`
  - `fetchShopCategories()` : récupère les catégories actives depuis l'API PrestaShop (hors catégories racine id ≤ 2)
  - `fetchShopProducts(opts)` : accepte désormais `{ categoryId? }` et le passe à `getAllProducts`

#### Architecture

```
URL params
  ↕ (useSearchParams)
État local React (searchInput, categoryId, priceMin, priceMax, sortBy, badgeFilter, dateRef)
  → debounce 300ms sur searchInput
  → refetch API si categoryId change
  → useMemo client-side : texte + prix + badge + tri
  → filtered[] → rendu grille
```
