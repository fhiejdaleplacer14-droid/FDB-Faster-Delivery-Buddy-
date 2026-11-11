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
  | 'orders.view'
  | 'commissions.manage'
  | 'reports.view'
  | 'reviews.moderate'
  | 'support.manage'
  | 'refunds.manage'

export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export type User = {
  id: number
  name: string
  email: string
  email_verified: boolean
  email_verification_required: boolean
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

export type RatingSummary = { average: string | null; count: number }

export type ProductCard = {
  id: number
  slug: string
  name: string
  price_from: string
  in_stock: boolean
  rating: RatingSummary
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
  rating: RatingSummary
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

export type CartProblem = 'unavailable' | 'own_store' | 'out_of_stock' | 'not_enough_stock'

export type CartLine = {
  id: number
  variant_id: number
  product: { id: number; name: string; slug: string }
  variant_name: string
  image_url: string | null
  unit_price: string
  quantity: number
  stock: number
  line_total: string
  problem: CartProblem | null
}

export type Cart = {
  groups: { store: { id: number; name: string; slug: string }; items: CartLine[]; subtotal: string }[]
  total: string
  item_count: number
  can_checkout: boolean
}

export type PaymentMethodOption = { value: string; label: string; available: boolean }

export type CartResponse = { data: Cart; meta: { payment_methods: PaymentMethodOption[] } }

export type Address = {
  id: number
  label: string | null
  recipient_name: string
  phone: string
  municipality: { value: ServiceArea; label: string }
  barangay: string
  street: string
  landmark: string | null
  is_default: boolean
}

export type SellerOrderStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export type DeliveryDetails = {
  recipient_name: string
  phone: string
  municipality: string
  barangay: string
  street: string
  landmark: string | null
}

export type PaymentStatus = 'unpaid' | 'paid' | 'partially_refunded' | 'refunded'

export type RefundMethod = 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'other'

export type Refund = {
  id: number
  amount: string
  method: RefundMethod
  method_label: string
  reference: string | null
  reason: string
  recorded_as: 'seller' | 'admin'
  refunded_at: string
  recorded_by?: string | null
  commission_reduction?: string
  commission_credit?: string
  credit_settled_at?: string | null
  ticket_number?: string | null
  seller_order?: { id: number; number: string; order_number: string | null }
  store?: { id: number; name: string }
}

export type SellerOrder = {
  id: number
  number: string
  status: SellerOrderStatus
  payment_status: PaymentStatus
  items_total: string
  delivery_fee: string
  total: string
  refunded_total: string
  refunds?: Refund[]
  commission?: { rate: string; amount: string; seller_amount: string }
  delivery_note: string | null
  cancel_reason: string | null
  cancelled_by: 'customer' | 'seller' | 'admin' | null
  confirmed_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  paid_at: string | null
  created_at: string
  store?: { id: number; name: string; slug: string }
  items?: {
    id: number
    product_id: number
    product_slug: string | null
    product_name: string
    variant_name: string
    unit_price: string
    quantity: number
    line_total: string
    review: { rating: number; comment: string | null; status: ReviewStatus } | null
  }[]
  history?: { from: SellerOrderStatus | null; to: SellerOrderStatus; note: string | null; actor: { id: number; name: string } | null; at: string }[]
  order?: {
    number: string
    payment_method: string
    payment_method_label: string
    placed_at: string
    customer_note: string | null
    customer_name: string | null
    delivery: DeliveryDetails
  }
}

export type Order = {
  number: string
  status: 'in_progress' | 'completed' | 'cancelled'
  payment_method: string
  payment_method_label: string
  items_total: string
  delivery_fee_total: string
  grand_total: string
  placed_at: string
  customer_note: string | null
  customer?: { id: number; name: string; email: string }
  delivery: DeliveryDetails
  seller_orders: SellerOrder[]
}

export type CommissionStatus = 'pending' | 'due' | 'collected' | 'voided'

export type CommissionRecord = {
  id: number
  status: CommissionStatus
  rate: string
  base_amount: string
  amount: string
  adjustment_total: string
  net_amount: string
  due_at: string | null
  voided_at: string | null
  created_at: string
  seller_order?: { id: number; number: string; status: SellerOrderStatus }
  store?: { id: number; name: string }
  collection?: { id: number; method: string; reference: string | null; collected_at: string } | null
  adjustments?: { amount: string; reason: string; at: string }[]
}

export type CommissionPolicy = {
  id: number
  store: { id: number; name: string } | null
  rate: string
  rate_percent: string
  effective_from: string
  effective_until: string | null
  active: boolean
  notes: string | null
  created_by: string | null
}

export type FinancialSummary = {
  period: { from: string; to: string }
  orders_placed: number
  gmv_placed: string
  orders_delivered: number
  gmv_delivered: string
  commission_earned: string
  seller_earnings: string
  commission_collected: string
  commission_adjustments: string
  commission_outstanding: string
  commission_pending: string
  commission_credits_owed: string
  refunds_recorded: string
  sellers: {
    seller_id: number
    store_name: string
    orders_delivered: number
    gmv_delivered: string
    commission_earned: string
    seller_earnings: string
    commission_outstanding: string
  }[]
}

export type ReviewStatus = 'published' | 'hidden'

export type Review = {
  id: number
  rating: number
  comment: string | null
  author?: string
  author_email?: string
  variant_name?: string
  product?: { id: number; name: string; slug: string }
  store?: { id: number; name: string }
  status?: ReviewStatus
  hidden_reason?: string | null
  seller_reply: string | null
  seller_replied_at: string | null
  created_at: string
}

export type AppNotification = {
  id: string
  kind: string | null
  title: string
  body: string | null
  url: string | null
  read: boolean
  created_at: string
}

export type TicketStatus = 'open' | 'waiting_on_user' | 'resolved' | 'closed'

export type TicketCategory = 'order_problem' | 'dispute' | 'delivery' | 'payment' | 'account' | 'selling' | 'other'

export type TicketCategoryOption = { value: TicketCategory; label: string; needs_order: boolean; can_link_order: boolean }

export type TicketMessage = { id: number; role: 'customer' | 'seller' | 'staff'; author: string; body: string; at: string }

export type Ticket = {
  number: string
  category: { value: TicketCategory; label: string }
  subject: string
  status: TicketStatus
  resolution: string | null
  resolved_at: string | null
  created_at: string
  last_activity_at: string
  seller_order?: { id: number; number: string; status: SellerOrderStatus; total: string; order_number: string | null } | null
  store?: { name: string } | null
  customer?: { name: string; email?: string }
  messages?: TicketMessage[]
}
