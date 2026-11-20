// data/ JSON 구조 (scripts/validate.ts 스키마와 동일하게 유지)

export interface Form {
  name: string;
  /** 편람 PDF 쪽(원문 보기·인쇄) */
  pdfPages: number[];
  /** 서식 파일(public/forms 기준 경로) — data/forms_files.json 에서 묶음 만들 때 합침 */
  hwp: string | null;
  pdf?: string;
  /** 편람 서식 목록에 없는 추가 서식 파일 */
  extra?: boolean;
}

export interface FormFile {
  name: string;
  hwp: string;
  pdf: string;
}

export interface Minwon {
  id: string;
  no: number;
  title: string;
  category: string;
  aliases: string[];
  summary: string;
  receivers: string[];
  fee: string;
  methods: string[];
  documents: string[];
  documentsSource: string;
  officerChecks: string[];
  dept: string;
  ledger: string;
  approval: string;
  period: string;
  laws: string[];
  process: { channel: string; steps: string[] }[];
  notes: string[];
  guideScript: string;
  yearRuleIds: string[];
  forms: Form[];
  infoPages: number[];
  sourcePages: number[];
  pdfTextPages: number[];
  reviewed: boolean;
  /** 검색 전용 본문(표 기호 제거한 원문 텍스트) */
  body: string;
}

export interface Guide {
  id: string;
  chapter: string;
  title: string;
  sourcePages: number[];
  pdfTextPages: number[];
  markdown: string;
  reviewed: boolean;
  body: string;
}

export type CellState = "yes" | "no" | "partial" | "from" | "range" | "status" | "text";

export interface RuleCell {
  s: CellState;
  from?: string;
  to?: string;
  status?: string[];
  note?: string;
}

export interface Rule {
  label: string;
  group: string;
  basis: string;
  minwonIds: string[];
  cells: Record<string, RuleCell>;
  notes: string[];
}

export interface Channel {
  id: string;
  label: string;
  group: string;
}

export interface IdentityCase {
  id: string;
  visitor: string;
  subject: string;
  match: { visitor: "self" | "guardian" | "proxy"; subjectAgeMin?: number; subjectAgeMax?: number };
  documents: string[];
  /** true면 이 조합으로는 신청 불가 → message 안내 */
  denied?: boolean;
  message?: string;
  /** 편람 표가 아닌 실무 기준 등 출처 표시 */
  source?: string;
}

export interface IdentityRules {
  basis: string[];
  cases: IdentityCase[];
  unmatched: { case: string; note: string }[];
  reviewed: boolean;
}

/* ───────── 발급 시스템 매뉴얼 (data/manuals) ───────── */

export type SystemId = "neis" | "certSystem";

export interface ManualLink {
  /** 나이스 매뉴얼 쪽(PDF 물리 쪽수) — 나이스에서 거치는 화면 순서 */
  neis?: number[];
  /** 전용 화면이 없어 같은 방식의 다른 증명서 화면을 참고로 보여주는 쪽 */
  neisRefs?: number[];
  neisRefNote?: string;
  /** 학교증명발급시스템 절차 이름 (certsys.sections 의 키) */
  certSystem?: string;
  /** 담당자 확인 내용 */
  checked?: string;
}

export interface NeisPage {
  page: number;
  title: string;
  overview: string;
  menuPath: string[];
  image: string;
  width: number;
  height: number;
  markers: { n: number; x: number; y: number }[];
  items: { n: number; text: string; subs: string[] }[];
}

export interface CertStep {
  title: string;
  lines: string[];
  shots: { image: string; width: number; height: number }[];
  pages: number[];
  printed: (number | null)[];
}

export interface Manuals {
  /** 둘 다 가능할 때 먼저 보여줄 순서 */
  order: SystemId[];
  reviewed: boolean;
  links: Record<string, ManualLink>;
  neis: { source: string; pages: NeisPage[] };
  certsys: { source: string; sections: Record<string, { title: string; steps: CertStep[] }> };
}

export interface Bundle {
  version: string;
  /** 편람 판 이름 (예: "2026 개정판") — data/edition.json */
  edition: string;
  /** PDF 쪽 − 편람 인쇄 쪽 — data/edition.json */
  printedPageOffset: number;
  builtAt: string;
  minwon: Minwon[];
  guides: Guide[];
  rules: { channels: Channel[]; rules: Record<string, Rule>; reviewed: boolean };
  identity: IdentityRules;
  synonyms: Record<string, string[]>;
  manuals: Manuals;
  /** 여러 민원에 공통으로 쓰는 서식(예: 위임장) */
  formsCommon?: Record<string, FormFile>;
  /** 서식함 — public/forms 폴더 전체 */
  formsLibrary?: { groups: string[]; items: LibraryForm[] };
}

export interface LibraryForm {
  name: string;
  /** 공무원 서식 번호 (예: "서식 11-2") */
  no: string | null;
  folder: string;
  group: string;
  hwp: string;
  pdf: string | null;
  keywords: string[];
  /** 이 서식을 쓰는 민원 ID (data/forms_files.json) */
  minwon: string[];
  /** 여러 민원 공통(예: 위임장) */
  common: boolean;
}
