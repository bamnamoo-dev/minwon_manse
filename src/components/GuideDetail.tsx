import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { printedPage } from "../lib/data";
import type { Guide } from "../lib/types";
import { FileTextIcon } from "./Icons";
import { BackLink } from "./MinwonDetail";
import { PageViewer } from "./PageViewer";
import { Badge, Button } from "./ui";

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

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <BackLink />
        <Button variant="primary" size="sm" onClick={() => setViewer(true)}>
          <FileTextIcon size={14} />
          편람 원문 보기 (PDF {g.sourcePages[0]}~{g.sourcePages.at(-1)}쪽)
        </Button>
      </div>

      <header className="mt-3 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">업무안내</Badge>
          <span className="text-xs font-medium text-gray-500">{g.chapter}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{g.title}</h1>
        <p className="mt-2 text-xs text-gray-500">
          표가 깨져 보이면 상단의 편람 원문을 확인하세요 · 인쇄 {printedPage(g.sourcePages[0])}~{printedPage(g.sourcePages.at(-1)!)}쪽
        </p>
      </header>

      <article
        className="md mt-4 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-7"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {viewer && <PageViewer title={g.title} pages={g.sourcePages} onClose={() => setViewer(false)} />}
    </div>
  );
}
