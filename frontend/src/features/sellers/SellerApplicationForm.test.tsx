import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SellerApplicationForm } from './SellerApplicationForm'

function file(name: string, type: string, bytes: number) {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText('Store name'), 'Aling Rosa')
  await userEvent.type(screen.getByLabelText(/Contact mobile number/), '09171234567')
  await userEvent.selectOptions(screen.getByLabelText('Town or city'), 'guihulngan')
  await userEvent.type(screen.getByLabelText('Barangay'), 'Poblacion')
  await userEvent.type(screen.getByLabelText(/Street address/), '12 Rizal St')
}

describe('SellerApplicationForm', () => {
  it('starts with a government ID upload row', () => {
    render(<SellerApplicationForm submitLabel="Send application" onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Document type')).toHaveValue('government_id')
  })

  it('rejects files over 5 MB before uploading', async () => {
    render(<SellerApplicationForm submitLabel="Send application" onSubmit={vi.fn()} />)

    await userEvent.upload(screen.getByLabelText('File'), file('id.jpg', 'image/jpeg', 6 * 1024 * 1024))

    expect(screen.getByText('This file is larger than 5 MB.')).toBeInTheDocument()
  })

  it('sends the details and chosen documents', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<SellerApplicationForm submitLabel="Send application" onSubmit={onSubmit} />)

    await fillRequired()
    const id = file('id.jpg', 'image/jpeg', 1000)
    await userEvent.upload(screen.getByLabelText('File'), id)
    await userEvent.click(screen.getByRole('button', { name: 'Send application' }))

    expect(onSubmit).toHaveBeenCalledOnce()
    const [details, documents] = onSubmit.mock.calls[0] as [Record<string, string>, { type: string; file: File }[]]
    expect(details).toMatchObject({ store_name: 'Aling Rosa', municipality: 'guihulngan', business_type: 'individual' })
    expect(documents).toEqual([expect.objectContaining({ type: 'government_id', file: id })])
  })

  it('asks for a business name only for registered businesses', async () => {
    render(<SellerApplicationForm submitLabel="Send application" onSubmit={vi.fn()} />)
    expect(screen.queryByLabelText('Registered business name')).not.toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('I have a registered business'))

    expect(screen.getByLabelText('Registered business name')).toBeInTheDocument()
  })
})
