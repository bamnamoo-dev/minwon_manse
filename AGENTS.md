# 민원만세 — AI 코딩 에이전트 작업 규칙

서울특별시교육청 「민원편람」(2025)을 원 소스로 한 **담당자용 종합 민원 검색기**.
전체 계획: `docs/민원만세_개발계획서.md` · 디자인 개편: `docs/디자인_개편계획.md` · 데이터 검수 현황: `docs/검수_체크리스트.md`, `docs/extract_report.md`

## 절대 규칙
1. `source/` 파일(민원편람.md, 민원편람.pdf)은 **절대 수정하지 않는다.**
2. 민원 내용은 **`data/` JSON에서만 읽는다.** 코드에 민원 내용·연도·서류를 하드코딩하지 않는다.
3. **편람에 없는 내용을 지어내지 않는다.** 모르면 `TODO(검수필요)`로 표시하고 사람에게 묻는다.
4. `"reviewed": true` 인 데이터는 사람이 검수한 것 → 에이전트가 임의로 바꾸지 않는다.
   `npm run extract`는 reviewed 파일과 사람이 고친 파일(`_genHash` 불일치)을 자동으로 건너뛴다. `--force`는 사용자 허락 없이 쓰지 않는다.
5. 사용자가 입력한 출생연도·졸업연도 등은 **브라우저 밖으로 보내지 않는다**(서버 전송·로그·URL 쿼리 금지).
6. 데이터 스키마를 바꾸면 `scripts/validate.ts`, `scripts/extract_minwon.py`, 계획서 3장을 함께 고친다.

## 폴더
- `source/` 원본(읽기 전용) · `scripts/` 추출·검증 스크립트 · `data/` 민원·규칙·업무안내 JSON
- `public/pages/p{n}.webp` PDF 페이지 이미지(git 제외, `npm run render-pages`로 생성) · `public/forms/` 서식 파일(hwpx+pdf 짝, `민원/`·`공무원/`) — 민원 연결은 `data/forms_files.json`
- `src/` React 앱 (Vite + React + TypeScript)

## 쪽 번호
- JSON의 `sourcePages`, `pdfPages` = **PDF 물리 쪽수** (= MD의 `<!-- PAGE: n -->`, = `p{n}.webp`)
- 편람 인쇄 쪽수 = PDF 쪽수 − 10 (예: 졸업증명서 PDF 139쪽 = 인쇄 129쪽)

## 주요 데이터
- `data/minwon/M01~M96.json` 민원 96건 (스키마: `scripts/validate.ts`의 `Minwon`)
  - `forms[]` 서식별 PDF 쪽 · `infoPages` 서식 앞의 참고 안내 쪽 · `officerChecks` 담당공무원 확인사항
  - `documentsSource` 구비서류 출처(요약표 / 신청서에서 자동 추출 / 편람에 목록 없음)
  - `pdfTextPages` MD 변환에서 빠져 PDF 텍스트로 보충한 쪽 (화면에서는 원문 이미지 우선 표시)
- 실행 환경: 이 PC는 `python` 명령이 동작하지 않음 → `py` 또는 `npm run extract` 사용
- `data/rules/issuance_years.json` 연도별 발급경로 규칙. 셀 `s`: yes/no/partial/from/range/status/text
  - `from`+`status` 동시 존재 = "status에 해당하거나 from 이후" (예: 재직자 또는 2003년 이후 퇴직자)
  - 연월 비교는 'YYYY' 또는 'YYYY-MM' 문자열. 'YYYY'만 있으면 그해 1월로 간주
- `data/rules/identity.json` 방문자 유형 × 대상자 나이 → 구비서류
- `data/guides/G01~G37.json` II·III·IV·VI장 업무안내(markdown 원문)
- `data/synonyms.json` 검색 동의어
- `data/forms_files.json` 민원 ↔ 서식 파일 연결(사람이 관리). `form`=편람 서식 이름과 같으면 그 줄에, 없으면 `label`로 추가 서식. `common.위임장`은 신원 확인(대리인)에 표시. data/minwon 은 고치지 않고 build_data 에서 합침
- `data/manuals/` 발급 시스템 매뉴얼(민원 상세 「어디서 발급하나요?」)
  - `links.json` 민원 ↔ 매뉴얼 연결(사람이 관리): `neis` 나이스 매뉴얼 쪽 순서, `neisRefs`+`neisRefNote` 전용 화면이 없어 참고로 보여주는 쪽, `certSystem` 학교증명발급시스템 절차 이름, `checked` 담당자 확인, `_meta.systemOrder` 둘 다 가능할 때 먼저 보여줄 시스템
  - `neis.json`·`certsys.json` 매뉴얼 PDF에서 자동 추출(직접 고치지 않음) → `npm run render-manuals` (이미지는 `public/neis/`·`public/certsys/`, git 제외)
  - 매뉴얼 원본 PDF 2개는 `source/`에만 두고 git에 넣지 않음(.gitignore)

## 명령
- `npm run extract` — MD → data/minwon, data/guides 재생성 (reviewed=true 보호)
- `npm run render-pages` — PDF → public/pages
- `npm run render-manuals` — 나이스·학교증명발급시스템 매뉴얼 → data/manuals/*.json + public/neis·certsys 이미지
- `npm run validate` — 데이터 검증 (빌드 전 필수)
- `npm run dev` / `npm run build`
- `npm test` — `scripts/test.mjs`로 실행(드라이브 문자 소문자 `c:`·`h:`일 때 Vitest "failed to find the runner" 오류 회피). `npx vitest run` 직접 실행 금지
- `npm run backup` — git 기록 전체를 `minwon_manse.bundle` 하나로 묶어 구글 드라이브(기본 `E:\내 드라이브\antigravity\minwon_manse`)에 저장. 다른 폴더: `npm run backup -- "경로"`

## 작업 위치
- 원본 작업 폴더: 외장하드 `H:\dev\minwon_manse`(exFAT, 사무실·집 PC에서 같이 사용). 다른 PC에서는 드라이브 문자가 바뀔 수 있음
- exFAT이라 PC마다 처음 한 번 `git config --global --add safe.directory <드라이브>:/dev/minwon_manse` 필요
- `C:\dev\minwon_manse`는 옮기기 전 사본(2026-11-16) — 수정하지 않는다

## 작업 방식
- Phase 단위로, 그 안에서도 파일 단위로 작게 작업하고 끝날 때마다 `npm run validate` + 동작 확인.
- 판별기 로직은 Vitest 단위 테스트 필수 (경계값: 1951-02, 1982-02, 2002-02, 2003-02, 2003-03, 2013-02, 2014-03).

## 앱 구조 (Phase 2~)
- `scripts/build_data.ts` → `public/data/bundle.json` (git 제외, `npm run dev`/`build` 전에 자동 생성)
- `src/lib/search.ts` 검색 엔진(초성·동의어·두 글자 조각 부분일치, 전부 브라우저 안에서 실행) · 테스트 `src/lib/search.test.ts` (`npm test`)
  - 검색 품질을 바꾸면 반드시 `npm test` 통과 확인. 새 실무 표현은 테스트에 추가
- `src/lib/router.ts` 해시 라우팅: `#/?q=&c=` 검색, `#/m/M02` 민원, `#/g/G05` 업무안내
- `src/components/` SearchPage, MinwonDetail(창구형 상세), Issue(어디서 발급하나요 — 나이스/학교증명발급시스템 판정·처리 순서), GuideDetail(marked), PageViewer(원문 이미지·인쇄), ui(Mark·Step·Fold 등 공통 부품)
- 디자인 기준: `src/index.css` 상단 — 의미 색 `paper/sunk/surface/ink/ink-2/muted/line/line-strong/accent/mark`(bg-paper, text-ink …). 새 화면은 gray·slate 대신 의미 색을 쓴다. 빨강·초록·노랑은 판별 결과 전용
- 주의: `useEffect(() => window.scrollTo(...))` 처럼 값을 반환하는 축약형 금지 (최신 브라우저는 Promise 반환 → React 오류)
- 개발 서버: `npm run dev` (http://localhost:5173)

## 판별기 (Phase 3~)
- `src/lib/judge.ts` 규칙 해석: `judgeRule`(연도별 발급경로), `estimateGraduation`(출생연도→졸업 추정), `judgeIdentity`(신원 확인), `guideMessage`(안내 문구)
  - 판정: ok(가능) / no(불가) / check(확인 필요: △·학교별·경계 연도에서 월 모름·추정 범위가 갈림) / need(연도 입력 필요)
  - 월을 모르는데 기준 연도와 같은 해면 반드시 check — 추측해서 ok/no 내지 않는다
- `src/lib/judge.test.ts` 경계값 테스트. 규칙 JSON을 고치면 `npm test`로 확인
- 화면: `src/components/Judge.tsx` (IssuanceJudge, IdentityJudge, JudgePage `#/judge`), 민원 상세에 자동 삽입(yearRuleIds 있는 민원)
- 입력값(연도·나이·생년월일)은 컴포넌트 상태에만 — 주소(해시)·localStorage·서버에 넣지 않는다
