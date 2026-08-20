import { useEffect, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatCurrency, resolveImage } from "@/lib/format";

interface Props {
  articles: any[];
  startIndex?: number;
  onClose: () => void;
}

export function FullscreenCatalog({ articles, startIndex = 0, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(articles.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [articles.length, onClose]);

  if (!articles.length) return null;
  const a = articles[Math.min(idx, articles.length - 1)];
  const img = resolveImage(a.image);

  function onTouchStart(e: TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }
  function onTouchEnd(e: TouchEvent) {
    if (touchStart == null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (diff > 50) setIdx((i) => Math.max(0, i - 1));
    else if (diff < -50) setIdx((i) => Math.min(articles.length - 1, i + 1));
    setTouchStart(null);
  }

  const stockColor =
    a.quantite === 0
      ? "bg-destructive text-destructive-foreground"
      : a.quantite <= 2
        ? "bg-accent text-accent-foreground"
        : "bg-emerald-500 text-white";
  const stockLabel = a.quantite === 0 ? "Épuisé" : `${a.quantite} en stock`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        onClick={onClose}
        aria-label="Quitter le plein écran"
        className="absolute right-4 top-4 z-10 rounded-full bg-foreground/10 p-3 backdrop-blur hover:bg-foreground/20"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="absolute left-4 top-4 z-10 rounded-full bg-foreground/10 px-3 py-1.5 text-xs uppercase tracking-widest backdrop-blur">
        {idx + 1} / {articles.length}
      </div>

      {idx > 0 && (
        <button
          onClick={() => setIdx(idx - 1)}
          aria-label="Précédent"
          className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-foreground/10 p-4 backdrop-blur hover:bg-foreground/20 md:block"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {idx < articles.length - 1 && (
        <button
          onClick={() => setIdx(idx + 1)}
          aria-label="Suivant"
          className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-foreground/10 p-4 backdrop-blur hover:bg-foreground/20 md:block"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-12">
        <div className="relative h-[60vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-secondary shadow-2xl">
          {img ? (
            <img src={img} alt={a.designation} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center font-display text-8xl text-muted-foreground/30">
              {a.designation.charAt(0)}
            </div>
          )}
          <span className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wider shadow-md ${stockColor}`}>
            {stockLabel}
          </span>
        </div>

        <div className="w-full max-w-2xl space-y-3 text-center">
          {a.categorie && (
            <p className="text-xs uppercase tracking-[0.3em] text-accent">{a.categorie}</p>
          )}
          <h2 className="font-display text-3xl md:text-5xl">{a.designation}</h2>
          <p className="text-sm text-muted-foreground">Réf. {a.reference}</p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {a.taille && (
              <span className="rounded-full border border-border px-3 py-1 text-xs">
                Taille : {a.taille}
              </span>
            )}
            {a.couleur && (
              <span className="rounded-full border border-border px-3 py-1 text-xs">
                Couleur : {a.couleur}
              </span>
            )}
          </div>

          <p className="pt-4 font-display text-4xl text-accent">{formatCurrency(a.prix_vente)}</p>
        </div>
      </div>

      <div className="flex justify-center gap-4 pb-6 md:hidden">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="rounded-full bg-foreground/10 p-3 backdrop-blur disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setIdx(Math.min(articles.length - 1, idx + 1))}
          disabled={idx === articles.length - 1}
          className="rounded-full bg-foreground/10 p-3 backdrop-blur disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
