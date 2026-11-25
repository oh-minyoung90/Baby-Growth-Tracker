import { Baby } from 'lucide-react'

export function ChildAvatar({
  photo,
  compact = false,
}: {
  photo?: string | null
  compact?: boolean
}) {
  return (
    <span
      className={`${compact ? 'size-11' : 'size-16'} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-soft text-soft-text`}
    >
      {photo ? (
        <img
          src={photo}
          alt="아이 프로필 사진"
          width={64}
          height={64}
          className="size-full object-cover"
        />
      ) : (
        <Baby aria-hidden className={compact ? 'size-6' : 'size-[34px]'} />
      )}
    </span>
  )
}
