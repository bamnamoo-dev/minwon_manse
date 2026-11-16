import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "../lib/data";
import { href, rememberSearch, replaceHash } from "../lib/router";
import type { Hit } from "../lib/search";
import { getRecent } from "../lib/storage";
import type { Minwon } from "../lib/types";
import { Badge } from "./ui";

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

  // 주소가 바깥에서 바뀐 경우(로고 클릭, 뒤로가기 등) 입력창을 주소에 맞춘다
  useEffect(() => {
    setInput((cur) => (cur.trim() === q.trim() ? cur : q));
  }, [q]);

  const hits = useMemo(() => data.index.search(q, { category: cat || undefined }), [data, q, cat]);
  const recent = useMemo(() => getRecent().map((id) => data.minwonById.get(id)).filter(Boolean) as Minwon[], [data]);

  const open = (h: Hit) => (window.location.hash = h.doc.kind === "minwon" ? `#/m/${h.doc.id}` : `#/g/${h.doc.id}`);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="sticky top-0 z-10 -mx-4 bg-[#f6f7f9]/95 px-4 pb-3 pt-5 backdrop-blur">
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
          <div className="flex items-center gap-2 rounded-2xl border-2 border-brand-600 bg-white px-4 py-3 shadow-sm focus-within:ring-4 focus-within:ring-brand-100">
            <span aria-hidden className="text-xl">🔍</span>
            <input
              id="q"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="민원 이름이나 내용으로 검색 (예: 생기부, 졸업장, ㅈㅇㅈㅁ, 학원 등록, 폐교 졸업)"
              className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-gray-400"
              autoComplete="off"
              enterKeyHint="search"
            />
            {input && (
              <button type="button" className="rounded-full px-2 text-gray-400 hover:text-gray-700" onClick={() => setInput("")} aria-label="검색어 지우기">
                ✕
              </button>
            )}
          </div>
        </form>
        <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="분류">
          {["", ...data.categories].map((c) => (
            <a
              key={c || "all"}
              href={href("/", { q: input.trim() || undefined, c: c || undefined })}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                cat === c ? "bg-brand-600 font-semibold text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {c || "전체"}
            </a>
          ))}
        </nav>
      </div>

      {q ? (
        <Results hits={hits} q={q} />
      ) : (
        <Browse data={data} cat={cat} recent={cat ? [] : recent} />
      )}
    </div>
  );
}

function Results({ hits, q }: { hits: Hit[]; q: string }) {
  if (!hits.length)
    return (
      <div className="mt-10 text-center text-gray-500">
        <p className="text-lg">"{q}"에 맞는 민원을 찾지 못했습니다.</p>
        <p className="mt-2 text-sm">다른 표현이나 띄어쓰기를 바꿔 보세요. (예: 생활기록부 → 생기부, 졸업장)</p>
      </div>
    );
  return (
    <div>
      <p className="mb-2 text-sm text-gray-500">
        검색 결과 {hits.length}건 <span className="text-gray-400">· Enter 키를 누르면 첫 번째 결과로 이동</span>
      </p>
      <ol className="space-y-2">
        {hits.map((h, i) => (
          <li key={h.doc.id}>
            <a
              href={h.doc.kind === "minwon" ? `#/m/${h.doc.id}` : `#/g/${h.doc.id}`}
              className={`block rounded-xl border bg-white p-4 transition hover:border-brand-600 hover:shadow-sm ${i === 0 ? "border-brand-600/50" : "border-gray-200"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {h.doc.kind === "minwon" ? <Badge tone="blue">{h.doc.item.category}</Badge> : <Badge tone="green">업무안내</Badge>}
                <span className="text-lg font-semibold text-gray-900">{h.doc.item.title}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{h.snippet}</p>
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
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
      <span>⏱ 처리기간 <b className="text-gray-700">{m.period || "-"}</b></span>
      <span>💳 수수료 <b className="text-gray-700">{m.fee || "-"}</b></span>
      <span className="truncate">📮 {m.methods.join(", ")}</span>
    </div>
  );
}

function Browse({ data, cat, recent }: { data: AppData; cat: string; recent: Minwon[] }) {
  const cats = cat ? [cat] : data.categories;
  const guidesByChapter = useMemo(() => {
    const m = new Map<string, typeof data.bundle.guides>();
    for (const g of data.bundle.guides) m.set(g.chapter, [...(m.get(g.chapter) ?? []), g]);
    return m;
  }, [data]);

  return (
    <div className="space-y-6">
      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-500">최근 본 민원</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((m) => (
              <a key={m.id} href={`#/m/${m.id}`} className="rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-gray-200 hover:ring-brand-600">
                {m.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {cats.map((c) => {
        const items = data.bundle.minwon.filter((m) => m.category === c);
        return (
          <div key={c}>
            <h2 className="mb-2 flex items-baseline gap-2 font-bold text-gray-800">
              {c} <span className="text-sm font-normal text-gray-400">{items.length}건</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((m) => (
                <a key={m.id} href={`#/m/${m.id}`} className="rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-brand-600">
                  <div className="font-medium text-gray-900">{m.title}</div>
                  <div className="text-xs text-gray-500">
                    {m.period || "-"} · {m.methods.slice(0, 3).join(", ")}
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}

      {!cat && (
        <div>
          <h2 className="mb-2 font-bold text-gray-800">업무안내 (편람 II·III·IV·VI장)</h2>
          <div className="space-y-3">
            {[...guidesByChapter].map(([chap, gs]) => (
              <div key={chap}>
                <h3 className="mb-1 text-sm font-semibold text-gray-500">{chap}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {gs.map((g) => (
                    <a key={g.id} href={`#/g/${g.id}`} className="rounded-md bg-white px-2.5 py-1 text-sm ring-1 ring-gray-200 hover:ring-brand-600">
                      {g.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
