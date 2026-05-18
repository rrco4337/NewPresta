export function FinancialSkeleton() {
  return (
    <div className="fa-skeleton">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="fa-skel-block fa-skel-header" />
        <div className="fa-skel-block" style={{ width: 110, height: 38, borderRadius: 10 }} />
      </div>

      {/* Period filter */}
      <div className="fa-skel-block fa-skel-filter" />

      {/* Category filter */}
      <div className="fa-skel-block" style={{ height: 50 }} />

      {/* KPI cards */}
      <div className="fa-skel-grid">
        <div className="fa-skel-block fa-skel-card" />
        <div className="fa-skel-block fa-skel-card" />
        <div className="fa-skel-block fa-skel-card" />
      </div>

      {/* Chart */}
      <div className="fa-skel-block fa-skel-chart" />

      {/* Table */}
      <div className="fa-skel-block fa-skel-table" />
    </div>
  );
}
