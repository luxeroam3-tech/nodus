import { createClient } from "@/lib/supabase/server";
import { NewMaintenanceForm } from "./form";

export default async function NewMaintenanceRequestPage() {
  const supabase = await createClient();
  const { data: units } = await supabase.from("units").select("id, unit_number, properties(name)").order("unit_number");

  return (
    <div style={{ maxWidth: 460 }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 18px" }}>Report an issue</p>
      <NewMaintenanceForm units={(units ?? []) as any} />
    </div>
  );
}
