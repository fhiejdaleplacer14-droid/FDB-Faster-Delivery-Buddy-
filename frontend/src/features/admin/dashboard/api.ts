import { http } from '@/lib/http'
import type { Resource } from '@/types/api'

export type Kpi = { value: string; previous: string; change_pct: string | null }

export type Dashboard = {
  period: { days: number; from: string; to: string }
  kpis: {
    gmv_delivered: Kpi
    commission_earned: Kpi
    orders: Kpi
    average_order: Kpi
    new_customers: Kpi
    refunds: Kpi
  }
  daily: { date: string; gmv: string; orders: number }[]
  order_status: { key: string; label: string; count: number }[]
  top_stores: { name: string; gmv: string; orders: number }[]
  categories: { name: string; gmv: string }[]
  attention: {
    seller_applications: number
    listings_to_review: number
    open_support: number
    commission_due: string
    credits_owed: string
  }
  recent_orders: { number: string; customer: string | null; total: string; status: 'in_progress' | 'completed' | 'cancelled'; placed_at: string }[]
}

export const dashboardApi = {
  async get(days: number) {
    return (await http.get<Resource<Dashboard>>('/admin/dashboard', { params: { days } })).data.data
  },
}
