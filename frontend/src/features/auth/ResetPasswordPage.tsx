import { useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/ui/Field'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { authApi } from './api'
import { AuthPage } from './AuthPage'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  if (!token || !email) {
    return (
      <AuthPage title="This reset link is incomplete">
        <p className="text-sm text-slate">Open the link from your email again, or request a new one.</p>
        <Link to="/forgot-password" className="mt-6 inline-block font-medium text-link hover:underline">
          Request a new link
        </Link>
      </AuthPage>
    )
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setDone(await authApi.resetPassword({ token, email, password, password_confirmation: confirmation }))
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthPage title="Password updated">
        <Alert tone="success">{done}</Alert>
        <Link to="/login" className="mt-6 inline-block font-medium text-link hover:underline">
          Sign in
        </Link>
      </AuthPage>
    )
  }

  const linkError = firstError(error, 'email')

  return (
    <AuthPage title="Choose a new password" intro={`For ${email}`}>
      <form onSubmit={submit} noValidate className="space-y-5">
        {linkError && (
          <Alert tone="error">
            {linkError}{' '}
            <Link to="/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          </Alert>
        )}
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 10 characters, with letters and numbers."
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={firstError(error, 'password')}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Button type="submit" busy={busy} className="w-full">
          Save new password
        </Button>
      </form>
    </AuthPage>
  )
}
