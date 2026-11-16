import type { ReactNode } from "react";

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "blue" | "amber" | "green" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    green: "bg-emerald-50 text-emerald-700",
  };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
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
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "outline" | "primary";
  disabled?: boolean;
  title?: string;
}) {
  const cls =
    "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 " +
    (variant === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700"
      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50");
  if (href && !disabled)
    return (
      <a className={cls} href={href} title={title} download>
        {children}
      </a>
    );
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
          <span className="break-keep">{x}</span>
        </li>
      ))}
    </ul>
  );
}
