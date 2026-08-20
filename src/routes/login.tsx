import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Fingerprint, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  biometricAvailable,
  platformAuthenticatorAvailable,
  enrollBiometric,
  verifyBiometric,
  getStored,
} from "@/lib/biometric";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  useEffect(() => {
    (async () => {
      const ok = biometricAvailable() && (await platformAuthenticatorAvailable());
      setBioSupported(ok);
      setBioEnrolled(!!getStored());
    })();
  }, []);

  async function doSignIn(em: string, pw: string) {
    const { error } = await signIn(em, pw);
    if (error) { toast.error(error); return false; }
    navigate({ to: "/dashboard" });
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    if (mode === "signin") {
      const ok = await doSignIn(email, password);
      if (ok && bioSupported && !bioEnrolled) {
        try { await enrollBiometric(email, password); setBioEnrolled(true); } 
        catch (err: any) { toast.error(err?.message); }
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) toast.error(error); else { navigate({ to: "/dashboard" }); }
    }
    setPending(false);
  }

  return (
    <div className="relative w-full h-screen overflow-hidden flex items-center justify-center p-6">
      
      {/* Conteneur vidéo optimisé pour tous les écrans */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover object-center"
        >
          <source src="/videos/login-background.mp4" type="video/mp4" />
        </video>
        {/* Calque sombre intégré au conteneur vidéo pour une meilleure performance */}
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Login Card */}
      <main className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-1000">
        <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tighter text-white drop-shadow-lg">Vendly</h1>
        </div>

        <div className="bg-white/90 backdrop-blur-lg border border-white/20 rounded-xl p-8 shadow-2xl">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[#091426]">
              {mode === "signin" ? "Bon retour" : "Créer un compte"}
            </h2>
            <p className="text-sm text-slate-600">Connectez-vous à votre interface marchand</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Adresse email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@entreprise.com" required />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Mot de passe</Label>
                {mode === "signin" && <Link to="/forgot-password" className="text-xs text-[#091426] hover:underline">Mot de passe oublié ?</Link>}
              </div>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={pending} className="w-full bg-[#091426] hover:bg-[#1e293b] flex items-center gap-2">
              {pending ? "Patientez..." : <>{mode === "signin" ? "Se connecter" : "S'inscrire"} <ArrowRight size={16} /></>}
            </Button>
          </form>

          {mode === "signin" && bioSupported && bioEnrolled && (
            <Button variant="outline" onClick={async () => {
                const { email: em, password: pw } = await verifyBiometric();
                await doSignIn(em, pw);
            }} className="w-full mt-4 gap-2">
              <Fingerprint size={18} /> Se connecter avec la biométrie
            </Button>
          )}

          <div className="mt-8 pt-6 border-t text-center text-sm">
            {mode === "signin" ? (
              <>Pas encore de compte ? <button onClick={() => setMode("signup")} className="text-[#091426] font-semibold hover:underline">Créer un compte</button></>
            ) : (
              <>Déjà un compte ? <button onClick={() => setMode("signin")} className="text-[#091426] font-semibold hover:underline">Se connecter</button></>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}