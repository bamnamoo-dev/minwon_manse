// 한글 처리 유틸 (외부 라이브러리 없이)

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 비교용 정규화: 소문자, 공백·기호 제거 (한글·영문·숫자·자모만 남김) */
export function compact(s: string): string {
  return s.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");
}

/** 초성 문자열 (한글 음절만 초성으로, 나머지는 그대로) */
export function choseong(s: string): string {
  let out = "";
  for (const ch of compact(s)) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) out += CHO[Math.floor((code - 0xac00) / 588)];
    else out += ch;
  }
  return out;
}

/** 입력이 초성만으로 되어 있는지 (예: "ㅈㅇㅈㅁ") */
export function isChoseongOnly(s: string): boolean {
  const c = compact(s);
  return c.length >= 2 && /^[ㄱ-ㅎ]+$/.test(c);
}

/** 두 글자 단위 조각 (부분 일치·오타 허용용) */
export function bigrams(s: string): string[] {
  const c = compact(s);
  if (c.length <= 1) return c ? [c] : [];
  const out: string[] = [];
  for (let i = 0; i < c.length - 1; i++) out.push(c.slice(i, i + 2));
  return out;
}
