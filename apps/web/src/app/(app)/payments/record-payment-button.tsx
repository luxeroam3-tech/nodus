"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordManualPayment } from "../actions";

export function RecordPaymentButton({ documentId, amountCents }: { documentId: string; amountCents: number }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)} style={{ fontSize: 12.5, padding: "6px 12px" }}>
        Record payment
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        className="field-input"
        placeholder="Reference (e.g. cash, cheque no.)"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        style={{ width: 160, padding: "6px 10px", fontSize: 12.5 }}
      />
      <button
        className="btn btn-primary"
        disabled={pending}
        style={{ fontSize: 12.5, padding: "6px 12px" }}
        onClick={() =>
          startTransition(async () => {
            await recordManualPayment(documentId, amountCents, reference);
            setOpen(false);
            router.refresh();
          })
        }
      >
        {pending ? "Saving…" : "Confirm"}
      </button>
    </div>
  );
}
