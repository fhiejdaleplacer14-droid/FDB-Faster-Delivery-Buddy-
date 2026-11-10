import { http } from '@/lib/http'
import type { CommissionPolicy, CommissionRecord, FinancialSummary, Paginated, Resource } from '@/types/api'

export type SellerBalance = { seller_id: number; store_name: string; records: number; due: string }

export const commissionsApi = {
  async policies() {
    return (await http.get<Resource<CommissionPolicy[]>>('/admin/commission-policies')).data.data
  },
  async setPolicy(input: { rate_percent: string; seller_id: number | null; notes: string }) {
    await http.post('/admin/commission-policies', { ...input, notes: input.notes || null })
  },
  async balances() {
    return (await http.get<Resource<SellerBalance[]>>('/admin/commissions/balances')).data.data
  },
  async records(params: { status?: string | undefined; seller_id?: number | undefined; page?: number; per_page?: number }) {
    return (await http.get<Paginated<CommissionRecord>>('/admin/commissions', { params })).data
  },
  async adjust(id: number, amount: string, reason: string) {
    return (await http.post<Resource<CommissionRecord>>(`/admin/commissions/${id}/adjustments`, { amount, reason })).data.data
  },
  async collect(input: { seller_id: number; record_ids: number[]; method: string; reference: string; notes: string; collected_at: string }) {
    return (
      await http.post<Resource<{ id: number; amount: string }>>('/admin/commission-collections', {
        ...input,
        reference: input.reference || null,
        notes: input.notes || null,
        collected_at: input.collected_at || null,
      })
    ).data.data
  },
  async report(from: string, to: string) {
    return (await http.get<Resource<FinancialSummary>>('/admin/reports/financial', { params: { from, to } })).data.data
  },
}
