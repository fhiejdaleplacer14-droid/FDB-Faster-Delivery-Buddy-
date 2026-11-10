import { formatPeso } from './money'

describe('formatPeso', () => {
  it.each([
    ['0', '₱0.00'],
    ['5.5', '₱5.50'],
    ['120.50', '₱120.50'],
    ['1234', '₱1,234.00'],
    ['1000000.00', '₱1,000,000.00'],
    ['0.10', '₱0.10'],
    ['-37.5', '-₱37.50'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatPeso(input)).toBe(expected)
  })

  it('keeps exact cents that floats would round', () => {
    expect(formatPeso('9007199254740993.99')).toBe('₱9,007,199,254,740,993.99')
  })
})
