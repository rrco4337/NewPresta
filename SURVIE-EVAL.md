# 📖 DOCUMENTATION DE SURVIE POUR ÉVALUATION
*PrestaShop React App - Survival Guide*

---

## 1️⃣ ARCHITECTURE DU PROJET

### Structure des dossiers

```
src/
├── components/       → Composants React (pages + UI)
├── services/         → Logique métier + appels API
├── contexts/         → Global State Management (Auth, Cart, Customer)
├── hooks/            → Hooks personnalisés (useDashboardData)
├── types/            → Types TypeScript globaux
├── utils/            → Fonctions utilitaires (formatage, badges)
├── styles/           → CSS global
└── assets/           → Images, ressources
```

### Rôle des dossiers principaux

| Dossier | Responsabilité | Exemple |
|---------|---|---|
| **components/** | Affichage + logique d'interface | ProductList.tsx, CartPage.tsx |
| **services/** | Appels API + transformations données | produitApi.ts, authService.ts |
| **contexts/** | État global (Auth, Panier, Client) | AuthContext.tsx, CartContext.tsx |
| **hooks/** | Logique réutilisable complexe | useDashboardData.ts |
| **utils/** | Petites fonctions utilitaires | formatCurrency.ts, productBadges.ts |
| **types/** | Interfaces TypeScript du domaine | dashboard.types.ts |

### Flow général de l'application

```
UserSelectPage (/)
    ↓
    ├─→ Login (/login) → AuthContext (login) → redirects to /products
    ├─→ BackOffice (/products, /orders, etc.) 
    │   • Protected by ProtectedRoute
    │   • AppLayout avec Sidebar
    │   • AuthContext + CartContext + CustomerContext
    └─→ FrontOffice (/shop, /shop/:id)
        • ShopLayout (pas de sidebar)
        • Accès produits + panier
        • CustomerContext pour checkout
```

### Routing (Routes principales)

```typescript
/ → UserSelectPage
/login → Login
/shop → ShopHome (frontoffice public)
/shop/:id → ProductDetail
/products → ProductList (protected)
/products/add → ProductCreate (protected)
/products/:id → ProductDetail admin (protected)
/products/import → ProductImport (protected)
/import → CatalogImport (protected)
/import/fichiers → FichiersImport (protected)
/orders → OrderList (protected)
/dashboard → DashboardPage (protected)
/audit/import → ImportAudit (protected)
/reset → DataReset (protected)
/cart → CartPage (frontoffice)
/checkout → CheckoutPage (frontoffice)
/order-confirmation → OrderConfirmation (frontoffice)
/my-orders → MyOrders (frontoffice)
```

### State Management

| Context | Responsable | Données | Hook |
|---------|---|---|---|
| **AuthContext** | Authentification admin | user, isLoading, login(), logout() | `useAuth()` |
| **CartContext** | Panier client | items, totalPrice, addItem(), removeItem() | `useCart()` |
| **CustomerContext** | Infos client | customerId, email, addresses | `useCustomer()` |

**Pas de Redux, pas de Zustand** → Contexts simples suffit.

### Services API (11 fichiers)

| Service | Rôle | Base URL |
|---------|------|----------|
| authService | Login admin, tokens CSRF | `/{adminDir}/index.php` |
| produitApi | CRUD produits | `/api` (REST XML) |
| orderService | Commandes, transitions états | `/api` |
| cartSyncService | Sync panier client/serveur | `/api` |
| stockService | Mouvements stock, lignes stock | `/api` + `/stockapi.php` |
| shopService | Produits/catégories front-office | `/api` |
| customerService | Clients, adresses | `/api` |
| csvImportService | Parse + valide CSV produits | - (local) |
| fichierImportService | Import fichiers 1/2/3 (stock) | `/api` |
| otherImportService | Catégories, clients, fournisseurs | `/api` |
| taxService | Taux de taxe | `/api` |

### Hooks personnalisés

```typescript
// 1. useDashboardData (src/hooks/useDashboardData.ts)
const { data, loading, error, refetch } = useDashboardData(filters, autoRefreshIntervalMs);
// → Aggrege les commandes par jour

// Pas d'autres hooks personnalisés
// Utiliser useAuth, useCart, useCustomer des contextes
```

### Utilitaires (très peu)

- **formatCurrency.ts** → `formatCurrency(amount: number): string`
- **productBadges.ts** → `parseAvailabilityDate()`, détermine HOT/NEW badges

---

## 2️⃣ CARTE DES COMPOSANTS REACT

### Composants principaux

#### **AppLayout** (src/components/AppLayout.tsx)
- **Rôle**: Layout backoffice avec sidebar navigable
- **Props**: `pageTitle: string`, `children: ReactNode`
- **État**: `sidebarOpen: boolean` (toggle mobile)
- **Dépendances**: React Router, AuthContext
- **Composants enfants**: Sidebar (navigation) + main content
- **Fichiers liés**: AppLayout.css, AppLayout.tsx
- **Usage**: Wrapper de toutes les pages backoffice

#### **ShopLayout** (src/components/ShopLayout.tsx)
- **Rôle**: Layout frontoffice (pas de sidebar)
- **Props**: `children: ReactNode`
- **Dépendances**: React Router, CartContext, CustomerContext
- **Usage**: Wrapper pages shop (/shop, /shop/:id, /cart, /checkout)

#### **ProductList** (src/components/ProductList.tsx)
- **Rôle**: Tableau de produits backoffice avec filtres
- **Props**: none
- **État**: 
  - `products: Product[]`
  - `filters: Filters` (idMin, idMax, name, category, price, quantity, status)
  - `loading`, `error`
- **Dépendances**: productService.getAllProducts(), productService.deleteProduct()
- **Usage**: Page `/products` (protected)
- **Actions**: Filtrer, trier, supprimer, éditer (clic → `/products/{id}`)

#### **ProductDetail** (src/components/ProductDetail.tsx)
- **Rôle**: Affiche + édite 1 produit
- **Props**: none (prend l'ID de l'URL)
- **Dépendances**: productService.getProduct(), productService.updateProduct()
- **Usage**: Pages `/products/:id` (backoffice) et `/shop/:id` (frontoffice)

#### **CartPage** (src/components/CartPage.tsx)
- **Rôle**: Affiche panier client
- **Dépendances**: `useCart()`, CartContext (items, updateQty, removeItem)
- **Actions**: Modifier qtés, supprimer articles, procéder au checkout
- **Usage**: Page `/cart` (frontoffice)

#### **CheckoutPage** (src/components/CheckoutPage.tsx)
- **Rôle**: Paiement et création commande
- **Dépendances**: `useCustomer()`, `useCart()`, orderService
- **État**: adresse livraison, adresse facturation, validation formule
- **Usage**: Page `/checkout` (frontoffice protégé)

#### **OrderList** (src/components/OrderList.tsx)
- **Rôle**: Tableau des commandes avec filtres
- **Dépendances**: orderService.getAllOrders()
- **Actions**: Afficher détails, changer statut (1→2→6)
- **Usage**: Page `/orders` (backoffice protégé)

#### **StockUpdate** (src/components/StockUpdate.tsx)
- **Rôle**: Interface pour modifier stocks manuellement
- **Dépendances**: stockService.getLines(), stockService.addStock(), stockService.removeStock()
- **État**: liste des lignes stock, quantity à ajouter/retirer
- **Usage**: Page `/stock/update` (backoffice)

#### **DashboardPage** (src/components/dashboardPage.tsx)
- **Rôle**: Tableau de bord avec graphiques
- **Dépendances**: `useDashboardData(filters)` (hook custom)
- **Graphiques**: Recharts pour afficher commandes/revenus par jour
- **Usage**: Page `/dashboard` (backoffice)

#### **FichiersImport** (src/components/FichiersImport.tsx)
- **Rôle**: Import de 3 fichiers CSV (stock + mouvements)
- **Fichiers**: fichier1.csv, fichier2.csv, fichier3.csv
- **Dépendances**: fichierImportService
- **Validation**: validateHeaders() + validateDateField() + validatePositiveAmount()
- **Usage**: Page `/import/fichiers` (backoffice)

#### **ImportAudit** (src/components/ImportAudit.tsx)
- **Rôle**: Vérification audit après import
- **État**: Résultats imports (OK/KO), liste d'erreurs
- **Usage**: Page `/audit/import` (backoffice)

#### **Login** (src/components/Login.tsx)
- **Rôle**: Connexion admin
- **Dépendances**: `useAuth()`, authService.login()
- **Usage**: Page `/login`

#### **ProtectedRoute** (src/components/ProtectedRoute.tsx)
- **Rôle**: HOC qui vérifie auth avant d'afficher page
- **Props**: `children: ReactNode`
- **Comportement**: Redirige `/login` si pas authentifié
- **Usage**: Wrapper toutes les routes backoffice

### Composants UI réutilisables

| Composant | Rôle | Props |
|-----------|------|-------|
| **ProductBadge** | Badge HOT/NEW | `productId`, `createdDate` |

---

## 3️⃣ FONCTIONS UTILITAIRES IMPORTANTES

### Tableau référence des fonctions

| Fonction | Fichier | Rôle | Params | Return | Exemple |
|----------|---------|------|--------|--------|---------|
| **formatCurrency** | utils/formatCurrency.ts | Format EUR | amount: number | string | `formatCurrency(150.50)` → "150,50 €" |
| **parseAvailabilityDate** | utils/productBadges.ts | Parse date ISO/local | value?: string | Date \| null | `parseAvailabilityDate("2024-01-15")` |
| **parseCSV** | services/csvImportService.ts | Parse CSV texte | content: string | CsvRow[] | `parseCSV(csvText)` → [{col1, col2}] |
| **validateRow** | services/csvImportService.ts | Valide 1 ligne CSV | row: CsvRow, rowIndex | string[] (errors) | `validateRow(row, 0)` → ["col manquante"] |
| **validateAllRows** | services/csvImportService.ts | Valide tout CSV | rows: CsvRow[] | RowValidation[] | `validateAllRows(rows)` |
| **mapRowToProduct** | services/csvImportService.ts | CSV → Product | row: CsvRow, categoryId? | Partial<Product> | Map row to product DTO |
| **isTransitionAllowed** | services/orderService.ts | Vérifie transition état | oldState, newState | boolean | `isTransitionAllowed(1, 2)` → true |
| **PS_STATE_LABELS** | services/orderService.ts | Map état → label | key: number | string | `PS_STATE_LABELS[2]` → "✅ Paiement effectué" |
| **formatPrice** | services/shopService.ts | Format prix TTC | price: number | string | `formatPrice(100.5)` → "100,50 €" |
| **stockStatus** | services/shopService.ts | Status stock | qty: number | {label, level} | `stockStatus(0)` → {label: "Out", level: "out"} |
| **fetchCustomerName** | services/orderService.ts | Récupère nom client | customerId: string | Promise<string> | `fetchCustomerName("42")` |
| **extractAdminToken** | services/authService.ts | Extrait token CSRF | redirectUrl: string | string | `extractAdminToken(url)` |
| **validateHeaders** | services/importValidationService.ts | Valide headers CSV | headers[], specs[] | string[] (errors) | Verifie colonnes requises |
| **validateDateField** | services/importValidationService.ts | Valide date | value, fieldName, rowIndex | string[] (errors) | Valide format ISO |
| **validatePositiveAmount** | services/importValidationService.ts | Valide montant | value, fieldName, rowIndex | string[] (errors) | Verifie > 0 |
| **clearCategoryCache** | services/csvImportService.ts | Vide cache catégories | - | void | `clearCategoryCache()` |

### Exemples concrets du projet

```typescript
// 1. Formatage devise
import { formatCurrency } from '@/utils/formatCurrency';
const priceStr = formatCurrency(order.totalRevenue); // "1 234,56 €"

// 2. Validation dates
import { parseAvailabilityDate } from '@/utils/productBadges';
const availDate = parseAvailabilityDate("2024-12-31T10:30:00Z");

// 3. Parse CSV produits
import { parseCSV, validateAllRows } from '@/services/csvImportService';
const rows = parseCSV(fileContent);
const validations = validateAllRows(rows);
const errors = validations.filter(v => v.errors.length > 0);

// 4. Transitions états commande
import { isTransitionAllowed, PS_STATE_LABELS } from '@/services/orderService';
if (isTransitionAllowed(oldState, newState)) {
  await orderService.updateOrderState(orderId, newState);
}
const label = PS_STATE_LABELS[newState]; // "✅ Paiement effectué"

// 5. Format prix + status stock
import { formatPrice, stockStatus } from '@/services/shopService';
const priceStr = formatPrice(product.priceTtc); // "89,99 €"
const status = stockStatus(product.quantity); // {label: "En stock", level: "ok"}
```

---

## 4️⃣ HOOKS IMPORTANTS

### Contexte Hooks (Global State)

#### **useAuth()**
```typescript
import { useAuth } from '@/contexts/AuthContext';

const { user, isLoading, login, logout } = useAuth();
// user: { email: string, adminToken: string } | null
// isLoading: boolean (pendant restauration session)
// login: (email, password) => Promise<void>
// logout: () => Promise<void>
```

#### **useCart()**
```typescript
import { useCart } from '@/contexts/CartContext';

const {
  items,              // CartItem[]
  addItem,            // (item, qty?) => void
  removeItem,         // (id, attributeId?) => void
  updateQty,          // (id, qty, attributeId?) => void
  clear,              // () => void
  totalPrice,         // number (TTC)
  totalPriceHt,       // number
  totalTax,           // number
  totalItems,         // number
  remoteCartId,       // string | null
  loadingRemoteCart,  // boolean
} = useCart();
```

#### **useCustomer()**
```typescript
import { useCustomer } from '@/contexts/CustomerContext';

const {
  customerId,         // string | null
  email,              // string
  addresses,          // Address[]
  loadCustomer,       // (id: string) => Promise<void>
  isLoading,          // boolean
} = useCustomer();
```

### Hook personnalisé

#### **useDashboardData()**
```typescript
import { useDashboardData } from '@/hooks/useDashboardData';

const filters = { selectedDate: "2024-01-15" };
const { data, loading, error, refetch } = useDashboardData(filters, 60000);

// data: {
//   stats: { totalOrders, totalRevenue, averageOrderValue }
//   dailyStats: DailyOrderStat[]
// } | null
```

---

## 5️⃣ FLUX DES DONNÉES

### Cycle d'une requête API

```
Component
    ↓
    useEffect() ou onClick()
    ↓
    Service (axios call + transform)
    ↓
    API REST XML (PrestaShop)
    ↓
    Response XML
    ↓
    Parse XML → TypeScript object
    ↓
    Component setState()
    ↓
    Render
```

### Exemple concret: Chargement produits

```
ProductList.tsx
    ↓ useEffect()
    ↓
productService.getAllProducts(filters)
    ↓ axios GET /api/products?...
    ↓
API PrestaShop
    ↓
XML response
    ↓ parseXML() + PrestashopMapper.mapToFrontend()
    ↓
Product[]
    ↓
setProducts() + setState
    ↓
Render tableau
```

### Où modifier les données

| Type de changement | Fichier | Fonction |
|-------------------|---------|----------|
| Apparence/layout | components/\*.tsx | Dans JSX/CSS |
| Récupération data | services/\*.ts | Dans la fonction API |
| Validation input | services/importValidationService.ts | validateXxx() |
| Transformation données | services/\*Mapper/mapToFrontend | Dans le mapper |
| État global | contexts/\*.tsx | Dans Provider |
| Logique métier complexe | hooks/\*.ts | Dans le hook |

### Où sont les appels API

```
Services (src/services/)
├── authService.ts          ← Login admin (POST /{adminDir}/index.php)
├── produitApi.ts           ← CRUD produits (GET/POST/PUT/DELETE /api/products)
├── orderService.ts         ← Commandes (GET /api/orders)
├── cartSyncService.ts      ← Panier client (POST /api/carts)
├── stockService.ts         ← Mouvements stock (GET/POST /api + /stockapi.php)
├── shopService.ts          ← Produits front (GET /api/products)
├── customerService.ts      ← Clients (GET/POST /api/customers)
├── csvImportService.ts     ← Parse CSV (local only)
├── fichierImportService.ts ← Import fichiers (POST /api/...)
├── otherImportService.ts   ← Catégories/clients/etc (DELETE/POST /api)
├── taxService.ts           ← Taux taxe (GET /api/tax_rules_groups)
├── dashboardApi.ts         ← Commandes pour dashboard (GET /api/orders)
└── importAuditService.ts   ← Vérification audit (GET /api/...)
```

### Où les états sont stockés

| Donnée | Location | Persistence |
|--------|----------|-------------|
| Utilisateur auth | AuthContext | localStorage (`ps_admin_user`) |
| Panier client | CartContext | sessionStorage (`shopCart`) |
| Infos client | CustomerContext | memory (session) |
| Dashboard filters | Component state | memory |
| Produits affichés | Component state | memory |

---

## 6️⃣ ENDROITS CRITIQUES À CONNAÎTRE

### 🔴 Fichiers sensibles (une modification peut casser l'app)

| Fichier | Criticité | Raison | Pièges |
|---------|-----------|--------|--------|
| **App.tsx** | 🔴 CRITIQUE | Toutes les routes | Modifier une route → page 404 |
| **ProtectedRoute.tsx** | 🔴 CRITIQUE | Contrôle d'accès | Retirer la vérification → accès non-auth |
| **AuthContext.tsx** | 🔴 CRITIQUE | Auth globale | Perte session si bugué |
| **CartContext.tsx** | 🔴 CRITIQUE | Panier client | Perte commande en cours |
| **produitApi.ts** | 🔴 HAUTE | Tous les produits | Mapper XML cassé → tableau vide |
| **orderService.ts** | 🔴 HAUTE | Transitions états | États invalides → erreur BDD |
| **stockService.ts** | 🔴 HAUTE | Stock critique | Quantités négatives |
| **csvImportService.ts** | 🟠 MOYEN | Import produits | Validation insuffisante → mauvaises données |
| **checkoutPage.tsx** | 🟠 MOYEN | Création commande | Valider adresses/paiement |

### 🔗 Dépendances importantes

```
React 19.2.5          → Hooks, Context
React Router 7.0.0    → Navigation
Axios 1.16.0          → Requêtes HTTP
Recharts 3.8.1        → Graphiques dashboard
jszip 3.10.1          → Export/import ZIP
```

**⚠️ Pas de Redux → State Management simple avec Contexts**

### ⚡ Logique métier importante

| Concept | Localisation | Logique |
|---------|---|---------|
| **Transitions états comde** | orderService.ts | 1→2→6 uniquement (ou 2→6, 6→2) |
| **Mouvement stock** | StockService.ts | Track quantité avant/après |
| **Prix HT vs TTC** | shopService.ts, CartContext | Calcul avec taxe |
| **Panier persistant** | CartContext | sessionStorage sauf logout |
| **Auth tokens** | authService.ts | CSRF token from redirect URL |
| **CSV validation** | csvImportService.ts | Headers + types + dates |
| **Images produits** | produitApi.ts | URL: `/api/images/products/{id}/{imageId}` |

### 🚨 Endroits où modification = bug certain

```typescript
// ❌ NE PAS MODIFIER SANS RAISON
1. orderService.isTransitionAllowed()
   → Règles métier des états commande

2. CartContext.roundMoney()
   → Precision arrondi monétaire (eviter perte centimes)

3. stockService.parseXML()
   → Parsing du XML PrestaShop critique

4. authService.extractAdminToken()
   → Extraction du token CSRF

5. csvImportService.validateRow()
   → Validation données import
```

---

## 7️⃣ GUIDE RAPIDE DES MODIFICATIONS FRÉQUENTES

### 1️⃣ Ajouter un champ formulaire

**Cas**: Ajouter un champ "Fournisseur" dans formulaire produit

**Fichiers à modifier**:
1. `src/services/produitApi.ts` - Ajouter dans interface `Product`
2. `src/components/ProductCreate.tsx` - Ajouter input + state
3. `src/components/ProductDetail.tsx` - Afficher + éditer le champ
4. `src/services/produitApi.ts` - Ajouter dans buildXml()

**Ordre des modifications**:
```
Product interface → Components (input) → API call (buildXml)
```

**Pièges**:
- Oublier le type TypeScript → erreur compilation
- Oublier dans buildXml() → champ envoyé vide à l'API

### 2️⃣ Ajouter une colonne tableau

**Cas**: Afficher "EAN13" dans tableau produits

**Fichiers**:
1. `ProductList.tsx` - Ajouter `<th>EAN</th>` et `<td>{product.ean13}</td>`
2. `ProductList.css` - Ajouter largeur colonne si besoin

**Pièges**:
- Colonne trop large → responsive casse
- Oublier d'afficher sur mobile

### 3️⃣ Modifier un appel API

**Cas**: Ajouter filtre "catégorie" à getProducts()

**Fichiers**:
1. `src/services/produitApi.ts` - Ajouter param au buildUrlParams()
2. `ProductList.tsx` - Passer categoryId au appel service

**Pièges**:
- Oublier le paramètre dans l'URL → filtre ignoré
- Paramètre en camelCase au lieu de snake_case → erreur API

### 4️⃣ Ajouter un filtre

**Cas**: Filtrer par "Prix minimal"

**Fichiers**:
1. `ProductList.tsx`:
   - Ajouter state `priceMin`
   - Ajouter input filter
   - Ajouter à buildFilterPayload()
2. `ProductList.css` - Styler input si besoin

**Pièges**:
- Filtre appliqué mais pas affiché dans la liste
- Oublier de reset filtre après suppression

### 5️⃣ Ajouter une validation

**Cas**: Valider que "Prix > 0"

**Fichiers**:
1. `csvImportService.ts` - Ajouter dans validateRow()
2. `ProductCreate.tsx` - Ajouter validation client (optionnel)

**Code**:
```typescript
// Dans validateRow()
if (row.price && parseFloat(row.price) <= 0) {
  errors.push('Prix doit être > 0');
}
```

**Pièges**:
- Validation serveur manquante (côté client peut être contourné)

### 6️⃣ Modifier une page

**Cas**: Changer layout du dashboard

**Fichiers**:
1. `dashboardPage.tsx` - Modifier JSX layout
2. `Dashboard.css` - Modifier styles
3. Optionnel: `hooks/useDashboardData.ts` - Si logique données change

**Pièges**:
- Responsive ne marche pas → test sur mobile
- État pas re-calculé → utiliser useMemo()

### 7️⃣ Ajouter une route

**Cas**: Nouvelle page `/analytics`

**Fichiers**:
1. `App.tsx` - Ajouter Route
2. Créer `src/components/AnalyticsPage.tsx`
3. Optionnel: `AppLayout.tsx` - Ajouter lien sidebar

**Code dans App.tsx**:
```typescript
<Route
  path="/analytics"
  element={
    <ProtectedRoute>
      <LayoutWrapper>
        <AnalyticsPage />
      </LayoutWrapper>
    </ProtectedRoute>
  }
/>
```

**Pièges**:
- Oublier `<ProtectedRoute>` → accessible sans auth
- Pas de lien sidebar → personne ne la trouve

### 8️⃣ Modifier un composant

**Cas**: Changer couleur bouton ProductList

**Fichiers**:
1. `ProductList.css` - Modifier classe `.btn-primary`
2. Ou modifer className dans ProductList.tsx

**Pièges**:
- Changement CSS affect autre composant (si classe générique)
- BEM naming manquant → styles conflictent

### 9️⃣ Gérer les dates

**Cas**: Parser date API "2024-01-15T10:30:00Z"

**Utiliser**:
```typescript
import { parseAvailabilityDate } from '@/utils/productBadges';

const date = parseAvailabilityDate(apiResponse.date_add);
// Retourne: Date object ou null

// Format pour API (ISO string)
new Date().toISOString(); // "2024-01-15T10:30:00.000Z"

// Format affichage français
date.toLocaleDateString('fr-FR'); // "15/01/2024"
```

**Pièges**:
- Date string sans timezone → problème décalage horaire
- Oublier que Date.getMonth() retourne 0-11
- Dates avant 1970 → problème JavaScript

### 🔟 Gérer les erreurs

**Cas**: Appel API échoue

**Pattern utilisé dans le projet**:
```typescript
const [error, setError] = useState<string | null>(null);

try {
  const data = await service.fetch();
  setData(data);
  setError(null);
} catch (err: any) {
  setError(err.message || 'Erreur inconnue');
  console.error(err);
} finally {
  setLoading(false);
}
```

**Afficher erreur**:
```typescript
{error && <div className="alert-error">{error}</div>}
```

**Pièges**:
- Erreur pas affichée à l'utilisateur → confus
- console.error() oublié → debug difficile
- Erreur API non typée → `(err as any).message`

### 1️⃣1️⃣ Ajouter un bouton/action

**Cas**: Bouton "Exporter" tableau produits

**Fichiers**:
1. `ProductList.tsx` - Ajouter bouton + onClick handler
2. `ProductList.css` - Styler bouton si besoin
3. Optionnel: service fonction export

**Code**:
```typescript
const handleExport = async () => {
  try {
    const csv = products.map(p => `${p.id},${p.name}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    // Télécharger
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
  } catch (err) {
    console.error('Export failed', err);
  }
};

// Dans JSX
<button onClick={handleExport}>Exporter</button>
```

**Pièges**:
- Pas de feedback utilisateur (loading)
- URL objet pas libéré (memory leak)

---

## 8️⃣ SNIPPETS PRÊTS À COPIER

### Fetch API

```typescript
// Avec axios (pattern du projet)
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/xml', 'Accept': 'application/xml' }
});

try {
  const response = await api.get('/products/123');
  const data = parseXML(response.data);
} catch (error) {
  console.error('Fetch failed:', error);
}
```

### Async/Await

```typescript
async function loadData() {
  setLoading(true);
  try {
    const result = await someService.fetch();
    setState(result);
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setLoading(false);
  }
}
```

### useEffect

```typescript
// Charger data au mount
useEffect(() => {
  loadData();
}, []); // dependency vide = mount seulement

// Re-charger quand filtre change
useEffect(() => {
  loadData(filters);
}, [filters]);

// Cleanup
useEffect(() => {
  const interval = setInterval(refresh, 60000);
  return () => clearInterval(interval); // Cleanup
}, []);
```

### useMemo

```typescript
// Calcul complexe ou liste triée
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.price - b.price);
}, [items]); // Re-calc si items change

// Évite re-render enfant si data == même objet
const config = useMemo(() => ({ key: value }), [value]);
```

### useCallback

```typescript
// Function ne change que si dépendance change
const handleClick = useCallback((id: string) => {
  deleteItem(id);
}, [deleteItem]); // Re-créer si deleteItem change

// Passer à composant enfant sans re-render inutile
<ProductRow onDelete={handleClick} />
```

### Formulaire contrôlé

```typescript
const [form, setForm] = useState({ name: '', price: '' });

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setForm(prev => ({ ...prev, [name]: value }));
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await service.save(form);
    setForm({ name: '', price: '' }); // Reset
  } catch (err) {
    console.error('Save failed', err);
  }
};

return (
  <form onSubmit={handleSubmit}>
    <input name="name" value={form.name} onChange={handleChange} />
    <input name="price" type="number" value={form.price} onChange={handleChange} />
    <button type="submit">Enregistrer</button>
  </form>
);
```

### Validation

```typescript
const errors: string[] = [];

if (!form.name.trim()) errors.push('Nom requis');
if (!form.email.includes('@')) errors.push('Email invalide');
if (parseFloat(form.price) <= 0) errors.push('Prix > 0 requis');

if (errors.length > 0) {
  setError(errors.join(', '));
  return;
}

// Valide → continuer
```

### Gestion loading/error

```typescript
const [data, setData] = useState<Data | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

if (loading) return <div>Chargement...</div>;
if (error) return <div className="alert-error">{error}</div>;
if (!data) return <div>Aucune donnée</div>;

return <DataDisplay data={data} />;
```

### Parse date ISO

```typescript
// ISO string → Date JS
const date = new Date("2024-01-15T10:30:00Z");

// Date JS → ISO string
const iso = new Date().toISOString(); // "2024-01-15T10:30:00.000Z"

// Date JS → affichage français
const formatted = date.toLocaleDateString('fr-FR'); // "15/01/2024"

// Extraire année/mois/jour
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 car 0-11
const day = String(date.getDate()).padStart(2, '0');
const formatted2 = `${day}/${month}/${year}`;
```

### Format date pour API

```typescript
// Envoyer à API (ISO format)
const payload = {
  date_add: new Date().toISOString(),
};

// Recevoir API (parser)
const apiDate = "2024-01-15 10:30:00"; // Format MySQL
const parsed = new Date(apiDate); // JS parse ok
```

### Filtre tableau

```typescript
const filtered = products.filter(p => {
  if (filters.name && !p.name.includes(filters.name)) return false;
  if (filters.minPrice && p.price < filters.minPrice) return false;
  if (filters.maxPrice && p.price > filters.maxPrice) return false;
  return true;
});
```

### Debounce

```typescript
// Dans un service ou utils/debounce.ts
function debounce<T extends any[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  let timeout: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Usage
const handleSearchDebounced = debounce((search: string) => {
  loadProducts({ name: search });
}, 500);

<input onChange={(e) => handleSearchDebounced(e.target.value)} />
```

### Modal simple

```typescript
const [isOpen, setIsOpen] = useState(false);

return (
  <>
    <button onClick={() => setIsOpen(true)}>Ouvrir</button>
    {isOpen && (
      <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <h2>Titre</h2>
          <p>Contenu modal</p>
          <button onClick={() => setIsOpen(false)}>Fermer</button>
        </div>
      </div>
    )}
  </>
);
```

### Toast/Alert simple

```typescript
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3000);
};

return (
  <>
    {toast && (
      <div className={`toast toast-${toast.type}`}>
        {toast.message}
      </div>
    )}
  </>
);

// Usage
await service.save(data);
showToast('Enregistré avec succès!', 'success');
```

### Pagination

```typescript
const itemsPerPage = 10;
const [page, setPage] = useState(1);

const paginated = products.slice(
  (page - 1) * itemsPerPage,
  page * itemsPerPage
);

const maxPage = Math.ceil(products.length / itemsPerPage);

return (
  <>
    {paginated.map(item => <div key={item.id}>{item.name}</div>)}
    <div>
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
        Précédent
      </button>
      <span>{page} / {maxPage}</span>
      <button onClick={() => setPage(p => Math.min(maxPage, p + 1))} disabled={page === maxPage}>
        Suivant
      </button>
    </div>
  </>
);
```

---

## 9️⃣ DÉPENDANCES IMPORTANTES

### Librairies principales

| Package | Version | Rôle | Syntaxe clé |
|---------|---------|------|------------|
| **react** | 19.2.5 | Composants, hooks | `useState()`, `useEffect()`, `useContext()` |
| **react-router-dom** | 7.0.0 | Navigation | `<Routes>`, `<Route>`, `useNavigate()` |
| **axios** | 1.16.0 | HTTP client | `axios.create()`, `.get()`, `.post()` |
| **recharts** | 3.8.1 | Graphiques | `<LineChart>`, `<BarChart>`, `<CartesianGrid>` |
| **jszip** | 3.10.1 | ZIP files | `new JSZip()`, `.files`, `.generateAsync()` |

### Pièges connus

| Lib | Piège | Solution |
|-----|-------|----------|
| **React 19** | Hooks dependency array | Lister toutes les dépendances |
| **React Router 7** | Lazy loading des routes? | Actuellement pas utilisé |
| **Axios** | Request interceptor pas configuré | Ajouter headers manuellement pour chaque api |
| **Recharts** | Responsive container not sized | Wrapper dans div avec fixed width |
| **jszip** | Await generateAsync() | Ne pas oublier async/await |

### Config environment (`.env`)

```env
VITE_API_BASE_URL=http://127.0.0.1:8080/api
VITE_PRESTASHOP_URL=http://127.0.0.1:8080
VITE_ADMIN_DIR=admin
VITE_PRESTASHOP_API_KEY=YOUR_KEY
VITE_STOCKAPI_KEY=YOUR_KEY
```

---

## 🔟 CHECKLIST DE SURVIE AVANT RENDU

### ✅ Avant de committer

- [ ] **Imports** - Tous les imports existent (`import {}` pas de typo)
- [ ] **Types** - Aucune erreur TypeScript (`tsc -b` pass)
- [ ] **Null checks** - Vérifier `?.` partout où besoin
- [ ] **Loading state** - Afficher loader pendant fetch
- [ ] **Erreurs** - Toutes les erreurs affichées à l'utilisateur
- [ ] **Responsive** - Testé sur mobile (flex layout)
- [ ] **Validations** - Formulaires validés (côté client + serveur)
- [ ] **Dates** - Format ISO pour API, locale pour affichage
- [ ] **Performance** - useMemo/useCallback si liste longue
- [ ] **Logs** - Pas de console.log() en prod (ou utiliser debug mode)
- [ ] **Typos** - Relire les chaînes de caractères
- [ ] **CSS** - Pas de conflit classe CSS

### 🧪 Test rapide avant déploiement

```bash
npm run lint          # Vérifier ESLint
npm run build         # Vérifier build (TypeScript)
npm run dev           # Tester localement (port 5173)
```

### 🚨 Erreurs courantes

| Erreur | Cause | Fix |
|--------|-------|-----|
| "Cannot read property 'map' of undefined" | State null | `data?.map()` ou check `if (!data)` |
| "Object literal may only specify known properties" | Champ pas dans interface | Vérifier interface type |
| "Expected 3 arguments, got 2" | Fonction signature changeuse | Vérifier paramètres |
| "Uncaught SyntaxError in bundler" | Import path wrong | Chemin doit exister |
| "Blank page après build" | CSS pas loadé | Vérifier imports CSS |
| "API returns 401 Unauthorized" | Token manquant/expiré | Vérifier authService |
| "useEffect running infinitely" | Dependency array manquant | Ajouter `[]` ou dépendances |
| "Styling not applied" | CSS class name wrong | Vérifier className vs class |

### 📋 Avant de rendre au évaluateur

- [ ] Code builded et testé
- [ ] Aucune erreur console.error() non gérée
- [ ] Routes publiques/protégées correctes
- [ ] Base de données peuplée (fixtures)
- [ ] `.env` secrets pas committé
- [ ] README.md à jour avec instructions
- [ ] Pas de `debugger;` ou `console.log()` partout
- [ ] Responsive design testé
- [ ] Export/Import fonctionnel
- [ ] Pagination/filtres testés
- [ ] Dates en français
- [ ] Devises en EUR

---

## 📚 RESSOURCES RAPIDES

### Rechercher une fonction

```bash
# Grep pour trouver une fonction
grep -r "functionName" src/

# Chercher une interface
grep -r "interface MyType" src/
```

### Debug rapide

```typescript
// Afficher l'état pour debug
console.log('État:', { data, loading, error });

// Vérifier le type runtime
console.log(typeof someVariable, Array.isArray(someVariable));

// Inspecter l'objet
console.log(JSON.stringify(someObject, null, 2));
```

### Links utiles

- **React Hooks API**: https://react.dev/reference/react
- **React Router**: https://reactrouter.com/
- **Axios Docs**: https://axios-http.com/
- **Recharts**: https://recharts.org/
- **TypeScript**: https://www.typescriptlang.org/docs/

---

## 🎯 RÉSUMÉ ULTRA-RAPIDE (5 MIN READ)

1. **Structure**: `components/` (UI) + `services/` (API) + `contexts/` (state global)
2. **Navigation**: Routes dans `App.tsx`, protection avec `ProtectedRoute`
3. **State Management**: Contexts simples (Auth, Cart, Customer)
4. **API calls**: Services avec Axios, responses XML parsed
5. **Composants clés**: ProductList, OrderList, CartPage, DashboardPage
6. **Types**: Interface de chaque service, validation stricte TypeScript
7. **Pièges**: Null checks, dates ISO, arrondi monétaire, states multiples
8. **Debugging**: console.log(), grep pour trouver code, vérifier types
9. **Performance**: useMemo/useCallback si boucles longues
10. **Tests**: `npm run build` + `npm run lint` avant commit

---

**Dernière mise à jour**: 2024
**Auteur**: AI Assistant
**Durée lect**: 15-20 min complète | 5 min résumé
