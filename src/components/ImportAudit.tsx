import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchProductsSample,
  fetchCategoriesSample,
  fetchCustomersSample,
  fetchAddressesSample,
  fetchSuppliersSample,
  fetchBrandsSample,
  fetchCombinationsSample,
  fetchStockSample,
  fetchTaxesSample,
  fetchTaxRuleGroupsSample,
  fetchTaxRulesSample,
  type ProductAudit,
  type CategoryAudit,
  type CustomerAudit,
  type AddressAudit,
  type SupplierAudit,
  type BrandAudit,
  type CombinationAudit,
  type StockAudit,
  type TaxAudit,
  type TaxRuleGroupAudit,
  type TaxRuleAudit,
} from '../services/importAuditService';
import './ImportAudit.css';

type SectionState<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
};

const DEFAULT_STATE = { items: [], loading: true, error: null } as const;

const ImportAudit: React.FC = () => {
  const [products, setProducts] = useState<SectionState<ProductAudit>>(DEFAULT_STATE);
  const [categories, setCategories] = useState<SectionState<CategoryAudit>>(DEFAULT_STATE);
  const [customers, setCustomers] = useState<SectionState<CustomerAudit>>(DEFAULT_STATE);
  const [addresses, setAddresses] = useState<SectionState<AddressAudit>>(DEFAULT_STATE);
  const [suppliers, setSuppliers] = useState<SectionState<SupplierAudit>>(DEFAULT_STATE);
  const [brands, setBrands] = useState<SectionState<BrandAudit>>(DEFAULT_STATE);
  const [combinations, setCombinations] = useState<SectionState<CombinationAudit>>(DEFAULT_STATE);
  const [stocks, setStocks] = useState<SectionState<StockAudit>>(DEFAULT_STATE);
  const [taxes, setTaxes] = useState<SectionState<TaxAudit>>(DEFAULT_STATE);
  const [taxGroups, setTaxGroups] = useState<SectionState<TaxRuleGroupAudit>>(DEFAULT_STATE);
  const [taxRules, setTaxRules] = useState<SectionState<TaxRuleAudit>>(DEFAULT_STATE);

  const loadAll = useCallback(async () => {
    setProducts((p) => ({ ...p, loading: true, error: null }));
    setCategories((p) => ({ ...p, loading: true, error: null }));
    setCustomers((p) => ({ ...p, loading: true, error: null }));
    setAddresses((p) => ({ ...p, loading: true, error: null }));
    setSuppliers((p) => ({ ...p, loading: true, error: null }));
    setBrands((p) => ({ ...p, loading: true, error: null }));
    setCombinations((p) => ({ ...p, loading: true, error: null }));
    setStocks((p) => ({ ...p, loading: true, error: null }));
    setTaxes((p) => ({ ...p, loading: true, error: null }));
    setTaxGroups((p) => ({ ...p, loading: true, error: null }));
    setTaxRules((p) => ({ ...p, loading: true, error: null }));

    const tasks = await Promise.allSettled([
      fetchProductsSample(),
      fetchCategoriesSample(),
      fetchCustomersSample(),
      fetchAddressesSample(),
      fetchSuppliersSample(),
      fetchBrandsSample(),
      fetchCombinationsSample(),
      fetchStockSample(),
      fetchTaxesSample(),
      fetchTaxRuleGroupsSample(),
      fetchTaxRulesSample(),
    ]);

    const applyResult = <T,>(
      result: PromiseSettledResult<T[]>,
      setter: React.Dispatch<React.SetStateAction<SectionState<T>>>
    ) => {
      if (result.status === 'fulfilled') {
        setter({ items: result.value, loading: false, error: null });
      } else {
        setter({ items: [], loading: false, error: result.reason?.message ?? 'Erreur' });
      }
    };

    applyResult(tasks[0] as PromiseSettledResult<ProductAudit[]>, setProducts);
    applyResult(tasks[1] as PromiseSettledResult<CategoryAudit[]>, setCategories);
    applyResult(tasks[2] as PromiseSettledResult<CustomerAudit[]>, setCustomers);
    applyResult(tasks[3] as PromiseSettledResult<AddressAudit[]>, setAddresses);
    applyResult(tasks[4] as PromiseSettledResult<SupplierAudit[]>, setSuppliers);
    applyResult(tasks[5] as PromiseSettledResult<BrandAudit[]>, setBrands);
    applyResult(tasks[6] as PromiseSettledResult<CombinationAudit[]>, setCombinations);
    applyResult(tasks[7] as PromiseSettledResult<StockAudit[]>, setStocks);
    applyResult(tasks[8] as PromiseSettledResult<TaxAudit[]>, setTaxes);
    applyResult(tasks[9] as PromiseSettledResult<TaxRuleGroupAudit[]>, setTaxGroups);
    applyResult(tasks[10] as PromiseSettledResult<TaxRuleAudit[]>, setTaxRules);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const renderHeader = (title: string, count: number, loading: boolean) => (
    <div className="audit-section-header">
      <h2 className="audit-section-title">{title}</h2>
      <span className="audit-count">{loading ? '...' : count}</span>
    </div>
  );

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <h1 className="audit-title">Audit import</h1>
          <p className="audit-subtitle">Verifier les donnees importees (extraits recents).</p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll}>
          Actualiser
        </button>
      </div>

      <section className="audit-section">
        {renderHeader('Produits', products.items.length, products.loading)}
        {products.error && <p className="audit-error">{products.error}</p>}
        {!products.loading && products.items.length === 0 && !products.error && (
          <p className="audit-empty">Aucun produit.</p>
        )}
        {products.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Reference</th>
                  <th>Prix HT</th>
                  <th>Taxe</th>
                  <th>Actif</th>
                </tr>
              </thead>
              <tbody>
                {products.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.reference}</td>
                    <td>{p.priceHt}</td>
                    <td>{p.taxRulesGroupId}</td>
                    <td>{p.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Declinaisons', combinations.items.length, combinations.loading)}
        {combinations.error && <p className="audit-error">{combinations.error}</p>}
        {!combinations.loading && combinations.items.length === 0 && !combinations.error && (
          <p className="audit-empty">Aucune declinaison.</p>
        )}
        {combinations.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID Produit</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {combinations.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.productId}</td>
                    <td>{c.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Stock', stocks.items.length, stocks.loading)}
        {stocks.error && <p className="audit-error">{stocks.error}</p>}
        {!stocks.loading && stocks.items.length === 0 && !stocks.error && (
          <p className="audit-empty">Aucun stock.</p>
        )}
        {stocks.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>ID Produit</th>
                  <th>Quantite</th>
                </tr>
              </thead>
              <tbody>
                {stocks.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.productId}</td>
                    <td>{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Categories', categories.items.length, categories.loading)}
        {categories.error && <p className="audit-error">{categories.error}</p>}
        {!categories.loading && categories.items.length === 0 && !categories.error && (
          <p className="audit-empty">Aucune categorie.</p>
        )}
        {categories.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {categories.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Clients', customers.items.length, customers.loading)}
        {customers.error && <p className="audit-error">{customers.error}</p>}
        {!customers.loading && customers.items.length === 0 && !customers.error && (
          <p className="audit-empty">Aucun client.</p>
        )}
        {customers.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Prenom</th>
                  <th>Nom</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {customers.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.firstname}</td>
                    <td>{c.lastname}</td>
                    <td>{c.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Adresses', addresses.items.length, addresses.loading)}
        {addresses.error && <p className="audit-error">{addresses.error}</p>}
        {!addresses.loading && addresses.items.length === 0 && !addresses.error && (
          <p className="audit-empty">Aucune adresse.</p>
        )}
        {addresses.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Alias</th>
                  <th>Ville</th>
                  <th>Code postal</th>
                  <th>Pays</th>
                  <th>Client</th>
                </tr>
              </thead>
              <tbody>
                {addresses.items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.alias}</td>
                    <td>{a.city}</td>
                    <td>{a.postcode}</td>
                    <td>{a.countryId}</td>
                    <td>{a.customerId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Fournisseurs', suppliers.items.length, suppliers.loading)}
        {suppliers.error && <p className="audit-error">{suppliers.error}</p>}
        {!suppliers.loading && suppliers.items.length === 0 && !suppliers.error && (
          <p className="audit-empty">Aucun fournisseur.</p>
        )}
        {suppliers.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Marques', brands.items.length, brands.loading)}
        {brands.error && <p className="audit-error">{brands.error}</p>}
        {!brands.loading && brands.items.length === 0 && !brands.error && (
          <p className="audit-empty">Aucune marque.</p>
        )}
        {brands.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {brands.items.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{b.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Taxes', taxes.items.length, taxes.loading)}
        {taxes.error && <p className="audit-error">{taxes.error}</p>}
        {!taxes.loading && taxes.items.length === 0 && !taxes.error && (
          <p className="audit-empty">Aucune taxe.</p>
        )}
        {taxes.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Taux</th>
                </tr>
              </thead>
              <tbody>
                {taxes.items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.name}</td>
                    <td>{t.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Groupes de taxe', taxGroups.items.length, taxGroups.loading)}
        {taxGroups.error && <p className="audit-error">{taxGroups.error}</p>}
        {!taxGroups.loading && taxGroups.items.length === 0 && !taxGroups.error && (
          <p className="audit-empty">Aucun groupe de taxe.</p>
        )}
        {taxGroups.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                </tr>
              </thead>
              <tbody>
                {taxGroups.items.map((g) => (
                  <tr key={g.id}>
                    <td>{g.id}</td>
                    <td>{g.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section">
        {renderHeader('Regles de taxe', taxRules.items.length, taxRules.loading)}
        {taxRules.error && <p className="audit-error">{taxRules.error}</p>}
        {!taxRules.loading && taxRules.items.length === 0 && !taxRules.error && (
          <p className="audit-empty">Aucune regle de taxe.</p>
        )}
        {taxRules.items.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Groupe</th>
                  <th>Taxe</th>
                  <th>Pays</th>
                </tr>
              </thead>
              <tbody>
                {taxRules.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.groupId}</td>
                    <td>{r.taxId}</td>
                    <td>{r.countryId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ImportAudit;
