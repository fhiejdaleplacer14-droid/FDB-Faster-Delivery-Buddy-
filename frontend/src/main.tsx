import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/router/routes'
import { ThemeProvider } from '@/app/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { CartProvider } from '@/features/orders/CartContext'
import './styles.css'

const router = createBrowserRouter(routes)
const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root element')
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

// Installable app and offline page. Only in the published build, so development always runs fresh code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
