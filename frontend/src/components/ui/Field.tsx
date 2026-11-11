import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

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
