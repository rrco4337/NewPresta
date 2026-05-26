# Remove Stock — Implémentation

## Vue d'ensemble

Ajout d'un bouton **"Remove Stock"** dans la page Liste des Produits (admin).
Le flow complet :
1. Clic sur "Remove Stock" → popup demande le **mot de passe admin**
2. Mot de passe incorrect → message d'erreur rouge dans le popup
3. Mot de passe correct → popup affiche **choix catégorie** + **quantité**
4. Validation → retrait de stock par produit dans la catégorie
   - Si `stock existant < quantité demandée` → stock mis à **0** (retire tout)
5. Résultat → **tableau récapitulatif** avec Qté demandée / Qté exactement retirée

---

## Fichiers modifiés / créés

### 1. `src/services/stockService.ts`

**Ajout de la méthode `decreaseStockByCategory`** — insérée juste avant `calculateStockByCategory` (ligne ~1025 après modification).

```typescript
// src/services/stockService.ts — méthode ajoutée dans l'objet stockService

decreaseStockByCategory: async (
  categoryId: number,
  quantityPerLine: number
): Promise<Array<{
  productId: string;
  productName: string;
  combinationLabel: string;
  qtyWanted: number;
  qtyActuallyRemoved: number;
}>> => {
  // 1. Récupère les produits de la catégorie via l'API PrestaShop
  const productsRes = await api.get(`/products?filter[id_category_default]=[${categoryId}]&display=full`);
  const root = getRoot(parseXML(productsRes.data));
  const container = root && isObj(root.products) ? root.products : null;
  const rawProducts = toArray((container as any)?.product);

  const categoryProductIds = new Set<string>();
  for (const p of rawProducts) {
    if (!isObj(p)) continue;
    const id = String((p as any).id ?? '');
    if (id) categoryProductIds.add(id);
  }

  if (categoryProductIds.size === 0) return [];

  // 2. Récupère toutes les lignes de stock, filtre sur la catégorie
  const allLines = await stockService.getAllStockLines();
  const categoryLines = allLines.filter(l => categoryProductIds.has(l.productId));

  const results = [];

  // 3. Pour chaque ligne : retire min(quantityPerLine, stock disponible)
  for (const line of categoryLines) {
    const actualRemove = Math.min(quantityPerLine, line.quantity);
    if (actualRemove > 0) {
      try {
        await stockService.removeStock(line, actualRemove);
      } catch (err) {
        console.warn(`[decreaseStockByCategory] ...`, err);
      }
    }
    results.push({
      productId: line.productId,
      productName: line.productName,
      combinationLabel: line.combinationLabel,
      qtyWanted: quantityPerLine,
      qtyActuallyRemoved: actualRemove,  // = 0 si stock était 0
    });
  }

  return results;
},
```

**Règle clé** : `actualRemove = Math.min(quantityPerLine, line.quantity)`
- Exemple : stock = 2, demande = 5 → actualRemove = 2, stock final = 0
- Exemple : stock = 10, demande = 5 → actualRemove = 5, stock final = 5

---

### 2. `src/components/RemoveStockModal.tsx` *(nouveau fichier)*

Composant modal complet gérant les 4 étapes :

```typescript
// src/components/RemoveStockModal.tsx

type Step = 'password' | 'form' | 'loading' | 'result';

// États principaux
const [step, setStep] = useState<Step>('password');
const [password, setPassword] = useState('');
const [pwdError, setPwdError] = useState<string | null>(null);
const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
const [quantity, setQuantity] = useState('');
const [results, setResults] = useState<RemoveResult[]>([]);
```

**Vérification du mot de passe** (lignes ~52–73) :
```typescript
const handlePasswordSubmit = async (e: React.FormEvent) => {
  const currentUser = authService.getCurrentUser();
  try {
    await authService.login({ email: currentUser.email, password });
    setStep('form');  // succès → étape suivante
  } catch (err) {
    if (err instanceof AuthError && err.code === 'INVALID_CREDENTIALS') {
      setPwdError('Mot de passe incorrect. Veuillez réessayer.');
    }
  }
};
```

**Soumission du formulaire catégorie/quantité** (lignes ~75–100) :
```typescript
const handleFormSubmit = async (e: React.FormEvent) => {
  const qty = parseInt(quantity, 10);
  setStep('loading');
  try {
    const res = await stockService.decreaseStockByCategory(Number(selectedCategoryId), qty);
    setResults(res);
  } catch (err) { ... }
  setStep('result');
};
```

**Tableau résultat** — affiche pour chaque produit :
- Colonne **"Qté demandée"** : `r.qtyWanted` (toujours la valeur saisie)
- Colonne **"Qté retirée"** : `r.qtyActuallyRemoved` (en jaune si < demandée, vert sinon)
- Ligne **Total** en pied de tableau

---

### 3. `src/components/ProductList.tsx`

**Import ajouté** (ligne 6) :
```typescript
import RemoveStockModal from './RemoveStockModal';
```

**État ajouté** (ligne ~24) :
```typescript
const [showRemoveStock, setShowRemoveStock] = useState(false);
```

**Bouton ajouté** dans la section des actions en haut (après le bouton "Actualiser") :
```tsx
<button
  onClick={() => setShowRemoveStock(true)}
  style={{
    background: '#fff5f5',
    border: '1.5px solid #fecaca', borderRadius: '10px',
    color: '#dc2626', fontWeight: 700, ...
  }}
>
  <i className="fa-solid fa-circle-minus"></i>
  Remove Stock
</button>
```

**Rendu du modal** (juste après le bloc des boutons) :
```tsx
{showRemoveStock && (
  <RemoveStockModal
    onClose={() => { setShowRemoveStock(false); loadProducts(appliedFilters); }}
  />
)}
```
> Note : `loadProducts(appliedFilters)` au `onClose` recharge la liste après l'opération.

---

## Étapes pour tester

### Prérequis
- L'application doit tourner : `npm run dev`
- Être connecté en tant qu'administrateur (page `/login`)
- Avoir des produits avec du stock dans PrestaShop

### Test 1 — Mot de passe incorrect
1. Aller sur **Admin → Produits** (`/products`)
2. Cliquer sur le bouton rouge **"Remove Stock"** dans l'en-tête
3. Le modal s'ouvre sur l'étape "Vérification de l'identité"
4. Saisir un **mauvais** mot de passe et cliquer "Vérifier"
5. **Résultat attendu** : message d'erreur rouge "Mot de passe incorrect. Veuillez réessayer."

### Test 2 — Mot de passe correct → formulaire
1. Même chemin qu'au Test 1
2. Saisir le **bon** mot de passe admin et cliquer "Vérifier"
3. **Résultat attendu** : le modal passe à l'étape "Sélection de la catégorie" avec :
   - Un `<select>` listant toutes les catégories PrestaShop
   - Un champ nombre pour la quantité

### Test 3 — Retrait normal (stock suffisant)
1. Après vérification du mot de passe, choisir une catégorie qui a des produits avec stock > 5
2. Saisir **5** dans le champ quantité
3. Cliquer "Retirer le stock"
4. **Résultat attendu** : tableau récapitulatif avec :
   - Qté demandée = 5
   - Qté retirée = 5 (badge vert) pour chaque produit ayant ≥ 5 en stock

### Test 4 — Retrait avec stock insuffisant (cas principal)
1. Trouver un produit avec stock = 2 dans une catégorie
2. Choisir cette catégorie, saisir **5**
3. **Résultat attendu** :
   - Produit avec stock = 2 → Qté demandée = 5, **Qté retirée = 2** (badge jaune ⚠️)
   - Stock final de ce produit dans PrestaShop = **0**
   - Message d'avertissement en bas : "Les lignes en jaune avaient un stock inférieur…"

### Test 5 — Catégorie vide
1. Choisir une catégorie sans aucun produit
2. **Résultat attendu** : message "Aucun produit trouvé dans cette catégorie."

### Test 6 — Fermeture et rechargement
1. Après avoir fait un retrait, fermer le modal
2. **Résultat attendu** : la liste des produits se recharge automatiquement avec les nouvelles quantités

---

## Logique métier résumée

```
Pour chaque produit/déclinaison de la catégorie choisie :
  actualRemove = min(quantité_demandée, stock_existant)

  si actualRemove > 0 :
    → appel stockapi.php pour décrémenter le stock
    → enregistrement du mouvement de stock
  
  résultat ligne :
    qtyWanted          = quantité_demandée  (toujours affiché)
    qtyActuallyRemoved = actualRemove       (0 si stock était déjà 0)
```
