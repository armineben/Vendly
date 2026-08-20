import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Sparkles,
  ShoppingBag,
  Receipt,
  Calendar,
  Truck,
  History,
  LogOut,
  Users,
  FileBarChart,
  UserCog,
  FolderCog,
  Settings,
  Eye,
  ChevronDown,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useLowStockAlerts } from "@/hooks/use-low-stock-alerts";
import { NotificationPopover } from "@/components/NotificationPopover";
import { TeamChat } from "@/components/TeamChat";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/dashboard" as any, label: "Tableau de bord", icon: LayoutDashboard, adminOnly: true },
  { to: "/catalogue" as any, label: "Catalogue", icon: Sparkles, adminOnly: false },
  { to: "/stock" as any, label: "Stock", icon: Package, adminOnly: true },
  { to: "/gestion-catalogue" as any, label: "Gestion catalogue", icon: FolderCog, adminOnly: true },
  { to: "/ventes" as any, label: "Ventes", icon: ShoppingBag, adminOnly: true },
  { to: "/depenses" as any, label: "Dépenses", icon: Receipt, adminOnly: true },
  { to: "/reservations" as any, label: "Réservations", icon: Calendar, adminOnly: false },
  { to: "/commandes-livraison" as any, label: "Livraison", icon: Truck, adminOnly: false },
  { to: "/historique" as any, label: "Historique", icon: History, adminOnly: false },
  { to: "/rapports" as any, label: "Rapports", icon: FileBarChart, adminOnly: true },
  { to: "/utilisateurs" as any, label: "Utilisateurs", icon: Users, adminOnly: true },
  { to: "/profil" as any, label: "Mon profil", icon: UserCog, adminOnly: false },
  { to: "/admin-configuration" as any, label: "Configuration", icon: Settings, adminOnly: true },
] as const;

function AuthenticatedLayout() {
  const { user, loading, role, isAdmin, signOut, impersonatedUserId, setImpersonatedUser } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLowStockAlerts(isAdmin);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" as any });
  }, [loading, user, navigate]);

  useEffect(() => {
    const allowedForNonAdmin = ["/catalogue", "/profil", "/reservations", "/commandes-livraison", "/historique"];
    if (!loading && user && role && !isAdmin && !allowedForNonAdmin.some((p) => pathname.startsWith(p))) {
      navigate({ to: "/catalogue" as any });
    }
  }, [loading, user, role, isAdmin, pathname, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const sub = supabase
      .channel("avatar-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (payload) => {
        setAvatarUrl((payload.new as any)?.avatar_url ?? null);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user?.id]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-[#F9F8F3] to-[#FEF9E7] items-center justify-center">
        <div className="text-xs font-bold tracking-widest text-[#747878] uppercase animate-pulse">
          Vérification des accès sécurisés...
        </div>
      </div>
    );
  }

  const visible = navItems.filter((i) => !i.adminOnly || isAdmin);

  const NavLink = ({ item, onClick }: { item: typeof navItems[number]; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = pathname.startsWith(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onClick}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold tracking-wider uppercase transition-all duration-200 whitespace-nowrap
          ${active ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"}`}
      >
        <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-zinc-400"}`} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {impersonatedUserId && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="font-medium">Vous visualisez le compte d'un autre utilisateur</span>
          <button
            onClick={() => setImpersonatedUser(null)}
            className="ml-2 rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-300 transition-colors"
          >
            Reprendre mon compte
          </button>
        </div>
      )}

      {/* ─── TOP NAVBAR ─── */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200/60 bg-white/95 backdrop-blur-md px-4 md:px-6 py-3">
        {/* Left: logo + hamburger (mobile) */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} className="flex items-center gap-2 cursor-pointer lg:hidden">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-zinc-200">
              <img src="/logo-vendly.png" alt="Vendly" className="w-full h-full object-cover" />
            </div>
          </button>
          <Link to="/dashboard" className="hidden lg:flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-zinc-200">
              <img src="/logo-vendly.png" alt="Vendly" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-base tracking-tight text-zinc-800">Vendly</span>
          </Link>
        </div>

        {/* Center: desktop nav */}
        <nav ref={scrollRef} className="hidden lg:flex items-center gap-1 overflow-x-auto no-scrollbar mx-4">
          {visible.map((item) => (
            <NavLink key={item.to} item={item} />
          ))}
        </nav>

        {/* Right: notifications + avatar */}
        <div className="flex items-center gap-3">
          <TeamChat currentUserId={user.id} />
          <NotificationPopover userId={user.id} />
          <div className="relative group">
            <button className="flex items-center gap-2 rounded-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 transition-colors hover:bg-zinc-100">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-300 border border-zinc-200">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-zinc-500">
                    {user.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
              </div>
              <span className="hidden sm:block text-xs font-semibold text-zinc-700 max-w-[120px] truncate">
                {user.email?.split("@")[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-zinc-200 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-2 z-50">
              <div className="px-3 py-2 mb-1 border-b border-zinc-100">
                <p className="text-xs font-semibold text-zinc-700 truncate">{user.email}</p>
                <span className="inline-flex items-center rounded-full bg-zinc-800 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest mt-1">
                  {role === "admin" ? "Admin" : "Vendeur"}
                </span>
              </div>
              <Link to="/profil" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                <UserCog className="h-3.5 w-3.5" /> Mon profil
              </Link>
              <button
                onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" /> Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MOBILE NAV (horizontal scroll) ─── */}
      <nav className="flex gap-2 overflow-x-auto border-b border-zinc-200/60 bg-white/90 px-4 py-2.5 lg:hidden no-scrollbar">
        {visible.map((item) => (
          <NavLink key={item.to} item={item} />
        ))}
      </nav>

      {/* ─── MOBILE SIDEBAR DRAWER ─── */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-white border-r border-zinc-200 flex flex-col">
          <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-5">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-200">
              <img src="/logo-vendly.png" alt="Vendly" className="w-full h-full object-cover" />
            </div>
            <h2 className="font-bold text-lg tracking-tight text-zinc-800">Vendly</h2>
          </div>
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {visible.map((item) => (
              <NavLink key={item.to} item={item} onClick={() => setMenuOpen(false)} />
            ))}
          </nav>
          <div className="border-t border-zinc-100 p-4">
            <button
              onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold tracking-wider uppercase text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 min-h-[calc(100vh-60px)] bg-gradient-to-br from-[#F9F8F3] to-[#FEF9E7]">
        <Outlet />
      </main>
    </>
  );
}
