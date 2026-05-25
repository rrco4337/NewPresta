# Validations des imports CSV — État des lieux

> Fichiers analysés :
> - `src/services/csvImportService.ts` — Import produits format PrestaShop
> - `src/services/importValidationService.ts` — Validations partagées (en-têtes, dates, montants)
> - `src/services/fichierImportService.ts` — Import 3 fichiers + ZIP images

---

## Table des matières

1. [Validations communes (partagées par tous les imports)](#1-validations-communes)
2. [Import Produits — csvImportService](#2-import-produits--csvimportservice)
3. [Fichier 1 — Produits](#3-fichier-1--produits)
4. [Fichier 2 — Déclinaisons & Stock](#4-fichier-2--déclinaisons--stock)
5. [Fichier 3 — Clients & Commandes](#5-fichier-3--clients--commandes)
6. [Images ZIP](#6-images-zip)
7. [Tableau de synthèse](#7-tableau-de-synthèse)
8. [Légende des comportements](#8-légende-des-comportements)

---

## 1. Validations communes

Ces règles s'appliquent à tous les imports via `importValidationService.ts`.

### 1.1 Lecture du fichier

| Règle | Comportement |
|---|---|
| BOM UTF-8 (`0xFEFF`) en début de fichier | Supprimé automatiquement |
| Fichier encodé en Windows-1252 (latin-1) | Détecté via le caractère `U+FFFD` (remplacement UTF-8), re-décodé en `windows-1252` |
| Séparateur de colonnes | Détecté automatiquement parmi `,` `;` `\t` (comptage hors guillemets) |
| Guillemets dans une cellule | Gérés (`""` → `"` à l'intérieur d'un champ entre guillemets) |
| Lignes entièrement vides | Ignorées silencieusement |

### 1.2 Validation des en-têtes — `validateHeaders()`

> Fichier : `importValidationService.ts` ligne 66  
> Comportement : **bloquant** — si des erreurs existent, l'import de ce fichier est arrêté immédiatement.

| Règle | Message d'erreur |
|---|---|
| Colonne inconnue (pas dans les specs) | `Colonne inconnue : "X"` |
| Colonne inconnue mais faute de frappe probable (distance Levenshtein ≤ 3) | `Colonne inconnue : "X" — vouliez-vous écrire "Y" ?` |
| Colonne obligatoire absente de l'en-tête | `Colonne obligatoire manquante : "X" (attendu dans l'en-tête, ligne 1)` |

> La détection de fautes de frappe compare chaque en-tête reçu contre l'ensemble des noms canoniques et aliases connus.

### 1.3 Validation de date — `validateDateField()`

> Fichier : `importValidationService.ts` ligne 122

| Règle | Comportement |
|---|---|
| Champ vide | Toujours accepté (date optionnelle) |
| Format `DD/MM/YYYY` ou `DD.MM.YYYY` | ✅ Accepté |
| Format `YYYY-MM-DD` ou `YYYY/MM/DD` | ✅ Accepté (priorité maximale — non ambigu) |
| Format avec heure `YYYY-MM-DD HH:MM:SS` | ✅ Accepté |
| Années sur 2 chiffres (ex : `24`) | Converties : `>= 70` → `19XX`, `< 70` → `20XX` |
| Mois hors `[1–12]` ou jour hors `[1–31]` | ❌ Erreur : `date invalide` |
| Date incohérente (ex : 31 février) | ❌ Erreur détectée par vérification calendrier |
| Tout autre format non reconnu | ❌ `"date invalide "X". Formats acceptés : DD/MM/YYYY, YYYY-MM-DD ou MM/DD/YYYY"` |

### 1.4 Validation de montant — `validatePositiveAmount()`

> Fichier : `importValidationService.ts` ligne 144

| Règle | Comportement |
|---|---|
| Champ vide + champ requis | ❌ `"montant manquant (valeur obligatoire)"` |
| Champ vide + champ optionnel | ✅ Accepté (pas d'erreur) |
| Valeur non numérique | ❌ `"valeur non numérique "X""` |
| Valeur `<= 0` | ❌ `"le montant doit être strictement positif"` |
| Virgule décimale (format français : `12,50`) | ✅ Convertie en `12.50` avant parse |
| Symbole `%` présent (ex : `20%`) | ✅ Supprimé avant parse |

---

## 2. Import Produits — csvImportService

> Fichier : `src/services/csvImportService.ts`  
> Accès : page **Import CSV Produits** (`/products/import`)  
> Format attendu : CSV PrestaShop standard, séparateur `;`, colonnes à positions fixes

### 2.1 Colonnes attendues (positions fixes)

| Position | Nom | Obligatoire |
|---|---|---|
| 0 | `id` | Non |
| 1 | `active` | Non |
| 2 | `name` | **Oui** |
| 3 | `categories` | Non (warning si textuelle) |
| 4 | `price` (HT) | **Oui** |
| 5 | `tax_rules_id` | **Oui** |
| 6 | `wholesale_price` | Non |
| 12 | `reference` | Non (mais utilisée pour doublon) |
| 22 | `weight` | Non |
| 25 | `quantity` | Non |
| 33 | `summary` | Non |
| 34 | `description` | Non |
| 51 | `condition` | Non |

### 2.2 Validations ligne par ligne — `validateRow()`

| Champ | Règle | Sévérité |
|---|---|---|
| `name` | Non vide | ❌ Erreur bloquante |
| `price` (HT) | Numérique, `>= 0` (0 accepté) | ❌ Erreur bloquante |
| `price` | Non vide | ❌ Erreur bloquante |
| `price` | Pas négatif | ❌ Erreur bloquante |
| `wholesale_price` | Si renseigné : numérique et `>= 0` | ❌ Erreur bloquante |
| `quantity` | Si renseignée : entier `>= 0` | ❌ Erreur bloquante |
| `tax_rules_id` | Non vide, entier, `> 0` | ❌ Erreur bloquante |

### 2.3 Validations globales du fichier — `validateAllRows()`

| Règle | Sévérité |
|---|---|
| Référence (`reference`) en double dans le CSV | ❌ Erreur bloquante avec numéro de ligne de la première occurrence |
| Catégorie textuelle (non numérique) | ⚠️ Warning : `"sera créée automatiquement"` |

> **Comportement à l'import** : les lignes en erreur sont ignorées, les autres sont importées. Une catégorie textuelle est créée automatiquement si elle n'existe pas.

---

## 3. Fichier 1 — Produits

> Fonction : `prevalidateFichier1Internal()` — `fichierImportService.ts` ligne 1248  
> Accès : page **Import Fichiers** (`/import/fichiers`)

### 3.1 Colonnes attendues

| Colonne canonique | Aliases acceptés | Obligatoire |
|---|---|---|
| `nom` | `name` | **Oui** |
| `reference` | `référence`, `ref` | **Oui** |
| `prix_ttc` | `prix ttc`, `price_ttc` | **Oui** |
| `taxe` | `taux_tva`, `tva`, `tax` | **Oui** |
| `categorie` | `catégorie`, `category` | **Oui** |
| `prix_achat` | `prix achat`, `wholesale_price` | **Oui** |
| `date_availability_produit` | `date_produit`, `date produit`, `date` | Non |

### 3.2 Validations ligne par ligne

| Champ | Règle | Sévérité |
|---|---|---|
| `nom` | Non vide | ❌ Bloquant |
| `reference` | Non vide | ❌ Bloquant |
| `prix_ttc` | Strictement `> 0`, numérique, non vide | ❌ Bloquant |
| `prix_achat` | Strictement `> 0`, numérique, non vide | ❌ Bloquant |
| `taxe` | Si renseignée : numérique (accepte `%` et virgule) | ❌ Bloquant |
| `date_availability_produit` | Si renseignée : date valide (formats flexibles) | ❌ Bloquant |
| `reference` dans le fichier | Pas de doublon | ❌ Bloquant |
| `reference` dans PrestaShop | **Ne doit PAS exister** déjà | ❌ Bloquant (appel API) |

> **Ordre des vérifications** : en-têtes → ligne par ligne → doublons → existence API.  
> Si les en-têtes sont invalides, tout le fichier est rejeté sans aller plus loin.

---

## 4. Fichier 2 — Déclinaisons & Stock

> Fonction : `prevalidateFichier2Internal()` — `fichierImportService.ts` ligne 1335

### 4.1 Colonnes attendues

| Colonne canonique | Aliases acceptés | Obligatoire |
|---|---|---|
| `reference` | `référence`, `ref` | **Oui** |
| `stock_initial` | `stock`, `quantite`, `qty`, `stock initial` | **Oui** |
| `specificité` | `specificite`, `specifite` | Non |
| `karazany` | _(aucun)_ | Non |
| `prix_vente_ttc` | `prix_ttc`, `prix vente ttc`, `prix vente` | Non |

### 4.2 Validations ligne par ligne

| Champ | Règle | Sévérité |
|---|---|---|
| `reference` | Non vide | ❌ Bloquant |
| `stock_initial` | Si renseigné : entier (pas de décimale), `>= 0` | ❌ Bloquant |
| `prix_vente_ttc` | Si renseigné : strictement `> 0`, numérique | ❌ Bloquant |
| `specificité` + `karazany` | Doivent être renseignés **ensemble** (ni l'un sans l'autre) | ❌ Bloquant |
| Déclinaison `reference-variant` | Pas de doublon dans le fichier | ❌ Bloquant |
| `reference` → produit dans PrestaShop | **Doit exister** dans PS ou dans le Fichier 1 | ❌ Bloquant (API) |
| `reference-variant` → déclinaison dans PS | **Ne doit PAS exister** dans PS | ❌ Bloquant (API) |

> **Dépendance inter-fichiers** : la référence produit est vérifiée d'abord dans les refs importées par le Fichier 1 (sans appel API), puis dans PrestaShop si absente.

---

## 5. Fichier 3 — Clients & Commandes

> Fonction : `prevalidateFichier3Internal()` — `fichierImportService.ts` ligne 1436

### 5.1 Colonnes attendues

| Colonne canonique | Aliases acceptés | Obligatoire |
|---|---|---|
| `date` | _(aucun)_ | **Oui** |
| `nom` | `name` | **Oui** |
| `email` | `mail`, `courriel` | **Oui** |
| `pwd` | `password`, `mot_de_passe` | **Oui** (si nouveau client) |
| `adresse` | `address`, `adresse_livraison` | **Oui** |
| `achat` | `commande`, `panier`, `achats` | **Oui** |
| `etat` | `statut`, `status`, `état` | Non |

### 5.2 Validations ligne par ligne

| Champ | Règle | Sévérité |
|---|---|---|
| `nom` | Non vide | ❌ Bloquant |
| `email` | Non vide | ❌ Bloquant |
| `email` | Format valide `^\S+@\S+\.\S+$` | ❌ Bloquant |
| `date` | Si renseignée : date valide (formats flexibles) | ❌ Bloquant |
| `pwd` | Requis **uniquement** si le client n'existe pas encore dans PS | ❌ Bloquant (vérification API) |
| `achat` | Au moins un produit valide dans la colonne | ❌ Bloquant |

### 5.3 Validation de la colonne `achat`

**Format attendu** : `[("REF";quantité;"variant"),("REF2";quantité;"")]`

| Règle | Sévérité |
|---|---|
| Format non reconnu (ne commence pas par `[`) | ❌ Bloquant — aucun produit trouvé |
| Référence produit vide dans un item | ❌ Bloquant |
| Quantité `<= 0` | ❌ Bloquant |
| Quantité non entière → défaut `1` | ⚠️ Silencieux (pas d'erreur, valeur remplacée) |
| Produit (`REF`) introuvable dans PS ou Fichier 1 | ❌ Bloquant (appel API) |
| Déclinaison (`REF-variant`) introuvable dans PS ou Fichier 2 | ❌ Bloquant (appel API) |

### 5.4 Colonne `etat` (statuts reconnus)

| Valeur dans le CSV | État PS résultant |
|---|---|
| `dans le panier` | État 1 — Dans le panier (pas de commande créée) |
| `paiement accepte` / `paiement accepté` | État 2 — Paiement accepté |
| `annule` / `annulé` | État 6 — Annulé |
| `livre` / `livré` | État 5 — Livré (déclenche déduction stock) |
| _(vide ou non reconnu)_ | État 2 par défaut |

---

## 6. Images ZIP

> Fonction : `prevalidateImagesZipInternal()` — `fichierImportService.ts` ligne 1536

| Règle | Sévérité |
|---|---|
| Archive ZIP vide ou sans image | ❌ Bloquant |
| Dossiers `__MACOSX` | Ignorés silencieusement |
| Extension invalide (pas `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) | Fichier ignoré |
| Nom de fichier vide (après suppression de l'extension) | ❌ Bloquant |
| Produit correspondant au nom du fichier introuvable dans PS ou Fichier 1 | ❌ Bloquant (appel API) |

> Le nom du fichier image (sans extension) est utilisé comme référence produit. Exemple : `T_01.jpg` → référence `T_01`.

---

## 7. Tableau de synthèse

| Validation | F1 Produits | F2 Déclinaisons | F3 Clients | CSV Standard | Images ZIP |
|---|:---:|:---:|:---:|:---:|:---:|
| En-têtes obligatoires présents | ✅ | ✅ | ✅ | ✅ | — |
| Détection fautes de frappe (Levenshtein) | ✅ | ✅ | ✅ | — | — |
| Encodage BOM / Latin-1 | ✅ | ✅ | ✅ | — | — |
| Champ `nom` non vide | ✅ | — | ✅ | ✅ | — |
| Champ `reference` non vide | ✅ | ✅ | — | — | — |
| Doublon de référence dans le fichier | ✅ | ✅ | — | ✅ | — |
| Prix TTC strictement > 0 | ✅ | — | — | ✅ | — |
| Prix achat strictement > 0 | ✅ | — | — | — | — |
| Prix vente TTC > 0 (si renseigné) | — | ✅ | — | — | — |
| Taxe numérique | ✅ | — | — | ✅ | — |
| Stock >= 0, entier | — | ✅ | — | ✅ | — |
| Email valide (regex) | — | — | ✅ | — | — |
| Date valide (formats flexibles) | ✅ | — | ✅ | — | — |
| specificité + karazany ensemble | — | ✅ | — | — | — |
| Format colonne `achat` | — | — | ✅ | — | — |
| Quantité achat > 0 | — | — | ✅ | — | — |
| Mot de passe si nouveau client | — | — | ✅ | — | — |
| **Référence produit DOIT exister dans PS** | — | ✅ | ✅ | — | ✅ |
| **Référence produit NE DOIT PAS exister dans PS** | ✅ | — | — | — | — |
| **Déclinaison NE DOIT PAS exister dans PS** | — | ✅ | — | — | — |
| **Déclinaison DOIT exister dans PS** | — | — | ✅ | — | — |
| Extension image valide | — | — | — | — | ✅ |

---

## 8. Légende des comportements

| Symbole | Signification |
|---|---|
| ❌ **Bloquant** | La ligne (ou le fichier entier si en-tête) est rejeté. L'import ne continue pas pour cet élément. |
| ⚠️ **Warning** | L'import continue. Un message informatif est affiché (ex : catégorie créée automatiquement). |
| ✅ **Silencieux** | La règle est appliquée sans message (ex : strip BOM, quantité invalide → défaut 1). |
| **Appel API** | La validation nécessite un appel réseau vers PrestaShop. Ces vérifications sont mises en cache pour éviter les doublons d'appels. |
| **Inter-fichiers** | La validation croise les données entre Fichier 1, 2 et 3 (ex : une ref importée en F1 est reconnue en F2 sans appel API). |
