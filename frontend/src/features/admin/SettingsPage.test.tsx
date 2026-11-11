import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminUser, renderRoute } from '@/test/renderRoute'
import { settingsApi } from './SettingsPage'

describe('admin settings', () => {
  it('turns the seller documents requirement off and back on', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ seller_documents_required: true })
    const update = vi
      .spyOn(settingsApi, 'update')
      .mockResolvedValueOnce({ seller_documents_required: false })
      .mockResolvedValueOnce({ seller_documents_required: true })
    renderRoute('/admin/settings', { user: adminUser() })

    const toggle = await screen.findByRole('switch', { name: 'Require verification documents' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect(update).toHaveBeenLastCalledWith({ seller_documents_required: false })
    expect(screen.getByText(/applicants send their store details only/)).toBeInTheDocument()

    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(update).toHaveBeenLastCalledWith({ seller_documents_required: true })
  })

  it('is listed in the admin menu', async () => {
    vi.spyOn(settingsApi, 'get').mockResolvedValue({ seller_documents_required: true })
    renderRoute('/admin/settings', { user: adminUser() })
    expect(await screen.findByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/admin/settings')
  })
})
