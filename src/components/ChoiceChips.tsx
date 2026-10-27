/**
 * 하나만 고르는 칩 (기간 선택, 정렬 등).
 * 선택 상태는 연보라 배경 + 보라 2px 테두리 + 진보라 글자 (docs/디자인.md 2.4), 모서리는 완전 둥근 모양 (4장).
 * 칩은 36px로 보이지만 누를 수 있는 영역은 위아래로 넓혀 44px를 맞춘다.
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** 화면 낭독기가 읽는 묶음 이름 */
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className="relative h-9 rounded-full border border-line bg-surface px-4 text-sm font-medium text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-1 aria-checked:border-2 aria-checked:border-primary aria-checked:bg-soft aria-checked:px-[15px] aria-checked:font-bold aria-checked:text-soft-text"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
