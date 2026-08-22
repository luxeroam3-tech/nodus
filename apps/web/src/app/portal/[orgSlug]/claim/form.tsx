"use client";

import { useActionState } from "react";
import { portalClaim, type PortalFormState } from "../actions";

export function ClaimForm({ orgSlug }: { orgSlug: string }) {
  const action = portalClaim.bind(null, orgSlug);
  const [state, formAction, pending] = useActionState<PortalFormState, FormData>(action, undefined);

  return (
    <form action={formAction}>
      <div style={{ marginBottom: 8 }}>
        <label className="field-label" htmlFor="phone">
          Phone number
        </label>
        <input className="field-input" id="phone" name="phone" type="tel" placeholder="0712 345 678" required />
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
        {pending ? "Linking…" : "Link my account"}
      </button>
    </form>
  );
}
