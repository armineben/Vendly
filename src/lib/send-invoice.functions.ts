import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InvoiceInput = z.object({
  email: z.string().email(),
  invoiceNumber: z.string(),
  date: z.string(),
  items: z.array(
    z.object({
      designation: z.string(),
      qty: z.number(),
      prix: z.number(),
    }),
  ),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  paymentMethod: z.string(),
});

export const sendInvoice = createServerFn({ method: "POST" })
  .inputValidator((input) => InvoiceInput.parse(input))
  .handler(async ({ data }) => {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      throw new Error(
        "Aucune clé Resend configurée. Ajoutez RESEND_API_KEY aux variables du worker.",
      );
    }
    const from = process.env.RESEND_FROM || "Vendly <onboarding@resend.dev>";

    const rows = data.items
      .map(
        (i) =>
          `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">${i.designation}</td><td style="padding:8px;text-align:center;">${i.qty}</td><td style="padding:8px;text-align:right;">${i.prix.toFixed(3)} DT</td><td style="padding:8px;text-align:right;font-weight:bold;">${(i.prix * i.qty).toFixed(3)} DT</td></tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="border-bottom:2px solid #5C2D91;padding-bottom:12px;margin-bottom:16px;">
        <h1 style="margin:0;font-size:18px;text-transform:uppercase;letter-spacing:0.1em;">Vendly</h1>
        <p style="margin:2px 0 0;color:#777;font-size:12px;">Facture ${data.invoiceNumber}</p>
      </div>
      <p style="font-size:13px;color:#555;">Date : ${data.date}</p>
      <table width="100%" style="font-size:13px;border-collapse:collapse;">
        <thead><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;">Article</th><th style="padding:8px;">Qté</th><th style="padding:8px;text-align:right;">PU</th><th style="padding:8px;text-align:right;">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;color:#777;"><span>Sous-total</span><span>${data.subtotal.toFixed(3)} DT</span></div>
        ${data.discount > 0 ? `<div style="display:flex;justify-content:space-between;color:red;"><span>Remise</span><span>-${data.discount.toFixed(3)} DT</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px;margin-top:8px;border-top:1px solid #eee;padding-top:8px;"><span>Total</span><span>${data.total.toFixed(3)} DT</span></div>
        <p style="margin-top:8px;font-size:12px;color:#555;">Mode de paiement : ${data.paymentMethod}</p>
      </div>
      <p style="margin-top:24px;font-size:11px;color:#999;text-align:center;">Merci de votre achat chez Vendly</p>
    </body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: data.email,
        subject: `Votre facture ${data.invoiceNumber} — Vendly`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erreur Resend : ${body}`);
    }
    return { ok: true };
  });
