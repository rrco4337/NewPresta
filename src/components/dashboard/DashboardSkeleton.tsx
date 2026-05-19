export function DashboardSkeleton() {
  return (
    <div className="db-skeleton">
      <div className="db-skel-block db-skel-header" />
      <div className="db-skel-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="db-skel-block db-skel-card" />
        ))}
      </div>
      <div className="db-skel-block db-skel-table" />
    </div>
  );
}
 
