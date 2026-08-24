import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Truck, Filter, Search, Download, CheckCheck,
  XCircle, RotateCcw, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  FileText, CreditCard, Eye, Package, MapPin, Phone, User, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterDropdown } from "@/components/FilterDropdown";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/commandes-livraison")({
  component: CommandesLivraisonPage,
});

const STATUS_PIPELINE = ["prepared", "shipped", "in_transit", "delivered", "paid"] as const;
type DeliveryStatus = (typeof STATUS_PIPELINE)[number] | "cancelled" | "returned";

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  prepared:   { label: "Préparée",        color: "text-emerald-700 bg-emerald-50 border-emerald-300",  icon: "🟢" },
  shipped:    { label: "Envoyée",         color: "text-blue-700 bg-blue-50 border-blue-300",           icon: "🔵" },
  in_transit: { label: "En cours",        color: "text-amber-700 bg-amber-50 border-amber-300",        icon: "🟡" },
  delivered:  { label: "Livrée",          color: "text-purple-700 bg-purple-50 border-purple-300",     icon: "🟣" },
  paid:       { label: "Payée",           color: "text-emerald-700 bg-emerald-50 border-emerald-300",  icon: "💵" },
  cancelled:  { label: "Annulée",         color: "text-red-700 bg-red-50 border-red-200",              icon: "❌" },
  returned:   { label: "Retournée",       color: "text-orange-700 bg-orange-50 border-orange-300",     icon: "🔙" },
};

const COURIER_OPTIONS = [
  "First Delivery",
  "Droppex Tunisie",
  "INTIGO",
  "ADEX TN",
  "Navex Delivery",
  "Aramex",
  "Autre",
];

function CommandesLivraisonPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [courierFilter, setCourierFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [editDelivery, setEditDelivery] = useState<any>(null);
  const [editCourier, setEditCourier] = useState("");
  const [editCourierOther, setEditCourierOther] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // ── Queries ──────────────────────────────────────────────────

  const { data: commandes = [] } = useQuery({
    queryKey: ["commandes-livraison-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commandes_livraison")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Realtime : actualisation en direct des commandes ─────────
  useEffect(() => {
    const sub = supabase
      .channel("commandes-livraison-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "commandes_livraison",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [qc]);

  // ── Derived stats ────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = commandes.length;
    const pendingPay = commandes.filter((c: any) => c.delivery_status === "delivered").reduce((s: number, c: any) => s + Number(c.total_price), 0);
    const paidCount = commandes.filter((c: any) => c.delivery_status === "paid").length;
    const cancelledCount = commandes.filter((c: any) => c.delivery_status === "cancelled").length;
    const successRate = total - cancelledCount > 0 ? ((total - cancelledCount) / total * 100).toFixed(1) : "0";
    return { total, pendingPay, paidCount, cancelledCount, successRate };
  }, [commandes]);

  // ── Filters ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = commandes;
    if (statusFilter !== "all") list = list.filter((c: any) => c.delivery_status === statusFilter);
    if (courierFilter !== "all") list = list.filter((c: any) => c.courier_company === courierFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) =>
        c.client_firstname?.toLowerCase().includes(q) ||
        c.client_lastname?.toLowerCase().includes(q) ||
        c.client_phone?.includes(q) ||
        c.client_address?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [commandes, statusFilter, courierFilter, searchQuery]);

  const courierCompanies = useMemo(() => {
    const set = new Set<string>();
    commandes.forEach((c: any) => { if (c.courier_company) set.add(c.courier_company); });
    return Array.from(set).sort();
  }, [commandes]);

  // ── Mutations ────────────────────────────────────────────────

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Si marquée "paid" (fonds reçus) : récupérer la commande pour créer la vente
      let commande: any = null;
      if (status === "paid") {
        const { data } = await supabase
          .from("commandes_livraison")
          .select("*")
          .eq("id", id)
          .single();
        commande = data;
      }

      const { error } = await supabase.rpc("update_delivery_status", {
        p_id: id,
        p_status: status,
      });
      if (error) throw error;

      // Fonds reçus de la société de livraison → enregistrer la vente dans sales
      if (commande) {
        const items = Array.isArray(commande.items) ? commande.items : [];
        const { error: saleError } = await supabase.from("sales").insert([
          {
            items,
            total: Number(commande.total_price || 0),
            customer_name:
              `${commande.client_firstname || ""} ${commande.client_lastname || ""}`.trim() ||
              "Client livraison",
            customer_phone: commande.client_phone || "",
            payment_method: commande.payment_method || "especes",
            statut: "validee",
          },
        ]);
        if (saleError && saleError.code !== "42703") throw saleError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Statut mis à jour");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkPay = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) throw new Error("Aucune commande sélectionnée");
      for (const id of ids) {
        const { data } = await supabase
          .from("commandes_livraison")
          .select("*")
          .eq("id", id)
          .single();
        const { error } = await supabase.rpc("update_delivery_status", {
          p_id: id,
          p_status: "paid",
        });
        if (error) throw error;
        if (data) {
          const items = Array.isArray(data.items) ? data.items : [];
          const { error: saleError } = await supabase.from("sales").insert([
            {
              items,
              total: Number(data.total_price || 0),
              customer_name:
                `${data.client_firstname || ""} ${data.client_lastname || ""}`.trim() ||
                "Client livraison",
              customer_phone: data.client_phone || "",
              payment_method: data.payment_method || "especes",
              statut: "validee",
            },
          ]);
          if (saleError && saleError.code !== "42703") throw saleError;
        }
      }
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} commande(s) marquée(s) payée(s)`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-sales"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkHold = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      for (const id of ids) {
        const { error } = await supabase.rpc("update_delivery_status", { p_id: id, p_status: "en_attente" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} commande(s) mise(s) en attente`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      if (!confirm(`Supprimer définitivement ${ids.length} commande(s) ?`)) throw new Error("Annulé");
      for (const id of ids) {
        const { error } = await supabase.from("commandes_livraison").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Commande(s) supprimée(s)");
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] });
    },
    onError: (e: any) => { if (e.message !== "Annulé") toast.error(e.message); },
  });

  const cancelDelivery = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("update_delivery_status", { p_id: id, p_status: "cancelled" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Livraison annulée — stock réintégré");
      qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateDelivery = useMutation({
    mutationFn: async ({ id, courier_company, courier_notes }: { id: string; courier_company: string; courier_notes: string }) => {
      const { error } = await supabase.from("commandes_livraison").update({ courier_company, courier_notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Livraison mise à jour");
      setEditDelivery(null);
      qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commandes_livraison").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commandes-livraison-v2"] }),
  });

  // ── PDF Generation ───────────────────────────────────────────

  function generatePdf(c: any) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("BORDEREAU DE LIVRAISON", 14, 20);
    doc.setFontSize(10);
    doc.text(`N° commande : ${c.id?.slice(0, 8)}`, 14, 30);
    doc.text(`Date : ${formatDateTime(c.created_at)}`, 14, 36);

    doc.setFontSize(12);
    doc.text("CLIENT", 14, 48);
    doc.setFontSize(10);
    doc.text(`${c.client_firstname} ${c.client_lastname}`, 14, 56);
    doc.text(`Tél : ${c.client_phone}`, 14, 62);
    doc.text(`Adresse : ${c.client_address}`, 14, 68);
    if (c.client_city) doc.text(`Ville : ${c.client_city}`, 14, 74);
    if (c.client_governorate) doc.text(`Gouvernorat : ${c.client_governorate}`, 14, 80);
    if (c.courier_notes) doc.text(`Remarques : ${c.courier_notes}`, 14, 86);

    doc.setFontSize(12);
    doc.text("ARTICLES", 14, 98);
    const rows = (c.items || []).map((item: any, i: number) => [
      i + 1,
      item.designation || "",
      item.taille || "TU",
      item.couleur || "",
      item.quantite || 1,
      `${Number(item.prix_unitaire || 0).toFixed(2)} TND`,
    ]);
    autoTable(doc, {
      startY: 104,
      head: [["#", "Article", "Taille", "Couleur", "Qté", "Prix unit."]],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 24, 27] },
    });
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text(`Montant total à encaisser : ${formatCurrency(c.total_price)}`, 14, finalY);
    if (c.shipping_fees > 0) doc.text(`Frais de livraison : ${formatCurrency(c.shipping_fees)}`, 14, finalY + 6);

    doc.setFontSize(8);
    doc.text("Vendly — Document généré automatiquement", 14, finalY + 20);
    doc.save(`livraison-${c.id?.slice(0, 8)}.pdf`);
    toast.success("Bordereau PDF généré");
  }

  // ── Calendar helpers ─────────────────────────────────────────

  const calendarData = useMemo(() => {
    const byDate: Record<string, any[]> = {};
    commandes.forEach((c: any) => {
      const key = c.created_at?.slice(0, 10);
      if (key) {
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(c);
      }
    });
    return byDate;
  }, [commandes]);

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const monthName = new Date(calendarYear, calendarMonth).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // ── Render ───────────────────────────────────────────────────

  const needsPaymentInfo = filtered.filter((c: any) => c.delivery_status === "delivered");

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Logistique</p>
          <h1 className="mt-2 font-display text-4xl">Gestion des livraisons</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {stats.total} commandes · {stats.paidCount} payées · {stats.cancelledCount} annulées
            · Taux réussite {stats.successRate}%
          </p>
        </div>
      </header>

      {/* ── Stats cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Encaissements en attente</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{formatCurrency(stats.pendingPay)}</p>
          <p className="text-[10px] text-muted-foreground">Chez les livreurs</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Taux de réussite</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.successRate}%</p>
          <p className="text-[10px] text-muted-foreground">{stats.total - stats.cancelledCount}/{stats.total} livraisons</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">En cours</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {commandes.filter((c: any) => ["prepared","shipped","in_transit"].includes(c.delivery_status)).length}
          </p>
          <p className="text-[10px] text-muted-foreground">Non encore livrées</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Payées ce mois</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {commandes.filter((c: any) => {
              if (c.delivery_status !== "paid" || !c.paid_at) return false;
              const d = new Date(c.paid_at);
              return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
            }).length}
          </p>
          <p className="text-[10px] text-muted-foreground">Comptabilisées en CA</p>
        </div>
      </div>

      {/* ── Filters + Actions ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher client, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterDropdown
          label="Statut"
          icon={Filter}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "Tous", icon: Filter },
            ...STATUS_PIPELINE.map((s) => ({ value: s, label: STATUS_META[s].label, icon: Filter })),
            { value: "cancelled", label: "Annulée", icon: Filter },
          ]}
        />
        <Select value={courierFilter} onValueChange={setCourierFilter}>
          <SelectTrigger className="w-[200px] h-9 text-xs bg-white">
            <Truck className="h-3.5 w-3.5 mr-2" />
            <SelectValue placeholder="Transporteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les transporteurs</SelectItem>
            {COURIER_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowCalendar(!showCalendar)}>
          <CalendarIcon className="h-4 w-4 mr-2" /> Calendrier
        </Button>
        {selectedIds.size > 0 && (
          <>
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => bulkPay.mutate()} disabled={bulkPay.isPending}>
              <CreditCard className="h-4 w-4 mr-2" /> Marquer payées ({selectedIds.size})
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkHold.mutate()} disabled={bulkHold.isPending} className="border-amber-300 text-amber-700 bg-white">
              <Clock className="h-4 w-4 mr-2" /> Mettre en attente ({selectedIds.size})
            </Button>
            <Button size="sm" variant="destructive" onClick={() => bulkDelete.mutate()} disabled={bulkDelete.isPending} className="bg-red-600 text-white hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" /> Supprimer ({selectedIds.size})
            </Button>
          </>
        )}
        <span className="text-xs text-zinc-400 font-medium ml-auto">
          {filtered.length} commande(s)
        </span>
      </div>

      {/* ── Calendar ─────────────────────────────────────────── */}
      {showCalendar && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider">
              <CalendarIcon className="h-4 w-4 inline mr-2" />
              {monthName}
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear((y) => y - 1); } else { setCalendarMonth((m) => m - 1); } }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear((y) => y + 1); } else { setCalendarMonth((m) => m + 1); } }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"].map((d) => (
              <div key={d} className="py-2 font-bold text-muted-foreground uppercase tracking-wider">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="py-3" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayData = calendarData[dateStr];
              const isToday = dateStr === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={day}
                  className={`py-3 rounded-lg text-sm relative ${isToday ? "ring-2 ring-black font-bold" : "hover:bg-secondary/50"}`}
                >
                  <span>{day}</span>
                  {dayData && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayData.some((c: any) => c.delivery_status === "paid") && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {dayData.some((c: any) => c.delivery_status === "delivered") && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                      {dayData.some((c: any) => c.delivery_status === "shipped") && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {needsPaymentInfo.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-bold text-amber-600 mb-2">
                En attente de paiement livreur ({formatCurrency(stats.pendingPay)}) :
              </p>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {needsPaymentInfo.slice(0, 10).map((c: any) => (
                  <p key={c.id} className="text-xs text-muted-foreground">
                    {c.client_firstname} {c.client_lastname} — {formatCurrency(c.total_price)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm border-collapse table-auto">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              <tr>
                {isAdmin && <th className="px-3 py-3 w-8"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelectedIds(new Set(filtered.filter((c: any) => c.delivery_status === "delivered").map((c: any) => c.id))); else setSelectedIds(new Set()); }} checked={selectedIds.size > 0 && filtered.filter((c: any) => c.delivery_status === "delivered").every((c: any) => selectedIds.has(c.id))} className="accent-black" /></th>}
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Adresse</th>
                <th className="px-3 py-3">Articles</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3">Livreur</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((c: any) => {
                const items = typeof c.items === "string" ? JSON.parse(c.items) : (c.items || []);
                const itemsCount = Array.isArray(items) ? items.reduce((s: number, i: any) => s + Number(i.quantite || 1), 0) : 1;
                const meta = STATUS_META[c.delivery_status] || STATUS_META.prepared;
                return (
                  <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                    {isAdmin && (
                      <td className="px-3 py-3">
                        {c.delivery_status === "delivered" ? (
                          <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => setSelectedIds((prev) => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })} className="accent-black" />
                        ) : null}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <Select
                        value={c.delivery_status}
                        onValueChange={(v) => {
                          if (v === "cancelled" || v === "returned") {
                            const msg = v === "returned"
                              ? "Marquer comme retournée ? Stock réintégré + frais de retour 5 DT."
                              : "Annuler cette livraison ? Le stock sera réintégré automatiquement.";
                            if (confirm(msg)) {
                              const fn = v === "returned" ? (id: string) => updateStatus.mutate({ id, status: "returned" }) : cancelDelivery.mutate;
                              fn(c.id);
                            }
                            return;
                          }
                          updateStatus.mutate({ id: c.id, status: v });
                        }}
                      >
                        <SelectTrigger className={`h-7 border px-2 py-0 text-xs font-medium rounded-md ${meta.color}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_PIPELINE.filter((s) => {
                            const idx = STATUS_PIPELINE.indexOf(c.delivery_status);
                            const targetIdx = STATUS_PIPELINE.indexOf(s);
                            return targetIdx >= idx && targetIdx <= idx + 1;
                          }).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                          ))}
                          {c.delivery_status !== "cancelled" && c.delivery_status !== "paid" && c.delivery_status !== "returned" && (
                            <>
                              <SelectItem value="cancelled" className="text-red-600">Annuler</SelectItem>
                              <SelectItem value="returned" className="text-orange-600">Retournée (5 DT)</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-xs">{c.client_firstname} {c.client_lastname}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {c.client_phone}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-[200px]" title={c.client_address}>
                      <div className="text-xs truncate flex items-start gap-1">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                        <span>{c.client_address}</span>
                      </div>
                      {(c.client_city || c.client_governorate) && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {c.client_city}{c.client_city && c.client_governorate ? " · " : ""}{c.client_governorate}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs font-medium">{itemsCount} pièce(s)</div>
                      {Array.isArray(items) && items.slice(0, 2).map((item: any, i: number) => (
                        <div key={i} className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                          {item.designation}
                          {item.taille && ` (${item.taille})`}
                        </div>
                      ))}
                      {Array.isArray(items) && items.length > 2 && <div className="text-[10px] text-muted-foreground">+{items.length - 2} autre(s)</div>}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">{formatCurrency(c.total_price)}</td>
                    <td className="px-3 py-3 text-[10px] text-muted-foreground">
                      {c.payment_method === "card" ? "Carte" : c.payment_method === "especes" ? "Especes" : c.payment_method || "--"}
                    </td>
                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <button
                          onClick={() => { setEditDelivery(c); setEditCourier(COURIER_OPTIONS.includes(c.courier_company) ? c.courier_company : "Autre"); setEditCourierOther(COURIER_OPTIONS.includes(c.courier_company) ? "" : c.courier_company || ""); setEditNotes(c.courier_notes || ""); }}
                          className="text-xs underline-offset-2 hover:underline decoration-dotted text-left"
                        >
                          {c.courier_company ? (
                            <span className="text-xs">{c.courier_company}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">Définir</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs">{c.courier_company || "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{formatDateTime(c.created_at)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => generatePdf(c)} className="rounded-md p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50" title="Bordereau PDF">
                          <FileText className="h-4 w-4" />
                        </button>
                        {isAdmin && c.delivery_status !== "paid" && c.delivery_status !== "cancelled" && (
                          <button onClick={() => { if (confirm("Annuler cette livraison ? Le stock sera réintégré.")) cancelDelivery.mutate(c.id); }} className="rounded-md p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Annuler / Retour">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => { if (confirm("Supprimer définitivement ?")) del.mutate(c.id); }} className="rounded-md p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Supprimer">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-16 text-center text-muted-foreground italic">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Aucune commande livraison trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer info ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[10px] text-muted-foreground">
        {STATUS_PIPELINE.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={STATUS_META[s].color.split(" ")[0]}>{STATUS_META[s].icon}</span>
            <span>{STATUS_META[s].label}</span>
            <span className="font-medium">({commandes.filter((c: any) => c.delivery_status === s).length})</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-red-600">❌</span>
          <span>Annulée</span>
          <span className="font-medium">({commandes.filter((c: any) => c.delivery_status === "cancelled").length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-orange-600">🔙</span>
          <span>Retournée</span>
          <span className="font-medium">({commandes.filter((c: any) => c.delivery_status === "returned").length})</span>
        </div>
      </div>

      {/* ── Edit delivery dialog ─────────────────────────────── */}
      <Dialog open={!!editDelivery} onOpenChange={(o) => { if (!o) setEditDelivery(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la livraison</DialogTitle>
          </DialogHeader>
          {editDelivery && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Société de livraison</Label>
                <Select value={editCourier} onValueChange={(v) => setEditCourier(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURIER_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editCourier === "Autre" && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom du transporteur</Label>
                  <Input value={editCourierOther} onChange={(e) => setEditCourierOther(e.target.value)} placeholder="Saisir le nom..." />
                </div>
              )}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Remarques</Label>
                <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes interne..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditDelivery(null)}>Annuler</Button>
                <Button onClick={() => {
                  const company = editCourier === "Autre" ? editCourierOther.trim() : editCourier;
                  if (!company) { toast.error("Veuillez sélectionner ou saisir un transporteur"); return; }
                  updateDelivery.mutate({ id: editDelivery.id, courier_company: company, courier_notes: editNotes });
                }} disabled={updateDelivery.isPending}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
