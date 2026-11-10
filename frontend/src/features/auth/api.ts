import { http } from '@/lib/http'
import type { Resource, User } from '@/types/api'

export type RegisterInput = { name: string; email: string; password: string; password_confirmation: string }
export type LoginInput = { email: string; password: string; remember: boolean }
export type ResetPasswordInput = { token: string; email: string; password: string; password_confirmation: string }

export const authApi = {
  async currentUser() {
    return (await http.get<Resource<User>>('/user')).data.data
  },
  async register(input: RegisterInput) {
    return (await http.post<Resource<User>>('/auth/register', input)).data.data
  },
  async login(input: LoginInput) {
    return (await http.post<Resource<User>>('/auth/login', input)).data.data
  },
  async logout() {
    await http.post('/auth/logout')
  },
  async forgotPassword(email: string) {
    return (await http.post<{ message: string }>('/auth/forgot-password', { email })).data.message
  },
  async resetPassword(input: ResetPasswordInput) {
    return (await http.post<{ message: string }>('/auth/reset-password', input)).data.message
  },
  async verifyEmail(id: string, hash: string, query: string) {
    return (await http.get<{ message: string }>(`/auth/verify-email/${encodeURIComponent(id)}/${encodeURIComponent(hash)}?${query}`)).data.message
  },
  async resendVerification() {
    return (await http.post<{ message: string }>('/auth/verify-email/resend')).data.message
  },
  async updateProfile(input: { name: string; email: string }) {
    return (await http.patch<Resource<User>>('/user', input)).data.data
  },
  async updatePassword(input: { current_password: string; password: string; password_confirmation: string }) {
    await http.put('/user/password', input)
  },
}
