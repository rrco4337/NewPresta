# prestashop-app - code analysis

This document explains the implemented features and how the code works, based on the current repository state. Sensitive values (API keys, tokens) are intentionally omitted or marked as redacted.

## Project structure and roles

| Path | Role | Notes |
|---|---|---|
| `src/main.tsx` | React entrypoint | Mounts the app in `#root` and enables `StrictMode`. |
| `src/App.tsx` | Routing and layout | Declares routes, wraps protected pages with auth guard and layout, and sets the page title. |
| `src/contexts/AuthContext.tsx` | Auth state | Stores current admin user, restores session from localStorage, exposes `login/logout`. |
| `src/services/authService.ts` | BO authentication | Logs admin into PrestaShop back office via `AdminLogin`, extracts CSRF token, persists session. |
| `src/services/produitApi.ts` | Product API | Axios setup, XML build, XML->JSON parser, mapping to `Product`, CRUD + stock update. |
| `src/components/Login.tsx` | Login UI | Email/password form, error handling, redirect after login. |
| `src/components/ProtectedRoute.tsx` | Route guard | Blocks private routes until session is known, redirects to `/login` if needed. |
| `src/components/AppLayout.tsx` | Global UI | Sidebar, topbar, user avatar, logout button, collapsible menu. |
| `src/components/ProductList.tsx` | Product list | Loads products, filters, sorting, delete action. |
| `src/components/ProductCreate.tsx` | Create/edit product | Form for product data, loads by id, creates or updates. |
| `vite.config.ts` | Dev proxy | Proxies `/api` to PrestaShop and injects Basic Auth header, proxies `/admin...` for BO. |
| `.env` | Runtime config | Contains API base URL, PrestaShop URL, admin directory and API key (redacted here). |
| `postman_collection.json` | Categories API collection | CRUD and search for categories using Basic Auth (wsKey). |
| `collection_postman.json` | Product module collection | CRUD and search for module endpoints (JSON bodies). |
| `2_Categories.json` | Data sample | Category data sample used for tests or reference. |

## Routing and layout

`App.tsx` sets up a `BrowserRouter` and defines:

- `/login` as a public route.
- `/` (products list), `/products/add`, and `/products/:id` as protected routes.

Protected routes are wrapped by `ProtectedRoute` and then by `AppLayout`. `LayoutWrapper` reads the current URL and passes a page title to the layout:

- `/` -> "Produits"
- `/products/add` -> "Ajouter un produit"
- `/products/:id` -> "Modifier le produit"

`AppLayout` renders the sidebar and topbar. Most sidebar modules are marked disabled (for future features) and show a "Soon" badge, while "Produits" is active.

## Authentication flow (Back Office)

### AuthContext

`AuthContext.tsx` provides:

- `user`: the current admin user, or `null`.
- `isLoading`: true while restoring the session.
- `login(email, password)`: calls `authService.login`, then updates `user`.
- `logout()`: calls `authService.logout`, then clears `user`.

On mount, it loads the user from localStorage and then flips `isLoading` to false.

### authService

`authService.ts` is the BO (Back Office) auth layer:

- Uses a dedicated Axios instance with `withCredentials: true` so the BO session cookie is stored by the browser.
- Login endpoint:
  `/{ADMIN_DIR}/index.php?controller=AdminLogin&ajax=1&action=login`
- Sends a `URLSearchParams` body with fields expected by PrestaShop BO:
  - `email`
  - `passwd` (not `password`)
  - `submitLogin`, `ajax`, `stay_logged_in`, `redirect`
- If `hasErrors` is true in the response, it throws a typed `AuthError` with code `INVALID_CREDENTIALS`.
- On success, it extracts the admin CSRF token from `redirect` using a regex like `token=...`.
- It stores `{ email, adminToken }` in localStorage under `ps_admin_user`.

Logout calls:
`/{ADMIN_DIR}/index.php?controller=AdminLogin&logout&token={adminToken}`
and clears localStorage in a `finally` block, so local state is cleared even if the network fails.

### Login UI and route guard

`Login.tsx`:

- Controlled inputs for email/password.
- `handleSubmit` calls `login` and shows errors from `AuthError`.
- A `useEffect` redirects to the original target route (saved by `ProtectedRoute`) if already logged in.

`ProtectedRoute.tsx`:

- While `isLoading`, shows a simple loading screen.
- If `user` is missing, redirects to `/login` and stores the original location.
- If `user` exists, renders the child route.

## Product data flow (PrestaShop Webservice)

### Axios setup

`produitApi.ts` defines an Axios instance:

- `baseURL = VITE_API_BASE_URL` (typically `/api`, proxied by Vite)
- `Content-Type: application/xml`
- `Accept: application/xml`

This matches the PrestaShop Webservice that returns XML payloads.

### XML to JSON parsing

`parseXMLToJSON(xmlString)` uses `DOMParser` and a recursive `parseNode`:

- If a node has no children, it returns `textContent`.
- If a node has children, it builds an object with child node names as keys.
- If the same child node name appears multiple times, it converts the value into an array.

The result is a plain JS object where the XML structure is preserved and repeated nodes become arrays.

### Mapping XML to frontend models

`PrestashopMapper` provides:

`getLangValue(field)`:

- Handles PrestaShop multilingual fields like:
  `<name><language id="1"><![CDATA[...]]></language></name>`
- Supports both single object and array forms.
- Returns `_cdata`, `_text`, or raw string where available.

`mapToFrontend(p)`:

- Maps the raw XML-derived object to the `Product` interface.
- Parses numeric fields (`price`, `wholesale_price`, `id_category_default`, `id_tax_rules_group`).
- Converts `active` to boolean using `p.active === '1'`.
- Initializes `quantity` to 0 (stock is updated separately).

### Building XML for create/update

`buildXml(product)` generates the XML payload for PrestaShop:

- Builds `link_rewrite` as a slug:
  - lowercased
  - removes diacritics
  - replaces non alphanumeric chars with `-`
- Includes `<ean13>` only if it matches `^\d{13}$`.
- Wraps translatable fields in `<language id="1">` with CDATA.

### CRUD methods

`productService` exposes:

- `getAllProducts()`: GET `/products?display=full`
  - Parses XML -> JSON
  - Reads `prestashop.products.product`
  - Normalizes to array and maps each item
- `getProduct(id)`: GET `/products/{id}?display=full`
  - Reads `prestashop.product` or `product`
- `create(data)`: POST `/products` with XML
  - Parses response and maps the created product
  - If `quantity > 0`, updates stock via `updateStock`
- `update(id, data)`: PUT `/products/{id}` with XML + `<id>`
  - Parses response and maps the updated product
  - If `quantity > 0`, updates stock
- `deleteProduct(id)`: DELETE `/products/{id}`

`updateStock(stockId, productId, quantity)` sends a specific XML to `/stock_availables/{stockId}`.

## Product UI

### ProductList

- Loads products on mount via `productService.getAllProducts()`.
- Filters:
  - Name or reference search
  - Price min/max
  - Active / inactive
  - Stock (uses `quantity`)
- Sorting:
  - By name, price, or reference
  - Ascending or descending
- Actions:
  - Refresh
  - Add product
  - Edit product
  - Delete product (with confirmation)

### ProductCreate

- Acts as both create and edit form.
- If `id` exists in the URL, it loads the product and pre-fills the form.
- On submit:
  - If editing: calls `productService.update(id, formData)`
  - If creating: calls `productService.create(formData)`
- Shows success or error status and redirects after success.

## Layout and navigation

`AppLayout` provides:

- Sidebar with grouped modules.
- Only "Produits" is active; others are disabled (future placeholders).
- Topbar with page title and user avatar.
- Logout button that calls `logout()` then navigates to `/login`.

## Vite proxy and environment config

`vite.config.ts`:

- Proxies `VITE_API_BASE_URL` (default `/api`) to `VITE_PRESTASHOP_URL`.
- Adds `Authorization: Basic <apiKey:>` on every proxied request.
- Proxies `/{VITE_ADMIN_DIR}` to the same PrestaShop URL for BO endpoints.
- Rewrites cookie domain to `localhost` for local development.

`.env` provides:

- `VITE_API_BASE_URL`
- `VITE_PRESTASHOP_URL`
- `VITE_PRESTASHOP_API_KEY` (redacted)
- `VITE_ADMIN_DIR`

## Postman collections and data files

`postman_collection.json` (Categories CRUD):

- Basic Auth with `wsKey` variable.
- CRUD endpoints for categories and filtered queries.
- XML examples for create/update.

`collection_postman.json` (Product module):

- CRUD endpoints exposed by a custom PrestaShop module.
- Uses JSON bodies for create/update/delete.
- Includes multi criteria search endpoints.

`2_Categories.json`:

- Static JSON with categories data, likely used as sample data or reference.

## TypeScript and lint config

`tsconfig.json` references:

- `tsconfig.app.json` for app code in `src/`
- `tsconfig.node.json` for Vite config

`tsconfig.app.json`:

- `target: es2023`, `module: esnext`, `moduleResolution: bundler`
- `noEmit: true`
- `jsx: react-jsx`
- Linting flags: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`

`tsconfig.node.json`:

- Similar config for the Vite config file

`eslint.config.js`:

- ESLint base recommended
- TypeScript recommended
- React hooks rules
- React refresh rules

## NPM scripts

`package.json` scripts:

- `dev`: run Vite dev server
- `build`: TypeScript build + Vite build
- `lint`: run ESLint
- `preview`: run Vite preview server
