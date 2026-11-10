// Formats API decimal strings ("1234.5") as pesos without converting to floating point.
export function formatPeso(value: string): string {
  const negative = value.startsWith('-')
  const [whole = '0', fraction = ''] = value.replace('-', '').split('.')
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}₱${grouped}.${fraction.padEnd(2, '0').slice(0, 2)}`
}
