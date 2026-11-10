import type { ReactNode } from 'react'

export function AuthPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-navy">{title}</h1>
      {intro && <p className="mt-2 text-sm text-slate">{intro}</p>}
      <div className="mt-8">{children}</div>
    </div>
  )
}
