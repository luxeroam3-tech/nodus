import { createClient } from "@/lib/supabase/server";
import { RecordPaymentButton } from "./record-payment-button";
import { PageHeader, TableCard, Th, Td, Money, EmptyState } from "@/components/ui";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const [{ data: openDocs }, { data: payments }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, number, total_cents, paid_cents, due_date, tenants(full_name)")
      .in("status", ["open", "partial"])
      .order("due_date"),
    supabase.from("payments").select("id, amount_cents, method, reference, date, document_id, documents(number)").order("date", { ascending: false }).limit(20),
  ]);

  return (
    <div>
      <PageHeader title="Payments" />

      <div className="grid gap-4">
        <div className="card overflow-hidden">
          <div className="px-[18px] pt-4 pb-3">
            <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Open invoices</h3>
          </div>
          {(openDocs ?? []).length === 0 ? (
            <EmptyState title="Nothing outstanding" body="Every invoice has been paid in full." />
          ) : (
            (openDocs ?? []).map((d: any) => {
              const balance = d.total_cents - d.paid_cents;
              return (
                <div key={d.id} className="flex justify-between items-center px-[18px] py-3 border-t border-[var(--border)] flex-wrap gap-2.5">
                  <div>
                    <p className="text-[13.5px] font-semibold m-0">
                      {d.tenants?.full_name} · {d.number}
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                      Due {d.due_date} · <Money cents={balance} /> outstanding
                    </p>
                  </div>
                  <RecordPaymentButton documentId={d.id} amountCents={balance} />
                </div>
              );
            })
          )}
        </div>

        {(payments ?? []).length === 0 ? (
          <div className="card overflow-hidden">
            <div className="px-[18px] pt-4 pb-3">
              <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Recent payments</h3>
            </div>
            <EmptyState title="No payments yet" body="Payments will show up here once rent starts coming in." />
          </div>
        ) : (
          <TableCard>
            <thead className="[&_th]:border-b [&_th]:border-[var(--border)]">
              <tr>
                <Th>Invoice</Th>
                <Th>Reference</Th>
                <Th>Date</Th>
                <Th>Method</Th>
                <Th right>Amount</Th>
                <Th right>Receipt</Th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p: any) => (
                <tr key={p.id} className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)]">
                  <Td className="font-semibold">{p.documents?.number}</Td>
                  <Td className="text-[var(--text-muted)]">{p.reference}</Td>
                  <Td className="text-[var(--text-muted)]">{new Date(p.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</Td>
                  <Td className="capitalize text-[var(--text-secondary)]">{p.method}</Td>
                  <Td right className="font-semibold">
                    <Money cents={p.amount_cents} />
                  </Td>
                  <Td right>
                    <a href={`/api/receipts/by-payment/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn no-underline text-[12px] px-2.5 py-1">
                      Receipt
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </div>
  );
}
