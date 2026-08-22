import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClaimForm } from "./form";

export default async function ClaimPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/portal/${orgSlug}/login`);

  const { data: org } = await supabase.rpc("get_org_public_info", { p_slug: orgSlug }).maybeSingle();
  if (!org) notFound();

  const { data: tenant } = await supabase.from("tenants").select("id").eq("org_id", org.id).eq("user_id", user.id).maybeSingle();
  if (tenant) redirect(`/portal/${orgSlug}`);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{org.name}</p>
        <p style={{ textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 24 }}>Link your account</p>
        <div className="card" style={{ padding: "26px 24px" }}>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", margin: "0 0 18px" }}>
            Enter the phone number your landlord has on file to connect your lease to this account.
          </p>
          <ClaimForm orgSlug={orgSlug} />
        </div>
      </div>
    </div>
  );
}
