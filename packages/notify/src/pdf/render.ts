import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PaymentReceiptPdf, type PdfOrg, type PdfTenant, type PdfPayment } from "./PaymentReceiptPdf";
import { qrPngDataUrl } from "../receipts/qr";

export async function renderPaymentReceiptPdf(args: {
  org: PdfOrg;
  tenant: PdfTenant;
  payment: PdfPayment;
  receiptUrl?: string;
}): Promise<Buffer> {
  const qrDataUrl = args.receiptUrl ? await qrPngDataUrl(args.receiptUrl) : undefined;
  const element = React.createElement(PaymentReceiptPdf, {
    org: args.org,
    tenant: args.tenant,
    payment: args.payment,
    qrDataUrl,
    receiptUrl: args.receiptUrl,
  });
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}
