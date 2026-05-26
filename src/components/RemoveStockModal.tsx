import React, { useState, useEffect } from 'react';
import { authService, AuthError } from '../services/authService';
import { fetchShopCategories, type ShopCategory } from '../services/shopService';
import { stockService } from '../services/stockService';

interface RemoveResult {
  productId: string;
  productName: string;
  combinationLabel: string;
  qtyWanted: number;
  qtyActuallyRemoved: number;
}

type Step = 'password' | 'form' | 'loading' | 'result';

interface Props {
  onClose: () => void;
}

const RemoveStockModal: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState<Step>('password');

  const [password, setPassword] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');

  const [results, setResults] = useState<RemoveResult[]>([]);
  const [opError, setOpError] = useState<string | null>(null);

  useEffect(() => {
    fetchShopCategories().then(setCategories);
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setPwdError(null);
    setPwdLoading(true);

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      setPwdError('Aucun administrateur connecté.');
      setPwdLoading(false);
      return;
    }

    try {
      await authService.login({ email: currentUser.email, password });
      setStep('form');
    } catch (err) {
      if (err instanceof AuthError && err.code === 'INVALID_CREDENTIALS') {
        setPwdError('Mot de passe incorrect. Veuillez réessayer.');
      } else {
        setPwdError('Erreur de connexion. Vérifiez votre réseau.');
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const qty = parseInt(quantity, 10);
    if (selectedCategoryId === '') {
      setFormError('Veuillez choisir une catégorie.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setFormError('Veuillez saisir une quantité valide (> 0).');
      return;
    }

    const cat = categories.find(c => c.id === Number(selectedCategoryId));
    setSelectedCategoryName(cat?.name ?? '');
    setStep('loading');

    try {
      const res = await stockService.decreaseStockByCategory(Number(selectedCategoryId), qty);
      setResults(res);
      setOpError(null);
    } catch (err) {
      setOpError((err as Error).message || 'Erreur lors du retrait de stock.');
      setResults([]);
    }
    setStep('result');
  };

  const stepLabel: Record<Step, string> = {
    password: "Vérification de l'identité",
    form: 'Sélection de la catégorie',
    loading: 'Opération en cours…',
    result: 'Récapitulatif',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,22,40,0.6)', backdropFilter: 'blur(4px)',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px',
        boxShadow: '0 24px 64px rgba(15,22,40,0.2)',
        width: '100%', maxWidth: '520px',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '22px 28px 18px',
          borderBottom: '1px solid #f1f4f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
            }}>
              <i className="fa-solid fa-circle-minus"></i>
            </div>
            <div>
              <h2 style={{
                margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '1.05rem', fontWeight: 800, color: '#0f1620',
              }}>
                Retirer du stock
              </h2>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#a3b0c8' }}>
                {stepLabel[step]}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f4f9', border: '1.5px solid #d0d7e1',
              borderRadius: '8px', width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#6b7a99', fontSize: '0.82rem',
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '24px 28px' }}>

          {/* ── Step 1 : Mot de passe ── */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7a99', lineHeight: 1.65 }}>
                Cette action nécessite votre mot de passe administrateur.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{
                  fontSize: '0.72rem', fontWeight: 700, color: '#4a5568',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Mot de passe admin
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPwdError(null); }}
                  placeholder="••••••••"
                  autoFocus
                  style={{
                    padding: '10px 14px',
                    border: `1.5px solid ${pwdError ? '#fca5a5' : '#d0d7e1'}`,
                    borderRadius: '10px', fontSize: '0.9rem',
                    background: pwdError ? '#fef2f2' : '#f1f4f9',
                    color: '#0f1620', outline: 'none',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                  onBlur={e => {
                    e.target.style.borderColor = pwdError ? '#fca5a5' : '#d0d7e1';
                    e.target.style.background = pwdError ? '#fef2f2' : '#f1f4f9';
                  }}
                />
              </div>

              {pwdError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '10px',
                  background: '#fff5f5', border: '1px solid #fecaca',
                  fontSize: '0.82rem', color: '#dc2626',
                }}>
                  <i className="fa-solid fa-circle-exclamation"></i>
                  {pwdError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{
                  padding: '9px 20px', border: '1.5px solid #d0d7e1',
                  borderRadius: '10px', background: '#fff',
                  fontSize: '0.82rem', fontWeight: 600, color: '#6b7a99',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!password || pwdLoading}
                  style={{
                    padding: '9px 22px', border: 'none', borderRadius: '10px',
                    background: !password || pwdLoading
                      ? '#e2e8f0'
                      : 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                    fontSize: '0.82rem', fontWeight: 700,
                    color: !password || pwdLoading ? '#94a3b8' : '#fff',
                    cursor: !password || pwdLoading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    display: 'flex', alignItems: 'center', gap: '7px',
                    boxShadow: !password || pwdLoading ? 'none' : '0 3px 10px rgba(67,97,238,0.3)',
                  }}
                >
                  {pwdLoading ? (
                    <>
                      <div style={{
                        width: '13px', height: '13px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff', borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      Vérification…
                    </>
                  ) : (
                    <><i className="fa-solid fa-shield-halved"></i>Vérifier</>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2 : Formulaire catégorie + quantité ── */}
          {step === 'form' && (
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7a99', lineHeight: 1.65 }}>
                Choisissez la catégorie et la quantité à retirer pour chaque produit de cette catégorie.
                Si un produit a moins de stock que la quantité demandée, son stock sera mis à <strong>0</strong>.
              </p>

              {/* Catégorie */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{
                  fontSize: '0.72rem', fontWeight: 700, color: '#4a5568',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Catégorie
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={e => {
                    setSelectedCategoryId(e.target.value === '' ? '' : Number(e.target.value));
                    setFormError(null);
                  }}
                  style={{
                    padding: '10px 14px', border: '1.5px solid #d0d7e1',
                    borderRadius: '10px', fontSize: '0.875rem',
                    background: '#f1f4f9', color: '#0f1620',
                    outline: 'none', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <option value="">Choisir une catégorie…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Quantité */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{
                  fontSize: '0.72rem', fontWeight: 700, color: '#4a5568',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  Quantité à retirer (par produit/déclinaison)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => { setQuantity(e.target.value); setFormError(null); }}
                  placeholder="Ex : 5"
                  style={{
                    padding: '10px 14px', border: '1.5px solid #d0d7e1',
                    borderRadius: '10px', fontSize: '0.9rem',
                    background: '#f1f4f9', color: '#0f1620',
                    outline: 'none', fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#4361ee'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#d0d7e1'; e.target.style.background = '#f1f4f9'; }}
                />
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#a3b0c8' }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }}></i>
                  Si un produit possède moins que cette quantité, il sera ramené à 0.
                </p>
              </div>

              {formError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '10px',
                  background: '#fff5f5', border: '1px solid #fecaca',
                  fontSize: '0.82rem', color: '#dc2626',
                }}>
                  <i className="fa-solid fa-circle-exclamation"></i>
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{
                  padding: '9px 20px', border: '1.5px solid #d0d7e1',
                  borderRadius: '10px', background: '#fff',
                  fontSize: '0.82rem', fontWeight: 600, color: '#6b7a99',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  Annuler
                </button>
                <button type="submit" style={{
                  padding: '9px 22px', border: 'none', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  boxShadow: '0 3px 10px rgba(220,38,38,0.3)',
                }}>
                  <i className="fa-solid fa-circle-minus"></i>
                  Retirer le stock
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3 : Loading ── */}
          {step === 'loading' && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '16px', padding: '36px 0',
            }}>
              <div style={{
                width: '48px', height: '48px',
                border: '3px solid #ecedf5',
                borderTopColor: '#4361ee', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7a99', fontWeight: 600 }}>
                Retrait de stock en cours…
              </p>
            </div>
          )}

          {/* ── Step 4 : Résultat ── */}
          {step === 'result' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {opError ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '14px 16px', borderRadius: '12px',
                  background: '#fff5f5', border: '1px solid #fecaca',
                  fontSize: '0.875rem', color: '#dc2626',
                }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  {opError}
                </div>
              ) : (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: '#f0fdf4', border: '1px solid #a7f3d0',
                    fontSize: '0.82rem', color: '#065f46',
                  }}>
                    <i className="fa-solid fa-circle-check"></i>
                    Opération effectuée — Catégorie :&nbsp;<strong>{selectedCategoryName}</strong>
                  </div>

                  {results.length === 0 ? (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                      padding: '32px 0', color: '#a3b0c8', textAlign: 'center',
                    }}>
                      <i className="fa-solid fa-box-open" style={{ fontSize: '1.5rem' }}></i>
                      <p style={{ margin: 0, fontSize: '0.875rem' }}>Aucun produit trouvé dans cette catégorie.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', maxHeight: '340px', overflowY: 'auto', borderRadius: '10px', border: '1px solid #d0d7e1' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#f2f5fa' }}>
                            {['Produit', 'Déclinaison', 'Qté demandée', 'Qté retirée'].map(h => (
                              <th key={h} style={{
                                padding: '9px 12px', textAlign: h.startsWith('Qté') ? 'center' : 'left',
                                fontSize: '0.65rem', fontWeight: 700, color: '#6b7a99',
                                textTransform: 'uppercase', letterSpacing: '0.07em',
                                borderBottom: '1px solid #d0d7e1', whiteSpace: 'nowrap',
                                position: 'sticky', top: 0, background: '#f2f5fa',
                              }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r, i) => {
                            const partial = r.qtyActuallyRemoved < r.qtyWanted;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f4f9' }}>
                                <td style={{
                                  padding: '8px 12px', color: '#0f1620',
                                  fontWeight: 600, maxWidth: '160px',
                                }}>
                                  <span style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}>
                                    {r.productName}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', color: '#6b7a99', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                  {r.combinationLabel || '—'}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 9px', borderRadius: '999px',
                                    background: '#ecedf5', color: '#4a5568',
                                    fontWeight: 700, fontSize: '0.78rem',
                                  }}>
                                    {r.qtyWanted}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '2px 9px', borderRadius: '999px',
                                    background: partial ? '#fef3c7' : '#d1fae5',
                                    color: partial ? '#92400e' : '#065f46',
                                    fontWeight: 700, fontSize: '0.78rem',
                                  }}>
                                    {partial && <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '0.6rem' }}></i>}
                                    {r.qtyActuallyRemoved}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f2f5fa', borderTop: '2px solid #d0d7e1' }}>
                            <td colSpan={2} style={{
                              padding: '9px 12px',
                              fontSize: '0.72rem', fontWeight: 700,
                              color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em',
                            }}>
                              Total ({results.length} ligne{results.length !== 1 ? 's' : ''})
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{ fontWeight: 800, color: '#0f1620', fontSize: '0.84rem' }}>
                                {results.reduce((s, r) => s + r.qtyWanted, 0)}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{ fontWeight: 800, color: '#0f1620', fontSize: '0.84rem' }}>
                                {results.reduce((s, r) => s + r.qtyActuallyRemoved, 0)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {results.some(r => r.qtyActuallyRemoved < r.qtyWanted) && (
                    <p style={{
                      margin: 0, fontSize: '0.75rem', color: '#92400e',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      Les lignes en jaune avaient un stock inférieur à la quantité demandée — leur stock a été mis à 0.
                    </p>
                  )}
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{
                  padding: '9px 24px', border: 'none', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4361ee 0%, #7c3aed 100%)',
                  fontSize: '0.82rem', fontWeight: 700, color: '#fff',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 3px 10px rgba(67,97,238,0.3)',
                }}>
                  Fermer
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default RemoveStockModal;
