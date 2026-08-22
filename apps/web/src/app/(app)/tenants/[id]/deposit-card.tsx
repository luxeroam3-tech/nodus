"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collectDeposit, refundDeposit } from "../../actions";
import { fmtKES } from "@/components/ui";
import type { AuthFormState } from "../../../(auth)/actions";

type Deposit = {
  id: string;
  amount_cents: number;
  method: string;
  collected_date: string;
  status: "held" | "partially_refunded" | "refunded" | "forfeited";
  refunded_cents: number;
  forfeited_cents: number;
  refund_date: string | null;
};

const STATUS_STYLE: Record<Deposit["status"], string> = {
  held: "bg-[var(--accent-bg)] text-[var(--accent-ink)]",
  partially_refunded: "bg-[var(--warning-bg)] text-[var(--warning-ink)]",
  refunded: "bg-[var(--success-bg)] text-[var(--success-ink)]",
  forfeited: "bg-[var(--danger-bg)] text-[var(--danger-ink)]",
};

const STATUS_LABEL: Record<Deposit["status"], string> = {
  held: "Held",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  forfeited: "Forfeited",
};

export function DepositCard({ leaseId, depositAmountCents, deposit }: { leaseId: string; depositAmountCents: number; deposit?: Deposit }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-[18px] pt-4 pb-3 flex justify-between items-center">
        <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold m-0">Security deposit</h3>
        {deposit && <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[deposit.status]}`}>{STATUS_LABEL[deposit.status]}</span>}
      </div>

      {!deposit ? (
        <CollectForm leaseId={leaseId} defaultAmountCents={depositAmountCents} />
      ) : (
        <div className="px-[18px] pb-4">
          <p className="text-[13px] mb-1">
            <span className="text-[var(--text-muted)]">Collected</span> {fmtKES(deposit.amount_cents)} via <span className="capitalize">{deposit.method}</span> on {deposit.collected_date}
          </p>
          {deposit.status !== "held" && (
            <p className="text-[13px] mb-1">
              <span className="text-[var(--text-muted)]">Settled</span> {fmtKES(deposit.refunded_cents)} refunded, {fmtKES(deposit.forfeited_cents)} forfeited on {deposit.refund_date}
            </p>
          )}
          {deposit.status === "held" && <RefundForm depositId={deposit.id} amountCents={deposit.amount_cents} />}
        </div>
      )}
    </div>
  );
}

function CollectForm({ leaseId, defaultAmountCents }: { leaseId: string; defaultAmountCents: number }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(collectDeposit, undefined);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) router.refresh();
    wasPending.current = pending;
  }, [pending, state, router]);

  return (
    <form action={formAction} className="px-[18px] pb-4">
      <input type="hidden" name="leaseId" value={leaseId} />
      <p className="text-[12px] text-[var(--text-muted)] mb-3">Not yet recorded — collect it once at move-in.</p>
      <div className="flex gap-2 mb-2.5 flex-wrap">
        <div style={{ flex: 1, minWidth: 100 }}>
          <label className="field-label">Amount (KES)</label>
          <input className="field-input" name="amountKes" type="number" min={1} step="0.01" defaultValue={defaultAmountCents ? defaultAmountCents / 100 : undefined} required />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <label className="field-label">Via</label>
          <select className="field-input" name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <label className="field-label">Date</label>
          <input className="field-input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Collect deposit"}
      </button>
    </form>
  );
}

function RefundForm({ depositId, amountCents }: { depositId: string; amountCents: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(refundDeposit, undefined);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) router.refresh();
    wasPending.current = pending;
  }, [pending, state, router]);

  if (!open) {
    return (
      <button className="btn mt-2" onClick={() => setOpen(true)}>
        Settle deposit
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 pt-3 border-t border-[var(--border)]">
      <input type="hidden" name="depositId" value={depositId} />
      <p className="text-[12px] text-[var(--text-muted)] mb-2.5">Deposit held: {fmtKES(amountCents)}. Split between refund and forfeit (damages, unpaid rent) — must not exceed the amount held.</p>
      <div className="flex gap-2 mb-2.5 flex-wrap">
        <div style={{ flex: 1, minWidth: 100 }}>
          <label className="field-label">Refund (KES)</label>
          <input className="field-input" name="refundKes" type="number" min={0} step="0.01" defaultValue={0} />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <label className="field-label">Forfeit (KES)</label>
          <input className="field-input" name="forfeitKes" type="number" min={0} step="0.01" defaultValue={0} />
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <label className="field-label">Refund via</label>
          <select className="field-input" name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
      </div>
      <div className="mb-2.5">
        <label className="field-label">Date</label>
        <input className="field-input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>
      <div className="mb-3">
        <label className="field-label">Notes (damages, deductions…)</label>
        <input className="field-input" name="notes" placeholder="Optional" />
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Settling…" : "Confirm settlement"}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
