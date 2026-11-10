const DISPLAY_TIMEZONE = 'Asia/Manila'

const dateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: DISPLAY_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
})

const date = new Intl.DateTimeFormat('en-PH', { timeZone: DISPLAY_TIMEZONE, dateStyle: 'medium' })

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—'
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? date.format(new Date(iso)) : '—'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
