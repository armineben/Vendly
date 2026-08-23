import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Plus, ShoppingBag, XCircle, Filter, ArrowRightLeft, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { checkExpiredReservations } from "@/lib/reservation-emails.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterDropdown } from "@/components/FilterDropdown";

export const Route = createFileRoute("/_authenticated/reservations")({
  component: ReservationsPage,
});

const STATUS_LABELS: Record<string, string> = {
  actif: "Actif",
  acheté: "Acheté",
  expiré: "Expiré",
};

const STATUS_COLORS: Record<string, string> = {
  actif: "text-emerald-600 bg-emerald-50 border-emerald-200",
  acheté: "text-blue-600 bg-blue-50 border-blue-200",
  expiré: "text-red-600 bg-red-50 border-red-200",
};

const DELAI_OPTIONS = [
  { value: "0", label: "Le jour même" },
  { value: "24", label: "24h" },
  { value: "48", label: "48h" },
  { value: "72", label: "72h" },
];

function getImageUrl(r: any): string | null {
  return r.articles?.image || (r.articles?.images?.[0]) || null;
}

function getExpirationInfo(r: any): { label: string; urgent: boolean; expiree: boolean } {
  const now = Date.now();
  const exp = new Date(r.date_expiration).getTime();
  const diff = exp - now;
  if (diff <= 0) return { label: "Expirée", urgent: false, expiree: true };
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return { label: "< 1h", urgent: true, expiree: false };
  if (hours < 24) return { label: `Dans ${hours}h`, urgent: true, expiree: false };
  const days = Math.floor(hours / 24);
  return { label: `Dans ${days}j`, urgent: false, expiree: false };
}

function ReservationsPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  // Vérification des réservations expirées à l'ouverture (admin)
  useEffect(() => {
    if (!isAdmin) return;
    checkExpiredReservations()
      .then((r) => {
        if (r.expired > 0) {
          toast.info(
            `${r.expired} réservation(s) expirée(s) : ${r.emailed} e-mail(s) de relance envoyé(s).`,
          );
        }
      })
      .catch(() => {});
  }, [isAdmin]);

  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [articleId, setArticleId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [dureeReservation, setDureeReservation] = useState("48");

  const { data: reservations = [] } = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, articles(reference, designation, prix_vente, prix_achat, image, images), profiles!created_by(display_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["articles-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, reference, designation, quantite, image, images")
        .eq("status", "actif")
        .order("designation");
      if (error) throw error;
      return data ?? [];
    },
  });

  function calcExpiration(): string {
    const d = new Date();
    const heures = Number(dureeReservation);
    if (heures > 0) d.setHours(d.getHours() + heures);
    return d.toISOString();
  }

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reservations").insert({
        article_id: articleId,
        client_name: clientName,
        client_phone: clientPhone,
        duree_heures: Number(dureeReservation),
        date_expiration: calcExpiration(),
        status: "actif",
        created_by: user?.id,
      });
      if (error) throw error;
      const article = await supabase.from("articles").select("quantite").eq("id", articleId).single();
      if (article.data && article.data.quantite > 0) {
        await supabase.from("articles").update({ quantite: article.data.quantite - 1 }).eq("id", articleId);
      }
    },
    onSuccess: () => {
      toast.success("Réservation créée");
      setShowForm(false);
      setArticleId("");
      setClientName("");
      setClientPhone("");
      setDureeReservation("48");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["articles-select"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });

  const convertToSale = useMutation({
    mutationFn: async (r: any) => {
      const article = r.articles;
      const prixAchat = Number(article?.prix_achat ?? 0);
      const prixVente = Number(article?.prix_vente ?? 0);
      const benefice = prixVente - prixAchat;
      const { error: saleError } = await supabase.from("sales").insert({
        article_id: r.article_id,
        quantite: 1,
        prix_unitaire: prixVente,
        total: prixVente,
        benefice,
        vendeur_id: user?.id,
        vendeur_nom: user?.user_metadata?.display_name || user?.email || null,
      });
      if (saleError) throw saleError;
      const { error: statusError } = await supabase.from("reservations").update({ status: "acheté" }).eq("id", r.id);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      toast.success("Réservation convertie en vente !");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!articleId || !clientName || !clientPhone) return;
    add.mutate();
  }

  const filteredReservations = useMemo(() => {
    if (statusFilter === "all") return reservations;
    return reservations.filter((r: any) => r.status === statusFilter);
  }, [reservations, statusFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Boutique</p>
          <h1 className="mt-2 font-display text-4xl">Réservations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reservations.length} réservation(s)
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(!showForm)} className="bg-accent text-accent-foreground hover:bg-accent-hover">
            <Plus className="mr-2 h-4 w-4" /> Nouvelle réservation
          </Button>
        )}
      </header>

      <div className="flex items-center gap-3">
        <FilterDropdown
          label="Statut"
          icon={Filter}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "Tous les statuts", icon: Filter },
            { value: "actif", label: "Actif" },
            { value: "acheté", label: "Acheté" },
            { value: "expiré", label: "Expiré" },
          ]}
        />
        <span className="text-xs text-zinc-400 font-medium">
          {filteredReservations.length} réservation(s)
        </span>
      </div>

      {showForm && (
        <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-[1fr,1fr,auto,auto]">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Article</Label>
            <Select value={articleId} onValueChange={setArticleId}>
              <SelectTrigger><SelectValue placeholder="Choisir un article" /></SelectTrigger>
              <SelectContent>
                {articles.filter(a => a.quantite > 0).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center gap-2">
                      {a.image && <img src={a.image} alt="" className="w-6 h-6 rounded object-cover" />}
                      {a.designation} ({a.reference})
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom &amp; Prénom</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Prénom et nom" required />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Téléphone</Label>
            <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+216 XX XXX XXX" required />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Délai de réservation</Label>
            <Select value={dureeReservation} onValueChange={setDureeReservation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELAI_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={add.isPending} className="w-full bg-accent text-accent-foreground hover:bg-accent-hover">
              <Plus className="mr-2 h-4 w-4" /> Créer
            </Button>
          </div>
        </form>
      )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm border-collapse table-auto">
              <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 w-12">Photo</th>
                  <th className="px-4 py-3">Article</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Téléphone</th>
                  {isAdmin && <th className="px-4 py-3">Vendeur</th>}
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3">Délai</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredReservations.map((r: any) => {
                  const expInfo = getExpirationInfo(r);
                  const imgUrl = getImageUrl(r);
                  return (
                  <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="h-10 w-10 rounded-lg overflow-hidden bg-zinc-100 border border-border">
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="h-4 w-4" /></div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.articles?.designation || "—"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.articles?.reference}</span>
                    </td>
                    <td className="px-4 py-3">{r.client_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.client_phone}</td>
                    {isAdmin && <td className="px-4 py-3 text-muted-foreground text-xs">{r.profiles?.display_name || "—"}</td>}
                    <td className="px-4 py-3">
                      <span className={`text-xs whitespace-nowrap ${expInfo.expiree ? "text-red-500 line-through" : expInfo.urgent ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                        {formatDateTime(r.date_expiration)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "actif" && (
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${expInfo.expiree ? "bg-red-50 text-red-600 border-red-200" : expInfo.urgent ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" : "bg-blue-50 text-blue-600 border-blue-200"}`}>
                          {expInfo.label}
                        </span>
                      )}
                      {r.status !== "actif" && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "actif" && (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => convertToSale.mutate(r)}
                            className="rounded-md p-2 text-emerald-600 hover:bg-emerald-50"
                            title="Convertir en vente"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => updateStatus.mutate({ id: r.id, status: "expiré" })}
                            className="rounded-md p-2 text-red-500 hover:bg-red-50"
                            title="Annuler la réservation"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {r.status === "acheté" && (
                        <span className="text-[10px] text-blue-500 font-medium">Vendu</span>
                      )}
                      {r.status === "expiré" && (
                        <span className="text-[10px] text-red-400">Annulé</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {filteredReservations.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} className="px-4 py-16 text-center text-muted-foreground italic">
                      Aucune réservation.
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
