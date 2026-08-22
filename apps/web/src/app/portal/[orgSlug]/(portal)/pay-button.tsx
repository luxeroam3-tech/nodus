"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PayButton({ documentId, amountCents, defaultPhone }: { orgSlug: string; documentId: string; amountCents: number; defaultPhone: string }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function pay() {
    setStatus("sending");
    setError("");
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setStatus("error");
      setError("Session expired — refresh the page and try again.");
      return;
    }

    const res = await fetch("/api/payments/request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ documentId, gatewayId: "mpesa_daraja", phone }),
    });
    const body = await res.json();
    if (!res.ok) {
      setStatus("error");
      setError(body.error ?? "Could not start the M-Pesa payment.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return <span style={{ fontSize: 13, fontWeight: 600 }}>Check your phone for the M-Pesa prompt.</span>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0712 345 678"
          style={{
            flex: 1,
            fontSize: 13,
            padding: "8px 10px",
            borderRadius: 8,
            border: "0.5px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
          }}
        />
        <button
          onClick={pay}
          disabled={status === "sending" || !phone}
          style={{
            background: "rgba(255,255,255,0.22)",
            border: "0.5px solid rgba(255,255,255,0.35)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: 100,
            cursor: "pointer",
          }}
        >
          {status === "sending" ? "Sending…" : "Pay with M-Pesa"}
        </button>
      </div>
      {status === "error" && <p style={{ fontSize: 12, marginTop: 6, opacity: 0.9 }}>{error}</p>}
    </div>
  );
}
