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
