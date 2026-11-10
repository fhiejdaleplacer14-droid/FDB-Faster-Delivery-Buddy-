import { http } from '@/lib/http'
import type { Paginated, Resource, Ticket, TicketCategory, TicketCategoryOption, TicketStatus } from '@/types/api'

export type TicketInput = { category: TicketCategory; subject: string; body: string; seller_order_number: string }

export const supportApi = {
  async categories() {
    return (await http.get<{ data: TicketCategoryOption[]; dispute_window_days: number }>('/support/categories')).data
  },
  async list(page = 1) {
    return (await http.get<Paginated<Ticket>>('/support/tickets', { params: { page } })).data
  },
  async create(input: TicketInput) {
    return (await http.post<Resource<Ticket>>('/support/tickets', { ...input, seller_order_number: input.seller_order_number || null })).data.data
  },
  async get(number: string) {
    return (await http.get<Resource<Ticket>>(`/support/tickets/${encodeURIComponent(number)}`)).data.data
  },
  async reply(number: string, body: string) {
    return (await http.post<Resource<Ticket>>(`/support/tickets/${encodeURIComponent(number)}/messages`, { body })).data.data
  },
  async sellerList(params: { status?: TicketStatus | undefined; page?: number }) {
    return (await http.get<Paginated<Ticket>>('/seller/support-tickets', { params })).data
  },
}

export type AdminTicketFilters = { status?: string | undefined; category?: string | undefined; search?: string | undefined; page?: number }

export const adminSupportApi = {
  async list(params: AdminTicketFilters) {
    return (await http.get<Paginated<Ticket>>('/admin/support-tickets', { params })).data
  },
  async get(number: string) {
    return (await http.get<Resource<Ticket>>(`/admin/support-tickets/${encodeURIComponent(number)}`)).data.data
  },
  async reply(number: string, body: string) {
    return (await http.post<Resource<Ticket>>(`/admin/support-tickets/${encodeURIComponent(number)}/messages`, { body })).data.data
  },
  async setStatus(number: string, status: TicketStatus, resolution: string) {
    return (await http.post<Resource<Ticket>>(`/admin/support-tickets/${encodeURIComponent(number)}/status`, { status, resolution: resolution || null })).data.data
  },
}
