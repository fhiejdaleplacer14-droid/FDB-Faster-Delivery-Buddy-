import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { authApi } from '@/features/auth/api'
import { useAuth } from '@/features/auth/AuthContext'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { User } from '@/types/api'

export function AccountPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-navy">Your account</h1>
      {params.get('welcome') && (
        <div className="mt-4">
          <Alert tone="success">Welcome to FDB, {user.name}. Your account is ready.</Alert>
        </div>
      )}
      {!user.email_verified && <VerifyEmailNotice />}

      <section aria-labelledby="profile-heading" className="mt-10 border-t border-line pt-8">
        <h2 id="profile-heading" className="text-lg font-semibold text-navy">
          Profile
        </h2>
        <ProfileForm user={user} />
      </section>

      <section aria-labelledby="password-heading" className="mt-10 border-t border-line pt-8">
        <h2 id="password-heading" className="text-lg font-semibold text-navy">
          Password
        </h2>
        <PasswordForm />
      </section>

      <section aria-labelledby="selling-heading" className="mt-10 border-t border-line pt-8">
        <h2 id="selling-heading" className="text-lg font-semibold text-navy">
          Selling on FDB
        </h2>
        <p className="mt-2 text-sm text-slate">
          {user.seller
            ? `Your store, ${user.seller.store_name}, is on FDB.`
            : 'Have products to sell? Apply to open a store on FDB.'}
        </p>
        <Link to="/sell" className="mt-3 inline-block text-sm font-semibold text-blue hover:underline">
          {user.seller ? 'View your seller application' : 'Apply to sell'}
        </Link>
      </section>
    </div>
  )
}

function VerifyEmailNotice() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function resend() {
    setBusy(true)
    setError(null)
    try {
      setMessage(await authApi.resendVerification())
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Alert tone="warning">
        Check your email for a link to verify your address. You need a verified email to apply as a seller.
      </Alert>
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}
      <Button variant="secondary" busy={busy} onClick={resend}>
        Send a new verification link
      </Button>
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const updated = await authApi.updateProfile({ name, email })
      setUser(updated)
      setSaved(
        updated.email_verified ? 'Profile saved.' : 'Profile saved. We sent a verification link to your new email.',
      )
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 max-w-md space-y-5">
      {saved && <Alert tone="success">{saved}</Alert>}
      <TextField label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={firstError(error, 'name')} />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        hint="Changing your email means verifying it again."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={firstError(error, 'email')}
      />
      <Button type="submit" busy={busy}>
        Save profile
      </Button>
    </form>
  )
}

function PasswordForm() {
  const empty = { current_password: '', password: '', password_confirmation: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await authApi.updatePassword(form)
      setForm(empty)
      setSaved(true)
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 max-w-md space-y-5">
      {saved && <Alert tone="success">Password changed. Other devices have been signed out.</Alert>}
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={form.current_password}
        onChange={(e) => setForm({ ...form, current_password: e.target.value })}
        error={firstError(error, 'current_password')}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters, with letters and numbers."
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        error={firstError(error, 'password')}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={form.password_confirmation}
        onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
      />
      <Button type="submit" busy={busy}>
        Change password
      </Button>
    </form>
  )
}
