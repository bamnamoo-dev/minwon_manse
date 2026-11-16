import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { printedPage } from "../lib/data";
import type { Guide } from "../lib/types";
import { FileTextIcon } from "./Icons";
import { BackLink } from "./MinwonDetail";
import { PageViewer } from "./PageViewer";
import { NavyHero } from "./ui";

/* 업무안내(편람 II·III·IV·VI장) — 문서형: 머리 + 읽기 폭 본문(.md), 카드 없음 */
export function GuideDetail({ g }: { g: Guide }) {
  const [viewer, setViewer] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0); // (최신 브라우저는 Promise를 반환하므로 반환값을 넘기지 않는다)
  }, [g.id]);

  // 편람에서 추출한 우리 데이터(외부 입력 아님)만 렌더링한다. 스크립트 태그는 제거.
  const html = useMemo(
    () =>
      (marked.parse(g.markdown.replace(/<!--[\s\S]*?-->/g, ""), { async: false }) as string).replace(
        /<script[\s\S]*?<\/script>/gi,
        "",
      ),
    [g.markdown],
  );
  const pages = `${printedPage(g.sourcePages[0])}${g.sourcePages.length > 1 ? `~${printedPage(g.sourcePages.at(-1)!)}` : ""}`;

  return (
    <div>
      <NavyHero>
        <div className="no-print flex items-center justify-between">
          <BackLink />
          <button
            type="button"
            onClick={() => setViewer(true)}
            className="inline-flex cursor-pointer items-center gap-1 text-[13px] text-white/75 underline decoration-white/30 underline-offset-[3px] hover:text-white"
          >
            <FileTextIcon size={13} />
            편람 원문 {pages}쪽
          </button>
        </div>
        <header className="mx-auto max-w-3xl pt-5">
          <div className="flex flex-wrap items-baseline gap-x-3 text-[13px] text-white/60">
            <span>업무안내</span>
            <span>{g.chapter}</span>
            {!g.reviewed && <span className="text-amber-300">검수 전 데이터</span>}
          </div>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[32px]">{g.title}</h1>
          <p className="mt-2 text-[13px] text-white/60">편람 인쇄 {pages}쪽 · 표가 깨져 보이면 편람 원문을 확인하세요</p>
        </header>
      </NavyHero>

      <div className="mx-auto -mt-14 max-w-6xl px-4 pb-20 sm:px-6">
        <article className="md panel mx-auto max-w-3xl px-6 py-4 text-[15.5px] sm:px-10 sm:py-6" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {viewer && <PageViewer title={g.title} pages={g.sourcePages} onClose={() => setViewer(false)} />}
    </div>
  );
}
