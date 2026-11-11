import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

const variants: Record<Variant, string> = {
  primary: 'bg-blue text-white shadow-sm shadow-blue/25 hover:bg-blue/90 hover:shadow-md hover:shadow-blue/25 disabled:bg-blue/50 disabled:shadow-none',
  secondary: 'border border-line bg-surface text-ink shadow-sm hover:border-slate/40 hover:bg-paper disabled:text-slate',
  danger: 'bg-danger-solid text-white shadow-sm shadow-danger-solid/20 hover:bg-danger-solid/90 disabled:bg-danger-solid/50',
  ghost: 'text-ink hover:bg-ink/5 disabled:text-slate',
  success: 'bg-success-solid text-white shadow-sm shadow-success-solid/25',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  busy?: boolean
}

export function Button({ variant = 'primary', busy = false, className = '', disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-200 ease-out enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:scale-[0.98] disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
