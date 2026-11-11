import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTheme, type ThemeChoice } from '@/lib/theme'

const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match device', icon: Monitor },
]

export function ThemeMenu() {
  const { choice, theme, setChoice } = useTheme()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(value: ThemeChoice) {
    setOpen(false)
    setChoice(value)
    button.current?.focus()
  }

  const Current = theme === 'dark' ? Moon : Sun

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Theme: ${theme === 'dark' ? 'dark' : 'light'}. Change theme`}
        title="Change theme"
        className="rounded-md p-2 text-ink transition-colors hover:bg-ink/5"
      >
        <Current key={theme} className="size-5 animate-scale-in" aria-hidden />
      </button>

      {open && (
        <div role="menu" aria-label="Theme" className="absolute right-0 z-50 mt-2 w-48 origin-top-right animate-scale-in rounded-xl bg-surface p-1 shadow-xl ring-1 shadow-navy/10 ring-line">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={choice === value}
              onClick={() => pick(value)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-paper ${choice === value ? 'font-semibold text-heading' : 'text-ink'}`}
            >
              <Icon className="size-4 text-slate" aria-hidden />
              <span className="flex-1">{label}</span>
              {choice === value && <Check className="size-4 text-link" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
