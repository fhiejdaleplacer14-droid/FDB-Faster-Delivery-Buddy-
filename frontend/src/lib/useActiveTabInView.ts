import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// Keeps the current tab visible in a row that scrolls sideways on phones.
export function useActiveTabInView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[aria-current="page"]')
    active?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [pathname])
  return ref
}
