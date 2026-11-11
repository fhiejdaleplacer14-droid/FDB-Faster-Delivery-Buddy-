import { Plus, X } from 'lucide-react'
import { useRef, useState, type SubmitEvent } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField, TextareaField, TextField } from '@/components/ui/Field'
import { firstError, toApiError, type ApiError } from '@/lib/http'
import type { SellerApplication, SellerDocumentType } from '@/types/api'
import { documentTypes, serviceAreas, type ApplicationDetails, type DocumentUpload } from './api'
import { ProductTypePicker } from './ProductTypePicker'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENTS = 6
const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf'

type Props = {
  existing?: SellerApplication | undefined
  onSubmit: (details: ApplicationDetails, documents: DocumentUpload[]) => Promise<void>
  submitLabel: string
  // Set by admins (Admin > Settings). When off, the form skips the documents step.
  documentsRequired?: boolean
}

function initialDetails(existing?: SellerApplication): ApplicationDetails {
  return {
    store_name: existing?.store_name ?? '',
    description: existing?.description ?? '',
    contact_phone: existing?.contact_phone ?? '',
    municipality: existing?.municipality.value ?? '',
    barangay: existing?.barangay ?? '',
    address_line: existing?.address_line ?? '',
    business_type: existing?.business_type ?? 'individual',
    business_name: existing?.business_name ?? '',
    business_registration_number: existing?.business_registration_number ?? '',
  }
}

export function SellerApplicationForm({ existing, onSubmit, submitLabel, documentsRequired = true }: Props) {
  const nextKey = useRef(1)
  const [details, setDetails] = useState<ApplicationDetails>(() => initialDetails(existing))
  const [documents, setDocuments] = useState<DocumentUpload[]>(() =>
    existing ? [] : [{ key: 0, type: 'government_id', file: null }],
  )
  const [fileErrors, setFileErrors] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const set = <K extends keyof ApplicationDetails>(key: K, value: ApplicationDetails[K]) =>
    setDetails((d) => ({ ...d, [key]: value }))

  function addDocument() {
    setDocuments((docs) => [...docs, { key: nextKey.current++, type: 'business_permit', file: null }])
  }

  function updateDocument(key: number, change: Partial<DocumentUpload>) {
    setDocuments((docs) => docs.map((doc) => (doc.key === key ? { ...doc, ...change } : doc)))
  }

  function chooseFile(key: number, file: File | null) {
    const tooBig = file && file.size > MAX_FILE_BYTES
    setFileErrors((errors) => {
      const rest = Object.fromEntries(Object.entries(errors).filter(([k]) => Number(k) !== key))
      return tooBig ? { ...rest, [key]: 'This file is larger than 5 MB.' } : rest
    })
    updateDocument(key, { file: tooBig ? null : file })
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(details, documentsRequired ? documents : [])
    } catch (e) {
      setError(toApiError(e))
      setBusy(false)
    }
  }

  const err = (field: string) => firstError(error, field)
  const hasFieldErrors = error && Object.keys(error.fieldErrors).length > 0

  return (
    <form onSubmit={submit} noValidate className="space-y-10">
      {error && (
        <Alert tone="error">{hasFieldErrors ? 'Some details need fixing. Check the highlighted fields.' : error.message}</Alert>
      )}

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-heading">Your store</legend>
        <TextField label="Store name" required maxLength={80} value={details.store_name} onChange={(e) => set('store_name', e.target.value)} error={err('store_name')} />
        <TextareaField
          label="What do you sell?"
          hint="Optional. Customers will see this on your store page."
          maxLength={1000}
          value={details.description}
          onChange={(e) => set('description', e.target.value)}
          error={err('description')}
        />
        <ProductTypePicker value={details.description} onChange={(next) => set('description', next)} />
        <TextField
          label="Contact mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="For example 09171234567. FDB uses this to reach you about orders."
          required
          value={details.contact_phone}
          onChange={(e) => set('contact_phone', e.target.value)}
          error={err('contact_phone')}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-heading">Store location</legend>
        <SelectField label="Town or city" required value={details.municipality} onChange={(e) => set('municipality', e.target.value as ApplicationDetails['municipality'])} error={err('municipality')}>
          <option value="" disabled>
            Choose where your store is
          </option>
          {serviceAreas.map((area) => (
            <option key={area.value} value={area.value}>
              {area.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Barangay" required maxLength={100} value={details.barangay} onChange={(e) => set('barangay', e.target.value)} error={err('barangay')} />
        <TextField
          label="Street address"
          hint="House number, street, or landmark."
          required
          maxLength={255}
          value={details.address_line}
          onChange={(e) => set('address_line', e.target.value)}
          error={err('address_line')}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-lg font-semibold text-heading">Business details</legend>
        <div role="radiogroup" aria-label="Business type" className="flex flex-col gap-3 sm:flex-row sm:gap-8">
          {(
            [
              ['individual', 'I sell as an individual'],
              ['registered_business', 'I have a registered business'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="business_type"
                value={value}
                checked={details.business_type === value}
                onChange={() => set('business_type', value)}
                className="size-4 accent-blue"
              />
              {label}
            </label>
          ))}
        </div>
        {details.business_type === 'registered_business' && (
          <>
            <TextField label="Registered business name" required maxLength={150} value={details.business_name} onChange={(e) => set('business_name', e.target.value)} error={err('business_name')} />
            <TextField
              label="DTI or SEC registration number"
              hint="Optional."
              maxLength={50}
              value={details.business_registration_number}
              onChange={(e) => set('business_registration_number', e.target.value)}
              error={err('business_registration_number')}
            />
          </>
        )}
      </fieldset>

      {documentsRequired ? (
        <fieldset>
          <legend className="text-lg font-semibold text-heading">Verification documents</legend>
          <p className="mt-1 text-sm text-slate">
            {existing
              ? 'Your earlier documents are kept. Add new ones only if the reviewer asked for them.'
              : 'A government-issued ID is required. JPG, PNG, WEBP, or PDF, up to 5 MB each. Only FDB administrators can see these files.'}
          </p>
          {err('documents') && <p className="mt-2 text-sm text-danger">{err('documents')}</p>}

          <ul className="mt-4 divide-y divide-line border-y border-line">
            {documents.map((doc, index) => (
              <li key={doc.key} className="grid gap-3 py-4 sm:grid-cols-[14rem_1fr_auto] sm:items-start">
                <SelectField
                  label="Document type"
                  value={doc.type}
                  onChange={(e) => updateDocument(doc.key, { type: e.target.value as SellerDocumentType })}
                  error={err(`documents.${index}.type`)}
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="File"
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => chooseFile(doc.key, e.target.files?.[0] ?? null)}
                  error={fileErrors[doc.key] ?? err(`documents.${index}.file`)}
                  className="file:mr-3 file:rounded file:border-0 file:bg-blue-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-heading"
                />
                <Button
                  variant="ghost"
                  className="sm:mt-6"
                  aria-label={`Remove document ${index + 1}`}
                  onClick={() => setDocuments((docs) => docs.filter((d) => d.key !== doc.key))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          {documents.length < MAX_DOCUMENTS && (
            <Button variant="secondary" className="mt-4" onClick={addDocument}>
              <Plus className="size-4" aria-hidden />
              Add a document
            </Button>
          )}
        </fieldset>
      ) : (
        <p className="rounded-lg bg-blue-soft px-4 py-3 text-sm text-ink">No documents needed right now. FDB reviews your details and approves your store.</p>
      )}

      <div className="border-t border-line pt-6">
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
