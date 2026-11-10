import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { makeUser, renderRoute } from '@/test/renderRoute'

function validationError(errors: Record<string, string[]>) {
  const response = { status: 422, data: { message: 'Invalid', errors }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('Invalid', 'ERR_BAD_REQUEST', undefined, undefined, response as AxiosResponse)
}

describe('LoginPage', () => {
  it('shows the server error next to the email field', async () => {
    const login = vi.fn().mockRejectedValue(validationError({ email: ['The email or password is incorrect.'] }))
    renderRoute('/login', { auth: { login } })

    await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(login).toHaveBeenCalledWith({ email: 'juan@example.com', password: 'wrong', remember: false })
  })

  it('returns to the requested page after signing in', async () => {
    const login = vi.fn().mockResolvedValue(makeUser())
    const { router } = renderRoute(`/login?next=${encodeURIComponent('/sell')}`, { auth: { login } })

    await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/sell'))
  })

  it('ignores an off-site next link', async () => {
    const login = vi.fn().mockResolvedValue(makeUser())
    const { router } = renderRoute(`/login?next=${encodeURIComponent('//evil.example')}`, { auth: { login } })

    await userEvent.type(screen.getByLabelText('Email'), 'juan@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})
