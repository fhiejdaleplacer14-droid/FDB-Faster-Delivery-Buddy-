import { CheckCircle2 } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

const reasons = ['Stores from Vallehermoso, Guihulngan, and San Carlos City', 'Delivered by the seller, paid on delivery', 'Every seller reviewed by FDB']

// Fills the space under the header; the brand panel shows on wide screens only.
export function AuthPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-6 sm:px-6 sm:py-10 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center lg:py-12">
      <aside className="relative hidden h-full max-h-144 min-h-112 overflow-hidden rounded-3xl bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-end" aria-hidden>
        <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-blue/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-72 rounded-full bg-blue-300/10 blur-3xl" />
        <div className="relative animate-fade-up">
          <p className="text-4xl leading-tight font-extrabold tracking-tight">
            Your favorite finds,
            <br />
            <span className="text-blue-300">closer than ever.</span>
          </p>
          <ul className="stagger mt-8 space-y-3 text-sm text-white/80">
            {reasons.map((r, i) => (
              <li key={r} className="flex items-center gap-2.5" style={{ '--i': i + 2 } as CSSProperties}>
                <CheckCircle2 className="size-4 shrink-0 text-blue-300" />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <svg viewBox="0 0 400 120" className="absolute -top-2 -right-10 w-md text-white/10">
          <path d="M0 90 C 90 20, 170 120, 260 60 S 380 30, 420 70" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="10 14" strokeLinecap="round" className="animate-route" />
        </svg>
      </aside>

      <div className="mx-auto w-full max-w-sm animate-fade-up lg:max-w-none">
        <div className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-heading">{title}</h1>
          {intro && <p className="mt-2 text-sm text-slate">{intro}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  )
}
