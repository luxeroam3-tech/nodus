"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { initiateSubscriptionPayment, checkSubscriptionPayment } from "./actions";
import type { PlanKey, BillingCycle } from "@/lib/billing";

export function BillingClient({ currentPlan, disabled }: { currentPlan: PlanKey; disabled?: boolean }) {
  const [plan, setPlan] = useState<PlanKey>(currentPlan === "free" ? "standard" : currentPlan);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "pending" | "complete" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  function poll(paymentId: string) {
    pollRef.current = setInterval(async () => {
      const result = await checkSubscriptionPayment(paymentId);
      if (result.status === "complete") {
        clearInterval(pollRef.current!);
        setStatus("complete");
        router.refresh();
      } else if (result.status === "failed") {
        clearInterval(pollRef.current!);
        setStatus("failed");
        setError(result.reason ?? "Payment failed");
      }
    }, 3000);
  }

  function submit() {
    setError(null);
    setStatus("pending");
    startTransition(async () => {
      const result = await initiateSubscriptionPayment(plan, cycle, phone);
      if (result.error) {
        setStatus("failed");
        setError(result.error);
        return;
      }
      if (result.paymentId) poll(result.paymentId);
    });
  }

  if (disabled) {
    return <p className="text-[13px] text-[var(--text-muted)]">Only the org owner can upgrade the subscription.</p>;
  }

  return (
    <div className="card px-[18px] py-4">
      <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-3">Upgrade</h3>
      <div className="flex gap-3 mb-3 flex-wrap">
        <div>
          <label className="field-label">Plan</label>
          <select className="field-input" style={{ width: "auto" }} value={plan} onChange={(e) => setPlan(e.target.value as PlanKey)}>
            <option value="standard">Standard</option>
            <option value="business">Business</option>
          </select>
        </div>
        <div>
          <label className="field-label">Billing cycle</label>
          <select className="field-input" style={{ width: "auto" }} value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual (20% off)</option>
          </select>
        </div>
        <div>
          <label className="field-label">M-Pesa phone</label>
          <input className="field-input" placeholder="0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      {status === "pending" && <p className="text-[13px] text-[var(--warning-ink)] mb-3">Check your phone for the M-Pesa prompt…</p>}
      {status === "complete" && <p className="text-[13px] text-[var(--success-ink)] mb-3">Subscription updated.</p>}
      {error && <p className="field-error">{error}</p>}

      <button className="btn btn-primary" disabled={pending || status === "pending" || !phone} onClick={submit}>
        {status === "pending" ? "Waiting for payment…" : `Pay via M-Pesa`}
      </button>
    </div>
  );
}
