import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppData } from "../lib/data";
import { printedPage } from "../lib/data";
import {
  estimateGraduation,
  fmtYm,
  judgeRule,
  ruleNeeds,
  type CellResult,
  type SchoolLevel,
  type Verdict,
  type Ym,
} from "../lib/judge";
import type { Minwon, Rule, RuleCell } from "../lib/types";
import { ArrowRightIcon, FileTextIcon } from "./Icons";
import { IdentityJudge } from "./Judge";
import { PageViewer } from "./PageViewer";

/*
 * 디자인 시안 비교 화면 (#/lab/M07) — docs/디자인_개편계획.md
 * - 배치: 창구 응대형(민원인을 앞에 두고 한 화면에서 답한다). 덜 쓰는 정보는 접어 둔다.
 * - 톤: index.css 의 [data-tone] 변수만 바꿔 같은 화면을 3가지 색감으로 비교
 * - ③ 어디서 발급: 연도표 규칙(neis / certSystem 칸)으로 나이스·학교증명발급시스템 중 어디서 발급하는지 판정하고
 *   해당 시스템 매뉴얼의 처리 순서를 보여준다.
 *     나이스: scripts/render_neis.py → public/neis/sample.json
 *     학교증명발급시스템: scripts/render_certsys.py → public/certsys/flow.json   (둘 다 자동 추출, 검수 전 예시)
 * - 입력한 연도는 이 컴포넌트 상태에만 있다(주소·저장소·서버로 보내지 않음).
 */

type Tone = "ink" | "teal" | "mono";
const TONES: [Tone, string][] = [
  ["ink", "A 잉크"],
  ["teal", "B 청록"],
  ["mono", "C 흑백"],
];

/** 처리 시스템으로 보는 연도표 칸 (규칙 데이터의 channel id) */
const SYSTEMS = [
  { id: "neis", name: "나이스" },
  { id: "certSystem", name: "학교증명발급시스템" },
] as const;
type SystemId = (typeof SYSTEMS)[number]["id"];

interface NeisPage {
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
interface NeisSample {
  links: Record<string, number[]>;
  /** 매뉴얼에 전용 화면이 없어 같은 방식의 다른 증명서 화면을 참고로 보여주는 쪽 */
  refs?: Record<string, number[]>;
  pages: NeisPage[];
}
interface Shot {
  image: string;
  width: number;
  height: number;
}
interface CertFlow {
  title: string;
  links: string[];
  steps: { title: string; lines: string[]; shots: Shot[]; pages: number[]; printed: (number | null)[] }[];
}

function useJson<T>(path: string): T | null | undefined {
  const [v, setV] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}${path}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setV, () => setV(null));
  }, [path]);
  return v;
}

export function LabPage({ data, id }: { data: AppData; id?: string }) {
  const [tone, setTone] = useState<Tone>(() => {
    const t = new URLSearchParams(window.location.hash.split("?")[1]).get("tone");
    return TONES.some(([v]) => v === t) ? (t as Tone) : "ink";
  });
  const [viewer, setViewer] = useState<number[] | null>(null);
  const neis = useJson<NeisSample>("neis/sample.json");
  const cert = useJson<CertFlow>("certsys/flow.json");

  const picks = ["M07", "M02", "M01", "M08"].filter((x) => data.minwonById.has(x));
  const m = data.minwonById.get(id ?? "M07") ?? data.minwonById.get(picks[0])!;
  const rule = m.yearRuleIds.map((r) => data.bundle.rules.rules[r]).find(Boolean);

  const neisPages = (neis?.links[m.id] ?? []).map((p) => neis!.pages.find((x) => x.page === p)).filter(Boolean) as NeisPage[];
  const neisRefs = neis?.refs?.[m.id] ?? [];
  const certFlow = cert && cert.links.includes(m.id) ? cert : null;
  const loading = neis === undefined || cert === undefined;

  return (
    <div data-tone={tone} className="lab min-h-[calc(100vh-3.5rem)] pb-20">
      {/* 시안 도구 막대 — 실제 화면에는 없음 */}
      <div className="border-b border-dashed border-[var(--line)] bg-[var(--sunk)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 text-[13px] sm:px-6">
          <span className="font-semibold text-[var(--muted)]">디자인 시안</span>
          <Seg value={tone} onChange={setTone} options={TONES} />
          <span className="text-[var(--line-strong)]">|</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {picks.map((x) => (
              <a
                key={x}
                href={`#/lab/${x}`}
                className={x === m.id ? "font-semibold text-[var(--ink)] underline underline-offset-4" : "text-[var(--muted)] hover:text-[var(--ink)]"}
              >
                {data.minwonById.get(x)!.title.replace(/ 신청$/, "")}
              </a>
            ))}
          </div>
          <a href={`#/m/${m.id}`} className="ml-auto text-[var(--muted)] hover:text-[var(--ink)]">
            현재 화면과 비교 →
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Head m={m} onSource={() => setViewer(m.sourcePages)} />

        <div className="mt-8 grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* 왼쪽: 창구에서 바로 답할 것 */}
          <div className="min-w-0 space-y-10">
            <Step n={1} title="누가 왔나요?" note="신원 확인 서류">
              <div className="lab-judge">
                <IdentityJudge data={data} compact />
              </div>
            </Step>

            {m.notes.length > 0 && (
              <Step n={2} title="주의할 점" note={`편람 참고사항 ${m.notes.length}`}>
                <ul className="space-y-2 text-[15px] leading-relaxed">
                  {m.notes.map((x, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-[0.7em] h-px w-2.5 shrink-0 bg-[var(--ink)]" />
                      <span className="break-keep">{x}</span>
                    </li>
                  ))}
                </ul>
              </Step>
            )}
          </div>

          {/* 오른쪽: 어디서·어떻게 발급 */}
          <div className="min-w-0">
            <Step n={3} title="어디서 발급하나요?" note={rule ? `기준: ${rule.basis}` : undefined}>
              {loading ? (
                <p className="text-sm text-[var(--muted)]">불러오는 중…</p>
              ) : (
                <WhereToIssue key={m.id} data={data} rule={rule} neisPages={neisPages} neisRefs={neisRefs} certTitle={m.title.replace(/ 신청$/, "")} certFlow={certFlow} />
              )}
            </Step>
          </div>
        </div>

        {/* 덜 쓰는 정보: 접어 둠 */}
        <div className="mt-14 border-t border-[var(--line)]">
          {m.process.length > 0 && (
            <Fold title="다른 신청 방법" hint={m.process.map((p) => p.channel || "처리").join(" · ")}>
              <div className="space-y-4">
                {m.process.map((p, i) => (
                  <div key={i} className="grid gap-1 sm:grid-cols-[88px_1fr]">
                    <div className="text-sm font-semibold">{p.channel || "처리"}</div>
                    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[var(--ink-2)]">
                      {p.steps.map((s, j) => (
                        <li key={j} className="flex items-center gap-1.5">
                          {s}
                          {j < p.steps.length - 1 && <ArrowRightIcon size={12} className="text-[var(--muted)]" />}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </Fold>
          )}
          <Fold title="서식" hint={m.forms.length ? m.forms.map((f) => f.name).join(", ") : "붙임 서식 없음"}>
            <ul className="divide-y divide-[var(--line)] text-sm">
              {m.forms.map((f, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <span className="flex-1">{f.name}</span>
                  <button type="button" className="lab-link" onClick={() => setViewer(f.pdfPages)} disabled={!f.pdfPages.length}>
                    원문 보기
                  </button>
                </li>
              ))}
            </ul>
          </Fold>
          <Fold title="처리 정보 · 관련 법령" hint={[m.dept, m.approval && `최종결재 ${m.approval}`].filter(Boolean).join(" · ")}>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[88px_1fr]">
              <dt className="text-[var(--muted)]">처리과</dt>
              <dd>{m.dept || "-"}</dd>
              <dt className="text-[var(--muted)]">공부대조</dt>
              <dd>{m.ledger || "-"}</dd>
              <dt className="text-[var(--muted)]">최종결재</dt>
              <dd>{m.approval || "-"}</dd>
              <dt className="text-[var(--muted)]">관련근거</dt>
              <dd className="space-y-1">{m.laws.length ? m.laws.map((l, i) => <div key={i}>{l}</div>) : "-"}</dd>
            </dl>
          </Fold>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">
          출처: 서울특별시교육청 「민원편람」 2025 · 인쇄 {printedPage(m.sourcePages[0])}~{printedPage(m.sourcePages.at(-1)!)}쪽 · 발급 연도 기준
          편람 47~48쪽(인쇄 37~38쪽)
          {neisPages.length > 0 && ` · 나이스 민원 사용자매뉴얼 ${neisPages.map((p) => p.page).join("·")}쪽`}
          {certFlow && ` · 학교증명발급시스템 사용자 매뉴얼(2017) 인쇄 6~11쪽`}
          {(neisPages.length > 0 || certFlow) && " (매뉴얼은 자동 추출 예시, 검수 전)"}
        </p>
      </div>

      {viewer && <PageViewer title={`${m.title} — 편람 원문`} pages={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

/* ───────── 머리: 민원명 + 창구에서 바로 말할 3가지 ───────── */
function Head({ m, onSource }: { m: Minwon; onSource: () => void }) {
  return (
    <header className="pt-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
        <span>{m.category}</span>
        <span>민원 {m.no}</span>
        {!m.reviewed && <span>검수 전 데이터</span>}
        <button type="button" onClick={onSource} className="lab-link ml-auto inline-flex items-center gap-1">
          <FileTextIcon size={13} />
          편람 {printedPage(m.sourcePages[0])}쪽
        </button>
      </div>
      <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">{m.title.replace(/ 신청$/, "")}</h1>

      <dl className="mt-6 grid border-y border-[var(--line)] sm:grid-cols-3">
        <Fact label="처리기간" value={m.period || "-"} accent={m.period === "즉시"} />
        <Fact label="수수료" value={m.fee || "-"} />
        <Fact label="준비물" value={m.documents.join(", ") || "-"} small />
      </dl>
    </header>
  );
}

function Fact({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-[var(--line)] py-3 first:border-t-0 sm:block sm:border-l sm:border-t-0 sm:py-3.5 sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd
        className={`break-keep text-right font-semibold tracking-[-0.01em] sm:mt-1 sm:text-left ${
          small ? "text-base leading-snug sm:text-lg" : "text-xl sm:text-2xl"
        } ${accent ? "text-[var(--accent)]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

/* ───────── ③ 어디서 발급: 연도 입력 → 시스템 판정 → 그 시스템의 처리 순서 ───────── */
const inputCls =
  "rounded-[5px] border border-[var(--line-strong)] bg-white px-2.5 py-1.5 text-[15px] outline-none focus:border-[var(--ink)]";

const MARK: Record<Verdict, { sym: string; label: string; cls: string }> = {
  ok: { sym: "○", label: "발급", cls: "text-emerald-700" },
  check: { sym: "△", label: "확인 필요", cls: "text-amber-700" },
  need: { sym: "–", label: "연도 입력", cls: "text-[var(--muted)]" },
  no: { sym: "×", label: "해당 없음", cls: "text-[var(--muted)]" },
};

/** 규칙 칸 → 사람이 읽는 조건 (예: "2003년 2월 이후 졸업") */
function cond(c: RuleCell | undefined, basis: string): string {
  if (!c) return "";
  const word = basis.replace(/연월|연도|상태/, "");
  if (c.s === "from") return `${fmtYm(c.from)} 이후 ${word}${c.status ? ` 또는 ${c.status.join("·")}` : ""}`;
  if (c.s === "range") return `${fmtYm(c.from)} ~ ${fmtYm(c.to)} ${word}`;
  if (c.s === "status") return `${c.status!.join("·")}만`;
  if (c.s === "yes") return "연도 제한 없음";
  return c.note ?? "";
}

function WhereToIssue({
  data,
  rule,
  neisPages,
  neisRefs,
  certTitle,
  certFlow,
}: {
  data: AppData;
  rule?: Rule;
  neisPages: NeisPage[];
  neisRefs: number[];
  certTitle: string;
  certFlow: CertFlow | null;
}) {
  const channels = data.bundle.rules.channels;
  const needs = useMemo(() => (rule ? ruleNeeds(rule) : null), [rule]);

  const [mode, setMode] = useState<"grad" | "birth">("grad");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [level, setLevel] = useState<SchoolLevel>("고");
  const [statuses, setStatuses] = useState<string[]>([]);
  // 담당자가 직접 고른 시스템 — 입력이 바뀌면 다시 자동 판정을 따른다
  const [picked, setPicked] = useState<{ key: string; id: SystemId } | null>(null);

  const valid = (s: string) => /^\d{4}$/.test(s) && +s >= 1900 && +s <= 2100;
  const dates: Ym[] = useMemo(() => {
    if (!needs?.needsDate) return [];
    if (mode === "birth") return valid(birthYear) ? estimateGraduation(+birthYear, level, birthMonth ? +birthMonth : undefined) : [];
    return valid(year) ? [{ year: +year, month: month ? +month : undefined }] : [];
  }, [needs, mode, birthYear, birthMonth, level, year, month]);

  const results: CellResult[] = useMemo(
    () => (rule ? judgeRule(rule, channels, { dates, statuses }) : []),
    [rule, channels, dates, statuses],
  );
  const byId = (cid: string) => results.find((r) => r.channel.id === cid);

  // 이 민원에서 쓰일 수 있는 처리 시스템 (규칙에서 '불가'로 막힌 시스템은 뺀다)
  const systems = rule ? SYSTEMS.filter((s) => rule.cells[s.id] && rule.cells[s.id].s !== "no") : [SYSTEMS[0]];
  const hasInput = dates.length > 0 || statuses.length > 0;
  const okSystems = systems.filter((s) => byId(s.id)?.verdict === "ok");
  const hasFlow = (sid: SystemId) => (sid === "neis" ? neisPages.length > 0 : !!certFlow);
  // 둘 다 가능하면 나이스 먼저 (실무에서 주로 나이스로 처리 — 담당자 확인 2026-11-16, SYSTEMS 순서)
  const auto: SystemId | undefined = (
    okSystems[0] ??
    systems.find((s) => byId(s.id)?.verdict === "check") ??
    systems.find((s) => hasFlow(s.id)) ??
    systems[0]
  )?.id;
  const inputKey = JSON.stringify([dates, statuses]);
  const current = picked && picked.key === inputKey && systems.some((s) => s.id === picked.id) ? picked.id : auto;
  const noneFits = hasInput && systems.length > 0 && systems.every((s) => byId(s.id)?.verdict === "no");

  const others = results.filter((r) => !SYSTEMS.some((s) => s.id === r.channel.id));

  return (
    <div>
      {/* 입력 */}
      {needs?.needsDate && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <Seg
            value={mode}
            onChange={setMode}
            options={[
              ["grad", rule!.basis.replace("연월", "연도")],
              ["birth", "출생연도로 추정"],
            ]}
          />
          {mode === "grad" ? (
            <span className="flex items-center gap-1.5">
              <input
                className={inputCls + " w-[5.5rem] tabular-nums"}
                inputMode="numeric"
                maxLength={4}
                placeholder="예: 1998"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                aria-label={`${rule!.basis} 연도`}
              />
              년
              <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="월">
                <option value="">월 모름</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}월
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              <input
                className={inputCls + " w-[5.5rem] tabular-nums"}
                inputMode="numeric"
                maxLength={4}
                placeholder="예: 1980"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
                aria-label="출생연도"
              />
              년생
              <select className={inputCls} value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} aria-label="출생월">
                <option value="">생월 모름</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}월생
                  </option>
                ))}
              </select>
              <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as SchoolLevel)} aria-label="학교급">
                <option value="초">초등학교</option>
                <option value="중">중학교</option>
                <option value="고">고등학교</option>
              </select>
            </span>
          )}
        </div>
      )}
      {needs && needs.statuses.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px]">
          {needs.statuses.map((s) => (
            <label key={s} className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--ink)]"
                checked={statuses.includes(s)}
                onChange={(e) => setStatuses((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))}
              />
              {s}
            </label>
          ))}
        </div>
      )}
      {mode === "birth" && dates.length > 0 && (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-2)]">
          추정 {rule!.basis}: <b>{dates.map((d) => `${d.year}년 ${d.month}월`).join(" 또는 ")}</b> — 정규 진학 기준 추정이라 유급·조기입학·검정고시
          등은 반영되지 않습니다. 확실한 졸업연도를 확인하세요.
        </p>
      )}

      {/* 시스템 판정 */}
      {rule && systems.length > 0 && (
        <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {systems.map((s) => {
            const r = byId(s.id);
            const v = MARK[r?.verdict ?? "need"];
            const on = current === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setPicked({ key: inputKey, id: s.id })}
                className={`flex w-full cursor-pointer items-baseline gap-3 py-3 text-left transition-colors ${
                  on ? "" : "opacity-60 hover:opacity-100"
                }`}
              >
                <span className={`w-5 shrink-0 text-center text-lg font-bold leading-none ${v.cls}`}>{hasInput ? v.sym : "·"}</span>
                <span className="min-w-0 flex-1">
                  <span className={`text-[17px] font-bold ${on ? "underline decoration-2 underline-offset-[6px]" : ""}`}>{s.name}</span>
                  <span className="ml-2.5 text-[13.5px] text-[var(--ink-2)]">{cond(rule.cells[s.id], rule.basis)}</span>
                </span>
                {hasInput && <span className={`shrink-0 text-[13px] font-semibold ${v.cls}`}>{v.label}</span>}
              </button>
            );
          })}
        </div>
      )}
      {okSystems.length > 1 && (
        <p className="mt-2.5 text-[13px] text-[var(--ink-2)]">두 시스템 모두 발급 가능한 연도입니다. 나이스 처리 순서를 먼저 보여줍니다 — 이름을 누르면 바뀝니다.</p>
      )}
      {noneFits && (
        <p className="mt-3 border-l-2 border-amber-600 pl-3 text-sm leading-relaxed">
          나이스·학교증명발급시스템 모두 해당하지 않는 연도입니다. 학적부 보관 기관·발급 방법을 담당 부서에 확인하세요.
        </p>
      )}
      {!hasInput && rule && needs?.needsDate && (
        <p className="mt-2.5 text-[13px] text-[var(--muted)]">연도를 넣으면 어느 시스템에서 발급하는지 표시됩니다. 입력값은 저장되지 않습니다.</p>
      )}

      {/* 처리 순서 */}
      <div className="mt-7">
        {current === "certSystem" ? (
          certFlow ? (
            <CertFlowView flow={certFlow} />
          ) : (
            <Empty>학교증명발급시스템 매뉴얼 예시 데이터가 없습니다. py scripts/render_certsys.py 를 실행하세요.</Empty>
          )
        ) : neisPages.length ? (
          <NeisFlow pages={neisPages} refs={neisRefs} certTitle={certTitle} />
        ) : (
          <Empty>이 민원은 아직 나이스 매뉴얼 화면이 연결되지 않았습니다. (시안: 학생 민원 4건에만 연결됨)</Empty>
        )}
      </div>

      {/* 다른 발급 경로 (민원인이 다음에 이용할 곳) */}
      {rule && others.length > 0 && (
        <Fold title="다른 발급 경로" hint="정부24 · 무인발급기 · FAX · 우편">
          <ul className="space-y-1.5 text-sm">
            {others.map((r) => {
              const v = MARK[r.verdict];
              return (
                <li key={r.channel.id} className="flex items-baseline gap-2.5">
                  <span className={`w-4 shrink-0 text-center font-bold ${v.cls}`}>{hasInput || r.verdict !== "need" ? v.sym : "·"}</span>
                  <span className="w-44 shrink-0 font-medium">{r.channel.label}</span>
                  <span className="text-[var(--ink-2)]">{cond(rule.cells[r.channel.id], rule.basis)}</span>
                </li>
              );
            })}
          </ul>
        </Fold>
      )}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="border-l-2 border-[var(--line-strong)] pl-4 text-sm leading-relaxed text-[var(--muted)]">{children}</div>;
}

/* ───────── 단계 표식: 나이스 매뉴얼의 ❶❷❸ 과 같은 모양 ───────── */
export function Mark({ n, active, size = 22 }: { n: number; active?: boolean; size?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums leading-none ${
        active ? "bg-[var(--mark)] text-white" : "bg-[var(--ink)] text-[var(--paper)]"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {n}
    </span>
  );
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <Mark n={n} />
        <h2 className="text-lg font-bold tracking-[-0.01em]">{title}</h2>
        {note && <span className="ml-auto text-xs text-[var(--muted)]">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Fold({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <details className="group border-b border-[var(--line)]">
      <summary className="flex cursor-pointer list-none items-baseline gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="w-3 text-[var(--muted)] transition-transform group-open:rotate-90">›</span>
        <span className="shrink-0 font-semibold">{title}</span>
        {hint && <span className="min-w-0 truncate text-sm text-[var(--muted)]">{hint}</span>}
      </summary>
      <div className="pb-5 pl-6">{children}</div>
    </details>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex gap-3">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`cursor-pointer ${v === value ? "font-semibold text-[var(--ink)] underline underline-offset-4" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 처리 순서 탭: ① 화면A → ② 화면B … */
function StepTabs({ titles, value, onChange }: { titles: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {titles.map((t, i) => (
        <li key={i} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(i)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-[5px] px-1.5 py-1 transition-colors ${
              i === value ? "bg-[var(--sunk)] font-semibold" : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Mark n={i + 1} size={17} active={i === value} />
            {t}
          </button>
          {i < titles.length - 1 && <ArrowRightIcon size={11} className="text-[var(--line-strong)]" />}
        </li>
      ))}
    </ol>
  );
}

/* ───────── 나이스 화면 흐름: 화면 탭 → 캡처(표식 강조) + 번호 설명 ───────── */
function NeisFlow({ pages, refs, certTitle }: { pages: NeisPage[]; refs: number[]; certTitle: string }) {
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const p = pages[Math.min(pi, pages.length - 1)];
  const isRef = refs.includes(p.page);
  const tabTitle = (x: NeisPage) => (refs.includes(x.page) ? `${certTitle} 발급정보` : x.title);

  return (
    <div>
      <SystemTitle name="나이스" source={`나이스 민원 사용자매뉴얼 ${p.page}쪽`} />
      <StepTabs
        titles={pages.map(tabTitle)}
        value={pi}
        onChange={(i) => {
          setPi(i);
          setSel(null);
        }}
      />

      {isRef && (
        <p className="mt-4 border-l-2 border-[var(--mark)] pl-3 text-[13.5px] leading-relaxed">
          매뉴얼에 {certTitle} 화면은 따로 없습니다. 생활기록부·재학증명서와 같은 방법으로 발급하므로 <b>{p.title}</b> 화면을 참고로
          보여줍니다. <span className="text-[var(--muted)]">(담당자 확인 2026-11-16)</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-1.5 font-mono text-[12.5px] text-[var(--ink-2)]">
        {p.menuPath.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[var(--muted)]">›</span>}
            <span className={i === p.menuPath.length - 1 ? "font-semibold text-[var(--ink)]" : ""}>{s}</span>
          </span>
        ))}
      </div>

      <div className="relative mt-2 overflow-hidden rounded-md border border-[var(--line)] bg-white">
        <img src={`${import.meta.env.BASE_URL}${p.image}`} alt={`${p.title} 화면`} className="block w-full" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
        {p.markers.map((mk) => (
          <button
            key={mk.n}
            type="button"
            onClick={() => setSel(sel === mk.n ? null : mk.n)}
            aria-label={`${mk.n}번 설명`}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
            style={{ left: `${mk.x}%`, top: `${mk.y}%`, width: 28, height: 28 }}
          >
            <span className={`absolute inset-0 rounded-full transition ${sel === mk.n ? "ring-[3px] ring-[var(--mark)] ring-offset-2" : "ring-0"}`} />
          </button>
        ))}
      </div>
      <a href={`${import.meta.env.BASE_URL}${p.image}`} target="_blank" rel="noreferrer" className="lab-link mt-1.5 inline-block text-xs">
        크게 보기
      </a>

      <ol className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {p.items.map((it) => (
          <li key={it.n}>
            <button
              type="button"
              onClick={() => setSel(sel === it.n ? null : it.n)}
              className={`flex w-full cursor-pointer gap-3 py-2.5 text-left text-[14.5px] leading-relaxed transition-colors ${
                sel === it.n ? "bg-[var(--sunk)]" : "hover:bg-[var(--sunk)]"
              }`}
            >
              <span className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[var(--ink)] text-[11px] font-bold">
                {it.n}
              </span>
              <span className="min-w-0 break-keep">
                {it.text}
                {it.subs.map((s, i) => (
                  <span key={i} className="mt-0.5 block text-[13.5px] text-[var(--ink-2)]">
                    – {s}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ───────── 학교증명발급시스템 흐름: 단계 탭 → 설명 줄 + 캡처 ───────── */
function CertFlowView({ flow }: { flow: CertFlow }) {
  const [si, setSi] = useState(0);
  const [more, setMore] = useState(false);
  const s = flow.steps[Math.min(si, flow.steps.length - 1)];
  const printed = [...new Set(s.printed.filter(Boolean))];
  const shots = more ? s.shots : s.shots.slice(0, 1);

  return (
    <div>
      <SystemTitle name="학교증명발급시스템" source={`학교증명발급시스템 매뉴얼 ${printed.join("~")}쪽`} />
      <StepTabs
        titles={flow.steps.map((x) => x.title)}
        value={si}
        onChange={(i) => {
          setSi(i);
          setMore(false);
        }}
      />

      <ul className="mt-4 space-y-1.5 text-[14.5px] leading-relaxed">
        {s.lines.map((l, i) => {
          const note = /^(※|□)/.test(l);
          return (
            <li key={i} className={`break-keep ${note ? "text-[13.5px] text-[var(--ink-2)]" : ""}`}>
              {l.replace(/^-\s*/, "– ")}
            </li>
          );
        })}
      </ul>

      {shots.map((x) => (
        <div key={x.image} className="mt-4">
          <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white">
            <img src={`${import.meta.env.BASE_URL}${x.image}`} alt={`${s.title} 화면`} className="block w-full" style={{ aspectRatio: `${x.width} / ${x.height}` }} />
          </div>
          <a href={`${import.meta.env.BASE_URL}${x.image}`} target="_blank" rel="noreferrer" className="lab-link mt-1.5 inline-block text-xs">
            크게 보기
          </a>
        </div>
      ))}
      {s.shots.length > 1 && !more && (
        <button type="button" onClick={() => setMore(true)} className="lab-link mt-2 text-sm">
          화면 {s.shots.length - 1}장 더 보기
        </button>
      )}
    </div>
  );
}

function SystemTitle({ name, source }: { name: string; source: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-[var(--ink)] pb-2">
      <span className="text-[15px] font-bold">{name}에서 처리 순서</span>
      <span className="text-xs text-[var(--muted)]">{source}</span>
    </div>
  );
}
