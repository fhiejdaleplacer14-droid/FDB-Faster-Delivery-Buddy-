import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

export function ensureCsrfCookie() {
  return axios.get('/sanctum/csrf-cookie', { withCredentials: true })
}

function hasXsrfCookie() {
  return document.cookie.split('; ').some((c) => c.startsWith('XSRF-TOKEN='))
}

const SAFE_METHODS = ['get', 'head', 'options']

http.interceptors.request.use(async (config) => {
  if (!SAFE_METHODS.includes(config.method ?? 'get') && !hasXsrfCookie()) {
    await ensureCsrfCookie()
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

// 419 means the CSRF token went stale (e.g. the session expired); refresh it and retry once.
http.interceptors.response.use(undefined, async (error: unknown) => {
  if (error instanceof AxiosError && error.response?.status === 419 && error.config) {
    const config = error.config as RetriableConfig
    if (!config._csrfRetried) {
      config._csrfRetried = true
      await ensureCsrfCookie()
      return http.request(config)
    }
  }
  throw error
})

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
  if (error instanceof AxiosError) {
    if (!error.response) {
      return {
        status: null,
        message: 'We could not reach FDB. Check your connection and try again.',
        fieldErrors: {},
      }
    }

    const body = (error.response.data ?? {}) as LaravelErrorBody
    return {
      status: error.response.status,
      message: body.message ?? 'Something went wrong on our side. Please try again.',
      fieldErrors: body.errors ?? {},
    }
  }

  return { status: null, message: 'Something went wrong. Please try again.', fieldErrors: {} }
}

export function firstError(error: ApiError | null, field: string): string | undefined {
  return error?.fieldErrors[field]?.[0]
}
