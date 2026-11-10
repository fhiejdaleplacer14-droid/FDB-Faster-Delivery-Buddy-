import { ArrowLeft, Download } from 'lucide-react'
import { useEffect, useState, type SubmitEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { SellerStatusBadge, sellerStatusLabel } from '@/components/ui/StatusBadge'
import { can, useAuth } from '@/features/auth/AuthContext'
import { formatDateTime, formatFileSize } from '@/lib/format'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { SellerApplication } from '@/types/api'
import { adminApi, type SellerDecision } from './api'

export function SellerApplicationDetailPage() {
  const { id = '' } = useParams()
  const [seller, setSeller] = useState<SellerApplication | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    adminApi
      .seller(id)
      .then(setSeller)
      .catch((e: unknown) => setError(toApiError(e)))
  }, [id])

  return (
    <div className="max-w-3xl">
      <Link to="/admin/sellers" className="inline-flex items-center gap-1 text-sm font-medium text-slate hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Seller applications
      </Link>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.status === 404 ? 'This application does not exist.' : error.message}</Alert>
        </div>
      )}
      {!seller && !error && <p className="mt-6 text-sm text-slate" aria-live="polite">Loading…</p>}

      {seller && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy">{seller.store_name}</h1>
            <SellerStatusBadge status={seller.status} />
          </div>
          <p className="mt-1 text-sm text-slate">Submitted {formatDateTime(seller.submitted_at)}</p>

          <DecisionPanel seller={seller} onDecided={setSeller} />

          <Section title="Applicant">
            <Grid>
              <Item label="Name">{seller.applicant?.name}</Item>
              <Item label="Email">
                {seller.applicant?.email}{' '}
                {!seller.applicant?.email_verified && <span className="text-warning">(not verified)</span>}
              </Item>
              <Item label="Contact number">{seller.contact_phone}</Item>
            </Grid>
          </Section>

          <Section title="Store">
            <Grid>
              <Item label="Location">
                {seller.address_line}, {seller.barangay}, {seller.municipality.label}
              </Item>
              <Item label="Business type">
                {seller.business_type === 'registered_business' ? 'Registered business' : 'Individual'}
              </Item>
              {seller.business_name && <Item label="Registered name">{seller.business_name}</Item>}
              {seller.business_registration_number && (
                <Item label="Registration number">{seller.business_registration_number}</Item>
              )}
            </Grid>
            {seller.description && <p className="mt-4 text-sm whitespace-pre-line text-ink">{seller.description}</p>}
          </Section>

          <Section title="Verification documents">
            {seller.documents && seller.documents.length > 0 ? (
              <ul className="divide-y divide-line border-y border-line text-sm">
                {seller.documents.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="font-medium text-ink">{doc.type_label}</div>
                      <div className="text-xs text-slate">
                        {doc.original_name} · {formatFileSize(doc.size_bytes)} · {formatDateTime(doc.uploaded_at)}
                      </div>
                    </div>
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        className="inline-flex items-center gap-1 font-medium text-blue hover:underline"
                        aria-label={`Download ${doc.type_label}`}
                      >
                        <Download className="size-4" aria-hidden />
                        Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate">No documents were uploaded.</p>
            )}
            <p className="mt-2 text-xs text-slate">Every download is recorded in the audit log.</p>
          </Section>

          <Section title="History">
            <ol className="space-y-3 text-sm">
              {[...(seller.history ?? [])].reverse().map((entry, i) => (
                <li key={i}>
                  <div className="flex flex-wrap gap-x-3">
                    <span className="text-slate tabular">{formatDateTime(entry.at)}</span>
                    <span className="font-medium text-ink">{sellerStatusLabel(entry.to)}</span>
                    {entry.actor && <span className="text-slate">by {entry.actor.name}</span>}
                  </div>
                  {entry.reason && <p className="mt-0.5 text-ink">{entry.reason}</p>}
                </li>
              ))}
            </ol>
          </Section>
        </>
      )}
    </div>
  )
}

type Action = { decision: SellerDecision; label: string; confirm: string; needsReason: boolean; variant: 'primary' | 'danger' }

function actionsFor(seller: SellerApplication, canReview: boolean, canManage: boolean): Action[] {
  const name = seller.store_name
  switch (seller.status) {
    case 'pending':
      return canReview
        ? [
            { decision: 'approve', label: 'Approve', confirm: `Approve ${name}`, needsReason: false, variant: 'primary' },
            { decision: 'reject', label: 'Reject', confirm: `Reject ${name}`, needsReason: true, variant: 'danger' },
          ]
        : []
    case 'approved':
      return canManage
        ? [{ decision: 'suspend', label: 'Suspend store', confirm: `Suspend ${name}`, needsReason: true, variant: 'danger' }]
        : []
    case 'suspended':
      return canManage
        ? [{ decision: 'reactivate', label: 'Reactivate store', confirm: `Reactivate ${name}`, needsReason: false, variant: 'primary' }]
        : []
    case 'rejected':
      return []
  }
}

function DecisionPanel({ seller, onDecided }: { seller: SellerApplication; onDecided: (s: SellerApplication) => void }) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const actions = actionsFor(seller, can(user, 'sellers.review'), can(user, 'sellers.manage'))
  if (actions.length === 0) return null

  function choose(action: Action | null) {
    setSelected(action)
    setReason('')
    setError(null)
  }

  async function confirm(event: SubmitEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      onDecided(await adminApi.decide(seller.id, selected.decision, reason.trim() || undefined))
      choose(null)
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 border-y border-line py-4">
      {!selected ? (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <Button key={action.decision} variant={action.variant === 'danger' ? 'secondary' : 'primary'} onClick={() => choose(action)}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : (
        <form onSubmit={confirm} noValidate className="space-y-4">
          {error && !firstError(error, 'reason') && <Alert tone="error">{error.message}</Alert>}
          {selected.needsReason ? (
            <TextareaField
              label="Reason"
              hint="The seller will see this in their email and on their application."
              required
              autoFocus
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={firstError(error, 'reason')}
            />
          ) : (
            <p className="text-sm text-ink">
              {selected.decision === 'approve'
                ? 'The applicant will get seller access and an email telling them they were approved.'
                : 'The store will be visible to customers again and the seller will be notified.'}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant={selected.variant} busy={busy}>
              {selected.confirm}
            </Button>
            <Button variant="ghost" onClick={() => choose(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">{children}</dl>
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{children}</dd>
    </div>
  )
}
