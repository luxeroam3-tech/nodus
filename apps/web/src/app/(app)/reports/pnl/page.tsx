import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Money } from "@/components/ui";

export default async function ProfitAndLossPage({ searchParams }: { searchParams: Promise<{ start?: string; end?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultEnd = now.toISOString().slice(0, 10);
  const { start = defaultStart, end = defaultEnd } = await searchParams;

  const { data: rows } = await supabase.rpc("report_profit_and_loss", { p_org_id: orgId, p_start: start, p_end: end });
  const income = (rows ?? []).filter((r) => r.account_type === "income");
  const expense = (rows ?? []).filter((r) => r.account_type === "expense");
  const totalIncome = income.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const totalExpense = expense.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const netIncome = totalIncome - totalExpense;

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        action={
          <form className="flex items-center gap-2 flex-wrap">
            <input type="date" name="start" defaultValue={start} className="field-input" style={{ padding: "8px 10px", fontSize: 13 }} />
            <span className="text-[var(--text-muted)] text-[13px]">to</span>
            <input type="date" name="end" defaultValue={end} className="field-input" style={{ padding: "8px 10px", fontSize: 13 }} />
            <button className="btn" type="submit">
              View
            </button>
          </form>
        }
      />

      <div className="card overflow-hidden">
        <div className="px-[18px] pt-4 pb-3">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Income</h3>
        </div>
        {income.length === 0 ? (
          <div className="px-[18px] pb-4 text-[13px] text-[var(--text-muted)]">No income posted in this period.</div>
        ) : (
          income.map((r) => (
            <div key={r.account_code} className="flex justify-between px-[18px] py-2.5 border-t border-[var(--border)] text-[13px]">
              <span>
                {r.account_code} · {r.account_name}
              </span>
              <Money cents={r.amount_cents ?? 0} className="font-semibold" />
            </div>
          ))
        )}
        <div className="flex justify-between px-[18px] py-2.5 border-t border-[var(--border-strong)] text-[13.5px] font-semibold bg-[var(--surface-2)]">
          <span>Total income</span>
          <Money cents={totalIncome} />
        </div>

        <div className="px-[18px] pt-4 pb-3 border-t border-[var(--border)]">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Expenses</h3>
        </div>
        {expense.length === 0 ? (
          <div className="px-[18px] pb-4 text-[13px] text-[var(--text-muted)]">No expenses posted in this period.</div>
        ) : (
          expense.map((r) => (
            <div key={r.account_code} className="flex justify-between px-[18px] py-2.5 border-t border-[var(--border)] text-[13px]">
              <span>
                {r.account_code} · {r.account_name}
              </span>
              <Money cents={r.amount_cents ?? 0} className="font-semibold" />
            </div>
          ))
        )}
        <div className="flex justify-between px-[18px] py-2.5 border-t border-[var(--border-strong)] text-[13.5px] font-semibold bg-[var(--surface-2)]">
          <span>Total expenses</span>
          <Money cents={totalExpense} />
        </div>

        <div className={`flex justify-between px-[18px] py-3.5 border-t border-[var(--border-strong)] text-[15px] font-bold ${netIncome >= 0 ? "text-[var(--success-ink)]" : "text-[var(--danger-ink)]"}`}>
          <span>Net income</span>
          <Money cents={netIncome} />
        </div>
      </div>
    </div>
  );
}
