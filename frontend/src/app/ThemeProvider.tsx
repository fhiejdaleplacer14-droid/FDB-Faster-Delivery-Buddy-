import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { applyTheme, readChoice, saveChoice, subscribeSystemTheme, systemPrefersDark, ThemeContext, type ThemeChoice } from '@/lib/theme'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice)
  const systemDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => false)
  const theme = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice

  useLayoutEffect(() => applyTheme(theme), [theme])

  const setChoice = useCallback((next: ThemeChoice) => {
    saveChoice(next)
    const swap = () => flushSync(() => setChoiceState(next))
    // A soft cross-fade where the browser supports it; an instant swap otherwise.
    if (typeof document.startViewTransition === 'function' && !reducedMotion()) document.startViewTransition(swap)
    else swap()
  }, [])

  const value = useMemo(() => ({ choice, theme, setChoice }), [choice, theme, setChoice])
  return <ThemeContext value={value}>{children}</ThemeContext>
}
