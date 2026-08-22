"use client";

import { useActionState, useState } from "react";
import { createOrganization } from "./actions";
import type { AuthFormState } from "../(auth)/actions";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createOrganization, undefined);
  const [type, setType] = useState<"individual" | "agency">("individual");

  return (
    <form action={formAction}>
      <div style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="name">
          Organization name
        </label>
        <input className="field-input" id="name" name="name" type="text" placeholder="Kilimani Heights Ltd" required />
      </div>

      <div style={{ marginBottom: 8 }}>
        <span className="field-label">I am</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["individual", "agency"] as const).map((option) => (
            <label
              key={option}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 10,
                border: `0.5px solid ${type === option ? "var(--accent)" : "var(--border)"}`,
                background: type === option ? "var(--accent-bg)" : "var(--surface)",
                cursor: "pointer",
                fontSize: 13.5,
              }}
            >
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => setType(option)}
                style={{ accentColor: "var(--accent)" }}
              />
              {option === "individual" ? "An individual landlord" : "A managing agency"}
            </label>
          ))}
        </div>
      </div>

      {state?.error && <p className="field-error">{state.error}</p>}

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 18 }}>
        {pending ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}
