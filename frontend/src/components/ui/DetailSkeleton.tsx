// Placeholder for a detail page while its data loads, so the page never looks empty.
export function DetailSkeleton() {
  return (
    <div className="mt-4 space-y-4" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="skeleton h-8 w-2/3 rounded-lg" />
      <div className="skeleton h-4 w-1/2 rounded" />
      <div className="skeleton h-32 rounded-xl" />
      <div className="skeleton h-24 rounded-xl" />
    </div>
  )
}
