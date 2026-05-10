# Import CSV — Module Produit

## 1. Analyse du fichier CSV

Le fichier `products_import.csv` (fourni à la racine du projet) est le format standard d'export PrestaShop.

| Propriété | Valeur |
|-----------|--------|
| Délimiteur | Semicolon (`;`) |
| Encodage | UTF-8 |
| Ligne 1 | En-tête (noms de colonnes) |
| Lignes 2+ | Données produits |
| Nombre de colonnes | 66 |

---

## 2. Mapping des champs

Seules les colonnes utilisées par l'API module sont extraites. Les autres sont ignorées.

| Index | Colonne CSV | Champ API | Type | Requis |
|-------|-------------|-----------|------|--------|
| 0 | Product ID | *(ignoré à l'import)* | — | — |
| 1 | Active (0/1) | `active` | int (0 ou 1) | Non (défaut 0) |
| 2 | Name * | `name` | string | **Oui** |
| 3 | Categories (x,y,z…) | `id_category` | int (1ère valeur numérique, défaut 2) | Non |
| 4 | Price tax excluded | `price` | float | **Oui** |
| 5 | Tax rules ID | *(non envoyé)* | — | — |
| 6 | Wholesale price | `wholesale_price` | float | Non |
| 12 | Reference # | `reference` | string | Non |
| 22 | Weight | `weight` | float | Non |
| 25 | Quantity | `quantity` | int | Non |
| 33 | Summary | `description_short` | string (HTML) | Non |
| 34 | Description | `description` | string (HTML) | Non |
| 51 | Condition | `condition` | `new` / `used` / `refurbished` | Non (défaut `new`) |

### Champs ignorés (non supportés par l'API module)
EAN13, UPC, Meta title, Meta keywords, Meta description, Tags, Image URLs, Visibility, On sale, Discount, etc.

---

## 3. Endpoints utilisés

Source : `produit.json`

| Opération | Méthode | URL |
|-----------|---------|-----|
| Créer un produit | `POST` | `/module/product_api/productcreate` |

### Exemple de payload envoyé

```json
{
  "name": "iPod Nano",
  "price": 100,
  "wholesale_price": 80,
  "reference": "RP-demo_1",
  "description": "<p>New design.</p>",
  "description_short": "<p>New design.</p>",
  "condition": "new",
  "active": 1,
  "weight": 0.068357,
  "quantity": 160,
  "id_category": 2
}
```

### Authentification

Basic Auth via le proxy Vite (`/module` → `http://127.0.0.1:8080`) :
- Username : `VITE_PRESTASHOP_API_KEY`
- Password : *(vide)*

---

## 4. Architecture technique

### Fichiers créés / modifiés

| Fichier | Rôle |
|---------|------|
| `src/services/csvImportService.ts` | Parsing, validation, mapping, appels API |
| `src/components/ProductImport.tsx` | Composant UI React |
| `src/components/ProductImport.css` | Styles cohérents avec le design existant |
| `docs/csv-import.md` | Ce fichier |
| `vite.config.ts` | Proxy `/module` ajouté |
| `src/App.tsx` | Route `/products/import` ajoutée |
| `src/components/AppLayout.tsx` | Lien "Import CSV" dans la sidebar |

### Choix techniques

| Décision | Raison |
|----------|--------|
| Import séquentiel (`for...of`) | Évite de surcharger le serveur avec des requêtes parallèles |
| Parsing CSV natif (sans librairie) | Pas de dépendance supplémentaire, format simple (séparateur `;`) |
| Instance axios dédiée `moduleApi` | Isole la configuration JSON du module de l'API WebService XML existante |
| Proxy Vite pour `/module` | Résout les problèmes CORS entre le frontend (port 5173) et PrestaShop (port 8080) |
| Callback `onProgress` | Permet la mise à jour en temps réel de la barre de progression sans état global |

---

## 5. Étapes d'implémentation

1. **Proxy Vite** — `vite.config.ts` : ajout du bloc `/module` avec Basic Auth
2. **Service** — `csvImportService.ts` : parsing, validation, mapping, appel API
3. **Composant** — `ProductImport.tsx` : UI drag-and-drop, prévisualisation, progression, rapport
4. **Route** — `App.tsx` : route protégée `/products/import`
5. **Navigation** — `AppLayout.tsx` : icône Upload + lien "Import CSV" dans Catalogue
6. **Documentation** — ce fichier

---

## 6. Flux UX

```
[Sélection fichier CSV]
        ↓
[Parsing + prévisualisation 5 premières lignes]
        ↓
[Clic "Lancer l'import"]
        ↓
[Import séquentiel ligne par ligne]
  → Validation locale (nom requis, prix >= 0, condition valide)
  → POST /module/product_api/productcreate
  → Mise à jour barre de progression
        ↓
[Rapport : succès / erreurs par ligne]
        ↓
[Bouton "Nouvel import" pour recommencer]
```

---

## 7. Validation des données

| Champ | Règle |
|-------|-------|
| `name` | Non vide — erreur bloquante si absent |
| `price` | Nombre >= 0 — erreur bloquante si invalide |
| `condition` | Doit être `new`, `used`, `refurbished` ou vide (alors mis à `new`) |
| `id_category` | Tente de parser la 1ère catégorie comme entier ; utilise 2 par défaut |

En cas d'erreur de validation, la ligne est marquée en erreur et l'import continue avec la suivante.

---

## 8. Problèmes connus et solutions

| Problème | Solution |
|----------|----------|
| `id_category` est un nom texte dans le CSV ("iPods", "Laptops"…) | On tente `parseInt()` ; si ce n'est pas un nombre, on utilise la catégorie ID 2 (défaut PrestaShop). Pour mapper les noms, il faudrait un endpoint `/productlist?name=...` pour retrouver l'ID. |
| CORS entre frontend et module PrestaShop | Proxy Vite `/module` → `http://127.0.0.1:8080` avec Basic Auth injectée |
| HTML dans `description` / `summary` | Transmis tel quel à l'API — PrestaShop le gère nativement |
| Ligne vide en fin de CSV | Filtrée par `parseCSV` (filtre sur `name !== ''`) |

---

## 9. Instructions pour tester

### Prérequis
- PrestaShop fonctionnel sur `http://127.0.0.1:8080`
- Module `product_api` installé et activé
- Clé WebService valide dans `.env` (`VITE_PRESTASHOP_API_KEY`)

### Test complet

```bash
# 1. Démarrer le serveur de développement
npm run dev

# 2. Ouvrir http://localhost:5173 dans le navigateur
# 3. Se connecter avec les identifiants admin
# 4. Cliquer sur "Import CSV" dans la sidebar (section Catalogue)
# 5. Glisser-déposer products_import.csv ou cliquer pour parcourir
# 6. Vérifier l'aperçu des 5 premières lignes
# 7. Cliquer "Lancer l'import"
# 8. Observer la barre de progression
# 9. Lire le rapport final
```

### Vérification des produits créés

```bash
# Via l'API module
curl -u 7Q4NKLRMB4FFXGEWRITAZ8EDZDP2RSKG: \
  http://127.0.0.1:8080/module/product_api/productlist

# Ou dans PrestaShop Back-Office
# Catalogue → Produits
```

### Test avec un CSV invalide

Pour tester la gestion d'erreurs, modifier une ligne du CSV :
- Supprimer le nom d'un produit → erreur "Name requis"
- Mettre un prix négatif ou non numérique → erreur "Price invalide"
- Mettre une condition invalide (ex: "excellent") → erreur "Condition invalide"
