import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner'
import { applyTheme } from '@/lib/theme'
import App from './App.tsx'
import './index.css'

// 첫 화면을 그리기 전에 저장된 화면 모드를 적용한다 (FR-SET-10)
applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
)
