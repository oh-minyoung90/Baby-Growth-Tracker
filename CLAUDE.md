# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 안내 문서입니다.

## 프로젝트 현황

Baby Growth Tracker는 아이의 성장(키·몸무게, 발달, 수면)과 식사(음식 목록, 주간 식단, 레시피)를 기록하는 개인용 웹 앱입니다. 설계는 확정되었고, 구현을 `docs/task.md` 순서대로 진행하고 있습니다.

진행 순서: PRD → 기능요구사항서 → 기술요구사항서 → 태스크 분해 → 구현(MVP-1: 성장 기록 → 식사 기록) → 테스트

## 문서

- `PRD.md`(v1.7, 확정)는 범위, 기능(F-01~F-24), 데이터 모델, 결정 사항의 기준 문서입니다. 동작을 제안하기 전에 9장 "결정 사항"을 확인하고, 이미 결정된 항목은 사용자와 협의 없이 다시 바꾸지 않습니다.
- 설계 문서는 `docs/` 아래에 둡니다. `docs/기능요구사항서.md`(v1.17)는 화면별 요구사항(FR)과 비즈니스 규칙(BR)의 기준이며, `docs/기술요구사항서.md`(v1.27)는 시스템 구성, DB 스키마, RLS, 인증, 테스트, 배포 방식의 기준입니다. 구현 중 설계가 바뀌면 해당 문서를 함께 고칩니다. `docs/디자인.md`(v1.4)는 색·글자·간격·레이아웃·컴포넌트의 기준이며, 화면을 만들 때 디자인 시안보다 우선합니다. `docs/task.md`(v1.15)는 MVP-1(성장 기록 + 식사 기록) 태스크 목록이며, 태스크마다 GitHub Issue가 연결되어 있습니다. 설계 문서와 `PRD.md`가 서로 다르면 임의로 하나를 고르지 말고 사용자에게 알립니다.
- 확실하지 않은 내용은 가정하지 말고 "확인 필요"로 표시합니다.

## 기술 스택

- 백엔드: Supabase Free 플랜 (PostgreSQL, Auth, Storage). 접근 제어는 `ownerId` 기준 RLS(행 단위 보안 정책)로 적용합니다.
- 프론트엔드: React + Vite + TypeScript, Tailwind CSS + shadcn/ui, TanStack Query, React Hook Form + Zod, Recharts
- 호스팅: Cloudflare Pages. Supabase는 dev·prod 클라우드 프로젝트 2개 (로컬 Docker 미사용)
- 상세는 `docs/기술요구사항서.md` 3장을 따릅니다.

## 명령어

- `npm run dev`: 개발 서버
- `npm run build`: 타입 검사 + 운영용 빌드
- `npm run lint`: ESLint (`console.log` 사용 금지 규칙 포함)
- `npm run typecheck`: TypeScript 타입 검사
- `npm run format` / `npm run format:check`: Prettier 포맷 적용 / 검사
- `npm test`: 단위·컴포넌트 테스트 전체 실행 (Vitest)
- `npm test -- src/App.test.tsx`: 파일 하나만 실행 / `npm test -- -t "테스트 이름"`: 이름으로 하나만 실행
- `npm run test:watch`: 파일 변경 시 자동 재실행
- `npm run test:coverage`: 커버리지 측정 (`coverage/`, 커밋 제외)
- `npm run test:integration`: dev Supabase에 테스트 계정 A·B로 접속해 RLS·DB 제약을 검사 (`tests/integration/`). `.env.local`과 `.env.test.local`이 필요해 로컬에서만 실행하고 CI에서는 실행하지 않는다. 새 테이블을 추가하는 PR에는 이 테스트를 함께 추가한다
- `npm run db:new -- <이름>`: 새 마이그레이션 파일 생성 (`supabase/migrations/`)
- `npm run db:push`: 마이그레이션을 연결된 Supabase 프로젝트(dev)에 적용. DB 비밀번호를 묻는다
- `npm run db:types`: DB 구조에서 TypeScript 타입 생성 (`src/lib/database.types.ts`)
- DB 구조는 대시보드에서 직접 바꾸지 않고 마이그레이션 파일로만 바꾼다. `supabase config push`는 원격 인증 설정을 덮어쓰므로 사용하지 않는다. `supabase db diff` 등 Docker가 필요한 명령은 쓰지 않는다
- CI(`.github/workflows/ci.yml`)는 PR과 `main` push마다 lint → format:check → typecheck → test → build를 실행합니다. PR을 올리기 전에 같은 명령을 로컬에서 먼저 통과시킵니다.

## 아키텍처

별도 백엔드 서버 없이 브라우저(React SPA)가 Supabase에 직접 요청하고, 데이터 보호는 DB의 RLS가 맡습니다 (기술요구사항서 2장).

- `src/main.tsx`: 진입점. 화면 모드 적용 → `QueryClientProvider` → `AuthProvider` → `RouterProvider`
- `src/app/`: 앱 골격. `routes.tsx`(화면 주소와 로그인 가드), `AppLayout.tsx`(모바일 하단 탭 / PC 왼쪽 메뉴), `queryClient.ts`, `dev/`(개발 서버 전용 화면)
- `src/features/<기능>/`: 화면 단위 코드 (auth, child, home, growth, body, milestone, sleep, timeline, meal, food, recipe, settings). 다른 기능 폴더를 직접 가져다 쓰지 않고, 공통 로직은 `src/domain/`이나 `src/lib/`로 옮깁니다
- `src/domain/`: 화면과 무관한 계산 규칙(생후 일수, 같은 내용 판단, 수면 계산). 순수 함수와 단위 테스트
- `src/lib/`: Supabase 클라이언트(`supabase.ts`), DB 타입(`database.types.ts`, 자동 생성), 화면 모드(`theme.ts`), 여러 화면이 함께 쓰는 로그인 상태·로그아웃(`auth.ts`)과 아이 정보(`childApi.ts`, `useChild.ts`), 발달 기록(`milestoneApi.ts`, `useMilestones.ts`)과 키·몸무게(`bodyApi.ts`, `useBodyMeasures.ts`, `bodyFormat.ts`), 수면(`sleepApi.ts`, `useSleepLogs.ts`, 합계 계산 `sleepSummary.ts`), 음식(`foodApi.ts`, `useFoods.ts`, 상세·횟수·이력 `foodDetailApi.ts`·`useFoodDetails.ts`, 식품군·상태 이름 `foodTypes.ts`) 조회·저장, 식단(`mealApi.ts`, `useMeals.ts`, 끼니·섭취량 `mealTypes.ts`) 조회·저장·삭제, 사진 변환·비공개 저장(`prepareRecipePhoto.ts`, `recipePhotoApi.ts`, `useRecipePhoto.ts`), 발달 기록 유형·예시(`milestoneTypes.ts`), 입력 검증 규칙(`validation.ts`), DB 검증 실패 분류(`dbErrors.ts`), 저장 알림(`notify.ts`), 공통 안내 문구(`messages.ts`), 바텀 시트 열림 상태(`useSheetParam.ts`), 진입했던 화면으로 돌아가기(`useGoBack.ts`), 공통 유틸
- `src/components/`: 화면 틀(`Page`, `SubTabs`, `FullScreenLoading`, 입력 화면용 `FormPage`·`FormActions`), 공통 입력·안내(`form/`, `ConfirmDialog`, `NoticeDialog`, `DeleteRecordButton`, `ErrorBanner`, `EmptyState`, `ListLoading`, `AddRecordButton`, `ChoiceChips`), 기본 UI(`ui/`)
- `src/test/`: 테스트 공통 설정(`setup.ts`)과 앱 전체 화면 이동 테스트용 `renderApp()` (로그인 상태를 직접 넣고, `*Api.ts`는 `vi.mock`으로 바꿔 끼움)
- `supabase/migrations/`: DB 구조(테이블, 제약, 트리거, RLS). 화면 규칙과 같은 검증을 DB에도 둡니다
- 로그인 상태는 `useAuth()`(`src/lib/auth.ts`), 서버 데이터는 TanStack Query로 다룹니다. 로그아웃하면 Query 캐시를 비웁니다
- 로그인 후 아이 정보가 없으면 `RequireChild`가 등록 화면(`/setup`)으로 보냅니다. 등록 전에는 다른 화면으로 갈 수 없습니다

## UI 구성

- 디자인 값은 `src/index.css`의 CSS 변수와 Tailwind 테마로 관리합니다 (`docs/디자인.md`와 일치). 색을 코드에 직접 쓰지 말고 `bg-primary`, `bg-soft`, `text-danger`, `bg-type-word` 같은 토큰 클래스를 씁니다.
- 공통 컴포넌트는 `src/components/ui/`(shadcn/ui 기반, 디자인 기준으로 수정함)를 씁니다. 새 컴포넌트는 `npx shadcn@latest add <이름>`으로 받은 뒤 디자인 기준(높이 48px, 모서리 토큰, 16px 글자, `@/lib/utils`의 `cn`)에 맞게 고칩니다. shadcn CLI 패키지는 의존성에 넣지 않습니다(개발 도구 취약점 때문에 `src/styles/shadcn.css`로 필요한 CSS만 복사해 둠).
- 화면 모드(라이트/다크)는 `src/lib/theme.ts`로 다룹니다. `<html class="dark">`가 다크 모드입니다.
- 아이콘은 `lucide-react`를 씁니다.
- 기록 입력 화면은 공통 요소를 조합합니다 (기능요구사항서 3장, T-14). 화면 확인은 개발 서버의 `/dev/ui`에서 합니다.
  - 입력칸: `TextField`(글자 수 제한·표시), `DateField`(요일 표시, 기본값 오늘은 폼의 `defaultValues`에서). 폼 밖의 날짜 칸(타임라인 기간 등)은 같은 파일의 `DateInput`을 씁니다. React Hook Form의 `control`과 `name`을 넘깁니다.
  - 검증: `src/lib/validation.ts`의 `requiredText`, `optionalText`, `recordDate`로 Zod 스키마를 만듭니다. 서버 검증 실패도 같은 입력칸에 같은 문구로 표시합니다 (`setError`).
  - 저장 성공은 `notifySaved()`, 삭제는 `DeleteRecordButton`(확인 창 포함), 그 밖의 확인은 `ConfirmDialog`, 고를 것 없이 알리기만 할 때는 `NoticeDialog`([확인] 하나), 네트워크 오류는 화면 상단 `ErrorBanner`(입력값 유지 + 다시 시도), 0건은 `EmptyState`, 목록 로딩은 `ListLoading`을 씁니다.
  - 목록 화면의 추가 버튼은 `AddRecordButton`(모바일은 오른쪽 아래 떠 있는 버튼, PC는 제자리 버튼)을 씁니다.
  - 하나만 고르는 칩(차트 기간, 정렬 등)은 `ChoiceChips`를 씁니다. 선택 상태는 디자인.md 2.4(연보라 배경 + 보라 테두리)를 따릅니다.
- 차트는 Recharts를 씁니다. 라이브러리가 커서 차트 컴포넌트는 `lazy()`로 불러와 해당 화면을 열 때만 내려받게 합니다 (예: `features/body/BodyPage.tsx`). 색은 `var(--color-primary)`처럼 CSS 변수로 넘겨 다크 모드를 따르게 합니다.
  - 화면 전환으로 입력하는 화면(발달 기록, 수면, 레시피 편집)은 `FormPage`(위쪽 뒤로 가기 + 제목)와 `FormActions`(모바일은 아래 고정 취소·저장)로 만들고, 라우트에 `handle: { hideBottomNav: true }`를 붙여 모바일 하단 탭을 숨깁니다. 저장·취소 후에는 `useGoBack(fallback)`으로 진입했던 화면으로 돌아갑니다 (기능요구사항서 2.3).
  - 시트로 입력하는 화면(키·몸무게, 식단 칸, 알러지 지정)은 `ui/sheet`의 바텀 시트를 쓰고, 열림 상태는 `useSheetParam()`으로 주소(`?record=new` 또는 `?record=<id>`)에 둡니다. 뒤로 가기로 닫히고, 다른 화면에서 이 주소로 바로 열 수 있습니다.

## 규칙

- 응답과 문서는 한국어로 작성합니다. CLAUDE.md를 포함한 저장소의 모든 문서에 적용합니다.
- 비밀값은 코드에 하드코딩하지 않습니다. Supabase 접속 정보는 `.env.local`(예시 `.env.example`), 테스트 계정은 `.env.test.local`(예시 `.env.test.example`)에 둡니다. 브라우저에는 Publishable key(`sb_publishable_`)만 사용하고, Secret key(`sb_secret_`)는 어떤 파일에도 넣지 않습니다. 허용 이메일은 코드가 아니라 Supabase Auth 사용자 목록으로 관리합니다.
- 아이 정보(알러지 정보, 사진 포함)는 민감 정보입니다. 로그에 남기지 않고, 테스트와 예시에는 가명 데이터를 사용합니다.
