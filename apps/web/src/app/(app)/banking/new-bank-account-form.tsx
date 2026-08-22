"use client";

import { useActionState } from "react";
import { createBankAccount } from "../actions";
import type { AuthFormState } from "../../(auth)/actions";

export function NewBankAccountForm({ glAccounts }: { glAccounts: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createBankAccount, undefined);

  return (
    <form action={formAction}>
      <div className="mb-2.5">
        <label className="field-label" htmlFor="name">
          Name
        </label>
        <input className="field-input" id="name" name="name" placeholder="Equity Bank - 001" required />
      </div>
      <div className="mb-2.5">
        <label className="field-label" htmlFor="kind">
          Kind
        </label>
        <select className="field-input" id="kind" name="kind" defaultValue="bank">
          <option value="bank">Bank</option>
          <option value="mpesa">M-Pesa</option>
          <option value="cash">Cash</option>
        </select>
      </div>
      <div className="mb-3">
        <label className="field-label" htmlFor="accountId">
          Ledger account
        </label>
        <select className="field-input" id="accountId" name="accountId" defaultValue="">
          <option value="">None</option>
          {glAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </select>
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add account"}
      </button>
    </form>
  );
}
