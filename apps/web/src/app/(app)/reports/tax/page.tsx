import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";

export default async function TaxReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const orgId = membership.org_id;

  const { data: org } = await supabase.from("organizations").select("vat_registered").eq("id", orgId).maybeSingle();

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { period = defaultPeriod } = await searchParams;
  const [yearStr, monthStr] = period.split("-");
  const year = Number(yearStr) || now.getFullYear();
  const month = Number(monthStr) || now.getMonth() + 1;

  const [{ data: rentalTax }, { data: vatOutput }] = await Promise.all([
    supabase.rpc("report_monthly_rental_income_tax", { p_org_id: orgId, p_year: year, p_month: month }).maybeSingle(),
    org?.vat_registered
      ? supabase.rpc("report_vat_output", { p_org_id: orgId, p_year: year, p_month: month }).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <PageHeader
        title="KRA Tax Reports"
        action={
          <form className="flex items-center gap-2">
            <input type="month" name="period" defaultValue={period} className="field-input" style={{ padding: "8px 10px", fontSize: 13 }} />
            <button className="btn" type="submit">
              View
            </button>
          </form>
        }
      />

      <div className="content-grid">
        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-1">Monthly Rental Income Tax</h3>
          <p className="text-[12.5px] text-[var(--text-muted)] mb-4">7.5% MRI, withholding-final tax on residential rent — {period}.</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Gross rent received" cents={rentalTax?.gross_rent_received_cents ?? 0} />
            <StatCard label="Tax due (7.5%)" cents={rentalTax?.tax_due_cents ?? 0} tone={rentalTax?.tax_due_cents ? "warn" : "neutral"} />
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-3">{rentalTax?.payment_count ?? 0} payment(s) counted for this period.</p>
        </div>

        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-1">VAT Output</h3>
          <p className="text-[12.5px] text-[var(--text-muted)] mb-4">VAT collected on commercial units — {period}.</p>
          {org?.vat_registered ? (
            <>
              <StatCard label="VAT output" cents={vatOutput?.vat_output_cents ?? 0} />
              <p className="text-[12px] text-[var(--text-muted)] mt-3">{vatOutput?.invoice_count ?? 0} invoice(s) counted for this period.</p>
            </>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">Not VAT-registered — turn this on in Settings to track VAT output.</p>
          )}
        </div>
      </div>
    </div>
  );
}
