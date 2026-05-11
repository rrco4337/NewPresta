# Pricing and Tax Fixes (FrontOffice + CSV Import)

## Files modified
- src/services/taxService.ts (new)
- src/services/shopService.ts
- src/contexts/CartContext.tsx
- src/components/ShopHome.tsx
- src/components/ProductDetail.tsx
- src/components/ProductDetail.css
- src/components/CartPage.tsx
- src/components/CheckoutPage.tsx
- src/services/customerService.ts
- src/services/csvImportService.ts
- src/services/fichierImportService.ts

## Pricing logic
- Base price from PrestaShop is HT (product.price).
- Tax rate is resolved from the tax rules group: tax_rules -> tax -> rate.
- priceTtc = round(priceHt * (1 + taxRate), 6 decimals).
- Cart totals:
  - total_ht = sum(priceHt * qty)
  - total_ttc = sum(priceTtc * qty)
  - total_tax = total_ttc - total_ht
- Order creation fields:
  - unit_price_tax_excl = priceHt
  - unit_price_tax_incl = priceTtc
  - total_products = total_ht
  - total_products_wt = total_ttc
  - total_paid_tax_excl = total_ht + shipping_ht
  - total_paid_tax_incl = total_ttc + shipping_ttc

## CSV import corrections
- csvImportService validates tax_rules_id and blocks import if missing or invalid.
- fichierImportService resolves tax_rules_group by tax rate from CSV and auto-creates taxes/rules if missing.

## Issues found
- FrontOffice used HT price for display and cart totals.
- Order creation used HT for tax_incl and tax_excl fields.
- Custom file import hardcoded tax rules group to 1.

## Validations performed
- No automated tests run.
- Manual verification not performed.
