import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./form";

export default async function PortalSignupPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase.rpc("get_org_public_info", { p_slug: orgSlug }).maybeSingle();
  if (!org) notFound();

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>{org.name}</p>
        <p style={{ textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 24 }}>Create your account</p>
        <div className="card" style={{ padding: "26px 24px" }}>
          <SignupForm orgSlug={orgSlug} />
        </div>
      </div>
    </div>
  );
}
