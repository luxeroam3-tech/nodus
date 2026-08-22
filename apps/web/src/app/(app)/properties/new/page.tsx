"use client";

import { useActionState } from "react";
import { createProperty } from "../../actions";
import type { AuthFormState } from "../../../(auth)/actions";

const TYPES = ["apartment", "bedsitter", "maisonette", "bungalow", "commercial", "mixed_use"] as const;

export default function NewPropertyPage() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createProperty, undefined);

  return (
    <div style={{ maxWidth: 440 }}>
      <p className="page-title" style={{ marginBottom: 18 }}>Add a property</p>
      <form action={formAction} className="card" style={{ padding: "20px 22px" }}>
        <div style={{ marginBottom: 14 }}>
          <label className="field-label" htmlFor="name">
            Property name
          </label>
          <input className="field-input" id="name" name="name" placeholder="Kilimani Heights" required />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="field-label" htmlFor="type">
            Type
          </label>
          <select className="field-input" id="type" name="type" defaultValue="apartment">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label className="field-label" htmlFor="address">
            Address
          </label>
          <input className="field-input" id="address" name="address" placeholder="Kilimani, Nairobi" />
        </div>
        {state?.error && <p className="field-error">{state.error}</p>}
        <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%", marginTop: 14 }}>
          {pending ? "Adding…" : "Add property"}
        </button>
      </form>
    </div>
  );
}
