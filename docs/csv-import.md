# Import CSV — Résumé détaillé du développement

## 1. Analyse du fichier CSV

Fichier source : `products_import.csv` (racine du projet) — format standard d'export PrestaShop.

| Propriété | Valeur |
|-----------|--------|
| Délimiteur | Semicolon (`;`) |
| Encodage | UTF-8 |
| Ligne 1 | En-tête (66 colonnes) |
| Lignes 2–8 | 7 produits de démonstration |
| Produits | iPod Nano, iPod shuffle, MacBook Air, MacBook, iPod touch, Belkin Folio, Shure SE210 |

---

## 2. Mapping des champs CSV → API

Le CSV contient 66 colonnes. Seuls les champs supportés par le WebService PrestaShop sont extraits. Les autres (EAN13, UPC, images, tags, visibilité, remises…) sont ignorés.

| Index | Colonne CSV | Champ `Product` | Type | Requis |
|-------|-------------|-----------------|------|--------|
| 1 | Active (0/1) | `active` | boolean | Non (défaut `false`) |
| 2 | Name * | `name` | string | **Oui** |
| 3 | Categories (x,y,z…) | `id_category_default` | int — 1ère valeur numérique, sinon `2` | Non |
| 4 | Price tax excluded | `price` | float | **Oui** |
| 5 | Tax rules ID | `id_tax_rules_group` | int | Non (défaut `1`) |
| 6 | Wholesale price | `wholesale_price` | float | Non |
| 12 | Reference # | `reference` | string | Non |
| 22 | Weight | *(ignoré — absent du type `Product`)* | — | — |
| 25 | Quantity | `quantity` | int | Non |
| 33 | Summary | `description_short` | string HTML | Non |
| 34 | Description | `description` | string HTML | Non |
| 51 | Condition | *(ignoré — absent du type `Product`)* | — | — |

> **Note catégories :** Le CSV contient des noms texte ("iPods", "Laptops"…). Le service tente `parseInt()` sur la première valeur. Si ce n'est pas un nombre, il utilise `2` (catégorie racine PrestaShop par défaut).

---

## 3. API utilisée

### Pourquoi le WebService XML et non le module custom

Au départ, la consigne pointait vers les endpoints JSON d'un module custom (`/module/product_api/productcreate`). Lors des tests, **tous les imports retournaient 404** car ce module n'est pas installé sur le serveur PrestaShop.

En examinant `http://localhost:8080/api`, le WebService natif de PrestaShop est disponible et expose `POST /api/products` — c'est exactement ce que `produitApi.ts` utilise déjà pour le CRUD manuel.

**Décision finale :** réutiliser `productService.create()` existant, qui gère l'ensemble du cycle (XML → POST → parse réponse → mise à jour stock).

### Endpoint utilisé

| Opération | Méthode | URL |
|-----------|---------|-----|
| Créer un produit | `POST` | `/api/products` |
| Mettre à jour le stock | `PUT` | `/api/stock_availables/{stockId}` |

### Authentification

Basic Auth via le proxy Vite (`/api` → `http://127.0.0.1:8080`) :
- Username : `VITE_PRESTASHOP_API_KEY` (injecté automatiquement par le proxy)
- Password : vide

### Format échangé

- **Requête :** XML PrestaShop (construit par `PrestashopMapper.buildXml()`)
- **Réponse :** XML PrestaShop (parsé par `parseXMLToJSON()`)

---

## 4. Fichiers créés et modifiés

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `src/services/csvImportService.ts` | Parsing CSV, validation, mapping vers `Partial<Product>`, orchestration des appels API |
| `src/components/ProductImport.tsx` | Composant React — UI complète de l'import |
| `src/components/ProductImport.css` | Styles de la page d'import |
| `docs/csv-import.md` | Ce fichier |

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/App.tsx` | Route `/products/import` ajoutée + titre "Import CSV" dans `resolvePageTitle` |
| `src/components/AppLayout.tsx` | Système de sous-menu rétractable pour "Produits" (voir §7) |
| `vite.config.ts` | Nettoyage des proxys inutiles (`/module`, `/ps-module`) ajoutés puis supprimés |

---

## 5. Architecture de `csvImportService.ts`

### Types exportés

```typescript
interface CsvRow          // Champs bruts extraits du CSV (strings)
interface ImportResult    // Résultat par ligne : { rowIndex, productName, success, error?, productId? }
type ProgressCallback     // (done: number, total: number) => void
```

### Fonctions exportées

```typescript
parseCSV(content: string): CsvRow[]
// Split par \n, ignore ligne d'en-tête, split par ;, nettoie guillemets/espaces
// Filtre les lignes dont name === '' (lignes vides)

validateRow(row: CsvRow, rowIndex: number): string[]
// Vérifie : name non vide, price >= 0 et numérique
// Retourne la liste des messages d'erreur (vide = valide)

mapRowToProduct(row: CsvRow): Partial<Product>
// Convertit CsvRow → Partial<Product> attendu par productService.create()
// id_category_default : parseInt sur 1ère catégorie, défaut 2
// active : '1' → true, sinon false

importProducts(file: File, onProgress?: ProgressCallback): Promise<ImportResult[]>
// Lit le fichier, parse, puis pour chaque ligne :
//   1. validateRow() → si erreur : pousse ImportResult(success=false), continue
//   2. mapRowToProduct()
//   3. productService.create(payload) — gère XML + stock en interne
//   4. Pousse ImportResult(success=true/false)
//   5. Appelle onProgress(i+1, total)
// Import séquentiel (for...of) pour ne pas surcharger le serveur
```

### Extraction d'erreurs XML

En cas d'échec de `productService.create()`, la réponse d'erreur PrestaShop est en XML. Une fonction `extractXmlError()` parse le XML et extrait le contenu de `<message>` ou `<error>` pour l'afficher à l'utilisateur.

---

## 6. Architecture de `ProductImport.tsx`

### États locaux

| État | Type | Rôle |
|------|------|------|
| `step` | `'idle' \| 'preview' \| 'importing' \| 'done'` | Étape courante de l'interface |
| `file` | `File \| null` | Fichier sélectionné |
| `previewRows` | `CsvRow[]` | 5 premières lignes après parsing |
| `progress` | `{ done: number; total: number }` | Avancement de l'import |
| `results` | `ImportResult[]` | Résultats ligne par ligne |
| `dragOver` | `boolean` | État visuel du drag-and-drop |

### Flux UI

```
idle
  └─ Sélection fichier (drop ou input)
       ↓ parseCSV()
preview
  └─ Tableau des 5 premières lignes
  └─ Bouton "Lancer l'import"
       ↓ importProducts() avec callback onProgress
importing
  └─ Barre de progression animée
  └─ Compteur "X / Y"
       ↓ résultats reçus
done
  └─ Statistiques : succès / erreurs / total
  └─ Tableau détaillé ligne par ligne
  └─ Bouton "Nouvel import" → retour à idle
```

### Gestion des erreurs image (`onError`)

Si une image ne charge pas (product sans image), le `<img>` se masque et le placeholder SVG s'affiche via manipulation DOM directe dans le handler `onError`.

---

## 7. Modification de la navigation — Sous-menu rétractable

### Problème initial

"Import CSV" était un item de premier niveau dans la sidebar, au même niveau que "Produits". L'utilisateur souhaitait qu'il soit dans un sous-menu de "Produits", extensible à d'autres modules futurs.

### Solution implementée

Le système de navigation dans `AppLayout.tsx` a été refactorisé pour supporter des sous-menus :

**Interface étendue :**
```typescript
interface NavSubItem { label: string; path: string; end?: boolean; }
interface NavModule  { ..., children?: NavSubItem[]; }
```

**"Produits" dans `navModules` :**
```typescript
{
  label: 'Produits',
  path: '/',
  icon: <IconBox />,
  section: 'Catalogue',
  children: [
    { label: 'Liste des produits', path: '/',                end: true },
    { label: 'Ajouter un produit', path: '/products/add' },
    { label: 'Import CSV',         path: '/products/import' },
  ],
}
```

**État d'ouverture :**
```typescript
const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
  // Auto-ouvert si la route courante correspond à un sous-item
});

useEffect(() => {
  // Re-vérifie à chaque changement de route → auto-ouvre si navigation externe
}, [pathname]);

const toggleGroup = (label: string) => { /* toggle Set */ };
```

**Comportement :**
- Le parent "Produits" est un `<button>` (pas un `<NavLink>`) qui appelle `toggleGroup()`
- Le sous-menu s'ouvre/se ferme avec une animation CSS (`submenuIn`)
- Le chevron pivote à 90° quand ouvert (`IconChevron` avec `transform: rotate`)
- Auto-ouverture lors d'une navigation directe vers `/products/import` ou autre sous-route
- En sidebar réduite (collapsed), le sous-menu est masqué — seule l'icône parent reste visible
- **Extensible :** ajouter un sous-menu à "Commandes" ne demande qu'un tableau `children`

---

## 8. Chronologie des corrections

| Étape | Problème rencontré | Solution |
|-------|-------------------|----------|
| 1 | Import → 404 sur `/module/product_api/productcreate` | Le module custom n'est pas installé sur PrestaShop |
| 2 | Tentative avec proxy `/ps-module` + format `index.php?fc=module` | Même résultat : le module n'existe pas côté serveur |
| 3 | Identification du vrai WebService disponible (`/api/*` en XML) | Remplacement par `productService.create()` déjà opérationnel dans `produitApi.ts` |
| 4 | Proxys `/module` et `/ps-module` devenus inutiles | Supprimés de `vite.config.ts` pour garder la config propre |
| 5 | "Import CSV" en sidebar principale = mauvaise UX | Refactorisation en sous-menu rétractable sous "Produits" |

---

## 9. Instructions pour tester

### Prérequis

- PrestaShop fonctionnel sur `http://127.0.0.1:8080`
- Clé WebService valide dans `.env` → `VITE_PRESTASHOP_API_KEY=7Q4NKLRMB4FFXGEWRITAZ8EDZDP2RSKG`
- `npm run dev` démarré

### Test nominal (fichier valide)

1. Se connecter sur `http://localhost:5173`
2. Sidebar → cliquer **"Produits"** pour ouvrir le sous-menu
3. Cliquer **"Import CSV"**
4. Glisser-déposer `products_import.csv` (ou cliquer la zone)
5. Vérifier l'aperçu : 5 produits affichés (Nano, Shuffle, MacBook Air, MacBook, iPod touch)
6. Cliquer **"Lancer l'import"**
7. Observer la barre de progression (7 lignes)
8. Rapport attendu : 7 succès (si PrestaShop est opérationnel)
9. Vérifier dans le Back-Office PrestaShop : **Catalogue → Produits**

### Test d'erreurs

Modifier `products_import.csv` avant import :
- Supprimer le nom (colonne 2) → rapport : `Erreur — Name requis`
- Mettre `-5` comme prix (colonne 4) → rapport : `Erreur — Price invalide`
- Supprimer le prix → rapport : `Erreur — Price invalide`

### Vérification via WebService

```bash
curl -u 7Q4NKLRMB4FFXGEWRITAZ8EDZDP2RSKG: \
  "http://127.0.0.1:8080/api/products?display=full&output_format=JSON"
```

---

## 10. Points d'extension futurs

| Amélioration | Description |
|--------------|-------------|
| Résolution des catégories | Appeler `GET /api/categories?display=[name]` pour mapper le nom de catégorie vers son ID |
| Import en parallèle | Remplacer `for...of` par des lots (`Promise.allSettled`) avec concurrence limitée |
| Mise à jour de produits existants | Utiliser `productService.update()` si le `reference` correspond à un produit existant |
| Prévisualisation complète | Afficher toutes les lignes avec statut de validation avant de lancer l'import |
| Support d'autres modules | Ajouter `children` à d'autres entrées de `navModules` (ex. Commandes, Clients) |
