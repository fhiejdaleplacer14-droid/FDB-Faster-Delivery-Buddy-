const BASE_URL = '/api/v1'
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RequestOptions = {
  params?: object | undefined
  headers?: Record<string, string> | undefined
  signal?: AbortSignal | undefined
}

export type HttpResponse<T> = { data: T; status: number }

// A failed request. `status` is null when the server could not be reached.
export class HttpError extends Error {
  readonly status: number | null
  readonly data: unknown

  constructor(status: number | null, data: unknown = null, options?: ErrorOptions) {
    super(status === null ? 'Network error' : `Request failed with status ${status}`, options)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

function query(params: object | undefined): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params) as [string, unknown][]) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v: unknown) => search.append(`${key}[]`, String(v)))
    else search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

function xsrfToken(): string | null {
  const cookie = document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : null
}

export async function ensureCsrfCookie(): Promise<void> {
  await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
}

async function parse(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  return response.headers.get('Content-Type')?.includes('json') ? (JSON.parse(text) as unknown) : text
}

async function send<T>(method: Method, url: string, body: unknown, options: RequestOptions = {}, retried = false): Promise<HttpResponse<T>> {
  const unsafe = !SAFE_METHODS.includes(method)
  if (unsafe && !xsrfToken()) await ensureCsrfCookie()

  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...options.headers }
  const token = unsafe ? xsrfToken() : null
  if (token) headers['X-XSRF-TOKEN'] = token

  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(BASE_URL + url + query(options.params), {
      method,
      headers,
      body: payload ?? null,
      credentials: 'same-origin',
      signal: options.signal ?? null,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new HttpError(null, null, { cause: error })
  }

  // 419 means the CSRF token went stale (e.g. the session expired); refresh it and retry once.
  if (response.status === 419 && !retried) {
    await ensureCsrfCookie()
    return send<T>(method, url, body, options, true)
  }

  // Too many requests: a read waits as long as the server asks (at most 5 s) and tries once more.
  if (response.status === 429 && !retried && SAFE_METHODS.includes(method)) {
    const wait = Math.min(Number(response.headers.get('Retry-After')) || 2, 5)
    await new Promise((resolve) => setTimeout(resolve, wait * 1000))
    return send<T>(method, url, body, options, true)
  }

  const data = await parse(response).catch(() => null)
  if (!response.ok) throw new HttpError(response.status, data)

  return { data: data as T, status: response.status }
}

export const http = {
  get: <T = unknown>(url: string, options?: RequestOptions) => send<T>('GET', url, undefined, options),
  delete: <T = unknown>(url: string, options?: RequestOptions) => send<T>('DELETE', url, undefined, options),
  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => send<T>('POST', url, body, options),
  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => send<T>('PUT', url, body, options),
  patch: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) => send<T>('PATCH', url, body, options),
}

export function httpStatus(error: unknown): number | null {
  return error instanceof HttpError ? error.status : null
}

export type ApiError = {
  status: number | null
  message: string
  fieldErrors: Record<string, string[]>
}

type LaravelErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpError) {
    if (error.status === null) {
      return {
        status: null,
        message: 'We could not reach FDB. Check your connection and try again.',
        fieldErrors: {},
      }
    }

    const body = (error.data && typeof error.data === 'object' ? error.data : {}) as LaravelErrorBody
    // The server's own wording for these ("Too Many Attempts.", "Server Error") is not meant for people.
    const message =
      error.status === 429
        ? 'Too many tries in a short time. Please wait a minute, then try again.'
        : error.status >= 500
          ? 'Something went wrong on our side. Please try again.'
          : (body.message ?? 'Something went wrong on our side. Please try again.')
    return {
      status: error.status,
      message,
      fieldErrors: body.errors ?? {},
    }
  }

  return { status: null, message: 'Something went wrong. Please try again.', fieldErrors: {} }
}

export function firstError(error: ApiError | null, field: string): string | undefined {
  return error?.fieldErrors[field]?.[0]
}
