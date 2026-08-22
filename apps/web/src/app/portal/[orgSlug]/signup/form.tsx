"use client";

import { useActionState } from "react";
import { portalSignUp, type PortalFormState } from "../actions";

export function SignupForm({ orgSlug }: { orgSlug: string }) {
  const action = portalSignUp.bind(null, orgSlug);
  const [state, formAction, pending] = useActionState<PortalFormState, FormData>(action, undefined);

  return (
    <form action={formAction}>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="fullName">
          Full name
        </label>
        <input className="field-input" id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input className="field-input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input className="field-input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
        {pending ? "Creating…" : "Continue"}
      </button>
    </form>
  );
}
