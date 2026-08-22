import { NextRequest, NextResponse } from "next/server";
import { handleGatewayWebhook, type GatewayId } from "@nodus/mpesa";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_GATEWAYS: GatewayId[] = ["mpesa_daraja", "kopokopo"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await params;
  if (!VALID_GATEWAYS.includes(gateway as GatewayId)) {
    return NextResponse.json({ error: "Unknown gateway" }, { status: 404 });
  }

  const outcome = await handleGatewayWebhook(req, gateway as GatewayId, createAdminClient());

  // Safaricom/KopoKopo retry on anything but 2xx — always acknowledge so a
  // rejection we understand (bad token, disabled gateway) doesn't turn into
  // an infinite retry storm; only a genuinely unexpected failure should 500.
  if (outcome.kind === "rejected") {
    return NextResponse.json({ received: true, reason: outcome.reason }, { status: 200 });
  }
  return NextResponse.json({ received: true, status: "status" in outcome ? outcome.status : undefined }, { status: 200 });
}
