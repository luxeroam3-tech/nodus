"use client";

import { useActionState } from "react";
import { createMaintenanceRequest } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

type Unit = { id: string; unit_number: string; properties: { name: string } | null };

export function NewMaintenanceForm({ units }: { units: Unit[] }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createMaintenanceRequest, undefined);

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
        <label className="field-label" htmlFor="title">
          Issue
        </label>
        <input className="field-input" id="title" name="title" placeholder="Leaking tap" required />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="description">
          Details (optional)
        </label>
        <input className="field-input" id="description" name="description" placeholder="Kitchen sink, drips constantly" />
      </div>

      <div style={{ marginBottom: 8 }}>
        <span className="field-label">Priority</span>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="radio" name="priority" value="normal" defaultChecked style={{ accentColor: "var(--accent)" }} />
            Normal
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="radio" name="priority" value="urgent" style={{ accentColor: "var(--danger)" }} />
            Urgent
          </label>
        </div>
      </div>

      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
        {pending ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
