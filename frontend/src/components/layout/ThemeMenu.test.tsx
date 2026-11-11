import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '@/app/ThemeProvider'
import { THEME_KEY } from '@/lib/theme'
import { ThemeMenu } from './ThemeMenu'

function setup() {
  render(
    <ThemeProvider>
      <ThemeMenu />
    </ThemeProvider>,
  )
  return userEvent.setup()
}

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ThemeMenu', () => {
  it('starts light when nothing is saved and the device has no preference', () => {
    setup()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: /theme: light/i })).toBeInTheDocument()
  })

  it('switches to dark and remembers the choice', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: /change theme/i }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /theme: dark/i })).toHaveFocus()
  })

  it('restores a saved choice and forgets it when set to match the device', async () => {
    localStorage.setItem(THEME_KEY, 'dark')
    const user = setup()
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(screen.getByRole('button', { name: /change theme/i }))
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('menuitemradio', { name: 'Match device' }))

    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('closes on Escape', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: /change theme/i }))
    expect(screen.getByRole('menu', { name: 'Theme' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
