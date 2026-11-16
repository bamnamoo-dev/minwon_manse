import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { estimateGraduation, judgeIdentity, judgeRule, manAge, type JudgeInput } from "./judge";
import type { Bundle } from "./types";

let b: Bundle;
beforeAll(() => {
  b = JSON.parse(readFileSync(join(process.cwd(), "public/data/bundle.json"), "utf-8"));
});

/** 규칙 하나를 판별해 {채널id: verdict} 로 */
function run(ruleId: string, input: Partial<JudgeInput>) {
  const r = judgeRule(b.rules.rules[ruleId], b.rules.channels, { dates: [], statuses: [], ...input });
  return Object.fromEntries(r.map((x) => [x.channel.id, x.verdict]));
}
const at = (year: number, month?: number) => ({ dates: [{ year, month }] });

describe("졸업증명서(국문) 경계값", () => {
  it("NEIS 1982년 2월부터", () => {
    expect(run("graduation_ko", at(1982, 2)).neis).toBe("ok");
    expect(run("graduation_ko", at(1982, 1)).neis).toBe("no");
    expect(run("graduation_ko", at(1981, 2)).neis).toBe("no");
  });
  it("증명발급시스템 1951-02 ~ 2002-02", () => {
    expect(run("graduation_ko", at(1951, 2)).certSystem).toBe("ok");
    expect(run("graduation_ko", at(1951, 1)).certSystem).toBe("no");
    expect(run("graduation_ko", at(2002, 2)).certSystem).toBe("ok");
    expect(run("graduation_ko", at(2002, 3)).certSystem).toBe("no");
    expect(run("graduation_ko", at(1990, 2)).certSystem).toBe("ok");
  });
  it("FAX·우편은 연도 무관", () => {
    const r = run("graduation_ko", at(1960, 2));
    expect([r.faxEdu, r.faxGu, r.mail]).toEqual(["ok", "ok", "ok"]);
    expect(r.gov24Online).toBe("no");
    expect(r.kiosk).toBe("no");
  });
  it("연도만 입력 + 경계 연도 → 확인 필요", () => {
    expect(run("graduation_ko", at(1982)).neis).toBe("check");
    expect(run("graduation_ko", at(1983)).neis).toBe("ok");
    expect(run("graduation_ko", at(1981)).neis).toBe("no");
  });
  it("연도 미입력 → 입력 요청", () => {
    expect(run("graduation_ko", {}).neis).toBe("need");
  });
});

describe("다른 증명서 경계값", () => {
  it("학교생활기록부 NEIS 2003-02", () => {
    expect(run("record_ko", at(2003, 2)).neis).toBe("ok");
    expect(run("record_ko", at(2003, 1)).neis).toBe("no");
    expect(run("record_ko", at(2002, 2)).certSystem).toBe("ok");
    expect(run("record_ko", at(2002, 2)).neis).toBe("no");
  });
  it("제적증명서 2003-03", () => {
    expect(run("expulsion_ko", at(2003, 3)).neis).toBe("ok");
    expect(run("expulsion_ko", at(2003, 2)).neis).toBe("no");
  });
  it("대입전형용 생기부 2013-02, 무인발급 불가", () => {
    expect(run("record_admission_ko", at(2013, 2)).neis).toBe("ok");
    expect(run("record_admission_ko", at(2013, 1)).neis).toBe("no");
    expect(run("record_admission_ko", at(2020, 2)).kiosk).toBe("no");
  });
  it("영문 성적증명서 2014-03 입학생부터", () => {
    expect(run("transcript_en", at(2014, 3)).neis).toBe("ok");
    expect(run("transcript_en", at(2014, 2)).neis).toBe("no");
  });
  it("교육비납입 납부연도 2010 (연만 있는 기준)", () => {
    expect(run("tuition_paid_ko", at(2010)).neis).toBe("ok");
    expect(run("tuition_paid_ko", at(2009)).neis).toBe("no");
  });
  it("검정고시 1978 합격자부터", () => {
    expect(run("ged_pass_ko", at(1978)).neis).toBe("ok");
    expect(run("ged_pass_ko", at(1977)).neis).toBe("no");
  });
});

describe("신분 조건", () => {
  it("경력증명서: 재직자는 연도 없이 가능, 퇴직자는 2003년부터", () => {
    expect(run("career", { statuses: ["재직자"] }).neis).toBe("ok");
    expect(run("career", at(2003)).neis).toBe("ok");
    expect(run("career", at(2002)).neis).toBe("no");
  });
  it("재학증명서: 재학생만 NEIS·정부24, FAX는 가능", () => {
    expect(run("enrollment_ko", { statuses: ["재학생"] }).neis).toBe("ok");
    expect(run("enrollment_ko", {}).neis).toBe("no");
    expect(run("enrollment_ko", {}).faxEdu).toBe("ok");
  });
  it("정원외관리 NEIS는 학교별 상이 → 확인 필요", () => {
    expect(run("extra_mgmt_ko", at(2010, 2)).neis).toBe("check");
  });
});

describe("출생연도 → 졸업연도 추정", () => {
  it("고졸: 출생+19, 2월", () => {
    expect(estimateGraduation(1990, "고", 5)).toEqual([{ year: 2009, month: 2 }]);
  });
  it("1~2월생(2002년 이전 출생)은 한 해 앞도 후보", () => {
    expect(estimateGraduation(1990, "고", 1)).toEqual([{ year: 2008, month: 2 }, { year: 2009, month: 2 }]);
    expect(estimateGraduation(2005, "고", 1)).toEqual([{ year: 2024, month: 2 }]);
  });
  it("추정 범위가 경계를 넘으면 확인 필요", () => {
    // 1983년 1월생 고졸 → 2001 또는 2002년 2월 졸업: 증명발급시스템 둘 다 가능
    expect(run("record_ko", { dates: estimateGraduation(1983, "고", 1) }).certSystem).toBe("ok");
    // 1984년 1월생 고졸 → 2002 또는 2003년 2월: NEIS 가능 여부가 갈림
    expect(run("record_ko", { dates: estimateGraduation(1984, "고", 1) }).neis).toBe("check");
  });
});

describe("신청인 신원 확인", () => {
  it("만 나이 계산", () => {
    const today = new Date(2026, 10, 16);
    expect(manAge({ year: 2012, month: 11, day: 16 }, today)).toBe(14);
    expect(manAge({ year: 2012, month: 11, day: 17 }, today)).toBe(13);
  });
  const id = (v: "self" | "guardian" | "proxy", age: number) => {
    const r = judgeIdentity(b.identity, v, age);
    return r.matched ? r.case.id : "unmatched";
  };
  it("본인: 만 14세 이상만 가능 (미만은 신청 불가 — 실무 기준)", () => {
    expect(id("self", 14)).toBe("self");
    expect(id("self", 13)).toBe("self_under14");
    const r = judgeIdentity(b.identity, "self", 10);
    expect(r.matched && r.case.denied).toBe(true);
  });
  it("부모: 미성년 자녀는 법정대리인, 성인 자녀는 위임장+가족관계 증빙 (실무 기준)", () => {
    expect(id("guardian", 18)).toBe("legal_guardian");
    expect(id("guardian", 19)).toBe("guardian_adult");
    const r = judgeIdentity(b.identity, "guardian", 30);
    expect(r.matched && r.case.documents.join()).toMatch(/위임장.*가족관계.*부모.*자녀/);
  });
  it("모든 방문자 × 나이 조합이 규칙에 걸림 (빈칸 없음)", () => {
    for (const v of ["self", "guardian", "proxy"] as const)
      for (let age = 0; age <= 100; age++) expect(judgeIdentity(b.identity, v, age).matched).toBe(true);
  });
  it("대리인: 14세 기준", () => {
    expect(id("proxy", 13)).toBe("proxy_under14");
    expect(id("proxy", 14)).toBe("proxy_14plus");
    expect(id("proxy", 40)).toBe("proxy_14plus");
  });
});
