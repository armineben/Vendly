import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/depenses")({
  component: DepensesPage,
});

function DepensesPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [motif, setMotif] = useState("");
  const [montant, setMontant] = useState<number | "">("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        motif,
        montant: Number(montant),
        date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dépense enregistrée");
      setMotif("");
      setMontant("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const total = expenses.reduce((s, e) => s + Number(e.montant), 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!motif || !montant) return;
    add.mutate();
  }

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-10">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Comptabilité</p>
        <h1 className="mt-2 font-display text-4xl">Dépenses</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Total des dépenses : <span className="text-foreground">{formatCurrency(total)}</span>
        </p>
      </header>

      <form
        onSubmit={submit}
        className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-[2fr,1fr,1fr,auto]"
      >
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Motif</Label>
          <Input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. Loyer, électricité, achats fournisseur…"
            required
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant (TND)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value === "" ? "" : Number(e.target.value))}
            required
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={add.isPending}
            className="w-full bg-accent text-accent-foreground hover:bg-accent-hover"
          >
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
        </div>
      </form>

      {/* Conteneur verrouillé pour éviter l'effet capsule */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm border-collapse table-auto [&_th]:rounded-none [&_td]:rounded-none">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 font-medium">{e.motif}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(e.montant)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Supprimer cette dépense ?")) del.mutate(e.id);
                      }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-muted-foreground italic">
                    Aucune dépense enregistrée.
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