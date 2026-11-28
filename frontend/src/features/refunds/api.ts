import { http } from '@/lib/http'
import type { Paginated, Refund, RefundMethod, Resource, SellerOrder } from '@/types/api'

export type RefundInput = {
  amount: string
  method: RefundMethod
  reference: string
  reason: string
  refunded_at: string
  support_ticket_number: string
}

// Blank optional fields are sent as null so the server applies its defaults.
function body(input: RefundInput) {
  return {
    amount: input.amount.trim(),
    method: input.method,
    reason: input.reason.trim(),
    reference: input.reference.trim() || null,
    refunded_at: input.refunded_at || null,
    support_ticket_number: input.support_ticket_number.trim() || null,
  }
}

export const refundApi = {
  async recordAsSeller(sellerOrderId: number, input: RefundInput) {
    return (await http.post<Resource<SellerOrder>>(`/seller/orders/${sellerOrderId}/refunds`, body(input))).data.data
  },
  async recordAsAdmin(sellerOrderId: number, input: RefundInput) {
    return (await http.post<Resource<SellerOrder>>(`/admin/seller-orders/${sellerOrderId}/refunds`, body(input))).data.data
  },
  async list(params: { credit?: 'owed' | 'settled' | 'pending' | undefined; page?: number }) {
    return (await http.get<Paginated<Refund> & { summary: { credit_owed: string; pending: number; total: string } }>('/admin/refunds', { params })).data
  },
  async reviewCommission(id: number, decision: 'approve' | 'decline') {
    return (await http.post<Resource<Refund>>(`/admin/refunds/${id}/${decision}-commission`)).data.data
  },
  async settleCredit(id: number) {
    return (await http.post<Resource<Refund>>(`/admin/refunds/${id}/settle-credit`)).data.data
  },
}

export const refundMethods: { value: RefundMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]
