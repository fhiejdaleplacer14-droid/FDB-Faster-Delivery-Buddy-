import type { RouteObject } from 'react-router'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { AccountPage } from '@/features/account/AccountPage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { CategoriesPage } from '@/features/admin/CategoriesPage'
import { ProductModerationPage } from '@/features/admin/ProductModerationPage'
import { ProductReviewPage } from '@/features/admin/ProductReviewPage'
import { SellerApplicationDetailPage } from '@/features/admin/SellerApplicationDetailPage'
import { SellerApplicationsPage } from '@/features/admin/SellerApplicationsPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { RedirectIfSignedIn, RequireAuth, RequirePermission, RequireSellerAccount } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { ProductPage } from '@/features/catalog/ProductPage'
import { ProductsPage } from '@/features/catalog/ProductsPage'
import { StorePage } from '@/features/catalog/StorePage'
import { HomePage } from '@/features/marketplace/HomePage'
import { NotFoundPage } from '@/features/marketplace/NotFoundPage'
import { ProductEditorPage } from '@/features/seller-portal/ProductEditorPage'
import { SellerProductsPage } from '@/features/seller-portal/SellerProductsPage'
import { SellPage } from '@/features/sellers/SellPage'

export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:slug', element: <ProductPage /> },
      { path: 'stores/:slug', element: <StorePage /> },
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
          { path: 'account', element: <AccountPage /> },
          { path: 'sell', element: <SellPage /> },
          {
            path: 'seller',
            element: <RequireSellerAccount />,
            children: [
              { path: 'products', element: <SellerProductsPage /> },
              { path: 'products/new', element: <ProductEditorPage /> },
              { path: 'products/:id', element: <ProductEditorPage /> },
            ],
          },
          {
            path: 'admin',
            element: <AdminLayout />,
            children: [
              {
                element: <RequirePermission permission="sellers.review" />,
                children: [
                  { path: 'sellers', element: <SellerApplicationsPage /> },
                  { path: 'sellers/:id', element: <SellerApplicationDetailPage /> },
                ],
              },
              {
                element: <RequirePermission permission="products.moderate" />,
                children: [
                  { path: 'products', element: <ProductModerationPage /> },
                  { path: 'products/:id', element: <ProductReviewPage /> },
                ],
              },
              {
                element: <RequirePermission permission="categories.manage" />,
                children: [{ path: 'categories', element: <CategoriesPage /> }],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
