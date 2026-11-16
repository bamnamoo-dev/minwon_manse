# 민원만세 — AI 코딩 에이전트 작업 규칙

서울특별시교육청 「민원편람」(2025)을 원 소스로 한 **담당자용 종합 민원 검색기**.
전체 계획: `docs/민원만세_개발계획서.md` · 데이터 검수 현황: `docs/검수_체크리스트.md`, `docs/extract_report.md`

## 절대 규칙
1. `source/` 파일(민원편람.md, 민원편람.pdf)은 **절대 수정하지 않는다.**
2. 민원 내용은 **`data/` JSON에서만 읽는다.** 코드에 민원 내용·연도·서류를 하드코딩하지 않는다.
3. **편람에 없는 내용을 지어내지 않는다.** 모르면 `TODO(검수필요)`로 표시하고 사람에게 묻는다.
4. `"reviewed": true` 인 데이터는 사람이 검수한 것 → 에이전트가 임의로 바꾸지 않는다.
5. 사용자가 입력한 출생연도·졸업연도 등은 **브라우저 밖으로 보내지 않는다**(서버 전송·로그·URL 쿼리 금지).
6. 데이터 스키마를 바꾸면 `scripts/validate.ts`, `scripts/extract_minwon.py`, 계획서 3장을 함께 고친다.

## 폴더
- `source/` 원본(읽기 전용) · `scripts/` 추출·검증 스크립트 · `data/` 민원·규칙·업무안내 JSON
- `public/pages/p{n}.webp` PDF 페이지 이미지(git 제외, `npm run render-pages`로 생성) · `public/forms/` HWP 서식
- `src/` React 앱 (Vite + React + TypeScript)

## 쪽 번호
- JSON의 `sourcePages`, `pdfPages` = **PDF 물리 쪽수** (= MD의 `<!-- PAGE: n -->`, = `p{n}.webp`)
- 편람 인쇄 쪽수 = PDF 쪽수 − 10 (예: 졸업증명서 PDF 139쪽 = 인쇄 129쪽)

## 주요 데이터
- `data/minwon/M01~M96.json` 민원 96건 (스키마: `scripts/validate.ts`의 `Minwon`)
- `data/rules/issuance_years.json` 연도별 발급경로 규칙. 셀 `s`: yes/no/partial/from/range/status/text
  - `from`+`status` 동시 존재 = "status에 해당하거나 from 이후" (예: 재직자 또는 2003년 이후 퇴직자)
  - 연월 비교는 'YYYY' 또는 'YYYY-MM' 문자열. 'YYYY'만 있으면 그해 1월로 간주
- `data/rules/identity.json` 방문자 유형 × 대상자 나이 → 구비서류
- `data/guides/G01~G37.json` II·III·IV·VI장 업무안내(markdown 원문)
- `data/synonyms.json` 검색 동의어

## 명령
- `npm run extract` — MD → data/minwon, data/guides 재생성 (reviewed=true 보호)
- `npm run render-pages` — PDF → public/pages
- `npm run validate` — 데이터 검증 (빌드 전 필수)
- `npm run dev` / `npm run build`

## 작업 방식
- Phase 단위로, 그 안에서도 파일 단위로 작게 작업하고 끝날 때마다 `npm run validate` + 동작 확인.
- 판별기 로직은 Vitest 단위 테스트 필수 (경계값: 1951-02, 1982-02, 2002-02, 2003-02, 2003-03, 2013-02, 2014-03).
