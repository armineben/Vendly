import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("Email envoyé. Vérifiez votre boîte de réception.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={72} />
          <h1 className="font-display text-3xl">Mot de passe oublié</h1>
          <p className="text-sm text-muted-foreground">
            Saisissez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm">
            <p>
              Si un compte existe pour <span className="font-medium">{email}</span>,
              vous recevrez un email avec un lien pour réinitialiser votre mot de passe.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-accent underline"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@boutique.fr"
              />
            </div>
            <Button
              type="submit"
              disabled={pending}
              className="w-full bg-foreground text-background hover:bg-foreground/90"
            >
              {pending ? "Envoi…" : "Envoyer le lien"}
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-accent underline">
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
