import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VendeurInfo {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
}

interface SaleRecord {
  id: string;
  created_at: string;
  article_name: string;
  reference: string;
  quantity: number;
  total_price: number;
}

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  manager: "Manager",
  vendeur: "Vendeuse",
};

export function VendeurProfil() {
  const [profile, setProfile] = useState<VendeurInfo | null>(null);
  const [history, setHistory] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCA: 0, totalArticles: 0 });

  useEffect(() => {
    const fetchProfilEtVentes = async () => {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const [{ data: profileData }, { data: roleData }] = await Promise.all([
            supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
          ]);

          const appRole = roleData?.role ?? "vendeur";

          setProfile({
            id: user.id,
            email: profileData?.email || user.email || "",
            full_name:
              profileData?.display_name ||
              (user.user_metadata?.full_name as string | undefined) ||
              "Vendeuse Secret's",
            role: roleLabels[appRole] ?? "Vendeuse",
          });

          const { data: salesData, error } = await supabase
            .from("sales")
            .select("id, created_at, quantite, total, articles(designation, reference)")
            .eq("vendeur_id", user.id)
            .order("created_at", { ascending: false });

          if (salesData && !error) {
            const rows: SaleRecord[] = salesData.map((row: any) => ({
              id: row.id,
              created_at: row.created_at,
              article_name: row.articles?.designation ?? "—",
              reference: row.articles?.reference ?? "N/A",
              quantity: Number(row.quantite),
              total_price: Number(row.total),
            }));
            setHistory(rows);

            const ca = rows.reduce((sum, item) => sum + (item.total_price || 0), 0);
            const qty = rows.reduce((sum, item) => sum + (item.quantity || 0), 0);
            setStats({ totalCA: ca, totalArticles: qty });
          }
        }
      } catch (err) {
        console.error("Erreur profil:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchProfilEtVentes();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 font-medium text-purple-900">
        🔄 Chargement de votre espace profil...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 p-6 text-white shadow-xl">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center space-x-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-purple-300 bg-white/20 text-2xl font-bold shadow-inner">
              {profile?.full_name?.charAt(0).toUpperCase() || "V"}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wide">{profile?.full_name}</h1>
              <p className="text-xs font-medium text-purple-200">{profile?.email}</p>
              <span className="mt-1 inline-block rounded-full border border-purple-400/20 bg-purple-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-200">
                ✨ {profile?.role}
              </span>
            </div>
          </div>

          <div className="flex w-full justify-center space-x-4 md:w-auto">
            <div className="min-w-[110px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur-md">
              <span className="block text-[10px] font-bold uppercase text-purple-200">
                Articles Vendus
              </span>
              <span className="text-xl font-extrabold text-green-300">
                {stats.totalArticles} pcs
              </span>
            </div>
            <div className="min-w-[110px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur-md">
              <span className="block text-[10px] font-bold uppercase text-purple-200">
                Chiffre d&apos;Affaires
              </span>
              <span className="text-xl font-extrabold text-amber-300">
                {stats.totalCA.toFixed(2)} DT
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">📦 Mon Historique Personnel</h2>
            <p className="text-xs text-gray-400">
              Toutes vos transactions validées en magasin (Lecture seule)
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
            🔒 Sécurisé
          </span>
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center text-gray-400">
            Pas encore de vente enregistrée pour votre compte aujourd&apos;hui.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 font-bold uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Article</th>
                  <th className="px-4 py-3 text-center">Quantité</th>
                  <th className="px-4 py-3 text-right">Prix Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-gray-800">
                {history.map((sale) => (
                  <tr key={sale.id} className="transition-colors hover:bg-purple-50/30">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                      {formatDate(sale.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-bold text-purple-950">{sale.article_name}</span>
                      <span className="text-[10px] text-gray-400">Réf: {sale.reference}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-extrabold text-gray-600">
                      {sale.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-black text-gray-900">
                      {sale.total_price.toFixed(2)} DT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
