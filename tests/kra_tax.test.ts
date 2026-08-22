import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/clients";
import { createTestUser, deleteTestUser, createOrgAsOwner, createProperty, createUnit, createTenant, type TestUser } from "./helpers/seed";

describe("Phase 5 KRA tax compliance", () => {
  let owner: TestUser;
  let org: { id: string };
  let property: any;
  let residentialUnit: any, commercialUnit: any;
  let residentialTenant: any, commercialTenant: any;

  beforeAll(async () => {
    owner = await createTestUser();
    org = await createOrgAsOwner(owner, "Ngong Rd Suites Ltd");
    property = await createProperty(org.id, "Ngong Rd Suites");
    residentialUnit = await createUnit(org.id, property.id, "R1");
    commercialUnit = await createUnit(org.id, property.id, "C1");
    await adminClient.from("units").update({ is_commercial: true }).eq("id", commercialUnit.id);
    residentialTenant = await createTenant(org.id, "Faith Wambui");
    commercialTenant = await createTenant(org.id, "Acme Traders Ltd");
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

  it("a residential invoice for a non-VAT-registered org carries no VAT", async () => {
    const { data: lease } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: residentialUnit.id, tenant_id: residentialTenant.id, start_date: "2026-08-01", rent_amount_cents: 2800000 })
      .select()
      .single();

    const { data: doc, error } = await owner.client.rpc("issue_rent_invoice", {
      p_org_id: org.id,
      p_lease_id: lease.id,
      p_issue_date: "2026-08-01",
      p_due_date: "2026-08-05",
    });
    expect(error).toBeFalsy();
    expect(doc.vat_cents).toBe(0);
    expect(doc.total_cents).toBe(2800000);
  });

  it("a commercial invoice at a non-VAT-registered org still carries no VAT", async () => {
    const { data: lease } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: commercialUnit.id, tenant_id: commercialTenant.id, start_date: "2026-08-01", rent_amount_cents: 8000000 })
      .select()
      .single();

    const { data: doc, error } = await owner.client.rpc("issue_rent_invoice", {
      p_org_id: org.id,
      p_lease_id: lease.id,
      p_issue_date: "2026-08-01",
      p_due_date: "2026-08-05",
    });
    expect(error).toBeFalsy();
    expect(doc.vat_cents).toBe(0);
    expect(doc.total_cents).toBe(8000000);

    await adminClient.from("documents").delete().eq("id", doc.id);
    await adminClient.from("journal_lines").delete().eq("entry_id", doc.journal_entry_id);
    await adminClient.from("journal_entries").delete().eq("id", doc.journal_entry_id);
    await adminClient.from("leases").delete().eq("id", lease.id);
  });

  it("registering the org for VAT makes new commercial invoices carry 16% VAT, split across income and VAT output", async () => {
    await adminClient.from("organizations").update({ vat_registered: true, kra_pin: "P051234567X" }).eq("id", org.id);

    const { data: lease } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: commercialUnit.id, tenant_id: commercialTenant.id, start_date: "2026-09-01", rent_amount_cents: 8000000 })
      .select()
      .single();

    const { data: doc, error } = await owner.client.rpc("issue_rent_invoice", {
      p_org_id: org.id,
      p_lease_id: lease.id,
      p_issue_date: "2026-09-01",
      p_due_date: "2026-09-05",
    });
    expect(error).toBeFalsy();
    expect(doc.vat_cents).toBe(1280000); // 16% of 8,000,000
    expect(doc.total_cents).toBe(9280000);

    const { data: lines } = await owner.client
      .from("journal_lines")
      .select("debit_cents, credit_cents, chart_of_accounts(code)")
      .eq("entry_id", doc.journal_entry_id);
    const totalDebit = (lines ?? []).reduce((s: number, l: any) => s + l.debit_cents, 0);
    const totalCredit = (lines ?? []).reduce((s: number, l: any) => s + l.credit_cents, 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(9280000);

    const vatLine = (lines ?? []).find((l: any) => l.chart_of_accounts.code === "2200");
    expect(vatLine?.credit_cents).toBe(1280000);
  });

  it("the same VAT-registered org's residential invoices still carry no VAT (unit-level, not org-level)", async () => {
    const { data: lease } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: residentialUnit.id, tenant_id: residentialTenant.id, start_date: "2026-09-01", rent_amount_cents: 3000000, status: "ended" })
      .select()
      .single();

    const { data: doc, error } = await owner.client.rpc("issue_rent_invoice", {
      p_org_id: org.id,
      p_lease_id: lease.id,
      p_issue_date: "2026-09-01",
      p_due_date: "2026-09-05",
    });
    expect(error).toBeFalsy();
    expect(doc.vat_cents).toBe(0);
    expect(doc.total_cents).toBe(3000000);
  });

  it("fiscalize_document signs a VAT invoice via the simulator", async () => {
    const { data: doc } = await owner.client.from("documents").select("id").eq("vat_cents", 1280000).single();

    const { data: fiscalized, error } = await owner.client.rpc("fiscalize_document", { p_document_id: doc.id });
    expect(error).toBeFalsy();
    expect(fiscalized.cu_invoice_number).toMatch(/^SIM[0-9A-F]{16}$/);
    expect(fiscalized.cu_serial).toMatch(/^SIMDEVICE-[0-9A-F]{8}$/);
    expect(fiscalized.qr_url).toContain("itax.kra.go.ke/etims-verify-simulated/");
    expect(fiscalized.fiscalized_at).toBeTruthy();
  });

  it("fiscalizing the same document twice is rejected — a fiscal event is immutable once signed", async () => {
    const { data: doc } = await owner.client.from("documents").select("id").eq("vat_cents", 1280000).single();
    const { error } = await owner.client.rpc("fiscalize_document", { p_document_id: doc.id });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/already fiscalized/i);
  });

  it("caretaker cannot fiscalize a document", async () => {
    const caretaker = await createTestUser();
    await adminClient.from("org_memberships").insert({ org_id: org.id, user_id: caretaker.id, role: "caretaker" });

    const { data: doc } = await adminClient.from("documents").select("id").eq("vat_cents", 0).limit(1).single();
    const { error } = await caretaker.client.rpc("fiscalize_document", { p_document_id: doc.id });
    expect(error).toBeTruthy();

    await deleteTestUser(caretaker.id);
  });

  it("report_monthly_rental_income_tax computes 7.5% of gross residential rent actually received", async () => {
    const { data: doc } = await adminClient.from("documents").select("id").eq("vat_cents", 0).eq("total_cents", 2800000).single();
    await owner.client.rpc("record_payment", {
      p_document_id: doc.id,
      p_amount_cents: 2800000,
      p_method: "mpesa",
      p_reference: "TESTREF01",
      p_date: "2026-08-15",
      p_bank_account_id: null,
    });

    const { data, error } = await owner.client.rpc("report_monthly_rental_income_tax", { p_org_id: org.id, p_year: 2026, p_month: 8 });
    expect(error).toBeFalsy();
    const row = data[0];
    expect(row.gross_rent_received_cents).toBe(2800000);
    expect(row.tax_due_cents).toBe(210000); // 7.5% of 2,800,000
  });

  it("report_vat_output sums VAT output posted to the ledger for the period", async () => {
    const { data, error } = await owner.client.rpc("report_vat_output", { p_org_id: org.id, p_year: 2026, p_month: 9 });
    expect(error).toBeFalsy();
    expect(data[0].vat_output_cents).toBe(1280000);
  });
});
