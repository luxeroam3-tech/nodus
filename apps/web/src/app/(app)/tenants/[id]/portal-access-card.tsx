"use client";

import { useActionState, useState } from "react";
import { provisionTenantPortalAccess, type PortalAccessState } from "../../actions";

export function PortalAccessCard({ tenantId, hasPortal, defaultEmail }: { tenantId: string; hasPortal: boolean; defaultEmail: string | null }) {
  const [state, formAction, pending] = useActionState<PortalAccessState, FormData>(provisionTenantPortalAccess, undefined);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  if (hasPortal && !state?.success) {
    return (
      <div className="card px-[18px] py-4">
        <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0 mb-1">Tenant portal</h3>
        <p className="text-[12.5px] text-[var(--text-muted)] m-0">This tenant already has portal access and signs in on their own.</p>
      </div>
    );
  }

  if (state?.success) {
    return (
      <div className="card px-[18px] py-4">
        <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0 mb-1">Portal access created</h3>
        <p className="text-[12.5px] text-[var(--text-muted)] mb-3">
          Share these with the tenant now — the password won't be shown again.
        </p>
        {([
          ["Link", state.success.loginUrl],
          ["Email", state.success.email],
          ["Password", state.success.password],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 py-1.5 border-t border-[var(--border)] first:border-t-0">
            <div className="min-w-0">
              <p className="text-[11px] text-[var(--text-muted)] m-0">{label}</p>
              <p className="text-[13px] font-semibold m-0 truncate">{value}</p>
            </div>
            <button type="button" className="btn shrink-0" style={{ fontSize: 11.5, padding: "4px 9px" }} onClick={() => copy(label, value)}>
              {copied === label ? "Copied" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form action={formAction} className="card px-[18px] py-4">
      <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0 mb-1">Set up tenant portal</h3>
      <p className="text-[12.5px] text-[var(--text-muted)] mb-3">
        Create a login for this tenant — you'll get a link, email, and password to share with them.
      </p>
      <input type="hidden" name="tenantId" value={tenantId} />
      <label className="field-label">Email</label>
      <input className="field-input" name="email" type="email" defaultValue={defaultEmail ?? ""} required />
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 12 }}>
        {pending ? "Creating…" : "Create portal login"}
      </button>
    </form>
  );
}
