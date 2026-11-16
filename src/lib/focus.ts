/**
 * 입력칸 자동 이동 — 연도 4자리 등을 다 치면 다음 입력칸(월 선택 등)으로 커서를 옮긴다.
 * 화면에 보이는 input·select 중 지금 칸 바로 다음 칸 (체크박스 제외)
 */
export function focusNextField(el: HTMLElement) {
  const fields = Array.from(document.querySelectorAll<HTMLElement>("input, select, textarea")).filter(
    (f) => f.offsetParent !== null && !(f as HTMLInputElement).disabled && f.getAttribute("type") !== "checkbox",
  );
  fields[fields.indexOf(el) + 1]?.focus();
}

/** 숫자만 남기고, 최대 길이를 다 채우면 다음 칸으로 */
export function digitsAndAdvance(e: { currentTarget: HTMLInputElement }, max: number): string {
  const v = e.currentTarget.value.replace(/\D/g, "").slice(0, max);
  if (v.length === max) focusNextField(e.currentTarget);
  return v;
}
