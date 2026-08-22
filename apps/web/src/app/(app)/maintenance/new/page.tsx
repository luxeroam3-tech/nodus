import { createClient } from "@/lib/supabase/server";
import { NewMaintenanceForm } from "./form";

export default async function NewMaintenanceRequestPage() {
  const supabase = await createClient();
  const { data: units } = await supabase.from("units").select("id, unit_number, properties(name)").order("unit_number");

  return (
    <div style={{ maxWidth: 460 }}>
      <p className="page-title" style={{ marginBottom: 18 }}>Report an issue</p>
      <NewMaintenanceForm units={(units ?? []) as any} />
    </div>
  );
}
