const ALLOWED_PROJECT_REFS = new Set(["vkwhqweevqjsgdpcmizh"]);

export function assertSafeTarget(supabaseUrl: string): void {
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  const ref = match?.[1];
  if (!ref || !ALLOWED_PROJECT_REFS.has(ref)) {
    throw new Error(
      `Refusing to run destructive test helpers against "${supabaseUrl}" — ` +
        `project ref "${ref}" is not in the isolation-test allowlist.`,
    );
  }
}
