import { Baby } from 'lucide-react'

export function ChildAvatar({ photo }: { photo?: string | null }) {
  return (
    <span className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-soft text-soft-text">
      {photo ? (
        <img
          src={photo}
          alt="아이 프로필 사진"
          width={64}
          height={64}
          className="size-full object-cover"
        />
      ) : (
        <Baby aria-hidden className="size-[34px]" />
      )}
    </span>
  )
}
