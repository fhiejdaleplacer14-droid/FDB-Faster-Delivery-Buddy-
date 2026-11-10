import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthContext'
import { AddressForm, AddressLines } from '@/features/orders/AddressForm'
import { addressApi } from '@/features/orders/api'
import { toApiError } from '@/lib/http'
import type { Address } from '@/types/api'

export function AddressBook() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<Address[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => addressApi.list().then(setAddresses, (e: unknown) => setError(toApiError(e).message))

  useEffect(() => {
    addressApi.list().then(setAddresses, (e: unknown) => setError(toApiError(e).message))
  }, [])

  async function act(run: () => Promise<unknown>) {
    setError(null)
    try {
      await run()
      await load()
    } catch (e) {
      setError(toApiError(e).message)
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {addresses?.length === 0 && !adding && <p className="text-sm text-slate">No saved addresses yet.</p>}
      {addresses && addresses.length > 0 && (
        <ul className="divide-y divide-line border-y border-line text-sm">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <span className="mb-0.5 block text-xs font-semibold tracking-wide text-slate uppercase">
                  {a.label ?? 'Address'}
                  {a.is_default && ' · default'}
                </span>
                <AddressLines address={a} />
              </div>
              <div className="flex gap-3">
                {!a.is_default && (
                  <button
                    type="button"
                    className="text-sm font-medium text-blue hover:underline"
                    onClick={() =>
                      act(() =>
                        addressApi.update(a.id, {
                          label: a.label ?? '',
                          recipient_name: a.recipient_name,
                          phone: a.phone,
                          municipality: a.municipality.value,
                          barangay: a.barangay,
                          street: a.street,
                          landmark: a.landmark ?? '',
                          is_default: true,
                        }),
                      )
                    }
                  >
                    Make default
                  </button>
                )}
                <button type="button" className="text-sm font-medium text-danger hover:underline" onClick={() => act(() => addressApi.remove(a.id))}>
                  Remove {a.label ?? 'address'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddressForm
          initialName={user?.name ?? ''}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            void load()
          }}
        />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Add an address
        </Button>
      )}
    </div>
  )
}
