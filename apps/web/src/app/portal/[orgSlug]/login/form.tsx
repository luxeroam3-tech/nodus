"use client";

import { useActionState } from "react";
import Link from "next/link";
import { portalSignIn, type PortalFormState } from "../actions";

export function LoginForm({ orgSlug }: { orgSlug: string }) {
  const action = portalSignIn.bind(null, orgSlug);
  const [state, formAction, pending] = useActionState<PortalFormState, FormData>(action, undefined);

  return (
    <form action={formAction}>
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
        <input className="field-input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 18 }}>
        First time here?{" "}
        <Link href={`/portal/${orgSlug}/signup`} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
          Create an account
        </Link>
      </p>
    </form>
  );
}
