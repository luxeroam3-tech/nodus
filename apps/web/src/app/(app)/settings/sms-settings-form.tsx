"use client";

import { useActionState } from "react";
import { updateSmsSettings } from "../actions";
import type { AuthFormState } from "../../(auth)/actions";

export function SmsSettingsForm({ enabled, disabled }: { enabled: boolean; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateSmsSettings, undefined);

  return (
    <form action={formAction}>
      <label className="flex items-center gap-2 text-[13px] mb-3">
        <input type="checkbox" name="enabled" defaultChecked={enabled} disabled={disabled} style={{ accentColor: "var(--accent)" }} />
        Enable SMS notifications
      </label>
      <div className="mb-2.5">
        <label className="field-label" htmlFor="apiKey">
          Advanta API key
        </label>
        <input className="field-input" id="apiKey" name="apiKey" type="password" placeholder="Leave blank to keep current" disabled={disabled} />
      </div>
      <div className="mb-2.5">
        <label className="field-label" htmlFor="partnerId">
          Partner ID
        </label>
        <input className="field-input" id="partnerId" name="partnerId" placeholder="Leave blank to keep current" disabled={disabled} />
      </div>
      <div className="mb-2.5">
        <label className="field-label" htmlFor="senderId">
          Sender ID
        </label>
        <input className="field-input" id="senderId" name="senderId" placeholder="Leave blank to keep current" disabled={disabled} />
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending || disabled}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
