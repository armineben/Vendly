import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { insertConnectionLog, insertNotification } from "@/hooks/use-notifications";

export type AppRole = "admin" | "manager" | "vendeur";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  effectiveUserId: string | null;
  impersonatedUserId: string | null;
  setImpersonatedUser: (id: string | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadRole(s.user.id), 0);
      } else if (event === "SIGNED_OUT") {
        setRole(null);
        const stored = sessionStorage.getItem("vendly_last_user");
        if (stored) {
          try {
            const last = JSON.parse(stored);
            insertNotification(`🔴 Fermeture de session : ${last.displayName} s'est déconnecté`, "connection");
          } catch {}
          sessionStorage.removeItem("vendly_last_user");
        }
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadRole(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRole(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();
    setRole((data?.role as AppRole) ?? "vendeur");
  }

  const effectiveUserId = impersonatedUserId ?? user?.id ?? null;

  const value: AuthState = {
    user,
    session,
    role,
    loading,
    isAdmin: role === "admin",
    effectiveUserId,
    impersonatedUserId,
    setImpersonatedUser: (id: string | null) => setImpersonatedUserId(id),
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data?.user && !error) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .maybeSingle();
        const displayName = profile?.display_name ?? data.user.email?.split("@")[0] ?? "Utilisateur";
        sessionStorage.setItem("vendly_last_user", JSON.stringify({ userId: data.user.id, displayName }));
        insertConnectionLog(data.user, displayName);
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        insertNotification(
          `🟢 ${displayName} s'est connecté à ${hh}:${mm}:${ss}`,
          "connection",
        );
      }
      return { error: error?.message ?? null };
    },
    signUp: async (email, password) => {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => {
      const stored = sessionStorage.getItem("vendly_last_user");
      if (stored) {
        try {
          const last = JSON.parse(stored);
          insertNotification(`🔴 Fermeture de session : ${last.displayName} s'est déconnecté`, "connection");
        } catch {}
      }
      setImpersonatedUserId(null);
      sessionStorage.removeItem("vendly_last_user");
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
