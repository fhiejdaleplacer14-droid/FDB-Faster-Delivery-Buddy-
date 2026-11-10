import { http } from '@/lib/http'
import type { Paginated, RatingSummary, Resource, Review, ReviewStatus } from '@/types/api'

export type ReviewPage = Paginated<Review> & { summary: RatingSummary }

export const reviewApi = {
  async forProduct(slug: string, page = 1) {
    return (await http.get<ReviewPage>(`/products/${encodeURIComponent(slug)}/reviews`, { params: { page } })).data
  },
  async create(orderNumber: string, itemId: number, rating: number, comment: string) {
    const url = `/orders/${encodeURIComponent(orderNumber)}/items/${itemId}/review`
    return (await http.post<Resource<Review>>(url, { rating, comment: comment || null })).data.data
  },
}

export const sellerReviewApi = {
  async list(params: { unanswered?: '1' | undefined; page?: number }) {
    return (await http.get<Paginated<Review>>('/seller/reviews', { params })).data
  },
  async reply(id: number, reply: string) {
    return (await http.post<Resource<Review>>(`/seller/reviews/${id}/reply`, { reply })).data.data
  },
}

export const adminReviewApi = {
  async list(params: { status?: ReviewStatus | undefined; rating?: string | undefined; search?: string | undefined; page?: number }) {
    return (await http.get<Paginated<Review>>('/admin/reviews', { params })).data
  },
  async hide(id: number, reason: string) {
    return (await http.post<Resource<Review>>(`/admin/reviews/${id}/hide`, { reason })).data.data
  },
  async restore(id: number) {
    return (await http.post<Resource<Review>>(`/admin/reviews/${id}/restore`)).data.data
  },
}
