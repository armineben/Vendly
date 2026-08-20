import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ArticleRow } from "@/utils/stockAlerts";
import { checkAndNotifyLowStock } from "@/utils/stockAlerts";
import { insertNotification } from "@/hooks/use-notifications";

const STOCK_FAIBLE_THRESHOLD = 2;

/**
 * Vérifie si une notification de même type existe déjà aujourd'hui pour le sujet donné.
 */
async function notificationExistsToday(
  subject: string,
  type: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .ilike("message", `%${subject}%`)
    .eq("type", type)
    .gte("created_at", new Date().toISOString().slice(0, 10));
  return (count ?? 0) > 0;
}

/**
 * À la connexion : détecte les stocks passés sous le seuil depuis la dernière
 * visite (via les notifications déjà émises par le trigger DB) et génère le
 * rapport WhatsApp. N'insère pas de notification pour les articles créés
 * directement avec un stock faible.
 */
export function useLowStockAlerts(enabled: boolean) {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const checkedOnLogin = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const fetchArticlesAndCheckStock = async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("status", "actif");

      if (data && !error) {
        setArticles(data);

        if (checkedOnLogin.current) return;
        checkedOnLogin.current = true;

        const alertReport = await checkAndNotifyLowStock(data);

        if (alertReport) {
          console.log(
            "Stock critique détecté ! Lien WhatsApp prêt :",
            alertReport.whatsappUrl,
          );
          for (const item of alertReport.items) {
            const name = item.designation ?? item.name ?? "Article";
            const qty = item.stock ?? item.quantite ?? 0;

            // Ne pas notifier si déjà notifié aujourd'hui (évite doublons
            // et évite de notifier des articles toujours à 1-2)
            const alreadyExists = await notificationExistsToday(name, "low_stock");
            if (alreadyExists) continue;

            // Rupture
            if (qty <= 0) {
              insertNotification(`🔴 Rupture de stock : ${name} est en rupture (0 unité)`, "low_stock");
            }
            // Stock faible (1-2) : le trigger DB a déjà dû notifier si c'est une transition
            // On ne notifie ici que si le stock est à 0 (rupture)
          }
        }
      }
    };

    void fetchArticlesAndCheckStock();
  }, [enabled]);

  return { articles };
}

/** Vérification stock après import Excel — notifications silencieuses uniquement. */
export async function runLowStockCheckAfterImport(importReussi: boolean) {
  if (!importReussi) return null;

  const { data: updatedArticles, error } = await supabase.from("articles").select("*");

  if (error) {
    console.error("Impossible de vérifier le stock après import:", error);
    return null;
  }

  if (!updatedArticles) return null;

  const alertReport = await checkAndNotifyLowStock(updatedArticles);

  if (alertReport) {
    console.log("Des articles sont en rupture ! Lien WhatsApp prêt :", alertReport.whatsappUrl);
    for (const item of alertReport.items) {
      const name = item.designation ?? item.name ?? "Article";
      insertNotification(`⚠️ Alerte Stock Bas : ${name} n'a plus que ${item.stock ?? item.quantite ?? 0} unités en stock`, "low_stock");
    }
  }

  return alertReport;
}
