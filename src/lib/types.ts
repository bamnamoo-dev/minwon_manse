// data/ JSON 구조 (scripts/validate.ts 스키마와 동일하게 유지)

export interface Form {
  name: string;
  pdfPages: number[];
  hwp: string | null;
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
}

export interface IdentityRules {
  basis: string[];
  cases: IdentityCase[];
  unmatched: { case: string; note: string }[];
  reviewed: boolean;
}

export interface Bundle {
  version: string;
  builtAt: string;
  minwon: Minwon[];
  guides: Guide[];
  rules: { channels: Channel[]; rules: Record<string, Rule>; reviewed: boolean };
  identity: IdentityRules;
  synonyms: Record<string, string[]>;
}
