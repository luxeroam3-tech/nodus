"use client";

import { useActionState } from "react";
import { updatePaymentGateway } from "../actions";
import type { AuthFormState } from "../../(auth)/actions";

export function PaymentGatewayForm({
  gatewayId,
  title,
  enabled,
  environment,
  disabled,
}: {
  gatewayId: "mpesa_daraja" | "kopokopo";
  title: string;
  enabled: boolean;
  environment: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updatePaymentGateway, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="gatewayId" value={gatewayId} />
      <label className="flex items-center gap-2 text-[13px] mb-3">
        <input type="checkbox" name="enabled" defaultChecked={enabled} disabled={disabled} style={{ accentColor: "var(--accent)" }} />
        Enable {title}
      </label>
      <div className="mb-2.5">
        <label className="field-label" htmlFor={`${gatewayId}-environment`}>
          Environment
        </label>
        <select className="field-input" id={`${gatewayId}-environment`} name="environment" defaultValue={environment} disabled={disabled}>
          <option value="sandbox">Sandbox</option>
          <option value="production">Production</option>
        </select>
      </div>

      {gatewayId === "mpesa_daraja" ? (
        <>
          <Field id="shortcode" label="Shortcode / Paybill" disabled={disabled} />
          <Field id="passkey" label="Passkey" type="password" disabled={disabled} />
          <Field id="consumerKey" label="Consumer key" type="password" disabled={disabled} />
          <Field id="consumerSecret" label="Consumer secret" type="password" disabled={disabled} />
        </>
      ) : (
        <>
          <Field id="tillNumber" label="Till number" disabled={disabled} />
          <Field id="clientId" label="Client ID" type="password" disabled={disabled} />
          <Field id="clientSecret" label="Client secret" type="password" disabled={disabled} />
        </>
      )}

      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending || disabled}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function Field({ id, label, type = "text", disabled }: { id: string; label: string; type?: string; disabled?: boolean }) {
  return (
    <div className="mb-2.5">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input className="field-input" id={id} name={id} type={type} placeholder="Leave blank to keep current" disabled={disabled} />
    </div>
  );
}
