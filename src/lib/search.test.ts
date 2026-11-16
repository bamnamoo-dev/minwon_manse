import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { choseong, isChoseongOnly } from "./hangul";
import { SearchIndex } from "./search";
import type { Bundle } from "./types";

let idx: SearchIndex;

beforeAll(() => {
  // npm run build-data 로 만든 실제 데이터로 테스트
  const b: Bundle = JSON.parse(readFileSync(join(process.cwd(), "public/data/bundle.json"), "utf-8"));
  idx = new SearchIndex(b.minwon, b.guides, b.synonyms);
});

const topTitles = (q: string, n = 3) => idx.search(q).slice(0, n).map((h) => h.doc.item.title);

describe("한글 유틸", () => {
  it("초성 변환", () => {
    expect(choseong("졸업증명서")).toBe("ㅈㅇㅈㅁㅅ");
    expect(isChoseongOnly("ㅈㅇㅈㅁ")).toBe(true);
    expect(isChoseongOnly("졸업")).toBe(false);
  });
});

describe("계획서 Phase 2 완료 기준: 기대 결과가 1~3위", () => {
  it("생기부 → 학교생활기록부", () => {
    expect(topTitles("생기부")[0]).toBe("학교생활기록부 신청");
  });
  it("ㅈㅇㅈㅁ → 졸업증명서", () => {
    expect(topTitles("ㅈㅇㅈㅁ")[0]).toBe("졸업증명서 신청");
  });
  it("학원 등록 → 학원 설립·운영등록", () => {
    expect(topTitles("학원 등록")).toContain("학원 설립·운영등록 신청");
  });
  it("폐교 졸업 → 폐지된 학교 졸업증명서", () => {
    expect(topTitles("폐교 졸업")[0]).toBe("폐지된 학교 졸업증명서 신청");
  });
});

describe("실무 표현", () => {
  it("졸업장", () => expect(topTitles("졸업장")[0]).toBe("졸업증명서 신청"));
  it("성적표", () => expect(topTitles("성적표")).toContain("성적증명서 신청"));
  it("과외 신고", () => expect(topTitles("과외 신고")[0]).toBe("개인과외교습자 신고"));
  it("검정고시 합격증명서", () => expect(topTitles("검정고시 합격증명서", 5).join()).toMatch(/검정고시 합격증명서/));
  it("체육관 대여 → 학교시설 사용", () => expect(topTitles("체육관 대여", 5).join()).toMatch(/학교시설 사용/));
  it("본문 검색: 건축물대장", () => expect(idx.search("건축물대장").length).toBeGreaterThan(0));
  it("업무안내도 검색됨: 전학", () =>
    expect(idx.search("초등학교 전학").some((h) => h.doc.kind === "guide")).toBe(true));
  it("분류 필터", () => {
    const r = idx.search("신고", { category: "학원" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((h) => h.doc.kind === "minwon" && h.doc.item.category === "학원")).toBe(true);
  });
  it("빈 검색어", () => expect(idx.search("  ")).toEqual([]));
});
