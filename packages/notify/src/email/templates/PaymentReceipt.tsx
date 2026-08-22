import React from "react";

interface PaymentReceiptProps {
  orgName: string;
  brandColor?: string | null;
  tenantName: string;
  amount: string;
  invoiceNumber: string;
  paymentMethod: string;
  receiptNumber: string;
  reference?: string | null;
  date: string;
  receiptUrl?: string;
}

const row: React.CSSProperties = { margin: "0 0 10px", fontSize: 14, display: "flex", justifyContent: "space-between" };
const label: React.CSSProperties = { color: "#6b7280" };
const value: React.CSSProperties = { fontWeight: 600, color: "#111827" };

export function PaymentReceipt({
  orgName,
  brandColor,
  tenantName,
  amount,
  invoiceNumber,
  paymentMethod,
  receiptNumber,
  reference,
  date,
  receiptUrl,
}: PaymentReceiptProps) {
  const color = brandColor || "#1e3a5f";
  return (
    <html>
      <body style={{ backgroundColor: "#f1f5f9", fontFamily: "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif", margin: 0, padding: 0 }}>
        <table width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "32px 16px" }}>
                <table width="560" cellPadding={0} cellSpacing={0} style={{ background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "36px 32px" }}>
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 999, background: color, color: "#fff", fontSize: 22, fontWeight: 700, lineHeight: "48px", margin: "0 auto 12px" }}>
                            ✓
                          </div>
                          <h1 style={{ color: "#111827", fontSize: 20, fontWeight: 700, margin: 0 }}>Payment Received</h1>
                        </div>

                        <p style={{ color: "#374151", fontSize: 14, lineHeight: "24px" }}>Hi {tenantName},</p>
                        <p style={{ color: "#374151", fontSize: 14, lineHeight: "24px" }}>
                          We have received your payment of <strong>{amount}</strong> for Invoice <strong>{invoiceNumber}</strong>.
                        </p>

                        <div style={{ background: "#f9fafb", borderRadius: 12, padding: "20px 24px", marginTop: 20 }}>
                          <p style={row}>
                            <span style={label}>Amount Paid</span>
                            <span style={{ ...value, color }}>{amount}</span>
                          </p>
                          <p style={row}>
                            <span style={label}>Date</span>
                            <span style={value}>{date}</span>
                          </p>
                          <p style={row}>
                            <span style={label}>Method</span>
                            <span style={value}>{paymentMethod}</span>
                          </p>
                          <p style={row}>
                            <span style={label}>Receipt #</span>
                            <span style={value}>{receiptNumber}</span>
                          </p>
                          {reference ? (
                            <p style={{ ...row, margin: 0 }}>
                              <span style={label}>Reference</span>
                              <span style={value}>{reference}</span>
                            </p>
                          ) : null}
                        </div>

                        {receiptUrl ? (
                          <div style={{ textAlign: "center", margin: "24px 0 0" }}>
                            <a
                              href={receiptUrl}
                              style={{ background: color, color: "#fff", padding: "12px 28px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", display: "inline-block" }}
                            >
                              View / download PDF receipt
                            </a>
                          </div>
                        ) : null}

                        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 32 }}>{orgName}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export default PaymentReceipt;
