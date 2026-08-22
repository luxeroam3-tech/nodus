import { randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { adminClient, supabaseUrl } from "./clients";

const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type TestUser = { id: string; email: string; password: string; client: SupabaseClient };

function uniqueEmail(): string {
  return `nodus-test-${randomUUID()}@example.com`;
}

/** Creates a confirmed auth user and returns a signed-in anon-key client for them. */
export async function createTestUser(): Promise<TestUser> {
  const email = uniqueEmail();
  const password = "test-password-" + Math.random().toString(36).slice(2);

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser failed: ${error?.message}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);

  return { id: data.user.id, email, password, client };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId).catch(() => null);
}

/** Owner-bootstraps an org through the real RPC path, as that user. */
export async function createOrgAsOwner(owner: TestUser, name: string) {
  const { data, error } = await owner.client.rpc("create_organization", {
    org_name: name,
    org_type: "individual",
  });
  if (error || !data) throw new Error(`create_organization failed: ${error?.message}`);
  return data as { id: string; name: string; type: string };
}

/** Fixture setup only — uses the service role to bypass RLS, never for assertions. */
export async function addMember(orgId: string, userId: string, role: "owner" | "manager" | "accountant" | "caretaker") {
  const { error } = await adminClient.from("org_memberships").insert({ org_id: orgId, user_id: userId, role });
  if (error) throw new Error(`addMember failed: ${error.message}`);
}

export async function createProperty(orgId: string, name = "Test Property") {
  const { data, error } = await adminClient
    .from("properties")
    .insert({ org_id: orgId, name, type: "apartment" })
    .select()
    .single();
  if (error || !data) throw new Error(`createProperty failed: ${error?.message}`);
  return data;
}

export async function createUnit(orgId: string, propertyId: string, unitNumber = "A1") {
  const { data, error } = await adminClient
    .from("units")
    .insert({ org_id: orgId, property_id: propertyId, unit_number: unitNumber, status: "occupied", bedrooms: 1 })
    .select()
    .single();
  if (error || !data) throw new Error(`createUnit failed: ${error?.message}`);
  return data;
}

export async function createTenant(orgId: string, fullName = "Test Tenant", userId?: string) {
  const { data, error } = await adminClient
    .from("tenants")
    .insert({ org_id: orgId, full_name: fullName, user_id: userId ?? null })
    .select()
    .single();
  if (error || !data) throw new Error(`createTenant failed: ${error?.message}`);
  return data;
}

export async function createLease(orgId: string, unitId: string, tenantId: string) {
  const { data, error } = await adminClient
    .from("leases")
    .insert({
      org_id: orgId,
      unit_id: unitId,
      tenant_id: tenantId,
      start_date: "2026-01-01",
      rent_amount_cents: 3200000,
      deposit_amount_cents: 3200000,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createLease failed: ${error?.message}`);
  return data;
}
