import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  KeyRound,
  User as UserIcon,
  Camera,
  ShoppingBag,
  Wallet,
  TrendingUp,
  Shield,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/profil")({
  component: ProfilPage,
});

function ProfilPage() {
  const { user, role, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [tab, setTab] = useState<"profile" | "security">("profile");
  const [stats, setStats] = useState({ ca: 0, pieces: 0 });
  const [lineData, setLineData] = useState<
    { day: string; "Chiffre d'Affaires": number }[]
  >([]);
  const [adminStats, setAdminStats] = useState({
    totalCA: 0,
    totalPieces: 0,
    totalBenef: 0,
    nbMois: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile]);

  useEffect(() => {
    const uid = effectiveUserId;
    if (!uid) return;
    if (user) setEmail(user.email ?? "");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    supabase
      .from("sales")
      .select("*")
      .eq("vendeur_id", uid)
      .gte("created_at", todayISO)
      .order("created_at", { ascending: false })
      .then(({ data: sales = [] }) => {
        if (sales) {
          setStats({
            ca: sales.reduce((s, r) => s + Number(r.total || 0), 0),
            pieces: sales.reduce((s, r) => s + Number(r.quantite || 0), 0),
          });
        }
      });

    const p14 = new Date();
    p14.setDate(p14.getDate() - 14);
    supabase
      .from("sales")
      .select("created_at, total")
      .eq("vendeur_id", uid)
      .gte("created_at", p14.toISOString())
      .then(({ data: historique = [] }) => {
        const dayMap = new Map<string, number>();
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dayMap.set(d.toISOString().slice(0, 10), 0);
        }
        (historique ?? []).forEach((s) => {
          if (s.created_at) {
            const d = new Date(s.created_at).toISOString().slice(0, 10);
            if (dayMap.has(d)) {
              dayMap.set(d, dayMap.get(d)! + Number(s.total || 0));
            }
          }
        });
        setLineData(
          Array.from(dayMap.entries()).map(([d, total]) => ({
            day: d.slice(5).replace("-", "/"),
            "Chiffre d'Affaires": total,
          })),
        );
      });

    if (role === "admin") {
      supabase
        .from("sales")
        .select("total, benefice, quantite, created_at")
        .then(({ data: toutes = [] }) => {
          if (toutes) {
            setAdminStats({
              totalCA: toutes.reduce((s, r) => s + Number(r.total || 0), 0),
              totalPieces: toutes.reduce(
                (s, r) => s + Number(r.quantite || 0),
                0,
              ),
              totalBenef: toutes.reduce(
                (s, r) => s + Number(r.benefice ?? 0),
                0,
              ),
              nbMois: new Set(toutes.map((r) => r.created_at?.slice(0, 7)))
                .size,
            });
          }
        });
    }
  }, [effectiveUserId, user, role]);

  async function saveName() {
    if (!user) return;
    setSavingName(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: displayName });

      if (error) {
        console.error("Erreur upsert profil:", error);
        toast.error(
          `Erreur : ${error.message}${error.details ? ` (${error.details})` : ""}`,
        );
      } else {
        toast.success("Nom mis à jour avec succès");
        await queryClient.invalidateQueries({
          queryKey: ["user-profile", user.id],
        });
      }
    } catch (err: any) {
      toast.error(`Erreur système : ${err.message}`);
    } finally {
      setSavingName(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `avatars/${user?.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert({ id: user?.id, avatar_url: publicUrl });

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({
        queryKey: ["user-profile", user?.id],
      });
      toast.success("Photo de profil mise à jour !");
    } catch (error: any) {
      toast.error("Erreur d'upload : " + error.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveEmail() {
    if (!email) return;
    if (!confirm(`Confirmer le changement d'email vers ${email} ?`)) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email });
    if (error) toast.error(error.message);
    else toast.success("Demande envoyée. Vérifiez votre boîte mail.");
    setSavingEmail(false);
  }

  async function savePassword() {
    if (password.length < 8) {
      toast.error("Mot de passe : 8 caractères minimum");
      return;
    }
    if (password !== confirmPwd) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else {
      toast.success("Mot de passe mis à jour");
      setPassword("");
      setConfirmPwd("");
    }
    setSavingPwd(false);
  }

  if (!user) return null;

  const fallbackName = user.email?.split("@")[0] || "Mon profil";
  const finalName = isProfileLoading
    ? "Chargement..."
    : profile?.display_name || fallbackName;
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-12">
      <div className="mx-auto max-w-4xl px-4 pt-8 lg:px-8">
        {/* Cover banner */}
        <div className="relative h-36 rounded-3xl bg-gradient-to-br from-[#2F3E46] to-[#55768E] shadow-xl overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 25%, white 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        {/* Avatar */}
        <div className="flex justify-center -mt-16">
          <div className="relative h-28 w-28 group">
            <div className="h-full w-full rounded-full bg-slate-800 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-black text-white">
                  {finalName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white cursor-pointer"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Camera size={18} />
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
        </div>

        {/* Info utilisateur */}
        <div className="text-center mt-3">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-[#091426]">{finalName}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#091426]/10 px-3 py-0.5 text-[11px] font-semibold text-[#091426] tracking-wide">
              {role === "admin"
                ? "Admin"
                : role === "manager"
                  ? "Manager"
                  : "Vendeur"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
        </div>

        {/* Stats cards */}
        {role !== "admin" ? (
          <div className="flex justify-center gap-4 mt-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs min-w-[150px] text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center justify-center gap-1.5">
                <ShoppingBag size={12} className="text-emerald-500" />{" "}
                Aujourd'hui
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {stats.pieces}{" "}
                <span className="text-xs font-normal text-slate-400">pcs</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs min-w-[150px] text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center justify-center gap-1.5">
                <Wallet size={12} className="text-yellow-500" /> CA du jour
              </p>
              <p className="text-2xl font-black text-yellow-600 mt-1">
                {formatCurrency(stats.ca)}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                CA Historique
              </p>
              <p className="text-lg font-black text-[#091426] mt-1">
                {formatCurrency(adminStats.totalCA)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Pièces
              </p>
              <p className="text-lg font-black text-[#091426] mt-1">
                {adminStats.totalPieces}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Bénéfice
              </p>
              <p className="text-lg font-black text-emerald-600 mt-1">
                {formatCurrency(adminStats.totalBenef)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Période
              </p>
              <p className="text-lg font-black text-[#091426] mt-1">
                {adminStats.nbMois} mois
              </p>
            </div>
          </div>
        )}

        {/* Mini graphique (non-admin) */}
        {role !== "admin" && lineData.length > 0 && (
          <div className="mt-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3 flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-500" /> Évolution
              (14 jours)
            </p>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={lineData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="day"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                    labelStyle={{
                      color: "#64748b",
                      fontSize: "10px",
                    }}
                    itemStyle={{
                      color: "#10b981",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Chiffre d'Affaires"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorProfileTotal)"
                  />
                  <defs>
                    <linearGradient
                      id="colorProfileTotal"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex justify-center mt-8">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
            <button
              onClick={() => setTab("profile")}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all cursor-pointer ${
                tab === "profile"
                  ? "bg-white text-[#091426] shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <UserIcon size={16} />
              Mon Profil
            </button>
            <button
              onClick={() => setTab("security")}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-all cursor-pointer ${
                tab === "security"
                  ? "bg-white text-[#091426] shadow-xs"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Shield size={16} />
              Sécurité
            </button>
          </div>
        </div>

        {/* Contenu des onglets */}
        {tab === "profile" && (
          <div className="mt-6 space-y-5">
            <Section
              icon={<UserIcon className="h-4 w-4" />}
              title="Nom affiché"
            >
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:border-[#091426]"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Amine"
                  disabled={isProfileLoading}
                />
                <button
                  onClick={saveName}
                  disabled={savingName || isProfileLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#091426] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {savingName && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Enregistrer
                </button>
              </div>
            </Section>

            <Section icon={<Mail className="h-4 w-4" />} title="Adresse email">
              <div className="flex gap-2">
                <input
                  type="email"
                  className="flex-1 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:border-[#091426]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  onClick={saveEmail}
                  disabled={savingEmail || email === user.email}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#091426] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {savingEmail && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Changer l'email
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400 italic">
                Un email de confirmation sera envoyé à la nouvelle adresse.
              </p>
            </Section>
          </div>
        )}

        {tab === "security" && (
          <div className="mt-6">
            <Section
              icon={<KeyRound className="h-4 w-4" />}
              title="Mot de passe"
            >
              <div className="grid gap-2">
                <input
                  type="password"
                  placeholder="Nouveau mot de passe (8+ caractères)"
                  className="rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:border-[#091426]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  className="rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:border-[#091426]"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
                <button
                  onClick={savePassword}
                  disabled={savingPwd || !password}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#091426] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:w-auto sm:self-end cursor-pointer"
                >
                  {savingPwd && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Mettre à jour
                </button>
              </div>
            </Section>
          </div>
        )}

        {/* Admin stats */}
        {role === "admin" && tab === "profile" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#091426]">
              <TrendingUp className="h-4 w-4 text-slate-400" />
              Administration — Statistiques Cumulées
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">
              Totaux historiques depuis la création de la boutique.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  CA Total
                </p>
                <p className="text-xl font-black text-[#091426] mt-1">
                  {formatCurrency(adminStats.totalCA)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Pièces vendues
                </p>
                <p className="text-xl font-black text-[#091426] mt-1">
                  {adminStats.totalPieces} pcs
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Bénéfice net
                </p>
                <p className="text-xl font-black text-emerald-600 mt-1">
                  {formatCurrency(adminStats.totalBenef)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Période
                </p>
                <p className="text-xl font-black text-[#091426] mt-1">
                  {adminStats.nbMois} mois
                </p>
              </div>
            </div>
            {lineData.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">
                  Évolution mensuelle
                </p>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lineData.slice(-10)}>
                      <XAxis
                        dataKey="day"
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                        }}
                      />
                      <Bar
                        dataKey="Chiffre d'Affaires"
                        fill="#091426"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#091426]">
        <span className="text-slate-400">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
