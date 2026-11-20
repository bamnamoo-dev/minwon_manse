import { useEffect, useState } from "react";
import { SearchIndex } from "./search";
import type { Bundle, Guide, Minwon } from "./types";

export interface AppData {
  bundle: Bundle;
  index: SearchIndex;
  minwonById: Map<string, Minwon>;
  guideById: Map<string, Guide>;
  categories: string[];
}

let cache: Promise<AppData> | null = null;
/** PDF 쪽 − 인쇄 쪽 (data/edition.json printedPageOffset, 데이터를 불러올 때 채움) */
let pageOffset = 0;

function load(): Promise<AppData> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/bundle.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`데이터를 불러오지 못했습니다 (${r.status})`);
      return r.json() as Promise<Bundle>;
    })
    .then((bundle) => {
      pageOffset = bundle.printedPageOffset;
      return bundle;
    })
    .then((bundle) => ({
      bundle,
      index: new SearchIndex(bundle.minwon, bundle.guides, bundle.synonyms),
      minwonById: new Map(bundle.minwon.map((m) => [m.id, m])),
      guideById: new Map(bundle.guides.map((g) => [g.id, g])),
      categories: [...new Set(bundle.minwon.map((m) => m.category))],
    }));
  return cache;
}

export function useAppData(): { data?: AppData; error?: string } {
  const [state, setState] = useState<{ data?: AppData; error?: string }>({});
  useEffect(() => {
    load().then(
      (data) => setState({ data }),
      (e: Error) => setState({ error: e.message }),
    );
  }, []);
  return state;
}

/** PDF 쪽 → 페이지 이미지 경로 */
export const pageImg = (p: number) => `${import.meta.env.BASE_URL}pages/p${p}.webp`;
/** PDF 쪽 → 편람 인쇄 쪽수 (차이는 data/edition.json printedPageOffset) */
export const printedPage = (p: number) => p - pageOffset;
/** 쪽 목록 → "141" 또는 "141~143" */
export const pageRange = (pages: number[]) =>
  pages.length > 1 && pages.at(-1) !== pages[0] ? `${pages[0]}~${pages.at(-1)}` : `${pages[0]}`;

/** 이 민원에 '어디서 발급하나요?' 단계가 있는지 (연도별 발급 규칙 또는 발급 시스템 매뉴얼 연결) */
export const hasIssueStep = (data: AppData, m: Minwon) =>
  m.yearRuleIds.some((r) => data.bundle.rules.rules[r]) || !!data.bundle.manuals?.links[m.id];

/** 서식 파일(public/forms 기준 경로) → 주소. 한글·공백·괄호가 있어 경로 조각마다 인코딩 */
export const formUrl = (path: string) => `${import.meta.env.BASE_URL}forms/${path.split("/").map(encodeURIComponent).join("/")}`;
