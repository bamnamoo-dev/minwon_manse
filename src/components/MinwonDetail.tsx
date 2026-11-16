import { useEffect, useState } from "react";
import type { AppData } from "../lib/data";
import { printedPage } from "../lib/data";
import { lastSearchHash } from "../lib/router";
import { pushRecent } from "../lib/storage";
import type { Minwon, Rule, RuleCell } from "../lib/types";
import { PageViewer, printPages } from "./PageViewer";
import { Badge, Button, List, Section } from "./ui";

export function MinwonDetail({ data, m }: { data: AppData; m: Minwon }) {
  const [viewer, setViewer] = useState<{ title: string; pages: number[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    pushRecent(m.id);
    window.scrollTo(0, 0);
  }, [m.id]);

  const rules = m.yearRuleIds.map((id) => [id, data.bundle.rules.rules[id]] as const).filter(([, r]) => r);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사하지 못했습니다. 직접 선택해서 복사해 주세요.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-4">
      <BackLink />

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{m.category}</Badge>
          <span className="text-sm text-gray-400">민원 {m.no}번</span>
          {!m.reviewed && (
            <Badge tone="amber" >
              검수 전 데이터 — 원문과 다를 수 있음
            </Badge>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{m.title}</h1>
        <p className="mt-2 leading-relaxed text-gray-700">{m.summary}</p>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="처리기간" value={m.period || "편람에 없음"} strong />
        <Fact label="수수료" value={m.fee || "-"} strong />
        <Fact label="신청방법" value={m.methods.join(", ") || "-"} />
        <Fact label="접수처" value={m.receivers.join(", ") || "-"} />
      </dl>

      <div className="mt-5 space-y-4">
        {m.guideScript && (
          <Section
            title="민원인 안내 멘트"
            right={
              <Button onClick={() => copy(m.guideScript)}>{copied ? "✓ 복사됨" : "📋 복사"}</Button>
            }
          >
            <p className="whitespace-pre-line leading-relaxed">{m.guideScript}</p>
          </Section>
        )}

        <Section
          title="구비서류"
          right={m.documentsSource !== "요약표" ? <Badge tone="amber">{m.documentsSource}</Badge> : undefined}
        >
          {m.documents.length ? <List items={m.documents} /> : <p className="text-gray-500">편람에 기재 없음</p>}
          {m.officerChecks.length > 0 && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3">
              <div className="mb-1.5 text-sm font-semibold text-gray-600">담당공무원 확인사항 (민원인 제출 생략)</div>
              <List items={m.officerChecks} />
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            대리인 신청 시 위임장 등은 <a className="text-brand-600 underline" href="#/q-identity" onClick={(e) => { e.preventDefault(); goIdentity(data); }}>신청인 신원 확인 방법</a> 참고
          </p>
        </Section>

        {m.process.length > 0 && (
          <Section title="처리 과정">
            <div className="space-y-3">
              {m.process.map((p, i) => (
                <div key={i}>
                  {p.channel && <div className="mb-1.5 text-sm font-semibold text-brand-700">{p.channel}</div>}
                  <ol className="flex flex-wrap items-center gap-1.5">
                    {p.steps.map((s, j) => (
                      <li key={j} className="flex items-center gap-1.5">
                        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm text-gray-800">{s}</span>
                        {j < p.steps.length - 1 && <span aria-hidden className="text-gray-400">→</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </Section>
        )}

        {rules.map(([id, r]) => (
          <RuleTable key={id} rule={r} data={data} />
        ))}

        {m.notes.length > 0 && (
          <Section title="참고사항">
            <List items={m.notes} />
          </Section>
        )}

        <Section title="양식 (서식)">
          {m.forms.length === 0 && <p className="text-gray-500">붙임 서식 없음</p>}
          <ul className="divide-y divide-gray-100">
            {m.forms.map((f, i) => (
              <li key={i} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="break-keep font-medium">{f.name}</div>
                  <div className="text-xs text-gray-500">
                    {f.pdfPages.length ? `PDF ${f.pdfPages.join(", ")}쪽` : "쪽 정보 없음"}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                <Button onClick={() => setViewer({ title: f.name, pages: f.pdfPages })} disabled={!f.pdfPages.length}>
                  👁 원문 보기
                </Button>
                <Button onClick={() => printPages(f.name, f.pdfPages)} disabled={!f.pdfPages.length}>
                  🖨 인쇄
                </Button>
                <Button
                  href={f.hwp ? `${import.meta.env.BASE_URL}forms/${f.hwp}` : undefined}
                  disabled={!f.hwp}
                  title={f.hwp ? "한글 서식 내려받기" : "한글(HWP) 서식이 아직 등록되지 않았습니다"}
                >
                  ⬇ HWP
                </Button>
                </div>
              </li>
            ))}
          </ul>
          {m.infoPages.length > 0 && (
            <div className="mt-2 text-sm">
              <button className="text-brand-600 underline" onClick={() => setViewer({ title: `${m.title} — 참고 안내`, pages: m.infoPages })}>
                참고 안내 페이지 보기 (PDF {m.infoPages.join(", ")}쪽)
              </button>
            </div>
          )}
        </Section>

        <Section title="처리 정보">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <Dt>처리과</Dt>
            <Dd>{m.dept || "-"}</Dd>
            <Dt>공부대조</Dt>
            <Dd>{m.ledger || "-"}</Dd>
            <Dt>최종결재</Dt>
            <Dd>{m.approval || "-"}</Dd>
            <Dt>관련근거</Dt>
            <Dd>{m.laws.length ? <List items={m.laws} /> : "-"}</Dd>
          </dl>
        </Section>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          <span className="flex-1">
            출처: 서울특별시교육청 「민원편람」 2025 개정판 PDF {m.sourcePages[0]}~{m.sourcePages.at(-1)}쪽 (인쇄{" "}
            {printedPage(m.sourcePages[0])}~{printedPage(m.sourcePages.at(-1)!)}쪽). 관계 법령이 개정된 경우 법령이 우선합니다.
          </span>
          <Button variant="primary" onClick={() => setViewer({ title: `${m.title} — 편람 원문`, pages: m.sourcePages })}>
            📄 편람 원문 보기
          </Button>
        </div>
      </div>

      {viewer && <PageViewer title={viewer.title} pages={viewer.pages} onClose={() => setViewer(null)} />}
    </div>
  );
}

/** 신원 확인(위임장) 안내 문서로 이동 */
function goIdentity(data: AppData) {
  const g = data.bundle.guides.find((x) => x.title.includes("신원 확인"));
  window.location.hash = g ? `#/g/${g.id}` : "#/";
}

export function BackLink() {
  // 마지막 검색어·분류를 유지한 채 검색 화면으로
  return (
    <a
      href={lastSearchHash()}
      className="no-print inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
    >
      ← 검색으로
    </a>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`mt-0.5 break-keep ${strong ? "text-lg font-bold text-gray-900" : "text-sm text-gray-800"}`}>{value}</dd>
    </div>
  );
}

const Dt = ({ children }: { children: React.ReactNode }) => <dt className="font-semibold text-gray-500">{children}</dt>;
const Dd = ({ children }: { children: React.ReactNode }) => <dd className="text-gray-800">{children}</dd>;

/* ---------- 연도별 발급 가능 경로 (정적 표, 판별기는 Phase 3) ---------- */

function cellText(c: RuleCell | undefined): { text: string; tone: "ok" | "no" | "mid" } {
  if (!c) return { text: "-", tone: "mid" };
  const note = c.note ? ` (${c.note})` : "";
  switch (c.s) {
    case "yes":
      return { text: "가능" + note, tone: "ok" };
    case "no":
      return { text: "불가", tone: "no" };
    case "partial":
      return { text: "일부/학교별" + note, tone: "mid" };
    case "from":
      return { text: `${c.status?.length ? c.status.join("·") + " 또는 " : ""}${fmt(c.from)} 이후${note}`, tone: "ok" };
    case "range":
      return { text: `${fmt(c.from)} ~ ${fmt(c.to)}${note}`, tone: "ok" };
    case "status":
      return { text: `${c.status?.join("·")}만${note}`, tone: "mid" };
    case "text":
      return { text: c.note ?? "", tone: "mid" };
  }
}

const fmt = (ym?: string) => (!ym ? "" : ym.length === 4 ? `${ym}년` : `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`);

function RuleTable({ rule, data }: { rule: Rule; data: AppData }) {
  const tones = { ok: "text-emerald-700", no: "text-gray-400", mid: "text-amber-700" };
  return (
    <Section
      title={`발급 가능 경로 — ${rule.label}`}
      right={!data.bundle.rules.reviewed ? <Badge tone="amber">검수 전</Badge> : undefined}
    >
      <p className="mb-2 text-sm text-gray-600">
        기준: <b>{rule.basis}</b> {rule.basis.includes("연") && "(출생연도가 아님)"}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {data.bundle.rules.channels.map((ch) => {
              const c = cellText(rule.cells[ch.id]);
              return (
                <tr key={ch.id} className="border-t border-gray-100">
                  <th scope="row" className="w-2/5 py-1.5 pr-3 text-left align-top font-medium text-gray-600 break-keep">
                    {ch.label}
                  </th>
                  <td className={`py-1.5 ${tones[c.tone]}`}>{c.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rule.notes.length > 0 && (
        <div className="mt-3 text-sm text-gray-600">
          <List items={rule.notes} />
        </div>
      )}
    </Section>
  );
}
