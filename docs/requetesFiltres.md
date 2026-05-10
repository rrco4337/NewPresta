# Requêtes API utilisées pour les filtres produits

Base URL : `http://127.0.0.1:8080/api`

---

## 1. Filtre par nom

Recherche partielle (contient la chaîne saisie).

```
GET /products?display=full&filter[name]=%[valeur]%
```

**Exemple** — chercher tous les produits dont le nom contient "shirt" :
```
GET /products?display=full&filter[name]=%[shirt]%
```

---

## 2. Filtre par référence

Recherche partielle sur la référence produit.

```
GET /products?display=full&filter[reference]=%[valeur]%
```

**Exemple** :
```
GET /products?display=full&filter[reference]=%[REF-001]%
```

---

## 3. Filtre par catégorie

Correspondance exacte sur l'ID de catégorie.

```
GET /products?display=full&filter[id_category_default]=ID_CATEGORIE
```

**Exemple** — catégorie ID 3 :
```
GET /products?display=full&filter[id_category_default]=3
```

---

## 4. Filtre par état (actif / inactif)

```
GET /products?display=full&filter[active]=1   ← produits actifs
GET /products?display=full&filter[active]=0   ← produits inactifs
```

---

## 5. Filtre par plage de prix (HT)

```
GET /products?display=full&filter[price]=[min,max]
```

**Exemples** :
```
GET /products?display=full&filter[price]=[10,50]       ← entre 10 € et 50 €
GET /products?display=full&filter[price]=[0,99999999]  ← à partir de 0 €
GET /products?display=full&filter[price]=[20,99999999] ← à partir de 20 €
```

> Si seulement `min` est renseigné, `max` prend la valeur `99999999`.  
> Si seulement `max` est renseigné, `min` prend la valeur `0`.

---

## 6. Filtre par plage d'ID

```
GET /products?display=full&filter[id]=[min,max]
```

**Exemple** — produits dont l'ID est entre 5 et 20 :
```
GET /products?display=full&filter[id]=[5,20]
```

---

## 7. Filtre par quantité (stock) — 2 requêtes enchaînées

La quantité n'est pas dans `/products`, elle est dans `/stock_availables`.

### Étape 1 — récupérer les IDs produits correspondant à la plage de stock

```
GET /stock_availables?display=[id_product]&filter[quantity]=[min,max]
```

**Exemple** — produits ayant entre 5 et 100 unités en stock :
```
GET /stock_availables?display=[id_product]&filter[quantity]=[5,100]
```

Réponse (liste d'`id_product`) :
```xml
<stock_availables>
  <stock_available><id_product>3</id_product></stock_available>
  <stock_available><id_product>7</id_product></stock_available>
</stock_availables>
```

### Étape 2 — filtrer les produits par ces IDs

```
GET /products?display=full&filter[id]=[3|7]
```

Le séparateur `|` est un **OU** logique : retourne les produits dont l'ID est 3 OU 7.

---

## 8. Combinaison de plusieurs filtres

Tous les paramètres se cumulent dans la même requête (ET logique).

**Exemple** — produits actifs, nom contenant "eco", prix entre 10 € et 80 €, catégorie 2 :
```
GET /products?display=full
  &filter[name]=%[eco]%
  &filter[active]=1
  &filter[price]=[10,80]
  &filter[id_category_default]=2
```

---

## Syntaxe des filtres PrestaShop Webservice (rappel)

| Syntaxe du paramètre | Comportement SQL équivalent | Usage                          |
|----------------------|-----------------------------|--------------------------------|
| `[valeur]`           | `= 'valeur'`                | Égalité stricte (exact match)  |
| `%[valeur]%`         | `LIKE '%valeur%'`           | Contient (recherche partielle) |
| `[valeur]%`          | `LIKE 'valeur%'`            | Commence par                   |
| `%[valeur]`          | `LIKE '%valeur'`            | Finit par                      |
| `[min,max]`          | `BETWEEN min AND max`       | Plage numérique                |
| `[v1\|v2\|v3]`       | `IN (v1, v2, v3)`           | Liste de valeurs (OU)          |
