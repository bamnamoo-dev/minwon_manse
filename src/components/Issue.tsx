import { useMemo, useState, type ReactNode } from "react";
import type { AppData } from "../lib/data";
import {
  estimateGraduation,
  fmtYm,
  judgeRule,
  ruleNeeds,
  type BirthHint,
  type CellResult,
  type SchoolLevel,
  type Verdict,
  type Ym,
} from "../lib/judge";
import type { CertStep, Minwon, NeisPage, RuleCell, SystemId } from "../lib/types";
import { digitsAndAdvance } from "../lib/focus";
import { ArrowRightIcon } from "./Icons";
import { Fold, Mark, Seg } from "./ui";

/*
 * ③ 어디서 발급하나요? — 연도 입력 → 나이스 / 학교증명발급시스템 판정 → 그 시스템의 처리 순서
 * - 판정: data/rules/issuance_years.json 의 neis·certSystem 칸 (판별기와 같은 규칙, src/lib/judge.ts)
 * - 처리 순서: data/manuals (links.json 으로 민원 연결, neis.json·certsys.json 은 매뉴얼 자동 추출)
 * - 입력한 연도는 이 컴포넌트 상태에만 있다(주소·저장소·서버로 보내지 않음).
 */

const SYSTEM_NAME: Record<SystemId, string> = { neis: "나이스", certSystem: "학교증명발급시스템" };

const MARK: Record<Verdict, { sym: string; label: string; cls: string }> = {
  ok: { sym: "○", label: "발급", cls: "text-emerald-700" },
  check: { sym: "△", label: "확인 필요", cls: "text-amber-700" },
  need: { sym: "–", label: "연도 입력", cls: "text-muted" },
  no: { sym: "×", label: "해당 없음", cls: "text-muted" },
};

const inputCls = "rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-[15px] text-ink outline-none focus:border-ink";

/** 규칙 칸 → 사람이 읽는 조건 (예: "2003년 2월 이후 졸업") */
function cond(c: RuleCell | undefined, basis: string): string {
  if (!c) return "";
  const word = basis.replace(/연월|연도|상태/, "");
  if (c.s === "from") return `${fmtYm(c.from)} 이후 ${word}${c.status ? ` 또는 ${c.status.join("·")}` : ""}`;
  if (c.s === "range") return `${fmtYm(c.from)} ~ ${fmtYm(c.to)} ${word}`;
  if (c.s === "status") return `${c.status!.join("·")}만`;
  if (c.s === "yes") return "연도 제한 없음";
  if (c.s === "no") return "불가";
  return c.note ?? "";
}

/** birthHint: ① 누가 왔나요에서 입력한 생년월일 — ③을 직접 고치기 전까지 출생연도·생월을 자동으로 채운다 */
export function WhereToIssue({ data, m, birthHint }: { data: AppData; m: Minwon; birthHint?: BirthHint | null }) {
  const { channels, rules } = data.bundle.rules;
  const manuals = data.bundle.manuals;
  const link = manuals?.links[m.id];
  const rule = m.yearRuleIds.map((r) => rules[r]).find(Boolean);
  const needs = useMemo(() => (rule ? ruleNeeds(rule) : null), [rule]);

  const neisPages = (link?.neis ?? []).map((p) => manuals.neis.pages.find((x) => x.page === p)).filter(Boolean) as NeisPage[];
  const certSteps = link?.certSystem ? manuals.certsys.sections[link.certSystem]?.steps : undefined;

  // null = 아직 직접 안 고침 → ①의 생년월일을 따른다
  const [modePicked, setMode] = useState<"grad" | "birth" | null>(null);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [birthYearTyped, setBirthYear] = useState<string | null>(null);
  const [birthMonthTyped, setBirthMonth] = useState<string | null>(null);
  const mode = modePicked ?? (birthHint && !year ? "birth" : "grad");
  const birthYear = birthYearTyped ?? (birthHint ? String(birthHint.year) : "");
  const birthMonth = birthMonthTyped ?? (birthHint?.month ? String(birthHint.month) : "");
  const fromHint = mode === "birth" && birthYearTyped === null && !!birthHint;
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

  // 이 민원에서 쓰일 수 있는 시스템: 규칙이 있으면 '불가'가 아닌 칸, 없으면 매뉴얼이 연결된 시스템
  const order: SystemId[] = manuals?.order ?? ["neis", "certSystem"];
  const systems = order.filter((s) =>
    rule ? rule.cells[s] && rule.cells[s].s !== "no" : s === "neis" ? neisPages.length > 0 : !!certSteps,
  );
  const hasInput = dates.length > 0 || statuses.length > 0;
  const okSystems = systems.filter((s) => byId(s)?.verdict === "ok");
  const auto = okSystems[0] ?? systems.find((s) => byId(s)?.verdict === "check") ?? systems[0];
  const inputKey = JSON.stringify([dates, statuses]);
  const current = picked && picked.key === inputKey && systems.includes(picked.id) ? picked.id : auto;
  const noneFits = hasInput && systems.length > 0 && systems.every((s) => byId(s)?.verdict === "no");
  const others = results.filter((r) => !order.includes(r.channel.id as SystemId));

  return (
    <div>
      {needs?.needsDate && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 text-ink">
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
                onChange={(e) => setYear(digitsAndAdvance(e, 4))}
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
                onChange={(e) => setBirthYear(digitsAndAdvance(e, 4))}
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
              {fromHint && <span className="ml-1 text-[13px] text-accent">① 생년월일에서 자동 입력</span>}
            </span>
          )}
        </div>
      )}
      {needs && needs.statuses.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] text-ink">
          {needs.statuses.map((s) => (
            <label key={s} className="inline-flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-ink"
                checked={statuses.includes(s)}
                onChange={(e) => setStatuses((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))}
              />
              {s}
            </label>
          ))}
        </div>
      )}
      {mode === "birth" && dates.length > 0 && (
        <div className="mt-3">
          {/* 출생연도와 졸업연도를 헷갈리지 않게 — 판정 기준이 되는 졸업연월을 크게 */}
          <p className="text-[15px] text-ink">
            →{" "}
            <b className="font-bold">
              {dates.map((d) => `${d.year}년 ${d.month}월`).join(" 또는 ")} {rule!.basis.replace(/연월|연도/, "")}
            </b>{" "}
            기준으로 판정 <span className="text-[13px] text-muted">({birthYear}년생 추정)</span>
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            정규 진학 기준 추정이라 유급·조기입학·검정고시 등은 반영되지 않습니다. 확실한 졸업연도를 확인하세요.
          </p>
        </div>
      )}

      {/* 시스템 판정 */}
      {systems.length > 0 && (
        <div className="mt-4 divide-y divide-line border-y border-line">
          {systems.map((s) => {
            const r = byId(s);
            const v = MARK[r?.verdict ?? "need"];
            const on = current === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setPicked({ key: inputKey, id: s })}
                className={`flex w-full cursor-pointer items-baseline gap-3 py-3 text-left transition-opacity ${on ? "" : "opacity-60 hover:opacity-100"}`}
              >
                <span className={`w-5 shrink-0 text-center text-lg font-bold leading-none ${v.cls}`}>{hasInput ? v.sym : "·"}</span>
                <span className="min-w-0 flex-1">
                  <span className={`text-[17px] font-bold text-ink ${on ? "underline decoration-2 underline-offset-[6px]" : ""}`}>{SYSTEM_NAME[s]}</span>
                  {rule && <span className="ml-2.5 text-[13.5px] text-ink-2">{cond(rule.cells[s], rule.basis)}</span>}
                </span>
                {hasInput && <span className={`shrink-0 text-[13px] font-semibold ${v.cls}`}>{v.label}</span>}
              </button>
            );
          })}
        </div>
      )}
      {okSystems.length > 1 && (
        <p className="mt-2.5 text-[13px] text-ink-2">
          두 시스템 모두 발급 가능한 연도입니다. {SYSTEM_NAME[okSystems[0]]} 처리 순서를 먼저 보여줍니다 — 이름을 누르면 바뀝니다.
        </p>
      )}
      {noneFits && (
        <p className="mt-3 border-l-2 border-amber-600 pl-3 text-sm leading-relaxed text-ink">
          {systems.map((s) => SYSTEM_NAME[s]).join("·")} 모두 해당하지 않는 연도입니다. 학적부 보관 기관·발급 방법을 담당 부서에 확인하세요.
        </p>
      )}
      {!hasInput && needs?.needsDate && (
        <p className="mt-2.5 text-[13px] text-muted">연도를 넣으면 어느 시스템에서 발급하는지 표시됩니다. 입력값은 저장되지 않습니다.</p>
      )}

      {/* 처리 순서 */}
      <div className="mt-7">
        {current === "certSystem" && certSteps ? (
          <CertFlow steps={certSteps} />
        ) : current === "neis" && neisPages.length ? (
          <NeisFlow pages={neisPages} refs={link?.neisRefs ?? []} refNote={link?.neisRefNote} />
        ) : current ? (
          <Quiet>
            {SYSTEM_NAME[current]} 처리 화면은 아직 연결되지 않았습니다. (매뉴얼 연결: data/manuals/links.json)
          </Quiet>
        ) : null}
        {link?.checked && <p className="mt-3 text-xs text-muted">✓ {link.checked}</p>}
      </div>

      {/* 다른 발급 경로 (민원인이 다음에 이용할 곳) */}
      {rule && others.length > 0 && (
        <div className="mt-6 border-t border-line">
          <Fold title="다른 발급 경로" hint={others.map((r) => r.channel.label.replace(/\s*\(.*\)$/, "")).join(" · ")}>
            <ul className="space-y-1.5 text-sm">
              {others.map((r) => {
                const v = MARK[r.verdict];
                return (
                  <li key={r.channel.id} className="flex items-baseline gap-2.5">
                    <span className={`w-4 shrink-0 text-center font-bold ${v.cls}`}>{hasInput || r.verdict !== "need" ? v.sym : "·"}</span>
                    <span className="w-48 shrink-0 font-medium text-ink">{r.channel.label}</span>
                    <span className="text-ink-2">{cond(rule.cells[r.channel.id], rule.basis)}</span>
                  </li>
                );
              })}
            </ul>
            {rule.notes.length > 0 && <p className="mt-3 text-xs text-muted">{rule.notes.join(" · ")}</p>}
            <p className="mt-1 text-xs text-muted">근거: 민원편람 47~48쪽(인쇄 37~38쪽) 「민원 창구별 종류 및 발급 가능 연도」</p>
          </Fold>
        </div>
      )}
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <div className="border-l-2 border-line-strong pl-4 text-sm leading-relaxed text-muted">{children}</div>;
}

function SystemTitle({ name, source }: { name: string; source: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
      <span className="text-[15px] font-bold text-ink">{name}에서 처리 순서</span>
      <span className="text-xs text-muted">{source}</span>
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
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors ${
              i === value ? "bg-sunk font-semibold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <Mark n={i + 1} size={17} active={i === value} />
            {t}
          </button>
          {i < titles.length - 1 && <ArrowRightIcon size={11} className="text-line-strong" />}
        </li>
      ))}
    </ol>
  );
}

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/** 캡처 이미지 — 파일이 없으면(npm run render-manuals 전) 안내 */
function Shot({ src, alt, w, h, children }: { src: string; alt: string; w: number; h: number; children?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <Quiet>화면 이미지가 없습니다. npm run render-manuals 를 실행하세요.</Quiet>;
  return (
    <>
      <div className="relative overflow-hidden rounded-md border border-line bg-white">
        <img src={asset(src)} alt={alt} className="block w-full" style={{ aspectRatio: `${w} / ${h}` }} onError={() => setBroken(true)} />
        {children}
      </div>
      <a href={asset(src)} target="_blank" rel="noreferrer" className="link-quiet mt-1.5 inline-block text-xs">
        크게 보기
      </a>
    </>
  );
}

/* ───────── 나이스: 화면 탭 → 메뉴 경로 + 캡처(표식 강조) + 번호 설명 ───────── */
function NeisFlow({ pages, refs, refNote }: { pages: NeisPage[]; refs: number[]; refNote?: string }) {
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const p = pages[Math.min(pi, pages.length - 1)];
  const isRef = refs.includes(p.page);

  return (
    <div>
      <SystemTitle name="나이스" source={`나이스 민원 사용자매뉴얼 ${p.page}쪽`} />
      <StepTabs
        titles={pages.map((x) => x.title + (refs.includes(x.page) ? " (참고)" : ""))}
        value={pi}
        onChange={(i) => {
          setPi(i);
          setSel(null);
        }}
      />
      {isRef && refNote && <p className="mt-4 border-l-2 border-mark pl-3 text-[13.5px] leading-relaxed text-ink">{refNote}</p>}

      <div className="mt-4 mb-2 flex flex-wrap items-center gap-x-1.5 font-mono text-[12.5px] text-ink-2">
        {p.menuPath.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted">›</span>}
            <span className={i === p.menuPath.length - 1 ? "font-semibold text-ink" : ""}>{s}</span>
          </span>
        ))}
      </div>

      <Shot src={p.image} alt={`${p.title} 화면`} w={p.width} h={p.height}>
        {p.markers.map((mk) => (
          <button
            key={mk.n}
            type="button"
            onClick={() => setSel(sel === mk.n ? null : mk.n)}
            aria-label={`${mk.n}번 설명`}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full"
            style={{ left: `${mk.x}%`, top: `${mk.y}%`, width: 28, height: 28 }}
          >
            <span className={`absolute inset-0 rounded-full transition ${sel === mk.n ? "ring-[3px] ring-mark ring-offset-2" : "ring-0"}`} />
          </button>
        ))}
      </Shot>

      <ol className="mt-4 divide-y divide-line border-y border-line">
        {p.items.map((it) => (
          <li key={it.n}>
            <button
              type="button"
              onClick={() => setSel(sel === it.n ? null : it.n)}
              className={`flex w-full cursor-pointer gap-3 py-2.5 text-left text-[14.5px] leading-relaxed text-ink transition-colors ${
                sel === it.n ? "bg-sunk" : "hover:bg-sunk"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                  sel === it.n ? "border-mark bg-mark text-white" : "border-ink"
                }`}
              >
                {it.n}
              </span>
              <span className="min-w-0 break-keep">
                {it.text}
                {it.subs.map((s, i) => (
                  <span key={i} className="mt-0.5 block text-[13.5px] text-ink-2">
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

/* ───────── 학교증명발급시스템: 단계 탭 → 설명 줄 + 캡처 ───────── */
function CertFlow({ steps }: { steps: CertStep[] }) {
  const [si, setSi] = useState(0);
  const [more, setMore] = useState(false);
  const s = steps[Math.min(si, steps.length - 1)];
  const printed = [...new Set(s.printed.filter(Boolean))];
  const shots = more ? s.shots : s.shots.slice(0, 1);

  return (
    <div>
      <SystemTitle name="학교증명발급시스템" source={`학교증명발급시스템 매뉴얼 ${printed.join("~")}쪽`} />
      <StepTabs
        titles={steps.map((x) => x.title)}
        value={si}
        onChange={(i) => {
          setSi(i);
          setMore(false);
        }}
      />
      <ul className="mt-4 space-y-1.5 text-[14.5px] leading-relaxed text-ink">
        {s.lines.map((l, i) => (
          <li key={i} className={`break-keep ${/^(※|□)/.test(l) ? "text-[13.5px] text-ink-2" : ""}`}>
            {l.replace(/^-\s*/, "– ")}
          </li>
        ))}
      </ul>
      {shots.map((x) => (
        <div key={x.image} className="mt-4">
          <Shot src={x.image} alt={`${s.title} 화면`} w={x.width} h={x.height} />
        </div>
      ))}
      {s.shots.length > 1 && !more && (
        <button type="button" onClick={() => setMore(true)} className="link-quiet mt-2 text-sm">
          화면 {s.shots.length - 1}장 더 보기
        </button>
      )}
    </div>
  );
}
