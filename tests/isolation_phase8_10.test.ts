import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/clients";
import { createTestUser, deleteTestUser, createOrgAsOwner, createProperty, createUnit, createTenant, createLease, type TestUser } from "./helpers/seed";

// Cross-org isolation for everything added since Phase 1: SMS, payment
// gateways, banking, receipts, and Nodus's own subscription billing. Same
// pattern as tests/isolation.test.ts — two orgs, assert B can never see or
// write A's rows.
describe("Phase 8-9 multi-tenancy isolation", () => {
  let ownerA: TestUser, ownerB: TestUser;
  let orgA: { id: string }, orgB: { id: string };
  let bankAccountA: any, paymentGatewayA: any, smsSettingsA: any, depositA: any, leaseA: any;

  beforeAll(async () => {
    ownerA = await createTestUser();
    ownerB = await createTestUser();
    orgA = await createOrgAsOwner(ownerA, "Riverside Apartments Ltd");
    orgB = await createOrgAsOwner(ownerB, "Parklands Suites Ltd");

    const { data: bankAccount } = await adminClient.from("bank_accounts").insert({ org_id: orgA.id, name: "Equity - Riverside", kind: "bank" }).select().single();
    bankAccountA = bankAccount;

    const { data: gateway } = await adminClient
      .from("payment_gateways")
      .insert({ org_id: orgA.id, gateway_id: "mpesa_daraja", enabled: true, environment: "sandbox", webhook_secret: "test-secret" })
      .select()
      .single();
    paymentGatewayA = gateway;

    const { data: sms } = await adminClient.from("sms_settings").insert({ org_id: orgA.id, enabled: true, provider: "advanta" }).select().single();
    smsSettingsA = sms;

    const propertyA = await createProperty(orgA.id, "Riverside Block A");
    const unitA = await createUnit(orgA.id, propertyA.id, "R1");
    const tenantA = await createTenant(orgA.id, "Isolation Test Tenant");
    leaseA = await createLease(orgA.id, unitA.id, tenantA.id);
    const { data: deposit } = await adminClient.from("deposits").insert({ org_id: orgA.id, lease_id: leaseA.id, amount_cents: 5000000, method: "cash" }).select().single();
    depositA = deposit;
  }, 30_000);

  afterAll(async () => {
    await adminClient.from("move_checklist_items").delete().eq("org_id", orgA.id);
    await adminClient.from("move_checklists").delete().eq("org_id", orgA.id);
    await adminClient.from("deposits").delete().eq("org_id", orgA.id);
    await adminClient.from("leases").delete().eq("org_id", orgA.id);
    await adminClient.from("tenants").delete().eq("org_id", orgA.id);
    await adminClient.from("units").delete().eq("org_id", orgA.id);
    await adminClient.from("properties").delete().eq("org_id", orgA.id);
    await adminClient.from("bank_accounts").delete().eq("org_id", orgA.id);
    await adminClient.from("payment_gateways").delete().eq("org_id", orgA.id);
    await adminClient.from("sms_settings").delete().eq("org_id", orgA.id);
    await adminClient.from("organizations").delete().in("id", [orgA.id, orgB.id]);
    for (const u of [ownerA, ownerB]) await deleteTestUser(u.id);
  }, 30_000);

  it("owner A can see their own bank account, sms settings, gateway, and subscription", async () => {
    const [bank, sms, gateway, sub] = await Promise.all([
      ownerA.client.from("bank_accounts").select("*").eq("id", bankAccountA.id),
      ownerA.client.from("sms_settings").select("*").eq("org_id", orgA.id),
      ownerA.client.from("payment_gateways").select("*").eq("id", paymentGatewayA.id),
      ownerA.client.from("nodus_subscriptions").select("*").eq("org_id", orgA.id),
    ]);
    expect(bank.data).toHaveLength(1);
    expect(sms.data).toHaveLength(1);
    expect(gateway.data).toHaveLength(1);
    expect(sub.data).toHaveLength(1);
  });

  it("owner B cannot see org A's bank account", async () => {
    const { data } = await ownerB.client.from("bank_accounts").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot see org A's payment gateway config", async () => {
    const { data } = await ownerB.client.from("payment_gateways").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot see org A's SMS settings", async () => {
    const { data } = await ownerB.client.from("sms_settings").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot see org A's subscription", async () => {
    const { data } = await ownerB.client.from("nodus_subscriptions").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner A can see their own deposit", async () => {
    const { data } = await ownerA.client.from("deposits").select("*").eq("id", depositA.id);
    expect(data).toHaveLength(1);
  });

  it("owner B cannot see org A's deposit", async () => {
    const { data } = await ownerB.client.from("deposits").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot call refund_deposit on org A's deposit", async () => {
    const { error } = await ownerB.client.rpc("refund_deposit", {
      p_deposit_id: depositA.id,
      p_refund_cents: 5000000,
      p_forfeit_cents: 0,
      p_method: "cash",
      p_date: "2026-01-01",
      p_notes: "",
    });
    expect(error).toBeTruthy();
  });

  it("owner B cannot call end_lease on org A's lease", async () => {
    const { error } = await ownerB.client.rpc("end_lease", { p_lease_id: leaseA.id, p_end_date: "2026-01-01", p_status: "ended" });
    expect(error).toBeTruthy();

    const { data: stillActive } = await adminClient.from("leases").select("status").eq("id", leaseA.id).single();
    expect(stillActive?.status).toBe("active");
  });

  it("owner A can end their own lease, which vacates the unit and starts a move-out checklist", async () => {
    const { data: ended, error } = await ownerA.client.rpc("end_lease", { p_lease_id: leaseA.id, p_end_date: "2026-08-22", p_status: "ended" });
    expect(error).toBeFalsy();
    expect(ended?.status).toBe("ended");

    const { data: unit } = await adminClient.from("units").select("status").eq("id", leaseA.unit_id).single();
    expect(unit?.status).toBe("vacant");

    const { data: checklist } = await adminClient.from("move_checklists").select("type").eq("lease_id", leaseA.id).eq("type", "move_out").maybeSingle();
    expect(checklist).toBeTruthy();
  });

  it("owner B cannot insert a bank account into org A", async () => {
    const { error } = await ownerB.client.from("bank_accounts").insert({ org_id: orgA.id, name: "Hostile account", kind: "bank" });
    expect(error).toBeTruthy();
  });

  it("owner B cannot insert into org A's nodus_billing_payments", async () => {
    const { error } = await ownerB.client.from("nodus_billing_payments").insert({ org_id: orgA.id, plan: "standard", cycle: "monthly", amount_cents: 150000 });
    expect(error).toBeTruthy();
  });

  it("anon (service-role-free, unauthenticated) cannot read any billing or gateway table", async () => {
    const { anonClient } = await import("./helpers/clients");
    const unauth = anonClient();
    const [bank, sms, gateway, sub] = await Promise.all([
      unauth.from("bank_accounts").select("*"),
      unauth.from("sms_settings").select("*"),
      unauth.from("payment_gateways").select("*"),
      unauth.from("nodus_subscriptions").select("*"),
    ]);
    for (const r of [bank, sms, gateway, sub]) {
      expect(r.error || (r.data ?? []).length === 0).toBeTruthy();
    }
  });

  it("org B's unit count query (what the unit-cap check in createUnit() reads) is scoped to org B only", async () => {
    const property = await createProperty(orgB.id, "Cap Test Property");
    for (let i = 0; i < 5; i++) {
      await adminClient.from("units").insert({ org_id: orgB.id, property_id: property.id, unit_number: `U${i}` });
    }
    // createUnit()'s cap check counts units by org_id under RLS — confirm
    // that count can't be inflated or deflated by another org's units.
    const { count } = await ownerB.client.from("units").select("id", { count: "exact", head: true }).eq("org_id", orgB.id);
    expect(count).toBe(5);

    await adminClient.from("units").delete().eq("org_id", orgB.id);
    await adminClient.from("properties").delete().eq("id", property.id);
  });
});
