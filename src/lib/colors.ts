/**
 * 분류별 색 — 포털(aisen.kr) 컨셉: 분류마다 고유 색 점·배지·아이콘 바탕.
 * 분류 이름을 코드에 적지 않고 데이터의 분류 순서(index)로 색을 정한다.
 */
export interface Tint {
  /** 진한 색(점·아이콘·글자) */
  fg: string;
  /** 옅은 바탕 */
  bg: string;
}

const PALETTE: Tint[] = [
  { fg: "#2f56d6", bg: "#edf2ff" }, // 파랑
  { fg: "#7048e8", bg: "#f3f0ff" }, // 보라
  { fg: "#e8590c", bg: "#fff4e6" }, // 주황
  { fg: "#0c8599", bg: "#e3fafc" }, // 청록
  { fg: "#2b8a3e", bg: "#ebfbee" }, // 초록
  { fg: "#c2255c", bg: "#fff0f6" }, // 분홍
  { fg: "#d9480f", bg: "#fff4e6" }, // 귤색
  { fg: "#1971c2", bg: "#e7f5ff" }, // 하늘
  { fg: "#5f3dc4", bg: "#f3f0ff" }, // 남보라
  { fg: "#495057", bg: "#f1f3f5" }, // 회색
  { fg: "#0b7285", bg: "#e3fafc" }, // 짙은 청록
];

export const tintAt = (i: number): Tint => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

/** 분류 이름 → 색 (categories 는 데이터 순서) */
export const categoryTint = (categories: string[], c: string): Tint => tintAt(Math.max(0, categories.indexOf(c)));
