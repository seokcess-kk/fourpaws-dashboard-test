# 장례 매출 대시보드 (웹앱)

Next.js + Chart.js 기반 대시보드. 기본 진입 시 **데모 데이터**가 즉시 보이며, `/upload`에서 엑셀(.xlsx)을 업로드해 자신의 데이터로 교체할 수 있습니다.

## 구조

```
app/
  layout.tsx          # 루트 레이아웃
  upload/page.tsx     # 엑셀 업로드 페이지 (/upload)
public/
  dashboard.html      # 대시보드 정적 페이지 (rewrite 통해 / 에 노출)
  sample-data.json    # 데모 데이터 (sessionStorage 비어있을 때 fetch)
lib/
  schema.ts           # DATA 타입 + 엑셀 컬럼 타입
  transform.ts        # 엑셀 raw → DATA 변환기
EXCEL_SPEC.md         # 엑셀 시트/컬럼 명세
```

라우팅:
- `/` → `/dashboard.html` (rewrite). sessionStorage가 비어있으면 `sample-data.json`을 자동 fetch해 데모 모드로 표시.
- `/upload` → 엑셀 업로드 화면. 업로드 후 `xlsx` 파싱 → `transformToDashboardData()` 집계 → `sessionStorage`에 저장 → `/`로 이동하면 업로드 데이터로 표시.

데모/업로드 모드는 우상단 배지로 구분되며, "데모로 초기화" 버튼으로 sessionStorage를 비울 수 있습니다.

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
