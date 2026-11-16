import { useEffect, useState } from "react";

/**
 * 해시 라우팅 (#/..., 정적 호스팅에서 새로고침해도 동작)
 *   #/                 검색 화면       (#/?q=검색어&c=분류)
 *   #/m/M02            민원 상세
 *   #/g/G05            업무안내 상세
 *   #/judge            발급 경로 판별기
 *   #/forms            서식함
 * ※ 해시(#) 뒤 내용은 서버로 전송되지 않는다 → 검색어가 서버 로그에 남지 않음
 */
export interface Route {
  path: string[];
  params: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [p, q = ""] = raw.split("?");
  return { path: p.split("/").filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function href(path: string, params?: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
  const qs = sp.toString();
  return `#${path}${qs ? `?${qs}` : ""}`;
}

/** 마지막 검색 화면 주소(검색어·분류 포함) — 상세에서 "검색으로" 돌아갈 때 사용 */
let lastSearch = "#/";
export const rememberSearch = (h: string) => {
  lastSearch = h;
};
export const lastSearchHash = () => lastSearch;

/** 검색어 입력처럼 자주 바뀌는 경우: 방문 기록을 쌓지 않고 주소만 교체 */
export function replaceHash(h: string) {
  if (window.location.hash !== h) {
    history.replaceState(null, "", h);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}
