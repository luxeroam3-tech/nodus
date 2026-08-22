"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentGateway, registerMpesaC2b } from "../actions";
import type { AuthFormState } from "../../(auth)/actions";

export function PaymentGatewayForm({
  gatewayId,
  title,
  enabled,
  environment,
  c2bRegisteredAt,
  disabled,
}: {
  gatewayId: "mpesa_daraja" | "kopokopo";
  title: string;
  enabled: boolean;
  environment: string;
  c2bRegisteredAt?: string | null;
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

      {gatewayId === "mpesa_daraja" && enabled && <C2bRegistration registeredAt={c2bRegisteredAt} disabled={disabled} />}
    </form>
  );
}

function C2bRegistration({ registeredAt, disabled }: { registeredAt?: string | null; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]">
      <p className="text-[12px] text-[var(--text-muted)] mb-2">
        {registeredAt
          ? `C2B URLs registered with Safaricom on ${new Date(registeredAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}.`
          : "Manual paybill deposits (no STK push) won't be confirmed until you register your callback URLs with Safaricom."}
      </p>
      {error && <p className="field-error">{error}</p>}
      <button
        type="button"
        className="btn"
        disabled={pending || disabled}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await registerMpesaC2b();
            if (result?.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Registering…" : registeredAt ? "Re-register C2B URLs" : "Register C2B URLs"}
      </button>
    </div>
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
