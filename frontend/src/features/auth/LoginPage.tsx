import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { AuthPage } from './AuthPage'
import { useAuth } from './AuthContext'
import { safeNext } from './guards'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login({ email, password, remember })
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  const emailError = firstError(error, 'email')

  return (
    <AuthPage title="Sign in to FDB">
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && !emailError && <Alert tone="error">{error.message}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={firstError(error, 'password')}
        />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-ink">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-blue" />
            Keep me signed in
          </label>
          <Link to="/forgot-password" className="font-medium text-link hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" busy={busy} className="w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-8 text-sm text-slate">
        New to FDB?{' '}
        <Link to="/register" className="font-medium text-link hover:underline">
          Create an account
        </Link>
      </p>
    </AuthPage>
  )
}
