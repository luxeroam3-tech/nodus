import { Resend } from "resend";
import type React from "react";

export async function sendEmail({ to, subject, react }: { to: string; subject: string; react: React.ReactElement }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("No RESEND_API_KEY found, skipping email dispatch to:", to);
    return;
  }

  const resend = new Resend(apiKey);

  // resend.dev's shared testing domain only ever delivers to the account
  // owner's own verified address — every send to a real tenant silently
  // fails on that sender. Set RESEND_FROM_EMAIL once a real domain is
  // verified in Resend (Domains → Add Domain → verify DNS records).
  const from = process.env.RESEND_FROM_EMAIL || "Nodus <onboarding@resend.dev>";
  if (!process.env.RESEND_FROM_EMAIL) {
    console.warn(`RESEND_FROM_EMAIL not set — sending from ${from}, which only delivers to the Resend account's own address.`);
  }

  try {
    const { error } = await resend.emails.send({ from, to, subject, react });
    if (error) console.error(`Resend API error sending "${subject}" to ${to}:`, error);
  } catch (e) {
    console.error(`Failed to send email "${subject}" to ${to}:`, e);
  }
}
