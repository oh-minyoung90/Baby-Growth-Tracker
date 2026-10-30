# Baby Growth Tracker 태스크 분해 (MVP-1) v1.6

Oct 20, 2026 · @오민영 · 상태: 확정

**변경 이력**

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-10-20 | MVP-1 태스크 초안. 디자인 단계 추가 |
| v0.2 | 2026-10-20 | 파일명 `task.md`로 변경. 시안 방식·디자인 방향(D-01) 결정, PC 레이아웃(DS6) 추가 |
| v1.0 | 2026-10-20 | K1~K5 확정. 태스크별 GitHub Issue(#3~#42) 생성·연결, 마일스톤 MVP-1 |
| v1.1 | 2026-10-20 | 식사 기록을 MVP-1에 포함 (PRD v1.2). D-07, T-36~T-51 추가(Issue #44~#60), 설정·E2E 태스크 범위 확장 |
| v1.2 | 2026-10-28 | T-23에 FR-TL-07(타임라인 키·몸무게) 포함. 어느 태스크에도 없었음. T-51에 유형 필터 "처음 먹은 음식" 추가를 명시 |
| v1.3 | 2026-10-28 | 메뉴 개편 T-52 추가(Issue #88): 수면을 하단 탭으로, 성장 탭은 기록/키·몸무게, 단어 목록을 유형별 개수로 대체, 놀이를 행동에 합침 (기능요구사항서 R1·R42·R43) |
| v1.4 | 2026-10-29 | T-37에 음식 수정 함수 `update_food`와 빈 목록의 기본 음식 추가, 탭별 추가 시트, 반응 선택, 같은 이름 안내를 포함 (기능요구사항서 R45~R47). 음식 목록의 먹은 횟수는 식단 기록이 생긴 뒤 T-46에서 표시. T-40의 재계산에 `update_food` 포함 |
| v1.5 | 2026-10-30 | T-38 함수를 `set_food_caution`(지정·정보 수정)·`release_food_caution`(해제)·`clear_caution_tag`로 정리하고, 지정은 음식 수정 시트에서 시작(R48), 해제 정보는 이력에 남김(R49). T-40에 해제의 재계산과 "주의" 태그 해제 통합 테스트, T-46에 이력의 알러지·주의 정보 표시 추가 |
| v1.6 | 2026-10-30 | T-39는 테이블·제약·RLS까지 두고 화면이 직접 쓸 수 있게 함. 식단 테이블 직접 쓰기를 막고 함수로만 쓰게 하는 일을 T-40에, `meal_entry_recipes.recipe_id` 외래 키를 T-47에 추가 |

## 1. 기준

| 항목 | 기준 |
| --- | --- |
| 기준 문서 | PRD v1.2, 기능요구사항서 v1.1, 기술요구사항서 v1.1 |
| 범위 | MVP-1 (성장 기록 + 식사 기록). 구현은 성장 기록 → 식사 기록 순서 |
| 태스크 크기 | 반나절~1일. 1일을 넘을 것 같으면 다시 나눈다 |
| 단위 | 태스크 1개 = 브랜치 1개 = PR 1개 |
| 브랜치 이름 | `종류/태스크ID-짧은설명` (예: `feat/T-16-body-form`, `design/D-03-home`) |
| 진행 관리 | 태스크마다 GitHub Issue(마일스톤 MVP-1, 단계 라벨). PR 본문에 `Closes #번호`를 적어 병합 시 Issue를 닫는다 |
| 공통 완료 기준 | CI 통과, 관련 단위 테스트 추가, 새 테이블은 RLS 테스트 추가, dev 환경에서 직접 확인, 설계와 달라진 점은 설계 문서에 반영 |

**표기**

- 👤 사용자 작업이 포함된 태스크 (계정 생성, 시안 승인 등). 진행 전에 단계별로 안내한다.
- 크기: S = 반나절, M = 1일

## 2. 전체 흐름

```
[0단계 준비]  T-01 → T-02 → T-03 → T-04
                                    │
[디자인]      D-01 → D-02 → D-03 → D-04 → D-05 → D-07 → D-06
                                                   │
[1단계 기반]  T-06 → T-07 → T-08 → T-09 ← T-05(디자인 토큰, D-06 이후)
                                    │
[2단계 인증]  T-10 → T-11,  T-12 → T-13
                                    │
[3단계 기록]  T-14 → 키·몸무게(T-15~17) → 발달(T-18~23, T-52) → 수면(T-24~27) → 홈(T-28)
                                    │
[3B 식사]     음식(T-36~38, T-46) → 식단(T-39~45) → 레시피·사진(T-47~50) → 연동(T-51)
                                    │
[4단계 설정]  T-29 → T-30 → T-31
                                    │
[5단계 마무리] T-32 → T-33 → T-34 → T-35
```

- 0단계·1단계(T-06~T-08)와 디자인 단계는 서로 의존하지 않아 함께 진행할 수 있다.
- 화면을 만드는 태스크(T-10 이후)는 디자인 확정(D-06)과 UI 기반(T-05) 이후에 시작한다.

## 3. 태스크 목록

### 0단계: 프로젝트 준비

| ID | 태스크 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- |
| T-01 [#3](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/3) | 프로젝트 생성 | Vite + React + TypeScript 생성, 기술요구사항서 4.2 폴더 구조, `.gitignore`(`.env*.local` 포함), `.nvmrc`, `.env.example` | `npm run dev`로 빈 화면이 뜸. `.env.local`이 커밋 대상에서 빠짐 | - | S |
| T-02 [#4](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/4) | 코드 품질 도구 | ESLint, Prettier, TypeScript strict, VS Code 저장 시 포맷 설정 | `npm run lint`, `npm run typecheck` 통과 | T-01 | S |
| T-03 [#5](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/5) | 테스트 도구 | Vitest, Testing Library 설정, 예시 테스트 1개 | `npm test` 통과 | T-01 | S |
| T-04 [#6](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/6) | CI | GitHub Actions: PR마다 린트·타입 검사·테스트·빌드 | PR에서 CI가 자동 실행되고 통과 | T-02, T-03 | S |

### 디자인 단계

| ID | 태스크 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- |
| D-01 | ✅ 디자인 방향 결정 | 분위기, 글꼴, 아이콘, 다크 모드, 화면 크기 대응 결정 (5.2) | 2026-10-20 완료 | - | S |
| D-02 ✅ [#7](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/7) | 👤 공통 요소 시안 | 색 조합 3개 비교·선택(DS2), 글자 크기·간격 기준, 라이트·다크 모드, 버튼, 입력칸, 날짜 선택, 확인 창, 알림, 하단 탭, 빈 상태 화면 | 시안 승인 | D-01 | M |
| D-03 ✅ [#8](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/8) | 👤 화면 시안 1 | 로그인, 아이 정보 등록, 홈 | 시안 승인 | D-02 | S |
| D-04 ✅ [#9](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/9) | 👤 화면 시안 2 | 발달 기록 입력(유사 기록·중복 확인 창 포함), 단어 목록, 발달 타임라인 | 시안 승인 | D-02 | M |
| D-05 ✅ [#10](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/10) | 👤 화면 시안 3 | 키·몸무게(입력·차트·목록), 수면(입력·목록), 설정(내보내기·가져오기·전체 삭제) | 시안 승인 | D-02 | M |
| D-07 ✅ [#44](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/44) | 👤 화면 시안 4 (식사) | 주간 식단(7일 카드: PC 한 줄·모바일 좌우 넘김과 요일 칩, 칸 입력 시트, 경고), 음식 목록·상세·알러지 지정, 레시피 목록·상세·편집 | 시안 승인 | D-02 | M |
| D-06 [#11](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/11) | 디자인 확정 반영 | 확정 시안 링크와 디자인 기준을 `docs/디자인.md`로 정리, 기능요구사항서 와이어프레임과 다른 부분 반영 | 문서 반영, PR 병합 | D-03~D-05, D-07 | S |
| T-05 [#12](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/12) | UI 기반 구성 | Tailwind, shadcn/ui 설치, 디자인 기준(색·글꼴·간격)을 설정 파일에 적용, 공통 컴포넌트 기본형 | 공통 컴포넌트가 시안과 같게 보임 | T-01, D-06 | M |

### 1단계: Supabase 기반과 앱 골격

| ID | 태스크 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- |
| T-06 [#13](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/13) | 👤 Supabase dev 준비 | dev 프로젝트 생성, 회원가입 차단, 계정 3개(본인·테스트 A·B) 등록, 메일 템플릿을 6자리 코드로 변경, `.env.local`·`.env.test.local` 작성. 확인 항목 C1·C2·C3·C6 점검 | 본인 계정으로 코드 메일 수신 확인, 확인 결과를 기술요구사항서에 반영 | - | S |
| T-07 [#14](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/14) | Supabase CLI·마이그레이션 체계 | CLI 개발 의존성 설치, dev 프로젝트 연결, 마이그레이션 폴더, DB 타입 자동 생성 스크립트. 확인 항목 C7 점검 | 빈 마이그레이션이 dev에 적용되고 타입 파일이 생성됨 | T-01, T-06 | S |
| T-08 [#15](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/15) | 공통 DB 기반 + children | `updated_at` 트리거, 미래 날짜 검증 함수(D2), `children` 테이블·RLS. RLS 통합 테스트 기반(계정 A·B) | A의 데이터를 B가 읽거나 쓰지 못하는 테스트 통과 | T-07 | M |
| T-09 [#16](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/16) | 앱 골격 | Supabase 클라이언트, TanStack Query, React Router, 하단 탭 레이아웃(빈 화면 5개), 로그인 여부에 따른 이동(인증 가드) | 탭 이동 동작. 로그인하지 않으면 로그인 화면으로 이동 | T-05, T-07 | M |

### 2단계: 로그인과 아이 정보

| ID | 태스크 | 범위 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- | --- |
| T-10 [#17](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/17) | 로그인 화면 | SCR-01, FR-AUTH-01~04 | 이메일 입력, 코드 요청, 6자리 입력, 오류·만료 문구, 허용되지 않은 이메일도 같은 문구 | 본인 계정 로그인 성공, 등록되지 않은 이메일은 코드 미발송 | T-09 | M |
| T-11 [#18](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/18) | 세션 유지·로그아웃 | FR-AUTH-05~06, FR-SET-08 | 새로고침 후 로그인 유지, 로그아웃 시 로그인 화면으로 | 로그아웃 후 기록 화면 접근 불가 | T-10 | S |
| T-12 [#19](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/19) | 생후 일수 계산 | BR-01, 기능요구사항서 3.2 | `domain/age.ts`, 3.2 예시 표 전체 단위 테스트 | 예시 표 5건과 경계값 테스트 통과 | T-03 | S |
| T-13 [#20](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/20) | 아이 정보 등록·수정 | SCR-02, FR-CHILD-01~04 | 최초 등록 화면(입력 전 다른 화면 이동 차단), 수정 화면, 생년월일 변경 확인 창 | 등록 후 홈으로 이동, 계정당 1건만 저장 | T-08, T-11, T-12 | M |

### 3단계: 기록 화면

| ID | 태스크 | 범위 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- | --- |
| T-14 [#21](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/21) | 공통 입력 요소 | FR-COM-01~31 | 날짜 입력(기본값·범위 제한·요일 표시), 글자 수 제한 입력칸, 저장 알림, 삭제 확인 창, 네트워크 오류 안내, 빈 상태 | 컴포넌트 테스트 통과 | T-05, T-12 | M |
| T-15 [#22](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/22) | 키·몸무게 DB | F-05 | `body_measures` 테이블, 범위·필수 CHECK, RLS, RLS 테스트 | 범위 밖 값이 DB에서 거부됨 | T-08 | S |
| T-16 [#23](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/23) | 키·몸무게 입력·목록 | SCR-04, FR-BODY-01~02, 05~07 | 입력·수정·삭제 폼, 같은 날짜 안내, 측정 목록 | 입력 즉시 목록 반영, 잘못된 값 저장 안 됨 | T-14, T-15 | M |
| T-17 [#24](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/24) | 키·몸무게 차트 | FR-BODY-03~04 | 키·몸무게 차트 2개, 기간 선택, 점 선택 시 상세 | 0건·1건·여러 건에서 깨지지 않음 | T-16 | S |
| T-18 [#25](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/25) | 발달 기록 DB | F-06 | `milestones` 테이블, `title_key` 생성 컬럼, 인덱스, RLS, RLS 테스트 | 유형·글자 수 제약 동작 | T-08 | S |
| T-19 [#26](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/26) | 같은 내용 판단 | BR-03 | `domain/text.ts`(공백·대소문자 정리, 포함 검색), 단위 테스트 | 테스트 통과, DB `title_key`와 같은 결과 | T-03 | S |
| T-20 [#27](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/27) | 발달 기록 입력·수정 | SCR-05, FR-MS-01~04, 07 | 유형 선택, 날짜·생후 일수, 내용·메모, 기본 예시 버튼(부록 A), 수정·삭제 | 4가지 유형 생성·수정·삭제 | T-14, T-18 | M |
| T-21 [#28](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/28) | 유사 기록·중복 안내 | F-07, FR-MS-05~06 | 입력 중 유사 기록 최대 5개, 저장 시 중복 확인 창 | 같은 내용 저장 시 확인 창 표시 | T-19, T-20 | S |
| T-22 [#29](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/29) | 단어 목록 | SCR-06, FR-WORD-01~03 | 단어 수(중복 1개로 계산), 정렬, 추가 버튼. T-52에서 화면을 없애고 성장 > 기록의 유형별 개수로 대체 | 단어 수가 중복을 제외하고 표시됨 | T-20 | S |
| T-23 [#30](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/30) | 발달 타임라인 | SCR-07, FR-TL-01~05, 07 | 월별 묶음, 유형·기간 필터, 결과 없음 화면, 키·몸무게 측정 함께 표시 | 필터 조합별로 올바르게 표시 | T-20 | M |
| T-52 [#88](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/88) | 메뉴 개편 | R1, R42, R43, FR-TL-08~10 | 하단 탭 홈/수면/성장/식사/설정, 성장 상단 탭 기록/키·몸무게, 단어 목록 화면 삭제, 유형별 개수와 추가 버튼, 놀이 → 행동 마이그레이션(기존 기록 이동, 유형 제약 변경)과 예시 이동 | 놀이 기록이 행동으로 보이고 놀이로는 저장 안 됨, 개수를 누르면 그 유형만 보임 | T-22, T-23 | M |
| T-24 [#31](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/31) | 수면 DB | F-10 | `sleep_logs` 테이블, 수면일 unique, 검증 트리거(FR-SLEEP-07), RLS, RLS 테스트 | 겹치는 낮잠·범위 밖 밤잠이 DB에서 거부됨 | T-08 | M |
| T-25 [#32](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/32) | 수면 계산 | BR-04~07 | `domain/sleep.ts`(시각에 날짜 붙이기, 총 수면, 오류 판정), 경계값 단위 테스트 | 23:59/00:00/11:59/12:00 경계 테스트 통과 | T-03 | S |
| T-26 [#33](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/33) | 수면 입력·수정 | SCR-08, FR-SLEEP-01~08 | 수면일 기본값 어제, 시각 입력과 붙은 날짜 표시, 낮잠 추가·삭제, 실시간 총 수면, 기존 수면일 선택 시 수정 모드 | 낮잠 여러 개 저장, 오류 조건에서 저장 안 됨 | T-14, T-24, T-25 | M |
| T-27 [#34](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/34) | 수면 목록 | FR-SLEEP-09 | 수면일 최신순 목록, 밤잠·낮잠 횟수·총 수면 | 부분 입력 기록은 "계산 불가" 표시 | T-26 | S |
| T-28 [#35](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/35) | 홈 | SCR-03, FR-HOME-01~06 | 아이 정보·생후 일수, 오늘의 발달 기록, 어젯밤 수면, 최근 측정, 빠른 기록 버튼 4개 | 0건일 때 안내, 각 버튼이 해당 입력 화면을 엶 | T-17, T-21, T-27 | M |

### 3B단계: 식사 기록 (v1.1 추가)

| ID | 태스크 | 범위 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- | --- |
| T-36 [#45](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/45) | 음식 DB | F-13, F-14, BR-17~18 | `foods`, `food_status_history` 테이블, 이름 중복 제약, 상태 컬럼 보호(D10), RLS, RLS 테스트, `add_food()`, `seed_default_foods()`(부록 B) | 같은 이름 거부, 화면에서 상태 직접 수정 불가 | T-08 | M |
| T-37 [#46](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/46) | 음식 목록 화면 | SCR-10, FR-FOOD-01~08 | 상태별 탭·개수, 식품군 필터, 이름 검색, 탭별 추가(먹어봄은 처음 먹은 날·반응 포함)·수정(상태 옮기기, `update_food()`)·삭제, 같은 이름 입력 중 안내와 안 먹어봄 음식 옮기기, 아이 정보 등록 시와 빈 목록에서 기본 음식 추가 (R45~R47) | 탭별 표시 정보가 맞음, 삭제 확인 창 | T-14, T-36 | M |
| T-38 [#47](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/47) | 알러지·주의 관리 | FR-FOOD-11~14, BR-11, BR-13, R48~49 | `set_food_caution()`(지정, 이미 알러지·주의면 정보 수정), `release_food_caution()`, `clear_caution_tag()`, 수정 시트에서 바뀌는 지정 화면, 알러지·주의 음식의 정보 수정, 해제·태그 해제 확인 창(사유). 해제 때 알러지·주의 정보를 이력에 남김 | 지정·해제·태그 해제마다 이력이 남고 상태가 BR-11과 같음 | T-37 | M |
| T-39 [#48](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/48) | 식단 DB | F-15 | `meal_entries`, `meal_entry_foods`, `meal_entry_recipes` 테이블, 날짜·끼니 unique, 미래 "먹음" 제약, RLS, RLS 테스트 | 같은 날짜·끼니 2건 거부 | T-36 | S |
| T-40 [#49](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/49) | 음식 상태 재계산 | BR-11~13, BR-15, BR-17, D11 | `recalc_food`, `save_meal_entry()`, `set_meal_eaten()`, `delete_meal_entry()`, `update_food()`·`release_food_caution()`의 상태 계산을 `recalc_food`로 교체. 식단 테이블 직접 쓰기를 막고 함수로만 쓰게 함(T-39 통합 테스트도 함수로 바꿈). 통합 테스트(기술요구사항서 9.1.1, 식단으로 붙은 "주의" 태그의 해제 포함) | BR-11 전환표 모든 행과 재계산 케이스 통과 | T-39 | M |
| T-41 [#50](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/50) | 칸 이동 함수 | FR-MEAL-10~12 | `move_meal_entry()`(충돌 거부, 미래 이동 시 체크 해제) + 재계산, 통합 테스트 | 충돌·미래 이동·재계산 테스트 통과 | T-40 | S |
| T-42 [#51](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/51) | 주간 식단 화면 | SCR-11, FR-MEAL-01~03, 15 | 주 이동·이번 주, 7일 카드(PC 한 줄·최대 폭 1,280px, 모바일 좌우 넘김·요일 칩), 칸 표시(계획 배지·점선), 빈 주 안내 | 월요일 시작, 화면 폭에 따라 배치 전환, 열면 오늘 카드 표시 | T-14, T-39 | M |
| T-43 [#52](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/52) | 식단 칸 입력 | FR-MEAL-04~07, 13 | 입력 시트, 음식·레시피 검색 선택, 새 음식 바로 추가, 먹은 정도·메모·먹음 체크, 저장·삭제 | 음식·레시피 없이 저장 불가, 미래 날짜 체크 불가 | T-40, T-42 | M |
| T-44 [#53](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/53) | 경고·먹음 체크·첫 시도 알림 | FR-MEAL-08~09, 14 | 주의 음식·재료 경고 배너와 저장 확인 창, 표에서 바로 먹음 체크, "처음 먹었어요" 알림 | 계획 칸에도 경고, 첫 시도 알림 표시 | T-43 | S |
| T-45 [#54](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/54) | 칸 이동 화면 | FR-MEAL-10~12 | PC 드래그, "이동" 메뉴(날짜·끼니 선택), 충돌 안내, 미래 이동 확인 창 | PC 드래그·모바일 메뉴 모두 이동됨 | T-41, T-43 | M |
| T-46 [#55](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/55) | 음식 상세 | FR-FOOD-09~10 | 음식 정보, 반응 선택, 먹은 식단 목록, 알러지·주의 정보, 이력 목록(해제 이력의 알러지·주의 정보 포함, R49), 음식 목록의 먹은 횟수 표시와 목록에서 상세로 연결 | 식단·이력이 최신순으로 표시 | T-38, T-40 | S |
| T-47 [#56](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/56) | 레시피 DB | F-17 | `recipes`, `recipe_ingredients`, `photos` 테이블, RLS, RLS 테스트, `meal_entry_recipes.recipe_id` 외래 키(레시피 삭제 시 null, T-39에서 미룸) | 레시피 삭제 시 재료 함께 삭제, 음식 삭제 시 재료 이름 유지 | T-36 | S |
| T-48 [#57](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/57) | 사진 저장소 | F-11, 기술요구사항서 6.3 | 비공개 버킷·Storage 정책(마이그레이션), 리사이즈·압축·업로드·서명 URL·삭제 유틸, 확인 항목 C8(HEIC) | 다른 계정 사진 접근 불가, 1,280px 이하로 저장 | T-07 | M |
| T-49 [#58](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/58) | 레시피 목록·상세 | SCR-12, FR-RCP-01~03 | 목록 카드, 이름 검색, 재료 필터(AND), 상세(번호 붙은 조리 순서, 주의 재료 표시) | 0건·1건에서 깨지지 않음 | T-14, T-47 | M |
| T-50 [#59](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/59) | 레시피 편집 | FR-RCP-04~08 | 재료 행·조리 순서 단계 편집, 사진 첨부·교체·삭제, 레시피 삭제(사진 파일 포함) | 사진 교체 시 이전 파일 삭제 | T-48, T-49 | M |
| T-51 [#60](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/60) | 식사 연동 마무리 | FR-HOME-07~08, FR-TL-06, FR-SET-09 | 홈 "오늘의 식단" 카드·식단 빠른 기록, 타임라인 "처음 먹은 음식"(목록과 유형 필터), 레시피를 식단 칸에서 선택 가능하게 연결 | 처음 먹은 음식이 타임라인에 표시, 홈 빠른 기록 5개 | T-28, T-44, T-49 | S |

### 4단계: 설정 (백업·삭제)

| ID | 태스크 | 범위 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- | --- |
| T-29 [#36](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/36) | 설정 화면 + 내보내기 | SCR-09, FR-SET-01~02 | 설정 메뉴, `export_backup()` 함수(성장·식사 기록 포함, 사진 파일 제외), JSON 파일 내려받기 | 파일에 스키마 버전·전체 기록 포함 | T-28, T-51 | M |
| T-30 [#37](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/37) | 가져오기 | FR-SET-03~05, R23 | `import_backup()` 함수(검사·전체 덮어쓰기·트랜잭션), 확인 창, 실패 이유 표시 | 내보낸 파일로 동일하게 복원, 잘못된 파일은 기존 데이터 유지 | T-29 | M |
| T-31 [#38](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/38) | 데이터 전체 삭제 | F-23, FR-SET-06~07 | `delete_all_data()` 함수, Storage 사진 삭제, 내보내기 안내, "삭제" 입력 확인, 삭제 후 아이 정보 등록 화면 | 삭제 후 모든 조회 결과와 사진이 비어 있음 | T-29, T-48 | S |

### 5단계: 검증과 배포

| ID | 태스크 | 범위 | 작업 내용 | 완료 기준 | 선행 | 크기 |
| --- | --- | --- | --- | --- | --- | --- |
| T-32 [#39](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/39) | E2E 테스트 기반 | 기술요구사항서 9.3 | Playwright 설정, 테스트 계정 세션 주입, 테스트 데이터 정리 | 로그인 상태로 홈이 열리는 테스트 통과 | T-28 | M |
| T-33 [#40](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/40) | E2E 시나리오 | PRD 8장 MVP-1 | 완료 기준을 시나리오로 작성 (기록 생성·수정·삭제, 잘못된 입력, 0건·1건, 백업 복원, 전체 삭제, 식단 계획→먹음 체크→처음 먹은 음식, 알러지 경고, 레시피 사진) | 전체 시나리오 통과 | T-31, T-32 | M |
| T-34 [#41](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/41) | 보안·PWA 마무리 | 기술요구사항서 10.2 | 보안 헤더(`_headers`), 홈 화면 추가용 manifest·아이콘, 콘솔에 아이 정보 출력 여부 점검 | 점검 목록 통과 | T-28 | S |
| T-35 [#42](https://github.com/oh-minyoung90/Baby-Growth-Tracker/issues/42) | 👤 운영 배포 | 기술요구사항서 10.1 | prod 프로젝트 생성·마이그레이션 적용·본인 계정 등록, 인증 설정을 dev와 동일하게(회원가입 차단, 코드 6자리·유효 10분, Gmail SMTP, 메일 템플릿), Cloudflare Pages 연결·환경변수·미리보기 배포 끄기. 확인 항목 C4·C5 점검 | 운영 주소에서 로그인·기록 동작, 성능 기준(1초) 확인 | T-33, T-34 | M |

**MVP-1 완료**: T-35 이후 PRD 8장 MVP-1 체크리스트를 운영 환경에서 한 번 더 점검한다.

## 4. 요약

| 단계 | 태스크 수 | 사용자 작업 |
| --- | --- | --- |
| 0단계 준비 | 4 (T-01~T-04) | - |
| 디자인 | 8 (D-01~D-07, T-05) | D-01~D-05, D-07 결정·승인 |
| 1단계 기반 | 4 (T-06~T-09) | T-06 계정 준비 |
| 2단계 인증·아이 | 4 (T-10~T-13) | - |
| 3단계 기록 | 16 (T-14~T-28, T-52) | - |
| 3B단계 식사 | 16 (T-36~T-51) | - |
| 4단계 설정 | 3 (T-29~T-31) | - |
| 5단계 마무리 | 4 (T-32~T-35) | T-35 운영 계정·배포 |
| **합계** | **59** | |

## 5. 디자인 결정 사항

### 5.1 시안 작성 방식 (2026-10-20 결정)

- **HTML 클릭 시안**으로 한다. 실제 구현할 스타일(Tailwind·shadcn/ui 형태)로 화면 시안을 만들어 claude.ai 페이지로 공유한다.
- 시안 링크는 휴대폰과 PC 브라우저 모두에서 열린다. 시안 안에서 모바일 폭과 PC 폭을 바꿔 볼 수 있게 만든다.

### 5.2 디자인 방향 (D-01, 2026-10-20 결정)

| ID | 항목 | 결정 |
| --- | --- | --- |
| DS1 | 분위기 | 밝고 귀여운 색감 + 깔끔한 플랫 디자인 (그림자·그라데이션 최소화, 둥근 모서리, 넉넉한 여백) |
| DS2 | 기본 색 | C안 라벤더·피치 (2026-10-20 결정). 기본 #6E54D6(다크 #A996FF), 보조 피치·민트·옐로. 놀이 유형 글자색은 명도 대비 4.5:1을 지키는 범위에서 연하게 조정(#8A6800). 삭제·오류 색은 A안의 기본 색인 코랄 #D2493A(다크 #FF8E7C), 오류 안내 배경 #FFE4DD. 선택 상태는 모두 보라색(연보라 배경 + 보라 테두리)으로 통일하고, 유형별 색은 배지·카드의 구분 용도로만 사용 |
| DS3 | 글꼴 | Pretendard |
| DS4 | 아이콘 | Lucide |
| DS5 | 다크 모드 | 지원. 기기 설정을 따르고, 설정 화면에서 직접 바꿀 수도 있음 |
| DS6 | 화면 크기 대응 | 모바일 우선 반응형 (아래 표) |

**DS6 화면 크기별 레이아웃**

| 화면 폭 | 레이아웃 |
| --- | --- |
| 모바일 (768px 미만) | 하단 탭 메뉴, 한 줄 배치 |
| 태블릿·PC (768px 이상) | 왼쪽 세로 메뉴, 본문 최대 폭 960px. 차트와 목록을 나란히 두는 등 넓은 화면 활용 |

- PRD의 "모바일 우선"은 모바일에서 가장 편하게 쓰도록 설계한다는 뜻이며, PC에서도 같은 기능을 모두 쓸 수 있다.

## 6. 결정 사항 (2026-10-20 확정)

| ID | 항목 | 결정 |
| --- | --- | --- |
| K1 | 태스크 크기 | 반나절~1일, 총 41개 |
| K2 | 디자인 단계 위치 | 0단계·1단계와 함께 진행, 화면 구현(T-10) 전에 확정 |
| K3 | 시안 작성 방식 | HTML 클릭 시안 (5.1) |
| K4 | 진행 관리 | 태스크마다 GitHub Issue 생성 완료 (#3~#42), PR에서 `Closes #번호`로 연결 |
| K5 | 3단계 순서 | 키·몸무게 → 발달 → 수면 → 홈. 단순한 화면부터 만들어 공통 요소를 안정시킨 뒤 복잡한 화면으로 진행 |
