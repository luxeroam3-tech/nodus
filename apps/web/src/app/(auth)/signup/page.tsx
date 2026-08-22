"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthFormState } from "../actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUp, undefined);

  return (
    <form action={formAction}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>Create your account</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 22px" }}>
        Set up Nodus for your properties — you can add a managing agency later.
      </p>

      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="fullName">
          Full name
        </label>
        <input className="field-input" id="fullName" name="fullName" type="text" placeholder="Wanjiru Kamau" autoComplete="name" required />
      </div>

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
        <input className="field-input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>

      {state?.error && <p className="field-error">{state.error}</p>}

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 18 }}>
        Already have an account? <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
      </p>
    </form>
  );
}
