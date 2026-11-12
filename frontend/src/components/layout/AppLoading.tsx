import { LoaderCircle } from 'lucide-react'

// Shown while the first screen's code downloads on a fresh visit.
export function AppLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper" aria-busy="true">
      <LoaderCircle className="size-8 animate-spin text-link" aria-hidden />
      <span className="sr-only">Loading FDB</span>
    </div>
  )
}
