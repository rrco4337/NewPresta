import { formatCurrency } from '../../utils/formatCurrency';

interface StatsCardsProps {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  cancelledOrders?: number;
  cancelledTotal?: number;
}

const cardStyle = (accent: string, bg: string): React.CSSProperties => ({
  background: '#fff',
  border: '1px solid #d0d7e1',
  borderRadius: '16px',
  padding: '22px 24px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '16px',
  boxShadow: '0 2px 8px rgba(15,22,40,0.06)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  cursor: 'default',
  position: 'relative',
  overflow: 'hidden',
});

const iconStyle = (bg: string, color: string): React.CSSProperties => ({
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  background: bg,
  color: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.1rem',
  flexShrink: 0,
});

export function StatsCards({ totalOrders, totalRevenue, averageOrderValue, cancelledOrders = 0 }: StatsCardsProps) {
  const activeOrders = totalOrders - cancelledOrders;

  const cards = [
    {
      icon: 'fa-solid fa-bag-shopping',
      label: 'Total commandes',
      value: String(totalOrders),
      valueType: 'number',
      iconBg: '#eef1fd', iconColor: '#4361ee',
      accent: '#4361ee',
      sub: [
        { label: `${activeOrders} validées`, color: '#065f46', bg: '#d1fae5', icon: 'fa-solid fa-circle-check' },
        { label: `${cancelledOrders} annulées`, color: '#9b1c1c', bg: '#fee2e2', icon: 'fa-solid fa-circle-xmark' },
      ],
      trend: '+12%',
      trendUp: true,
    },
    {
      icon: 'fa-solid fa-arrow-trend-up',
      label: "Chiffre d'affaires",
      value: formatCurrency(totalRevenue),
      valueType: 'currency',
      iconBg: '#d1fae5', iconColor: '#059669',
      accent: '#059669',
      sub: [],
      trend: '+8.3%',
      trendUp: true,
    },
    {
      icon: 'fa-solid fa-chart-pie',
      label: 'Panier moyen',
      value: formatCurrency(averageOrderValue),
      valueType: 'currency',
      iconBg: '#ede9fe', iconColor: '#7c3aed',
      accent: '#7c3aed',
      sub: [],
      trend: '-2.1%',
      trendUp: false,
    },
    {
      icon: 'fa-solid fa-triangle-exclamation',
      label: 'Commandes annulées',
      value: String(cancelledOrders),
      valueType: 'number',
      iconBg: '#fee2e2', iconColor: '#dc2626',
      accent: '#dc2626',
      sub: [],
      trend: cancelledOrders > 0 ? `${Math.round((cancelledOrders / Math.max(totalOrders, 1)) * 100)}%` : '0%',
      trendUp: false,
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
    }}>
      {cards.map((card, idx) => (
        <div
          key={idx}
          style={cardStyle(card.accent, card.iconBg)}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = 'translateY(-3px)';
            el.style.boxShadow = '0 10px 28px rgba(15,22,40,0.12)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = '';
            el.style.boxShadow = '0 2px 8px rgba(15,22,40,0.06)';
          }}
        >
          {/* Accent line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '3px', background: card.accent,
            borderRadius: '16px 16px 0 0', opacity: 0.7,
          }} />

          <div style={iconStyle(card.iconBg, card.iconColor)}>
            <i className={card.icon}></i>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: '0 0 6px',
              fontSize: '0.68rem', fontWeight: 700, color: '#a3b0c8',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{card.label}</p>

            <p style={{
              margin: 0,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '1.6rem', fontWeight: 800,
              color: '#0f1620', lineHeight: 1.1,
              letterSpacing: '-0.5px',
            }}>{card.value}</p>

            {card.sub.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                {card.sub.map((s, si) => (
                  <span key={si} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '0.72rem', fontWeight: 600,
                    color: s.color, background: s.bg,
                    borderRadius: '999px', padding: '2px 9px', width: 'fit-content',
                  }}>
                    <i className={s.icon} style={{ fontSize: '0.65rem' }}></i>
                    {s.label}
                  </span>
                ))}
              </div>
            )}

            {card.sub.length === 0 && (
              <div style={{ marginTop: '8px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '0.72rem', fontWeight: 700,
                  color: card.trendUp ? '#059669' : '#dc2626',
                  background: card.trendUp ? '#d1fae5' : '#fee2e2',
                  borderRadius: '999px', padding: '2px 8px',
                }}>
                  <i className={card.trendUp ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down'} style={{ fontSize: '0.65rem' }}></i>
                  {card.trend}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
