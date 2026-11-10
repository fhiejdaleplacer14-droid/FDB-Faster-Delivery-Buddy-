import { CheckCircle2 } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'

const reasons = ['Stores from Vallehermoso, Guihulngan, and San Carlos City', 'Delivered by the seller, paid on delivery', 'Every seller reviewed by FDB']

export function AuthPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
      <aside className="relative hidden overflow-hidden rounded-3xl bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between" aria-hidden>
        <Logo tone="dark" />
        <div className="animate-fade-up">
          <p className="text-3xl leading-tight font-extrabold tracking-tight">
            Your favorite finds,
            <br />
            <span className="text-blue-300">closer than ever.</span>
          </p>
          <ul className="stagger mt-8 space-y-3 text-sm text-white/80">
            {reasons.map((r, i) => (
              <li key={r} className="flex items-center gap-2" style={{ '--i': i + 2 } as CSSProperties}>
                <CheckCircle2 className="size-4 shrink-0 text-blue-300" />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <svg viewBox="0 0 400 120" className="absolute -right-10 -bottom-4 w-md text-white/10">
          <path d="M0 90 C 90 20, 170 120, 260 60 S 380 30, 420 70" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="10 14" strokeLinecap="round" className="animate-route" />
        </svg>
      </aside>

      <div className="mx-auto w-full max-w-sm animate-fade-up self-center lg:py-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">{title}</h1>
        {intro && <p className="mt-2 text-sm text-slate">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </div>
  )
}
