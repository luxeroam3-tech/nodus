import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membership) redirect("/");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }} className="card">
        <div style={{ padding: "28px 26px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Set up your workspace</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 22px" }}>
            One organization per portfolio you manage — you can invite a managing agency's staff or add more owners later in Settings.
          </p>
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
