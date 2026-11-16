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
import { AlertIcon, CheckIcon, CopyIcon } from "./Icons";
import { Badge, Button, List, Section } from "./ui";

/* 입력값(연도·나이)은 이 컴포넌트 상태에만 있고 주소·저장소·서버로 보내지 않는다. */

const inputCls =
  "rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-base outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

const VERDICT: Record<Verdict, { label: string; cls: string; dot: string; icon: string }> = {
  ok: {
    label: "가능",
    cls: "bg-emerald-50/70 text-emerald-900 ring-emerald-200/80",
    dot: "bg-emerald-600 text-white",
    icon: "○",
  },
  check: {
    label: "확인 필요",
    cls: "bg-amber-50/70 text-amber-900 ring-amber-200/80",
    dot: "bg-amber-500 text-white",
    icon: "△",
  },
  need: {
    label: "입력 필요",
    cls: "bg-gray-50 text-gray-600 ring-gray-200",
    dot: "bg-gray-300 text-gray-700",
    icon: "?",
  },
  no: {
    label: "불가",
    cls: "bg-white text-gray-400 ring-gray-200/70",
    dot: "bg-gray-100 text-gray-400",
    icon: "×",
  },
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
    <Section
      title={fixedId ? `발급 경로 판별 — ${rule.label}` : "연도별 발급 경로 판별"}
      subtitle="연도를 입력하면 NEIS·정부24·무인발급기·FAX 가능 여부를 즉시 확인합니다."
      right={!reviewed ? <Badge tone="amber">규칙 검수 전</Badge> : undefined}
    >
      <div className="space-y-3.5">
        {!fixedId && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-500">증명서 선택</span>
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
          <div className="rounded-xl border border-gray-200/70 bg-gray-50/90 p-3.5">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-gray-700 sm:text-sm">기준: {rule.basis}</span>
                {rule.basis.includes("연") && <span className="text-xs text-gray-500">(출생연도 아님)</span>}
              </div>
              {canEstimate && (
                <div className="inline-flex rounded-xl bg-gray-200/80 p-0.5">
                  {(["direct", "birth"] as const).map((md) => (
                    <button
                      key={md}
                      type="button"
                      onClick={() => setMode(md)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        mode === md ? "bg-white text-gray-900 shadow-2xs" : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {md === "direct" ? "직접 입력" : "출생연도로 추정"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mode === "direct" || !canEstimate ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={inputCls + " w-24"}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="예: 1995"
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                  aria-label={`${rule.basis} — 연도`}
                />
                <span className="text-sm text-gray-700">년</span>
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
                    <span className="text-xs text-gray-500">졸업은 보통 2월</span>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className={inputCls + " w-24"}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="예: 1975"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
                    aria-label="출생연도"
                  />
                  <span className="text-sm text-gray-700">년생</span>
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
                {dates.length > 0 && (
                  <p className="text-sm text-gray-700">
                    추정 {rule.basis}: <b className="text-brand-700">{dates.map((d) => `${d.year}년 ${d.month}월`).join(" 또는 ")}</b>
                    {dates.length > 1 && <span className="text-xs text-gray-500"> (1~2월생은 한 해 일찍 입학했을 수 있음)</span>}
                  </p>
                )}
                <p className="flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertIcon size={14} className="mt-0.5" />
                  <span>정규 진학 기준 추정입니다. 유급·조기입학·검정고시·전학 등은 반영되지 않으니 졸업연도를 꼭 확인하세요.</span>
                </p>
              </div>
            )}
          </div>
        )}

        {needs.statuses.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50/70 px-3.5 py-2.5">
            <span className="text-xs font-bold text-gray-600">해당 신분</span>
            {needs.statuses.map((s) => (
              <label key={s} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-gray-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded accent-brand-600"
                  checked={statuses.includes(s)}
                  onChange={(e) => setStatuses((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))}
                />
                {s}
              </label>
            ))}
          </div>
        )}

        <ResultList results={results} />

        {hasInput && (
          <div className="rounded-xl border border-brand-200/80 bg-brand-50/50 p-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-brand-900">민원인 안내 문구</span>
              <Button size="sm" onClick={copy}>
                {copied ? <CheckIcon size={13} className="text-emerald-600" /> : <CopyIcon size={13} />}
                {copied ? "복사됨" : "복사"}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{message}</pre>
          </div>
        )}

        {rule.notes.length > 0 && (
          <div className="text-sm text-gray-600">
            <List items={rule.notes} />
          </div>
        )}
        <p className="text-xs text-gray-400">
          근거: 민원편람 47~48쪽(인쇄 37~38쪽) 「민원 창구별 종류 및 발급 가능 연도」 · 입력한 연도는 저장되지 않습니다.
        </p>
      </div>
    </Section>
  );
}

function ResultList({ results }: { results: CellResult[] }) {
  const order: Verdict[] = ["ok", "check", "need", "no"];
  const sorted = [...results].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {sorted.map((r) => {
        const v = VERDICT[r.verdict];
        return (
          <li key={r.channel.id} className={`rounded-xl px-3.5 py-2.5 ring-1 ring-inset ${v.cls}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${v.dot}`}>
                {v.icon}
              </span>
              <span className="font-semibold">{r.channel.label}</span>
              <span className="ml-auto shrink-0 text-xs font-bold">{v.label}</span>
            </div>
            <div className="mt-1 pl-7 text-xs leading-relaxed opacity-90">{r.reason}</div>
          </li>
        );
      })}
    </ul>
  );
}

/** 신청인 신원 확인(방문 시) — 누가 왔는지 + 대상자 나이 → 구비서류 */
/** compact: 회색 상자 + 자체 제목 / bare: 상자·제목 없이 내용만(민원 상세의 단계 안에 넣을 때) */
export function IdentityJudge({ data, compact, bare }: { data: AppData; compact?: boolean; bare?: boolean }) {
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

  const body = (
    <div className="space-y-3">
      <div className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
        {visitors.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisitor(v)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              visitor === v ? "bg-white text-brand-700 shadow-2xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-600 sm:text-sm">증명서 대상자</span>
        <select className={inputCls} value={ageMode} onChange={(e) => setAgeMode(e.target.value as "age" | "birth")} aria-label="나이 입력 방식">
          <option value="age">만 나이</option>
          <option value="birth">생년월일</option>
        </select>
        {ageMode === "age" ? (
          <>
            <input
              className={inputCls + " w-20"}
              inputMode="numeric"
              maxLength={3}
              placeholder="예: 16"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
              aria-label="만 나이"
            />
            <span className="text-sm text-gray-700">세</span>
          </>
        ) : (
          <input type="date" className={inputCls} value={birth} onChange={(e) => setBirth(e.target.value)} aria-label="생년월일" />
        )}
        {ageMode === "birth" && ageNum !== undefined && (
          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">만 {ageNum}세</span>
        )}
      </div>

      {res &&
        (res.matched ? (
          res.case.denied ? (
            <div className="rounded-xl bg-rose-50 p-3.5 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">
              <div className="font-bold">
                × {res.case.visitor} · 대상자 {res.case.subject} → 신청 불가
              </div>
              <p className="mt-1 leading-relaxed">{res.case.message}</p>
              {res.case.source && <p className="mt-1.5 text-xs opacity-75">근거: {res.case.source}</p>}
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50/80 p-3.5 ring-1 ring-inset ring-emerald-200">
              <div className="mb-1.5 text-sm font-bold text-emerald-900">
                {res.case.visitor} · 대상자 {res.case.subject} → 필요 서류
              </div>
              <List items={res.case.documents} />
              {res.case.source && <p className="mt-2 text-xs text-emerald-800/75">근거: {res.case.source}</p>}
            </div>
          )
        ) : (
          <div className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">△ {res.note}</div>
        ))}
      <p className="text-xs text-gray-400">
        근거: 민원편람 46쪽(인쇄 36쪽) 「신청인 신원 확인 방법(방문 시)」 · 대리인 위임장은 「민원 처리에 관한 법률 시행규칙」 별지 제3호 서식
        {!rules.reviewed && " · 규칙 검수 전"}
      </p>
    </div>
  );

  if (bare) return body;
  if (compact) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200/90 bg-gray-50/50 p-3.5">
        <div className="mb-2.5 text-sm font-bold text-gray-800">누가 신청하나요? (방문 시 신원 확인 서류)</div>
        {body}
      </div>
    );
  }
  return <Section title="대리 발급·신원 확인 서류 판별">{body}</Section>;
}

export function JudgePage({ data }: { data: AppData }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-6 sm:px-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">발급 경로 판별기</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          졸업(합격·퇴직)연도에 따라 NEIS·정부24·무인발급기·FAX 중 어디서 발급되는지, 누가 방문하면 어떤 신원 확인 서류가 필요한지 동시에 확인합니다.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <IssuanceJudge data={data} />
        <IdentityJudge data={data} />
      </div>
      <p className="pt-1 text-center text-xs text-slate-400">{data.bundle.version} 기준 · 관계 법령이 바뀐 경우 법령이 우선합니다.</p>
    </div>
  );
}
