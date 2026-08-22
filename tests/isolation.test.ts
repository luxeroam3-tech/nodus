import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, anonClient } from "./helpers/clients";
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

describe("Phase 1 multi-tenancy isolation", () => {
  let ownerA: TestUser, managerA: TestUser, accountantA: TestUser, caretakerA: TestUser;
  let ownerB: TestUser, tenantUserA: TestUser, outsider: TestUser;
  let orgA: { id: string }, orgB: { id: string };
  let propertyA: any, unitA: any, tenantA: any, leaseA: any;

  beforeAll(async () => {
    [ownerA, managerA, accountantA, caretakerA, ownerB, tenantUserA, outsider] = await Promise.all([
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
      createTestUser(),
    ]);

    orgA = await createOrgAsOwner(ownerA, "Kilimani Heights Ltd");
    orgB = await createOrgAsOwner(ownerB, "Lavington Court Ltd");

    await addMember(orgA.id, managerA.id, "manager");
    await addMember(orgA.id, accountantA.id, "accountant");
    await addMember(orgA.id, caretakerA.id, "caretaker");

    propertyA = await createProperty(orgA.id, "Kilimani Heights");
    unitA = await createUnit(orgA.id, propertyA.id, "A4");
    tenantA = await createTenant(orgA.id, "Brian Otieno", tenantUserA.id);
    leaseA = await createLease(orgA.id, unitA.id, tenantA.id);
  }, 30_000);

  afterAll(async () => {
    await adminClient.from("leases").delete().eq("org_id", orgA.id);
    await adminClient.from("tenants").delete().eq("org_id", orgA.id);
    await adminClient.from("units").delete().eq("org_id", orgA.id);
    await adminClient.from("properties").delete().eq("org_id", orgA.id);
    await adminClient.from("organizations").delete().in("id", [orgA.id, orgB.id]);
    await Promise.all(
      [ownerA, managerA, accountantA, caretakerA, ownerB, tenantUserA, outsider].map((u) => deleteTestUser(u.id)),
    );
  }, 30_000);

  // ---------- Organization bootstrap ----------

  it("rejects a direct insert into organizations (RPC is the only path)", async () => {
    const { error } = await ownerA.client.from("organizations").insert({ name: "Shadow Org" });
    expect(error).toBeTruthy();
  });

  it("create_organization makes the caller the owner", async () => {
    const { data } = await ownerA.client
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgA.id)
      .eq("user_id", ownerA.id)
      .single();
    expect(data?.role).toBe("owner");
  });

  it("blocks removing the last owner of an org", async () => {
    const { error } = await adminClient.from("org_memberships").delete().eq("org_id", orgA.id).eq("user_id", ownerA.id);
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/last owner/i);
  });

  // ---------- Anonymous access ----------

  it("denies all table reads to an unauthenticated client", async () => {
    const unauth = anonClient();
    const { data, error } = await unauth.from("properties").select("*");
    expect(error || (data ?? []).length === 0).toBeTruthy();
  });

  // ---------- Cross-org isolation ----------

  it("owner B cannot see org A's properties", async () => {
    const { data } = await ownerB.client.from("properties").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot see org A's units", async () => {
    const { data } = await ownerB.client.from("units").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot see org A's tenants", async () => {
    const { data } = await ownerB.client.from("tenants").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot see org A's leases", async () => {
    const { data } = await ownerB.client.from("leases").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("owner B cannot write into org A's properties", async () => {
    const { error } = await ownerB.client.from("properties").insert({ org_id: orgA.id, name: "Hostile insert" });
    expect(error).toBeTruthy();
  });

  it("an outsider with no membership anywhere sees nothing", async () => {
    const { data } = await outsider.client.from("properties").select("*");
    expect(data).toEqual([]);
  });

  // ---------- Role restrictions within org A ----------

  it("caretaker can read units (no financial columns on that table)", async () => {
    const { data, error } = await caretakerA.client.from("units").select("*").eq("id", unitA.id);
    expect(error).toBeFalsy();
    expect(data).toHaveLength(1);
  });

  it("caretaker is excluded from leases entirely", async () => {
    const { data } = await caretakerA.client.from("leases").select("*").eq("org_id", orgA.id);
    expect(data).toEqual([]);
  });

  it("caretaker cannot create a property", async () => {
    const { error } = await caretakerA.client.from("properties").insert({ org_id: orgA.id, name: "Caretaker's building" });
    expect(error).toBeTruthy();
  });

  it("caretaker can update unit status (occupancy is caretaker's job)", async () => {
    const { error } = await caretakerA.client.from("units").update({ status: "notice" }).eq("id", unitA.id);
    expect(error).toBeFalsy();
    await adminClient.from("units").update({ status: "occupied" }).eq("id", unitA.id);
  });

  it("accountant can read leases (financial role)", async () => {
    const { data, error } = await accountantA.client.from("leases").select("*").eq("id", leaseA.id);
    expect(error).toBeFalsy();
    expect(data).toHaveLength(1);
  });

  it("accountant cannot write properties (not owner/manager)", async () => {
    const { error } = await accountantA.client.from("properties").insert({ org_id: orgA.id, name: "Accountant's building" });
    expect(error).toBeTruthy();
  });

  it("manager can create a property", async () => {
    const { data, error } = await managerA.client
      .from("properties")
      .insert({ org_id: orgA.id, name: "Manager-added property" })
      .select()
      .single();
    expect(error).toBeFalsy();
    if (data) await adminClient.from("properties").delete().eq("id", data.id);
  });

  // ---------- Tenant portal scope ----------

  it("tenant sees only their own lease, not other org A leases", async () => {
    const { data } = await tenantUserA.client.from("leases").select("*");
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(leaseA.id);
  });

  it("tenant sees only their own tenant record, not other tenants in org A", async () => {
    const otherTenant = await createTenant(orgA.id, "Faith Wambui");
    const { data } = await tenantUserA.client.from("tenants").select("id");
    const ids = (data ?? []).map((r: any) => r.id);
    expect(ids).toContain(tenantA.id);
    expect(ids).not.toContain(otherTenant.id);
    await adminClient.from("tenants").delete().eq("id", otherTenant.id);
  });

  it("tenant cannot write their own lease", async () => {
    // No UPDATE policy grants tenants write access, so the row is invisible
    // to the update rather than erroring — PostgREST reports zero rows
    // affected. Assert on that, and confirm nothing actually changed.
    const { data, error } = await tenantUserA.client
      .from("leases")
      .update({ rent_amount_cents: 1 })
      .eq("id", leaseA.id)
      .select();
    expect(error).toBeFalsy();
    expect(data).toEqual([]);

    const { data: unchanged } = await adminClient.from("leases").select("rent_amount_cents").eq("id", leaseA.id).single();
    expect(unchanged?.rent_amount_cents).toBe(leaseA.rent_amount_cents);
  });

  it("tenant cannot self-insert a lease", async () => {
    const { error } = await tenantUserA.client
      .from("leases")
      .insert({ org_id: orgA.id, unit_id: unitA.id, tenant_id: tenantA.id, start_date: "2026-01-01", rent_amount_cents: 1 });
    expect(error).toBeTruthy();
  });
});
