import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "../lib/data";
import { href, rememberSearch, replaceHash } from "../lib/router";
import type { Hit } from "../lib/search";
import { getRecent } from "../lib/storage";
import type { Guide, Minwon } from "../lib/types";
import { ArrowRightIcon, CloseIcon, SearchIcon } from "./Icons";

/*
 * 검색·홈 (docs/디자인_개편계획.md 3장)
 * - 배너 없이 검색창이 주인공. 화면 위에 붙어(sticky) 어디서든 바로 다시 검색
 * - 결과·목록은 카드 대신 구분선 목록 줄: 민원명 · 처리기간 · 신청방법이 한 줄에
 * - 검색은 전부 브라우저 안에서(src/lib/search.ts). 검색어·분류만 주소(#/?q=&c=)에 남는다
 */

const QUICK_QUERIES = ["생기부", "졸업증명서", "ㅈㅇㅈㅁ", "학원 등록", "폐교 졸업"];

/** 주소의 c 값: 없음 = 홈에서는 첫 분류(학생), 검색에서는 전체 / "all" = 전체를 직접 고름 / 그 밖 = 분류 이름 */
const ALL = "all";

export function SearchPage({ data, q, cat }: { data: AppData; q: string; cat: string }) {
  const [input, setInput] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  // 입력 → 주소(해시)에 반영 (뒤로가기로 검색 결과 복귀 가능)
  useEffect(() => {
    const t = setTimeout(() => {
      const h = href("/", { q: input.trim() || undefined, c: cat || undefined });
      rememberSearch(h);
      replaceHash(h);
    }, 150);
    return () => clearTimeout(t);
  }, [input, cat]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // '/' 키로 검색창 포커스
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 주소가 바깥에서 바뀐 경우(로고 클릭, 뒤로가기 등) 입력창을 주소에 맞춘다
  useEffect(() => {
    setInput((cur) => (cur.trim() === q.trim() ? cur : q));
  }, [q]);

  const filter = cat && cat !== ALL ? cat : ""; // 검색 결과 거르기(없으면 전체)
  const hits = useMemo(() => data.index.search(q, { category: filter || undefined }), [data, q, filter]);
  // 홈 첫 화면은 가장 많이 찾는 첫 분류(데이터 순서상 학생)를 보여준다 — 담당자 요청 2026-11-16
  const homeCat = cat === ALL ? "" : cat || data.categories[0] || "";
  const open = (h: Hit) => (window.location.hash = hitHref(h));

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of data.bundle.minwon) m.set(item.category, (m.get(item.category) ?? 0) + 1);
    return m;
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* 검색창 — 화면 위에 붙어 있음 */}
      <div className="sticky top-14 z-10 -mx-4 bg-paper/95 px-4 pb-3 pt-6 backdrop-blur-md sm:-mx-6 sm:px-6">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (hits[0]) open(hits[0]);
          }}
        >
          <label htmlFor="q" className="sr-only">
            민원 검색
          </label>
          <div className="flex items-center gap-3 border-b-2 border-ink pb-2.5 focus-within:border-accent">
            <SearchIcon size={22} className="text-ink" />
            <input
              id="q"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="민원 이름, 초성, 내용으로 검색"
              className="min-w-0 flex-1 bg-transparent text-xl font-medium tracking-[-0.01em] text-ink outline-none placeholder:font-normal placeholder:text-muted sm:text-[22px]"
              autoComplete="off"
              enterKeyHint="search"
            />
            {input ? (
              <button
                type="button"
                className="cursor-pointer p-1 text-muted hover:text-ink"
                onClick={() => {
                  setInput("");
                  inputRef.current?.focus();
                }}
                aria-label="검색어 지우기"
              >
                <CloseIcon size={18} />
              </button>
            ) : (
              <kbd className="hidden rounded border border-line-strong px-1.5 text-[11px] text-muted sm:inline" title="어디서든 / 키로 검색창으로">
                /
              </kbd>
            )}
          </div>
        </form>

        {/* 검색창 아래 한 줄: 홈에서는 안내·자주 찾는 검색어, 검색 중에는 분류 거르기 */}
        {q ? (
          <nav className="no-scrollbar mt-3 flex gap-x-4 gap-y-1 overflow-x-auto text-sm sm:flex-wrap" aria-label="분류">
            {["", ...data.categories].map((c) => (
              <a
                key={c || "all"}
                href={href("/", { q: input.trim() || undefined, c: c || undefined })}
                className={`shrink-0 ${filter === c ? "font-semibold text-ink underline underline-offset-4" : "text-muted hover:text-ink"}`}
              >
                {c || "전체"}
              </a>
            ))}
          </nav>
        ) : (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="text-muted">
              민원 {data.bundle.minwon.length}건 · 업무안내 {data.bundle.guides.length}건 · 초성·줄임말 검색
            </span>
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-muted">자주 찾는</span>
              {QUICK_QUERIES.map((kw) => (
                <button key={kw} type="button" onClick={() => setInput(kw)} className="link-quiet">
                  {kw}
                </button>
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6">{q ? <Results hits={hits} q={q} /> : <Home data={data} cat={homeCat} counts={counts} />}</div>
    </div>
  );
}

const hitHref = (h: Hit) => (h.doc.kind === "minwon" ? `#/m/${h.doc.id}` : `#/g/${h.doc.id}`);

/* ───────── 검색 결과 ───────── */
function Results({ hits, q }: { hits: Hit[]; q: string }) {
  if (!hits.length) {
    return (
      <div className="border-y border-line py-10 text-center">
        <p className="text-base font-semibold text-ink">"{q}"에 맞는 민원을 찾지 못했습니다.</p>
        <p className="mt-2 text-sm text-muted">다른 표현이나 띄어쓰기를 바꿔 보세요. (예: 생활기록부 → 생기부, 졸업장)</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 flex items-baseline justify-between text-[13px] text-muted">
        <span>
          검색 결과 <b className="font-semibold text-ink tabular-nums">{hits.length}</b>건
        </span>
        <span className="hidden sm:inline">Enter — 첫 번째 결과 열기</span>
      </p>
      <ol className="divide-y divide-line border-y border-line">
        {hits.map((h, i) => (
          <li key={h.doc.id}>
            <a
              href={hitHref(h)}
              className={`group grid gap-x-5 gap-y-1 px-2 py-3.5 transition-colors hover:bg-sunk sm:grid-cols-[108px_1fr] ${i === 0 ? "bg-sunk/60" : ""}`}
            >
              <span className="pt-0.5 text-[13px] text-muted">{h.doc.kind === "minwon" ? h.doc.item.category : "업무안내"}</span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-3">
                  <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink group-hover:underline group-hover:underline-offset-4">
                    {h.doc.item.title}
                  </span>
                  {i === 0 && <span className="ml-auto hidden shrink-0 text-xs text-muted sm:inline">Enter ↵</span>}
                </span>
                {h.snippet && <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-ink-2">{h.snippet}</span>}
                {h.doc.kind === "minwon" && <Meta m={h.doc.item} />}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Meta({ m }: { m: Minwon }) {
  return (
    <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-muted">
      <span>
        처리기간 <b className="font-semibold text-ink-2">{m.period || "-"}</b>
      </span>
      <span>
        수수료 <b className="font-semibold text-ink-2">{m.fee || "-"}</b>
      </span>
      <span className="min-w-0 truncate">신청 {m.methods.join(", ") || "-"}</span>
    </span>
  );
}

/* ───────── 홈: 분류 목록 | 최근 본 민원 + 민원 목록 + 업무안내 ───────── */
function Home({ data, cat, counts }: { data: AppData; cat: string; counts: Map<string, number> }) {
  const recent = useMemo(() => getRecent().map((id) => data.minwonById.get(id)).filter(Boolean) as Minwon[], [data]);
  const cats = cat ? [cat] : data.categories;

  return (
    <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[188px_1fr] lg:items-start">
      {/* 분류 */}
      <nav className="no-scrollbar flex gap-x-4 overflow-x-auto text-sm lg:sticky lg:top-44 lg:block lg:space-y-0.5" aria-label="민원 분류">
        {["", ...data.categories].map((c) => {
          const active = cat === c;
          return (
            <a
              key={c || "all"}
              href={href("/", { c: c || ALL })}
              className={`flex shrink-0 items-baseline justify-between gap-3 rounded-md py-1.5 lg:px-2.5 ${
                active ? "font-semibold text-ink lg:bg-sunk" : "text-ink-2 hover:text-ink"
              }`}
            >
              <span className="truncate">{c || "전체 민원"}</span>
              <span className="text-xs tabular-nums text-muted">{c ? counts.get(c) ?? 0 : data.bundle.minwon.length}</span>
            </a>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-10">
        {/* 최근 본 민원 · 판별기 */}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-line pb-3 text-sm">
          <span className="text-muted">최근 본 민원</span>
          {recent.length ? (
            recent.map((m) => (
              <a key={m.id} href={`#/m/${m.id}`} className="link-quiet">
                {m.title.replace(/ 신청$/, "")}
              </a>
            ))
          ) : (
            <span className="text-muted">열어본 민원이 여기에 표시됩니다</span>
          )}
          <a href="#/judge" className="ml-auto inline-flex items-center gap-1 font-medium text-ink hover:underline hover:underline-offset-4">
            발급 경로 판별기
            <ArrowRightIcon size={13} />
          </a>
        </div>

        {cats.map((c) => {
          const items = data.bundle.minwon.filter((m) => m.category === c);
          return (
            <section key={c}>
              <div className="mb-1 flex items-baseline gap-2.5">
                <h2 className="text-lg font-bold tracking-[-0.01em] text-ink">{c}</h2>
                <span className="text-sm tabular-nums text-muted">{items.length}</span>
                {!cat && (
                  <a href={href("/", { c })} className="link-quiet ml-auto text-[13px]">
                    이 분류만
                  </a>
                )}
              </div>
              <ul className="grid border-t border-ink xl:grid-cols-2 xl:gap-x-8">
                {items.map((m) => (
                  <li key={m.id} className="border-b border-line">
                    <a
                      href={`#/m/${m.id}`}
                      className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-1 py-2.5 transition-colors hover:bg-sunk"
                    >
                      <span className="min-w-0 truncate text-[15px] text-ink group-hover:underline group-hover:underline-offset-4" title={m.title}>
                        {m.title.replace(/ 신청$/, "")}
                      </span>
                      <span
                        className={`max-w-40 truncate text-right text-[13px] tabular-nums ${m.period === "즉시" ? "text-accent" : "text-muted"}`}
                        title={m.period || undefined}
                      >
                        {m.period || "-"}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {!cat && <Guides guides={data.bundle.guides} />}
      </div>
    </div>
  );
}

function Guides({ guides }: { guides: Guide[] }) {
  const byChapter = useMemo(() => {
    const m = new Map<string, Guide[]>();
    for (const g of guides) m.set(g.chapter, [...(m.get(g.chapter) ?? []), g]);
    return m;
  }, [guides]);
  const chapters = [...byChapter.keys()];
  const [active, setActive] = useState(chapters[0] ?? "");
  if (!chapters.length) return null;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="text-lg font-bold tracking-[-0.01em] text-ink">업무안내</h2>
        <span className="text-sm text-muted">편람 II·III·IV·VI장</span>
      </div>
      <div className="no-scrollbar mb-1 flex gap-x-4 overflow-x-auto text-sm">
        {chapters.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={`shrink-0 cursor-pointer py-1 ${active === c ? "font-semibold text-ink underline underline-offset-4" : "text-muted hover:text-ink"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="grid border-t border-ink xl:grid-cols-2 xl:gap-x-8">
        {(byChapter.get(active) ?? []).map((g) => (
          <li key={g.id} className="border-b border-line">
            <a href={`#/g/${g.id}`} className="block truncate px-1 py-2.5 text-[15px] text-ink transition-colors hover:bg-sunk hover:underline hover:underline-offset-4">
              {g.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
