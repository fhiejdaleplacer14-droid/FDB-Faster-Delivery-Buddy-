import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SellerStatusBadge, sellerStatusLabel } from '@/components/ui/StatusBadge'
import { useAuth } from '@/features/auth/AuthContext'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import type { SellerApplication } from '@/types/api'
import { sellerApi } from './api'
import { SellerApplicationForm } from './SellerApplicationForm'

type Load = { kind: 'loading' } | { kind: 'error'; error: ApiError } | { kind: 'ready'; application: SellerApplication | null }

export function SellPage() {
  const { user, refresh } = useAuth()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    sellerApi
      .mine()
      .then((application) => setLoad({ kind: 'ready', application }))
      .catch((e: unknown) => setLoad({ kind: 'error', error: toApiError(e) }))
  }, [])

  async function saved(application: SellerApplication) {
    setLoad({ kind: 'ready', application })
    setEditing(false)
    window.scrollTo({ top: 0 })
    await refresh().catch(() => undefined)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-navy">Sell on FDB</h1>

      {load.kind === 'loading' && <p className="mt-6 text-sm text-slate" aria-live="polite">Loading your application…</p>}
      {load.kind === 'error' && (
        <div className="mt-6">
          <Alert tone="error">{load.error.message}</Alert>
        </div>
      )}

      {load.kind === 'ready' && !load.application && (
        <>
          <p className="mt-2 max-w-xl text-slate">
            Open a store and reach customers in your town. You set your own prices, keep your own stock, and deliver
            orders yourself. FDB reviews every application before a store goes live.
          </p>
          {user && !user.email_verified ? (
            <div className="mt-8">
              <Alert tone="warning">
                Verify your email before applying.{' '}
                <Link to="/account" className="font-semibold underline">
                  Go to your account
                </Link>{' '}
                to send a new verification link.
              </Alert>
            </div>
          ) : (
            <div className="mt-10">
              <SellerApplicationForm
                submitLabel="Send application"
                onSubmit={async (details, documents) => saved(await sellerApi.submit(details, documents))}
              />
            </div>
          )}
        </>
      )}

      {load.kind === 'ready' && load.application && (
        <>
          <ApplicationSummary application={load.application} />
          {load.application.status === 'rejected' && !editing && (
            <Button className="mt-6" onClick={() => setEditing(true)}>
              Update and send again
            </Button>
          )}
          {editing && (
            <section aria-labelledby="resubmit-heading" className="mt-10 border-t border-line pt-8">
              <h2 id="resubmit-heading" className="mb-6 text-lg font-semibold text-navy">
                Update your application
              </h2>
              <SellerApplicationForm
                existing={load.application}
                submitLabel="Send updated application"
                onSubmit={async (details, documents) => saved(await sellerApi.resubmit(details, documents))}
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}

const statusMessages = {
  pending: 'FDB is reviewing your application. We will email you when there is a decision.',
  approved: 'Your store is approved. Product listing tools are coming in the next update.',
  rejected: 'Your application was not approved yet. Fix the issue below and send it again.',
  suspended: 'Your store is suspended and hidden from customers. Contact FDB support for help.',
} as const

function ApplicationSummary({ application }: { application: SellerApplication }) {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{application.store_name}</h2>
        <SellerStatusBadge status={application.status} />
      </div>
      <p className="mt-2 text-sm text-slate">{statusMessages[application.status]}</p>
      {application.decision_reason && (
        <div className="mt-4">
          <Alert tone={application.status === 'rejected' || application.status === 'suspended' ? 'error' : 'info'}>
            <span className="font-semibold">Reason from FDB:</span> {application.decision_reason}
          </Alert>
        </div>
      )}

      <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-line pt-6 text-sm sm:grid-cols-2">
        <Detail label="Submitted">{formatDateTime(application.submitted_at)}</Detail>
        <Detail label="Contact number">{application.contact_phone}</Detail>
        <Detail label="Location">
          {application.address_line}, {application.barangay}, {application.municipality.label}
        </Detail>
        <Detail label="Business">
          {application.business_type === 'registered_business' ? application.business_name : 'Individual seller'}
        </Detail>
      </dl>

      {application.documents && application.documents.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-ink">Documents you sent</h3>
          <ul className="mt-2 divide-y divide-line border-y border-line text-sm">
            {application.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {doc.type_label} <span className="text-slate">· {doc.original_name}</span>
                </span>
                <span className="text-slate tabular">{formatFileSize(doc.size_bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {application.history && application.history.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-ink">History</h3>
          <ol className="mt-2 space-y-2 text-sm">
            {[...application.history].reverse().map((entry, i) => (
              <li key={i} className="flex flex-wrap gap-x-3">
                <span className="text-slate tabular">{formatDateTime(entry.at)}</span>
                <span>{sellerStatusLabel(entry.to)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  )
}
