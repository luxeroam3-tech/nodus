"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMaintenanceStatus } from "../actions";
import type { Database } from "@nodus/shared";

type MaintenanceStatus = Database["public"]["Enums"]["maintenance_status"];

const NEXT_STATUS: Record<string, { label: string; status: MaintenanceStatus; assign?: boolean }[]> = {
  open: [
    { label: "Assign to me", status: "in_progress", assign: true },
    { label: "Mark resolved", status: "resolved" },
  ],
  in_progress: [{ label: "Mark resolved", status: "resolved" }],
};

export function StatusControls({ requestId, status }: { requestId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const actions = NEXT_STATUS[status] ?? [];

  if (actions.length === 0) return <span className="pill neutral">{status}</span>;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span className={`pill ${status === "in_progress" ? "warning" : "neutral"}`}>{status}</span>
      {actions.map((a) => (
        <button
          key={a.status}
          className="btn"
          disabled={pending}
          style={{ fontSize: 12, padding: "5px 10px" }}
          onClick={() =>
            startTransition(async () => {
              await updateMaintenanceStatus(requestId, a.status, !!a.assign);
              router.refresh();
            })
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
