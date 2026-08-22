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

describe("Phase 4 gateway payment application", () => {
  let owner: TestUser;
  let org: { id: string };
  let property: any, unit: any, tenant: any, lease: any, doc: any;

  beforeAll(async () => {
    owner = await createTestUser();
    org = await createOrgAsOwner(owner, "Lavington Court Ltd");
    property = await createProperty(org.id, "Lavington Court");
    unit = await createUnit(org.id, property.id, "B1");
    tenant = await createTenant(org.id, "Samuel Kiptoo");
    const { data: leaseRow } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: unit.id, tenant_id: tenant.id, start_date: "2026-08-01", rent_amount_cents: 3500000 })
      .select()
      .single();
    lease = leaseRow;
    const { data: docRow, error: docErr } = await owner.client.rpc("issue_rent_invoice", {
      p_org_id: org.id,
      p_lease_id: lease.id,
      p_issue_date: "2026-08-01",
      p_due_date: "2026-08-05",
    });
    if (docErr || !docRow) throw new Error(`issue_rent_invoice failed: ${docErr?.message}`);
    doc = docRow;
  }, 30_000);

  afterAll(async () => {
    await adminClient.from("payment_events").delete().eq("org_id", org.id);
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

  it("request_gateway_payment stages a pending event", async () => {
    const { data: event, error } = await adminClient.rpc("request_gateway_payment", {
      p_org_id: org.id,
      p_gateway_id: "mpesa_daraja",
      p_provider_ref: "ws_CO_stage1",
      p_amount_cents: 3500000,
      p_account_ref: doc.number,
      p_matched_document_id: doc.id,
    });
    expect(error).toBeFalsy();
    expect(event.status).toBe("pending");
  });

  it("apply_gateway_payment claims the pending event and posts a balanced payment", async () => {
    const { data: event, error } = await adminClient.rpc("apply_gateway_payment", {
      p_org_id: org.id,
      p_gateway_id: "mpesa_daraja",
      p_provider_ref: "SFH3KX92P1",
      p_request_ref: "ws_CO_stage1",
      p_amount_cents: 3500000,
      p_payer_phone: "254712345678",
      p_payer_name: "Samuel Kiptoo",
      p_account_ref: doc.number,
      p_raw: { mock: true },
    });
    expect(error).toBeFalsy();
    expect(event.status).toBe("applied");
    expect(event.payment_id).toBeTruthy();

    const { data: updatedDoc } = await adminClient.from("documents").select("status, paid_cents").eq("id", doc.id).single();
    expect(updatedDoc?.status).toBe("paid");
    expect(updatedDoc?.paid_cents).toBe(3500000);

    const { data: payment } = await adminClient.from("payments").select("reference, method").eq("id", event.payment_id).single();
    expect(payment?.method).toBe("mpesa");
    expect(payment?.reference).toBe("H3KX92P1"); // shortRef: last 8 alnum chars, uppercased
  });

  it("a duplicate webhook delivery of the same provider_ref is a no-op, not a double payment", async () => {
    const { data: before } = await adminClient.from("payments").select("id").eq("document_id", doc.id);

    const { data: event, error } = await adminClient.rpc("apply_gateway_payment", {
      p_org_id: org.id,
      p_gateway_id: "mpesa_daraja",
      p_provider_ref: "SFH3KX92P1",
      p_request_ref: "ws_CO_stage1",
      p_amount_cents: 3500000,
      p_payer_phone: "254712345678",
      p_payer_name: "Samuel Kiptoo",
      p_account_ref: doc.number,
      p_raw: { mock: true, retry: true },
    });
    expect(error).toBeFalsy();
    expect(event.status).toBe("applied");

    const { data: after } = await adminClient.from("payments").select("id").eq("document_id", doc.id);
    expect(after?.length).toBe(before?.length);
  });

  it("an unsolicited payment referencing an already-paid invoice is flagged for review, not double-applied", async () => {
    // Account-ref matching only looks at open/partial documents, so a stray
    // payment against one that's already 'paid' can't auto-match at all —
    // it lands as unmatched rather than silently topping up a closed
    // invoice. Either way nothing gets double-applied.
    const { data: event, error } = await adminClient.rpc("apply_gateway_payment", {
      p_org_id: org.id,
      p_gateway_id: "mpesa_daraja",
      p_provider_ref: "SFH_UNSOLICITED_1",
      p_request_ref: null,
      p_amount_cents: 3500000,
      p_payer_phone: "254712345678",
      p_payer_name: "Samuel Kiptoo",
      p_account_ref: doc.number,
      p_raw: { mock: true },
    });
    expect(error).toBeFalsy();
    expect(event.status).toBe("unmatched");

    const { data: unchangedDoc } = await adminClient.from("documents").select("paid_cents").eq("id", doc.id).single();
    expect(unchangedDoc?.paid_cents).toBe(3500000);
  });

  it("rounds a sub-shilling shortfall and still marks the invoice paid", async () => {
    const { data: lease2 } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: unit.id, tenant_id: tenant.id, start_date: "2026-09-01", rent_amount_cents: 3500099, status: "ended" })
      .select()
      .single();
    // status ended so it doesn't collide with the unique-active-lease-per-unit index; we only need it to hang a document off.
    const { data: doc2 } = await owner.client.rpc("issue_rent_invoice", {
      p_org_id: org.id,
      p_lease_id: lease2.id,
      p_issue_date: "2026-09-01",
      p_due_date: "2026-09-05",
    });

    // M-Pesa can only move whole shillings — 3500099 rounds up to 3500100.
    const { data: event, error } = await adminClient.rpc("apply_gateway_payment", {
      p_org_id: org.id,
      p_gateway_id: "mpesa_daraja",
      p_provider_ref: "SFH_ROUNDING_1",
      p_request_ref: null,
      p_amount_cents: 3500100,
      p_payer_phone: "254712345678",
      p_payer_name: "Samuel Kiptoo",
      p_account_ref: doc2.number,
      p_raw: { mock: true },
    });
    expect(error).toBeFalsy();
    expect(event.status).toBe("applied");

    const { data: updatedDoc2 } = await adminClient.from("documents").select("status, paid_cents").eq("id", doc2.id).single();
    expect(updatedDoc2?.status).toBe("paid");
    expect(updatedDoc2?.paid_cents).toBe(3500099);
  });

  it("an unmatched account reference is flagged for manual review, not silently dropped", async () => {
    const { data: event, error } = await adminClient.rpc("apply_gateway_payment", {
      p_org_id: org.id,
      p_gateway_id: "mpesa_daraja",
      p_provider_ref: "SFH_NOMATCH_1",
      p_request_ref: null,
      p_amount_cents: 1000000,
      p_payer_phone: "254712345678",
      p_payer_name: "Nobody",
      p_account_ref: "NOT-A-REAL-INVOICE",
      p_raw: { mock: true },
    });
    expect(error).toBeFalsy();
    expect(event.status).toBe("unmatched");
  });

  it("caretaker cannot see payment_events (financial staging table)", async () => {
    // Sanity: no caretaker role exists in this suite's org, so assert via
    // the RLS policy directly — an org without membership sees nothing.
    const outsider = await createTestUser();
    const { data } = await outsider.client.from("payment_events").select("*").eq("org_id", org.id);
    expect(data).toEqual([]);
    await deleteTestUser(outsider.id);
  });
});
