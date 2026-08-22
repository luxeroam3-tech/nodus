import Link from "next/link";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn btn-primary no-underline">
      {children}
    </Link>
  );
}

const documentPillStyles: Record<string, string> = {
  open: "bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  partial: "bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  paid: "bg-[var(--success-bg)] text-[var(--success-ink)]",
  void: "bg-[var(--surface-3)] text-[var(--text-muted)] line-through",
  active: "bg-[var(--success-bg)] text-[var(--success-ink)]",
  ended: "bg-[var(--surface-3)] text-[var(--text-secondary)]",
  terminated: "bg-[var(--danger-bg)] text-[var(--danger-ink)]",
  open_request: "bg-[var(--danger-bg)] text-[var(--danger-ink)]",
  in_progress: "bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  resolved: "bg-[var(--success-bg)] text-[var(--success-ink)]",
  closed: "bg-[var(--surface-3)] text-[var(--text-secondary)]",
};

const documentPillLabels: Record<string, string> = {
  open: "Awaiting payment",
  partial: "Partly paid",
  paid: "Paid",
  void: "Void",
  active: "Active",
  ended: "Ended",
  terminated: "Terminated",
  in_progress: "In progress",
};

export function StatusPill({ status, overdue }: { status: string; overdue?: boolean }) {
  const s = overdue && (status === "open" || status === "partial") ? "overdue" : status;
  const style = s === "overdue" ? "bg-[var(--danger-bg)] text-[var(--danger-ink)]" : (documentPillStyles[s] ?? "bg-[var(--surface-3)] text-[var(--text-secondary)]");
  const label = s === "overdue" ? "Overdue" : (documentPillLabels[s] ?? s);
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${style}`}>{label}</span>;
}

export function fmtKES(cents: number) {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export function Money({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{fmtKES(cents)}</span>;
}

export function StatCard({
  label,
  hint,
  cents,
  value,
  tone = "neutral",
}: {
  label: string;
  hint?: string;
  cents?: number;
  value?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const toneClass = tone === "good" ? "text-[var(--success-ink)]" : tone === "bad" ? "text-[var(--danger-ink)]" : tone === "warn" ? "text-[var(--warning-ink)]" : "";
  return (
    <div className="card px-[18px] py-4">
      <div className="text-[12.5px] text-[var(--text-secondary)] font-medium">{label}</div>
      <div className={`[font-family:var(--font-display)] text-[23px] font-semibold tracking-tight tabular-nums mt-2 ${toneClass}`}>{value ?? (cents !== undefined ? fmtKES(cents) : "—")}</div>
      {hint && <div className="text-[12px] text-[var(--text-muted)] mt-1.5">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="px-8 py-14 text-center">
      <div className="text-[15px] font-semibold">{title}</div>
      <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-sm mx-auto">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)] ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

export function Td({ children, right, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-4 py-3 text-[13px] ${right ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}

export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px]">{children}</table>
    </div>
  );
}
