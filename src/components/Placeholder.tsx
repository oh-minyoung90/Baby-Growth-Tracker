import { Construction } from 'lucide-react'

/** 아직 만들지 않은 화면 자리 표시 (해당 태스크에서 실제 화면으로 바꾼다) */
export function Placeholder({ task, description }: { task: string; description: string }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-dashed bg-card px-5 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-[20px] bg-soft text-soft-text">
        <Construction className="size-7" aria-hidden />
      </span>
      <strong className="text-[17px]">{description}</strong>
      <span className="text-sm text-muted-foreground">{task}에서 만들 화면이에요</span>
    </section>
  )
}
