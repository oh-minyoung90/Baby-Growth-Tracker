# Baby Growth Tracker

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

## 웹으로 이용하기

운영 배포(T-35)에서는 Cloudflare Pages가 웹 화면을 제공하고 운영용 Supabase가 로그인·기록·사진을
저장합니다. 배포 후 발급되는 HTTPS 주소를 휴대폰에서 열면 다른 장소에서도 이용할 수 있으며,
개발용 컴퓨터를 켜 둘 필요가 없습니다. 앱스토어 등록이나 별도 도메인 구매는 필수가 아닙니다.
홈 화면 설치 준비는 T-34에서 진행합니다. 실제 배포 주소·운영 인증 설정은 아직 준비 전입니다.
