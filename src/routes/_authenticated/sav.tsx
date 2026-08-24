import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Undo2, DollarSign, CheckCircle2, XCircle, Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sav")({
  component: SAVPage,
});

const STATUS_META: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "text-amber-600 bg-amber-50 border-amber-200" },
  valide: { label: "Validé", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  refuse: { label: "Refusé", color: "text-red-600 bg-red-50 border-red-200" },
  rembourse: { label: "Remboursé", color: "text-blue-600 bg-blue-50 border-blue-200" },
  echange: { label: "Échangé", color: "text-purple-600 bg-purple-50 border-purple-200" },
};

const TYPE_META: Record<string, string> = {
  retour: "Retour",
  echange: "Échange",
  remboursement: "Remboursement",
};

function SAVPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    commande_id: "",
    client_name: "",
    client_phone: "",
    email: "",
    type: "retour",
    reason: "",
    amount: "",
  });

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("returns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: commandes = [] } = useQuery({
    queryKey: ["returns-commandes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commandes_livraison")
        .select("id, client_firstname, client_lastname, client_phone, client_email, total_price, items, delivery_status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = search.trim()
    ? returns.filter(
        (r: any) =>
          r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
          r.client_phone?.includes(search),
      )
    : returns;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Validation d'un retour : réinjecter le stock via RPC
      if (status === "valide") {
        const { error } = await supabase.rpc("valider_retour", { p_return_id: id });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("returns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande SAV mise à jour");
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["pos-articles"] });
      qc.invalidateQueries({ queryKey: ["pos-variantes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createReturn = async () => {
    if (form.type === "retour" && !form.commande_id) {
      toast.error("Sélectionnez une commande.");
      return;
    }
    const c = commandes.find((x: any) => x.id === form.commande_id);
    const items = c?.items ?? [];
    const amount =
      form.type === "remboursement"
        ? Number(form.amount) || Number(c?.total_price || 0)
        : 0;
    const { error } = await supabase.from("returns").insert([
      {
        commande_id: form.commande_id || null,
        client_name: form.client_name || `${c?.client_firstname || ""} ${c?.client_lastname || ""}`.trim(),
        client_phone: form.client_phone || c?.client_phone || "",
        email: form.email || c?.client_email || "",
        items,
        type: form.type,
        reason: form.reason,
        amount,
        status: "en_attente",
      },
    ]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande SAV créée");
    setShowForm(false);
    setForm({ commande_id: "", client_name: "", client_phone: "", email: "", type: "retour", reason: "", amount: "" });
    qc.invalidateQueries({ queryKey: ["returns"] });
  };

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10 bg-[#fbfbfa] min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#747878] font-bold">Back-office</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-black">
            SAV · Retours & Remboursements
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none w-52"
            />
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-black text-white hover:bg-gray-800 text-xs font-bold">
            <Plus className="h-4 w-4 mr-2" /> Nouvelle demande
          </Button>
        </div>
      </header>

      {/* FORMULAIRE */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-slate-400">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1 h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retour">Retour</SelectItem>
                  <SelectItem value="echange">Échange</SelectItem>
                  <SelectItem value="remboursement">Remboursement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-slate-400">Commande</Label>
              <Select
                value={form.commande_id}
                onValueChange={(v) => {
                  const c = commandes.find((x: any) => x.id === v);
                  setForm((p) => ({
                    ...p,
                    commande_id: v,
                    client_name: c ? `${c.client_firstname || ""} ${c.client_lastname || ""}`.trim() : p.client_name,
                    client_phone: c?.client_phone || p.client_phone,
                    email: c?.client_email || p.email,
                  }));
                }}
              >
                <SelectTrigger className="mt-1 h-9 text-xs bg-white"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {commandes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.client_firstname} {c.client_lastname} · {formatCurrency(Number(c.total_price || 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-slate-400">
                Montant remboursé {form.type === "remboursement" && "(si différent)"}
              </Label>
              <Input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0"
                className="mt-1 h-9 text-xs rounded-lg"
              />
            </div>
          </div>
          <Input
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            placeholder="Motif (ex : taille inadaptée, défaut...)"
            className="h-9 text-xs rounded-lg"
          />
          <div className="flex gap-2">
            <Button onClick={createReturn} className="bg-black text-white hover:bg-gray-800 text-xs">Créer</Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="text-xs">Annuler</Button>
          </div>
        </div>
      )}

      {/* LISTE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Aucune demande SAV.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Articles</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{r.client_name || "—"}</p>
                      <p className="text-[10px] text-slate-400">{r.client_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{TYPE_META[r.type] || r.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">
                        {Array.isArray(r.items) && r.items.length > 0
                          ? `${r.items[0].designation || "Article"}${r.items.length > 1 ? ` +${r.items.length - 1}` : ""}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium">
                      {r.amount > 0 ? formatCurrency(r.amount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_META[r.status]?.color || ""}`}>
                        {STATUS_META[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {r.status === "en_attente" && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-emerald-600" onClick={() => updateStatus.mutate({ id: r.id, status: "valide" })}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Valider (stock)
                            </Button>
                            {r.type === "remboursement" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-blue-600" onClick={() => updateStatus.mutate({ id: r.id, status: "rembourse" })}>
                                <DollarSign className="w-3 h-3 mr-1" /> Rembourser
                              </Button>
                            )}
                            {r.type === "echange" && (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-purple-600" onClick={() => updateStatus.mutate({ id: r.id, status: "echange" })}>
                                <RefreshCw className="w-3 h-3 mr-1" /> Échanger
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-red-600" onClick={() => updateStatus.mutate({ id: r.id, status: "refuse" })}>
                              <XCircle className="w-3 h-3 mr-1" /> Refuser
                            </Button>
                          </>
                        )}
                        {r.status === "valide" && r.type !== "remboursement" && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-blue-600" onClick={() => updateStatus.mutate({ id: r.id, status: "rembourse" })}>
                            <DollarSign className="w-3 h-3 mr-1" /> Rembourser
                          </Button>
                        )}
                      </div>
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
