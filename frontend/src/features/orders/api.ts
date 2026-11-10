import { http } from '@/lib/http'
import type { Address, CartResponse, Order, Paginated, Resource, ServiceArea } from '@/types/api'

export type AddressInput = {
  label: string
  recipient_name: string
  phone: string
  municipality: ServiceArea | ''
  barangay: string
  street: string
  landmark: string
  is_default?: boolean
}

export type CheckoutInput = { address_id: number; payment_method: string; expected_total: string; note: string }

export const cartApi = {
  async get() {
    return (await http.get<CartResponse>('/cart')).data
  },
  async add(variantId: number, quantity: number) {
    return (await http.post<CartResponse>('/cart/items', { variant_id: variantId, quantity })).data
  },
  async update(itemId: number, quantity: number) {
    return (await http.patch<CartResponse>(`/cart/items/${itemId}`, { quantity })).data
  },
  async remove(itemId: number) {
    return (await http.delete<CartResponse>(`/cart/items/${itemId}`)).data
  },
}

export const addressApi = {
  async list() {
    return (await http.get<Resource<Address[]>>('/addresses')).data.data
  },
  async create(input: AddressInput) {
    return (await http.post<Resource<Address>>('/addresses', input)).data.data
  },
  async update(id: number, input: AddressInput) {
    return (await http.put<Resource<Address>>(`/addresses/${id}`, input)).data.data
  },
  async remove(id: number) {
    await http.delete(`/addresses/${id}`)
  },
}

export const orderApi = {
  async checkout(input: CheckoutInput, idempotencyKey: string) {
    return (await http.post<Resource<Order>>('/checkout', input, { headers: { 'Idempotency-Key': idempotencyKey } })).data.data
  },
  async list(page = 1) {
    return (await http.get<Paginated<Order>>('/orders', { params: { page } })).data
  },
  async get(number: string) {
    return (await http.get<Resource<Order>>(`/orders/${encodeURIComponent(number)}`)).data.data
  },
  async cancel(number: string, sellerOrderNumber: string, reason: string) {
    return (await http.post<Resource<Order>>(`/orders/${encodeURIComponent(number)}/seller-orders/${encodeURIComponent(sellerOrderNumber)}/cancel`, { reason: reason || null })).data.data
  },
}
