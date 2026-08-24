import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  TrendingUp, Wallet, ShoppingBag, Receipt,
  AlertTriangle, Users, Calendar, ArrowUpRight, ArrowDownRight,
  Sparkles, Clock, Package, Camera, Loader2, Mail, Eye, RefreshCw, Undo2, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import { uploadAvatar } from "@/lib/upload-avatar.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const COLORS = ["#18181b", "#3f3f46", "#52525b", "#a1a1aa", "#d4d4d8"];
const PAY_COLORS = ["#18181b", "#3f3f46", "#52525b", "#a1a1aa"];

function BarChartEmpty() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 16v-4" />
      <path d="M11 16V8" />
      <path d="M15 16v-2" />
      <path d="M19 16v-6" />
    </svg>
  );
}

function PieEmpty() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
      <path d="M21.2 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

function DashboardPage() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const userName = profile?.display_name || user?.email?.split('@')[0] || "Collaborateur";
  const avatarUrl = profile?.avatar_url || null;

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0 || !user?.id) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          await uploadAvatar({ data: { base64, fileName: file.name } });
          await qc.invalidateQueries({ queryKey: ["user-profile", user.id] });
          toast.success("Photo de profil mise à jour !");
        } catch (err: any) {
          toast.error("Erreur d'upload : " + err.message);
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        toast.error("Erreur de lecture du fichier");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error("Erreur d'upload : " + error.message);
      setUploading(false);
    }
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const p14 = new Date(); p14.setDate(p14.getDate() - 14);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["dashboard-sales", p14.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, articles(designation, categorie)")
        .gte("created_at", p14.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ["dashboard-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("status", "actif");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: variantes = [] } = useQuery({
    queryKey: ["dashboard-variantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variantes")
        .select("article_id, stock");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["dashboard-expenses", p14.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("created_at", p14.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["dashboard-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commandes_livraison")
        .select("id, delivery_status, total_price, paid_at, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Marketing & Audience ────────────────────────────────────
  const { data: clientsCount = 0 } = useQuery({
    queryKey: ["kpi-clients"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: newsletterCount = 0 } = useQuery({
    queryKey: ["kpi-newsletter"],
    queryFn: async () => {
      const { count } = await supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: visitsCount = 0 } = useQuery({
    queryKey: ["kpi-visits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_visits")
        .select("count")
        .eq("id", 1)
        .single();
      return Number(data?.count ?? 0);
    },
  });
  const { data: pendingCartsCount = 0 } = useQuery({
    queryKey: ["kpi-pending-carts"],
    queryFn: async () => {
      const { count } = await supabase
        .from("pending_carts")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const { data: salesCount = 0 } = useQuery({
    queryKey: ["kpi-sales-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const conversionRate =
    visitsCount > 0 ? ((salesCount / visitsCount) * 100).toFixed(1) : "0";

  // ── SAV : Retours & Remboursements ──────────────────────────
  const { data: returns = [] } = useQuery({
    queryKey: ["kpi-returns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("returns").select("status, amount");
      if (error) throw error;
      return data ?? [];
    },
  });
  const pendingReturns = returns.filter((r: any) => r.status === "en_attente").length;
  const refundsTotal = returns
    .filter((r: any) => r.status === "rembourse")
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  const returnRate = salesCount > 0 ? ((returns.length / salesCount) * 100).toFixed(1) : "0";

  const salesToday = sales.filter(s => s.created_at && new Date(s.created_at) >= todayStart);
  const salesYesterday = sales.filter(s => s.created_at && new Date(s.created_at) >= yesterdayStart && new Date(s.created_at) < todayStart);
  const caJour = salesToday.reduce((s, r) => s + Number(r.total || 0), 0);
  const piecesJour = salesToday.reduce((s, r) => s + Number(r.quantite || 0), 0);
  const benefJour = salesToday.reduce((s, r) => s + Number(r.benefice ?? 0), 0);
  const depensesJour = expenses.filter(e => e.created_at && new Date(e.created_at) >= todayStart).reduce((s, e) => s + Number(e.montant || 0), 0);

  const caHier = salesYesterday.reduce((s, r) => s + Number(r.total || 0), 0);
  const piecesHier = salesYesterday.reduce((s, r) => s + Number(r.quantite || 0), 0);
  const benefHier = salesYesterday.reduce((s, r) => s + Number(r.benefice ?? 0), 0);
  const trendCA = caHier > 0 ? ((caJour - caHier) / caHier * 100) : 0;
  const trendPieces = piecesHier > 0 ? ((piecesJour - piecesHier) / piecesHier * 100) : 0;
  const trendBenef = benefHier > 0 ? ((benefJour - benefHier) / benefHier * 100) : 0;

  const stockCombiné = new Map<string, number>();
  articles.forEach(a => stockCombiné.set(a.id, Number(a.quantite) || 0));
  variantes.forEach(v => {
    const current = stockCombiné.get(v.article_id) ?? 0;
    stockCombiné.set(v.article_id, current + Number(v.stock || 0));
  });
  const lowStock = articles.filter((a) => (stockCombiné.get(a.id) || 0) <= 3);

  const deliveryPending = deliveries
    .filter((d: any) => d.delivery_status === "delivered")
    .reduce((s: number, d: any) => s + Number(d.total_price || 0), 0);
  const deliveryTotal = deliveries.length;
  const deliveryPaid = deliveries.filter((d: any) => d.delivery_status === "paid").length;
  const deliveryCancelled = deliveries.filter((d: any) => d.delivery_status === "cancelled").length;
  const deliverySuccessRate = deliveryTotal - deliveryCancelled > 0
    ? ((deliveryTotal - deliveryCancelled) / deliveryTotal * 100).toFixed(0)
    : "0";

  const dayMap = new Map<string, { total: number; pieces: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), { total: 0, pieces: 0 });
  }
  sales.forEach((s) => {
    if (s.created_at) {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      if (dayMap.has(d)) {
        const current = dayMap.get(d)!;
        dayMap.set(d, {
          total: current.total + Number(s.total || 0),
          pieces: current.pieces + Number(s.quantite || 0)
        });
      }
    }
  });
  const lineData = Array.from(dayMap.entries()).map(([d, v]) => ({
    day: d.slice(5).replace("-", "/"),
    "Chiffre d'Affaires": v.total,
    "Pièces Vendues": v.pieces
  }));

  const catMap = new Map<string, number>();
  sales.forEach((s: any) => {
    const categoryName = s.articles?.categorie || "Autre";
    catMap.set(categoryName, (catMap.get(categoryName) || 0) + Number(s.total || 0));
  });
  const pieData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

  // ── Modes de paiement (Donut) ────────────────────────────────
  const payMap = new Map<string, number>();
  sales.forEach((s: any) => {
    const m = (s.payment_method || "especes").toLowerCase();
    const label =
      m === "cod" || m === "especes"
        ? "Espèces / COD"
        : m === "card"
          ? "Carte bancaire"
          : m === "e-dinar" || m === "edinar"
            ? "e-Dinar"
            : "En ligne";
    payMap.set(label, (payMap.get(label) || 0) + Number(s.total || 0));
  });
  const paymentData = Array.from(payMap.entries()).map(([name, value]) => ({ name, value }));

  // ── Volume par catégorie (Bar) ───────────────────────────────
  const catVolMap = new Map<string, number>();
  sales.forEach((s: any) => {
    const cat = s.articles?.categorie || "Autre";
    catVolMap.set(cat, (catVolMap.get(cat) || 0) + Number(s.quantite || 0));
  });
  const barData = Array.from(catVolMap.entries())
    .map(([name, volume]) => ({ name, volume }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  // ── Tunnel de conversion ─────────────────────────────────────
  const deliveredCount = deliveries.filter(
    (d: any) => d.delivery_status === "delivered",
  ).length;
  const pctOf = (v: number) =>
    visitsCount > 0 ? Math.round((v / visitsCount) * 100) : 0;
  const funnel = [
    { label: "Visiteurs", value: visitsCount, pct: 100 },
    { label: "Paniers", value: pendingCartsCount, pct: pctOf(pendingCartsCount) },
    { label: "Commandes", value: salesCount, pct: pctOf(salesCount) },
    { label: "Livrés", value: deliveredCount, pct: pctOf(deliveredCount) },
  ];

  const articleMapTop = new Map(articles.map(a => [a.id, a]));
  const aggTop = new Map<string, { qty: number; ca: number }>();
  for (const s of salesToday) {
    const cur = aggTop.get(s.article_id) ?? { qty: 0, ca: 0 };
    cur.qty += Number(s.quantite);
    cur.ca += Number(s.total);
    aggTop.set(s.article_id, cur);
  }
  const topProductsList = [...aggTop.entries()]
    .map(([id, v]) => ({ article: articleMapTop.get(id), ...v }))
    .filter(t => t.article)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 4);

  const vendMap = new Map<string, { pieces: number; ca: number }>();
  sales.forEach((s: any) => {
    const name = s.vendeur_nom || "Non renseigné";
    const cur = vendMap.get(name) ?? { pieces: 0, ca: 0 };
    cur.pieces += Number(s.quantite || 0);
    cur.ca += Number(s.total || 0);
    vendMap.set(name, cur);
  });
  const teamPerf = Array.from(vendMap.entries()).map(([name, v]) => ({ name, ...v }));

  const isLoading = salesLoading || articlesLoading;

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-6 lg:p-8 space-y-6">
      {/* ─── TOP ROW: BENTO PROFILE CARD + KPI GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Profile Card (Lora Piterson style) */}
        <div className="relative overflow-hidden rounded-3xl bg-zinc-800 shadow-sm min-h-[320px] flex flex-col">
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)",
            }}
          />
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 pt-8 pb-5">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg mb-4 relative group">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white bg-zinc-600">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <h2 className="text-xl font-bold text-white text-center">{userName}</h2>
            <span className="mt-2 inline-flex items-center rounded-full bg-white/15 text-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-white/10">
              {isAdmin ? "Manager Boutique" : "Vendeur"}
            </span>
          </div>
          <div className="relative z-10 mx-4 mb-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Aujourd'hui</p>
                <p className="text-lg font-bold text-white mt-0.5">{piecesJour} pièce(s)</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">CA jour</p>
                <p className="text-lg font-bold text-white mt-0.5">{formatCurrency(caJour)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">CA Aujourd'hui</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{isLoading ? "…" : formatCurrency(caJour)}</p>
              {trendCA >= 0
                ? <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-emerald-600"><ArrowUpRight className="h-3 w-3" /> {trendCA.toFixed(1)}%</span>
                : <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-red-500"><ArrowDownRight className="h-3 w-3" /> {trendCA.toFixed(1)}%</span>
              }
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Pièces</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{isLoading ? "…" : String(piecesJour)}</p>
              {trendPieces >= 0
                ? <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-emerald-600"><ArrowUpRight className="h-3 w-3" /> {trendPieces.toFixed(1)}%</span>
                : <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-red-500"><ArrowDownRight className="h-3 w-3" /> {trendPieces.toFixed(1)}%</span>
              }
            </div>
          </div>

          {isAdmin ? (
            <>
              <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Bénéfice</span>
                  <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-zinc-800 tracking-tight">{isLoading ? "…" : formatCurrency(benefJour)}</p>
                  {trendBenef >= 0
                    ? <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-emerald-600"><ArrowUpRight className="h-3 w-3" /> {trendBenef.toFixed(1)}%</span>
                    : <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-red-500"><ArrowDownRight className="h-3 w-3" /> {trendBenef.toFixed(1)}%</span>
                  }
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Dépenses</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Receipt className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-zinc-800 tracking-tight">{isLoading ? "…" : formatCurrency(depensesJour)}</p>
                  <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">
                    <Clock className="h-3 w-3" /> Aujourd'hui
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Transactions</span>
                  <div className="p-2 rounded-xl bg-zinc-100 text-zinc-600">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-zinc-800 tracking-tight">{isLoading ? "…" : String(salesToday.length)}</p>
                  <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">vente(s) aujourd'hui</span>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Stock bas</span>
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-zinc-800 tracking-tight">{lowStock.length}</p>
                  <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">article(s) en alerte</span>
                </div>
              </div>

              {/* Delivery KPIs — shown for all roles */}
              <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">En-cours livreurs</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-zinc-800 tracking-tight">{formatCurrency(deliveryPending)}</p>
                  <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">encaissements en attente</span>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Livraisons</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-zinc-800 tracking-tight">{deliveryTotal}</p>
                  <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">
                    {deliveryPaid} payées · {deliveryCancelled} retours · {deliverySuccessRate}% réussite
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── MARKETING & AUDIENCE ─── */}
      <div>
        <h3 className="font-bold text-zinc-800 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Marketing & Audience
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Clients inscrits</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{clientsCount}</p>
              <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">profils enregistrés</span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Newsletter</span>
              <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                <Mail className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{newsletterCount}</p>
              <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">inscriptions</span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Visites boutique</span>
              <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600">
                <Eye className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{visitsCount}</p>
              <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">sessions enregistrées</span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Conversion</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{conversionRate}%</p>
              <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">
                {salesCount} vente{salesCount > 1 ? "s" : ""} / {visitsCount} visite{visitsCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SAV : RETOURS & REMBOURSEMENTS ─── */}
      <div>
        <h3 className="font-bold text-zinc-800 mb-4 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> SAV · Retours & Remboursements
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Taux de retour</span>
              <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                <Undo2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{returnRate}%</p>
              <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">
                {returns.length} retour{returns.length > 1 ? "s" : ""} / {salesCount} vente{salesCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Remboursements</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{formatCurrency(refundsTotal)}</p>
              <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">montant remboursé</span>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Retours en attente</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-black text-zinc-800 tracking-tight">{pendingReturns}</p>
              <span className="inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-zinc-400">à traiter</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BENTO GRID: CHARTS + SECTIONS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart (2 cols) */}
        <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-zinc-800">Performances (14 jours)</h3>
            <span className="text-xs font-medium text-zinc-400">Flux de revenus & Volumes</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} stroke="#a1a1aa" fontSize={12} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} stroke="#18181b" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} stroke="#52525b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e4e4e7" }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line yAxisId="left" type="monotone" dataKey="Chiffre d'Affaires" stroke="#18181b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="Pièces Vendues" stroke="#52525b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart - Par catégorie (1 col) */}
        <div className="rounded-3xl bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-zinc-800">Par catégorie</h3>
            <p className="text-xs text-zinc-400 mt-1">Volume (pièces) par typologie</p>
          </div>
          <div className="h-56 mt-2">
            {barData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-300">
                <BarChartEmpty />
                <p className="text-xs mt-2">Aucune donnée</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                  <XAxis type="number" axisLine={false} tickLine={false} stroke="#a1a1aa" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} stroke="#18181b" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e4e4e7" }} cursor={{ fill: "#fafafa" }} />
                  <Bar dataKey="volume" fill="#18181b" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─── ROW 2 : MODES DE PAIEMENT + TUNNEL ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut - Modes de paiement */}
        <div className="rounded-3xl bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-zinc-800">Modes de paiement</h3>
            <p className="text-xs text-zinc-400 mt-1">Répartition du CA</p>
          </div>
          <div className="h-52 flex items-center justify-center relative mt-2">
            {paymentData.length === 0 ? (
              <div className="text-zinc-300 flex flex-col items-center">
                <PieEmpty />
                <p className="text-xs mt-2">Aucune donnée</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75} paddingAngle={4}>
                    {paymentData.map((_, i) => (
                      <Cell key={`pc-${i}`} fill={PAY_COLORS[i % PAY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e4e4e7" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute text-center pointer-events-none">
              <p className="text-[10px] text-zinc-400 font-medium">CA total</p>
              <p className="text-base font-bold text-zinc-800">{formatCurrency(sales.reduce((s, r) => s + Number(r.total || 0), 0))}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-1.5 mt-3 text-[11px] text-zinc-500 font-medium">
            {paymentData.length === 0 ? (
              <span className="text-zinc-300">—</span>
            ) : (
              paymentData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PAY_COLORS[idx % PAY_COLORS.length] }} />
                  <span className="truncate flex-1">{item.name}</span>
                  <span className="text-zinc-700">{formatCurrency(item.value)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Funnel - Tunnel de conversion */}
        <div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="font-bold text-zinc-800">Tunnel de conversion</h3>
          <p className="text-xs text-zinc-400 mt-1">Visiteurs → Paniers → Commandes → Livrés</p>
          <div className="mt-6 space-y-3">
            {funnel.map((step, i) => {
              const widthPct = step.pct;
              return (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${widthPct > 0 ? "bg-[#18181b]" : "bg-zinc-200"}`} />
                    <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">{step.label}</span>
                  </div>
                  <div className="flex-1 h-8 rounded-lg bg-zinc-100 overflow-hidden relative">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 ${
                        widthPct > 0 ? "bg-gradient-to-r from-zinc-800 to-zinc-500" : "bg-zinc-200"
                      }`}
                      style={{ width: `${Math.max(widthPct, widthPct > 0 ? 4 : 0)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-600">
                      {step.value} · {step.pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ROW: STOCK + TEAM + TOP PRODUCTS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock */}
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-zinc-800">Stock bas</h3>
            </div>
            {lowStock.length > 0 && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-bold">
                {lowStock.length} alerte(s)
              </span>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {lowStock.length === 0 ? (
              <p className="text-sm text-zinc-400 italic py-6 text-center">Aucun article en alerte.</p>
            ) : (
              lowStock.map((a) => (
                <div key={a.id} className="flex justify-between items-center py-2.5 px-2 border-b border-zinc-50 text-sm hover:bg-zinc-50 rounded-lg transition-colors">
                  <span className="text-zinc-700 font-medium truncate mr-2">{a.designation || "Sans nom"}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-zinc-400 font-mono">{a.reference}</span>
                    <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md min-w-[24px] text-center">{stockCombiné.get(a.id) || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Performance */}
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-zinc-400" />
            <h3 className="font-bold text-zinc-800">Performance Équipe</h3>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
            {teamPerf.length === 0 ? (
              <p className="text-sm text-zinc-400 italic py-6 text-center">Aucune donnée disponible.</p>
            ) : (
              teamPerf.map((v) => (
                <div key={v.name} className="flex justify-between items-center py-2.5 px-2 border-b border-zinc-50 text-sm hover:bg-zinc-50 rounded-lg transition-colors">
                  <div className="flex flex-col">
                    <span className="text-zinc-700 font-medium">{v.name}</span>
                    <span className="text-[11px] text-zinc-400">{v.pieces} pièces</span>
                  </div>
                  <span className="font-bold text-zinc-800">{formatCurrency(v.ca)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Products */}
        {topProductsList.length > 0 && (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-zinc-800">Top du jour</h3>
            </div>
            <div className="space-y-3">
              {topProductsList.map((t, idx) => (
                <div key={t.article.id} className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 truncate">{t.article.designation}</p>
                    <p className="text-xs text-zinc-400">{t.qty} vente(s) · {formatCurrency(t.ca)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── DATE FOOTER ─── */}
      <div className="flex items-center justify-center gap-2 pt-2 pb-4">
        <Calendar className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-medium text-zinc-400">
          {new Date().toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}
