import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { NewBankAccountForm } from "./new-bank-account-form";

export default async function BankingPage() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: glAccounts }] = await Promise.all([
    supabase.from("bank_accounts").select("id, name, kind, archived, chart_of_accounts(code, name)").eq("archived", false).order("name"),
    supabase.from("chart_of_accounts").select("id, code, name").eq("type", "asset").eq("active", true).order("code"),
  ]);

  return (
    <div>
      <PageHeader title="Banking" />

      <div className="content-grid">
        <div className="card overflow-hidden">
          {(accounts ?? []).length === 0 ? (
            <EmptyState title="No bank accounts yet" body="Add one alongside — track cash, M-Pesa, or a bank account here." />
          ) : (
            (accounts ?? []).map((a: any) => (
              <Link
                key={a.id}
                href={`/banking/${a.id}`}
                className="flex justify-between items-center px-[18px] py-3.5 border-t border-[var(--border)] first:border-t-0 no-underline text-inherit hover:bg-[var(--surface-2)]"
              >
                <div>
                  <p className="text-[14px] font-semibold m-0">{a.name}</p>
                  <p className="text-[12px] text-[var(--text-muted)] mt-0.5 capitalize">
                    {a.kind} {a.chart_of_accounts ? `· ${a.chart_of_accounts.code} ${a.chart_of_accounts.name}` : ""}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-3">Add a bank account</h3>
          <NewBankAccountForm glAccounts={glAccounts ?? []} />
        </div>
      </div>
    </div>
  );
}
