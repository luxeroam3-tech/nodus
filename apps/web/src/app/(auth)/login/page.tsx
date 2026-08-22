"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthFormState } from "../actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signIn, undefined);

  return (
    <form action={formAction}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Sign in</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 22px" }}>Welcome back to Nodus.</p>

      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input className="field-input" id="email" name="email" type="email" placeholder="you@company.co.ke" autoComplete="email" required />
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
        New to Nodus? <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Create an account</Link>
      </p>
    </form>
  );
}
