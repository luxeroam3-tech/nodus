import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, TableCard, Th, Td, Money } from "@/components/ui";

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const { asOf = new Date().toISOString().slice(0, 10) } = await searchParams;
  const { data: rows } = await supabase.rpc("report_trial_balance", { p_org_id: orgId, p_as_of: asOf });

  const debitTotal = (rows ?? []).filter((r) => r.account_type === "asset" || r.account_type === "expense").reduce((s, r) => s + (r.balance_cents ?? 0), 0);
  const creditTotal = (rows ?? []).filter((r) => r.account_type !== "asset" && r.account_type !== "expense").reduce((s, r) => s + (r.balance_cents ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Trial Balance"
        subtitle={`As of ${asOf}`}
        action={
          <form className="flex items-center gap-2">
            <input type="date" name="asOf" defaultValue={asOf} className="field-input" style={{ padding: "8px 10px", fontSize: 13 }} />
            <button className="btn" type="submit">
              View
            </button>
          </form>
        }
      />

      <TableCard>
        <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
          <tr>
            <Th>Account</Th>
            <Th>Type</Th>
            <Th right>Debit</Th>
            <Th right>Credit</Th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? [])
            .filter((r) => r.balance_cents)
            .map((r) => {
              const isDebitSide = r.account_type === "asset" || r.account_type === "expense";
              return (
                <tr key={r.account_code} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <Td className="font-semibold">
                    {r.account_code} · {r.account_name}
                  </Td>
                  <Td className="text-[var(--text-muted)] capitalize">{r.account_type}</Td>
                  <Td right>{isDebitSide ? <Money cents={r.balance_cents ?? 0} /> : "—"}</Td>
                  <Td right>{!isDebitSide ? <Money cents={r.balance_cents ?? 0} /> : "—"}</Td>
                </tr>
              );
            })}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--border-strong)] font-semibold bg-[var(--surface-2)]">
            <Td>Total</Td>
            <Td />
            <Td right>
              <Money cents={debitTotal} />
            </Td>
            <Td right>
              <Money cents={creditTotal} />
            </Td>
          </tr>
        </tfoot>
      </TableCard>
    </div>
  );
}
