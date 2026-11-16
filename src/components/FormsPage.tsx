import { useEffect, useMemo, useRef, useState } from "react";
import { formUrl, type AppData } from "../lib/data";
import { choseong, compact, isChoseongOnly } from "../lib/hangul";
import type { LibraryForm } from "../lib/types";
import { CloseIcon, DownloadIcon, EyeIcon, SearchIcon } from "./Icons";

/*
 * 서식함 (#/forms) — public/forms 폴더의 서식 파일 전체
 * - 목록은 데이터 묶음을 만들 때 폴더를 읽어 자동 생성(scripts/build_data.ts) → 파일을 넣기만 하면 나타난다
 * - 분류·검색 키워드: 폴더 안 forms_catalog.json·forms_index.json, 민원 연결: data/forms_files.json
 * - 검색어는 화면 안에서만 쓴다(주소에 남기지 않음)
 */

export function FormsPage({ data }: { data: AppData }) {
  const lib = data.bundle.formsLibrary;
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    inputRef.current?.focus();
  }, []);

  // 검색용 글자: 서식 이름·번호·키워드·연결 민원 이름
  const hay = useMemo(() => {
    const m = new Map<LibraryForm, { text: string; cho: string }>();
    for (const f of lib?.items ?? []) {
      const words = [f.name, f.no ?? "", ...f.keywords, ...f.minwon.map((id) => data.minwonById.get(id)?.title ?? "")].join(" ");
      m.set(f, { text: compact(words), cho: choseong(words) });
    }
    return m;
  }, [lib, data]);

  if (!lib || !lib.items.length) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-10 text-sm text-muted sm:px-6">
        서식 파일이 없습니다. public/forms 폴더에 hwpx·pdf 파일을 넣은 뒤 npm run dev 를 다시 실행하세요.
      </div>
    );
  }

  const query = q.trim();
  const match = (f: LibraryForm) => {
    if (!query) return true;
    const h = hay.get(f)!;
    return isChoseongOnly(query) ? h.cho.includes(compact(query)) : h.text.includes(compact(query));
  };
  const shown = lib.items.filter((f) => (!group || f.group === group) && match(f));
  const groups = lib.groups.filter((g) => shown.some((f) => f.group === g));
  const countOf = (g: string) => lib.items.filter((f) => f.group === g && match(f)).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <header className="pt-8">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">서식함</h1>
        <p className="mt-2 max-w-3xl break-keep text-[14.5px] leading-relaxed text-ink-2">
          민원·인사 서식 {lib.items.length}종을 한글(HWP) 파일과 PDF로 내려받습니다. 민원 상세 화면의 서식 줄에도 같은 파일이 연결되어 있습니다.
        </p>
      </header>

      {/* 검색 + 분류 */}
      <div className="sticky top-14 z-10 -mx-4 mt-6 bg-paper/95 px-4 pb-3 pt-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3 border-b-2 border-ink pb-2 focus-within:border-accent">
          <SearchIcon size={19} className="text-ink" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="서식 이름, 초성, 키워드로 찾기 (예: 위임장, 육아휴직, ㅈㅈㅈㅁ)"
            className="min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-muted"
            autoComplete="off"
            aria-label="서식 검색"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="cursor-pointer p-1 text-muted hover:text-ink" aria-label="검색어 지우기">
              <CloseIcon size={17} />
            </button>
          )}
        </div>
        <nav className="no-scrollbar mt-3 flex gap-x-4 overflow-x-auto text-sm" aria-label="서식 분류">
          {["", ...lib.groups].map((g) => (
            <button
              key={g || "all"}
              type="button"
              onClick={() => setGroup(g)}
              className={`flex shrink-0 cursor-pointer items-baseline gap-1 ${group === g ? "font-semibold text-ink underline underline-offset-4" : "text-muted hover:text-ink"}`}
            >
              {g || "전체"}
              <span className="text-xs tabular-nums text-muted">{g ? countOf(g) : lib.items.filter(match).length}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 space-y-10">
        {!shown.length && (
          <p className="border-y border-line py-10 text-center text-sm text-muted">"{query}"에 맞는 서식이 없습니다.</p>
        )}
        {groups.map((g) => {
          const items = shown.filter((f) => f.group === g);
          return (
            <section key={g}>
              <div className="mb-1 flex items-baseline gap-2.5">
                <h2 className="text-lg font-bold tracking-[-0.01em] text-ink">{g}</h2>
                <span className="text-sm tabular-nums text-muted">{items.length}</span>
              </div>
              <ul className="border-t border-ink">
                {items.map((f) => (
                  <Row key={f.hwp} f={f} data={data} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-xs leading-relaxed text-muted">
        서식 파일은 담당자가 넣은 자료입니다. 법령·지침이 바뀌면 최신 서식인지 확인하세요. 새 서식은 public/forms 폴더에 hwpx·pdf 짝으로 넣으면 이 목록에
        추가됩니다(민원 연결은 data/forms_files.json).
      </p>
    </div>
  );
}

function Row({ f, data }: { f: LibraryForm; data: AppData }) {
  const linked = f.minwon.map((id) => data.minwonById.get(id)).filter(Boolean);
  return (
    <li className="grid gap-x-6 gap-y-1 border-b border-line px-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-baseline">
      <span className="min-w-0 text-[15px] text-ink">
        {f.no && <span className="mr-2 text-xs tabular-nums text-muted">{f.no}</span>}
        {f.name}
      </span>
      <span className="min-w-0 truncate text-[13px] text-muted">
        {f.common && <span className="mr-2">대리 신청 공통</span>}
        {linked.map((m, i) => (
          <span key={m!.id}>
            {i > 0 && " · "}
            <a href={`#/m/${m!.id}`} className="link-quiet">
              {m!.title.replace(/ 신청$/, "")}
            </a>
          </span>
        ))}
      </span>
      <span className="flex shrink-0 gap-x-3 text-[13px]">
        <a
          href={formUrl(f.hwp)}
          download
          className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-line-strong underline-offset-[3px] hover:decoration-ink"
        >
          <DownloadIcon size={13} />
          HWP
        </a>
        {f.pdf ? (
          <a href={formUrl(f.pdf)} target="_blank" rel="noreferrer" className="link-quiet inline-flex items-center gap-1">
            <EyeIcon size={13} />
            PDF
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-line-strong">
            <EyeIcon size={13} />
            PDF
          </span>
        )}
      </span>
    </li>
  );
}
