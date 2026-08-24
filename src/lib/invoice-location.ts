import { supabase } from "@/integrations/supabase/client";

// Récupère l'emplacement de stockage des factures depuis site_config
export async function getInvoiceLocation(): Promise<string> {
  try {
    const { data } = await supabase
      .from("site_config")
      .select("invoice_location")
      .eq("id", "main")
      .maybeSingle();
    return (data?.invoice_location || "factures/") as string;
  } catch {
    return "factures/";
  }
}
