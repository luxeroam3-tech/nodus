import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, TableCard, Th, Td, Money, EmptyState } from "@/components/ui";

export default async function GeneralLedgerPage({ searchParams }: { searchParams: Promise<{ account?: string; start?: string; end?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const { data: accounts } = await supabase.from("chart_of_accounts").select("id, code, name").eq("org_id", orgId).eq("active", true).order("code");

  const now = new Date();
  const defaultStart = `${now.getFullYear()}-01-01`;
  const defaultEnd = now.toISOString().slice(0, 10);
  const { account = accounts?.[0]?.id ?? "", start = defaultStart, end = defaultEnd } = await searchParams;

  const { data: rows } = account ? await supabase.rpc("report_general_ledger", { p_org_id: orgId, p_account_id: account, p_start: start, p_end: end }) : { data: [] };

  return (
    <div>
      <PageHeader
        title="General Ledger"
        action={
          <div className="flex items-center gap-2 flex-wrap">
          <form className="flex items-center gap-2 flex-wrap">
            <select name="account" defaultValue={account} className="field-input" style={{ padding: "8px 10px", fontSize: 13, width: "auto" }}>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
            <input type="date" name="start" defaultValue={start} className="field-input" style={{ padding: "8px 10px", fontSize: 13 }} />
            <span className="text-[var(--text-muted)] text-[13px]">to</span>
            <input type="date" name="end" defaultValue={end} className="field-input" style={{ padding: "8px 10px", fontSize: 13 }} />
            <button className="btn" type="submit">
              View
            </button>
          </form>
          <Link href="/reports/journal/new" className="btn btn-primary no-underline">
            New entry
          </Link>
          </div>
        }
      />

      {(rows ?? []).length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState title="No transactions" body="Nothing posted to this account in the selected period." />
        </div>
      ) : (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Date</Th>
              <Th>Memo</Th>
              <Th right>Debit</Th>
              <Th right>Credit</Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r, i) => (
              <tr key={i} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                <Td className="text-[var(--text-muted)]">{r.entry_date}</Td>
                <Td>{r.memo}</Td>
                <Td right>{r.debit_cents ? <Money cents={r.debit_cents} /> : "—"}</Td>
                <Td right>{r.credit_cents ? <Money cents={r.credit_cents} /> : "—"}</Td>
                <Td right className="font-semibold">
                  <Money cents={r.running_balance_cents ?? 0} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
