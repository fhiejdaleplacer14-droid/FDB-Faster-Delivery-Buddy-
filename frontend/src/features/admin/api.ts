import { http } from '@/lib/http'
import type { Category, ManagedProduct, Paginated, ProductStatus, Resource, SellerApplication, SellerStatus } from '@/types/api'

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

export const adminCatalogApi = {
  async products(params: { status?: ProductStatus | undefined; search?: string | undefined; page?: number }) {
    return (await http.get<Paginated<ManagedProduct>>('/admin/products', { params })).data
  },
  async product(id: string | number) {
    return (await http.get<Resource<ManagedProduct>>(`/admin/products/${id}`)).data.data
  },
  async approve(id: number) {
    return (await http.post<Resource<ManagedProduct>>(`/admin/products/${id}/approve`)).data.data
  },
  async reject(id: number, reason: string) {
    return (await http.post<Resource<ManagedProduct>>(`/admin/products/${id}/reject`, { reason })).data.data
  },
  async recategorize(id: number, categoryId: number) {
    return (await http.post<Resource<ManagedProduct>>(`/admin/products/${id}/category`, { category_id: categoryId })).data.data
  },
  async categories() {
    return (await http.get<Resource<Category[]>>('/admin/categories')).data.data
  },
  async createCategory(input: { name: string; parent_id: number | null }) {
    return (await http.post<Resource<Category>>('/admin/categories', input)).data.data
  },
  async updateCategory(id: number, input: { name: string; parent_id: number | null; is_active: boolean; position: number }) {
    return (await http.patch<Resource<Category>>(`/admin/categories/${id}`, input)).data.data
  },
  async deleteCategory(id: number) {
    await http.delete(`/admin/categories/${id}`)
  },
}
