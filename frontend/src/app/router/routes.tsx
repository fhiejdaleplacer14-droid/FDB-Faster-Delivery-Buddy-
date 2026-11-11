import type { ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { RouteError } from '@/components/layout/RouteError'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { AdminHome, AdminLayout } from '@/features/admin/AdminLayout'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { RedirectIfSignedIn, RequireAuth, RequirePermission, RequireSellerAccount, ShopperOnly } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { ProductPage } from '@/features/catalog/ProductPage'
import { ProductsPage } from '@/features/catalog/ProductsPage'
import { StorePage } from '@/features/catalog/StorePage'
import { HomePage } from '@/features/marketplace/HomePage'
import { NotFoundPage } from '@/features/marketplace/NotFoundPage'
import { CartPage } from '@/features/orders/CartPage'
import { CheckoutPage } from '@/features/orders/CheckoutPage'
import { OrderDetailPage } from '@/features/orders/OrderDetailPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { SellerLayout } from '@/features/seller-portal/SellerLayout'

// Screens most shoppers never open load on demand.
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  return async () => ({ Component: (await load())[name] as ComponentType })
}

export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    errorElement: <RouteError />,
    children: [
      {
        element: <ShopperOnly />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'stores/:slug', element: <StorePage /> },
        ],
      },
      // Admins may open a single listing (for example from a review they are moderating).
      { path: 'products/:slug', element: <ProductPage /> },
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
      { path: 'verify-email/:id/:hash', element: <VerifyEmailPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'account', lazy: page(() => import('@/features/account/AccountPage'), 'AccountPage') },
          { path: 'notifications', lazy: page(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage') },
          {
            element: <ShopperOnly />,
            children: [
              { path: 'cart', element: <CartPage /> },
              { path: 'checkout', element: <CheckoutPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'orders/:number', element: <OrderDetailPage /> },
              { path: 'sell', lazy: page(() => import('@/features/sellers/SellPage'), 'SellPage') },
              { path: 'support', lazy: page(() => import('@/features/support/SupportPage'), 'SupportPage') },
              { path: 'support/new', lazy: page(() => import('@/features/support/NewTicketPage'), 'NewTicketPage') },
              { path: 'support/:number', lazy: page(() => import('@/features/support/TicketPage'), 'TicketPage') },
              {
                path: 'seller',
                element: <RequireSellerAccount />,
                children: [
                  {
                    element: <SellerLayout />,
                    children: [
                      { index: true, element: <Navigate to="orders" replace /> },
                      { path: 'orders', lazy: page(() => import('@/features/seller-portal/SellerOrdersPage'), 'SellerOrdersPage') },
                      { path: 'orders/:id', lazy: page(() => import('@/features/seller-portal/SellerOrderPage'), 'SellerOrderPage') },
                      { path: 'products', lazy: page(() => import('@/features/seller-portal/SellerProductsPage'), 'SellerProductsPage') },
                      { path: 'products/new', lazy: page(() => import('@/features/seller-portal/ProductEditorPage'), 'ProductEditorPage') },
                      { path: 'products/:id', lazy: page(() => import('@/features/seller-portal/ProductEditorPage'), 'ProductEditorPage') },
                      { path: 'commissions', lazy: page(() => import('@/features/seller-portal/SellerCommissionsPage'), 'SellerCommissionsPage') },
                      { path: 'reviews', lazy: page(() => import('@/features/seller-portal/SellerReviewsPage'), 'SellerReviewsPage') },
                      { path: 'support', lazy: page(() => import('@/features/seller-portal/SellerSupportPage'), 'SellerSupportPage') },
                      { path: 'support/:number', lazy: page(() => import('@/features/support/TicketPage'), 'SellerTicketPage') },
                    ],
                  },
                ],
              },
            ],
          },
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminHome /> },
              {
                element: <RequirePermission permission="sellers.review" />,
                children: [
                  { path: 'sellers', lazy: page(() => import('@/features/admin/SellerApplicationsPage'), 'SellerApplicationsPage') },
                  { path: 'sellers/:id', lazy: page(() => import('@/features/admin/SellerApplicationDetailPage'), 'SellerApplicationDetailPage') },
                ],
              },
              {
                element: <RequirePermission permission="orders.view" />,
                children: [
                  { path: 'orders', lazy: page(() => import('@/features/admin/OrdersPage'), 'AdminOrdersPage') },
                  { path: 'orders/:number', lazy: page(() => import('@/features/admin/OrderDetailPage'), 'AdminOrderDetailPage') },
                ],
              },
              {
                element: <RequirePermission permission="products.moderate" />,
                children: [
                  { path: 'products', lazy: page(() => import('@/features/admin/ProductModerationPage'), 'ProductModerationPage') },
                  { path: 'products/:id', lazy: page(() => import('@/features/admin/ProductReviewPage'), 'ProductReviewPage') },
                ],
              },
              {
                element: <RequirePermission permission="commissions.manage" />,
                children: [{ path: 'commissions', lazy: page(() => import('@/features/admin/CommissionsPage'), 'CommissionsPage') }],
              },
              {
                element: <RequirePermission permission="reports.view" />,
                children: [{ path: 'reports', lazy: page(() => import('@/features/admin/FinancialReportPage'), 'FinancialReportPage') }],
              },
              {
                element: <RequirePermission permission="support.manage" />,
                children: [
                  { path: 'support', lazy: page(() => import('@/features/admin/SupportQueuePage'), 'SupportQueuePage') },
                  { path: 'support/:number', lazy: page(() => import('@/features/admin/SupportTicketPage'), 'SupportTicketPage') },
                ],
              },
              {
                element: <RequirePermission permission="refunds.manage" />,
                children: [{ path: 'refunds', lazy: page(() => import('@/features/admin/RefundsPage'), 'RefundsPage') }],
              },
              {
                element: <RequirePermission permission="reviews.moderate" />,
                children: [{ path: 'reviews', lazy: page(() => import('@/features/admin/ReviewsPage'), 'ReviewsPage') }],
              },
              {
                element: <RequirePermission permission="categories.manage" />,
                children: [{ path: 'categories', lazy: page(() => import('@/features/admin/CategoriesPage'), 'CategoriesPage') }],
              },
              {
                element: <RequirePermission permission="sellers.manage" />,
                children: [{ path: 'settings', lazy: page(() => import('@/features/admin/SettingsPage'), 'SettingsPage') }],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
