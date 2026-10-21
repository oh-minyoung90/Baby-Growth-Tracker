import { CircleAlert, MessageCircle, Plus, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { setThemeMode, useThemeMode, type ThemeMode } from '@/lib/theme'

// T-05 확인용 임시 화면: 디자인 기준(docs/디자인.md)이 코드에 맞게 적용됐는지 본다.
// T-09에서 실제 앱 화면(라우터, 하단 탭)으로 바뀐다.

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: '기기 설정' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border bg-card p-5">
      <h2 className="text-sm font-bold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function App() {
  const mode = useThemeMode()

  return (
    <main className="mx-auto flex max-w-240 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Baby Growth Tracker</h1>
        <p className="text-sm text-muted-foreground">
          UI 기반 확인 화면 (T-05). 디자인 기준이 코드에 적용됐는지 확인합니다.
        </p>
      </header>

      <Section title="화면 모드 (FR-SET-10)">
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

        <Section title="입력칸">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <Label htmlFor="demo-title">내용</Label>
              <span className="text-[13px] text-muted-foreground">5 / 30</span>
            </div>
            <Input id="demo-title" defaultValue="잡고 서기" maxLength={30} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="demo-height">키</Label>
            <Input
              id="demo-height"
              inputMode="decimal"
              defaultValue="172"
              aria-invalid
              aria-describedby="demo-height-error"
            />
            <p id="demo-height-error" className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert className="size-4" aria-hidden />
              키는 30~150cm 사이로 입력해 주세요
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="demo-memo">메모</Label>
            <Textarea id="demo-memo" placeholder="어떤 상황이었나요?" />
          </div>
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

        <Section title="알림 · 확인 창">
          <Button variant="outline" onClick={() => toast.success('저장했어요')}>
            저장 알림 보기
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">삭제 확인 창 보기</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>이 기록을 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>삭제하면 되돌릴 수 없어요</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction variant="destructive">삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-button bg-danger-soft px-3.5 py-3 text-sm text-danger-text"
          >
            <span className="flex-1">저장하지 못했어요. 인터넷 연결을 확인해 주세요</span>
            <Button variant="destructive" size="sm">
              다시 시도
            </Button>
          </div>
        </Section>
      </div>
    </main>
  )
}

export default App
