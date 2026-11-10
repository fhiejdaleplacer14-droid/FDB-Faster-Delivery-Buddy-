import { http } from '@/lib/http'
import type { AppNotification, Paginated } from '@/types/api'

export type NotificationPage = Omit<Paginated<AppNotification>, 'meta'> & { meta: Paginated<AppNotification>['meta'] & { unread: number } }

export const notificationApi = {
  async list(page = 1, perPage = 20) {
    return (await http.get<NotificationPage>('/notifications', { params: { page, per_page: perPage } })).data
  },
  async read(id: string) {
    await http.post(`/notifications/${encodeURIComponent(id)}/read`)
  },
  async readAll() {
    await http.post('/notifications/read-all')
  },
}
