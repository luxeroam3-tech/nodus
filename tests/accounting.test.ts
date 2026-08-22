import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/clients";
import {
  createTestUser,
  deleteTestUser,
  createOrgAsOwner,
  addMember,
  createProperty,
  createUnit,
  createTenant,
  createLease,
  type TestUser,
} from "./helpers/seed";

describe("Phase 2 accounting engine", () => {
  let owner: TestUser, accountant: TestUser, caretaker: TestUser, tenantUser: TestUser, outsider: TestUser;
  let org: { id: string };
  let property: any, unit: any, tenant: any, lease: any;

  beforeAll(async () => {
    owner = await createTestUser();
    accountant = await createTestUser();
    caretaker = await createTestUser();
    tenantUser = await createTestUser();
    outsider = await createTestUser();

    org = await createOrgAsOwner(owner, "Riverside Apartments Ltd");
    await addMember(org.id, accountant.id, "accountant");
    await addMember(org.id, caretaker.id, "caretaker");

    property = await createProperty(org.id, "Riverside Apartments");
    unit = await createUnit(org.id, property.id, "D3");
    tenant = await createTenant(org.id, "David Mwangi", tenantUser.id);
    lease = await createLease(org.id, unit.id, tenant.id);
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
    for (const u of [owner, accountant, caretaker, tenantUser, outsider]) {
      await deleteTestUser(u.id);
    }
  }, 30_000);

  it("seeds the Kenyan chart of accounts on org creation", async () => {
    const { data } = await owner.client.from("chart_of_accounts").select("code").eq("org_id", org.id);
    const codes = (data ?? []).map((r: any) => r.code);
    expect(codes).toContain("1200"); // Tenant rent receivable
    expect(codes).toContain("4000"); // Rental income
    expect(codes).toContain("2300"); // Tenant security deposits held
  });

  it("auto-creates a cost center for the property", async () => {
    const { data } = await owner.client.from("cost_centers").select("*").eq("property_id", property.id).single();
    expect(data?.name).toBe("Riverside Apartments");
  });

  it("rejects an unbalanced manual entry", async () => {
    const { error } = await owner.client.rpc("post_entry", {
      p_org_id: org.id,
      p_date: "2026-08-01",
      p_memo: "Bad entry",
      p_source_type: "manual",
      p_source_id: null,
      p_lines: [
        { account_code: "1010", debit_cents: 1000 },
        { account_code: "4000", credit_cents: 500 },
      ],
    });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/not balanced/i);
  });

  it("caretaker cannot post a journal entry", async () => {
    const { error } = await caretaker.client.rpc("post_entry", {
      p_org_id: org.id,
      p_date: "2026-08-01",
      p_memo: "Caretaker entry",
      p_source_type: "manual",
      p_source_id: null,
      p_lines: [
        { account_code: "1010", debit_cents: 1000 },
        { account_code: "4000", credit_cents: 1000 },
      ],
    });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/not authorized/i);
  });

  it("caretaker cannot read journal_entries or documents", async () => {
    const [je, docs] = await Promise.all([
      caretaker.client.from("journal_entries").select("*").eq("org_id", org.id),
      caretaker.client.from("documents").select("*").eq("org_id", org.id),
    ]);
    expect(je.data).toEqual([]);
    expect(docs.data).toEqual([]);
  });

  it("issue_rent_invoice creates a balanced AR/income entry", async () => {
    const { data: doc, error } = await accountant.client.rpc("issue_rent_invoice", {
      p_org_id: org.id,
      p_lease_id: lease.id,
      p_issue_date: "2026-08-01",
      p_due_date: "2026-08-05",
    });
    expect(error).toBeFalsy();
    expect(doc.status).toBe("open");
    expect(doc.total_cents).toBe(3200000);

    const { data: lines } = await accountant.client
      .from("journal_lines")
      .select("debit_cents, credit_cents, chart_of_accounts(code)")
      .eq("entry_id", doc.journal_entry_id);
    const totalDebit = (lines ?? []).reduce((s: number, l: any) => s + l.debit_cents, 0);
    const totalCredit = (lines ?? []).reduce((s: number, l: any) => s + l.credit_cents, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(3200000);
  });

  it("tenant can see their own invoice, outsider cannot", async () => {
    const { data: mine } = await tenantUser.client.from("documents").select("*").eq("org_id", org.id);
    expect(mine).toHaveLength(1);

    const { data: theirs } = await outsider.client.from("documents").select("*").eq("org_id", org.id);
    expect(theirs).toEqual([]);
  });

  it("record_payment marks the invoice paid and posts a balanced entry", async () => {
    const { data: doc } = await accountant.client.from("documents").select("id, total_cents").eq("org_id", org.id).single();

    const { data: payment, error } = await accountant.client.rpc("record_payment", {
      p_document_id: doc.id,
      p_amount_cents: doc.total_cents,
      p_method: "mpesa",
      p_reference: "SFH3KX92P1",
      p_date: "2026-08-03",
      p_bank_account_id: null,
    });
    expect(error).toBeFalsy();
    expect(payment.amount_cents).toBe(doc.total_cents);

    const { data: updatedDoc } = await accountant.client.from("documents").select("status, paid_cents").eq("id", doc.id).single();
    expect(updatedDoc?.status).toBe("paid");
    expect(updatedDoc?.paid_cents).toBe(doc.total_cents);
  });

  it("tenant can see their own payment", async () => {
    const { data } = await tenantUser.client.from("payments").select("*");
    expect(data).toHaveLength(1);
    expect(data?.[0]?.reference).toBe("SFH3KX92P1");
  });

  it("direct insert into journal_entries is rejected — post_entry is the only path", async () => {
    const { error } = await owner.client.from("journal_entries").insert({ org_id: org.id, date: "2026-08-03", memo: "sneaky" });
    expect(error).toBeTruthy();
  });

  it("reverse_entry produces an opposite, still-balanced entry", async () => {
    const { data: doc } = await accountant.client.from("documents").select("journal_entry_id").eq("org_id", org.id).single();

    const { data: reversalId, error } = await accountant.client.rpc("reverse_entry", {
      p_entry_id: doc.journal_entry_id,
      p_date: "2026-08-04",
      p_memo: "Test reversal",
    });
    expect(error).toBeFalsy();

    const { data: lines } = await accountant.client.from("journal_lines").select("debit_cents, credit_cents").eq("entry_id", reversalId);
    const totalDebit = (lines ?? []).reduce((s: number, l: any) => s + l.debit_cents, 0);
    const totalCredit = (lines ?? []).reduce((s: number, l: any) => s + l.credit_cents, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(3200000);
  });

  it("the whole org's ledger balances to zero net (sum debits = sum credits across every entry)", async () => {
    const { data: lines } = await accountant.client.from("journal_lines").select("debit_cents, credit_cents").eq("org_id", org.id);
    const totalDebit = (lines ?? []).reduce((s: number, l: any) => s + l.debit_cents, 0);
    const totalCredit = (lines ?? []).reduce((s: number, l: any) => s + l.credit_cents, 0);
    expect(totalDebit).toBe(totalCredit);
  });
});
