import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { CommissionStatusBadge } from '@/components/ui/CommissionStatusBadge'
import { SelectField, TextField } from '@/components/ui/Field'
import { formatDate, formatDateTime } from '@/lib/format'
import { firstError, http, toApiError, type ApiError } from '@/lib/http'
import { formatPeso, formatRate } from '@/lib/money'
import type { CommissionPolicy, CommissionRecord, Paginated, SellerApplication } from '@/types/api'
import { commissionsApi, type SellerBalance } from './commissionsApi'

const methods = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

export function CommissionsPage() {
  const [policies, setPolicies] = useState<CommissionPolicy[] | null>(null)
  const [balances, setBalances] = useState<SellerBalance[] | null>(null)
  const [collecting, setCollecting] = useState<SellerBalance | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([commissionsApi.policies(), commissionsApi.balances()])
      setPolicies(p)
      setBalances(b)
    } catch (e) {
      setError(toApiError(e).message)
    }
  }, [])

  useEffect(() => {
    Promise.all([commissionsApi.policies(), commissionsApi.balances()]).then(
      ([p, b]) => {
        setPolicies(p)
        setBalances(b)
      },
      (e: unknown) => setError(toApiError(e).message),
    )
  }, [])

  const defaultPolicy = policies?.find((p) => p.active && !p.store)
  const overrides = policies?.filter((p) => p.active && p.store) ?? []

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Commissions</h1>
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <section aria-labelledby="rates-heading" className="mt-8">
        <h2 id="rates-heading" className="text-lg font-semibold text-heading">
          Rates
        </h2>
        <p className="mt-1 text-sm text-slate">A new rate applies to orders placed from now on. Earlier orders keep the rate they were placed with.</p>
        {policies && (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-40 text-slate">Default rate</dt>
              <dd className="font-semibold text-ink">
                {defaultPolicy ? formatRate(defaultPolicy.rate) : 'Not set (no commission is recorded)'}
                {defaultPolicy?.notes && <span className="block text-xs font-normal text-slate">{defaultPolicy.notes}</span>}
              </dd>
            </div>
            {overrides.map((p) => (
              <div key={p.id} className="flex gap-3">
                <dt className="w-40 truncate text-slate">{p.store?.name}</dt>
                <dd className="text-ink">{formatRate(p.rate)}</dd>
              </div>
            ))}
          </dl>
        )}
        <RateForm
          onSaved={async (message) => {
            setNotice(message)
            await load()
          }}
        />
      </section>

      <section aria-labelledby="due-heading" className="mt-12 border-t border-line pt-8">
        <h2 id="due-heading" className="text-lg font-semibold text-heading">
          Due from sellers
        </h2>
        {balances?.length === 0 && <p className="mt-3 text-sm text-slate">No seller owes commission right now.</p>}
        {balances && balances.length > 0 && (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Store</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Orders</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Due</th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {balances.map((b) => (
                <tr key={b.seller_id}>
                  <td className="py-3 pr-4 text-ink">{b.store_name}</td>
                  <td className="py-3 pr-4 text-right tabular">{b.records}</td>
                  <td className="py-3 pr-4 text-right font-semibold tabular">{formatPeso(b.due)}</td>
                  <td className="py-3 text-right">
                    <Button variant="secondary" className="min-h-8" onClick={() => setCollecting(b)}>
                      Record payment
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {collecting && (
          <CollectForm
            key={collecting.seller_id}
            balance={collecting}
            onCancel={() => setCollecting(null)}
            onDone={async (amount) => {
              setCollecting(null)
              setNotice(`Recorded ${formatPeso(amount)} from ${collecting.store_name}.`)
              await load()
            }}
          />
        )}
      </section>

      <RecordsSection />
    </div>
  )
}

function RateForm({ onSaved }: { onSaved: (message: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [sellers, setSellers] = useState<SellerApplication[]>([])
  const [rate, setRate] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!open) return
    http
      .get<Paginated<SellerApplication>>('/admin/sellers', { params: { status: 'approved', per_page: 50 } })
      .then((r) => setSellers(r.data.data), () => setSellers([]))
  }, [open])

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await commissionsApi.setPolicy({ rate_percent: rate.trim(), seller_id: sellerId ? Number(sellerId) : null, notes: notes.trim() })
      const store = sellers.find((s) => String(s.id) === sellerId)?.store_name
      setOpen(false)
      setRate('')
      setNotes('')
      await onSaved(`New rate of ${rate.trim()}% set for ${store ?? 'all sellers'}.`)
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
        Change a rate
      </Button>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 grid max-w-xl gap-4 border-y border-line py-4 sm:grid-cols-2">
      <SelectField label="Applies to" value={sellerId} onChange={(e) => setSellerId(e.target.value)} error={firstError(error, 'seller_id')}>
        <option value="">All sellers (default)</option>
        {sellers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.store_name}
          </option>
        ))}
      </SelectField>
      <TextField label="Rate (%)" inputMode="decimal" placeholder="7.5" value={rate} onChange={(e) => setRate(e.target.value)} error={firstError(error, 'rate_percent')} />
      <div className="sm:col-span-2">
        <TextField label="Note" hint="Optional. Why the rate is changing." maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" busy={busy} disabled={!rate.trim()}>
          Start new rate now
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function CollectForm({ balance, onCancel, onDone }: { balance: SellerBalance; onCancel: () => void; onDone: (amount: string) => Promise<void> }) {
  const [records, setRecords] = useState<CommissionRecord[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [collectedAt, setCollectedAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    commissionsApi.records({ status: 'due', seller_id: balance.seller_id, per_page: 100 }).then((r) => {
      setRecords(r.data)
      setSelected(new Set(r.data.map((x) => x.id)))
    }, (e: unknown) => setError(toApiError(e)))
  }, [balance.seller_id])

  const chosen = (records ?? []).filter((r) => selected.has(r.id))
  // Sum in centavos as integers so the preview total is exact.
  const totalCentavos = chosen.reduce((sum, r) => sum + Number(r.net_amount.replace('.', '')), 0)
  const total = `${Math.floor(totalCentavos / 100)}.${String(totalCentavos % 100).padStart(2, '0')}`

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await commissionsApi.collect({ seller_id: balance.seller_id, record_ids: [...selected], method, reference: reference.trim(), notes: '', collected_at: collectedAt })
      await onDone(result.amount)
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4 border-y border-line py-5">
      <h3 className="font-semibold text-ink">Record a payment from {balance.store_name}</h3>
      {error && <Alert tone="error">{firstError(error, 'record_ids') ?? error.message}</Alert>}
      <fieldset>
        <legend className="text-sm font-medium text-ink">Orders covered by this payment</legend>
        <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto border-y border-line text-sm">
          {records?.map((r) => (
            <li key={r.id}>
              <label className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-blue" />
                  {r.seller_order?.number} <span className="text-slate">· delivered {formatDate(r.due_at)}</span>
                </span>
                <span className="tabular">{formatPeso(r.net_amount)}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Paid by" value={method} onChange={(e) => setMethod(e.target.value)}>
          {methods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Reference" hint="Optional, e.g. GCash reference" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
        <TextField label="Date received" type="date" hint="Leave empty for today" value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} error={firstError(error, 'collected_at')} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" busy={busy} disabled={chosen.length === 0}>
          Record {formatPeso(total)} received
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function RecordsSection() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<Paginated<CommissionRecord> | null>(null)
  const [adjusting, setAdjusting] = useState<number | null>(null)

  const load = useCallback(() => commissionsApi.records({ status: status || undefined, page }).then(setResult, () => setResult(null)), [status, page])

  useEffect(() => {
    commissionsApi.records({ status: status || undefined, page }).then(setResult, () => setResult(null))
  }, [status, page])

  return (
    <section aria-labelledby="records-heading" className="mt-12 border-t border-line pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="records-heading" className="text-lg font-semibold text-heading">
          All commission records
        </h2>
        <label className="text-sm">
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="h-9 rounded-md border border-line bg-surface px-2">
            <option value="">All statuses</option>
            <option value="pending">Not yet earned</option>
            <option value="due">Due to FDB</option>
            <option value="collected">Paid to FDB</option>
            <option value="voided">Voided</option>
          </select>
        </label>
      </div>
      {result && result.data.length === 0 && <p className="mt-3 text-sm text-slate">No records.</p>}
      {result && result.data.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                <th scope="col" className="py-2 pr-4 font-medium">Store</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Base</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Commission</th>
                <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.data.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-3 pr-4">{r.seller_order?.number}</td>
                  <td className="py-3 pr-4">{r.store?.name}</td>
                  <td className="py-3 pr-4 text-right tabular">{formatPeso(r.base_amount)}</td>
                  <td className="py-3 pr-4 text-right tabular">
                    {formatPeso(r.net_amount)} <span className="text-xs text-slate">({formatRate(r.rate)})</span>
                    {r.adjustments?.map((a, i) => (
                      <span key={i} className="block text-xs text-slate">
                        {a.amount.startsWith('-') ? '' : '+'}
                        {formatPeso(a.amount)}: {a.reason}
                      </span>
                    ))}
                  </td>
                  <td className="py-3 pr-4">
                    <CommissionStatusBadge status={r.status} />
                    {r.collection && <span className="block text-xs text-slate">{formatDateTime(r.collection.collected_at)}</span>}
                  </td>
                  <td className="py-3 text-right">
                    {(r.status === 'pending' || r.status === 'due') &&
                      (adjusting === r.id ? (
                        <AdjustForm record={r} onDone={async () => { setAdjusting(null); await load() }} onCancel={() => setAdjusting(null)} />
                      ) : (
                        <button type="button" onClick={() => setAdjusting(r.id)} className="text-sm font-medium text-link hover:underline">
                          Adjust
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="secondary" disabled={page >= result.meta.last_page} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function AdjustForm({ record, onDone, onCancel }: { record: CommissionRecord; onDone: () => Promise<void>; onCancel: () => void }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await commissionsApi.adjust(record.id, amount.trim(), reason.trim())
      await onDone()
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="ml-auto w-64 space-y-2 text-left">
      <TextField label="Change (₱)" hint="Negative to reduce, e.g. -5.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={firstError(error, 'amount')} />
      <TextField label="Reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} error={firstError(error, 'reason')} />
      <div className="flex gap-2">
        <Button type="submit" className="min-h-8" busy={busy}>
          Save adjustment
        </Button>
        <Button variant="ghost" className="min-h-8" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
