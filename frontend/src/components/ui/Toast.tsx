import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

type Toast = { id: number; tone: 'success' | 'error'; text: string; action?: { label: string; to: string } | undefined }
type ToastApi = { show: (toast: Omit<Toast, 'id'>) => void }

const ToastContext = createContext<ToastApi>({ show: () => undefined })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-lg bg-navy px-4 py-3 text-sm text-white shadow-lg shadow-navy/20"
          >
            {t.tone === 'success' ? <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-hidden /> : <CircleAlert className="size-5 shrink-0 text-red-300" aria-hidden />}
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <Link to={t.action.to} onClick={() => dismiss(t.id)} className="font-semibold text-blue-200 hover:text-white">
                {t.action.label}
              </Link>
            )}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded p-0.5 text-white/60 hover:text-white">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
