import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "../lib/data";
import { href, rememberSearch, replaceHash } from "../lib/router";
import type { Hit } from "../lib/search";
import { getRecent } from "../lib/storage";
import type { Minwon } from "../lib/types";
import { ArrowRightIcon, ClockIcon, CloseIcon, CompassIcon, FileTextIcon, SearchIcon } from "./Icons";
import { Badge } from "./ui";

const QUICK_QUERIES = ["생기부", "졸업증명서", "ㅈㅇㅈㅁ", "학원 등록", "폐교 졸업"];

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

  const hits = useMemo(() => data.index.search(q, { category: cat || undefined }), [data, q, cat]);
  const recent = useMemo(() => getRecent().map((id) => data.minwonById.get(id)).filter(Boolean) as Minwon[], [data]);

  const open = (h: Hit) => (window.location.hash = h.doc.kind === "minwon" ? `#/m/${h.doc.id}` : `#/g/${h.doc.id}`);

  const searchBox = (hero: boolean) => (
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
      <div
        className={`flex items-center gap-2.5 rounded-2xl bg-white px-4 transition ${
          hero
            ? "py-3.5 shadow-lg shadow-slate-950/15 ring-1 ring-white/20 focus-within:ring-4 focus-within:ring-brand-200/70"
            : "border border-slate-200 py-2.5 shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100/80"
        }`}
      >
        <SearchIcon size={20} className="text-brand-600" />
        <input
          id="q"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="민원 이름, 초성, 내용으로 검색 (예: 생기부, ㅈㅇㅈㅁ, 학원 등록)"
          className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-lg"
          autoComplete="off"
          enterKeyHint="search"
        />
        {input ? (
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setInput("")}
            aria-label="검색어 지우기"
          >
            <CloseIcon size={18} />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:inline">
            /
          </kbd>
        )}
      </div>
    </form>
  );

  // 검색어가 입력된 상태: 컴팩트 sticky 검색바 + 결과 리스트
  if (q) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="sticky top-14 z-10 -mx-4 bg-paper/95 px-4 pb-3 pt-4 backdrop-blur-md sm:-mx-6 sm:px-6">
          {searchBox(false)}
          <nav className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap" aria-label="분류">
            {["", ...data.categories].map((c) => {
              const active = cat === c;
              return (
                <a
                  key={c || "all"}
                  href={href("/", { q: input.trim() || undefined, c: c || undefined })}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition sm:text-sm ${
                    active
                      ? "bg-brand-600 text-white shadow-xs"
                      : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {c || "전체"}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="mt-2">
          <Results hits={hits} q={q} />
        </div>
      </div>
    );
  }

  // 홈(검색어 없음): 히어로 + 퀵 액세스 + 2단 디렉토리
  return (
    <div className="pb-16">
      {/* 히어로 검색 배너 */}
      <section className="bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">어떤 민원을 찾고 계신가요?</h1>
              <p className="mt-1 text-xs text-brand-100/90 sm:text-sm">
                민원 {data.bundle.minwon.length}건 · 업무안내 {data.bundle.guides.length}건 즉시 검색 (초성·동의어 지원)
              </p>
            </div>
          </div>

          <div className="mt-4">{searchBox(true)}</div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-brand-200">자주 찾는 검색어</span>
            {QUICK_QUERIES.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => setInput(kw)}
                className="cursor-pointer rounded-full bg-white/10 px-2.5 py-1 font-medium text-white/95 ring-1 ring-white/15 transition hover:bg-white/20"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4 sm:px-6">
        {/* 퀵 액세스: 발급경로 판별기 + 최근 본 민원 */}
        <div className="grid gap-4 lg:grid-cols-12">
          <a
            href="#/judge"
            className="group flex items-center gap-3.5 rounded-2xl border border-brand-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-brand-600 hover:shadow-sm lg:col-span-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
              <CompassIcon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900 sm:text-base">발급 경로 판별기</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                연도·나이로 NEIS·정부24·무인발급기·FAX 및 대리 서류 확인
              </span>
            </span>
            <ArrowRightIcon size={18} className="text-brand-600 transition-transform group-hover:translate-x-0.5" />
          </a>

          <div className="flex flex-col justify-center rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:col-span-7">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <ClockIcon size={14} className="text-slate-400" />
              <span>최근 본 민원</span>
            </div>
            {recent.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {recent.map((m) => (
                  <a
                    key={m.id}
                    href={`#/m/${m.id}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 sm:text-sm"
                  >
                    {m.title}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 sm:text-sm">열어본 민원이 여기에 자동으로 표시됩니다.</p>
            )}
          </div>
        </div>

        <Browse data={data} cat={cat} />
      </div>
    </div>
  );
}

function Results({ hits, q }: { hits: Hit[]; q: string }) {
  if (!hits.length) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        <p className="text-base font-semibold text-slate-700">"{q}"에 맞는 민원을 찾지 못했습니다.</p>
        <p className="mt-2 text-sm">다른 표현이나 띄어쓰기를 바꿔 보세요. (예: 생활기록부 → 생기부, 졸업장)</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2.5 flex items-center justify-between text-xs font-medium text-slate-500 sm:text-sm">
        <span>
          검색 결과 <b className="text-slate-900">{hits.length}</b>건
        </span>
        <span className="hidden text-slate-400 sm:inline">Enter 키를 누르면 첫 번째 결과로 이동</span>
      </p>
      <ol className="space-y-2.5">
        {hits.map((h, i) => (
          <li key={h.doc.id}>
            <a
              href={h.doc.kind === "minwon" ? `#/m/${h.doc.id}` : `#/g/${h.doc.id}`}
              className={`group block rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-brand-600 hover:shadow-sm ${
                i === 0 ? "border-brand-200 ring-1 ring-brand-100" : "border-slate-200/90"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {h.doc.kind === "minwon" ? (
                  <Badge tone="blue">{h.doc.item.category}</Badge>
                ) : (
                  <Badge tone="green">업무안내</Badge>
                )}
                <span className="text-base font-semibold text-slate-900 group-hover:text-brand-700 sm:text-lg">
                  {h.doc.item.title}
                </span>
                {i === 0 && (
                  <span className="ml-auto hidden rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 sm:inline">
                    Enter ↵
                  </span>
                )}
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{h.snippet}</p>
              {h.doc.kind === "minwon" && <Meta m={h.doc.item} />}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Meta({ m }: { m: Minwon }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1">
        <ClockIcon size={13} className="text-slate-400" />
        처리기간 <b className="font-semibold text-slate-700">{m.period || "-"}</b>
      </span>
      <span>
        수수료 <b className="font-semibold text-slate-700">{m.fee || "-"}</b>
      </span>
      <span className="truncate text-slate-500">신청: {m.methods.join(", ") || "-"}</span>
    </div>
  );
}

function Browse({ data, cat }: { data: AppData; cat: string }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of data.bundle.minwon) m.set(item.category, (m.get(item.category) ?? 0) + 1);
    return m;
  }, [data]);

  const guidesByChapter = useMemo(() => {
    const m = new Map<string, typeof data.bundle.guides>();
    for (const g of data.bundle.guides) m.set(g.chapter, [...(m.get(g.chapter) ?? []), g]);
    return m;
  }, [data]);
  const chapters = useMemo(() => [...guidesByChapter.keys()], [guidesByChapter]);
  const [activeChap, setActiveChap] = useState(chapters[0] ?? "");

  const cats = cat ? [cat] : data.categories;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
      {/* 모바일: 가로 스크롤 분류 칩 */}
      <nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden" aria-label="분류">
        {["", ...data.categories].map((c) => {
          const active = cat === c;
          return (
            <a
              key={c || "all"}
              href={href("/", { c: c || undefined })}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-brand-600 text-white shadow-xs"
                  : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-slate-50"
              }`}
            >
              {c || "전체"} ({c ? counts.get(c) ?? 0 : data.bundle.minwon.length})
            </a>
          );
        })}
      </nav>

      {/* 데스크톱: 좌측 Sticky 분류 인덱스 */}
      <aside className="hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] lg:sticky lg:top-20 lg:block">
        <div className="mb-2 px-2 text-xs font-bold text-slate-400">민원 분류</div>
        <nav className="space-y-0.5" aria-label="민원 분류">
          {["", ...data.categories].map((c) => {
            const active = cat === c;
            const count = c ? counts.get(c) ?? 0 : data.bundle.minwon.length;
            return (
              <a
                key={c || "all"}
                href={href("/", { c: c || undefined })}
                className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-sm transition ${
                  active
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="truncate">{c || "전체 민원"}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </a>
            );
          })}
        </nav>
      </aside>

      {/* 우측 메인 콘텐츠 */}
      <div className="min-w-0 space-y-6">
        {cats.map((c) => {
          const items = data.bundle.minwon.filter((m) => m.category === c);
          return (
            <section key={c}>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-brand-600" aria-hidden />
                  <h2 className="text-base font-bold text-slate-900">{c}</h2>
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {items.length}
                  </span>
                </div>
                {!cat && (
                  <a href={href("/", { c })} className="text-xs font-medium text-brand-600 hover:underline">
                    이 분류만 보기
                  </a>
                )}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((m) => (
                  <a
                    key={m.id}
                    href={`#/m/${m.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition hover:border-brand-600 hover:shadow-xs"
                  >
                    <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
                      {m.title}
                    </div>
                    <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                      {/* 처리기간이 긴 민원(예: 학교시설 사용)은 말줄임 — 전체는 마우스를 올리면 보임 */}
                      <span
                        className="max-w-[70%] shrink-0 truncate rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600"
                        title={m.period || undefined}
                      >
                        {m.period || "-"}
                      </span>
                      <span className="truncate">{m.methods.slice(0, 2).join(", ") || "-"}</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );
        })}

        {!cat && chapters.length > 0 && (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileTextIcon size={17} className="text-emerald-700" />
                <h2 className="text-base font-bold text-slate-900">업무안내</h2>
                <span className="text-xs text-slate-500">편람 II·III·IV·VI장</span>
              </div>
            </div>
            <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto border-b border-slate-100 pb-2.5">
              {chapters.map((chap) => {
                const active = activeChap === chap;
                return (
                  <button
                    key={chap}
                    type="button"
                    onClick={() => setActiveChap(chap)}
                    className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      active ? "bg-emerald-50 font-semibold text-emerald-800 ring-1 ring-emerald-200" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {chap}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(guidesByChapter.get(activeChap) ?? []).map((g) => (
                <a
                  key={g.id}
                  href={`#/g/${g.id}`}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-600 hover:bg-emerald-50/40 hover:text-emerald-800"
                >
                  {g.title}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
