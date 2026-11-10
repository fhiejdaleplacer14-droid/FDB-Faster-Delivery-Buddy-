import { http } from '@/lib/http'
import type { Category, Paginated, ProductCard, ProductDetail, Resource, StoreProfile } from '@/types/api'

export type ProductQuery = {
  search?: string | undefined
  category?: string | undefined
  store?: string | undefined
  municipality?: string | undefined
  min_price?: string | undefined
  max_price?: string | undefined
  in_stock?: '1' | undefined
  sort?: string | undefined
  page?: number | undefined
  per_page?: number | undefined
}

export const catalogApi = {
  async categories() {
    return (await http.get<Resource<Category[]>>('/categories')).data.data
  },
  async products(query: ProductQuery) {
    return (await http.get<Paginated<ProductCard>>('/products', { params: query })).data
  },
  async product(slug: string) {
    return (await http.get<Resource<ProductDetail>>(`/products/${encodeURIComponent(slug)}`)).data.data
  },
  async store(slug: string) {
    return (await http.get<Resource<StoreProfile>>(`/stores/${encodeURIComponent(slug)}`)).data.data
  },
}
