import { http } from '@/lib/http'
import type { Paginated, Resource, SellerApplication, SellerStatus } from '@/types/api'

export type SellerDecision = 'approve' | 'reject' | 'suspend' | 'reactivate'

export const adminApi = {
  async sellers(params: { status?: SellerStatus | undefined; search?: string | undefined; page?: number }) {
    return (await http.get<Paginated<SellerApplication>>('/admin/sellers', { params })).data
  },
  async seller(id: string | number) {
    return (await http.get<Resource<SellerApplication>>(`/admin/sellers/${id}`)).data.data
  },
  async decide(id: number, decision: SellerDecision, reason?: string) {
    return (await http.post<Resource<SellerApplication>>(`/admin/sellers/${id}/${decision}`, reason ? { reason } : {})).data.data
  },
}
