export type Resource<T> = { data: T }

export type Paginated<T> = {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export type RoleSlug = 'customer' | 'seller' | 'admin'

export type PermissionSlug =
  | 'sellers.review'
  | 'sellers.manage'
  | 'sellers.documents.view'
  | 'audit_logs.view'
  | 'products.moderate'
  | 'categories.manage'

export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export type User = {
  id: number
  name: string
  email: string
  email_verified: boolean
  status: 'active' | 'suspended'
  roles: RoleSlug[]
  permissions: PermissionSlug[]
  seller: { id: number; store_name: string; status: SellerStatus } | null
}

export type ServiceArea = 'vallehermoso' | 'guihulngan' | 'san_carlos_city'

export type SellerDocumentType =
  | 'government_id'
  | 'business_permit'
  | 'dti_registration'
  | 'sec_registration'
  | 'bir_registration'
  | 'other'

export type SellerDocument = {
  id: number
  type: SellerDocumentType
  type_label: string
  original_name: string
  mime_type: string
  size_bytes: number
  uploaded_at: string
  download_url?: string
}

export type SellerHistoryEntry = {
  from: SellerStatus | null
  to: SellerStatus
  reason: string | null
  actor?: { id: number; name: string } | null
  at: string
}

export type SellerApplication = {
  id: number
  store_name: string
  slug: string
  description: string | null
  contact_phone: string
  municipality: { value: ServiceArea; label: string }
  barangay: string
  address_line: string
  business_type: 'individual' | 'registered_business'
  business_name: string | null
  business_registration_number: string | null
  status: SellerStatus
  decision_reason: string | null
  submitted_at: string
  reviewed_at: string | null
  approved_at: string | null
  suspended_at: string | null
  applicant?: { id: number; name: string; email: string; email_verified: boolean }
  reviewer?: { id: number; name: string } | null
  documents?: SellerDocument[]
  history?: SellerHistoryEntry[]
}

export type Category = {
  id: number
  parent_id: number | null
  name: string
  slug: string
  position: number
  is_active: boolean
  products_count?: number
  children?: Category[]
}

export type ImageRef = { id?: number; url: string; width: number; height: number }

export type StoreProfile = {
  name: string
  slug: string
  description: string | null
  municipality: string
  barangay: string
  selling_since: string | null
}

export type ProductCard = {
  id: number
  slug: string
  name: string
  price_from: string
  in_stock: boolean
  image: ImageRef | null
  store: { name: string; slug: string; municipality: string }
  category: { name: string; slug: string }
}

export type ProductDetail = {
  id: number
  slug: string
  name: string
  description: string
  price_from: string
  in_stock: boolean
  published_at: string | null
  images: ImageRef[]
  variants: { id: number; name: string; price: string; stock: number }[]
  store: StoreProfile
  category: { name: string; slug: string }
}

export type ProductStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'

export type ManagedVariant = { id: number; name: string; sku: string | null; price: string; stock: number }

export type ManagedProduct = {
  id: number
  slug: string
  name: string
  description: string
  status: ProductStatus
  moderation_reason: string | null
  category_id: number
  category?: { id: number; name: string }
  price_from: string
  stock_total: number
  submitted_at: string | null
  published_at: string | null
  reviewed_at: string | null
  updated_at: string
  cover_image_url?: string | null
  variants?: ManagedVariant[]
  images?: ImageRef[]
  store?: { id: number; name: string; slug: string; status: SellerStatus }
}
