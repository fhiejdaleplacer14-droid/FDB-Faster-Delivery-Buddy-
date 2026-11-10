import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/router/routes'
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
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
)
