export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4" style={{ opacity: 1 - i * 0.15 }}>
          <div className="skeleton size-10 shrink-0 rounded-lg" />
          <div className="skeleton h-4 flex-1 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}
