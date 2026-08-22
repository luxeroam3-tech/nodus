"use client";

import { useActionState } from "react";
import { createUnit } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

export function AddUnitForm({ propertyId }: { propertyId: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createUnit, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <div style={{ marginBottom: 10 }}>
        <label className="field-label" htmlFor="unitNumber">
          Unit number
        </label>
        <input className="field-input" id="unitNumber" name="unitNumber" placeholder="A4" required />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="field-label" htmlFor="bedrooms">
          Bedrooms
        </label>
        <input className="field-input" id="bedrooms" name="bedrooms" type="number" min={0} defaultValue={1} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" name="isCommercial" style={{ accentColor: "var(--accent)" }} />
        Commercial unit
      </label>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Adding…" : "Add unit"}
      </button>
    </form>
  );
}
