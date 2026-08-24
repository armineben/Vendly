import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Download, ShoppingBag } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/ventes")({
  component: VentesPage,
});

function VentesPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, articles(designation, reference, categorie, image, images)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vente annulée, stock restauré");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function exportXlsx() {
    const rows = sales.map((s: any) => ({
      Date: formatDateTime(s.created_at),
      Article: s.articles?.designation,
      Référence: s.articles?.reference,
      Catégorie: s.articles?.categorie,
      Quantité: s.quantite,
      "Prix unitaire": Number(s.prix_unitaire),
      Total: Number(s.total),
      ...(isAdmin ? { Bénéfice: Number(s.benefice) } : {}),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventes");
    XLSX.writeFile(wb, `ventes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const totalCA = sales.reduce((s, r) => s + Number(r.total), 0);
  const totalPieces = sales.reduce((s, r) => s + Number(r.quantite), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Historique</p>
          <h1 className="mt-2 font-display text-4xl">Ventes</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sales.length} ventes · {totalPieces} pièces · {formatCurrency(totalCA)}
          </p>
        </div>
        <Button variant="outline" onClick={exportXlsx}>
          <Download className="mr-2 h-4 w-4" /> Exporter
        </Button>
      </header>

      {/* Conteneur corrigé avec overflow-hidden et border-collapse */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm border-collapse table-auto">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Article</th>
                <th className="px-4 py-3 text-center">Qté</th>
                <th className="px-4 py-3 text-right">Prix unitaire</th>
                <th className="px-4 py-3 text-right">Total</th>
                {isAdmin && <th className="px-4 py-3 text-right">Bénéfice</th>}
                {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sales.map((s: any) => (
                <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="h-10 w-10 rounded-lg overflow-hidden bg-zinc-100 border border-border">
                      {s.articles?.image || s.articles?.images?.[0] || s.items?.[0]?.image ? (
                        <img src={s.articles?.image || s.articles?.images?.[0] || s.items?.[0]?.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="h-4 w-4" /></div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.articles?.designation ?? s.items?.[0]?.designation ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{s.articles?.reference}</p>
                  </td>
                  <td className="px-4 py-3 text-center">{s.quantite}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(s.prix_unitaire)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.total)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right text-success">
                      {formatCurrency(s.benefice)}
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm("Annuler cette vente et restaurer le stock ?"))
                            cancel.mutate(s.id);
                        }}
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="px-4 py-16 text-center text-muted-foreground italic">
                    Aucune vente enregistrée pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}