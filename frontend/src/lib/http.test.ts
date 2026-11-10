import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { toApiError } from './http'

function responseError(status: number, data: unknown) {
  const response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, response as AxiosResponse)
}

describe('toApiError', () => {
  it('keeps Laravel validation messages and field errors', () => {
    const error = toApiError(
      responseError(422, { message: 'The email field is required.', errors: { email: ['Required'] } }),
    )
    expect(error).toEqual({
      status: 422,
      message: 'The email field is required.',
      fieldErrors: { email: ['Required'] },
    })
  })

  it('uses a generic message when the server sends none', () => {
    expect(toApiError(responseError(500, '')).message).toBe(
      'Something went wrong on our side. Please try again.',
    )
  })

  it('reports network failures without a status', () => {
    const error = toApiError(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(error.status).toBeNull()
    expect(error.message).toMatch(/could not reach FDB/)
  })
})
