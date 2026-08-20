import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShoppingBag,
  Package,
  Users as UsersIcon,
  Receipt,
  FileText,
  FileSpreadsheet,
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/rapports")({
  component: RapportsPage,
});

type DataKind = "ventes" | "stock" | "depenses";
type Period = "jour" | "mois" | "annee";

function startOfPeriod(p: Period): Date {
  const d = new Date();
  if (p === "jour") {
    d.setHours(0, 0, 0, 0);
  } else if (p === "mois") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function periodLabel(p: Period): string {
  const now = new Date();
  if (p === "jour") return formatDate(now);
  if (p === "mois")
    return now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return String(now.getFullYear());
}

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(";")),
  ].join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function RapportsPage() {
  const { isAdmin, loading } = useAuth();
  const [kind, setKind] = useState<DataKind>("ventes");
  const [period, setPeriod] = useState<Period>("jour");

  const since = useMemo(() => startOfPeriod(period).toISOString(), [period]);

  const sales = useQuery({
    queryKey: ["report-sales", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, created_at, quantite, prix_unitaire, total, benefice, article_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const articles = useQuery({
    queryKey: ["report-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, reference, designation, categorie, taille, couleur, quantite, prix_achat, prix_vente, emplacement");
      if (error) throw error;
      return data ?? [];
    },
  });

  const variantes = useQuery({
    queryKey: ["report-variantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variantes")
        .select("article_id, stock");
      if (error) throw error;
      return data ?? [];
    },
  });

  const expenses = useQuery({
    queryKey: ["report-expenses", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, date, motif, montant, created_at")
        .gte("created_at", since)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/catalogue" />;

  const totalCA = (sales.data ?? []).reduce((s, r) => s + Number(r.total), 0);
  const totalBenef = (sales.data ?? []).reduce((s, r) => s + Number(r.benefice), 0);
  const txCount = (sales.data ?? []).length;
  const panierMoyen = txCount ? totalCA / txCount : 0;

  // Stock combiné (variantes + article.quantite)
  const stockParArticle = new Map<string, number>();
  (articles.data ?? []).forEach(a => stockParArticle.set(a.id, Number(a.quantite) || 0));
  (variantes.data ?? []).forEach(v => {
    const current = stockParArticle.get(v.article_id) ?? 0;
    stockParArticle.set(v.article_id, current + Number(v.stock || 0));
  });

  const stockValue = (articles.data ?? []).reduce(
    (s, a) => s + (stockParArticle.get(a.id) || 0) * Number(a.prix_vente),
    0,
  );
  const piecesStock = (articles.data ?? []).reduce((s, a) => s + (stockParArticle.get(a.id) || 0), 0);
  const totalDepenses = (expenses.data ?? []).reduce((s, e) => s + Number(e.montant), 0);

  const buildRows = (): { rows: Record<string, any>[]; base: string } => {
    if (kind === "ventes") {
      const articleMap = new Map((articles.data ?? []).map((a) => [a.id, a]));
      return {
        base: `ventes_${period}`,
        rows: (sales.data ?? []).map((s) => {
          const a = articleMap.get(s.article_id);
          return {
            Date: formatDate(s.created_at),
            Référence: a?.reference ?? "",
            Article: a?.designation ?? "",
            Catégorie: a?.categorie ?? "",
            Quantité: s.quantite,
            "Prix unitaire (TND)": Number(s.prix_unitaire).toFixed(3),
            "Total (TND)": Number(s.total).toFixed(3),
            "Bénéfice (TND)": Number(s.benefice).toFixed(3),
          };
        }),
      };
    }
    if (kind === "stock") {
      return {
        base: `stock_${new Date().toISOString().slice(0, 10)}`,
        rows: (articles.data ?? []).map((a) => {
          const qte = stockParArticle.get(a.id) || 0;
          return {
            Référence: a.reference,
            Désignation: a.designation,
            Catégorie: a.categorie ?? "",
            Taille: a.taille ?? "",
            Couleur: a.couleur ?? "",
            Emplacement: a.emplacement ?? "",
            Quantité: qte,
            "Prix d'achat (TND)": Number(a.prix_achat).toFixed(3),
            "Prix de vente (TND)": Number(a.prix_vente).toFixed(3),
            "Valeur stock (TND)": (qte * Number(a.prix_vente)).toFixed(3),
          };
        }),
      };
    }
    return {
      base: `depenses_${period}`,
      rows: (expenses.data ?? []).map((e) => ({
        Date: formatDate(e.date),
        Motif: e.motif,
        "Montant (TND)": Number(e.montant).toFixed(3),
      })),
    };
  };

  const exportCSV = (ext: "csv" | "xls") => {
    const { rows, base } = buildRows();
    if (!rows.length) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    const mime =
      ext === "csv"
        ? "text/csv;charset=utf-8"
        : "application/vnd.ms-excel;charset=utf-8";
    download(toCSV(rows), `${base}.${ext}`, mime);
    toast.success(`Export ${ext.toUpperCase()} téléchargé`);
  };

  const exportPDF = () => {
    const { rows, base } = buildRows();
    if (!rows.length) {
      toast.error("Aucune donnée à exporter");
      return;
    }
    const headers = Object.keys(rows[0]);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${base}</title>
      <style>
        body{font-family:'DM Sans',sans-serif;padding:32px;color:#1a1c1c}
        h1{font-size:24px;margin:0 0 4px;color:#7b5455}
        .meta{color:#504444;font-size:13px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#efdbff;color:#2c0051;text-align:left;padding:8px;border-bottom:2px solid #821dda}
        td{padding:8px;border-bottom:1px solid #e2e2e2}
        tr:nth-child(even) td{background:#f9f9f9}
      </style></head><body>
      <h1>Vendly — Rapport ${kind.toUpperCase()}</h1>
      <div class="meta">Période : ${periodLabel(period)} · Généré le ${formatDate(new Date())}</div>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr>${headers.map((h) => `<td>${(r[h] ?? "").toString().replace(/</g, "&lt;")}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody></table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Autorise les pop-ups pour exporter en PDF");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const kpis =
    kind === "ventes"
      ? [
          { label: "Chiffre d'affaires", value: formatCurrency(totalCA), tone: "accent" as const },
          { label: "Transactions", value: String(txCount), tone: "neutral" as const },
          { label: "Panier moyen", value: formatCurrency(panierMoyen), tone: "neutral" as const },
          { label: "Bénéfice", value: formatCurrency(totalBenef), tone: "success" as const },
        ]
      : kind === "stock"
        ? [
            { label: "Articles", value: String((articles.data ?? []).length), tone: "accent" as const },
            {
              label: "Pièces en stock",
              value: String(piecesStock),
              tone: "neutral" as const,
            },
            { label: "Valeur du stock", value: formatCurrency(stockValue), tone: "success" as const },
          ]
        : [
            { label: "Dépenses", value: String((expenses.data ?? []).length), tone: "accent" as const },
            { label: "Total dépensé", value: formatCurrency(totalDepenses), tone: "neutral" as const },
          ];

  const isLoading = sales.isLoading || articles.isLoading || expenses.isLoading || variantes.isLoading;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="font-display text-3xl text-foreground lg:text-4xl">
          Rapports &amp; Exports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analysez les performances de votre boutique et exportez vos données.
        </p>
      </header>

      {/* Type de données */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-primary">Type de données</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KindButton active={kind === "ventes"} onClick={() => setKind("ventes")} icon={ShoppingBag} label="Ventes" />
          <KindButton active={kind === "stock"} onClick={() => setKind("stock")} icon={Package} label="Stock" />
          <KindButton active={kind === "depenses"} onClick={() => setKind("depenses")} icon={Receipt} label="Dépenses" />
          <KindButton disabled icon={UsersIcon} label="Clients" />
        </div>

        {kind !== "stock" && (
          <>
            <p className="mt-5 mb-3 text-sm font-semibold text-primary">Période</p>
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent-soft/60 px-3 py-2.5 text-sm text-foreground">
              <CalendarIcon className="h-4 w-4 text-accent" />
              <span className="font-medium">{periodLabel(period)}</span>
            </div>
            <div className="flex gap-2">
              {(["jour", "mois", "annee"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    period === p
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-accent-soft"
                  }`}
                >
                  {p === "annee" ? "Année" : p}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Export */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-primary">Exporter en format</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ExportButton onClick={exportPDF} icon={FileText} label="Document PDF" tone="primary" />
          <ExportButton onClick={() => exportCSV("xls")} icon={FileSpreadsheet} label="Tableur Excel" tone="success" />
          <ExportButton onClick={() => exportCSV("csv")} icon={Download} label="Fichier CSV" tone="neutral" />
        </div>
      </section>

      {/* Aperçu */}
      <section className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="absolute left-0 top-5 h-[calc(100%-2.5rem)] w-1 rounded-r-full bg-accent" />
        <h2 className="pl-3 font-display text-xl text-foreground">
          Aperçu du Rapport {kind === "ventes" ? "de Ventes" : kind === "stock" ? "de Stock" : "des Dépenses"}
        </h2>
        <p className="pl-3 text-xs text-muted-foreground">
          {periodLabel(period)} · Toutes les catégories
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl bg-secondary/60 p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {k.label}
              </p>
              <p
                className={`mt-1 font-display text-2xl ${
                  k.tone === "accent"
                    ? "text-accent"
                    : k.tone === "success"
                      ? "text-[oklch(0.55_0.18_155)]"
                      : "text-foreground"
                }`}
              >
                {isLoading ? "…" : k.value}
              </p>
            </div>
          ))}
        </div>

        {kind === "ventes" && txCount > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-accent-soft/50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                Tendance de la période
              </p>
              <p className="text-sm text-foreground">
                {txCount} transaction{txCount > 1 ? "s" : ""} ·{" "}
                {formatCurrency(panierMoyen)} de panier moyen.
              </p>
            </div>
          </div>
        )}
      </section>

      {kind === "ventes" && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h3 className="font-display text-lg">Top Produits</h3>
          </div>
          <TopProducts sales={sales.data ?? []} articles={articles.data ?? []} />
        </section>
      )}
    </div>
  );
}

function KindButton({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border bg-card text-foreground hover:bg-secondary"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ExportButton({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  tone: "primary" | "success" | "neutral";
}) {
  const colorMap = {
    primary: "text-destructive bg-[oklch(0.95_0.04_25)]",
    success: "text-[oklch(0.55_0.18_155)] bg-[oklch(0.92_0.08_155)]",
    neutral: "text-accent bg-accent-soft",
  } as const;
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-shadow hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Download className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function TopProducts({
  sales,
  articles,
}: {
  sales: any[];
  articles: any[];
}) {
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const agg = new Map<string, { qty: number; ca: number }>();
  for (const s of sales) {
    const cur = agg.get(s.article_id) ?? { qty: 0, ca: 0 };
    cur.qty += Number(s.quantite);
    cur.ca += Number(s.total);
    agg.set(s.article_id, cur);
  }
  const top = [...agg.entries()]
    .map(([id, v]) => ({ article: articleMap.get(id), ...v }))
    .filter((t) => t.article)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 4);

  if (!top.length)
    return <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>;

  return (
    <div className="grid grid-cols-2 gap-3">
      {top.map((t) => (
        <div
          key={t.article.id}
          className="overflow-hidden rounded-xl border border-border bg-secondary/40"
        >
          <div className="flex aspect-square items-center justify-center bg-accent-soft/40 font-display text-3xl text-accent">
            {t.article.designation.charAt(0)}
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-semibold">{t.article.designation}</p>
            <p className="text-xs text-muted-foreground">
              {t.qty} ventes · {formatCurrency(t.ca)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
