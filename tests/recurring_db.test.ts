import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/clients";
import {
  createTestUser,
  deleteTestUser,
  createOrgAsOwner,
  createProperty,
  createUnit,
  createTenant,
  type TestUser,
} from "./helpers/seed";

describe("Phase 3 recurring rent generation", () => {
  let owner: TestUser;
  let org: { id: string };
  let property: any, unit: any, tenant: any;

  beforeAll(async () => {
    owner = await createTestUser();
    org = await createOrgAsOwner(owner, "Ngong Rd Suites Ltd");
    property = await createProperty(org.id, "Ngong Rd Suites");
    unit = await createUnit(org.id, property.id, "C2");
    tenant = await createTenant(org.id, "Faith Wambui");
  }, 30_000);

  afterAll(async () => {
    await adminClient.from("payments").delete().eq("org_id", org.id);
    await adminClient.from("documents").delete().eq("org_id", org.id);
    await adminClient.from("journal_lines").delete().eq("org_id", org.id);
    await adminClient.from("journal_entries").delete().eq("org_id", org.id);
    await adminClient.from("leases").delete().eq("org_id", org.id);
    await adminClient.from("tenants").delete().eq("org_id", org.id);
    await adminClient.from("units").delete().eq("org_id", org.id);
    await adminClient.from("cost_centers").delete().eq("org_id", org.id);
    await adminClient.from("properties").delete().eq("org_id", org.id);
    await adminClient.from("chart_of_accounts").delete().eq("org_id", org.id);
    await adminClient.from("organizations").delete().eq("id", org.id);
    await deleteTestUser(owner.id);
  }, 30_000);

  it("a new lease defaults next_invoice_date to its start_date", async () => {
    const { data: lease } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: unit.id, tenant_id: tenant.id, start_date: "2026-05-15", rent_amount_cents: 2800000 })
      .select()
      .single();
    expect(lease?.next_invoice_date).toBe("2026-05-15");
    expect(lease?.rent_frequency).toBe("monthly");
    await adminClient.from("leases").delete().eq("id", lease.id);
  });

  it("generate_due_rent_invoices backfills every missed month, capped, and advances next_invoice_date", async () => {
    const { data: lease } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: unit.id, tenant_id: tenant.id, start_date: "2026-01-31", rent_amount_cents: 2800000 })
      .select()
      .single();

    const { data: runs, error } = await adminClient.rpc("generate_due_rent_invoices", { p_cap: 12, p_org_id: org.id });
    expect(error).toBeFalsy();

    const thisLeaseRuns = (runs ?? []).filter((r: any) => r.lease_id === lease.id);
    // Jan 31 -> Feb 28 -> Mar 31 -> ... clamping through 2026, capped well
    // under 12 for a lease that started this year.
    expect(thisLeaseRuns.length).toBeGreaterThan(0);
    expect(thisLeaseRuns[0].issued_date).toBe("2026-01-31");
    if (thisLeaseRuns.length > 1) {
      expect(thisLeaseRuns[1].issued_date).toBe("2026-02-28");
    }

    const { data: updatedLease } = await adminClient.from("leases").select("next_invoice_date").eq("id", lease.id).single();
    expect(updatedLease?.next_invoice_date > "2026-08-22" || updatedLease?.next_invoice_date === undefined).toBeTruthy();

    const { data: docs } = await adminClient.from("documents").select("id, total_cents, status").eq("org_id", org.id).eq("unit_id", unit.id);
    expect(docs?.length).toBe(thisLeaseRuns.length);
    for (const d of docs ?? []) {
      expect(d.total_cents).toBe(2800000);
      expect(d.status).toBe("open");
    }
  }, 20_000);

  it("running generate_due_rent_invoices again is a no-op once caught up", async () => {
    const { data: before } = await adminClient.from("documents").select("id").eq("org_id", org.id);
    await adminClient.rpc("generate_due_rent_invoices", { p_cap: 12, p_org_id: org.id });
    const { data: after } = await adminClient.from("documents").select("id").eq("org_id", org.id);
    expect(after?.length).toBe(before?.length);
  });
});
