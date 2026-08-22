"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "../(auth)/actions";

export async function createOrganization(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "individual") as "individual" | "agency";
  if (!name) return { error: "Give your organization a name" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("create_organization", { org_name: name, org_type: type });
  if (error) return { error: error.message };

  redirect("/");
}
