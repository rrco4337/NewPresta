import type { FinancialFilters, FinancialPeriod } from '../../types/financial.types';

interface PeriodFilterProps {
  filters: FinancialFilters;
  onChange: (filters: FinancialFilters) => void;
}

const PERIOD_OPTIONS: { value: FinancialPeriod; label: string }[] = [
  { value: 'day',   label: "Aujourd'hui" },
  { value: 'week',  label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year',  label: 'Cette année' },
  { value: 'all',   label: 'Tout' },
  { value: 'custom', label: 'Personnalisé' },
];

export function PeriodFilter({ filters, onChange }: PeriodFilterProps) {
  const setPeriod = (period: FinancialPeriod) => {
    onChange({ ...filters, period, dateFrom: null, dateTo: null });
  };

  const setDateFrom = (v: string) => onChange({ ...filters, dateFrom: v || null });
  const setDateTo   = (v: string) => onChange({ ...filters, dateTo: v || null });

  return (
    <div className="fa-filter-bar">
      <span className="fa-filter-label">Période :</span>
      <div className="fa-period-group">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`fa-period-btn${filters.period === opt.value ? ' fa-period-btn--active' : ''}`}
            onClick={() => setPeriod(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filters.period === 'custom' && (
        <div className="fa-custom-range">
          <input
            type="date"
            className="fa-date-input"
            value={filters.dateFrom ?? ''}
            onChange={e => setDateFrom(e.target.value)}
          />
          <span className="fa-date-sep">→</span>
          <input
            type="date"
            className="fa-date-input"
            value={filters.dateTo ?? ''}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
