import { createClient } from "@/lib/supabase/server";
import { NewExpenseForm } from "./form";

export default async function NewExpensePage() {
  const supabase = await createClient();
  const { data: expenseAccounts } = await supabase.from("chart_of_accounts").select("code, name").eq("type", "expense").eq("active", true).order("code");

  return (
    <div style={{ maxWidth: 460 }}>
      <p className="page-title" style={{ marginBottom: 18 }}>
        Record expense
      </p>
      <NewExpenseForm expenseAccounts={expenseAccounts ?? []} />
    </div>
  );
}
