import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { SidebarNav, TabBar } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");
  const org = membership.organizations as unknown as { id: string; name: string; slug: string };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 22px" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "linear-gradient(160deg, var(--accent), var(--accent-ink))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            N
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {org.name}
          </span>
        </div>

        <SidebarNav />

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "0.5px solid var(--border)" }}>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              margin: "0 0 8px",
              padding: "0 10px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="app-main">{children}</main>

      <TabBar />
    </div>
  );
}
