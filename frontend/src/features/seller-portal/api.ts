import { http } from '@/lib/http'
import type { ManagedProduct, Paginated, ProductStatus, Resource } from '@/types/api'

export type VariantInput = { id?: number | undefined; name: string; sku: string; price: string; stock: string }
export type ProductInput = { category_id: number | ''; name: string; description: string; variants: VariantInput[] }

function payload(input: ProductInput) {
  return {
    ...input,
    variants: input.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name.trim(),
      sku: v.sku.trim() || null,
      price: v.price.trim(),
      stock: v.stock.trim(),
    })),
  }
}

const url = (id: number, suffix = '') => `/seller/products/${id}${suffix}`

export const sellerProductsApi = {
  async list(params: { status?: ProductStatus | undefined; search?: string | undefined; page?: number }) {
    return (await http.get<Paginated<ManagedProduct>>('/seller/products', { params })).data
  },
  async get(id: number | string) {
    return (await http.get<Resource<ManagedProduct>>(`/seller/products/${id}`)).data.data
  },
  async create(input: ProductInput) {
    return (await http.post<Resource<ManagedProduct>>('/seller/products', payload(input))).data.data
  },
  async update(id: number, input: ProductInput) {
    return (await http.put<Resource<ManagedProduct>>(url(id), payload(input))).data.data
  },
  async action(id: number, action: 'submit' | 'archive' | 'restore') {
    return (await http.post<Resource<ManagedProduct>>(url(id, `/${action}`))).data.data
  },
  async uploadImage(id: number, file: File) {
    const data = new FormData()
    data.append('image', file)
    return (await http.post<Resource<ManagedProduct>>(url(id, '/images'), data)).data.data
  },
  async deleteImage(id: number, imageId: number) {
    return (await http.delete<Resource<ManagedProduct>>(url(id, `/images/${imageId}`))).data.data
  },
  async reorderImages(id: number, imageIds: number[]) {
    return (await http.put<Resource<ManagedProduct>>(url(id, '/images/order'), { image_ids: imageIds })).data.data
  },
}
