import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, TableCard, Th, Td, Money, EmptyState } from "@/components/ui";
import { NewBankTransactionForm } from "./new-transaction-form";
import { ReconcileToggle } from "./reconcile-toggle";

export default async function BankAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: account } = await supabase.from("bank_accounts").select("id, name, kind").eq("id", id).maybeSingle();
  if (!account) notFound();

  const { data: transactions } = await supabase.from("bank_transactions").select("*").eq("bank_account_id", id).order("date", { ascending: false }).limit(100);
  const balance = (transactions ?? []).reduce((s, t) => s + t.amount_cents, 0);

  return (
    <div>
      <PageHeader title={account.name} subtitle={`Balance from recorded transactions: ${balance < 0 ? "-" : ""}KES ${(Math.abs(balance) / 100).toLocaleString("en-KE")}`} />

      <div className="content-grid">
        {(transactions ?? []).length === 0 ? (
          <div className="card overflow-hidden">
            <EmptyState title="No transactions yet" body="Add a line alongside — a deposit, withdrawal, or fee." />
          </div>
        ) : (
          <TableCard>
            <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th right>Amount</Th>
                <Th right>Reconciled</Th>
              </tr>
            </thead>
            <tbody>
              {(transactions ?? []).map((t) => (
                <tr key={t.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <Td className="text-[var(--text-muted)]">{t.date}</Td>
                  <Td>{t.description || "—"}</Td>
                  <Td right className={`font-semibold ${t.amount_cents < 0 ? "text-[var(--danger-ink)]" : ""}`}>
                    <Money cents={t.amount_cents} />
                  </Td>
                  <Td right>
                    <ReconcileToggle transactionId={t.id} reconciled={!!t.reconciliation_id} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}

        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-3">Add a transaction</h3>
          <NewBankTransactionForm bankAccountId={account.id} />
        </div>
      </div>
    </div>
  );
}
