import { useEffect, useState, type ReactNode } from "react";
import type { AppData } from "../lib/data";
import { hasIssueStep, printedPage } from "../lib/data";
import { lastSearchHash } from "../lib/router";
import { pushRecent } from "../lib/storage";
import type { Minwon } from "../lib/types";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CopyIcon, DownloadIcon, EyeIcon, FileTextIcon, PrinterIcon } from "./Icons";
import { WhereToIssue } from "./Issue";
import { IdentityJudge } from "./Judge";
import { PageViewer, printPages } from "./PageViewer";
import { DashList, Fold, Step } from "./ui";

/*
 * 민원 상세 — 창구형 배치 (docs/디자인_개편계획.md 3장)
 * - 즉시 발급형(증명서 등): 머리(처리기간·수수료·준비물) → ① 누가 왔나요 ② 주의할 점 | ③ 어디서 발급하나요
 * - 기간형(인허가·신고 등): 머리(처리기간·수수료·신청방법) → ① 구비서류 ② 주의할 점 | ③ 처리 과정 ④ 서식
 * - 덜 쓰는 정보(다른 신청 방법·서식·처리 정보·법령 등)는 아래에 접어 둔다.
 */

type Viewer = { title: string; pages: number[] } | null;

export function MinwonDetail({ data, m }: { data: AppData; m: Minwon }) {
  const [viewer, setViewer] = useState<Viewer>(null);

  useEffect(() => {
    pushRecent(m.id);
    window.scrollTo(0, 0);
  }, [m.id]);

  const issue = hasIssueStep(data, m);
  const instant = issue || m.period === "즉시";
  const openSource = () => setViewer({ title: `${m.title} — 편람 원문`, pages: m.sourcePages });
  const title = m.title.replace(/ 신청$/, "");

  let n = 0;
  const next = () => ++n;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="no-print flex items-center justify-between pt-4">
        <BackLink />
        <button type="button" onClick={openSource} className="link-quiet inline-flex items-center gap-1 text-[13px]">
          <FileTextIcon size={13} />
          편람 원문 {printedPage(m.sourcePages[0])}
          {m.sourcePages.length > 1 && `~${printedPage(m.sourcePages.at(-1)!)}`}쪽
        </button>
      </div>

      {/* 머리: 민원명 + 창구에서 바로 말할 3가지 */}
      <header className="pt-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-muted">
          <span>{m.category}</span>
          <span>민원 {m.no}</span>
          {!m.reviewed && <span className="text-amber-700">검수 전 데이터 — 원문과 다를 수 있음</span>}
        </div>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">{title}</h1>
        {m.summary && <p className="mt-2 max-w-3xl break-keep text-[14.5px] leading-relaxed text-ink-2">{m.summary}</p>}

        <dl className="mt-6 grid border-y border-line sm:grid-cols-3">
          <Fact label="처리기간" value={m.period || "편람에 없음"} accent={m.period === "즉시"} />
          <Fact label="수수료" value={m.fee || "-"} />
          {instant ? (
            <Fact label="준비물" value={m.documents.join(", ") || "편람에 기재 없음"} small note={docNote(m)} />
          ) : (
            <Fact label="신청방법" value={m.methods.join(", ") || "-"} small />
          )}
        </dl>
      </header>

      <div className="mt-9 grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {instant ? (
          <>
            <div className="min-w-0 space-y-10">
              <Step n={next()} title="누가 왔나요?" note="방문 시 신원 확인 서류">
                <IdentityJudge data={data} />
                {m.officerChecks.length > 0 && <OfficerChecks items={m.officerChecks} />}
              </Step>
              {(m.notes.length > 0 || m.guideScript) && (
                <Step n={next()} title="주의할 점" note={m.notes.length ? `편람 참고사항 ${m.notes.length}` : undefined}>
                  {m.guideScript && <GuideScript text={m.guideScript} />}
                  <DashList items={m.notes} />
                </Step>
              )}
            </div>
            <div className="min-w-0">
              {issue ? (
                <Step n={next()} title="어디서 발급하나요?" note={m.yearRuleIds.length ? "기준: 편람 발급 가능 연도표" : undefined}>
                  <WhereToIssue key={m.id} data={data} m={m} />
                </Step>
              ) : (
                <Step n={next()} title="처리 과정">
                  <Process m={m} />
                </Step>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 space-y-10">
              <Step n={next()} title="구비서류" note={docNote(m)}>
                {m.documents.length ? <DashList items={m.documents} /> : <p className="text-sm text-muted">편람에 기재 없음</p>}
                {m.officerChecks.length > 0 && <OfficerChecks items={m.officerChecks} />}
              </Step>
              {(m.notes.length > 0 || m.guideScript) && (
                <Step n={next()} title="주의할 점" note={m.notes.length ? `편람 참고사항 ${m.notes.length}` : undefined}>
                  {m.guideScript && <GuideScript text={m.guideScript} />}
                  <DashList items={m.notes} />
                </Step>
              )}
            </div>
            <div className="min-w-0 space-y-10">
              {m.process.length > 0 && (
                <Step n={next()} title="처리 과정">
                  <Process m={m} />
                </Step>
              )}
              <Step n={next()} title="서식">
                <Forms m={m} setViewer={setViewer} />
              </Step>
            </div>
          </>
        )}
      </div>

      {/* 덜 쓰는 정보: 접어 둠 */}
      <div className="mt-14 border-t border-line">
        {instant && issue && m.process.length > 0 && (
          <Fold title="다른 신청 방법" hint={m.process.map((p) => p.channel || "처리").join(" · ")}>
            <Process m={m} />
          </Fold>
        )}
        {instant && (
          <Fold title="서식" hint={m.forms.length ? m.forms.map((f) => f.name).join(", ") : "붙임 서식 없음"}>
            <Forms m={m} setViewer={setViewer} />
          </Fold>
        )}
        {!instant && (
          <Fold title="방문 시 신원 확인" hint="본인 · 법정대리인 · 대리인">
            <IdentityJudge data={data} />
          </Fold>
        )}
        <Fold title="신청방법 · 접수처" hint={[m.methods.join(", "), m.receivers.join(", ")].filter(Boolean).join(" / ")}>
          <dl className="grid gap-x-6 gap-y-2 text-sm text-ink sm:grid-cols-[88px_1fr]">
            <dt className="text-muted">신청방법</dt>
            <dd>{m.methods.join(", ") || "-"}</dd>
            <dt className="text-muted">접수처</dt>
            <dd>{m.receivers.join(", ") || "-"}</dd>
          </dl>
        </Fold>
        <Fold title="처리 정보 · 관련 법령" hint={[m.dept, m.approval && `최종결재 ${m.approval}`].filter(Boolean).join(" · ")}>
          <dl className="grid gap-x-6 gap-y-2 text-sm text-ink sm:grid-cols-[88px_1fr]">
            <dt className="text-muted">처리과</dt>
            <dd>{m.dept || "-"}</dd>
            <dt className="text-muted">공부대조</dt>
            <dd>{m.ledger || "-"}</dd>
            <dt className="text-muted">최종결재</dt>
            <dd>{m.approval || "-"}</dd>
            <dt className="text-muted">관련근거</dt>
            <dd className="space-y-1">{m.laws.length ? m.laws.map((l, i) => <div key={i}>{l}</div>) : "-"}</dd>
          </dl>
        </Fold>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        출처: 서울특별시교육청 「민원편람」 2025 개정판 PDF {m.sourcePages[0]}~{m.sourcePages.at(-1)}쪽 (인쇄 {printedPage(m.sourcePages[0])}~
        {printedPage(m.sourcePages.at(-1)!)}쪽). 관계 법령이 개정된 경우 법령이 우선합니다.
        {data.bundle.manuals?.links[m.id] && " 발급 시스템 화면은 각 시스템 사용자 매뉴얼에서 자동 추출한 것입니다."}{" "}
        <button type="button" onClick={openSource} className="link-quiet no-print">
          편람 원문 보기
        </button>
      </p>

      {viewer && <PageViewer title={viewer.title} pages={viewer.pages} onClose={() => setViewer(null)} />}
    </div>
  );
}

const docNote = (m: Minwon) => (m.documentsSource && m.documentsSource !== "요약표" ? m.documentsSource : undefined);

export function BackLink() {
  // 마지막 검색어·분류를 유지한 채 검색 화면으로
  return (
    <a href={lastSearchHash()} className="no-print -ml-1 inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
      <ArrowLeftIcon size={15} />
      검색으로
    </a>
  );
}

function Fact({ label, value, accent, small, note }: { label: string; value: string; accent?: boolean; small?: boolean; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-3 first:border-t-0 sm:block sm:border-l sm:border-t-0 sm:py-3.5 sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`break-keep text-right font-semibold tracking-[-0.01em] sm:mt-1 sm:text-left ${
          small ? "text-base leading-snug sm:text-lg" : "text-xl sm:text-2xl"
        } ${accent ? "text-accent" : "text-ink"}`}
      >
        {value}
        {note && <span className="mt-0.5 block text-xs font-normal text-amber-700">{note}</span>}
      </dd>
    </div>
  );
}

function OfficerChecks({ items }: { items: string[] }) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 text-[13px] font-semibold text-ink-2">담당공무원 확인사항 (민원인 제출 생략)</div>
      <DashList items={items} />
    </div>
  );
}

function GuideScript({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("복사하지 못했습니다. 직접 선택해서 복사해 주세요.");
    }
  };
  return (
    <div className="mb-5 border-l-2 border-accent pl-3.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-2">민원인 안내 멘트</span>
        <button type="button" onClick={copy} className="link-quiet inline-flex items-center gap-1 text-xs">
          {copied ? <CheckIcon size={13} className="text-emerald-700" /> : <CopyIcon size={13} />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function Process({ m }: { m: Minwon }) {
  if (!m.process.length) return <p className="text-sm text-muted">편람에 처리 과정 없음</p>;
  return (
    <div className="space-y-4">
      {m.process.map((p, i) => (
        <div key={i} className={p.channel ? "grid gap-1 sm:grid-cols-[96px_1fr]" : ""}>
          {p.channel && <div className="text-sm font-semibold text-ink">{p.channel}</div>}
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14.5px] text-ink-2">
            {p.steps.map((s, j) => (
              <li key={j} className="flex items-center gap-1.5">
                {s}
                {j < p.steps.length - 1 && <ArrowRightIcon size={12} className="text-muted" />}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Forms({ m, setViewer }: { m: Minwon; setViewer: (v: Viewer) => void }) {
  return (
    <div>
      {m.forms.length === 0 && <p className="text-sm text-muted">붙임 서식 없음</p>}
      <ul className="divide-y divide-line">
        {m.forms.map((f, i) => (
          <li key={i} className="flex flex-col gap-1.5 py-2.5 first:pt-0 sm:flex-row sm:items-baseline sm:gap-4">
            <div className="min-w-0 flex-1">
              <span className="break-keep text-[15px] text-ink">{f.name}</span>
              <span className="ml-2 text-xs text-muted">{f.pdfPages.length ? `PDF ${f.pdfPages.join(", ")}쪽` : "쪽 정보 없음"}</span>
            </div>
            <div className="flex shrink-0 gap-3 text-[13px]">
              <Act onClick={() => setViewer({ title: f.name, pages: f.pdfPages })} disabled={!f.pdfPages.length} icon={<EyeIcon size={13} />}>
                원문
              </Act>
              <Act onClick={() => printPages(f.name, f.pdfPages)} disabled={!f.pdfPages.length} icon={<PrinterIcon size={13} />}>
                인쇄
              </Act>
              {f.hwp ? (
                <a href={`${import.meta.env.BASE_URL}forms/${f.hwp}`} download className="link-quiet inline-flex items-center gap-1">
                  <DownloadIcon size={13} />
                  HWP
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-line-strong" title="한글(HWP) 서식이 아직 등록되지 않았습니다">
                  <DownloadIcon size={13} />
                  HWP
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {m.infoPages.length > 0 && (
        <button
          type="button"
          className="link-quiet mt-3 inline-flex items-center gap-1 text-[13px]"
          onClick={() => setViewer({ title: `${m.title} — 참고 안내`, pages: m.infoPages })}
        >
          <EyeIcon size={13} />
          서식 앞 참고 안내 보기 (PDF {m.infoPages.join(", ")}쪽)
        </button>
      )}
    </div>
  );
}

function Act({ onClick, disabled, icon, children }: { onClick: () => void; disabled?: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="link-quiet inline-flex items-center gap-1">
      {icon}
      {children}
    </button>
  );
}
