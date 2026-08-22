"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTenant } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

type Tenant = { id: string; full_name: string; phone: string | null; email: string | null };

export function EditTenantHeader({ tenant }: { tenant: Tenant }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateTenant, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setEditing(false);
    wasPending.current = pending;
  }, [pending, state]);

  if (!editing) {
    return (
      <div className="page-header">
        <div>
          <p className="page-title">{tenant.full_name}</p>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">{tenant.phone ?? tenant.email ?? "No contact on file"}</p>
        </div>
        <button className="btn" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="card px-[18px] py-4 mb-4" style={{ maxWidth: 440 }}>
      <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-3">Edit tenant</h3>
      <form action={formAction}>
        <input type="hidden" name="tenantId" value={tenant.id} />
        <div className="mb-2.5">
          <label className="field-label" htmlFor="fullName">
            Full name
          </label>
          <input className="field-input" id="fullName" name="fullName" defaultValue={tenant.full_name} required />
        </div>
        <div className="mb-2.5">
          <label className="field-label" htmlFor="phone">
            Phone
          </label>
          <input className="field-input" id="phone" name="phone" defaultValue={tenant.phone ?? ""} />
        </div>
        <div className="mb-3">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input className="field-input" id="email" name="email" type="email" defaultValue={tenant.email ?? ""} />
        </div>
        {state?.error && <p className="field-error">{state.error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
