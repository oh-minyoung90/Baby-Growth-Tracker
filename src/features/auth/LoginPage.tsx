import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Sprout } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { FieldError } from '@/components/form/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMmSs, useCountdown } from '@/lib/useCountdown'
import { usePageTitle } from '@/lib/usePageTitle'
import { sendLoginCode, verifyLoginCode, type SendCodeResult } from './authApi'

/**
 * 로그인 화면 (SCR-01, FR-AUTH-01~04)
 * 이메일 입력 → 6자리 코드 받기 → 코드 입력. 회원가입 화면은 없다.
 * 로그인에 성공하면 AuthProvider가 로그인 상태로 바뀌고, 라우터가 홈(또는 원래 가려던 화면)으로 보낸다.
 */

const CODE_VALID_SECONDS = 600 // 10분 (기술요구사항서 7.1)
const RESEND_WAIT_SECONDS = 60 // 같은 이메일 재요청 간격 (Supabase 기본값)

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, '이메일을 입력해 주세요')
    .pipe(z.email('이메일 형식이 맞지 않아요')),
})

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, '6자리 숫자를 입력해 주세요'),
})

const SEND_ERROR: Record<Exclude<SendCodeResult, { ok: true }>['reason'], string> = {
  rateLimited: '요청이 많아요. 잠시 후 다시 시도해 주세요',
  network: '인터넷 연결을 확인해 주세요',
  unknown: '코드를 보내지 못했어요. 잠시 후 다시 시도해 주세요',
}

export function LoginPage() {
  usePageTitle('로그인')
  const [email, setEmail] = useState<string | null>(null)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-100 flex-col px-6 pb-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 py-10 text-center">
        <span className="flex size-18 items-center justify-center rounded-[24px] bg-primary text-primary-foreground">
          <Sprout className="size-9" aria-hidden />
        </span>
        <h1 className="text-[26px] font-bold tracking-tight">Baby Growth Tracker</h1>
        <p className="text-[15px] text-muted-foreground">우리 아이의 성장과 처음을 한곳에</p>
      </div>

      {email === null ? (
        <EmailStep onSent={setEmail} />
      ) : (
        <CodeStep email={email} onChangeEmail={() => setEmail(null)} />
      )}
    </main>
  )
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof emailSchema>, unknown, z.output<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setServerError(null)
    const result = await sendLoginCode(email)
    if (result.ok) onSent(email)
    else setServerError(SEND_ERROR[result.reason])
  })

  const error = errors.email?.message ?? serverError

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-email">이메일</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-email-error' : undefined}
          {...register('email')}
        />
        {error && <FieldError id="login-email-error">{error}</FieldError>}
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? '보내는 중…' : '인증 코드 받기'}
      </Button>
      <p className="text-center text-[13px] text-muted-foreground">
        등록된 계정만 로그인할 수 있어요
      </p>
    </form>
  )
}

function CodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + CODE_VALID_SECONDS * 1000)
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_WAIT_SECONDS * 1000)
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState(
    '입력한 이메일로 인증 코드를 보냈어요. 메일함을 확인해 주세요',
  )
  const [resending, setResending] = useState(false)
  const remaining = useCountdown(expiresAt)
  const resendRemaining = useCountdown(resendAt)
  const expired = remaining === 0

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })

  const onSubmit = handleSubmit(async ({ code }) => {
    setServerError(null)
    const result = await verifyLoginCode(email, code)
    if (!result.ok) {
      setServerError(
        result.reason === 'network'
          ? '인터넷 연결을 확인해 주세요'
          : '코드가 맞지 않거나 만료되었어요',
      )
    }
    // 성공하면 로그인 상태가 바뀌어 화면이 자동으로 넘어간다
  })

  const resend = async () => {
    setResending(true)
    setServerError(null)
    const result = await sendLoginCode(email)
    setResending(false)
    if (!result.ok) {
      setServerError(SEND_ERROR[result.reason])
      return
    }
    reset({ code: '' })
    setExpiresAt(Date.now() + CODE_VALID_SECONDS * 1000)
    setResendAt(Date.now() + RESEND_WAIT_SECONDS * 1000)
    setNotice('새 인증 코드를 보냈어요. 이전 코드는 쓸 수 없어요')
  }

  const error = expired
    ? '코드가 만료되었어요. 코드를 다시 받아 주세요'
    : (errors.code?.message ?? serverError)

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      <div
        role="status"
        className="flex items-start gap-2.5 rounded-button bg-soft px-3.5 py-3 text-sm text-soft-text"
      >
        <Mail className="mt-0.5 size-4.5 shrink-0" aria-hidden />
        <span>{notice}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="login-code">인증 코드 6자리</Label>
          <span
            className="text-sm font-bold text-primary tabular-nums"
            aria-label={`남은 시간 ${Math.floor(remaining / 60)}분 ${remaining % 60}초`}
          >
            {formatMmSs(remaining)}
          </span>
        </div>
        <Controller
          name="code"
          control={control}
          render={({ field }) => (
            <Input
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-code-error' : undefined}
              className="h-14 text-center text-2xl font-bold tracking-[10px]"
              {...field}
              // 숫자만 남기고 6자리까지만 받는다
              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          )}
        />
        {error && <FieldError id="login-code-error">{error}</FieldError>}
      </div>

      <Button type="submit" size="lg" disabled={isSubmitting || expired}>
        {isSubmitting ? '확인하는 중…' : '로그인'}
      </Button>

      <div className="flex justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onChangeEmail}>
          이메일 다시 입력
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="font-bold text-soft-text"
          disabled={resendRemaining > 0 || resending}
          onClick={resend}
        >
          {resendRemaining > 0 ? `코드 다시 받기 (${resendRemaining}초)` : '코드 다시 받기'}
        </Button>
      </div>
    </form>
  )
}
