export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[1,2,3].map(i => <div key={i} className="bg-gray-200 h-28 rounded-2xl" />)}
      </div>
      <div className="bg-gray-200 h-80 rounded-2xl mb-8" />
      <div className="bg-gray-200 h-64 rounded-2xl" />
    </div>
  );
}