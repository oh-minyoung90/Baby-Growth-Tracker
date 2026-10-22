import { setThemeMode, useThemeMode, type ThemeMode } from '@/lib/theme'

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: '기기 설정' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

/** 화면 모드 선택 (FR-SET-10) */
export function ThemeModeSelector() {
  const mode = useThemeMode()
  return (
    <div
      role="radiogroup"
      aria-label="화면 모드"
      className="grid grid-cols-3 rounded-button bg-soft p-1"
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={mode === m.value}
          onClick={() => setThemeMode(m.value)}
          className="h-10 rounded-md text-sm font-medium text-soft-text aria-checked:bg-surface aria-checked:font-bold aria-checked:text-primary"
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
