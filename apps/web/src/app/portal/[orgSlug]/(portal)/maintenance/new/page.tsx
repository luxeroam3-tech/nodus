import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportIssueForm } from "./form";

export default async function TenantReportIssuePage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/portal/${orgSlug}/login`);

  const { data: tenant } = await supabase.from("tenants").select("id, org_id").eq("user_id", user.id).maybeSingle();
  if (!tenant) redirect(`/portal/${orgSlug}/claim`);

  const { data: lease } = await supabase.from("leases").select("unit_id").eq("tenant_id", tenant.id).eq("status", "active").maybeSingle();
  if (!lease) {
    return (
      <div className="card" style={{ padding: "20px 22px", color: "var(--text-muted)", fontSize: 13.5 }}>
        No active lease on file — contact your landlord directly.
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 18px" }}>Report an issue</p>
      <ReportIssueForm orgSlug={orgSlug} orgId={tenant.org_id} tenantId={tenant.id} unitId={lease.unit_id} />
    </div>
  );
}
