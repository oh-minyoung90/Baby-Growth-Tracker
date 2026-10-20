# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 안내 문서입니다.

## 프로젝트 현황

Baby Growth Tracker는 아이의 성장(키·몸무게, 발달, 수면)과 식사(음식 목록, 주간 식단, 레시피)를 기록하는 개인용 웹 앱입니다. 현재 설계 단계이며 소스 코드는 아직 없습니다.

진행 순서: PRD → 기능요구사항서 → 기술요구사항서 → 태스크 분해 → 구현(MVP-1: 성장 기록 → 식사 기록) → 테스트

## 문서

- `PRD.md`(v1.2, 확정)는 범위, 기능(F-01~F-24), 데이터 모델, 결정 사항의 기준 문서입니다. 동작을 제안하기 전에 9장 "결정 사항"을 확인하고, 이미 결정된 항목은 사용자와 협의 없이 다시 바꾸지 않습니다.
- 설계 문서는 `docs/` 아래에 둡니다. `docs/기능요구사항서.md`(v1.1)는 화면별 요구사항(FR)과 비즈니스 규칙(BR)의 기준이며, `docs/기술요구사항서.md`(v1.1)는 시스템 구성, DB 스키마, RLS, 인증, 테스트, 배포 방식의 기준입니다. 구현 중 설계가 바뀌면 해당 문서를 함께 고칩니다. `docs/task.md`(v1.1)는 MVP-1(성장 기록 + 식사 기록) 태스크 목록이며, 태스크마다 GitHub Issue가 연결되어 있습니다. 설계 문서와 `PRD.md`가 서로 다르면 임의로 하나를 고르지 말고 사용자에게 알립니다.
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

## 아키텍처

아직 없습니다. 코드가 생기면 전체 구조(데이터 모델, 주요 모듈, 모듈 간 데이터 흐름)를 여기에 정리합니다.

## 규칙

- 응답과 문서는 한국어로 작성합니다. CLAUDE.md를 포함한 저장소의 모든 문서에 적용합니다.
- 비밀값은 코드에 하드코딩하지 않습니다. Supabase 키와 로그인 허용 이메일은 환경변수로 관리합니다. 브라우저에는 공개용 anon key만 사용하고, service role key는 절대 프론트엔드 코드에 넣지 않습니다.
- 아이 정보(알러지 정보, 사진 포함)는 민감 정보입니다. 로그에 남기지 않고, 테스트와 예시에는 가명 데이터를 사용합니다.
