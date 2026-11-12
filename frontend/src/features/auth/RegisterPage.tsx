import { useState, type ChangeEvent, type SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { AuthPage } from './AuthPage'
import { useAuth } from './AuthContext'
import { afterSignIn, withNext } from './guards'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const next = useSearchParams()[0].get('next')
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const update = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register(form)
      navigate(afterSignIn(next, true), { replace: true })
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  const hasFieldErrors = error && Object.keys(error.fieldErrors).length > 0

  return (
    <AuthPage title="Create your FDB account" intro="Shop from local sellers in Vallehermoso, Guihulngan, and San Carlos City.">
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && !hasFieldErrors && <Alert tone="error">{error.message}</Alert>}
        <TextField label="Full name" autoComplete="name" required value={form.name} onChange={update('name')} error={firstError(error, 'name')} />
        <TextField label="Email" type="email" autoComplete="email" required value={form.email} onChange={update('email')} error={firstError(error, 'email')} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters, with letters and numbers."
          required
          value={form.password}
          onChange={update('password')}
          error={firstError(error, 'password')}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password_confirmation}
          onChange={update('password_confirmation')}
        />
        <Button type="submit" busy={busy} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-8 text-sm text-slate">
        Already have an account?{' '}
        <Link to={withNext('/login', next)} className="font-medium text-link hover:underline">
          Sign in
        </Link>
      </p>
    </AuthPage>
  )
}
