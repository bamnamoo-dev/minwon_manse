/**
 * 민원 검색 엔진 — 전부 브라우저 안에서 동작 (검색어는 어디에도 전송되지 않음)
 *
 * 점수 방식
 * 1. 검색어를 띄어쓰기로 나눈 "단어 묶음"마다, 동의어 사전으로 대체어를 붙인다 (생기부 → 학교생활기록부)
 * 2. 각 단어가 필드에 그대로 들어 있으면 큰 점수, 두 글자 조각이 절반 이상 겹치면 부분 점수
 * 3. 필드 가중치: 제목 > 별칭 > 분류·사무내용 > 구비서류 > 참고사항 > 본문
 * 4. 제목이 검색어로 많이 채워질수록 가산, 빠진 단어가 있으면 감점 → 점수 순 (동점이면 제목이 짧은 것)
 * 5. 초성만 입력하면(ㅈㅇㅈㅁ) 제목 초성으로 찾는다
 */
import { bigrams, choseong, compact, isChoseongOnly } from "./hangul";
import type { Guide, Minwon } from "./types";

export type Doc =
  | { kind: "minwon"; id: string; item: Minwon }
  | { kind: "guide"; id: string; item: Guide };

export interface Hit {
  doc: Doc;
  score: number;
  matchedAll: boolean;
  snippet: string;
}

interface Field {
  w: number;
  text: string; // 원문 (스니펫용)
  c: string; // compact
  bg: Set<string>;
}

interface Indexed {
  doc: Doc;
  title: string;
  titleC: string;
  titleCho: string;
  aliasCho: string[];
  fields: Field[];
  kindWeight: number;
}

const field = (w: number, text: string): Field => ({ w, text, c: compact(text), bg: new Set(bigrams(text)) });

export class SearchIndex {
  private items: Indexed[];
  private synonyms: Map<string, string[]>;

  constructor(minwon: Minwon[], guides: Guide[], synonyms: Record<string, string[]>) {
    this.synonyms = new Map(Object.entries(synonyms).map(([k, v]) => [compact(k), v]));
    this.items = [
      ...minwon.map((m): Indexed => ({
        doc: { kind: "minwon", id: m.id, item: m },
        title: m.title,
        titleC: compact(m.title),
        titleCho: choseong(m.title),
        aliasCho: m.aliases.map(choseong),
        kindWeight: 1,
        fields: [
          field(10, m.title),
          field(8, m.aliases.join(" ")),
          field(3, m.category),
          field(3, m.summary),
          field(2, m.documents.join(" ") + " " + m.officerChecks.join(" ")),
          field(1.5, m.notes.join(" ")),
          field(1, [...m.receivers, ...m.methods, m.dept, m.period].join(" ")),
          field(0.4, m.body),
        ],
      })),
      ...guides.map((g): Indexed => ({
        doc: { kind: "guide", id: g.id, item: g },
        title: g.title,
        titleC: compact(g.title),
        titleCho: choseong(g.title),
        aliasCho: [],
        kindWeight: 0.8,
        fields: [field(10, g.title), field(2, g.chapter), field(0.4, g.body)],
      })),
    ];
  }

  /** 단어 하나 → [단어, 동의어들] */
  private alternatives(term: string): string[] {
    const c = compact(term);
    const alts = new Set([c]);
    for (const [key, vals] of this.synonyms) {
      if (c === key || (key.length >= 2 && c.includes(key))) vals.forEach((v) => alts.add(compact(v)));
    }
    return [...alts].filter(Boolean);
  }

  private termScore(alt: string, it: Indexed): number {
    const abg = bigrams(alt);
    let s = 0;
    for (const f of it.fields) {
      if (!f.c) continue;
      if (f.c.includes(alt)) {
        s += f.w * 2 * (alt.length >= 2 ? 1 : 0.3);
      } else if (abg.length >= 2) {
        let hit = 0;
        for (const b of abg) if (f.bg.has(b)) hit++;
        const ratio = hit / abg.length;
        if (ratio >= 0.5) s += f.w * ratio * 0.8;
      }
    }
    if (it.titleC.startsWith(alt)) s += 6;
    return s;
  }

  search(query: string, opts: { category?: string; limit?: number } = {}): Hit[] {
    const q = query.trim();
    if (!q) return [];
    const limit = opts.limit ?? 50;

    // 초성 검색
    if (isChoseongOnly(q)) {
      const cq = compact(q);
      const hits: Hit[] = [];
      for (const it of this.items) {
        if (opts.category && !(it.doc.kind === "minwon" && it.doc.item.category === opts.category)) continue;
        const pos = it.titleCho.indexOf(cq);
        const aliasHit = it.aliasCho.some((a) => a.includes(cq));
        if (pos < 0 && !aliasHit) continue;
        const score = (pos === 0 ? 30 : pos > 0 ? 20 - Math.min(pos, 10) : 15) * it.kindWeight;
        hits.push({ doc: it.doc, score, matchedAll: true, snippet: summaryOf(it.doc) });
      }
      return sortHits(hits).slice(0, limit);
    }

    const terms = q.split(/\s+/).filter((t) => compact(t));
    const groups = terms.map((t) => this.alternatives(t));
    // 띄어쓰기 없이 붙인 전체 검색어도 동의어 확인 (예: "학원 등록" → "학원등록")
    const whole = compact(q);
    const wholeSyn = terms.length > 1 ? this.alternatives(whole).filter((a) => a !== whole) : [];

    const hits: Hit[] = [];
    for (const it of this.items) {
      if (opts.category && !(it.doc.kind === "minwon" && it.doc.item.category === opts.category)) continue;
      let score = 0;
      let matched = 0;
      const usedAlts: string[] = [];
      for (const alts of groups) {
        let best = 0;
        let bestAlt = alts[0];
        for (const a of alts) {
          const s = this.termScore(a, it);
          if (s > best) [best, bestAlt] = [s, a];
        }
        if (best > 0) {
          matched++;
          usedAlts.push(bestAlt);
        }
        score += best;
      }
      for (const a of wholeSyn) if (it.titleC.includes(a)) score += 25;
      if (terms.length > 1 && it.titleC.includes(whole)) score += 15;
      if (score < 0.5) continue;
      // 제목 중 검색어가 차지하는 비율 — 같은 단어가 들어간 긴 제목보다 딱 맞는 제목을 위로
      // (끝의 "신청"은 대부분 제목에 붙어 있어 비율 계산에서 뺀다. "신고"는 의미가 있어 남김)
      const core = it.titleC.replace(/신청$/, "") || it.titleC;
      const covered = usedAlts.filter((a) => core.includes(a)).reduce((n, a) => n + a.length, 0);
      if (covered) score += 40 * Math.min(1, covered / core.length);
      // 일부 단어만 맞으면 빠진 단어 하나당 점수를 깎는다(완전히 밀어내지는 않음: "1982년 이전 졸업" 같은 검색)
      const penalty = Math.pow(0.55, groups.length - matched);
      hits.push({
        doc: it.doc,
        score: score * it.kindWeight * penalty,
        matchedAll: matched === groups.length,
        snippet: makeSnippet(it, usedAlts),
      });
    }
    return sortHits(hits).slice(0, limit);
  }
}

function sortHits(h: Hit[]): Hit[] {
  return h.sort(
    (a, b) =>
      b.score - a.score ||
      titleOf(a.doc).length - titleOf(b.doc).length,
  );
}

const titleOf = (d: Doc) => d.item.title;
const summaryOf = (d: Doc) => (d.kind === "minwon" ? d.item.summary : d.item.chapter);

/** 검색어가 처음 나오는 부분 주변 문장 */
function makeSnippet(it: Indexed, alts: string[]): string {
  const base = summaryOf(it.doc);
  // 제목에서 찾은 경우엔 사무내용(요약)을 보여주는 게 가장 유용
  if (alts.some((a) => it.titleC.includes(a))) return base;
  for (const f of it.fields.slice(1)) {
    const text = f.text;
    for (const a of alts) {
      // compact 위치를 원문 위치로 대략 환산: 원문에서 첫 글자부터 찾아본다
      const idx = findLoose(text, a);
      if (idx >= 0 && !(f.text === base && idx < 80)) {
        const start = Math.max(0, idx - 30);
        return (start > 0 ? "…" : "") + text.slice(start, idx + 70).trim() + "…";
      }
    }
  }
  return base;
}

/** 공백·기호를 무시하고 원문에서 위치 찾기 */
function findLoose(text: string, c: string): number {
  if (!c) return -1;
  const chars: number[] = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    const ch = compact(text[i]);
    if (ch) {
      flat += ch;
      chars.push(i);
    }
  }
  const p = flat.indexOf(c);
  return p >= 0 ? chars[p] : -1;
}
