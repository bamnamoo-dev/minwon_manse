import { useEffect, useState } from "react";
import { pageImg, printedPage } from "../lib/data";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, PrinterIcon } from "./Icons";
import { printPages } from "../lib/print";

/** 원문 페이지 보기 (모달) */
export function PageViewer({ title, pages, onClose }: { title: string; pages: number[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const p = pages[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(pages.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [pages.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/85 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-paper px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{title}</div>
          <div className="text-xs tabular-nums text-muted">
            PDF {p}쪽 · 편람 인쇄 {printedPage(p)}쪽
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm tabular-nums">
          <button
            type="button"
            className="link-quiet inline-flex items-center gap-1"
            onClick={() => setI((x) => Math.max(0, x - 1))}
            disabled={i === 0}
            title="이전 쪽 (←)"
          >
            <ArrowLeftIcon size={14} />
            이전
          </button>
          <span className="text-ink">
            {i + 1} / {pages.length}
          </span>
          <button
            type="button"
            className="link-quiet inline-flex items-center gap-1"
            onClick={() => setI((x) => Math.min(pages.length - 1, x + 1))}
            disabled={i === pages.length - 1}
            title="다음 쪽 (→)"
          >
            다음
            <ArrowRightIcon size={14} />
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button type="button" className="link-quiet inline-flex items-center gap-1" onClick={() => printPages(title, pages)}>
            <PrinterIcon size={14} />
            전체 인쇄
          </button>
          <button type="button" className="link-quiet inline-flex items-center gap-1" onClick={() => printPages(`${title} (${p}쪽)`, [p])}>
            <PrinterIcon size={14} />이 쪽만
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-ink px-3 py-1.5 font-semibold text-paper hover:opacity-90"
            title="닫기 (Esc)"
          >
            <CloseIcon size={14} />
            닫기
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-6" onClick={onClose}>
        <img
          key={p}
          src={pageImg(p)}
          alt={`편람 ${p}쪽`}
          className="mx-auto w-full max-w-3xl rounded-sm bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
