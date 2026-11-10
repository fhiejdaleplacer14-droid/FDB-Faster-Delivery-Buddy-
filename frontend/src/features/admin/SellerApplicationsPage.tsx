import { Search } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '@/components/ui/Alert'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { SellerStatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/format'
import { toApiError, type ApiError } from '@/lib/http'
import type { Paginated, SellerApplication, SellerStatus } from '@/types/api'
import { adminApi } from './api'

const filters: { value: SellerStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Not approved' },
  { value: 'suspended', label: 'Suspended' },
  { value: '', label: 'All' },
]

const STATUSES: SellerStatus[] = ['pending', 'approved', 'rejected', 'suspended']

export function SellerApplicationsPage() {
  const [params, setParams] = useSearchParams()
  const rawStatus = params.get('status') ?? 'pending'
  const status = STATUSES.includes(rawStatus as SellerStatus) ? (rawStatus as SellerStatus) : undefined
  const activeFilter = status ?? ''
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [result, setResult] = useState<Paginated<SellerApplication> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [query, setQuery] = useState(search)

  useEffect(() => {
    let current = true
    adminApi
      .sellers({ status, search: search || undefined, page })
      .then((r) => {
        if (current) {
          setResult(r)
          setError(null)
        }
      })
      .catch((e: unknown) => current && setError(toApiError(e)))
    return () => {
      current = false
    }
  }, [status, search, page])

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)))
    if (!('page' in next)) merged.delete('page')
    setParams(merged)
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault()
    update({ search: query.trim() })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-navy">Seller applications</h1>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div role="group" aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line">
          {filters.map((f) => {
            const active = activeFilter === f.value
            return (
              <button
                key={f.label}
                aria-pressed={active}
                onClick={() => update({ status: f.value === '' ? 'all' : f.value })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${active ? 'border-blue text-navy' : 'border-transparent text-slate hover:text-ink'}`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
        <form onSubmit={submitSearch} role="search" className="flex gap-2">
          <label htmlFor="seller-search" className="sr-only">
            Search by store, name, or email
          </label>
          <input
            id="seller-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Store, name, or email"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm lg:w-64"
          />
          <Button type="submit" variant="secondary" aria-label="Search">
            <Search className="size-4" aria-hidden />
          </Button>
        </form>
      </div>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}

      {result && result.data.length === 0 && (
        <p className="mt-10 text-sm text-slate">
          {search ? `No applications match “${search}”.` : 'No applications here right now.'}
        </p>
      )}

      {!result && !error && <TableSkeleton />}
      {result && result.data.length > 0 && (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-slate uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Store</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Applicant</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Town</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Submitted</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.data.map((seller) => (
                  <tr key={seller.id} className="hover:bg-white">
                    <td className="py-3 pr-4">
                      <Link to={`/admin/sellers/${seller.id}`} className="font-medium text-blue hover:underline">
                        {seller.store_name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-ink">{seller.applicant?.name}</div>
                      <div className="text-xs text-slate">{seller.applicant?.email}</div>
                    </td>
                    <td className="py-3 pr-4 text-ink">{seller.municipality.label}</td>
                    <td className="py-3 pr-4 text-ink tabular">{formatDate(seller.submitted_at)}</td>
                    <td className="py-3">
                      <SellerStatusBadge status={seller.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.meta.last_page > 1 && (
            <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
              <span className="text-slate">
                Page {result.meta.current_page} of {result.meta.last_page} · {result.meta.total} applications
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                  Previous
                </Button>
                <Button variant="secondary" disabled={page >= result.meta.last_page} onClick={() => update({ page: String(page + 1) })}>
                  Next
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
