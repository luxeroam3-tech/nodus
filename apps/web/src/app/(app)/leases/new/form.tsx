"use client";

import { useActionState } from "react";
import { createLease } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

type Unit = { id: string; unit_number: string; properties: { name: string } | null };
type Tenant = { id: string; full_name: string };

export function NewLeaseForm({ units, tenants }: { units: Unit[]; tenants: Tenant[] }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createLease, undefined);

  if (units.length === 0) {
    return (
      <div className="card" style={{ padding: "20px 22px", color: "var(--text-muted)", fontSize: 13.5 }}>
        No vacant units — add a property and unit first.
      </div>
    );
  }
  if (tenants.length === 0) {
    return (
      <div className="card" style={{ padding: "20px 22px", color: "var(--text-muted)", fontSize: 13.5 }}>
        No tenants on file — add a tenant first.
      </div>
    );
  }

  return (
    <form action={formAction} className="card" style={{ padding: "20px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="unitId">
          Unit
        </label>
        <select className="field-input" id="unitId" name="unitId" required>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.properties?.name} · {u.unit_number}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="tenantId">
          Tenant
        </label>
        <select className="field-input" id="tenantId" name="tenantId" required>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="startDate">
          Start date
        </label>
        <input className="field-input" id="startDate" name="startDate" type="date" required />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="rentKes">
            Monthly rent (KES)
          </label>
          <input className="field-input" id="rentKes" name="rentKes" type="number" min={1} required />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="depositKes">
            Deposit (KES)
          </label>
          <input className="field-input" id="depositKes" name="depositKes" type="number" min={0} defaultValue={0} />
        </div>
      </div>

      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
        {pending ? "Creating…" : "Create lease"}
      </button>
    </form>
  );
}
