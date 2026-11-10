import type { RouteObject } from 'react-router'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { AccountPage } from '@/features/account/AccountPage'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { SellerApplicationDetailPage } from '@/features/admin/SellerApplicationDetailPage'
import { SellerApplicationsPage } from '@/features/admin/SellerApplicationsPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { RedirectIfSignedIn, RequireAuth, RequirePermission } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage'
import { HomePage } from '@/features/marketplace/HomePage'
import { NotFoundPage } from '@/features/marketplace/NotFoundPage'
import { SellPage } from '@/features/sellers/SellPage'

export const routes: RouteObject[] = [
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
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
            path: 'admin',
            element: <RequirePermission permission="sellers.review" />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  { path: 'sellers', element: <SellerApplicationsPage /> },
                  { path: 'sellers/:id', element: <SellerApplicationDetailPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
