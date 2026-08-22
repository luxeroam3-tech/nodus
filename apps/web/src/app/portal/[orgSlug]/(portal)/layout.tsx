import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { portalSignOut } from "../actions";

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;

  // Login/signup/claim render their own centered card layout — this shell
  // is only for authenticated tenant pages.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/portal/${orgSlug}/login`);

  const { data: org } = await supabase.rpc("get_org_public_info", { p_slug: orgSlug }).maybeSingle();
  if (!org) notFound();

  const { data: tenant } = await supabase.from("tenants").select("id, full_name").eq("org_id", org.id).eq("user_id", user.id).maybeSingle();
  if (!tenant) redirect(`/portal/${orgSlug}/claim`);

  const signOutAction = portalSignOut.bind(null, orgSlug);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{ borderBottom: "0.5px solid var(--border)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: "linear-gradient(160deg, var(--accent), var(--accent-ink))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            N
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>{org.name}</span>
        </div>
        <form action={signOutAction}>
          <button type="submit" style={{ background: "none", border: "none", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
            Sign out
          </button>
        </form>
      </header>
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 60px" }}>{children}</main>
    </div>
  );
}
