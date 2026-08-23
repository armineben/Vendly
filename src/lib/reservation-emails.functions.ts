import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ConfirmationInput = z.object({
  email: z.string().email(),
  nom: z.string(),
  prenom: z.string().optional(),
  telephone: z.string().optional(),
  acompte: z.number(),
  dateExpiration: z.string(),
  items: z.array(
    z.object({
      designation: z.string(),
      quantite: z.number(),
      prix_unitaire: z.number(),
    }),
  ),
});

export const sendReservationConfirmation = createServerFn({ method: "POST" })
  .inputValidator((input) => ConfirmationInput.parse(input))
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
          `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">${i.designation}</td><td style="padding:8px;text-align:center;">${i.quantite}</td><td style="padding:8px;text-align:right;">${(i.prix_unitaire * i.quantite).toFixed(3)} DT</td></tr>`,
      )
      .join("");
    const total = data.items.reduce(
      (s, i) => s + i.prix_unitaire * i.quantite,
      0,
    );

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="border-bottom:2px solid #5C2D91;padding-bottom:12px;margin-bottom:16px;">
        <h1 style="margin:0;font-size:18px;text-transform:uppercase;letter-spacing:0.1em;">Vendly</h1>
        <p style="margin:2px 0 0;color:#777;font-size:12px;">Confirmation de réservation</p>
      </div>
      <p style="font-size:13px;">Bonjour <strong>${data.prenom || ""} ${data.nom}</strong>,</p>
      <p style="font-size:13px;color:#555;">Votre réservation est confirmée. Voici le détail :</p>
      <table width="100%" style="font-size:13px;border-collapse:collapse;">
        <thead><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;">Article</th><th style="padding:8px;">Qté</th><th style="padding:8px;text-align:right;">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;"><span>Total</span><strong>${total.toFixed(3)} DT</strong></div>
        <div style="display:flex;justify-content:space-between;color:#777;"><span>Acompte versé</span><span>${data.acompte.toFixed(3)} DT</span></div>
        <div style="display:flex;justify-content:space-between;color:#777;"><span>Téléphone</span><span>${data.telephone || "—"}</span></div>
        <div style="display:flex;justify-content:space-between;color:#777;"><span>Date limite</span><strong>${new Date(data.dateExpiration).toLocaleString("fr-FR")}</strong></div>
      </div>
      <p style="margin-top:20px;font-size:13px;font-weight:bold;background:#fff4e5;border:1px solid #f5c76b;padding:12px;border-radius:8px;">
        Attention : Veuillez respecter impérativement le délai de réservation. Passé ce délai, le magasin ne sera plus tenu de vous rembourser votre acompte et les articles seront remis en vente.
      </p>
      <p style="margin-top:20px;font-size:11px;color:#999;text-align:center;">Vendly — Boutique mode</p>
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
        subject: "Confirmation de votre réservation — Vendly",
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erreur Resend : ${body}`);
    }
    return { ok: true };
  });

// ─── Vérification des réservations expirées ───────────────────
export const checkExpiredReservations = createServerFn({ method: "POST" })
  .handler(async () => {
    const now = new Date().toISOString();
    const { data: expired } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .eq("statut", "en_attente")
      .lt("date_expiration", now);

    if (!expired || expired.length === 0) return { expired: 0, emailed: 0 };

    let emailed = 0;
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "Vendly <onboarding@resend.dev>";

    for (const r of expired) {
      const email = r.email;
      if (!email) continue;
      const items = Array.isArray(r.items) ? r.items : [];
      const rows = items
        .map(
          (i: any) =>
            `<li>${i.designation || "Article"} × ${i.quantite || 0}</li>`,
        )
        .join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="font-size:18px;text-transform:uppercase;letter-spacing:0.1em;">Vendly</h1>
        <p style="font-size:13px;margin-top:16px;">Bonjour ${r.prenom || ""} ${r.nom || ""},</p>
        <p style="font-size:13px;">Votre réservation n'est malheureusement plus valide dans notre boutique car vous avez dépassé le délai imparti pour récupérer votre panier réservé.</p>
        <div style="background:#fdecea;border:1px solid #f5c6c0;padding:12px;border-radius:8px;font-size:13px;">
          <p style="margin:0;font-weight:bold;color:#b91c1c;">Articles concernés :</p>
          <ul>${rows || "<li>—</li>"}</ul>
        </div>
        <p style="font-size:11px;color:#999;margin-top:20px;text-align:center;">Vendly — Boutique mode</p>
      </body></html>`;

      try {
        if (resendKey) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from,
              to: email,
              subject: "Votre réservation est expirée — Vendly",
              html,
            }),
          });
          if (res.ok) emailed++;
        }
      } catch {
        // continue
      }

      // Marquer comme expirée
      await supabaseAdmin
        .from("reservations")
        .update({ statut: "expiré" })
        .eq("id", r.id);
    }

    return { expired: expired.length, emailed };
  });
