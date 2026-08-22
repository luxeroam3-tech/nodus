"use client";

import { useActionState } from "react";
import { portalCreateMaintenanceRequest, type PortalFormState } from "../../../actions";

export function ReportIssueForm({ orgSlug, orgId, tenantId, unitId }: { orgSlug: string; orgId: string; tenantId: string; unitId: string }) {
  const action = portalCreateMaintenanceRequest.bind(null, orgSlug);
  const [state, formAction, pending] = useActionState<PortalFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="card" style={{ padding: "20px 22px" }}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="unitId" value={unitId} />

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
        <span className="field-label">How urgent is it?</span>
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
