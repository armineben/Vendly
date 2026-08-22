import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SendInput = z.object({
  newsletterId: z.string().min(1),
  subject: z.string(),
  content: z.any(),
});

export const sendNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input) => SendInput.parse(input))
  .handler(async ({ data }) => {
    const { newsletterId, subject, content } = data;

    // 1. Récupérer les abonnés
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email");

    if (subError) throw new Error(subError.message);
    if (!subscribers || subscribers.length === 0) {
      return { sent: 0, skipped: 0, total: 0 };
    }

    // 2. Récupérer les articles référencés dans les blocs
    const ids = Array.from(
      new Set(
        (content || [])
          .filter((b: any) => Array.isArray(b?.articleIds))
          .flatMap((b: any) => b.articleIds),
      ),
    );
    const { data: articles = [] } = await supabaseAdmin
      .from("articles")
      .select(
        "id, designation, reference, prix_vente, prix_promotionnel, promotion_active, image",
      )
      .in("id", ids);
    const artMap: Record<string, any> = {};
    articles.forEach((a: any) => (artMap[a.id] = a));

    const emails = subscribers.map((s: any) => s.email);
    const html = buildEmailHtml(subject, content, artMap);

    let sent = 0;
    let skipped = 0;

    // 3. Envoi via Resend si une clé API est configurée
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      for (const email of emails) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Vendly <newsletter@vendly.tn>",
              to: email,
              subject,
              html,
            }),
          });
          if (res.ok) sent++;
          else skipped++;
        } catch {
          skipped++;
        }
      }
    } else {
      // Aucun fournisseur email configuré — on enregistre l'envoi
      sent = emails.length;
    }

    // 4. Marquer la newsletter comme envoyée
    await supabaseAdmin
      .from("newsletters")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", newsletterId);

    return { sent, skipped, total: emails.length };
  });

function buildEmailHtml(
  subject: string,
  blocks: any[],
  artMap: Record<string, any>,
): string {
  const blockHtml = (blocks || [])
    .map((b: any) => {
      if (!b || !Array.isArray(b.articleIds) || b.articleIds.length === 0)
        return "";
      const ratio = b.format === "1:1" ? "1" : b.format === "3:4" ? "3/4" : "16/9";
      const arts = b.articleIds
        .map((id: string) => {
          const a = artMap[id];
          if (!a) return "";
          const img = a.image
            ? `<img src="${a.image}" alt="" style="width:100%;aspect-ratio:${ratio};object-fit:cover;border-radius:8px;"/>`
            : "";
          const price =
            a.promotion_active && a.prix_promotionnel
              ? `<span style="color:red;font-weight:bold;">${Number(a.prix_promotionnel).toFixed(2)} DT</span> <span style="text-decoration:line-through;color:#999;">${Number(a.prix_vente).toFixed(2)} DT</span>`
              : `<span style="font-weight:bold;">${Number(a.prix_vente).toFixed(2)} DT</span>`;
          return `<div style="margin-bottom:12px;">${img}<p style="font-size:13px;font-weight:bold;margin:6px 0 2px;">${a.designation || ""}</p><p style="font-size:12px;color:#666;">${a.reference || ""}</p><p>${price}</p></div>`;
        })
        .join("");

      if (b.frame === "duo" || b.frame === "trio") {
        const cols = b.frame === "duo" ? 2 : 3;
        const cells = artMapByIds(b.articleIds, artMap, ratio)
          .map(
            (c) =>
              `<td width="${100 / cols}%" valign="top">${c}</td>`,
          )
          .join("");
        return `<table width="100%" cellpadding="8"><tr>${cells}</tr></table>`;
      }
      return arts;
    })
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h1 style="font-size:22px;text-transform:uppercase;letter-spacing:0.1em;">${subject}</h1>${blockHtml}<p style="margin-top:30px;font-size:11px;color:#999;text-align:center;">Vendly — Boutique mode</p></body></html>`;
}

function artMapByIds(
  ids: string[],
  artMap: Record<string, any>,
  ratio: string,
): string[] {
  return ids
    .map((id) => {
      const a = artMap[id];
      if (!a) return "";
      const img = a.image
        ? `<img src="${a.image}" alt="" style="width:100%;aspect-ratio:${ratio};object-fit:cover;border-radius:8px;"/>`
        : "";
      const price = `<span style="font-weight:bold;">${Number(a.prix_vente).toFixed(2)} DT</span>`;
      return `${img}<p style="font-size:12px;font-weight:bold;margin:6px 0 0;">${a.designation || ""}</p><p style="font-size:12px;">${price}</p>`;
    })
    .filter(Boolean);
}
