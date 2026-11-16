import { useMemo, useState } from "react";
import type { AppData } from "../lib/data";
import {
  estimateGraduation,
  guideMessage,
  judgeIdentity,
  judgeRule,
  manAge,
  ruleNeeds,
  type CellResult,
  type SchoolLevel,
  type Verdict,
  type Visitor,
  type Ym,
} from "../lib/judge";
import { CheckIcon, CopyIcon } from "./Icons";
import { DashList, Seg, Step } from "./ui";

/* 입력값(연도·나이)은 이 컴포넌트 상태에만 있고 주소·저장소·서버로 보내지 않는다. */

const inputCls = "rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-[15px] text-ink outline-none focus:border-ink";

/* 판별 결과 표시 — 색은 판별 결과에만 쓴다(○ 초록 · △ 노랑 · × 흐림) */
const VERDICT: Record<Verdict, { label: string; sym: string; cls: string }> = {
  ok: { label: "가능", sym: "○", cls: "text-emerald-700" },
  check: { label: "확인 필요", sym: "△", cls: "text-amber-700" },
  need: { label: "연도 입력", sym: "–", cls: "text-muted" },
  no: { label: "불가", sym: "×", cls: "text-muted" },
};

const ESTIMATE_BASIS = ["졸업연월", "제적연월", "해당연월"];

/** 연도별 발급경로 판별기. ruleId를 주면 그 증명서로 고정, 없으면 선택 목록 표시 */
export function IssuanceJudge({ data, ruleId: fixedId }: { data: AppData; ruleId?: string }) {
  const { rules, channels, reviewed } = data.bundle.rules;
  const [pickedId, setPickedId] = useState(Object.keys(rules)[0]);
  const ruleId = fixedId ?? pickedId;
  const rule = rules[ruleId];
  const needs = useMemo(() => ruleNeeds(rule), [rule]);

  const [mode, setMode] = useState<"direct" | "birth">("direct");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [level, setLevel] = useState<SchoolLevel>("고");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const canEstimate = ESTIMATE_BASIS.includes(rule.basis);
  const validYear = (s: string) => /^\d{4}$/.test(s) && +s >= 1900 && +s <= 2100;

  const dates: Ym[] = useMemo(() => {
    if (!needs.needsDate) return [];
    if (mode === "birth" && canEstimate) {
      return validYear(birthYear) ? estimateGraduation(+birthYear, level, birthMonth ? +birthMonth : undefined) : [];
    }
    return validYear(year) ? [{ year: +year, month: month ? +month : undefined }] : [];
  }, [needs.needsDate, mode, canEstimate, birthYear, birthMonth, level, year, month]);

  const results = useMemo(() => judgeRule(rule, channels, { dates, statuses }), [rule, channels, dates, statuses]);
  const hasInput = dates.length > 0 || statuses.length > 0;

  const basisText =
    dates.length === 0
      ? statuses.join("·") || ""
      : dates.length === 1
        ? `${rule.basis.replace(/연월|연도/, "")} ${dates[0].year}년${dates[0].month ? ` ${dates[0].month}월` : ""}`
        : `${level}졸 추정 ${dates.map((d) => d.year).join(" 또는 ")}년 2월`;

  const message = guideMessage(rule, results, basisText);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사하지 못했습니다. 직접 선택해서 복사해 주세요.");
    }
  };

  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [id, r] of Object.entries(rules)) m.set(r.group, [...(m.get(r.group) ?? []), id]);
    return m;
  }, [rules]);

  return (
    <div className="space-y-5 text-ink">
      {!fixedId && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">증명서</span>
          <select
            className={inputCls + " w-full"}
            value={pickedId}
            onChange={(e) => {
              setPickedId(e.target.value);
              setStatuses([]);
            }}
          >
            {[...groups].map(([g, ids]) => (
              <optgroup key={g} label={g}>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {rules[id].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}

      {needs.needsDate && (
        <div>
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-muted">
              기준 <b className="font-semibold text-ink">{rule.basis}</b>
              {rule.basis.includes("연") && " (출생연도 아님)"}
            </span>
            {canEstimate && (
              <Seg
                value={mode}
                onChange={setMode}
                options={[
                  ["direct", "직접 입력"],
                  ["birth", "출생연도로 추정"],
                ]}
              />
            )}
          </div>
          {mode === "direct" || !canEstimate ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                className={inputCls + " w-[5.5rem] tabular-nums"}
                inputMode="numeric"
                maxLength={4}
                placeholder="예: 1995"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                aria-label={`${rule.basis} — 연도`}
              />
              년
              {rule.basis.includes("월") && (
                <>
                  <select className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="월">
                    <option value="">월 모름</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}월
                      </option>
                    ))}
                  </select>
                  <span className="ml-1 text-[13px] text-muted">졸업은 보통 2월</span>
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  className={inputCls + " w-[5.5rem] tabular-nums"}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="예: 1975"
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
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                {dates.length > 0 && (
                  <>
                    추정 {rule.basis}: <b>{dates.map((d) => `${d.year}년 ${d.month}월`).join(" 또는 ")}</b>
                    {dates.length > 1 && " (1~2월생은 한 해 일찍 입학했을 수 있음)"} —{" "}
                  </>
                )}
                정규 진학 기준 추정이라 유급·조기입학·검정고시·전학 등은 반영되지 않습니다. 졸업연도를 꼭 확인하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {needs.statuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px]">
          <span className="text-sm text-muted">해당 신분</span>
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

      <ResultList results={results} hasInput={hasInput} />

      {hasInput && (
        <div className="border-l-2 border-accent pl-3.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink-2">민원인 안내 문구</span>
            <button type="button" onClick={copy} className="link-quiet inline-flex items-center gap-1 text-xs">
              {copied ? <CheckIcon size={13} className="text-emerald-700" /> : <CopyIcon size={13} />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{message}</pre>
        </div>
      )}

      {rule.notes.length > 0 && <DashList items={rule.notes} />}
      <p className="text-xs text-muted">
        근거: 민원편람 47~48쪽(인쇄 37~38쪽) 「민원 창구별 종류 및 발급 가능 연도」 · 입력한 연도는 저장되지 않습니다
        {!reviewed && " · 규칙 검수 전"}
      </p>
    </div>
  );
}

function ResultList({ results, hasInput }: { results: CellResult[]; hasInput: boolean }) {
  const order: Verdict[] = ["ok", "check", "need", "no"];
  const sorted = hasInput ? [...results].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict)) : results;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {sorted.map((r) => {
        const v = VERDICT[r.verdict];
        const dim = r.verdict === "no";
        return (
          <li key={r.channel.id} className="flex items-baseline gap-3 py-2.5">
            <span className={`w-5 shrink-0 text-center text-base font-bold leading-none ${v.cls}`}>{v.sym}</span>
            <span className="min-w-0 flex-1">
              <span className={`text-[15px] font-semibold ${dim ? "text-muted" : "text-ink"}`}>{r.channel.label}</span>
              <span className={`mt-0.5 block text-[13px] leading-relaxed ${dim ? "text-muted" : "text-ink-2"}`}>{r.reason}</span>
            </span>
            <span className={`shrink-0 text-[13px] font-semibold ${v.cls}`}>{v.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 신청인 신원 확인(방문 시) — 누가 왔는지 + 대상자 나이 → 구비서류. 제목·상자 없이 내용만(단계 안에 넣어 쓴다) */
export function IdentityJudge({ data }: { data: AppData }) {
  const rules = data.bundle.identity;
  const [visitor, setVisitor] = useState<Visitor>("self");
  const [ageMode, setAgeMode] = useState<"age" | "birth">("age");
  const [age, setAge] = useState("");
  const [birth, setBirth] = useState("");

  const ageNum = useMemo(() => {
    if (ageMode === "age") return /^\d{1,3}$/.test(age) ? +age : undefined;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
    return m ? manAge({ year: +m[1], month: +m[2], day: +m[3] }) : undefined;
  }, [ageMode, age, birth]);

  // (이전 버전 데이터가 캐시에 남아 있으면 규칙이 없을 수 있음 → 화면을 깨뜨리지 않고 숨김)
  if (!rules) return null;
  const res = ageNum === undefined ? null : judgeIdentity(rules, visitor, ageNum);
  const visitors: [Visitor, string][] = [
    ["self", "본인"],
    ["guardian", "부모(법정대리인)"],
    ["proxy", "그 밖의 대리인"],
  ];

  return (
    <div className="space-y-4 text-ink">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
        {visitors.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisitor(v)}
            aria-pressed={visitor === v}
            className={`cursor-pointer border-b-2 pb-1 ${
              visitor === v ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted">증명서 대상자</span>
        <select className={inputCls} value={ageMode} onChange={(e) => setAgeMode(e.target.value as "age" | "birth")} aria-label="나이 입력 방식">
          <option value="age">만 나이</option>
          <option value="birth">생년월일</option>
        </select>
        {ageMode === "age" ? (
          <>
            <input
              className={inputCls + " w-16 tabular-nums"}
              inputMode="numeric"
              maxLength={3}
              placeholder="예: 16"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
              aria-label="만 나이"
            />
            세
          </>
        ) : (
          <input type="date" className={inputCls} value={birth} onChange={(e) => setBirth(e.target.value)} aria-label="생년월일" />
        )}
        {ageMode === "birth" && ageNum !== undefined && <span className="ml-1 text-sm font-semibold">만 {ageNum}세</span>}
      </div>

      {res &&
        (res.matched ? (
          res.case.denied ? (
            <div className="border-l-2 border-rose-600 pl-3.5 text-[15px]">
              <div className="font-semibold text-rose-800">
                × {res.case.visitor} · 대상자 {res.case.subject} — 신청 불가
              </div>
              <p className="mt-1 leading-relaxed">{res.case.message}</p>
              {res.case.source && <p className="mt-1.5 text-xs text-muted">근거: {res.case.source}</p>}
            </div>
          ) : (
            <div className="border-l-2 border-emerald-600 pl-3.5">
              <div className="mb-2 text-[15px] font-semibold text-emerald-800">
                {res.case.visitor} · 대상자 {res.case.subject} — 필요 서류
              </div>
              <DashList items={res.case.documents} />
              {res.case.source && <p className="mt-2 text-xs text-muted">근거: {res.case.source}</p>}
            </div>
          )
        ) : (
          <div className="border-l-2 border-amber-600 pl-3.5 text-[15px] text-ink">△ {res.note}</div>
        ))}
      <p className="text-xs leading-relaxed text-muted">
        근거: 민원편람 46쪽(인쇄 36쪽) 「신청인 신원 확인 방법(방문 시)」 · 대리인 위임장은 「민원 처리에 관한 법률 시행규칙」 별지 제3호 서식
        {!rules.reviewed && " · 규칙 검수 전"}
      </p>
    </div>
  );
}

export function JudgePage({ data }: { data: AppData }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <header className="pt-8">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">발급 경로 판별기</h1>
        <p className="mt-2 max-w-3xl break-keep text-[14.5px] leading-relaxed text-ink-2">
          졸업(합격·퇴직)연도로 나이스·학교증명발급시스템·정부24·무인발급기·FAX 중 어디서 발급되는지, 누가 방문하면 어떤 신원 확인 서류가
          필요한지 확인합니다. 민원 상세 화면에도 같은 판별이 들어 있습니다.
        </p>
      </header>
      <div className="mt-9 grid gap-x-10 gap-y-10 border-t border-line pt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <Step n={1} title="연도별 발급 경로">
          <IssuanceJudge data={data} />
        </Step>
        <Step n={2} title="누가 왔나요?" note="방문 시 신원 확인 서류">
          <IdentityJudge data={data} />
        </Step>
      </div>
      <p className="mt-10 text-xs text-muted">{data.bundle.version} 기준 · 관계 법령이 바뀐 경우 법령이 우선합니다.</p>
    </div>
  );
}
