import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

type FieldShellProps = {
  id: string
  label: string
  hint?: string | undefined
  error?: string | undefined
  children: ReactNode
}

const control =
  'block w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink shadow-sm transition placeholder:text-slate/70 hover:border-slate/40 focus:border-blue focus:outline-none focus:ring-4 focus:ring-blue/15 aria-invalid:border-danger aria-invalid:ring-danger/10'

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-slate">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function describedBy(id: string, hint?: string, error?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
}

type Common = { label: string; hint?: string | undefined; error?: string | undefined }

export function TextField({ label, hint, error, className = '', ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${control} border-line ${className}`}
      />
    </FieldShell>
  )
}

// Password input with an eye button to show or hide what was typed.
export function PasswordField({ label, hint, error, className = '', ...props }: Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={`${control} border-line pr-11 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-controls={id}
          aria-pressed={visible}
          title={visible ? 'Hide' : 'Show'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate transition hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
        >
          <Icon key={String(visible)} className="size-5 animate-scale-in" aria-hidden />
        </button>
      </div>
    </FieldShell>
  )
}

export function TextareaField({ label, hint, error, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={4}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${control} border-line`}
      />
    </FieldShell>
  )
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${control} border-line`}
      >
        {children}
      </select>
    </FieldShell>
  )
}
