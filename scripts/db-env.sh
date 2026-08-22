#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="vkwhqweevqjsgdpcmizh"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

RAW_JSON=$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json)
PROJECT_URL="https://${PROJECT_REF}.supabase.co"

node -e '
  const raw = process.argv[1];
  const url = process.argv[2];
  const keys = JSON.parse(raw);
  const anon = keys.find(k => k.name === "anon")?.api_key;
  const service = keys.find(k => k.name === "service_role")?.api_key;
  if (!anon || !service) {
    console.error("Could not find anon/service_role keys in CLI output");
    process.exit(1);
  }
  const fs = require("fs");
  const out = [
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    `SUPABASE_URL=${url}`,
    `SUPABASE_ANON_KEY=${anon}`,
  ].join("\n") + "\n";
  fs.writeFileSync(".env.test", out, { mode: 0o600 });
  console.log("Wrote .env.test (not committed, chmod 600)");
' "$RAW_JSON" "$PROJECT_URL"
