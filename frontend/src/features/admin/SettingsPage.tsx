import { FileCheck2 } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Alert } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'
import { http, toApiError, type ApiError } from '@/lib/http'

export type SiteSettings = { seller_documents_required: boolean }

export const settingsApi = {
  async get() {
    return (await http.get<{ data: SiteSettings }>('/admin/settings')).data.data
  },
  async update(change: SiteSettings) {
    return (await http.put<{ data: SiteSettings }>('/admin/settings', change)).data.data
  },
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    settingsApi.get().then(setSettings, (e: unknown) => setError(toApiError(e)))
  }, [])

  async function toggleDocuments(next: boolean) {
    setBusy(true)
    setError(null)
    try {
      setSettings(await settingsApi.update({ seller_documents_required: next }))
      toast.show({ tone: 'success', text: next ? 'Seller applications now need verification documents.' : 'Seller applications no longer need documents.' })
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-heading">Settings</h1>
      <p className="mt-1 text-sm text-slate">Switches that change how FDB works. Changes apply right away and are recorded in the audit log.</p>

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}

      <section aria-labelledby="sellers-heading" className="mt-8">
        <h2 id="sellers-heading" className="text-xs font-semibold tracking-wide text-slate uppercase">
          Seller applications
        </h2>
        <div className="mt-3 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
          {settings ? (
            <Switch
              icon={<FileCheck2 className="size-5" aria-hidden />}
              label="Require verification documents"
              description={
                settings.seller_documents_required
                  ? 'On: applicants must upload a government-issued ID before you review them.'
                  : 'Off: applicants send their store details only, and you approve or reject them without documents.'
              }
              checked={settings.seller_documents_required}
              busy={busy}
              onChange={toggleDocuments}
            />
          ) : (
            !error && <div className="skeleton h-12 rounded-lg" aria-label="Loading settings" />
          )}
        </div>
      </section>
    </div>
  )
}

function Switch({ icon, label, description, checked, busy, onChange }: { icon: ReactNode; label: string; description: string; checked: boolean; busy: boolean; onChange: (next: boolean) => void }) {
  const labelId = useId()
  const descriptionId = useId()
  return (
    <div className="flex items-start gap-4">
      <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${checked ? 'bg-blue-soft text-link' : 'bg-paper text-slate'}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p id={labelId} className="font-semibold text-heading">
          {label}
        </p>
        <p id={descriptionId} className="mt-0.5 text-sm text-slate">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-60 ${checked ? 'bg-blue' : 'bg-slate/40'}`}
      >
        <span className={`inline-block size-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}
