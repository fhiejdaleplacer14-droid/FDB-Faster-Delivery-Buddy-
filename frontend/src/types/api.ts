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
