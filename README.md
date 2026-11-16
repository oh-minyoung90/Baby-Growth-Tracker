# MyBabyLog

아이의 성장(키·몸무게, 발달, 수면)과 식사(음식 목록, 주간 식단, 레시피)를 기록하는 개인용 웹 앱입니다.

## 문서

- [PRD](PRD.md)
- [기능요구사항서](docs/기능요구사항서.md)
- [기술요구사항서](docs/기술요구사항서.md)
- [태스크](docs/task.md)

## 개발 환경

- Node.js 24 (`.nvmrc`)
- npm

```bash
npm install          # 의존성 설치
cp .env.example .env.local   # 환경변수 파일 만들기 (실제 값은 직접 입력, 커밋 금지)
npm run dev          # 개발 서버 실행 (http://localhost:5173)
npm run build        # 운영용 빌드 (dist/)
npm run preview      # 빌드 결과 미리보기
npm run lint         # ESLint 검사
npm run typecheck    # 타입 검사
npm run format       # Prettier로 코드 정리
npm test             # 단위·컴포넌트 테스트 (Vitest)
```

## 브라우저 자동 테스트

`npm run test:e2e`로 PC·모바일 화면과 실제 dev DB를 함께 검사합니다. dev 테스트 계정 A와
`E2E_DEV_PROJECT_REF` 설정이 필요합니다. 기존 테스트 데이터는 실행 후 복구합니다.
설치된 Chrome을 쓰려면 `E2E_CHROME=1 npm run test:e2e`를 실행합니다.
준비·시나리오·강제 종료 후 복구 방법은 [E2E 안내](tests/e2e/README.md)를 참고하세요.

실제 계정 없이 화면의 겹침·넘침을 검사하는 `npm run test:ui`도 제공합니다. Chromium·WebKit에서
수면 입력 화면을 검사하며 PR CI에서도 실행합니다. 실행 방법과 검증 범위는
[화면 오류 검증](docs/UI검증.md)을 참고하세요.

## 웹으로 이용하기

[운영 서비스 열기](https://baby-growth-tracker-5ib.pages.dev)

Cloudflare Pages가 웹 화면을 제공하고 서울의 운영 Supabase가 로그인·기록·사진을 저장합니다.
휴대폰에서 위 주소로 접속하면 다른 장소에서도 이용할 수 있고 개발용 컴퓨터를 켜 둘 필요가
없습니다. 등록된 본인 이메일로 6자리 인증코드를 받아 로그인합니다. 개발 환경의 기록은 자동으로
이전되지 않습니다.

iPhone Safari의 공유 메뉴에서 **홈 화면에 추가**하면 새싹 아이콘으로 실행할 수 있습니다.
데이터를 이용하려면 인터넷 연결이 필요합니다. SMTP에 설정한 Gmail은 로그인 코드의 발송 계정이며,
서비스에 로그인하는 이메일과 달라도 됩니다.

`main` 병합 시 자동 배포됩니다. `npm run check:production`으로 실제 운영 주소의 보안 헤더·하위 경로·
설치 정보·운영 DB 연결을 읽기 전용으로 검사할 수 있습니다. 환경 설정, 검증 결과와 남은 성능 점검은
[배포 점검](docs/배포점검.md)을 참고하세요.
