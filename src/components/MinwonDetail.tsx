import { useEffect, useState } from "react";
import type { AppData } from "../lib/data";
import { printedPage } from "../lib/data";
import { lastSearchHash } from "../lib/router";
import { pushRecent } from "../lib/storage";
import type { Minwon } from "../lib/types";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  PrinterIcon,
} from "./Icons";
import { IdentityJudge, IssuanceJudge } from "./Judge";
import { PageViewer, printPages } from "./PageViewer";
import { Badge, Button, List, Section } from "./ui";

export function MinwonDetail({ data, m }: { data: AppData; m: Minwon }) {
  const [viewer, setViewer] = useState<{ title: string; pages: number[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    pushRecent(m.id);
    window.scrollTo(0, 0);
  }, [m.id]);

  const ruleIds = m.yearRuleIds.filter((id) => data.bundle.rules.rules[id]);
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
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <BackLink />
        <Button size="sm" onClick={() => setViewer({ title: `${m.title} — 편람 원문`, pages: m.sourcePages })}>
          <FileTextIcon size={14} />
          편람 원문 ({printedPage(m.sourcePages[0])}~{printedPage(m.sourcePages.at(-1)!)}쪽)
        </Button>
      </div>

      {/* 상단 요약 헤더 카드 */}
      <header className="mt-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{m.category}</Badge>
          <span className="text-xs font-medium text-slate-400">민원 {m.no}번</span>
          {!m.reviewed && <Badge tone="amber">검수 전 데이터 — 원문과 다를 수 있음</Badge>}
        </div>
        <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{m.title}</h1>
        {m.summary && <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{m.summary}</p>}

        <dl className="mt-5 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <Fact label="처리기간" value={m.period || "편람에 없음"} strong />
          <Fact label="수수료" value={m.fee || "-"} strong />
          <Fact label="신청방법" value={m.methods.join(", ") || "-"} />
          <Fact label="접수처" value={m.receivers.join(", ") || "-"} />
        </dl>
      </header>

      {/* 본문 2단 레이아웃: 좌측 상세 정보 / 우측 Sticky 판별기 */}
      <div className="mt-5 grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 space-y-4 lg:col-span-7">
          {m.guideScript && (
            <Section
              title="민원인 안내 멘트"
              highlight
              right={
                <Button size="sm" onClick={() => copy(m.guideScript)}>
                  {copied ? <CheckIcon size={14} className="text-emerald-600" /> : <CopyIcon size={14} />}
                  {copied ? "복사됨" : "멘트 복사"}
                </Button>
              }
            >
              <p className="whitespace-pre-line rounded-xl bg-brand-50/50 p-3.5 text-[15px] leading-relaxed text-slate-800">
                {m.guideScript}
              </p>
            </Section>
          )}

          <Section
            title="구비서류"
            right={m.documentsSource !== "요약표" ? <Badge tone="amber">{m.documentsSource}</Badge> : undefined}
          >
            {m.documents.length ? <List items={m.documents} /> : <p className="text-sm text-slate-500">편람에 기재 없음</p>}
            {m.officerChecks.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50 p-3.5">
                <div className="mb-1.5 text-xs font-bold text-slate-600">담당공무원 확인사항 (민원인 제출 생략)</div>
                <List items={m.officerChecks} />
              </div>
            )}
          </Section>

          {m.process.length > 0 && (
            <Section title="처리 과정">
              <div className="space-y-3.5">
                {m.process.map((p, i) => (
                  <div key={i}>
                    {p.channel && <div className="mb-2 text-xs font-bold text-brand-700">{p.channel}</div>}
                    <ol className="flex flex-wrap items-center gap-1.5">
                      {p.steps.map((s, j) => (
                        <li key={j} className="flex items-center gap-1.5">
                          <span className="rounded-lg border border-brand-100 bg-brand-50/70 px-2.5 py-1 text-sm font-medium text-slate-800">
                            {s}
                          </span>
                          {j < p.steps.length - 1 && <ArrowRightIcon size={14} className="text-slate-400" />}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="양식 (서식)">
            {m.forms.length === 0 && <p className="text-sm text-slate-500">붙임 서식 없음</p>}
            <ul className="divide-y divide-slate-100">
              {m.forms.map((f, i) => (
                <li key={i} className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="break-keep font-medium text-slate-900">{f.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {f.pdfPages.length ? `PDF ${f.pdfPages.join(", ")}쪽` : "쪽 정보 없음"}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button size="sm" onClick={() => setViewer({ title: f.name, pages: f.pdfPages })} disabled={!f.pdfPages.length}>
                      <EyeIcon size={14} />
                      원문 보기
                    </Button>
                    <Button size="sm" onClick={() => printPages(f.name, f.pdfPages)} disabled={!f.pdfPages.length}>
                      <PrinterIcon size={14} />
                      인쇄
                    </Button>
                    <Button
                      size="sm"
                      href={f.hwp ? `${import.meta.env.BASE_URL}forms/${f.hwp}` : undefined}
                      disabled={!f.hwp}
                      title={f.hwp ? "한글 서식 내려받기" : "한글(HWP) 서식이 아직 등록되지 않았습니다"}
                    >
                      <DownloadIcon size={14} />
                      HWP
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {m.infoPages.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-2.5 text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline"
                  onClick={() => setViewer({ title: `${m.title} — 참고 안내`, pages: m.infoPages })}
                >
                  <EyeIcon size={14} />
                  참고 안내 페이지 보기 (PDF {m.infoPages.join(", ")}쪽)
                </button>
              </div>
            )}
          </Section>

          {m.notes.length > 0 && (
            <Section title="참고사항">
              <List items={m.notes} />
            </Section>
          )}

          <Section title="처리 정보">
            <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[96px_1fr]">
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-4 text-xs leading-relaxed text-slate-600 sm:text-sm">
            <span className="min-w-0 flex-1">
              출처: 서울특별시교육청 「민원편람」 2025 개정판 PDF {m.sourcePages[0]}~{m.sourcePages.at(-1)}쪽 (인쇄{" "}
              {printedPage(m.sourcePages[0])}~{printedPage(m.sourcePages.at(-1)!)}쪽). 관계 법령이 개정된 경우 법령이 우선합니다.
            </span>
            <Button variant="primary" onClick={() => setViewer({ title: `${m.title} — 편람 원문`, pages: m.sourcePages })}>
              <FileTextIcon size={15} />
              편람 원문 보기
            </Button>
          </div>
        </div>

        {/* 우측 Sticky 실무 판별 사이드바 */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:col-span-5">
          {ruleIds.map((id) => (
            <IssuanceJudge key={id} data={data} ruleId={id} />
          ))}
          <IdentityJudge data={data} />
        </aside>
      </div>

      {viewer && <PageViewer title={viewer.title} pages={viewer.pages} onClose={() => setViewer(null)} />}
    </div>
  );
}

export function BackLink() {
  // 마지막 검색어·분류를 유지한 채 검색 화면으로
  return (
    <a
      href={lastSearchHash()}
      className="no-print -ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
    >
      <ArrowLeftIcon size={16} />
      검색으로
    </a>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-slate-50/90 px-3.5 py-2.5 ring-1 ring-inset ring-slate-200/60">
      <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
      <dd
        className={`mt-1 break-keep ${
          strong ? "text-base font-bold text-slate-900 sm:text-lg" : "text-xs font-medium leading-snug text-slate-700 sm:text-sm"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const Dt = ({ children }: { children: React.ReactNode }) => <dt className="font-semibold text-slate-500">{children}</dt>;
const Dd = ({ children }: { children: React.ReactNode }) => <dd className="text-slate-800">{children}</dd>;
