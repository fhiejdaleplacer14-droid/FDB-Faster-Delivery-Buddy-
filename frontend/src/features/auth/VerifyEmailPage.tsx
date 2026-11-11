import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { toApiError } from '@/lib/http'
import { authApi } from './api'
import { AuthPage } from './AuthPage'
import { useAuth } from './AuthContext'

type State = { kind: 'working' } | { kind: 'done'; message: string } | { kind: 'failed'; message: string }

export function VerifyEmailPage() {
  const { id = '', hash = '' } = useParams()
  const { search } = useLocation()
  const { user, refresh } = useAuth()
  const [state, setState] = useState<State>({ kind: 'working' })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    authApi
      .verifyEmail(id, hash, search.replace(/^\?/, ''))
      .then(async (message) => {
        setState({ kind: 'done', message })
        await refresh().catch(() => undefined)
      })
      .catch((e: unknown) => {
        const error = toApiError(e)
        setState({
          kind: 'failed',
          message:
            error.status === 403
              ? 'This verification link is invalid or has expired.'
              : error.message,
        })
      })
  }, [id, hash, search, refresh])

  return (
    <AuthPage title="Verify your email">
      {state.kind === 'working' && <p className="text-sm text-slate" aria-live="polite">Checking your link…</p>}
      {state.kind === 'done' && <Alert tone="success">{state.message}</Alert>}
      {state.kind === 'failed' && (
        <>
          <Alert tone="error">{state.message}</Alert>
          <p className="mt-4 text-sm text-slate">
            {user ? 'You can send a new link from your account page.' : 'Sign in to send a new link.'}
          </p>
        </>
      )}
      {state.kind !== 'working' && (
        <Link to={user ? '/account' : '/login'} className="mt-6 inline-block font-medium text-link hover:underline">
          {user ? 'Go to your account' : 'Sign in'}
        </Link>
      )}
    </AuthPage>
  )
}
