import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { OrgProfileForm } from "./org-profile-form";
import { SmsSettingsForm } from "./sms-settings-form";
import { PaymentGatewayForm } from "./payment-gateway-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase.from("org_memberships").select("org_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");

  const [{ data: org }, { data: smsSettings }, { data: gateways }] = await Promise.all([
    supabase.from("organizations").select("id, name, kra_pin, vat_registered").eq("id", membership.org_id).maybeSingle(),
    supabase.from("sms_settings").select("enabled, provider").eq("org_id", membership.org_id).maybeSingle(),
    supabase.from("payment_gateways").select("gateway_id, enabled, environment").eq("org_id", membership.org_id),
  ]);

  const isOwner = membership.role === "owner";
  const mpesa = (gateways ?? []).find((g) => g.gateway_id === "mpesa_daraja");
  const kopokopo = (gateways ?? []).find((g) => g.gateway_id === "kopokopo");

  return (
    <div>
      <PageHeader title="Settings" subtitle={isOwner ? undefined : "Only the org owner can change these"} />

      <div className="content-grid">
        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-1">Organization</h3>
          <p className="text-[12.5px] text-[var(--text-muted)] mb-4">Name and KRA details shown on invoices and receipts.</p>
          <OrgProfileForm org={org ?? { name: "", kra_pin: null, vat_registered: false }} disabled={!isOwner} />
        </div>

        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-1">SMS notifications</h3>
          <p className="text-[12.5px] text-[var(--text-muted)] mb-4">Sends rent reminders and payment receipts via Advanta SMS.</p>
          <SmsSettingsForm enabled={smsSettings?.enabled ?? false} disabled={!isOwner} />
        </div>

        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-1">M-Pesa Daraja</h3>
          <p className="text-[12.5px] text-[var(--text-muted)] mb-4">STK push and C2B collections straight to your paybill.</p>
          <PaymentGatewayForm gatewayId="mpesa_daraja" title="M-Pesa Daraja" enabled={mpesa?.enabled ?? false} environment={mpesa?.environment ?? "sandbox"} disabled={!isOwner} />
        </div>

        <div className="card px-[18px] py-4">
          <h3 className="[font-family:var(--font-display)] text-[15px] font-semibold mb-1">KopoKopo</h3>
          <p className="text-[12.5px] text-[var(--text-muted)] mb-4">STK push collections via your KopoKopo till.</p>
          <PaymentGatewayForm gatewayId="kopokopo" title="KopoKopo" enabled={kopokopo?.enabled ?? false} environment={kopokopo?.environment ?? "sandbox"} disabled={!isOwner} />
        </div>
      </div>
    </div>
  );
}
