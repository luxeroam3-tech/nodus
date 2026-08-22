"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueInvoiceNow } from "../actions";

export function IssueInvoiceButton({ leaseId }: { leaseId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      className="btn"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await issueInvoiceNow(leaseId);
          router.refresh();
        })
      }
      style={{ fontSize: 12.5, padding: "6px 12px" }}
    >
      {pending ? "Issuing…" : "Issue invoice now"}
    </button>
  );
}
