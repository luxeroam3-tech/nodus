"use client";

import { useActionState, useState } from "react";
import { postJournalEntry } from "../../../actions";
import type { AuthFormState } from "../../../../(auth)/actions";

type Account = { code: string; name: string; type: string };

export function NewJournalEntryForm({ accounts }: { accounts: Account[] }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(postJournalEntry, undefined);
  const [rows, setRows] = useState([0, 1]);

  return (
    <form action={formAction} className="card" style={{ padding: "20px 22px" }}>
      <div className="flex gap-3 mb-3.5">
        <div className="flex-1">
          <label className="field-label" htmlFor="date">
            Date
          </label>
          <input className="field-input" id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div className="flex-[2]">
          <label className="field-label" htmlFor="memo">
            Memo
          </label>
          <input className="field-input" id="memo" name="memo" placeholder="What is this entry for?" required />
        </div>
      </div>

      <div className="grid mb-2" style={{ gridTemplateColumns: "1.6fr 1fr 1fr", gap: 8 }}>
        <span className="field-label">Account</span>
        <span className="field-label">Debit (KES)</span>
        <span className="field-label">Credit (KES)</span>
      </div>

      {rows.map((row) => (
        <div key={row} className="grid mb-2" style={{ gridTemplateColumns: "1.6fr 1fr 1fr", gap: 8 }}>
          <select className="field-input" name="accountCode" defaultValue="">
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
          <input className="field-input" name="debitKes" type="number" step="0.01" min={0} placeholder="0" />
          <input className="field-input" name="creditKes" type="number" step="0.01" min={0} placeholder="0" />
        </div>
      ))}

      <button type="button" className="btn" style={{ fontSize: 12.5, padding: "6px 12px", marginBottom: 14 }} onClick={() => setRows((r) => [...r, r.length])}>
        + Add line
      </button>

      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Posting…" : "Post entry"}
      </button>
    </form>
  );
}
