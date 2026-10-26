import { zodResolver } from '@hookform/resolvers/zod'
import { MessageCircle, Milestone, Plus, TriangleAlert } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateField } from '@/components/form/DateField'
import { TextField } from '@/components/form/TextField'
import { ListLoading } from '@/components/ListLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { todayString } from '@/domain/date'
import { ThemeModeSelector } from '@/features/settings/ThemeModeSelector'
import { notifySaved } from '@/lib/notify'
import { optionalText, recordDate, requiredText } from '@/lib/validation'

// 공통 컴포넌트 확인 화면 (개발 서버 전용, /dev/ui). 운영 빌드에는 포함되지 않는다.
// 디자인 기준(docs/디자인.md)이 컴포넌트에 맞게 적용됐는지 볼 때 쓴다.

// 입력칸 확인용 예시 폼. 생년월일은 가명 데이터
const DEMO_BIRTH = '2026-01-08'
const demoSchema = z.object({
  date: recordDate({ birthDate: DEMO_BIRTH }),
  title: requiredText(30, '내용을 입력해 주세요'),
  memo: optionalText(500),
})

function DemoForm() {
  const { control, handleSubmit } = useForm<
    z.input<typeof demoSchema>,
    unknown,
    z.output<typeof demoSchema>
  >({
    resolver: zodResolver(demoSchema),
    defaultValues: { date: todayString(), title: '잡고 서기', memo: '' },
  })
  return (
    <form onSubmit={handleSubmit(() => notifySaved())} noValidate className="flex flex-col gap-4">
      <DateField control={control} name="date" label="날짜" min={DEMO_BIRTH} max={todayString()} />
      <TextField control={control} name="title" label="내용" maxLength={30} />
      <TextField
        control={control}
        name="memo"
        label="메모"
        maxLength={500}
        multiline
        placeholder="어떤 상황이었나요?"
      />
      <Button type="submit">저장 (검증 확인)</Button>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border bg-card p-5">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default function UiPreview() {
  return (
    <main className="mx-auto flex max-w-240 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Baby Growth Tracker</h1>
        <p className="text-sm text-muted-foreground">공통 컴포넌트 확인 화면 (개발 서버 전용)</p>
      </header>

      <Section title="화면 모드 (FR-SET-10)">
        <ThemeModeSelector />
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="버튼">
          <Button>저장</Button>
          <Button variant="soft">취소</Button>
          <Button variant="outline">필터 초기화</Button>
          <Button variant="destructive">삭제</Button>
          <Button disabled>저장 (비활성)</Button>
          <div className="flex items-center gap-3">
            <Button size="fab" aria-label="기록 추가">
              <Plus />
            </Button>
            <span className="text-sm text-muted-foreground">목록 화면의 기록 추가 버튼</span>
          </div>
        </Section>

        <Section title="입력칸 (날짜 · 글자 수 제한)">
          <DemoForm />
          <div className="flex min-h-11 items-center gap-2.5">
            <Checkbox id="demo-eaten" defaultChecked />
            <Label htmlFor="demo-eaten" className="text-[15px] font-medium">
              먹음
            </Label>
          </div>
        </Section>

        <Section title="배지 (유형 색은 구분 용도)">
          <div className="flex flex-wrap gap-2">
            <Badge variant="word">
              <MessageCircle aria-hidden />
              단어
            </Badge>
            <Badge variant="behavior">행동</Badge>
            <Badge variant="expression">표정</Badge>
            <Badge variant="play">놀이</Badge>
            <Badge variant="food">처음 먹은 음식</Badge>
            <Badge variant="measure">키·몸무게</Badge>
            <Badge variant="tried">먹어봄</Badge>
            <Badge variant="caution">
              <TriangleAlert aria-hidden />
              주의
            </Badge>
            <Badge variant="plan">계획</Badge>
          </div>
        </Section>

        <Section title="알림 · 확인 창 · 오류">
          <Button variant="outline" onClick={notifySaved}>
            저장 알림 보기
          </Button>
          <DeleteRecordButton onConfirm={notifySaved} />
          <ErrorBanner onRetry={() => undefined} />
        </Section>

        <Section title="빈 상태 · 로딩">
          <EmptyState
            icon={Milestone}
            title="아직 기록이 없어요"
            description="처음 한 말이나 행동을 남겨 보세요"
            onAction={() => undefined}
          />
          <ListLoading rows={2} />
        </Section>
      </div>
    </main>
  )
}
