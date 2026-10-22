/// <reference types="vite/client" />

// .env.local의 브라우저 공개용 환경변수 (.env.example 참고)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
