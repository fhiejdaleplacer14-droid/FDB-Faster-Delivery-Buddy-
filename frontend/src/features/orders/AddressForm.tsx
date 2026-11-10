import { useState, type SubmitEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { serviceAreas } from '@/features/sellers/api'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { Address } from '@/types/api'
import { addressApi, type AddressInput } from './api'

const empty: AddressInput = { label: '', recipient_name: '', phone: '', municipality: '', barangay: '', street: '', landmark: '' }

export function AddressForm({ initialName = '', onSaved, onCancel }: { initialName?: string; onSaved: (a: Address) => void; onCancel?: (() => void) | undefined }) {
  const [form, setForm] = useState<AddressInput>({ ...empty, recipient_name: initialName })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const set = (key: keyof AddressInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSaved(await addressApi.create(form))
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  const err = (f: string) => firstError(error, f)

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && !Object.keys(error.fieldErrors).length && <Alert tone="error">{error.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Recipient name" autoComplete="name" value={form.recipient_name} onChange={(e) => set('recipient_name')(e.target.value)} error={err('recipient_name')} />
        <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" hint="For example 09171234567." value={form.phone} onChange={(e) => set('phone')(e.target.value)} error={err('phone')} />
        <SelectField label="Town or city" value={form.municipality} onChange={(e) => set('municipality')(e.target.value)} error={err('municipality')}>
          <option value="" disabled>
            Choose your town
          </option>
          {serviceAreas.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Barangay" value={form.barangay} onChange={(e) => set('barangay')(e.target.value)} error={err('barangay')} />
      </div>
      <TextField label="Street address" autoComplete="street-address" value={form.street} onChange={(e) => set('street')(e.target.value)} error={err('street')} />
      <TextField label="Landmark" hint="Optional. Helps the seller find you." value={form.landmark} onChange={(e) => set('landmark')(e.target.value)} error={err('landmark')} />
      <TextField label="Label" hint="Optional, for example Home or Work." maxLength={40} value={form.label} onChange={(e) => set('label')(e.target.value)} error={err('label')} />
      <div className="flex gap-3">
        <Button type="submit" busy={busy}>
          Save address
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

export function AddressLines({ address }: { address: Pick<Address, 'recipient_name' | 'phone' | 'barangay' | 'street' | 'landmark'> & { municipality: string | { label: string } } }) {
  const town = typeof address.municipality === 'string' ? address.municipality : address.municipality.label
  return (
    <>
      <span className="block font-medium text-ink">
        {address.recipient_name} · {address.phone}
      </span>
      <span className="block text-slate">
        {address.street}, {address.barangay}, {town}
        {address.landmark && ` (near ${address.landmark})`}
      </span>
    </>
  )
}
