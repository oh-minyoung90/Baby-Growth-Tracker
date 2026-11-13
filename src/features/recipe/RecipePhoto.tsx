import { useState } from 'react'
import { ImageOff, CookingPot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRecipePhoto } from '@/lib/useRecipePhoto'

/** 비공개 사진은 만료 전 갱신되는 서명 URL로만 표시한다. */
export function RecipePhoto({
  id,
  name,
  retryable = true,
}: {
  id: string | null
  name: string
  retryable?: boolean
}) {
  const photo = useRecipePhoto(id)
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const failed = photo.isError || (photo.data && brokenUrl === photo.data.url)
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-input bg-muted">
      {!id ? (
        <CookingPot className="size-12 text-muted-foreground" aria-label="사진 없음" />
      ) : photo.isPending ? (
        <span role="status" className="text-sm text-muted-foreground">
          사진 불러오는 중…
        </span>
      ) : failed ? (
        <div className="flex flex-col items-center gap-2 p-3 text-sm text-muted-foreground">
          <ImageOff aria-hidden />
          사진 없음
          {retryable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setBrokenUrl(null)
                void photo.refetch()
              }}
              disabled={photo.isFetching}
            >
              사진 다시 불러오기
            </Button>
          )}
        </div>
      ) : (
        <img
          src={photo.data?.url}
          alt={`${name} 사진`}
          className="size-full object-cover"
          onError={() => setBrokenUrl(photo.data?.url ?? null)}
        />
      )}
    </div>
  )
}
