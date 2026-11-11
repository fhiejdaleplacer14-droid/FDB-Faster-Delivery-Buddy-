import { compareMoney, formatPeso, formatRate, subtractMoney } from './money'

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

describe('subtractMoney and compareMoney', () => {
  it.each([
    ['500.00', '100.00', '400.00'],
    ['0.30', '0.10', '0.20'],
    ['100', '0.01', '99.99'],
    ['5.5', '7.25', '-1.75'],
    ['9007199254740993.99', '0.99', '9007199254740993.00'],
  ])('%s - %s = %s', (a, b, expected) => {
    expect(subtractMoney(a, b)).toBe(expected)
  })

  it('compares without floating point', () => {
    expect(compareMoney('0.30', '0.3')).toBe(0)
    expect(compareMoney('100.01', '100.00')).toBe(1)
    expect(compareMoney('99.99', '100')).toBe(-1)
  })
})
