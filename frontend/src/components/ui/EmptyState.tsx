import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex animate-fade-up flex-col items-center px-4 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-soft text-blue ring-8 ring-blue-soft/50">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-5 font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate">{children}</div>}
    </div>
  )
}
