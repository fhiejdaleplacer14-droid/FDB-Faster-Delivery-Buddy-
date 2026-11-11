import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info' | 'warning'

const tones: Record<Tone, string> = {
  error: 'border-danger/30 bg-danger/5 text-danger',
  success: 'border-success/30 bg-success/5 text-success',
  info: 'border-blue/20 bg-blue-soft text-heading',
  warning: 'border-warning/30 bg-warning/5 text-warning',
}

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  )
}
