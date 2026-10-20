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
```
