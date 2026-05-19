# Data reset (reinitialisation des donnees)

Ce document explique en detail comment la reinitialisation des donnees est implementee dans l application, cote UI et cote services.

---

## 1) Point d entree et objectif

- Route back office: /reset
- Composant UI: src/components/DataReset.tsx
- Objectif: supprimer les donnees principales de la boutique PrestaShop via l API Webservice (XML) dans un ordre securise.

La reinitialisation est **irreversible** et supprime:
- Commandes
- Declinaisons
- Produits
- Categories
- Clients
- Adresses
- Fournisseurs
- Marques

---

## 2) Flux global (UI)

Le composant DataReset est pilote par un etat `phase`:

- idle
  - Ecran d avertissement (zone de danger).
  - Liste des entites qui seront supprimees.
  - Bouton principal: "Reinitialiser toutes les donnees".

- confirm
  - Boite de confirmation avec rappel d irreversibilite.
  - Boutons: Annuler / Oui, tout supprimer.

- running
  - Affiche la progression de l etape courante et la progression globale.
  - Affiche en temps reel les etapes terminees avec succes ou en erreur.

- done
  - Resume global (nombre total d elements supprimes + erreurs).
  - Liste detaillee des etapes avec le resultat.
  - Bouton "Retour" pour repasser a l etat idle.

Transitions:
- idle -> confirm: clic sur "Reinitialiser toutes les donnees".
- confirm -> running: clic sur "Oui, tout supprimer".
- running -> done: quand toutes les etapes sont terminees.
- done -> idle: clic sur "Retour".

---

## 3) Ordre de suppression (RESET_STEPS)

Dans DataReset.tsx, la suppression est definie par `RESET_STEPS`.
L ordre est important pour limiter les contraintes de dependances:

1. Commandes
2. Declinaisons
3. Produits
4. Categories
5. Clients
6. Adresses
7. Fournisseurs
8. Marques

Justification generale:
- On supprime d abord les entites "dependantes" (commandes) avant les entites "sources" (produits, categories).
- Les declinaisons (combinations) sont liees aux produits, donc elles sont supprimees avant les produits.
- Les categories sont supprimees apres les produits.
- Les clients et adresses sont supprimes apres les commandes (qui referencent les clients).

Note: selon la configuration PrestaShop, l ordre Clients/Adresses pourrait etre inverse. Ici, on supprime les clients avant les adresses. Si l API refuse cette suppression dans certains cas, l etape "Adresses" peut renvoyer des erreurs apres coup.

---

## 4) Suivi de progression et erreurs

Pour chaque etape:
- `step.run(cb)` est appele avec un callback de progression.
- Le callback calcule `stepProgress` en pourcentage via done/total.
- En cas d erreur d une etape, l erreur est capturee et stockee dans `stepResults`, mais **la boucle continue** vers les etapes suivantes.

Resume final:
- totalDeleted = somme des `deleted` de chaque etape reussie.
- totalErrors = somme des `errors` + 1 si une etape a renvoye une exception globale.

Cela signifie que:
- La reinitialisation n est pas transactionnelle.
- On peut avoir un resultat "partiel".

---

## 5) Services utilises (otherImportService.ts)

### 5.1 cleanEntities(endpoint, protectedIds, onProgress)

C est la fonction generique de nettoyage:

1. GET /{endpoint}?display=[id]
   - Recupere la liste des ids via l API PrestaShop (XML).
2. parseIdList
   - Transforme la reponse XML en tableau d ids.
3. Filtre les ids proteges (ex: categories 1 et 2).
4. Boucle sur chaque id:
   - DELETE /{endpoint}/{id}
   - Incremente `deleted` si OK, `errors` sinon.
   - Appelle onProgress(done, total).

Retourne un `CleanResult`:
- total: nombre total d elements a supprimer
- deleted: nombre effectivement supprimes
- errors: nombre d echec API

### 5.2 Fonctions specialisees

Chaque fonction d entite appelle cleanEntities avec un endpoint fixe:

- cleanOrders       -> /orders
- cleanCombinations -> /combinations
- cleanProducts     -> /products
- cleanCategories   -> /categories (protectedIds = ["1", "2"])
- cleanCustomers    -> /customers
- cleanAddresses    -> /addresses
- cleanSuppliers    -> /suppliers
- cleanBrands       -> /manufacturers

Le cas special des categories:
- Les ids 1 et 2 sont proteges (Root + Home dans PrestaShop) et ne sont pas supprimes.

---

## 6) Ce que l UI affiche exactement

- Pendant l execution:
  - Etape courante + barre de progression locale.
  - Progression globale calculee sur l index d etape (pas sur la somme exacte des elements).
  - Historique des etapes terminees, avec succes/erreur.

- A la fin:
  - Resume total d elements supprimes.
  - Resume d erreurs.
  - Liste detaillee par etape (label, quantite supprimee, message d erreur si present).

---

## 7) Limites et points d attention

- Pas de transaction globale: une etape peut echouer et les suivantes s executent quand meme.
- Le pourcentage global est approximatif (index d etape), pas base sur le total reelle d elements.
- L ordre Clients/Adresses peut etre discutable selon la configuration PrestaShop.
- Les protections ne concernent que les categories (ids 1 et 2). Les autres entites n ont pas d exclusion.
- Les erreurs API sont simplement comptees et remontees, sans retry automatique.

---

## 8) Fichiers principaux

- src/components/DataReset.tsx
- src/services/otherImportService.ts
- src/App.tsx (route /reset via LayoutWrapper + ProtectedRoute)

---

## 9) Resume en une phrase

La reinitialisation des donnees est une suppression sequentielle d entites PrestaShop, pilotee par une UI multi-etapes qui affiche la progression et conserve un historique des succes/erreurs, en s appuyant sur un service generique de suppression par endpoint.
