# Import & Nettoyage CSV — Catalogue PrestaShop

Documentation de l'implémentation des imports CSV et du nettoyage par type d'entité.

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/services/otherImportService.ts` | Parsers, importeurs, et fonctions de nettoyage pour toutes les entités |
| `src/components/CatalogImport.tsx` | Page d'import unifiée (sélecteur de type + import + nettoyage) |
| `src/services/csvImportService.ts` | Import produits (existant, inchangé) |
| `src/components/ProductImport.tsx` | Page d'import produits — bouton de nettoyage ajouté |

Route : `/import` → `CatalogImport`  
Route : `/products/import` → `ProductImport`

---

## Entités supportées

| Type | Endpoint API | Fichier CSV attendu |
|---|---|---|
| Catégories | `POST /categories` | `categories_import.csv` |
| Clients | `POST /customers` | `customers_import.csv` |
| Adresses | `POST /addresses` | `addresses_import.csv` |
| Fournisseurs | `POST /suppliers` | `suppliers_import.csv` |
| Marques | `POST /manufacturers` | `brands_import.csv` |
| Déclinaisons | `POST /combinations` | `combinations_import.csv` |
| Produits | `POST /products` | *(géré par csvImportService)* |

---

## Import — fonctionnement général

Pour chaque entité, le service suit le même pipeline :

```
CSV (File)
  → parseCsvLines()          slice(1) = ignore header, split(';')
  → parse[Entity]Csv()       mapping colonnes → objet typé
  → build[Entity]Xml()       objet → XML PrestaShop Webservice
  → POST /endpoint           création via API
  → ImportResult[]           { rowIndex, label, success, id?, error? }
```

---

## Détail par entité

### 1. Catégories

**Colonnes lues (index ; dans le CSV) :**

| Index | Champ |
|---|---|
| 1 | Active (0/1) |
| 2 | Name * |
| 3 | Parent category |
| 5 | Description |
| 6 | Meta title |
| 7 | Meta keywords |
| 8 | Meta description |
| 9 | URL rewritten |

**Particularités :**
- `id_parent` : `"Home"` → 2, `"Root"` → 1, sinon parseInt
- `link_rewrite` : utilise la colonne 9 si remplie, sinon slugifie le nom

**XML envoyé :**
```xml
<category>
  <active><![CDATA[1]]></active>
  <id_parent><![CDATA[2]]></id_parent>
  <name><language id="1"><![CDATA[iPods]]></language></name>
  <description><language id="1"><![CDATA[...]]></language></description>
  <link_rewrite><language id="1"><![CDATA[music-ipods]]></language></link_rewrite>
  <meta_title><language id="1"><![CDATA[...]]></language></meta_title>
  <meta_keywords><language id="1"><![CDATA[...]]></language></meta_keywords>
  <meta_description><language id="1"><![CDATA[...]]></language></meta_description>
</category>
```

---

### 2. Clients

**Colonnes lues :**

| Index | Champ |
|---|---|
| 1 | Active (0/1) |
| 2 | Titles ID (1=M, 2=Mme) |
| 3 | Email * |
| 4 | Password * |
| 5 | Birthday (yyyy-mm-dd) |
| 6 | Last Name * |
| 7 | First Name * |
| 8 | Newsletter (0/1) |
| 9 | Opt-in (0/1) |
| 12 | Default group ID |

**Particularités :**
- Le mot de passe est transmis tel quel depuis le CSV (format PrestaShop natif)
- `id_default_group` : 3 = Customer par défaut

**XML envoyé :**
```xml
<customer>
  <active><![CDATA[1]]></active>
  <id_gender><![CDATA[1]]></id_gender>
  <email><![CDATA[peter@example.com]]></email>
  <passwd><![CDATA[123456789]]></passwd>
  <birthday><![CDATA[1987-04-02]]></birthday>
  <lastname><![CDATA[Pan]]></lastname>
  <firstname><![CDATA[Peter]]></firstname>
  <newsletter><![CDATA[1]]></newsletter>
  <optin><![CDATA[0]]></optin>
  <id_default_group><![CDATA[3]]></id_default_group>
</customer>
```

---

### 3. Adresses

**Colonnes lues :**

| Index | Champ |
|---|---|
| 1 | Alias * |
| 2 | Active (0/1) |
| 3 | Customer e-mail * |
| 7 | Company |
| 8 | Lastname * |
| 9 | Firstname * |
| 10 | Address 1 * |
| 11 | Address 2 |
| 12 | Zipcode * |
| 13 | City * |
| 14 | Country * |
| 17 | Phone |
| 18 | Mobile Phone |

**Résolutions avant import (caches chargés une seule fois) :**
- **Pays** : `GET /countries?display=[id,name]` → map `nom_pays → id_country`
- **Client** : `GET /customers?display=[id,email]` → map `email → id_customer`

Si le pays est introuvable dans le cache, la ligne est en erreur.  
Si l'email client est introuvable, `id_customer = 0` (adresse non liée à un client).

**XML envoyé :**
```xml
<address>
  <active><![CDATA[1]]></active>
  <deleted><![CDATA[0]]></deleted>
  <id_customer><![CDATA[1]]></id_customer>
  <id_country><![CDATA[21]]></id_country>
  <alias><![CDATA[Peter.Pan / New York]]></alias>
  <lastname><![CDATA[Pan]]></lastname>
  <firstname><![CDATA[Peter]]></firstname>
  <address1><![CDATA[360W, 42nd Street]]></address1>
  <postcode><![CDATA[12001]]></postcode>
  <city><![CDATA[New York]]></city>
  <phone><![CDATA[01 02 03 04 05]]></phone>
</address>
```

---

### 4. Fournisseurs

**Colonnes lues :**

| Index | Champ |
|---|---|
| 1 | Active (0/1) |
| 2 | Name * |
| 3 | Description |
| 4 | Meta title |
| 5 | Meta keywords |
| 6 | Meta description |

**XML envoyé :**
```xml
<supplier>
  <active><![CDATA[1]]></active>
  <name><![CDATA[Applestore]]></name>
  <description><language id="1"><![CDATA[...]]></language></description>
  <meta_title><language id="1"><![CDATA[...]]></language></meta_title>
  <meta_keywords><language id="1"><![CDATA[...]]></language></meta_keywords>
  <meta_description><language id="1"><![CDATA[...]]></language></meta_description>
</supplier>
```

---

### 5. Marques (Manufacturers)

**Colonnes lues :**

| Index | Champ |
|---|---|
| 1 | Active (0/1) |
| 2 | Name * |
| 3 | Description |
| 4 | Short description |
| 5 | Meta title |
| 6 | Meta keywords |
| 7 | Meta description |

**XML envoyé :**
```xml
<manufacturer>
  <active><![CDATA[1]]></active>
  <name><![CDATA[Apple]]></name>
  <description><language id="1"><![CDATA[...]]></language></description>
  <short_description><language id="1"><![CDATA[...]]></language></short_description>
  <meta_title><language id="1"><![CDATA[...]]></language></meta_title>
  <meta_keywords><language id="1"><![CDATA[...]]></language></meta_keywords>
  <meta_description><language id="1"><![CDATA[...]]></language></meta_description>
</manufacturer>
```

---

### 6. Déclinaisons (Combinations)

C'est l'entité la plus complexe. Elle nécessite 3 types d'appels API enchaînés.

**Colonnes lues :**

| Index | Champ |
|---|---|
| 0 | Product ID * |
| 1 | Attribute (Name:Type:Position)* |
| 2 | Value (Value:Position)* |
| 4 | Reference |
| 5 | EAN13 |
| 7 | Wholesale price |
| 8 | Impact on price (delta) |
| 10 | Quantity |
| 11 | Minimal quantity |
| 14 | Default (0/1) |
| 15 | Available date |

**Pipeline spécifique :**

```
Au démarrage de l'import (une seule fois) :
  GET /product_options?display=full     → cache nom_option → id
  GET /product_option_values?display=full → cache "optionId:valeur" → id

Pour chaque ligne :
  Parser "Color:color:0, Disk space:select:1" → [{name,type,position}, ...]
  Parser "Blue:0, 16GB:1"                     → [{value,position}, ...]

  Pour chaque attribut :
    getOrCreateOption(name, type, position)        → POST /product_options si absent
    getOrCreateOptionValue(optionId, value, pos)   → POST /product_option_values si absent

  POST /combinations avec les id_product_option_value résolus
```

**Parsing des specs :**
- Le séparateur entre attributs/valeurs est `", "` (virgule + espace)
- L'index de position est le dernier segment après `:`
- Le type d'option (color, select…) est le second segment avant la position

**XML envoyé :**
```xml
<combination>
  <id_product><![CDATA[1]]></id_product>
  <reference><![CDATA[RF-Nano-Blue-16GB]]></reference>
  <ean13><![CDATA[]]></ean13>
  <wholesale_price><![CDATA[100]]></wholesale_price>
  <price><![CDATA[40]]></price>  <!-- impact on price -->
  <minimal_quantity><![CDATA[1]]></minimal_quantity>
  <default_on><![CDATA[0]]></default_on>
  <associations>
    <product_option_values>
      <product_option_value><id><![CDATA[3]]></id></product_option_value>
      <product_option_value><id><![CDATA[7]]></id></product_option_value>
    </product_option_values>
  </associations>
</combination>
```

---

## Nettoyage — fonctionnement général

Chaque bouton de nettoyage effectue :

```
GET /endpoint?display=[id]    → liste de tous les IDs existants
  → filtre les IDs protégés (catégories 1 et 2)
  → pour chaque ID : DELETE /endpoint/{id}
  → retourne CleanResult { total, deleted, errors }
```

**Fonctions exportées :**

| Fonction | Endpoint | IDs protégés |
|---|---|---|
| `cleanCategories(cb?)` | `DELETE /categories/{id}` | 1 (Root), 2 (Home) |
| `cleanCustomers(cb?)` | `DELETE /customers/{id}` | — |
| `cleanAddresses(cb?)` | `DELETE /addresses/{id}` | — |
| `cleanSuppliers(cb?)` | `DELETE /suppliers/{id}` | — |
| `cleanBrands(cb?)` | `DELETE /manufacturers/{id}` | — |
| `cleanCombinations(cb?)` | `DELETE /combinations/{id}` | — |
| `cleanProducts(cb?)` | `DELETE /products/{id}` | — |

Le paramètre optionnel `cb` est un callback de progression `(done: number, total: number) => void`.

**Type de retour :**
```typescript
interface CleanResult {
  total:   number;  // entrées trouvées et tentées
  deleted: number;  // suppressions réussies
  errors:  number;  // suppressions échouées
}
```

---

## UI — CatalogImport (`/import`)

La page est composée de 4 zones :

1. **Sélecteur de type** — onglets (Catégories, Clients, Adresses, Fournisseurs, Marques, Déclinaisons)
2. **Drag-drop zone** — dépose ou sélection du fichier CSV
3. **Aperçu** — tableau des 5 premières lignes (colonnes adaptées au type)
4. **Zone de nettoyage** — bouton rouge, confirmation, barre de progression, résultat

### Flux d'import

```
idle → (fichier sélectionné) → preview → (clic Lancer) → importing → done
```

### Flux de nettoyage (indépendant du flux d'import)

```
idle → (clic Nettoyer + confirmation) → running → done → (clic Réinitialiser) → idle
```

---

## UI — ProductImport (`/products/import`)

Même flux que CatalogImport pour l'import.  
Zone de nettoyage identique en bas de page, pour les produits uniquement.
