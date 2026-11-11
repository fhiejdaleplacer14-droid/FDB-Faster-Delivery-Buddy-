import { http, HttpError, toApiError } from './http'

type Call = [string, RequestInit]

function json(status: number, body: unknown) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(...responses: (Response | Error)[]) {
  const fn = vi.fn<(...args: Call) => Promise<Response>>(() => {
    const next = responses.shift()
    if (!next) throw new Error('unexpected request')
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function headersOf(call: Call | undefined): Record<string, string> {
  return (call?.[1].headers ?? {}) as Record<string, string>
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('http', () => {
  it('builds the query string and skips empty values', async () => {
    const fetch = stubFetch(json(200, { data: [] }))
    const result = await http.get<{ data: unknown[] }>('/products', { params: { search: 'mango chips', page: 2, category: undefined, sort: '', ids: [1, 2] } })

    expect(result.data).toEqual({ data: [] })
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/v1/products?search=mango+chips&page=2&ids%5B%5D=1&ids%5B%5D=2')
    expect(headersOf(fetch.mock.calls[0])).not.toHaveProperty('X-XSRF-TOKEN')
  })

  it('fetches the CSRF cookie before the first write and sends the token as JSON', async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }), json(201, { data: { id: 1 } }))
    fetch.mockImplementationOnce(() => {
      document.cookie = 'XSRF-TOKEN=abc%3D%3D; path=/'
      return Promise.resolve(new Response(null, { status: 204 }))
    })

    await http.post('/cart/items', { variant_id: 3, quantity: 1 }, { headers: { 'Idempotency-Key': 'k1' } })

    expect(fetch.mock.calls[0]?.[0]).toBe('/sanctum/csrf-cookie')
    const [url, init] = fetch.mock.calls[1] as Call
    expect(url).toBe('/api/v1/cart/items')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"variant_id":3,"quantity":1}')
    expect(headersOf(fetch.mock.calls[1])).toMatchObject({ 'X-XSRF-TOKEN': 'abc==', 'Content-Type': 'application/json', 'Idempotency-Key': 'k1' })
  })

  it('sends FormData untouched so the browser sets the boundary', async () => {
    document.cookie = 'XSRF-TOKEN=t; path=/'
    const fetch = stubFetch(json(201, {}))
    const form = new FormData()
    form.append('file', new Blob(['x']), 'a.jpg')

    await http.post('/seller-application', form)

    expect(fetch.mock.calls[0]?.[1].body).toBe(form)
    expect(headersOf(fetch.mock.calls[0])).not.toHaveProperty('Content-Type')
  })

  it('refreshes the CSRF cookie and retries once on 419', async () => {
    document.cookie = 'XSRF-TOKEN=old; path=/'
    const fetch = stubFetch(json(419, { message: 'CSRF token mismatch.' }), new Response(null, { status: 204 }), json(200, { ok: true }))

    await expect(http.post('/auth/login', {})).resolves.toMatchObject({ data: { ok: true } })
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/v1/auth/login', '/sanctum/csrf-cookie', '/api/v1/auth/login'])
  })

  it('does not retry a second 419', async () => {
    document.cookie = 'XSRF-TOKEN=old; path=/'
    stubFetch(json(419, {}), new Response(null, { status: 204 }), json(419, { message: 'Expired' }))

    await expect(http.post('/auth/login', {})).rejects.toMatchObject({ status: 419 })
  })

  it('rejects with the status and body on errors, and with a null status when offline', async () => {
    stubFetch(json(422, { message: 'Invalid', errors: { email: ['Required'] } }), new TypeError('Failed to fetch'))

    const error = await http.get('/user').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect(toApiError(error)).toEqual({ status: 422, message: 'Invalid', fieldErrors: { email: ['Required'] } })
    expect(await http.get('/user').catch((e: unknown) => toApiError(e).status)).toBeNull()
  })

  it('returns null data for empty responses', async () => {
    document.cookie = 'XSRF-TOKEN=t; path=/'
    stubFetch(new Response(null, { status: 204 }))
    await expect(http.delete('/addresses/1')).resolves.toEqual({ data: null, status: 204 })
  })
})

describe('toApiError', () => {
  it('uses a generic message when the server sends none', () => {
    expect(toApiError(new HttpError(500, '')).message).toBe('Something went wrong on our side. Please try again.')
  })

  it('reports network failures without a status', () => {
    const error = toApiError(new HttpError(null))
    expect(error.status).toBeNull()
    expect(error.message).toMatch(/could not reach FDB/)
  })
})
