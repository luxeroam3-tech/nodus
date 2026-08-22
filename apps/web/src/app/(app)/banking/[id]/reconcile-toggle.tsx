"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleBankTransactionReconciled } from "../../actions";

export function ReconcileToggle({ transactionId, reconciled }: { transactionId: string; reconciled: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      className={`btn ${reconciled ? "btn-primary" : ""}`}
      disabled={pending}
      style={{ fontSize: 11.5, padding: "4px 9px" }}
      onClick={() =>
        startTransition(async () => {
          await toggleBankTransactionReconciled(transactionId, !reconciled);
          router.refresh();
        })
      }
    >
      {reconciled ? "Reconciled" : "Mark reconciled"}
    </button>
  );
}
