import { useMemo, useRef, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingBag,
  Calendar,
  Truck,
  TrendingUp,
  Wallet,
  Package,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/historique")({
  component: HistoriquePage,
});

type Operation = {
  id: string;
  type: "vente" | "réservation" | "livraison";
  date: string;
  article: string;
  client: string;
  montant: number;
  vendeur: string;
  status: string;
};

const TYPE_CONFIG = {
  vente: {
    icon: ShoppingBag,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    label: "Vente",
  },
  réservation: {
    icon: Calendar,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    label: "Réservation",
  },
  livraison: {
    icon: Truck,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    label: "Livraison",
  },
};

// ─── Dropdown partagé ──────────────────────────────────────────

function Dropdown({
  trigger,
  children,
  className = "",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-zinc-100 bg-white p-1.5 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────

function HistoriquePage() {
  const { user, isAdmin } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<string>("");

  // ── Query ──────────────────────────────────────────────────
  const { data: users = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["historique", selectedUserId],
    queryFn: async () => {
      const uid = isAdmin
        ? selectedUserId === "all"
          ? null
          : selectedUserId
        : user?.id;

      const results: Operation[] = [];

      const fetchSales = supabase
        .from("sales")
        .select(
          "id, created_at, total, quantite, vendeur_id, vendeur_nom, articles(designation, reference)"
        )
        .order("created_at", { ascending: false });
      if (uid) fetchSales.eq("vendeur_id", uid);

      const { data: sales } = await fetchSales;
      if (sales) {
        for (const s of sales) {
          results.push({
            id: s.id,
            type: "vente",
            date: s.created_at,
            article: `${s.articles?.[0]?.designation || ""} x${s.quantite}`,
            client: s.vendeur_nom || s.vendeur_id?.slice(0, 8) || "—",
            montant: Number(s.total),
            vendeur: s.vendeur_nom || "—",
            status: "complete",
          });
        }
      }

      let fetchReservations = supabase
        .from("reservations")
        .select(
          "id, created_at, client_name, status, articles(designation, reference), profiles(display_name)"
        )
        .order("created_at", { ascending: false });
      if (uid) fetchReservations.eq("created_by", uid);

      const { data: reservations } = await fetchReservations;
      if (reservations) {
        for (const r of reservations) {
          results.push({
            id: r.id,
            type: "réservation",
            date: r.created_at,
            article: r.articles?.[0]?.designation || "—",
            client: r.client_name,
            montant: 0,
            vendeur: r.profiles?.[0]?.display_name || "—",
            status: r.status,
          });
        }
      }

      let fetchCommandes = supabase
        .from("commandes_livraison")
        .select(
          "id, created_at, client_firstname, client_lastname, total_price, delivery_status, articles(designation, reference), profiles(display_name)"
        )
        .order("created_at", { ascending: false });
      if (uid) fetchCommandes.eq("created_by", uid);

      const { data: commandes } = await fetchCommandes;
      if (commandes) {
        for (const c of commandes) {
          results.push({
            id: c.id,
            type: "livraison",
            date: c.created_at,
            article: c.articles?.[0]?.designation || "—",
            client: `${c.client_firstname} ${c.client_lastname}`,
            montant: Number(c.total_price),
            vendeur: c.profiles?.[0]?.display_name || "—",
            status: c.delivery_status,
          });
        }
      }

      results.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return results;
    },
    enabled: !!user,
  });

  // ── Filtre date client-side ────────────────────────────────
  const filteredOps = useMemo(() => {
    if (dateFilter === "all") return operations;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let minDate: string;
    let maxDate: string | undefined;

    switch (dateFilter) {
      case "today":
        minDate = todayStr;
        maxDate = todayStr;
        break;
      case "month":
        minDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        maxDate = todayStr;
        break;
      case "year":
        minDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
        maxDate = undefined;
        break;
      default:
        if (dateFilter.startsWith("custom:")) {
          minDate = dateFilter.replace("custom:", "");
          maxDate = minDate;
        } else {
          return operations;
        }
    }

    return operations.filter((op) => {
      const d = op.date.slice(0, 10);
      if (d < minDate) return false;
      if (maxDate && d > maxDate) return false;
      return true;
    });
  }, [operations, dateFilter]);

  // ── Regroupement ───────────────────────────────────────────
  const groupedByDay = useMemo(() => {
    const groups: Record<string, Operation[]> = {};
    for (const op of filteredOps) {
      const day = op.date.slice(0, 10);
      if (!groups[day]) groups[day] = [];
      groups[day].push(op);
    }
    return groups;
  }, [filteredOps]);

  const daySummaries = useMemo(
    () =>
      Object.entries(groupedByDay).map(([day, ops]) => ({
        day,
        total: ops.reduce((s, o) => s + o.montant, 0),
        count: ops.length,
        ventes: ops.filter((o) => o.type === "vente").length,
        reservations: ops.filter((o) => o.type === "réservation").length,
        livraisons: ops.filter((o) => o.type === "livraison").length,
      })),
    [groupedByDay]
  );

  // ── Libellé du filtre date ────────────────────────────────
  const dateLabel = useMemo(() => {
    switch (dateFilter) {
      case "all":
        return "📅 Toutes les dates";
      case "today":
        return "📅 Aujourd'hui";
      case "month":
        return "📅 Ce mois-ci";
      case "year":
        return "📅 Cette année";
      default:
        if (dateFilter.startsWith("custom:")) {
          const d = dateFilter.replace("custom:", "");
          return `📅 ${new Date(d + "T00:00:00").toLocaleDateString("fr-FR")}`;
        }
        return "📅 Filtrer par date";
    }
  }, [dateFilter]);

  // ── Exports ────────────────────────────────────────────────
  function exportData(format: "excel" | "csv" | "pdf") {
    const rows = filteredOps.map((op) => ({
      Date: new Date(op.date).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      Type: TYPE_CONFIG[op.type].label,
      Utilisateur: op.vendeur,
      Détails: `${op.article} — ${op.client}`,
      Montant: op.montant > 0 ? formatCurrency(op.montant) : "—",
      Statut: op.status,
    }));

    const headers = ["Date", "Type", "Utilisateur", "Détails", "Montant", "Statut"];

    if (format === "excel") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historique");
      XLSX.writeFile(wb, `historique_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else if (format === "csv") {
      const csv = [
        headers.join(";"),
        ...rows.map((r) =>
          [r.Date, r.Type, r.Utilisateur, r.Détails, r.Montant, r.Statut]
            .map((v) => `"${v.replace(/"/g, '""')}"`)
            .join(";")
        ),
      ].join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historique_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text("Historique des opérations", 14, 20);
      doc.setFontSize(9);
      doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 27);
      (doc as any).autoTable({
        startY: 32,
        head: [headers],
        body: rows.map((r) => [r.Date, r.Type, r.Utilisateur, r.Détails, r.Montant, r.Statut]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [9, 20, 38] },
      });
      doc.save(`historique_${new Date().toISOString().slice(0, 10)}.pdf`);
    }
  }

  const exportLabel = "📥 Exporter les données";

  // ── Rendu ──────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">
            Activité
          </p>
          <h1 className="mt-2 font-display text-4xl">Historique</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {filteredOps.length} opération(s)
          </p>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="w-44">
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les utilisateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date filter dropdown */}
          <Dropdown trigger={
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-300">
              <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
              <span className="truncate">{dateLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform" />
            </div>
          }>
            {[
              { value: "all", label: "Toutes les dates" },
              { value: "today", label: "Aujourd'hui" },
              { value: "month", label: "Ce mois-ci" },
              { value: "year", label: "Cette année" },
              { value: "custom", label: "Choisir une date..." },
            ].map((opt) => (
              <div key={opt.value}>
                <button
                  onClick={() => {
                    if (opt.value === "custom") {
                      setDateFilter("custom:" + (customDate || new Date().toISOString().slice(0, 10)));
                    } else {
                      setDateFilter(opt.value);
                    }
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors ${
                    (opt.value === "custom"
                      ? dateFilter.startsWith("custom:")
                      : dateFilter === opt.value)
                      ? "bg-orange-50 text-orange-700"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
                {opt.value === "custom" && (
                  <div className="px-3 pb-2 pt-1">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => {
                        setCustomDate(e.target.value);
                        if (e.target.value) setDateFilter("custom:" + e.target.value);
                      }}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </Dropdown>

          {/* Export dropdown */}
          <Dropdown trigger={
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-300">
              <TrendingUp className="h-4 w-4 text-zinc-400 shrink-0" />
              <span className="truncate">{exportLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform" />
            </div>
          }>
            {[
              { value: "excel", label: "📄 Fichier Excel (.xlsx)" },
              { value: "csv", label: "📊 Fichier CSV (.csv)" },
              { value: "pdf", label: "📕 Document PDF (.pdf)" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => exportData(opt.value as "excel" | "csv" | "pdf")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-left text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </Dropdown>
        </div>
      </header>

      {isLoading && (
        <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">
          Chargement de l'historique...
        </div>
      )}

      {!isLoading && filteredOps.length === 0 && (
        <div className="py-20 text-center text-sm text-muted-foreground italic">
          Aucune opération trouvée pour cette période.
        </div>
      )}

      {daySummaries.map((summary) => (
        <section key={summary.day}>
          <div className="sticky top-0 z-10 -mx-6 -mt-3 mb-4 rounded-xl bg-white/90 px-6 py-4 backdrop-blur-md shadow-xs border border-border/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">
                {new Date(summary.day + "T00:00:00").toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <div className="flex flex-wrap gap-3 text-xs font-medium">
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 border border-emerald-200">
                  <ShoppingBag className="h-3 w-3" /> {summary.ventes} vente(s)
                </span>
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700 border border-blue-200">
                  <Calendar className="h-3 w-3" /> {summary.reservations}{" "}
                  réservation(s)
                </span>
                <span className="flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-purple-700 border border-purple-200">
                  <Truck className="h-3 w-3" /> {summary.livraisons}{" "}
                  livraison(s)
                </span>
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-700 border border-amber-200">
                  <Wallet className="h-3 w-3" /> {formatCurrency(summary.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pl-8">
            {groupedByDay[summary.day].map((op) => {
              const cfg = TYPE_CONFIG[op.type];
              const Icon = cfg.icon;
              return (
                <div key={`${op.type}-${op.id}`} className="relative flex gap-4 pb-2 group">
                  <div className="absolute left-[-16px] top-[18px] bottom-0 w-px bg-border/40 group-last:hidden" />
                  <div
                    className={`relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${cfg.color}`}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 rounded-xl border border-border/40 bg-card px-4 py-3 shadow-xs transition-colors hover:bg-secondary/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        <span className="truncate font-medium text-sm">
                          {op.article}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        <span>{op.client}</span>
                        {op.montant > 0 && (
                          <span className="font-semibold text-foreground">
                            {formatCurrency(op.montant)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {new Date(op.date).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isAdmin && (
                        <span>
                          Vendeur :{" "}
                          <span className="font-medium text-foreground/70">
                            {op.vendeur}
                          </span>
                        </span>
                      )}
                      {op.type !== "vente" && (
                        <span className="italic">Statut : {op.status}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
