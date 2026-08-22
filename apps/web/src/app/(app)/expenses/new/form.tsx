"use client";

import { useActionState, useState } from "react";
import { recordExpense } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

export function NewExpenseForm({ expenseAccounts }: { expenseAccounts: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(recordExpense, undefined);
  const [paid, setPaid] = useState(true);

  return (
    <form action={formAction} className="card" style={{ padding: "20px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="vendorName">
          Vendor / description
        </label>
        <input className="field-input" id="vendorName" name="vendorName" placeholder="ABC Plumbing" required />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="expenseAccountCode">
          Category
        </label>
        <select className="field-input" id="expenseAccountCode" name="expenseAccountCode" required defaultValue="">
          <option value="" disabled>
            Choose a category
          </option>
          {expenseAccounts.map((a) => (
            <option key={a.code} value={a.code}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="amountKes">
            Amount (KES)
          </label>
          <input className="field-input" id="amountKes" name="amountKes" type="number" min={1} step="0.01" required />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="date">
            Date
          </label>
          <input className="field-input" id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14 }}>
        <input type="checkbox" name="paid" checked={paid} onChange={(e) => setPaid(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
        Paid already
      </label>

      {paid && (
        <div style={{ marginBottom: 8 }}>
          <label className="field-label" htmlFor="method">
            Paid via
          </label>
          <select className="field-input" id="method" name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      )}
      {!paid && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Recorded as an unpaid bill — settle it later from the Expenses list.</p>}

      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 6 }}>
        {pending ? "Saving…" : "Record expense"}
      </button>
    </form>
  );
}
