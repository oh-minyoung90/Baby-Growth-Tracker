import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { applyTheme } from '@/lib/theme'
import { reportUnexpectedError, safeRootErrors } from '@/lib/reportUnexpectedError'
import { queryClient } from './app/queryClient'
import { routes } from './app/routes'
import './index.css'

// 첫 화면을 그리기 전에 저장된 화면 모드를 적용한다 (FR-SET-10)
applyTheme()

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!, safeRootErrors).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} onError={reportUnexpectedError} />
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
