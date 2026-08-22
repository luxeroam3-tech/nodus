import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../(auth)/actions";

function isAdminEmail(email: string | undefined | null): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allowlist.includes(email.toLowerCase());
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "0.5px solid var(--border)", background: "var(--surface)" }}>
        <span className="[font-family:var(--font-display)] text-[15px] font-semibold">Nodus — Internal Admin</span>
        <form action={signOut}>
          <button type="submit" className="btn" style={{ fontSize: 12.5, padding: "6px 12px" }}>
            Sign out
          </button>
        </form>
      </header>
      <main style={{ padding: "24px 30px 34px", maxWidth: 1100, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
