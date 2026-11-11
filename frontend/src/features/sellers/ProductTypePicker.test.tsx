import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ProductTypePicker, toggleType } from './ProductTypePicker'

describe('toggleType', () => {
  it('adds choices as a comma list and removes them cleanly', () => {
    expect(toggleType('', 'Snacks')).toBe('Snacks')
    expect(toggleType('Snacks', 'Drinks')).toBe('Snacks, Drinks')
    expect(toggleType('Snacks, Drinks, Eggs', 'Drinks')).toBe('Snacks, Eggs')
    expect(toggleType('Snacks, Drinks', 'Snacks')).toBe('Drinks')
    expect(toggleType('Snacks, Drinks', 'Drinks')).toBe('Snacks')
  })

  it('keeps what the seller typed', () => {
    expect(toggleType('Homemade banana chips,', 'Drinks')).toBe('Homemade banana chips, Drinks')
    expect(toggleType('We sell snacks from Tabuk', 'Snacks')).toBe('We sell from Tabuk')
  })

  it('never goes past the 1,000 character limit', () => {
    const long = 'x'.repeat(995)
    expect(toggleType(long, 'Snacks')).toBe(long)
  })
})

function Harness() {
  const [text, setText] = useState('')
  return (
    <>
      <ProductTypePicker value={text} onChange={setText} />
      <output aria-label="Description">{text}</output>
    </>
  )
}

describe('ProductTypePicker', () => {
  it('toggles choices on and off', async () => {
    render(<Harness />)
    const snacks = screen.getByRole('button', { name: 'Snacks' })

    await userEvent.click(snacks)
    await userEvent.click(screen.getByRole('button', { name: 'Clothes & outfits' }))
    expect(snacks).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Description')).toHaveTextContent('Snacks, Clothes & outfits')

    await userEvent.click(snacks)
    expect(snacks).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Description')).toHaveTextContent('Clothes & outfits')
  })
})
