"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PortalFormState = { error?: string } | undefined;

export async function portalSignIn(orgSlug: string, _prev: PortalFormState, formData: FormData): Promise<PortalFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email and password don't match. Try again." };

  redirect(`/portal/${orgSlug}`);
}

export async function portalSignUp(orgSlug: string, _prev: PortalFormState, formData: FormData): Promise<PortalFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!email || !password || !fullName) return { error: "Fill in every field" };
  if (password.length < 8) return { error: "Use at least 8 characters for your password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) return { error: error.message };

  redirect(`/portal/${orgSlug}/claim`);
}

export async function portalClaim(orgSlug: string, _prev: PortalFormState, formData: FormData): Promise<PortalFormState> {
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "Enter the phone number your landlord has on file" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_tenant_record", { p_org_slug: orgSlug, p_phone: phone });
  if (error) return { error: "No unclaimed tenant record matches that number. Check with your landlord." };

  redirect(`/portal/${orgSlug}`);
}

export async function portalSignOut(orgSlug: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/portal/${orgSlug}/login`);
}
