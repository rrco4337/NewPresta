import { type DailyOrderStat } from '../../types/dashboard.types';
import { formatCurrency } from '../../utils/formatCurrency';

interface OrdersTableProps { dailyStats: DailyOrderStat[]; }

function formatDate(raw: string): string {
  const d = new Date(raw + 'T00:00:00');
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function OrdersTable({ dailyStats }: OrdersTableProps) {
  const sorted = [...dailyStats].sort((a, b) => b.date.localeCompare(a.date));
  const totalRevenue = sorted.reduce((s, d) => s + d.totalAmount, 0);
  const totalOrders  = sorted.reduce((s, d) => s + d.orderCount, 0);

  return (
    <div style={{
      background: '#fff', border: '1px solid #d0d7e1',
      borderRadius: '16px', overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(15,22,40,0.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid #f1f4f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '9px',
            background: '#eef1fd', color: '#4361ee',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem',
          }}>
            <i className="fa-solid fa-calendar-days"></i>
          </div>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#0f1620' }}>
              Détail par jour
            </h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#a3b0c8' }}>Historique des commandes quotidiennes</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            padding: '4px 12px', borderRadius: '999px',
            background: '#eef1fd', color: '#4361ee',
            fontSize: '0.72rem', fontWeight: 700,
          }}>
            {sorted.length} jour{sorted.length !== 1 ? 's' : ''}
          </span>
          <span style={{
            padding: '4px 12px', borderRadius: '999px',
            background: '#d1fae5', color: '#059669',
            fontSize: '0.72rem', fontWeight: 700,
          }}>
            {formatCurrency(totalRevenue)}
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          padding: '64px 24px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#a3b0c8', fontSize: '1.2rem',
          }}>
            <i className="fa-regular fa-calendar-xmark"></i>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7a99', fontWeight: 600 }}>Aucune donnée disponible</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f2f5fa' }}>
                <th style={{
                  padding: '10px 24px', textAlign: 'left',
                  fontSize: '0.65rem', fontWeight: 700, color: '#6b7a99',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderBottom: '1px solid #d0d7e1', whiteSpace: 'nowrap',
                }}>
                  <i className="fa-regular fa-calendar" style={{ marginRight: '6px', color: '#4361ee' }}></i>
                  Date
                </th>
                <th style={{
                  padding: '10px 24px', textAlign: 'left',
                  fontSize: '0.65rem', fontWeight: 700, color: '#6b7a99',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderBottom: '1px solid #d0d7e1',
                }}>
                  <i className="fa-solid fa-bag-shopping" style={{ marginRight: '6px', color: '#4361ee' }}></i>
                  Commandes
                </th>
                <th style={{
                  padding: '10px 24px', textAlign: 'right',
                  fontSize: '0.65rem', fontWeight: 700, color: '#6b7a99',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderBottom: '1px solid #d0d7e1',
                }}>
                  <i className="fa-solid fa-arrow-trend-up" style={{ marginRight: '6px', color: '#059669' }}></i>
                  Montant total
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((day, idx) => {
                const isCancelled = day.totalAmount === 0 && day.orderCount > 0;
                const displayAmount = isCancelled ? '0,00 €' : formatCurrency(day.totalAmount);

                return (
                  <tr
                    key={day.date}
                    style={{
                      borderBottom: idx < sorted.length - 1 ? '1px solid #f1f4f9' : 'none',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f2f5fa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '14px 24px', color: '#0f1620', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: isCancelled ? '#dc2626' : '#10b981', flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{formatDate(day.date)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 24px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: '28px', padding: '3px 10px',
                        background: '#eef1fd', color: '#4361ee',
                        borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                      }}>
                        {day.orderCount}
                      </span>
                    </td>
                    <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                      <span style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontWeight: 700, fontSize: '0.88rem',
                        color: isCancelled ? '#dc2626' : '#059669',
                      }}>
                        {isCancelled && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '5px', fontSize: '0.75rem' }}></i>}
                        {displayAmount}
                        {isCancelled && <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#dc2626', marginLeft: '5px' }}>(annulé)</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totaux */}
            <tfoot>
              <tr style={{ background: '#f2f5fa', borderTop: '2px solid #d0d7e1' }}>
                <td style={{ padding: '12px 24px', fontWeight: 700, fontSize: '0.82rem', color: '#4a5568' }}>
                  <i className="fa-solid fa-sigma" style={{ marginRight: '6px', color: '#4361ee' }}></i>
                  Total
                </td>
                <td style={{ padding: '12px 24px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: '28px', padding: '3px 10px',
                    background: '#4361ee', color: '#fff',
                    borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                  }}>
                    {totalOrders}
                  </span>
                </td>
                <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 800, fontSize: '0.95rem', color: '#059669',
                  }}>
                    {formatCurrency(totalRevenue)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
