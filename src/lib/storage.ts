// 이 브라우저에만 저장되는 편의 기능(최근 본 민원). 실패해도 앱은 정상 동작.

const KEY = "minwon_manse.recent";

export function getRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(id: string) {
  try {
    const list = [id, ...getRecent().filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 저장 불가 환경(사생활 보호 모드 등) — 무시 */
  }
}
