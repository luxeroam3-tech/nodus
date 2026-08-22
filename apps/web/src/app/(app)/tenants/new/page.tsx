"use client";

import { useActionState } from "react";
import { createTenant } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

export default function NewTenantPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createTenant, undefined);

  return (
    <div style={{ maxWidth: 440 }}>
      <p className="page-title" style={{ marginBottom: 18 }}>Add a tenant</p>
      <form action={formAction} className="card" style={{ padding: "20px 22px" }}>
        <div style={{ marginBottom: 14 }}>
          <label className="field-label" htmlFor="fullName">
            Full name
          </label>
          <input className="field-input" id="fullName" name="fullName" placeholder="Brian Otieno" required />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="field-label" htmlFor="phone">
            Phone
          </label>
          <input className="field-input" id="phone" name="phone" placeholder="0712 345 678" />
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
            The tenant uses this exact number to claim their portal account later.
          </p>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label className="field-label" htmlFor="email">
            Email (optional)
          </label>
          <input className="field-input" id="email" name="email" type="email" />
        </div>
        {state?.error && <p className="field-error">{state.error}</p>}
        <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
          {pending ? "Adding…" : "Add tenant"}
        </button>
      </form>
    </div>
  );
}
