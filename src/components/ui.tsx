import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "blue" | "amber" | "green";
}) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200/70",
    blue: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70",
    amber: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Section({
  title,
  subtitle,
  children,
  right,
  highlight,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5 ${
        highlight ? "border-brand-200 ring-1 ring-brand-100" : "border-gray-200/90"
      }`}
    >
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  href,
  variant = "outline",
  size = "md",
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "outline" | "primary" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const variants = {
    primary: "bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-700",
    outline: "border border-gray-200 bg-white text-gray-700 shadow-2xs hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  };
  const cls =
    `inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${sizes} ${variants[variant]} ${className}`;

  if (href && !disabled) {
    return (
      <a className={cls} href={href} title={title} download>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-[15px]">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5 leading-relaxed text-gray-800">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600/50" />
          <span className="break-keep">{x}</span>
        </li>
      ))}
    </ul>
  );
}

/* ───────── 처리 순서형 화면 부품 (docs/디자인_개편계획.md) ───────── */

/** 단계 번호 표식 — 나이스 매뉴얼의 ❶❷❸ 과 같은 모양. 앱 전체의 단계 표시에 쓴다 */
export function Mark({ n, active, size = 22 }: { n: number; active?: boolean; size?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums leading-none ${
        active ? "bg-mark text-white" : "bg-ink text-paper"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {n}
    </span>
  );
}

/** 번호가 붙은 단계 구획 (카드 없이 제목 + 내용) */
export function Step({ n, title, note, right, children }: { n: number; title: string; note?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <Mark n={n} />
        <h2 className="text-lg font-bold tracking-[-0.01em] text-ink">{title}</h2>
        {note && <span className="ml-auto text-xs text-muted">{note}</span>}
        {right && <span className={note ? "" : "ml-auto"}>{right}</span>}
      </div>
      {children}
    </section>
  );
}

/** 접어 두는 줄 — 덜 쓰는 정보. 제목 옆 hint 로 접힌 상태에서도 요약이 보인다 */
export function Fold({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="group border-b border-line" open={open}>
      <summary className="flex cursor-pointer list-none items-baseline gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="w-3 text-muted transition-transform group-open:rotate-90">›</span>
        <span className="shrink-0 font-semibold text-ink">{title}</span>
        {hint && <span className="min-w-0 truncate text-sm text-muted">{hint}</span>}
      </summary>
      <div className="pb-5 pl-6">{children}</div>
    </details>
  );
}

/** 글자 밑줄형 선택 (탭보다 가벼운 전환) */
export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex gap-3">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`cursor-pointer ${v === value ? "font-semibold text-ink underline underline-offset-4" : "text-muted hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 가는 줄표 목록 (카드·점 장식 없이) */
export function DashList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-[15px] leading-relaxed text-ink">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[0.7em] h-px w-2.5 shrink-0 bg-ink" />
          <span className="break-keep">{x}</span>
        </li>
      ))}
    </ul>
  );
}
