# Login Back Office — Analyse détaillée

Ce document isole **uniquement** la logique de login Admin (Back Office) et la chaîne complète de traitement côté front, contexte, service et PrestaShop.

---

## 1) Objectif métier

Permettre à un administrateur PrestaShop de se connecter au Back Office via l’application React, puis de **conserver une session** (cookie BO) et **un token CSRF admin** pour les actions futures (logout, accès BO).

---

## 2) Entrée côté UI

### `src/components/Login.tsx`

**Responsabilités :**

* Formulaire contrôlé (email / password).
* Gestion d’état : `loading`, `error`.
* Appel du `login()` fourni par le contexte.
* Redirection automatique si déjà connecté.

**Points clés :**

* `handleSubmit` déclenche `login(email, password)`.
* En cas d’erreur :
  * Si `AuthError` → message précis.
  * Sinon → message générique.
* `useEffect` :
  * Si `user` existe déjà → redirection vers la route originale (stockée par `ProtectedRoute`) ou `/`.

---

## 3) Garde de route

### `src/components/ProtectedRoute.tsx`

**Rôle :** empêcher l’accès aux routes privées si l’admin n’est pas authentifié.

**Séquence :**

1. Si `isLoading` → écran de chargement (restauration de session).
2. Si `user` est `null` :
   * Redirection vers `/login`.
   * La route demandée est stockée dans `location.state` (clé `from`) pour un retour post-login.
3. Si `user` est défini → affiche les routes protégées.

---

## 4) Contexte global d’authentification

### `src/contexts/AuthContext.tsx`

**Rôle :** fournir l’état d’authentification à toute l’app.

**Attributs exposés :**

* `user: AuthUser | null`
* `isLoading: boolean`
* `login(email, password)`
* `logout()`

**Restauration de session :**

* Au montage : `authService.getCurrentUser()` est appelé.
* L’utilisateur est injecté dans le contexte si présent.

---

## 5) Service métier d’authentification

### `src/services/authService.ts`

**Responsabilité :**

Communiquer avec le **Back Office PrestaShop**, obtenir la session admin (cookie), extraire le **token CSRF**, et stocker ces infos.

### 5.1) Configuration Axios dédiée BO

* `withCredentials: true` → permet au navigateur de conserver le cookie BO.
* `Content-Type: application/x-www-form-urlencoded` → attendu par le contrôleur BO.

### 5.2) Login BO

**Endpoint :**

```
/{ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1&action=login
```

**Payload envoyé :**

| Champ | Raison |
|------|--------|
| `email` | identifiant admin |
| `passwd` | le BO attend *passwd*, pas `password` |
| `submitLogin=1` | déclenche l’action BO |
| `ajax=1` | réponse JSON |
| `stay_logged_in=1` | persistance session |
| `redirect=AdminDashboard` | retourne une URL contenant le token |

### 5.3) Gestion d’erreur métier

* Si `hasErrors=true` dans la réponse → `AuthError('INVALID_CREDENTIALS')`.
* Si erreur réseau/unknown → `AuthError('NETWORK_ERROR')`.

### 5.4) Extraction du token CSRF

* Le BO renvoie une URL dans `redirect`.
* Une regex extrait `token=...`.
* Ce token est indispensable pour le logout (et certaines actions BO).

### 5.5) Persistance locale

* Stockage dans `localStorage` via `ps_admin_user`.
* Structure sauvegardée :

```json
{
  "email": "admin@domaine.tld",
  "adminToken": "abc123..."
}
```

### 5.6) Logout

**Endpoint :**

```
/{ADMIN_DIR}/index.php?controller=AdminLogin&logout&token={adminToken}
```

* Exécuté si `adminToken` disponible.
* **Nettoyage local garanti** dans un `finally` (même en cas d’erreur réseau).

---

## 6) Proxy Vite et cookies BO

### `vite.config.ts`

* Les requêtes vers `/{VITE_ADMIN_DIR}` sont proxyfiées vers `VITE_PRESTASHOP_URL`.
* `cookieDomainRewrite: 'localhost'` permet de conserver la session BO en local.
* Les requêtes login/logout passent donc **par le proxy**, ce qui évite les soucis CORS.

---

## 7) Séquence globale (résumé logique)

1. Utilisateur visite une route privée → `ProtectedRoute` l’envoie sur `/login`.
2. `Login.tsx` capture email/mot de passe et appelle `AuthContext.login`.
3. `AuthContext` délègue à `authService.login`.
4. `authService` :
   * envoie les credentials au contrôleur BO
   * récupère cookie BO
   * extrait le token CSRF
   * persiste `{ email, adminToken }`
5. Le contexte met à jour `user` → l’UI redirige vers la route d’origine.

---

## 8) Points importants à retenir

* **Le BO attend `passwd`** et non `password`.
* **Le cookie de session BO** est critique → `withCredentials` obligatoire.
* **Le token CSRF admin** est extrait de l’URL de redirection.
* La session est restaurée au rechargement grâce à `localStorage`.
* La redirection post-login utilise `location.state.from`.

