/**
 * 판별기 — 연도별 발급경로(data/rules/issuance_years.json), 신청인 신원 확인(data/rules/identity.json)
 * 규칙 데이터만 해석하고, 연도·서류 같은 민원 내용은 코드에 넣지 않는다.
 * 입력값(연도·나이)은 화면 안에서만 쓰이고 저장·전송하지 않는다.
 */
import type { Channel, IdentityRules, Rule, RuleCell } from "./types";

/* ---------------- 연월 ---------------- */

export interface Ym {
  year: number;
  /** 1~12, 모르면 undefined */
  month?: number;
}

/** "2003-02" / "2003" → 비교용 숫자 (연만 있으면 그해 1월) */
export function ymValue(s: string): { v: number; hasMonth: boolean } {
  const [y, m] = s.split("-").map(Number);
  return { v: y * 12 + ((m || 1) - 1), hasMonth: !!m };
}

export const fmtYm = (s?: string) =>
  !s ? "" : s.length === 4 ? `${s}년` : `${s.slice(0, 4)}년 ${Number(s.slice(5))}월`;

/* ---------------- 연도별 발급경로 ---------------- */

export type Verdict = "ok" | "no" | "check" | "need";

export interface CellResult {
  channel: Channel;
  verdict: Verdict;
  reason: string;
}

export interface JudgeInput {
  /** 기준 연월(졸업·제적·합격·퇴직 등). 여러 개면 "추정 범위"(예: 빠른년생) — 결과가 갈리면 '확인 필요' */
  dates: Ym[];
  /** 해당하는 신분 (재학생, 재학생(졸업예정자), 재직자, 퇴직예정자) */
  statuses: string[];
}

/** 연월 하나와 기준(from/to) 비교: 월을 모르는데 경계 연도면 판단 보류 */
function cmp(d: Ym, bound: string): -1 | 0 | 1 | null {
  const b = ymValue(bound);
  const by = Math.floor(b.v / 12);
  if (d.month === undefined) {
    if (d.year < by) return -1;
    if (d.year > by) return 1;
    return b.hasMonth ? null : 0; // 같은 해 + 기준에 월이 있으면 월을 알아야 함
  }
  const v = d.year * 12 + d.month - 1;
  return v < b.v ? -1 : v > b.v ? 1 : 0;
}

function dateVerdict(c: RuleCell, d: Ym): Verdict {
  if (c.s === "from") {
    const r = cmp(d, c.from!);
    return r === null ? "check" : r >= 0 ? "ok" : "no";
  }
  if (c.s === "range") {
    const a = cmp(d, c.from!);
    const b = cmp(d, c.to!);
    if (a === null || b === null) return a === -1 || b === 1 ? "no" : "check";
    return a >= 0 && b <= 0 ? "ok" : "no";
  }
  return "check";
}

export function judgeCell(c: RuleCell | undefined, input: JudgeInput): { verdict: Verdict; reason: string } {
  const note = c?.note ? ` — ${c.note}` : "";
  if (!c) return { verdict: "check", reason: "규칙 없음" };
  const statusHit = c.status?.find((s) => input.statuses.includes(s));
  switch (c.s) {
    case "yes":
      return { verdict: "ok", reason: "연도 제한 없음" + note };
    case "no":
      return { verdict: "no", reason: "이 방법으로는 발급 불가" + note };
    case "partial":
      return { verdict: "check", reason: (c.note ?? "일부 가능") + " (해당 학교·기관에 확인)" };
    case "text":
      return { verdict: "check", reason: c.note ?? "" };
    case "status":
      if (statusHit) return { verdict: "ok", reason: `${statusHit}이므로 가능` + note };
      return { verdict: "no", reason: `${c.status!.join("·")}만 가능` + note };
    case "from":
    case "range": {
      if (statusHit) return { verdict: "ok", reason: `${statusHit}이므로 가능` + note };
      const range = c.s === "from" ? `${fmtYm(c.from)} 이후` : `${fmtYm(c.from)} ~ ${fmtYm(c.to)}`;
      if (!input.dates.length) return { verdict: "need", reason: `${range}만 가능 — 연도를 입력하세요` + note };
      const vs = input.dates.map((d) => dateVerdict(c, d));
      const all = new Set(vs);
      if (all.size === 1 && !all.has("check")) {
        const v = vs[0];
        return { verdict: v, reason: (v === "ok" ? `${range} 해당` : `${range}만 가능`) + note };
      }
      return { verdict: "check", reason: `${range}만 가능 — 경계 연도라 정확한 연월 확인 필요` + note };
    }
  }
}

export function judgeRule(rule: Rule, channels: Channel[], input: JudgeInput): CellResult[] {
  return channels.map((ch) => ({ channel: ch, ...judgeCell(rule.cells[ch.id], input) }));
}

/** 이 규칙에 연월 입력이 필요한지, 어떤 신분 선택지가 있는지 */
export function ruleNeeds(rule: Rule): { needsDate: boolean; basisLabel: string; statuses: string[] } {
  const cells = Object.values(rule.cells);
  const needsDate = cells.some((c) => c.s === "from" || c.s === "range");
  const statuses = [...new Set(cells.flatMap((c) => c.status ?? []))];
  return { needsDate, basisLabel: rule.basis, statuses };
}

/* ---------------- 출생연도 → 졸업연도 추정 ---------------- */

export type SchoolLevel = "초" | "중" | "고";
const GRAD_OFFSET: Record<SchoolLevel, number> = { 초: 13, 중: 16, 고: 19 };

/**
 * 출생연도로 졸업연월(2월) 추정. 정규 진학 기준이며 유급·조기입학·검정고시 등은 반영하지 못한다.
 * 1~2월생("빠른년생")은 2008년까지 한 해 일찍 입학할 수 있었으므로 한 해 앞도 후보로 둔다
 * (생월을 모르면 1~2월생 가능성을 포함).
 */
export function estimateGraduation(birthYear: number, level: SchoolLevel, birthMonth?: number): Ym[] {
  const y = birthYear + GRAD_OFFSET[level];
  const early = (birthMonth === undefined || birthMonth <= 2) && birthYear <= 2002;
  return early ? [{ year: y - 1, month: 2 }, { year: y, month: 2 }] : [{ year: y, month: 2 }];
}

/* ---------------- 신청인 신원 확인(대리 발급) ---------------- */

export type Visitor = "self" | "guardian" | "proxy";

/** 만 나이 (기준일 today) */
export function manAge(birth: { year: number; month: number; day: number }, today = new Date()): number {
  let age = today.getFullYear() - birth.year;
  const m = today.getMonth() + 1;
  if (m < birth.month || (m === birth.month && today.getDate() < birth.day)) age--;
  return age;
}

export function judgeIdentity(rules: IdentityRules, visitor: Visitor, age: number) {
  const hit = rules.cases.find(
    (c) =>
      c.match.visitor === visitor &&
      (c.match.subjectAgeMin === undefined || age >= c.match.subjectAgeMin) &&
      (c.match.subjectAgeMax === undefined || age <= c.match.subjectAgeMax),
  );
  if (hit) return { matched: true as const, case: hit };
  const label = visitor === "self" ? "본인" : visitor === "guardian" ? "법정대리인" : "대리인";
  const note = rules.unmatched.find((u) => u.case.startsWith(label))?.note ?? "편람 표에 없는 경우 — 담당자 확인 필요";
  return { matched: false as const, note };
}

/* ---------------- 안내 멘트 ---------------- */

const EASY_ORDER = ["gov24Online", "kiosk", "neis", "certSystem", "faxEdu", "faxGu", "gov24Mail", "mail"];

export function guideMessage(rule: Rule, results: CellResult[], basisText: string): string {
  const ok = results.filter((r) => r.verdict === "ok").sort((a, b) => EASY_ORDER.indexOf(a.channel.id) - EASY_ORDER.indexOf(b.channel.id));
  const check = results.filter((r) => r.verdict === "check");
  const no = results.filter((r) => r.verdict === "no");
  const lines: string[] = [];
  lines.push(`[${rule.label}] ${basisText}`);
  if (ok.length) lines.push(`○ 발급 가능: ${ok.map((r) => r.channel.label).join(", ")}`);
  if (check.length) lines.push(`△ 확인 필요: ${check.map((r) => r.channel.label).join(", ")}`);
  if (no.length) lines.push(`× 발급 불가: ${no.map((r) => r.channel.label).join(", ")}`);
  if (!ok.length && !check.length) lines.push("안내 가능한 발급 방법이 없습니다. 담당 부서에 확인해 주세요.");
  lines.push("※ 방문 시 신분증을 지참해 주세요. 대리인은 위임장 등이 필요합니다.");
  return lines.join("\n");
}
