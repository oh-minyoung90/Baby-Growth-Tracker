import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // database.types.ts는 `npm run db:types`로 자동 생성되는 파일이라 검사하지 않는다
  globalIgnores(['dist', 'coverage', 'src/lib/database.types.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      // 아이 정보가 브라우저 콘솔에 남지 않도록 console.log 사용을 막는다 (기술요구사항서 10.2)
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // Prettier와 겹치는 서식 규칙은 끈다. 반드시 마지막에 둔다.
  prettier,
])
