import { createClient } from "@/lib/supabase/server";
import { NewJournalEntryForm } from "./form";

export default async function NewJournalEntryPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("chart_of_accounts").select("code, name, type").eq("active", true).order("code");

  return (
    <div style={{ maxWidth: 640 }}>
      <p className="page-title" style={{ marginBottom: 18 }}>
        New journal entry
      </p>
      <NewJournalEntryForm accounts={accounts ?? []} />
    </div>
  );
}
