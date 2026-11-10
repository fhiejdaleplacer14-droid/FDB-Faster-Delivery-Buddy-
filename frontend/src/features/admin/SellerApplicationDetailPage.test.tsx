import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminUser, renderRoute } from '@/test/renderRoute'
import type { SellerApplication } from '@/types/api'
import { adminApi } from './api'

const pending: SellerApplication = {
  id: 7,
  store_name: 'Aling Rosa',
  slug: 'aling-rosa',
  description: null,
  contact_phone: '09171234567',
  municipality: { value: 'guihulngan', label: 'Guihulngan' },
  barangay: 'Poblacion',
  address_line: '12 Rizal St',
  business_type: 'individual',
  business_name: null,
  business_registration_number: null,
  status: 'pending',
  decision_reason: null,
  submitted_at: '2026-11-10T02:00:00Z',
  reviewed_at: null,
  approved_at: null,
  suspended_at: null,
  applicant: { id: 3, name: 'Rosa Cruz', email: 'rosa@example.com', email_verified: true },
  reviewer: null,
  documents: [],
  history: [{ from: null, to: 'pending', reason: null, at: '2026-11-10T02:00:00Z' }],
}

describe('SellerApplicationDetailPage', () => {
  it('shows times in Philippine time', async () => {
    vi.spyOn(adminApi, 'seller').mockResolvedValue(pending)
    renderRoute('/admin/sellers/7', { user: adminUser() })

    expect(await screen.findByText(/Submitted Nov 10, 2026, 10:00/)).toBeInTheDocument()
  })

  it('requires a reason and names the store when rejecting', async () => {
    vi.spyOn(adminApi, 'seller').mockResolvedValue(pending)
    const decide = vi.spyOn(adminApi, 'decide').mockResolvedValue({
      ...pending,
      status: 'rejected',
      decision_reason: 'ID photo is blurry.',
    })
    renderRoute('/admin/sellers/7', { user: adminUser() })

    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    await userEvent.type(screen.getByLabelText(/Reason/), 'ID photo is blurry.')
    await userEvent.click(screen.getByRole('button', { name: 'Reject Aling Rosa' }))

    expect(decide).toHaveBeenCalledWith(7, 'reject', 'ID photo is blurry.')
    expect(await screen.findByText('Not approved')).toBeInTheDocument()
  })

  it('hides suspension from reviewers who cannot manage sellers', async () => {
    vi.spyOn(adminApi, 'seller').mockResolvedValue({ ...pending, status: 'approved' })
    renderRoute('/admin/sellers/7', { user: { ...adminUser(), permissions: ['sellers.review'] } })

    expect(await screen.findByRole('heading', { name: 'Aling Rosa' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspend store' })).not.toBeInTheDocument()
  })
})
