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
