import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const APP_MODE = (import.meta.env.VITE_APP_MODE || "client") as
  | "client"
  | "admin";

export const Route = createFileRoute("/")({ component: WelcomeVendly });

function WelcomeVendly() {
  const navigate = useNavigate();

  // En mode admin, la racine redirige immédiatement vers le dashboard admin
  useEffect(() => {
    if (APP_MODE === "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [navigate]);

  // États
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email || !email.includes("@")) {
      toast.error("Veuillez saisir une adresse email valide.");
      return;
    }
    setSubscribing(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert({ email });
      if (error) {
        if (error.code === "23505") {
          toast.success("Vous êtes déjà inscrit à notre newsletter !");
        } else {
          toast.error("Erreur lors de l'inscription. Veuillez réessayer.");
        }
        return;
      }
      setSubscribed(true);
      setNewsletterEmail("");
      toast.success("Merci ! Vous êtes bien inscrit à notre newsletter.");
    } catch {
      toast.error("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubscribing(false);
    }
  };

  // Rotation automatique sur mobile
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const interval = setInterval(() => {
        setActiveSide((prev) => (prev === "left" ? "right" : "left"));
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen font-serif bg-black">
      <main className="flex flex-col md:flex-row flex-grow w-full h-screen relative overflow-hidden">
        
        {/* Côté Gauche : Homme & Enfant */}
        <div
          className={`relative w-full md:w-1/2 h-1/2 md:h-full transition-all duration-700 ${activeSide === 'left' ? 'md:w-[60%]' : 'md:w-[40%]'}`}
        >
          {/* Zone de détection hover */}
          <div
            className="absolute inset-0 z-0"
            onMouseEnter={() => setActiveSide("left")}
          />
          <video
            key="video-homme"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          >
            <source src="/videos/homme-enfant.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-end pb-16 text-white transition-opacity duration-500 hover:bg-black/20 pointer-events-none">
            <h2 className="text-3xl mb-6 font-light font-serif tracking-wide">Homme & Enfant</h2>
            <div className="flex gap-8 pointer-events-auto relative z-50">
              <Link
                to="/shop"
                search={{ genre: "Mode Homme" }}
                className="underline underline-offset-8 tracking-widest text-xs uppercase hover:scale-105 transition-transform font-medium cursor-pointer"
              >
                Mode Homme
              </Link>
              <Link
                to="/shop"
                search={{ genre: "Mode Enfant" }}
                className="underline underline-offset-8 tracking-widest text-xs uppercase hover:scale-105 transition-transform font-medium cursor-pointer"
              >
                Mode Enfant
              </Link>
            </div>
          </div>
        </div>

        {/* Logo Central - Style identique au Catalogue */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 cursor-pointer pointer-events-auto"
          onMouseEnter={() => setIsCardVisible(true)}
          onMouseLeave={() => setIsCardVisible(false)}
        >
          <Link
            to="/shop"
            search={{ genre: "" }}
            className="text-4xl md:text-6xl text-white font-serif tracking-[0.25em] uppercase font-semibold drop-shadow-2xl select-none transition-all hover:scale-105 pointer-events-auto"
          >
            VENDLY
          </Link>

          <div 
            className={`absolute top-full mt-4 left-1/2 -translate-x-1/2 w-[320px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-8 text-center shadow-2xl transition-all duration-500 ${
              isCardVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <h2 className="text-xl font-bold text-white mb-4">Découvrir le Catalogue</h2>
            <p className="text-xs text-white/80 mb-6">Explorez nos dernières collections mode.</p>
            <Link
              to="/shop"
              search={{ genre: "" }}
              className="inline-block bg-white text-black text-xs font-bold uppercase py-3 px-6 rounded-full hover:bg-gray-200 transition"
            >
              Accéder au Shop
            </Link>
          </div>
        </div>

        {/* Côté Droit : Femme */}
        <div
          className={`relative w-full md:w-1/2 h-1/2 md:h-full transition-all duration-700 ${activeSide === 'right' ? 'md:w-[60%]' : 'md:w-[40%]'}`}
        >
          {/* Zone de détection hover */}
          <div
            className="absolute inset-0 z-0"
            onMouseEnter={() => setActiveSide("right")}
          />
          <video
            key="video-femme"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          >
            <source src="/videos/femme.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-end pb-16 text-white transition-opacity duration-500 hover:bg-black/20 pointer-events-none">
            <h2 className="text-3xl mb-6 font-light font-serif tracking-wide">Mode Femme</h2>
            <Link
              to="/shop"
              search={{ genre: "Mode Femme" }}
              className="underline underline-offset-8 tracking-widest text-xs uppercase hover:scale-105 transition-transform font-medium pointer-events-auto relative z-50 cursor-pointer"
            >
              Mode Femme
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-white py-16 px-10 border-t pointer-events-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-sm text-gray-800">
          <div>
            <h3 className="font-bold mb-4 uppercase">Contact</h3>
            <p>Email: contact@vendly.com</p>
            <p>Tunis, Tunisie</p>
          </div>
          <div>
            <h3 className="font-bold mb-4 uppercase">Newsletter</h3>
            {subscribed ? (
              <p className="text-xs text-gray-600">✅ Inscrit avec succès !</p>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Votre email"
                  disabled={subscribing}
                  className="flex-1 border-b border-black py-1 text-sm focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="text-xs font-bold uppercase tracking-wider whitespace-nowrap hover:opacity-60 transition-opacity disabled:opacity-40"
                >
                  {subscribing ? "..." : "OK"}
                </button>
              </form>
            )}
          </div>
          <div>
            <h3 className="font-bold mb-4 uppercase">Suivez-nous</h3>
            <div className="flex gap-4">
              <span>Instagram</span><span>Facebook</span><span>Pinterest</span>
            </div>
          </div>
        </div>
        <div className="text-center mt-12 text-xs text-gray-500">© 2026 VENDLY - TOUS DROITS RÉSERVÉS</div>
      </footer>
    </div>
  );
}