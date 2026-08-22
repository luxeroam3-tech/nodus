import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient } from "./helpers/clients";
import { createTestUser, deleteTestUser, createOrgAsOwner, addMember, createProperty, createUnit, createTenant, type TestUser } from "./helpers/seed";

describe("Phase 7 maintenance requests and move checklists", () => {
  let owner: TestUser, caretaker: TestUser, tenantUser: TestUser, outsider: TestUser;
  let org: { id: string };
  let property: any, unit: any, otherUnit: any, tenant: any, lease: any;

  beforeAll(async () => {
    owner = await createTestUser();
    caretaker = await createTestUser();
    tenantUser = await createTestUser();
    outsider = await createTestUser();

    org = await createOrgAsOwner(owner, "Riverside Apartments Ltd");
    await addMember(org.id, caretaker.id, "caretaker");

    property = await createProperty(org.id, "Riverside Apartments");
    unit = await createUnit(org.id, property.id, "D3");
    otherUnit = await createUnit(org.id, property.id, "D4");
    tenant = await createTenant(org.id, "David Mwangi", tenantUser.id);

    const { data: leaseRow } = await adminClient
      .from("leases")
      .insert({ org_id: org.id, unit_id: unit.id, tenant_id: tenant.id, start_date: "2026-08-01", rent_amount_cents: 2800000 })
      .select()
      .single();
    lease = leaseRow;
  }, 30_000);

  afterAll(async () => {
    await adminClient.from("move_checklist_items").delete().eq("org_id", org.id);
    await adminClient.from("move_checklists").delete().eq("org_id", org.id);
    await adminClient.from("maintenance_requests").delete().eq("org_id", org.id);
    await adminClient.from("leases").delete().eq("org_id", org.id);
    await adminClient.from("tenants").delete().eq("org_id", org.id);
    await adminClient.from("units").delete().eq("org_id", org.id);
    await adminClient.from("cost_centers").delete().eq("org_id", org.id);
    await adminClient.from("properties").delete().eq("org_id", org.id);
    await adminClient.from("chart_of_accounts").delete().eq("org_id", org.id);
    await adminClient.from("organizations").delete().eq("id", org.id);
    for (const u of [owner, caretaker, tenantUser, outsider]) await deleteTestUser(u.id);
  }, 30_000);

  it("a tenant can raise a maintenance request for their own unit", async () => {
    const { data, error } = await tenantUser.client
      .from("maintenance_requests")
      .insert({ org_id: org.id, unit_id: unit.id, tenant_id: tenant.id, title: "Leaking tap" })
      .select()
      .single();
    expect(error).toBeFalsy();
    expect(data?.status).toBe("open");
  });

  it("a tenant cannot raise a request for a unit that isn't theirs", async () => {
    const { error } = await tenantUser.client
      .from("maintenance_requests")
      .insert({ org_id: org.id, unit_id: otherUnit.id, tenant_id: tenant.id, title: "Not my unit" });
    expect(error).toBeTruthy();
  });

  it("caretaker can see and manage maintenance requests org-wide", async () => {
    const { data } = await caretaker.client.from("maintenance_requests").select("*").eq("org_id", org.id);
    expect(data).toHaveLength(1);

    const { error } = await caretaker.client
      .from("maintenance_requests")
      .update({ status: "in_progress", assigned_to_user_id: caretaker.id })
      .eq("id", data![0].id);
    expect(error).toBeFalsy();
  });

  it("a tenant cannot change the status of their own request", async () => {
    const { data: req } = await tenantUser.client.from("maintenance_requests").select("id").limit(1).single();
    const { data, error } = await tenantUser.client.from("maintenance_requests").update({ status: "resolved" }).eq("id", req!.id).select();
    expect(error).toBeFalsy();
    expect(data).toEqual([]); // no writable row matched — RLS silently no-ops, doesn't error
  });

  it("an outsider sees no maintenance requests for this org", async () => {
    const { data } = await outsider.client.from("maintenance_requests").select("*").eq("org_id", org.id);
    expect(data).toEqual([]);
  });

  it("create_move_checklist seeds three default items", async () => {
    const { data: checklist, error } = await caretaker.client.rpc("create_move_checklist", {
      p_org_id: org.id,
      p_lease_id: lease.id,
      p_type: "move_in",
    });
    expect(error).toBeFalsy();
    expect(checklist.status).toBe("pending");

    const { data: items } = await caretaker.client.from("move_checklist_items").select("label, checked").eq("checklist_id", checklist.id);
    expect(items).toHaveLength(3);
    expect(items?.every((i: any) => i.checked === false)).toBe(true);
  });

  it("a tenant can view their own checklist and its items, but cannot check items off", async () => {
    const { data: checklist } = await tenantUser.client.from("move_checklists").select("id, status").eq("lease_id", lease.id).single();
    expect(checklist?.status).toBe("pending");

    const { data: items } = await tenantUser.client.from("move_checklist_items").select("id").eq("checklist_id", checklist!.id);
    expect(items).toHaveLength(3);

    const { data: updated, error } = await tenantUser.client.from("move_checklist_items").update({ checked: true }).eq("id", items![0].id).select();
    expect(error).toBeFalsy();
    expect(updated).toEqual([]);
  });

  it("complete_move_checklist rejects completion while items are unchecked", async () => {
    const { data: checklist } = await caretaker.client.from("move_checklists").select("id").eq("lease_id", lease.id).single();
    const { error } = await caretaker.client.rpc("complete_move_checklist", { p_checklist_id: checklist!.id });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/unchecked/i);
  });

  it("caretaker checks off every item, then completes the checklist", async () => {
    const { data: checklist } = await caretaker.client.from("move_checklists").select("id").eq("lease_id", lease.id).single();
    const { data: items } = await caretaker.client.from("move_checklist_items").select("id").eq("checklist_id", checklist!.id);
    for (const item of items ?? []) {
      await caretaker.client.from("move_checklist_items").update({ checked: true }).eq("id", item.id);
    }

    const { data: completed, error } = await caretaker.client.rpc("complete_move_checklist", { p_checklist_id: checklist!.id });
    expect(error).toBeFalsy();
    expect(completed.status).toBe("completed");
    expect(completed.completed_by_user_id).toBe(caretaker.id);
  });

  it("caretaker still has zero access to leases (financial exclusion holds)", async () => {
    const { data } = await caretaker.client.from("leases").select("*").eq("org_id", org.id);
    expect(data).toEqual([]);
  });
});
