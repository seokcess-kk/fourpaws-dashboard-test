# 장례 매출 대시보드 (웹앱)

Next.js + Chart.js 기반 대시보드. 엑셀(.xlsx) 파일을 업로드하면 브라우저에서 자동 집계되어 대시보드가 렌더링됩니다.

## 구조

```
app/
  layout.tsx          # 루트 레이아웃
  page.tsx            # 엑셀 업로드 페이지 (/)
public/
  dashboard.html      # 대시보드 정적 페이지 (/dashboard.html) — 기존 sample HTML 이식
lib/
  schema.ts           # DATA 타입 + 엑셀 컬럼 타입
  transform.ts        # 엑셀 raw → DATA 변환기
EXCEL_SPEC.md         # 엑셀 시트/컬럼 명세
```

데이터 흐름: `/` 에서 엑셀 업로드 → `xlsx`로 파싱 → `transformToDashboardData()`로 집계 → `sessionStorage`에 저장 → `/dashboard.html`로 이동 → 기존 1300+ 줄 렌더링 JS 실행.

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## Vercel 배포

가장 빠른 경로:

```bash
# Vercel CLI 미설치 시
npm i -g vercel

# 첫 배포 (프로젝트 link + 프리뷰 배포)
vercel

# 프로덕션 배포
vercel --prod
```

또는 GitHub repo를 Vercel 대시보드에 연결하면 자동 CI/CD가 동작합니다. 별도 환경변수가 필요 없으며, 기본 설정으로 동작합니다.

## 데이터 보안

- 엑셀 파일은 **브라우저 안에서만** 처리되며 서버로 전송되지 않습니다.
- 세션 종료(탭 닫기) 시 `sessionStorage`의 데이터는 자동으로 사라집니다.
- 비밀번호 게이트가 필요하면 Vercel 프로젝트 설정의 [Password Protection](https://vercel.com/docs/security/deployment-protection)으로 deployment 단위 보호 가능 (Pro 플랜).

## 엑셀 형식

자세한 컬럼 명세는 [EXCEL_SPEC.md](./EXCEL_SPEC.md) 참조.
