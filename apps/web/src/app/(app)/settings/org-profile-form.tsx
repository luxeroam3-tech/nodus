"use client";

import { useActionState } from "react";
import { updateOrgProfile } from "../actions";
import type { AuthFormState } from "../../(auth)/actions";

export function OrgProfileForm({ org, disabled }: { org: { name: string; kra_pin: string | null; vat_registered: boolean }; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateOrgProfile, undefined);

  return (
    <form action={formAction}>
      <div className="mb-2.5">
        <label className="field-label" htmlFor="name">
          Organization name
        </label>
        <input className="field-input" id="name" name="name" defaultValue={org.name} required disabled={disabled} />
      </div>
      <div className="mb-2.5">
        <label className="field-label" htmlFor="kraPin">
          KRA PIN
        </label>
        <input className="field-input" id="kraPin" name="kraPin" placeholder="P0XXXXXXXXX" defaultValue={org.kra_pin ?? ""} disabled={disabled} />
      </div>
      <label className="flex items-center gap-2 text-[13px] mb-3">
        <input type="checkbox" name="vatRegistered" defaultChecked={org.vat_registered} disabled={disabled} style={{ accentColor: "var(--accent)" }} />
        VAT registered
      </label>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending || disabled}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
