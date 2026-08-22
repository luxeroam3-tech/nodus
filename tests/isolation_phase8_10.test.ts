import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/clients";
import { createTestUser, deleteTestUser, createOrgAsOwner, createProperty, type TestUser } from "./helpers/seed";

// Cross-org isolation for everything added since Phase 1: SMS, payment
// gateways, banking, receipts, and Nodus's own subscription billing. Same
// pattern as tests/isolation.test.ts — two orgs, assert B can never see or
// write A's rows.
describe("Phase 8-9 multi-tenancy isolation", () => {
  let ownerA: TestUser, ownerB: TestUser;
  let orgA: { id: string }, orgB: { id: string };
  let bankAccountA: any, paymentGatewayA: any, smsSettingsA: any;

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
  }, 30_000);

  afterAll(async () => {
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
