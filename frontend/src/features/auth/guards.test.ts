import { safeNext } from './guards'

describe('safeNext', () => {
  it.each([
    ['/sell', '/sell'],
    ['/admin/sellers?status=pending', '/admin/sellers?status=pending'],
  ])('keeps the same-site path %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })

  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])(
    'falls back to the home page for %s',
    (input) => {
      expect(safeNext(input)).toBe('/')
    },
  )
})
