import { createClient } from "@/lib/supabase/server";
import { NewLeaseForm } from "./form";

export default async function NewLeasePage() {
  const supabase = await createClient();
  const [{ data: vacantUnits }, { data: tenants }] = await Promise.all([
    supabase.from("units").select("id, unit_number, properties(name)").eq("status", "vacant").order("unit_number"),
    supabase.from("tenants").select("id, full_name").order("full_name"),
  ]);

  return (
    <div style={{ maxWidth: 460 }}>
      <p className="page-title" style={{ marginBottom: 18 }}>New lease</p>
      <NewLeaseForm units={(vacantUnits ?? []) as any} tenants={tenants ?? []} />
    </div>
  );
}
