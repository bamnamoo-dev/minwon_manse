import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { categoryTint, tintAt, type Tint } from "../lib/colors";
import type { AppData } from "../lib/data";
import { href, rememberSearch, replaceHash } from "../lib/router";
import type { Hit } from "../lib/search";
import { getRecent } from "../lib/storage";
import type { Guide, Minwon } from "../lib/types";
import { ArrowRightIcon, BookIcon, ClockIcon, CloseIcon, CompassIcon, FileTextIcon, FolderIcon, SearchIcon, ShieldIcon } from "./Icons";

/*
 * 검색·홈 — 포털(aisen.kr) 컨셉 (docs/디자인_개편계획.md)
 * - 남색 머리 띠: 큰 제목 + 검색창 + 자주 찾는 칩, 그 아래로 흰 카드가 걸쳐 올라온다
 * - 자주 쓰는 민원 타일(매뉴얼이 연결된 민원 + 판별기·서식함), 최근 본 민원
 * - 분류별 카드: 분류마다 색 점·배지(색은 분류 순서로 자동, src/lib/colors.ts)
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

  const searchBox = (
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
      <div className="flex items-center gap-2 rounded-xl bg-white p-1.5 pl-4 shadow-[0_8px_30px_rgb(0_0_0/0.18)] ring-4 ring-white/10 focus-within:ring-white/25">
        <SearchIcon size={20} className="text-accent" />
        <input
          id="q"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="민원 이름, 초성, 내용으로 검색 (예: 생기부, ㅈㅇㅈㅁ)"
          className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-muted"
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
            <CloseIcon size={17} />
          </button>
        ) : (
          <kbd className="hidden rounded border border-line-strong px-1.5 text-[11px] text-muted sm:inline" title="어디서든 / 키로 검색창으로">
            /
          </kbd>
        )}
        <button type="submit" className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-ink">
          {q ? "첫 결과 열기" : "검색"}
        </button>
      </div>
    </form>
  );

  /* 검색 중: 얇은 남색 띠 + 결과 */
  if (q) {
    return (
      <div>
        <section className="bg-navy pb-6 pt-6 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {searchBox}
            <nav className="no-scrollbar mt-4 flex gap-2 overflow-x-auto text-[13px] sm:flex-wrap" aria-label="분류">
              {["", ...data.categories].map((c) => (
                <a
                  key={c || "all"}
                  href={href("/", { q: input.trim() || undefined, c: c || undefined })}
                  className={`shrink-0 rounded-full px-3 py-1 ring-1 transition ${
                    filter === c ? "bg-white font-semibold text-navy ring-white" : "text-white/80 ring-white/25 hover:bg-white/10"
                  }`}
                >
                  {c || "전체"}
                </a>
              ))}
            </nav>
          </div>
        </section>
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
          <Results data={data} hits={hits} q={q} />
        </div>
      </div>
    );
  }

  /* 홈: 남색 머리 띠 + 걸쳐 올라오는 카드 */
  return (
    <div className="pb-20">
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-28 pt-10 sm:px-6 lg:grid-cols-[1fr_560px]">
          <div>
            <h1 className="text-[30px] font-bold leading-[1.25] tracking-[-0.03em] sm:text-[38px]">
              편람은 찾아보고,
              <br />
              발급은 바로 하세요
            </h1>
            <p className="mt-4 flex items-center gap-1.5 text-[13.5px] text-white/75">
              <ShieldIcon size={15} />
              입력한 생년월일·나이는 이 PC 브라우저에서만 처리됩니다
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-white/75">
              <BookIcon size={15} />
              민원 <b className="text-white">{data.bundle.minwon.length}</b>건 · 업무안내 <b className="text-white">{data.bundle.guides.length}</b>건 · 서식{" "}
              <b className="text-white">{data.bundle.formsLibrary?.items.length ?? 0}</b>종
            </p>
          </div>
          <div>
            {searchBox}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-white/70">자주 찾는</span>
              {QUICK_QUERIES.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => setInput(kw)}
                  className="cursor-pointer rounded-full px-3 py-1 text-white/90 ring-1 ring-white/25 transition hover:bg-white/10"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-16 max-w-6xl space-y-10 px-4 sm:px-6">
        <QuickRow data={data} />
        <AllMinwon data={data} cat={homeCat} />
        <BottomRow data={data} />
      </div>
    </div>
  );
}

const hitHref = (h: Hit) => (h.doc.kind === "minwon" ? `#/m/${h.doc.id}` : `#/g/${h.doc.id}`);

/** 처리기간 배지: 즉시는 초록, 그 밖은 회색 */
function PeriodBadge({ period }: { period: string }) {
  const instant = period === "즉시";
  return (
    <span
      className={`max-w-36 shrink-0 truncate rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold ${
        instant ? "bg-emerald-50 text-emerald-700" : "bg-sunk text-ink-2"
      }`}
      title={period || undefined}
    >
      {period || "-"}
    </span>
  );
}

function IconTile({ tint, children, size = 40 }: { tint: Tint; children: ReactNode; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl" style={{ width: size, height: size, background: tint.bg, color: tint.fg }}>
      {children}
    </span>
  );
}

/* ───────── 자주 쓰는 민원 + 최근 본 민원 ───────── */
function QuickRow({ data }: { data: AppData }) {
  const recent = useMemo(() => getRecent().map((id) => data.minwonById.get(id)).filter(Boolean) as Minwon[], [data]);
  // 자주 쓰는 민원 = 발급 시스템 매뉴얼이 연결된 민원(data/manuals/links.json) — 창구 즉시 발급 학생 민원
  const quick = Object.keys(data.bundle.manuals?.links ?? {})
    .sort()
    .map((id) => data.minwonById.get(id))
    .filter(Boolean)
    .slice(0, 4) as Minwon[];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="panel p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold text-ink">자주 쓰는 민원</h2>
          <span className="text-xs text-muted">창구 즉시 발급 · 나이스 처리 순서 포함</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quick.map((m) => {
            const t = categoryTint(data.categories, m.category);
            return (
              <a key={m.id} href={`#/m/${m.id}`} className="group rounded-xl border border-line bg-paper/60 p-4 transition hover:border-accent/40 hover:bg-accent-soft/50">
                <IconTile tint={t}>
                  <FileTextIcon size={19} />
                </IconTile>
                <div className="mt-3 text-[15px] font-semibold leading-snug text-ink">{m.title.replace(/ 신청$/, "")}</div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <PeriodBadge period={m.period} />
                  <span className="text-[12px] text-muted">수수료 {m.fee || "-"}</span>
                </div>
              </a>
            );
          })}
          <a href="#/judge" className="group rounded-xl border border-line bg-paper/60 p-4 transition hover:border-accent/40 hover:bg-accent-soft/50">
            <IconTile tint={tintAt(4)}>
              <CompassIcon size={19} />
            </IconTile>
            <div className="mt-3 text-[15px] font-semibold text-ink">발급 경로 판별기</div>
            <div className="mt-1.5 text-[12px] text-muted">연도·나이로 어디서 발급?</div>
          </a>
          <a href="#/forms" className="group rounded-xl border border-line bg-paper/60 p-4 transition hover:border-accent/40 hover:bg-accent-soft/50">
            <IconTile tint={tintAt(2)}>
              <FolderIcon size={19} />
            </IconTile>
            <div className="mt-3 text-[15px] font-semibold text-ink">서식함</div>
            <div className="mt-1.5 text-[12px] text-muted">HWP·PDF {data.bundle.formsLibrary?.items.length ?? 0}종</div>
          </a>
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <ClockIcon size={17} className="text-accent" />
          <h2 className="text-[17px] font-bold text-ink">최근 본 민원</h2>
        </div>
        <p className="mb-3 text-xs text-muted">이 PC에만 저장</p>
        {recent.length ? (
          <ul className="space-y-2">
            {recent.slice(0, 5).map((m) => {
              const t = categoryTint(data.categories, m.category);
              return (
                <li key={m.id}>
                  <a href={`#/m/${m.id}`} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:border-accent/40 hover:bg-accent-soft/50">
                    <IconTile tint={t} size={30}>
                      <FileTextIcon size={15} />
                    </IconTile>
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{m.title.replace(/ 신청$/, "")}</span>
                    <ArrowRightIcon size={15} className="text-muted" />
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[13.5px] text-muted">열어본 민원이 여기에 표시됩니다</p>
        )}
      </section>
    </div>
  );
}

/* ───────── 전체 민원: 분류 칩 + 분류별 카드 ───────── */
function AllMinwon({ data, cat }: { data: AppData; cat: string }) {
  const cats = cat ? [cat] : data.categories;
  const count = (c: string) => data.bundle.minwon.filter((m) => m.category === c).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 className="text-[19px] font-bold text-ink">전체 민원</h2>
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto text-[13px]" aria-label="민원 분류">
          {["", ...data.categories].map((c) => {
            const active = cat === c;
            const t = c ? categoryTint(data.categories, c) : null;
            return (
              <a
                key={c || "all"}
                href={href("/", { c: c || ALL })}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 transition ${
                  active ? "border-navy bg-navy font-semibold text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong"
                }`}
              >
                {t && <span className="h-2 w-2 rounded-full" style={{ background: t.fg }} />}
                {c || "전체"}
                <span className={`tabular-nums ${active ? "text-white/70" : "text-muted"}`}>{c ? count(c) : data.bundle.minwon.length}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <div className={cat ? "" : "gap-4 md:columns-2 xl:columns-3"}>
        {cats.map((c) => {
          const t = categoryTint(data.categories, c);
          const items = data.bundle.minwon.filter((m) => m.category === c);
          return (
            <section key={c} className="panel mb-4 break-inside-avoid p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: t.fg }} />
                <h3 className="text-[15px] font-bold text-ink">{c}</h3>
                <span className="text-[13px] tabular-nums text-muted">{items.length}</span>
              </div>
              <ul className={cat ? "grid gap-x-6 md:grid-cols-2" : ""}>
                {items.map((m) => (
                  <li key={m.id}>
                    <a href={`#/m/${m.id}`} className="group flex items-center gap-3 rounded-lg px-1.5 py-2 transition hover:bg-accent-soft/60">
                      <IconTile tint={t} size={30}>
                        <FileTextIcon size={15} />
                      </IconTile>
                      <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink group-hover:text-accent-ink" title={m.title}>
                        {m.title.replace(/ 신청$/, "")}
                      </span>
                      <PeriodBadge period={m.period} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

/* ───────── 아래 줄: 업무안내 · 판별기(남색) · 서식함(크림) ───────── */
function BottomRow({ data }: { data: AppData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Guides guides={data.bundle.guides} />
      <section className="flex flex-col rounded-[14px] bg-navy p-6 text-white">
        <span className="text-xs text-white/60">창구에서 바로</span>
        <h2 className="mt-1 text-[19px] font-bold">발급 경로 판별기</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/75">
          누가 왔는지와 생년월일만 넣으면 신원 확인 서류, 나이스·학교증명발급시스템·정부24·무인발급기 중 어디서 발급되는지 한 번에 확인합니다.
        </p>
        <a href="#/judge" className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-4 py-2 pt-2 text-[14px] font-semibold text-navy hover:bg-white/90">
          <CompassIcon size={15} />
          판별기 열기
        </a>
      </section>
      <section className="flex flex-col rounded-[14px] border border-orange-100 bg-cream p-6">
        <IconTile tint={tintAt(2)}>
          <FolderIcon size={19} />
        </IconTile>
        <h2 className="mt-3 text-[19px] font-bold text-ink">서식이 필요하신가요?</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
          민원·인사 서식 {data.bundle.formsLibrary?.items.length ?? 0}종을 한글(HWP)·PDF로 바로 내려받습니다. 위임장도 여기 있습니다.
        </p>
        <a href="#/forms" className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white hover:bg-accent-ink">
          서식함 열기
          <ArrowRightIcon size={14} />
        </a>
      </section>
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
    <section className="panel flex flex-col p-6">
      <div className="mb-3 flex items-center gap-2">
        <BookIcon size={17} className="text-accent" />
        <h2 className="text-[17px] font-bold text-ink">업무안내</h2>
        <span className="text-xs text-muted">편람 II·III·IV·VI장</span>
      </div>
      <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto text-[12.5px]">
        {chapters.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={`shrink-0 cursor-pointer rounded-full px-2.5 py-0.5 ${active === c ? "bg-accent-soft font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}
          >
            {c.replace(/^[IVX]+\.\s*/, "")}
          </button>
        ))}
      </div>
      <ul className="max-h-56 overflow-y-auto">
        {(byChapter.get(active) ?? []).map((g) => (
          <li key={g.id}>
            <a href={`#/g/${g.id}`} className="block truncate rounded-md px-1.5 py-1.5 text-[14px] text-ink transition hover:bg-accent-soft/60 hover:text-accent-ink">
              {g.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── 검색 결과 ───────── */
function Results({ data, hits, q }: { data: AppData; hits: Hit[]; q: string }) {
  if (!hits.length) {
    return (
      <div className="panel py-10 text-center">
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
      <ol className="panel divide-y divide-line overflow-hidden">
        {hits.map((h, i) => {
          const isMinwon = h.doc.kind === "minwon";
          const t = isMinwon ? categoryTint(data.categories, (h.doc.item as Minwon).category) : tintAt(4);
          return (
            <li key={h.doc.id}>
              <a href={hitHref(h)} className={`group flex gap-4 px-4 py-3.5 transition-colors hover:bg-accent-soft/60 ${i === 0 ? "bg-accent-soft/70" : ""}`}>
                <IconTile tint={t} size={36}>
                  {isMinwon ? <FileTextIcon size={17} /> : <BookIcon size={17} />}
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ background: t.bg, color: t.fg }}>
                      {isMinwon ? (h.doc.item as Minwon).category : "업무안내"}
                    </span>
                    <span className="text-[16.5px] font-semibold tracking-[-0.01em] text-ink group-hover:text-accent-ink">{h.doc.item.title}</span>
                    {i === 0 && <span className="ml-auto hidden shrink-0 text-xs text-muted sm:inline">Enter ↵</span>}
                  </span>
                  {h.snippet && <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-ink-2">{h.snippet}</span>}
                  {isMinwon && <Meta m={h.doc.item as Minwon} />}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Meta({ m }: { m: Minwon }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
      <PeriodBadge period={m.period} />
      <span>
        수수료 <b className="font-semibold text-ink-2">{m.fee || "-"}</b>
      </span>
      <span className="min-w-0 truncate">신청 {m.methods.join(", ") || "-"}</span>
    </span>
  );
}
