import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Money } from "@/components/ui";

function Section({ title, rows, total }: { title: string; rows: { account_code: string; account_name: string; balance_cents: number }[]; total: number }) {
  return (
    <>
      <div className="px-[18px] pt-4 pb-3 border-t border-[var(--border)] first:border-t-0">
        <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-[18px] pb-4 text-[13px] text-[var(--text-muted)]">Nothing here.</div>
      ) : (
        rows.map((r) => (
          <div key={r.account_code} className="flex justify-between px-[18px] py-2.5 border-t border-[var(--border)] text-[13px]">
            <span>
              {r.account_code} · {r.account_name}
            </span>
            <Money cents={r.balance_cents} className="font-semibold" />
          </div>
        ))
      )}
      <div className="flex justify-between px-[18px] py-2.5 border-t border-[var(--border-strong)] text-[13.5px] font-semibold bg-[var(--surface-2)]">
        <span>Total {title.toLowerCase()}</span>
        <Money cents={total} />
      </div>
    </>
  );
}

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const { asOf = new Date().toISOString().slice(0, 10) } = await searchParams;
  const { data: rows } = await supabase.rpc("report_balance_sheet", { p_org_id: orgId, p_as_of: asOf });

  const assets = (rows ?? []).filter((r) => r.account_type === "asset");
  const liabilities = (rows ?? []).filter((r) => r.account_type === "liability");
  const equity = (rows ?? []).filter((r) => r.account_type === "equity");
  const totalAssets = assets.reduce((s, r) => s + (r.balance_cents ?? 0), 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + (r.balance_cents ?? 0), 0);
  const totalEquity = equity.reduce((s, r) => s + (r.balance_cents ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Balance Sheet"
        subtitle={`As of ${asOf}`}
        action={
          <form className="flex items-center gap-2">
            <input type="date" name="asOf" defaultValue={asOf} className="field-input" style={{ padding: "8px 10px", fontSize: 13, width: "auto" }} />
            <button className="btn" type="submit">
              View
            </button>
          </form>
        }
      />

      <div className="content-grid">
        <div className="card overflow-hidden">
          <Section title="Assets" rows={assets.map((r) => ({ account_code: r.account_code!, account_name: r.account_name!, balance_cents: r.balance_cents ?? 0 }))} total={totalAssets} />
        </div>

        <div className="card overflow-hidden">
          <Section
            title="Liabilities"
            rows={liabilities.map((r) => ({ account_code: r.account_code!, account_name: r.account_name!, balance_cents: r.balance_cents ?? 0 }))}
            total={totalLiabilities}
          />
          <Section title="Equity" rows={equity.map((r) => ({ account_code: r.account_code!, account_name: r.account_name!, balance_cents: r.balance_cents ?? 0 }))} total={totalEquity} />
          <div className="flex justify-between px-[18px] py-3.5 border-t border-[var(--border-strong)] text-[14px] font-bold">
            <span>Total liabilities + equity</span>
            <Money cents={totalLiabilities + totalEquity} />
          </div>
        </div>
      </div>

      {totalAssets !== totalLiabilities + totalEquity && (
        <p className="text-[12.5px] text-[var(--danger-ink)] mt-3">
          Assets don't equal liabilities + equity ({<Money cents={totalAssets} />} vs {<Money cents={totalLiabilities + totalEquity} />}) — check for unposted or unbalanced entries.
        </p>
      )}
    </div>
  );
}
