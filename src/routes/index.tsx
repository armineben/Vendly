import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/")({ component: WelcomeVendly });

function WelcomeVendly() {
  const navigate = useNavigate();
  // États
  const [activeSide, setActiveSide] = useState<"left" | "right">("left");
  const [isCardVisible, setIsCardVisible] = useState(false);

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

  // Fonction de navigation avec TanStack Router
  const handleNavigation = (genre: string) => {
    navigate({ to: "/shop", search: { genre } });
  };

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
              <button
                onClick={() => handleNavigation("Mode Homme")}
                className="underline underline-offset-8 tracking-widest text-xs uppercase hover:scale-105 transition-transform font-medium cursor-pointer"
              >
                Mode Homme
              </button>
              <button
                onClick={() => handleNavigation("Mode Enfant")}
                className="underline underline-offset-8 tracking-widest text-xs uppercase hover:scale-105 transition-transform font-medium cursor-pointer"
              >
                Mode Enfant
              </button>
            </div>
          </div>
        </div>

        {/* Logo Central - Style identique au Catalogue */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 cursor-pointer pointer-events-auto"
          onMouseEnter={() => setIsCardVisible(true)}
          onMouseLeave={() => setIsCardVisible(false)}
          onClick={() => handleNavigation("")}
        >
          <h1 className="text-4xl md:text-6xl text-white font-serif tracking-[0.25em] uppercase font-semibold drop-shadow-2xl select-none transition-all hover:scale-105 pointer-events-auto">
            VENDLY
          </h1>

          <div 
            className={`absolute top-full mt-4 left-1/2 -translate-x-1/2 w-[320px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-8 text-center shadow-2xl transition-all duration-500 ${
              isCardVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            }`}
          >
            <h2 className="text-xl font-bold text-white mb-4">Découvrir le Catalogue</h2>
            <p className="text-xs text-white/80 mb-6">Explorez nos dernières collections mode.</p>
            <button 
              onClick={() => handleNavigation("")} 
              className="bg-white text-black text-xs font-bold uppercase py-3 px-6 rounded-full hover:bg-gray-200 transition"
            >
              Accéder au Shop
            </button>
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
            <button
              onClick={() => handleNavigation("Mode Femme")}
              className="underline underline-offset-8 tracking-widest text-xs uppercase hover:scale-105 transition-transform font-medium pointer-events-auto relative z-50 cursor-pointer"
            >
              Mode Femme
            </button>
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
            <input type="email" placeholder="Votre email" className="border-b border-black w-full py-1 focus:outline-none"/>
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