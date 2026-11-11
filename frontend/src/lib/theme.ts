import { createContext, useContext } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

// Same key as public/theme-init.js, which sets the theme before the first paint.
export const THEME_KEY = 'fdb-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function saveChoice(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, choice)
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

function darkQuery() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
}

export function subscribeSystemTheme(onChange: () => void) {
  const query = darkQuery()
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

export const systemPrefersDark = () => darkQuery()?.matches ?? false

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

type ThemeState = { choice: ThemeChoice; theme: Theme; setChoice: (choice: ThemeChoice) => void }

export const ThemeContext = createContext<ThemeState>({ choice: 'light', theme: 'light', setChoice: () => undefined })

export const useTheme = () => useContext(ThemeContext)
