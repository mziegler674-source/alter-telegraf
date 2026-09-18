import type { ReactNode } from "react";

export const inputClass =
  "mt-2 w-full rounded-xl border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-3 text-[#211f1b] outline-none transition placeholder:text-[#756f64]/50 focus:border-[#b08a4a] disabled:opacity-60";

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-[#756f64]">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#211f1b]/10 bg-white p-6 shadow-sm sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold">
        {label}
        {required && <span className="text-[#b08a4a]"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[#756f64]">{hint}</span>}
    </label>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#e9e2d5] p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 accent-[#b08a4a]"
      />
      <span>
        <span className="block font-semibold">{label}</span>
        {description && (
          <span className="mt-1 block text-sm text-[#756f64]">{description}</span>
        )}
      </span>
    </label>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-[#211f1b] text-white hover:bg-[#3a3630]",
  secondary: "bg-[#e9e2d5] text-[#211f1b] hover:bg-[#b08a4a] hover:text-white",
  danger: "border border-red-200 text-red-700 hover:bg-red-600 hover:text-white",
  ghost: "text-[#756f64] hover:text-[#211f1b]",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  type?: "button" | "submit";
  small?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? "px-4 py-2 text-xs" : "px-6 py-3 text-sm"
      } ${buttonVariants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Alert({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
    info: "border-[#b08a4a]/30 bg-[#f4ead5] text-[#6b5125]",
  }[kind];

  return (
    <div className={`rounded-xl border p-4 text-sm font-semibold ${styles}`}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "gray";
}) {
  const styles = {
    neutral: "bg-[#e9e2d5] text-[#211f1b]",
    green: "bg-green-100 text-green-700",
    amber: "bg-[#f4ead5] text-[#8a682d]",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
  }[tone];

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${styles}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#211f1b]/15 bg-white p-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-[#756f64]">{children}</div>}
    </div>
  );
}

export function HotelMissing() {
  return (
    <Alert kind="info">
      Es sind noch keine Hotel-Stammdaten gespeichert.{" "}
      <a href="/admin/hotel/einstellungen" className="underline">
        Jetzt unter „Hotel“ anlegen
      </a>
      .
    </Alert>
  );
}

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageIntro eyebrow="Hotel-PMS" title={title} />
      <div className="mt-10 rounded-2xl border border-dashed border-[#211f1b]/15 bg-white p-10 text-center sm:p-14">
        <Badge tone="amber">In Vorbereitung</Badge>
        <p className="mx-auto mt-5 max-w-xl text-[#756f64]">{description}</p>
        <a
          href="/admin/hotel"
          className="mt-8 inline-block text-sm font-bold text-[#315c45] hover:underline"
        >
          ← Zurück zur Übersicht
        </a>
      </div>
    </div>
  );
}
