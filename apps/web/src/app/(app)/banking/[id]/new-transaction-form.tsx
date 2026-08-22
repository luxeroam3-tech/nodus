"use client";

import { useActionState } from "react";
import { createBankTransaction } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

export function NewBankTransactionForm({ bankAccountId }: { bankAccountId: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createBankTransaction, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="bankAccountId" value={bankAccountId} />
      <div className="mb-2.5">
        <label className="field-label" htmlFor="description">
          Description
        </label>
        <input className="field-input" id="description" name="description" placeholder="Deposit, bank fee, withdrawal…" />
      </div>
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label className="field-label" htmlFor="amountKes">
            Amount (KES)
          </label>
          <input className="field-input" id="amountKes" name="amountKes" type="number" step="0.01" required />
          <p className="text-[11.5px] text-[var(--text-muted)] mt-1.5">Negative for a withdrawal or fee.</p>
        </div>
        <div className="flex-1">
          <label className="field-label" htmlFor="date">
            Date
          </label>
          <input className="field-input" id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add transaction"}
      </button>
    </form>
  );
}
