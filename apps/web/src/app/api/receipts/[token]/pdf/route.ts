import { NextRequest, NextResponse } from "next/server";
import { getReceiptByToken, renderPaymentReceiptPdf, receiptUrl } from "@nodus/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const receipt = await getReceiptByToken(admin, token);
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { org, payment, doc, tenant } = receipt;

  const pdf = await renderPaymentReceiptPdf({
    org: { name: org.name, kraPin: org.kra_pin },
    tenant: { displayName: tenant?.full_name ?? "Tenant" },
    payment: {
      id: payment.id,
      date: payment.date,
      reference: payment.reference,
      method: payment.method,
      amountCents: payment.amount_cents,
      invoiceNumber: doc?.number ?? "—",
    },
    receiptUrl: receiptUrl(token),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${payment.id.slice(0, 8)}.pdf"`,
    },
  });
}
