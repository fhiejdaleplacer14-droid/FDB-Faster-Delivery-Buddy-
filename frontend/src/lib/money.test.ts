import { formatPeso, formatRate } from './money'

describe('formatRate', () => {
  it.each([
    ['0.0750', '7.5%'],
    ['0.1000', '10%'],
    ['0.0525', '5.25%'],
    ['0.0000', '0%'],
    ['0.5000', '50%'],
    ['0.0005', '0.05%'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatRate(input)).toBe(expected)
  })
})

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
