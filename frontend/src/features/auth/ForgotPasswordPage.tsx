import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import { authApi } from './api'
import { AuthPage } from './AuthPage'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setSent(await authApi.forgotPassword(email))
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPage title="Reset your password" intro="Enter the email you use for FDB and we will send you a reset link.">
      {sent ? (
        <Alert tone="success">{sent}</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {error && !firstError(error, 'email') && <Alert tone="error">{error.message}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={firstError(error, 'email')}
          />
          <Button type="submit" busy={busy} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-8 text-sm">
        <Link to="/login" className="font-medium text-link hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthPage>
  )
}
