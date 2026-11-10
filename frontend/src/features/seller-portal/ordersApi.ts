import { http } from '@/lib/http'
import type { Paginated, Resource, SellerOrder, SellerOrderStatus } from '@/types/api'

const url = (id: number | string, suffix = '') => `/seller/orders/${id}${suffix}`

export const sellerOrdersApi = {
  async list(params: { status?: string | undefined; page?: number }) {
    return (await http.get<Paginated<SellerOrder>>('/seller/orders', { params })).data
  },
  async get(id: number | string) {
    return (await http.get<Resource<SellerOrder>>(url(id))).data.data
  },
  async advance(id: number, status: SellerOrderStatus, note: string) {
    return (await http.post<Resource<SellerOrder>>(url(id, '/status'), { status, note: note || null })).data.data
  },
  async cancel(id: number, reason: string) {
    return (await http.post<Resource<SellerOrder>>(url(id, '/cancel'), { reason })).data.data
  },
  async paymentReceived(id: number) {
    return (await http.post<Resource<SellerOrder>>(url(id, '/payment-received'))).data.data
  },
  async delivery(id: number, deliveryNote: string) {
    return (await http.put<Resource<SellerOrder>>(url(id, '/delivery'), { delivery_note: deliveryNote || null })).data.data
  },
}
