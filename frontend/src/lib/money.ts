// "0.0750" -> "7.5%", by moving the decimal point in the string rather than multiplying a float.
export function formatRate(rate: string): string {
  const [whole = '0', fraction = ''] = rate.split('.')
  const digits = (whole + fraction.padEnd(4, '0')).replace(/^0+(?=\d{3})/, '')
  const percent = `${digits.slice(0, -2) || '0'}.${digits.slice(-2)}`.replace(/^0+(?=\d)/, '').replace(/\.?0+$/, '')
  return `${percent || '0'}%`
}

// Formats API decimal strings ("1234.5") as pesos without converting to floating point.
export function formatPeso(value: string): string {
  const negative = value.startsWith('-')
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.')
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}₱${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`
}

function centavos(value: string): bigint {
  const negative = value.trim().startsWith('-')
  const [whole = '0', fraction = ''] = value.trim().replace('-', '').split('.')
  const cents = BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
  return negative ? -cents : cents
}

function fromCentavos(cents: bigint): string {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  return `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`
}

// Exact decimal subtraction on API amounts, done in whole centavos.
export function subtractMoney(a: string, b: string): string {
  return fromCentavos(centavos(a) - centavos(b))
}

// -1, 0, or 1, like a comparator.
export function compareMoney(a: string, b: string): number {
  const diff = centavos(a) - centavos(b)
  return diff === 0n ? 0 : diff < 0n ? -1 : 1
}
