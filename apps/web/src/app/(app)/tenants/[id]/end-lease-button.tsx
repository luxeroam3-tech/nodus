"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { endLease } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

export function EndLeaseButton({ leaseId, tenantId }: { leaseId: string; tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(endLease, undefined);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) router.refresh();
    wasPending.current = pending;
  }, [pending, state, router]);

  if (!open) {
    return (
      <button className="btn" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setOpen(true)}>
        End lease
      </button>
    );
  }

  return (
    <form action={formAction} className="card px-[18px] py-4" style={{ width: 340 }}>
      <input type="hidden" name="leaseId" value={leaseId} />
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className="text-[12px] text-[var(--text-muted)] mb-2.5">
        Marks the unit vacant and starts a move-out checklist. Settle the security deposit separately once the walkthrough is done.
      </p>
      <div className="flex gap-2 mb-3 flex-wrap">
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="field-label">End date</label>
          <input className="field-input" name="endDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="field-label">Reason</label>
          <select className="field-input" name="status" defaultValue="ended">
            <option value="ended">Ended (lease term over)</option>
            <option value="terminated">Terminated (early exit)</option>
          </select>
        </div>
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Ending…" : "Confirm end of lease"}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
