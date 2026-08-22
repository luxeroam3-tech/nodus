import { createClient } from "@/lib/supabase/server";
import { PageHeader, PrimaryLink, TableCard, Th, Td, Money, StatusPill, EmptyState } from "@/components/ui";
import { PayBillButton } from "./pay-bill-button";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, number, notes, type, status, issue_date, total_cents, paid_cents")
    .in("type", ["expense", "bill"])
    .order("issue_date", { ascending: false })
    .limit(50);

  const openBills = (docs ?? []).filter((d) => d.type === "bill" && (d.status === "open" || d.status === "partial"));

  return (
    <div>
      <PageHeader title="Expenses" action={<PrimaryLink href="/expenses/new">Record expense</PrimaryLink>} />

      {(docs ?? []).length === 0 ? (
        <div className="card overflow-hidden">
          <EmptyState title="No expenses yet" body="Record a paid expense or an unpaid bill to start tracking outgoings." />
        </div>
      ) : (
        <TableCard>
          <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
            <tr>
              <Th>Vendor</Th>
              <Th>Reference</Th>
              <Th>Date</Th>
              <Th right>Status</Th>
              <Th right>Amount</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {(docs ?? []).map((d) => {
              const balance = d.total_cents - d.paid_cents;
              const isOpenBill = openBills.some((b) => b.id === d.id);
              return (
                <tr key={d.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <Td className="font-semibold">{d.notes ?? "—"}</Td>
                  <Td className="text-[var(--text-muted)]">{d.number}</Td>
                  <Td className="text-[var(--text-muted)]">{d.issue_date}</Td>
                  <Td right>
                    <StatusPill status={d.status} />
                  </Td>
                  <Td right className="font-semibold">
                    <Money cents={d.total_cents} />
                  </Td>
                  <Td right>{isOpenBill && <PayBillButton documentId={d.id} amountCents={balance} />}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
