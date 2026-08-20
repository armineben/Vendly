import type { Database } from "@/integrations/supabase/types";

export const LOW_STOCK_THRESHOLD = 5;

export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];

export type StockCheckItem = {
  name?: string;
  designation?: string;
  reference?: string;
  stock?: number;
  quantite?: number;
};

export type LowStockAlertResult = {
  items: StockCheckItem[];
  whatsappUrl: string;
  messageText: string;
};

function getStock(item: StockCheckItem): number {
  const value = item.stock ?? item.quantite ?? 0;
  return Number(value);
}

function getName(item: StockCheckItem): string {
  return item.name ?? item.designation ?? "Article";
}

function getReference(item: StockCheckItem): string {
  return item.reference ?? "N/A";
}

/**
 * Analyse le stock et génère le rapport WhatsApp uniquement.
 */
export const checkAndNotifyLowStock = async (
  articles: StockCheckItem[],
): Promise<LowStockAlertResult | null> => {
  const lowStockItems = articles.filter((item) => getStock(item) < LOW_STOCK_THRESHOLD);

  if (lowStockItems.length === 0) return null;

  let messageWhatsApp = `⚠️ *RAPPORT DE STOCK CRITIQUE - Vendly* ⚠️\n\n`;
  messageWhatsApp += `Bonjour, voici les articles qui ont moins de ${LOW_STOCK_THRESHOLD} unités en stock :\n\n`;

  lowStockItems.forEach((item) => {
    messageWhatsApp += `▪️ *${getName(item)}* (Réf: ${getReference(item)})\n`;
    messageWhatsApp += `   👉 Stock restant : *${getStock(item)}* unités\n\n`;
  });

  messageWhatsApp += `Pour rappel, l'alerte se déclenche automatiquement à la connexion ou lors d'un import.`;

  const numeroPrincipal = (import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  const linkWhatsApp = numeroPrincipal
    ? `https://wa.me/${numeroPrincipal}?text=${encodeURIComponent(messageWhatsApp)}`
    : `https://wa.me/?text=${encodeURIComponent(messageWhatsApp)}`;

  return {
    items: lowStockItems,
    whatsappUrl: linkWhatsApp,
    messageText: messageWhatsApp,
  };
};