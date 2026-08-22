import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { LogOut, Package, Heart, User, Mail } from "lucide-react";

export const Route = createFileRoute("/compte")({
  component: CustomerAccountPage,
});

function CustomerAccountPage() {
  const { user, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 animate-pulse">
          Chargement...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 md:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-serif tracking-[0.2em] uppercase font-semibold">
          Vendly
        </Link>
        <Link
          to="/"
          className="text-[11px] uppercase tracking-[0.15em] text-gray-500 hover:text-black transition-colors"
        >
          ← Retour à la boutique
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {user ? (
          <LoggedInAccount />
        ) : (
          <AuthForm signIn={signIn} signUp={signUp} />
        )}
      </main>
    </div>
  );
}

// ─── Formulaire connexion / inscription client ───────────────
function AuthForm({
  signIn,
  signUp,
}: {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+216");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [pending, setPending] = useState(false);

  // Captcha simple (anti-robot)
  const [captchaA, setCaptchaA] = useState(0);
  const [captchaB, setCaptchaB] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaOk, setCaptchaOk] = useState(false);
  useEffect(() => {
    setCaptchaA(Math.floor(Math.random() * 8) + 2);
    setCaptchaB(Math.floor(Math.random() * 8) + 2);
    setCaptchaAnswer("");
    setCaptchaOk(false);
  }, [mode]);

  const checkCaptcha = (value: string) => {
    setCaptchaAnswer(value);
    setCaptchaOk(Number(value) === captchaA + captchaB);
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[^0-9+]/g, "");
    if (!cleaned.startsWith("+216") && cleaned.length > 0) {
      setPhone("+216" + cleaned.replace(/^\+?216/, ""));
    } else {
      setPhone(cleaned);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;

    if (mode === "signin") {
      if (!email.includes("@") || password.length < 6) {
        toast.error("Email invalide ou mot de passe trop court.");
        return;
      }
      setPending(true);
      const { error } = await signIn(email, password);
      setPending(false);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Bienvenue dans votre espace client !");
      return;
    }

    // ── INSCRIPTION ──
    if (!email.includes("@")) {
      toast.error("Veuillez saisir une adresse email valide.");
      return;
    }
    if (email !== confirmEmail) {
      toast.error("Les adresses email ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (!phone || phone === "+216") {
      toast.error("Veuillez saisir votre numéro de téléphone.");
      return;
    }
    if (!rgpdAccepted) {
      toast.error(
        "Veuillez accepter la conservation de vos données personnelles.",
      );
      return;
    }
    if (!captchaOk) {
      toast.error("Veuillez résoudre la vérification anti-robot.");
      return;
    }

    setPending(true);
    const { error } = await signUp(email, password);
    if (error) {
      setPending(false);
      toast.error(error);
      return;
    }

    // Enregistrer les coordonnées client dans le profil
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (userId) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("profiles")
            .update({ phone, address, city })
            .eq("id", userId);
        } else {
          await supabase.from("profiles").insert({
            id: userId,
            email,
            display_name: email.split("@")[0],
            phone,
            address,
            city,
          });
        }
      }
    } catch {
      // silencieux — le profil est facultatif pour l'inscription
    }

    // Inscription newsletter si la case est cochée
    if (newsletterOptIn) {
      const { error: nlError } = await supabase
        .from("newsletter_subscribers")
        .insert({ email });
      if (nlError && nlError.code !== "23505") {
        console.error("Erreur inscription newsletter:", nlError);
      }
    }

    setPending(false);
    toast.success(
      newsletterOptIn
        ? "Compte créé ! Vous êtes inscrit à notre newsletter."
        : "Compte créé ! Un email de confirmation vous a été envoyé.",
    );
    setMode("signin");
    setEmail("");
    setConfirmEmail("");
    setPassword("");
    setPhone("+216");
    setAddress("");
    setCity("");
    setRgpdAccepted(false);
    setNewsletterOptIn(false);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-serif uppercase tracking-[0.15em]">
          Espace client
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Suivez vos commandes et vos favoris
        </p>
      </div>

      <div className="flex border border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors ${
            mode === "signin" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Se connecter
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors ${
            mode === "signup" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          Créer un compte
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
            Adresse email *
          </Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@exemple.com"
            required
            className="h-11 rounded-none border-gray-200 focus-visible:ring-black"
          />
        </div>

        {mode === "signup" && (
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
              Confirmer l'adresse email *
            </Label>
            <Input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="client@exemple.com"
              required
              className="h-11 rounded-none border-gray-200 focus-visible:ring-black"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
            Mot de passe *
          </Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-11 rounded-none border-gray-200 focus-visible:ring-black"
          />
        </div>

        {mode === "signup" && (
          <>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
                Numéro de téléphone *
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+216 XX XXX XXX"
                className="h-11 rounded-none border-gray-200 focus-visible:ring-black"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
                Adresse
              </Label>
              <Input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rue, numéro, code postal"
                className="h-11 rounded-none border-gray-200 focus-visible:ring-black"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
                Ville
              </Label>
              <Input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Votre ville"
                className="h-11 rounded-none border-gray-200 focus-visible:ring-black"
              />
            </div>

            {/* RGPD */}
            <label className="flex items-start gap-2.5 text-[11px] text-gray-500 leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={rgpdAccepted}
                onChange={(e) => setRgpdAccepted(e.target.checked)}
                className="mt-0.5 accent-black"
              />
              <span>
                En créant un compte, vous acceptez que vos données
                personnelles soient conservées pour le suivi de vos commandes
                et de votre expérience client.
              </span>
            </label>

            {/* NEWSLETTER OPT-IN */}
            <label className="flex items-start gap-2.5 text-[11px] text-gray-500 leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={newsletterOptIn}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
                className="mt-0.5 accent-black"
              />
              <span>
                Je souhaite m'inscrire à la newsletter pour recevoir les
                nouveautés et offres exclusives.
              </span>
            </label>

            {/* Anti-robot */}
            <div className="border border-gray-200 p-3.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-gray-400 mb-2">
                Vérification anti-robot
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">
                  {captchaA} + {captchaB} = ?
                </span>
                <Input
                  type="number"
                  value={captchaAnswer}
                  onChange={(e) => checkCaptcha(e.target.value)}
                  placeholder="?"
                  className="h-10 w-20 rounded-none border-gray-200 text-center font-bold focus-visible:ring-black"
                />
                {captchaAnswer && (
                  <span className={`text-xs font-bold ${captchaOk ? "text-emerald-600" : "text-red-500"}`}>
                    {captchaOk ? "✓" : "✗"}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-black hover:bg-gray-800 text-white rounded-none h-12 text-xs font-bold uppercase tracking-[0.15em]"
        >
          {pending ? "Patientez..." : mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </Button>
      </form>

      <p className="mt-6 text-[11px] text-gray-400 text-center leading-relaxed">
        Cet espace est réservé aux clients de la boutique. Les vendeurs et
        administrateurs utilisent l'interface de gestion séparée.
      </p>
    </div>
  );
}

// ─── Espace client connecté ──────────────────────────────────
function LoggedInAccount() {
  const { user, signOut } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [favorites, setFavorites] = useState<any[]>([]);

  const userEmail = user?.email ?? "";

  useEffect(() => {
    if (!userEmail) return;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("commandes_livraison")
          .select("*")
          .eq("client_email", userEmail)
          .order("created_at", { ascending: false });
        setOrders(data ?? []);
      } catch {
        setOrders([]);
      } finally {
        setOrdersLoading(false);
      }
    };
    load();
  }, [userEmail]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("vendly-favorites");
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        if (ids.length > 0) {
          supabase
            .from("articles")
            .select("id, designation, reference, prix_vente, image, prix_promotionnel, promotion_active")
            .in("id", ids)
            .then(({ data }) => setFavorites(data ?? []));
        }
      }
    } catch {}
  }, []);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-xl font-serif uppercase tracking-[0.15em]">
            Mon compte
          </h1>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
            <Mail className="w-3.5 h-3.5" /> {userEmail}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut()}
          className="rounded-none border-gray-200 text-gray-600"
        >
          <LogOut className="w-3.5 h-3.5 mr-2" /> Se déconnecter
        </Button>
      </div>

      {/* COMMANDES */}
      <section>
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-black mb-4">
          <Package className="w-4 h-4" /> Mes commandes
        </h2>
        {ordersLoading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Chargement...</p>
        ) : orders.length === 0 ? (
          <div className="border border-gray-100 py-10 text-center">
            <p className="text-sm text-gray-400">
              Aucune commande pour le moment.
            </p>
            <Link
              to="/shop"
              className="inline-block mt-4 bg-black text-white text-xs font-bold uppercase tracking-[0.15em] px-8 py-3 hover:bg-gray-800 transition-colors"
            >
              Découvrir la boutique
            </Link>
          </div>
        ) : (
          <div className="border border-gray-100 divide-y divide-gray-100">
            {orders.map((o: any) => (
              <div key={o.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-black">
                    Commande #{o.id?.slice(0, 8)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDateTime(o.created_at)}
                    {o.delivery_status ? ` · ${o.delivery_status}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">
                    {formatCurrency(Number(o.total_price || 0))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FAVORIS */}
      <section>
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-black mb-4">
          <Heart className="w-4 h-4" /> Mes favoris
        </h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            Vous n'avez pas encore de favoris.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {favorites.map((a: any) => (
              <Link key={a.id} to="/shop" className="block group">
                <div className="aspect-[3/4] bg-gray-50 overflow-hidden">
                  {a.image ? (
                    <img
                      src={a.image}
                      alt={a.designation}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px] uppercase">
                      Sans image
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.05em] truncate">
                  {a.designation}
                </p>
                <p className="text-[12px] font-medium">
                  {formatCurrency(Number(a.prix_vente || 0))}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-[0.1em]">
        <User className="w-3.5 h-3.5" /> Espace client — géré par Vendly
      </div>
    </div>
  );
}
