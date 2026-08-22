"use client";

import { useRouter } from "next/navigation";
import { Td } from "@/components/ui";

export function TenantRow({ tenant }: { tenant: { id: string; full_name: string; phone: string | null; email: string | null; user_id: string | null } }) {
  const router = useRouter();
  const go = () => router.push(`/tenants/${tenant.id}`);

  return (
    <tr
      onClick={go}
      onKeyDown={(e) => (e.key === "Enter" ? go() : undefined)}
      tabIndex={0}
      className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--border)] hover:bg-[var(--surface-2)] cursor-pointer"
    >
      <Td className="font-semibold">{tenant.full_name}</Td>
      <Td className="text-[var(--text-muted)]">{tenant.phone ?? tenant.email ?? "No contact on file"}</Td>
      <Td right>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            tenant.user_id ? "bg-[var(--success-bg)] text-[var(--success-ink)]" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
          }`}
        >
          {tenant.user_id ? "Portal active" : "Not yet claimed"}
        </span>
      </Td>
    </tr>
  );
}
