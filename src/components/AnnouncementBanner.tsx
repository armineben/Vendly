import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SALE_CATEGORY_LABELS: Record<string, string> = {
  Tous: "toute la boutique",
  Homme: "Homme",
  Femme: "Femme",
  Enfant: "Enfant",
  Accessoires: "Accessoires",
  Sacs: "Sacs",
};

interface SaleConfig {
  active: boolean;
  text: string;
  percentage: number;
  category: string;
}

export function AnnouncementBanner() {
  const { data: config } = useQuery({
    queryKey: ["site-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_config")
        .select("config_json")
        .eq("id", "main")
        .maybeSingle();
      return data;
    },
  });

  const sale = config?.config_json?.sale as SaleConfig | undefined;
  if (!sale?.active) return null;

  const categoryLabel = SALE_CATEGORY_LABELS[sale.category] || sale.category || "la boutique";

  return (
    <div className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-pink-500 py-2.5 px-4 text-center text-sm font-semibold text-white tracking-wide shadow-sm">
      {sale.text || "Soldes"} : -{sale.percentage}% sur{" "}
      {sale.category === "Tous" || !sale.category
        ? "toute la boutique"
        : `la collection ${categoryLabel}`}{" "}
      🔥
    </div>
  );
}
