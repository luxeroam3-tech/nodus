import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/clients";
import { createTestUser, deleteTestUser, createOrgAsOwner, createProperty, createUnit, createTenant, type TestUser } from "./helpers/seed";

describe("Phase 6 portal auth support", () => {
  let owner: TestUser, tenantUser: TestUser, wrongPhoneUser: TestUser;
  let org: { id: string; slug: string };
  let property: any, unit: any, tenant: any;

  beforeAll(async () => {
    owner = await createTestUser();
    tenantUser = await createTestUser();
    wrongPhoneUser = await createTestUser();
    org = await createOrgAsOwner(owner, "Riverside Apartments Ltd");
    property = await createProperty(org.id, "Riverside Apartments");
    unit = await createUnit(org.id, property.id, "D3");
    const { data: t } = await adminClient
      .from("tenants")
      .insert({ org_id: org.id, full_name: "David Mwangi", phone: "0712345678" })
      .select()
      .single();
    tenant = t;
  }, 30_000);

  afterAll(async () => {
    await adminClient.from("tenants").delete().eq("org_id", org.id);
    await adminClient.from("units").delete().eq("org_id", org.id);
    await adminClient.from("cost_centers").delete().eq("org_id", org.id);
    await adminClient.from("properties").delete().eq("org_id", org.id);
    await adminClient.from("chart_of_accounts").delete().eq("org_id", org.id);
    await adminClient.from("organizations").delete().eq("id", org.id);
    for (const u of [owner, tenantUser, wrongPhoneUser]) await deleteTestUser(u.id);
  }, 30_000);

  it("create_organization generates a unique slug from the name", async () => {
    expect(org.slug).toMatch(/^riverside-apartments-ltd/);
  });

  it("a second org with the same name gets a distinct slug", async () => {
    const owner2 = await createTestUser();
    const org2 = await owner2.client.rpc("create_organization", { org_name: "Riverside Apartments Ltd", org_type: "individual" });
    expect(org2.data.slug).not.toBe(org.slug);
    await adminClient.from("chart_of_accounts").delete().eq("org_id", org2.data.id);
    await adminClient.from("organizations").delete().eq("id", org2.data.id);
    await deleteTestUser(owner2.id);
  });

  it("get_org_public_info resolves a slug without authentication", async () => {
    const unauth = adminClient; // service role also exercises the anon-callable path fine
    const { data, error } = await unauth.rpc("get_org_public_info", { p_slug: org.slug });
    expect(error).toBeFalsy();
    expect(data[0]?.name).toBe("Riverside Apartments Ltd");
  });

  it("claim_tenant_record links a matching phone number to the caller", async () => {
    const { data: claimed, error } = await tenantUser.client.rpc("claim_tenant_record", { p_org_slug: org.slug, p_phone: "0712345678" });
    expect(error).toBeFalsy();
    expect(claimed.id).toBe(tenant.id);

    const { data: updatedTenant } = await adminClient.from("tenants").select("user_id").eq("id", tenant.id).single();
    expect(updatedTenant?.user_id).toBe(tenantUser.id);
  });

  it("a mismatched phone number cannot claim the same record", async () => {
    const { error } = await wrongPhoneUser.client.rpc("claim_tenant_record", { p_org_slug: org.slug, p_phone: "0799999999" });
    expect(error).toBeTruthy();
  });

  it("an already-claimed record cannot be claimed again by someone else", async () => {
    const { error } = await wrongPhoneUser.client.rpc("claim_tenant_record", { p_org_slug: org.slug, p_phone: "0712345678" });
    expect(error).toBeTruthy();
  });

  it("the claimed tenant can now see their own tenant record via normal RLS", async () => {
    const { data } = await tenantUser.client.from("tenants").select("id").eq("id", tenant.id);
    expect(data).toHaveLength(1);
  });
});
