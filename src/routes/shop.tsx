import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { MegaMenu, MEGA_MENU_ITEMS } from "@/components/MegaMenu";
import { ProductQuickView } from "@/components/ProductQuickView";
import { categoryMatchesFilter } from "@/lib/categories";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Minus,
  Plus,
  ShoppingBag,
  X,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Heart,
  User,
  Star,
  Ticket,
  Truck,
  LayoutGrid,
  Grid,
  List,
  Globe,
  Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { CartConfirmModal } from "@/components/CartConfirmModal";
import { CheckoutDrawer } from "@/components/CheckoutDrawer";
import { useCurrency } from "@/lib/currency";
import { ReservationModal } from "@/components/ReservationModal";
import { StockConflictAlert } from "@/components/StockConflictAlert";
import { InvoiceModal } from "@/components/InvoiceModal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

// STRUCTURE DU MENU (FILTRES DIOR)
const DIOR_MENU = [
  {
    id: "femme",
    title: "Mode Femme",
    sub: ["Vêtements", "Chaussures", "Sacs", "Accessoires"],
  },
  {
    id: "homme",
    title: "Mode Homme",
    sub: ["Vêtements", "Chaussures", "Sacs", "Accessoires"],
  },
  {
    id: "enfant",
    title: "Mode Enfant",
    sub: ["Vêtements", "Chaussures", "Accessoires"],
  },
  { id: "parfum", title: "Parfums", sub: ["Parfum Homme", "Parfum Femme"] },
  {
    id: "accessoires",
    title: "Accessoires",
    sub: ["Sacs", "Bijoux", "Ceintures", "Montres"],
  },
];

const getColorStyle = (colorName: string, art?: any): React.CSSProperties => {
  const hex = art?.color_galleries?.[colorName]?.hex;
  if (hex && hex.includes(",")) {
    const [c1, c2] = hex.split(",").map((s: string) => s.trim());
    return { background: `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` };
  }
  if (hex) return { backgroundColor: hex };
  const clean = colorName.toLowerCase().trim();
  const colorMap: Record<string, string> = {
    rouge: "#ef4444",
    blue: "#3b82f6",
    bleu: "#3b82f6",
    vert: "#22c55e",
    noir: "#000000",
    blanc: "#ffffff",
    jaune: "#eab308",
    gris: "#6b7280",
    rose: "#ec4899",
    orange: "#f97316",
    violet: "#a855f7",
    marron: "#78350f",
    beige: "#f5f5dc",
    marine: "#000080",
  };
  return { backgroundColor: colorMap[clean] || "#e2e8f0" };
};

const trierTailles = (tailles: string[]) => {
  const ordreLettres = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  return [...tailles].sort((a, b) => {
    const indexA = ordreLettres.indexOf(a.toUpperCase());
    const indexB = ordreLettres.indexOf(b.toUpperCase());
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
};

interface ShopSearchParams {
  genre?: string;
}

export const Route = createFileRoute("/shop")({
  validateSearch: (
    search: Record<string, string | undefined>,
  ): ShopSearchParams => ({
    genre: search?.genre || undefined,
  }),
  component: ShopPage,
});

interface CartItem {
  id: string;
  variante_id: string;
  designation: string;
  reference: string;
  prix_vente: number;
  quantite_selectionnee: number;
  stock_dispo: number;
  categorie?: string;
  image?: string;
  couleur_selectionnee?: string;
  taille_selectionnee?: string;
}

// ==========================================
// COMPOSANT CARTE PRODUIT AVEC FLÈCHES
// ==========================================
function getArticleImages(a: any): string[] {
  if (Array.isArray(a.images)) return a.images;
  if (typeof a.images === "string") {
    try {
      const p = JSON.parse(a.images);
      if (Array.isArray(p)) return p;
    } catch {}
  }
  if (a.image) return [a.image];
  return [];
}

function getDiscountPercent(a: any): number {
  if (!a) return 0;
  if (a.promotion_active && a.prix_promotionnel && a.prix_vente > 0) {
    return Math.round((1 - a.prix_promotionnel / a.prix_vente) * 100);
  }
  return 0;
}

function DiscountBadge({ percent }: { percent: number }) {
  if (percent <= 0) return null;
  return (
    <span className="bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 uppercase rounded-sm">
      PROMO -{percent}%
    </span>
  );
}

function NewBadge() {
  return (
    <span className="bg-black text-white text-[11px] font-bold px-2.5 py-1 uppercase tracking-wider rounded-sm">
      Nouveauté
    </span>
  );
}

function ProductCard({
  art,
  viewMode = "grid",
  onQuickView,
  isFavorite,
  toggleFavorite,
  selectedCouleur,
  selectedTaille,
  onColorChange,
  onSizeChange,
  onAddToCart,
}: {
  art: any;
  viewMode?: "grid" | "compact" | "list";
  onQuickView: (art: any) => void;
  isFavorite: boolean;
  toggleFavorite: (id: string, e: React.MouseEvent) => void;
  selectedCouleur: string;
  selectedTaille: string;
  onColorChange: (id: string, couleur: string) => void;
  onSizeChange: (id: string, taille: string) => void;
  onAddToCart: (art: any) => void;
}) {
  const variantes = art.variantes || [];
  const { formatPrice } = useCurrency();
  const couleursArt = Array.from(
    new Set(variantes.map((v: any) => v.couleur).filter(Boolean)),
  ) as string[];

  const taillesDispo = useMemo(() => {
    const filtered = selectedCouleur
      ? variantes.filter((v: any) => v.couleur === selectedCouleur)
      : variantes;
    return trierTailles(
      Array.from(new Set(filtered.map((v: any) => v.taille).filter(Boolean))),
    );
  }, [variantes, selectedCouleur]);

  const stockForTaille = (taille: string) => {
    const v = variantes.find(
      (v: any) =>
        v.taille === taille &&
        (!selectedCouleur || v.couleur === selectedCouleur),
    );
    return v ? Number(v.stock ?? 0) : 0;
  };

  const itemImages = useMemo(() => {
    const galleryThumbs = Object.values(art.color_galleries || {})
      .map((g: any) => g.thumbnail_url)
      .filter(Boolean);
    const imgs = [
      ...galleryThumbs,
      ...getArticleImages(art),
      ...variantes.map((v: any) => v.image_url),
    ].filter(Boolean);
    return Array.from(new Set(imgs)) as string[];
  }, [art.images, art.image, art.color_galleries, variantes]);

  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (itemImages.length > 1) {
      setCurrentImgIndex((prev) => (prev + 1) % itemImages.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (itemImages.length > 1) {
      setCurrentImgIndex(
        (prev) => (prev - 1 + itemImages.length) % itemImages.length,
      );
    }
  };

  let activeImage = itemImages[currentImgIndex] || art.image;
  if (hoveredColor) {
    const colorGalleries = art.color_galleries || {};
    const gallery = colorGalleries[hoveredColor];
    if (gallery && gallery.thumbnail_url) {
      activeImage = gallery.thumbnail_url;
    } else {
      const variantHov = variantes.find(
        (v: any) => v.couleur === hoveredColor && v.image_url,
      );
      if (variantHov) activeImage = variantHov.image_url;
    }
  }

  const isList = viewMode === "list";
  const isCompact = viewMode === "compact";

  return (
    <div
      className={
        isList
          ? "group cursor-pointer flex flex-row gap-5 items-start"
          : "group cursor-pointer flex flex-col relative"
      }
    >
      <div
        className={
          isList
            ? "relative w-28 md:w-44 aspect-[3/4] shrink-0 bg-[#f8f8f8] overflow-hidden"
            : isCompact
              ? "relative aspect-[3/4] bg-[#f8f8f8] mb-2 overflow-hidden"
              : "relative aspect-[3/4] bg-[#f8f8f8] mb-4 overflow-hidden"
        }
        onClick={() => onQuickView(art)}
      >
        {activeImage ? (
          <img
            src={activeImage}
            alt={art.designation}
            className="w-full h-full object-cover transition-all duration-500 ease-in-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300 text-xs font-light uppercase tracking-widest">
            Sans Image
          </div>
        )}

        <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
          {art.is_new && <NewBadge />}
          <DiscountBadge percent={getDiscountPercent(art)} />
        </div>

        {itemImages.length > 1 && !hoveredColor && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 text-black stroke-[1.5]" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm"
            >
              <ChevronRight className="w-4 h-4 text-black stroke-[1.5]" />
            </button>
          </>
        )}

        <button
          onClick={(e) => toggleFavorite(art.id, e)}
          aria-label="Ajouter aux favoris"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white hover:scale-110 transition-all"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${isFavorite ? "fill-red-500 text-red-500" : "text-black/70 stroke-[1.5] hover:text-red-400"}`}
          />
        </button>
      </div>

      <div
        className={
          isList
            ? "flex-1 flex flex-col gap-1.5 min-w-0"
            : "flex flex-col"
        }
      >
      {couleursArt.length > 0 && (
        <div className={isCompact ? "flex gap-1 mb-1 px-0.5" : "flex gap-1.5 mb-2 px-1"}>
          {couleursArt.slice(0, 5).map((color) => (
            <div
              key={color}
              onClick={(e) => {
                e.stopPropagation();
                onColorChange(art.id, color);
              }}
              onMouseEnter={() => setHoveredColor(color)}
              onMouseLeave={() => setHoveredColor(null)}
              className={`w-3.5 h-3.5 rounded-full border shadow-sm cursor-pointer hover:border-black transition-colors ${
                selectedCouleur === color
                  ? "ring-1 ring-offset-1 ring-black border-transparent"
                  : "border-gray-300"
              }`}
              style={getColorStyle(color, art)}
              title={color}
            />
          ))}
          {couleursArt.length > 5 && (
            <span className="text-[10px] text-gray-500 ml-1">
              +{couleursArt.length - 5}
            </span>
          )}
        </div>
      )}

      {taillesDispo.length > 0 && (
        <div className={isCompact ? "flex flex-wrap gap-1 mb-2 px-0.5" : "flex flex-wrap gap-1 mb-3 px-1"}>
          {taillesDispo.slice(0, 6).map((taille) => {
            const stock = stockForTaille(taille);
            return (
              <div key={taille} className="relative">
                <button
                  type="button"
                  disabled={stock <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSizeChange(art.id, taille);
                  }}
                  className={`px-2 py-0.5 text-[9px] font-bold border transition-all uppercase ${
                  stock <= 0
                    ? "opacity-25 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-300 line-through"
                    : selectedTaille === taille
                      ? "bg-black text-white border-black"
                      : "bg-white text-gray-500 border-gray-200 hover:border-black"
                }`}
                >
                  {taille}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className={isCompact ? "text-left px-0.5 flex-1 flex flex-col" : "text-left px-1 flex-1 flex flex-col"}
        onClick={() => onQuickView(art)}
      >
        <h3 className={`font-semibold text-black uppercase tracking-[0.08em] mb-1 leading-tight ${isCompact ? "text-[11px]" : "text-[13px]"}`}>
          {art.designation}
        </h3>
        {!isCompact && (
          <p className="font-light text-[12px] text-gray-400 mb-2 line-clamp-1">
            {art.description ||
              art.categorie ||
              art.reference ||
              "Exclusivité Vendly"}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto">
          <span className={`font-medium text-black ${isCompact ? "text-[11px]" : "text-[13px]"}`}>
            {art.promotion_active && art.prix_promotionnel ? (
              <>
                <span className="text-red-600">
                  {formatPrice(art.prix_promotionnel)}
                </span>{" "}
                <span className="text-gray-400 line-through text-[11px]">
                  {formatPrice(art.prix_vente)}
                </span>
              </>
            ) : (
              formatPrice(art.prix_vente)
            )}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(art);
            }}
            className={isCompact ? "text-[9px] uppercase tracking-wider font-semibold text-black border border-black px-2 py-0.5 hover:bg-black hover:text-white transition-colors" : "text-[10px] uppercase tracking-wider font-semibold text-black border border-black px-3 py-1 hover:bg-black hover:text-white transition-colors"}
          >
            +
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPOSANT PAGE PRINCIPALE
// ==========================================

// ─── Sélecteur Pays / Devise ───────────────────────────────
function CountrySelector() {
  const { zones, selectedCountry, setSelectedCountry, selectedCurrency } =
    useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const flag = (code: string) =>
    code === "FR" ? "🇫🇷" : code === "TN" ? "🇹🇳" : "🌍";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 cursor-pointer hover:opacity-60 transition-opacity"
        aria-label="Choisir le pays de livraison"
      >
        <Globe className="w-4 h-4 stroke-[1.2] text-black" />
        <span className="text-[11px] font-medium uppercase tracking-wider hidden sm:block">
          {selectedCurrency?.symbol}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 shadow-xl z-50">
          <p className="px-4 py-2 text-[9px] uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100">
            Pays de livraison
          </p>
          {zones.length === 0 && (
            <p className="px-4 py-3 text-[11px] text-gray-400">
              Aucune zone configurée
            </p>
          )}
          {zones.map((z) => (
            <button
              key={z.country_code}
              onClick={() => {
                setSelectedCountry(z.country_code);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-gray-50 transition-colors ${
                selectedCountry === z.country_code
                  ? "font-semibold text-black"
                  : "text-gray-600"
              }`}
            >
              <span>
                {flag(z.country_code)} {z.country_name}
              </span>
              <span className="text-gray-400 text-[10px] uppercase">
                {z.currency_code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShopPage() {
  const qc = useQueryClient();
  const { shippingFeeTnd } = useCurrency();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("vendly-favorites");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<
    "purchase" | "delivery" | "reservation"
  >("purchase");
  const [customerData, setCustomerData] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    email: "",
    governorate: "",
    city: "",
    address: "",
    paymentMethod: "cod",
  });
  const [deliveryData, setDeliveryData] = useState({
    address: "",
    city: "",
    governorate: "",
    courierNotes: "",
    courierCompany: "",
    shippingFees: 0,
  });
  const [promoInput, setPromoInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [activePromoCode, setActivePromoCode] = useState<string>("");
  const [showCartConfirm, setShowCartConfirm] = useState(false);
  const [confirmMode, setConfirmMode] = useState<
    "purchase" | "delivery" | "reservation"
  >("purchase");
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [conflictData, setConflictData] = useState<{
    reservations: any[];
    resolveConflict: () => void;
  } | null>(null);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedCouleurs, setSelectedCouleurs] = useState<
    Record<string, string>
  >({});
  const [selectedTailles, setSelectedTailles] = useState<
    Record<string, string>
  >({});

  // ── Dynamische Konfiguration aus Supabase (single-row `id = 'main'`) ──
  const { data: siteConfig } = useQuery({
    queryKey: ["shop-site-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: promoCodeRows = [] } = useQuery({
    queryKey: ["shop-promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const dynamicPromoMap = useMemo(() => {
    const map: Record<string, { type: string; value: number }> = {};
    promoCodeRows.forEach((c: any) => {
      map[c.code] = { type: c.discount_type, value: c.discount_value };
    });
    return map;
  }, [promoCodeRows]);

  const configJson = (siteConfig as any)?.config_json ?? {};
  const bannerType = (siteConfig as any)?.banner_type ?? "video";
  const bannerDefaultVideo =
    (siteConfig as any)?.video_default ?? "/videos/banner-video.mp4";
  const bannerImages: string[] = Array.isArray(configJson?.banner_images)
    ? configJson.banner_images
    : [];
  const bannerInterval = Number((siteConfig as any)?.banner_interval ?? 3000);
  const bannerVideos: Record<string, string | undefined> = {
    default: (siteConfig as any)?.video_default,
    homme: (siteConfig as any)?.video_homme,
    femme: (siteConfig as any)?.video_femme,
    enfant: (siteConfig as any)?.video_enfant,
  };
  const heroTitle: Record<string, string | undefined> = {
    default: (siteConfig as any)?.title_default,
    homme: (siteConfig as any)?.title_homme,
    femme: (siteConfig as any)?.title_femme,
    enfant: (siteConfig as any)?.title_enfant,
  };
  const heroSubtitle = {
    default: (siteConfig as any)?.subtitle_default,
    homme: (siteConfig as any)?.subtitle_homme,
    femme: (siteConfig as any)?.subtitle_femme,
    enfant: (siteConfig as any)?.subtitle_enfant,
  };
  const promoBannerText = (siteConfig as any)?.promo_banner_text ?? "";
  const deliveryText = (siteConfig as any)?.delivery_text ?? "";
  const defaultDescription = (siteConfig as any)?.default_description ?? "";

  const [openDelivery, setOpenDelivery] = useState(false);
  const [openReviews, setOpenReviews] = useState(false);
  const [openQuestions, setOpenQuestions] = useState(false);

  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [questionsList, setQuestionsList] = useState<any[]>([]);

  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [questionName, setQuestionName] = useState("");
  const [questionText, setQuestionText] = useState("");

  useEffect(() => {
    if (!selectedProduct) return;
    setOpenDelivery(false);
    setOpenReviews(false);
    setOpenQuestions(false);
    setReviewName("");
    setReviewComment("");
    setReviewRating(0);
    setQuestionName("");
    setQuestionText("");

    supabase
      .from("reviews")
      .select("*")
      .eq("article_id", selectedProduct.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setReviewsList(data || []));
    supabase
      .from("questions")
      .select("*")
      .eq("article_id", selectedProduct.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setQuestionsList(data || []));
  }, [selectedProduct]);

  const submitReview = async () => {
    if (!reviewName.trim() || reviewRating === 0) {
      toast.error("Veuillez donner un nom et une note");
      return;
    }
    if (!selectedProduct) return;
    const { error } = await supabase.from("reviews").insert({
      article_id: selectedProduct.id,
      author_name: reviewName.trim(),
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });
    if (error) {
      toast.error("Erreur lors de l'envoi");
      return;
    }
    toast.success("Merci pour votre avis !");
    setReviewName("");
    setReviewRating(0);
    setReviewComment("");
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("article_id", selectedProduct.id)
      .order("created_at", { ascending: false });
    if (data) setReviewsList(data);
  };

  const submitQuestion = async () => {
    if (!questionName.trim() || !questionText.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    if (!selectedProduct) return;
    const { error } = await supabase.from("questions").insert({
      article_id: selectedProduct.id,
      author_name: questionName.trim(),
      question: questionText.trim(),
    });
    if (error) {
      toast.error("Erreur lors de l'envoi");
      return;
    }
    toast.success("Votre question a été envoyée !");
    setQuestionName("");
    setQuestionText("");
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("article_id", selectedProduct.id)
      .order("created_at", { ascending: false });
    if (data) setQuestionsList(data);
  };

  const [sortBy, setSortBy] = useState("designation");
  const [filterGenre, setFilterGenre] = useState<string | null>(null);
  const [filterSubCategory, setFilterSubCategory] = useState<string | null>(
    null,
  );
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterPromo, setFilterPromo] = useState(false);
  const [filterNew, setFilterNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "compact" | "list">("grid");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Détermination dynamique de la vidéo de couverture selon la catégorie sélectionnée
  const activeVideoSrc = useMemo(() => {
    if (!filterGenre) return bannerVideos.default || bannerDefaultVideo;
    const genreClean = filterGenre.toLowerCase();

    if (genreClean.includes("homme"))
      return bannerVideos.homme || bannerDefaultVideo;
    if (genreClean.includes("femme"))
      return bannerVideos.femme || bannerDefaultVideo;
    if (genreClean.includes("enfant"))
      return bannerVideos.enfant || bannerDefaultVideo;

    return bannerDefaultVideo;
  }, [filterGenre, bannerVideos, bannerDefaultVideo]);

  useEffect(() => {
    if (bannerType !== "images" || bannerImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % bannerImages.length);
    }, bannerInterval);
    return () => clearInterval(timer);
  }, [bannerType, bannerImages, bannerInterval]);

  const { genre: urlGenre } = Route.useSearch();

  useEffect(() => {
    if (urlGenre) {
      setFilterGenre(urlGenre);
    }
  }, []);

  const { data: rawArticles = [], isLoading: isLoadingArticles } = useQuery({
    queryKey: ["raw-articles-shop"],
    queryFn: async () => {
      console.log("=== SHOP PAGE: Starting Supabase query for articles ===");
      console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
      console.log("Using anon key for public access");

      try {
        // First, try a simple count to see if table exists and is accessible
        const { count: totalCount, error: countError } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true });

        console.log("Total articles count:", totalCount);
        if (countError) {
          console.error("Count query error:", countError);
          console.error("Error code:", countError.code);
          console.error("Error message:", countError.message);
          console.error("Error hint:", countError.hint);
        }

        // Then fetch actual data
        const { data, error } = await supabase.from("articles").select("*");
        console.log("Supabase query completed. Error:", error);
        console.log("Supabase query data:", data);
        console.log("Data type:", typeof data);
        console.log("Data is array:", Array.isArray(data));

        if (error) {
          console.error("=== SHOP PAGE: Supabase error ===");
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          console.error("Error hint:", error.hint);
          console.error("Error details:", error);

          // Check if it's a permission error
          if (
            error.code === "PGRST116" ||
            error.message.includes("permission")
          ) {
            console.error("PERMISSION ERROR: This suggests RLS policy issue");
            console.error("SOLUTION: Run this SQL in Supabase SQL Editor:");
            console.error(`
-- Enable RLS if not already enabled
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access on articles"
ON articles FOR SELECT
USING (true);

-- If you also need variantes access
ALTER TABLE variantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on variantes"
ON variantes FOR SELECT
USING (true);

-- If you need color_galleries access
ALTER TABLE color_galleries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on color_galleries"
ON color_galleries FOR SELECT
USING (true);
            `);
          }

          throw error;
        }

        console.log("Raw articles fetched:", data?.length, "items");
        console.log("Sample article:", data?.[0]);

        // Log column names if we have data
        if (data && data.length > 0) {
          console.log("Available columns:", Object.keys(data[0]));
        } else {
          console.warn("NO DATA RETURNED: This could indicate:");
          console.warn("1. RLS policy blocking access");
          console.warn("2. Empty table");
          console.warn("3. Permission denied");
        }

        return data ?? [];
      } catch (e) {
        console.error("=== SHOP PAGE: Exception caught ===");
        console.error("Error:", e);
        console.error(
          "Error stack:",
          e instanceof Error ? e.stack : "No stack",
        );
        return [];
      }
    },
    retry: 2,
    staleTime: 15_000,
  });

  const { data: rawVariantes = [], isLoading: isLoadingVariantes } = useQuery({
    queryKey: ["raw-variantes-shop"],
    queryFn: async () => {
      console.log("=== SHOP PAGE: Loading variantes ===");
      try {
        const { data, error } = await supabase.from("variantes").select("*");
        if (error) {
          console.error("Variantes error:", error);
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          throw error;
        }
        console.log("Variantes loaded:", data?.length, "items");
        if (data && data.length > 0) {
          console.log("Sample variante:", data[0]);
          console.log("Available columns:", Object.keys(data[0]));
          // Log stock distribution
          const stockDistribution = data.map((v: any) => v.stock).filter((s: any) => s > 0);
          console.log("Stock distribution:", stockDistribution.length, "variants with stock > 0");
        }
        return data ?? [];
      } catch (e) {
        console.error("Erreur chargement variantes (shop):", e);
        return [];
      }
    },
    retry: 2,
    staleTime: 15_000,
  });

  const { data: colorGalleriesRows = [] } = useQuery({
    queryKey: ["color-galleries-shop"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("color_galleries")
          .select("*");
        if (error) throw error;
        return data ?? [];
      } catch (e) {
        console.error("Erreur chargement galeries couleurs (shop):", e);
        return [];
      }
    },
    staleTime: 30_000,
    retry: 1,
  });

  const isLoading = isLoadingArticles || isLoadingVariantes;

  const colorGalleriesByArticle = useMemo(() => {
    const map: Record<
      string,
      Record<string, { thumbnail_url: string; images: string[]; hex: string }>
    > = {};
    colorGalleriesRows.forEach((g: any) => {
      if (!map[g.article_id]) map[g.article_id] = {};
      map[g.article_id][g.color_name] = {
        thumbnail_url: g.thumbnail_url || "",
        images: g.images || [],
        hex: g.hex || "",
      };
    });
    return map;
  }, [colorGalleriesRows]);

  const articlesAvecVariantes = useMemo(() => {
    console.log(
      "Processing articles:",
      rawArticles.length,
      "with variants:",
      rawVariantes.length,
    );
    return rawArticles.map((article) => {
      const artVariantes = rawVariantes.filter(
        (v) => v.article_id === article.id,
      );
      console.log("Article:", article.designation, "has", artVariantes.length, "variants");
      if (artVariantes.length > 0) {
        const stockInfo = artVariantes.map((v: any) => ({
          taille: v.taille,
          couleur: v.couleur,
          stock: v.stock
        }));
        console.log("  Stock info:", stockInfo);
      }
      return {
        ...article,
        variantes: artVariantes,
        color_galleries: colorGalleriesByArticle[article.id] || {},
      };
    });
  }, [rawArticles, rawVariantes, colorGalleriesByArticle]);

  // Compteur de soldes : strictement aligné sur la condition de la liste affichée
  const saleCount = useMemo(() => {
    return articlesAvecVariantes.filter(
      (art: any) =>
        art.promotion_active === true &&
        art.archived !== true &&
        art.status !== "archive" &&
        art.status !== "supprime",
    ).length;
  }, [articlesAvecVariantes]);

  // Compteur de nouveautés
  const newCount = useMemo(() => {
    return articlesAvecVariantes.filter(
      (art: any) =>
        art.is_new === true &&
        art.archived !== true &&
        art.status !== "archive" &&
        art.status !== "supprime",
    ).length;
  }, [articlesAvecVariantes]);

  const handleFilterClick = (genre: string, subCategory: string | null) => {
    setFilterGenre(genre);
    setFilterSubCategory(subCategory);
    setIsMenuOpen(false);
  };

  const clearAllFilters = () => {
    setFilterGenre(null);
    setFilterSubCategory(null);
    setFilterPromo(false);
    setFilterNew(false);
    setIsMenuOpen(false);
  };

  const filteredAndSortedArticles = useMemo(() => {
    const filtered = articlesAvecVariantes
      .filter((art: any) => {
        // Only filter out truly deleted/archived items
        if (art.status === "supprime") return false;

        // Log article details for debugging
        console.log(
          "Article:",
          art.designation,
          "| Category:",
          art.categorie,
          "| Status:",
          art.status,
          "| Archived:",
          art.archived,
        );

        // Filter out archived items
        if (art.archived === true || art.status === "archive") {
          console.log("Filtered out (archived):", art.designation);
          return false;
        }

        // Filter favorites
        if (showFavoritesOnly && !favorites.includes(art.id)) {
          console.log("Filtered out (not favorite):", art.designation);
          return false;
        }

        // Filter promo
        if (filterPromo && !art.promotion_active) {
          console.log("Filtered out (not promo):", art.designation);
          return false;
        }

        // Filter nouveautés
        if (filterNew && !art.is_new) {
          console.log("Filtered out (not new):", art.designation);
          return false;
        }

        // Recherche libre
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const hay = [
            art.designation,
            art.reference,
            art.categorie,
            art.description,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }

        // Filter by category (temporarily disabled for testing)
        if (filterGenre || filterSubCategory) {
          const matches = categoryMatchesFilter(
            art.categorie,
            filterGenre,
            filterSubCategory,
          );
          if (!matches) {
            console.log(
              "Filtered out (category mismatch):",
              art.designation,
              "category:",
              art.categorie,
              "filterGenre:",
              filterGenre,
              "filterSubCategory:",
              filterSubCategory,
            );
          }
          return matches;
        }

        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "prix_asc")
          return Number(a.prix_vente || 0) - Number(b.prix_vente || 0);
        if (sortBy === "prix_desc")
          return Number(b.prix_vente || 0) - Number(a.prix_vente || 0);
        return (a.designation || "").localeCompare(b.designation || "");
      });

    console.log("Articles with variants:", articlesAvecVariantes.length);
    console.log("Filtered articles:", filtered.length);
    console.log("Filter genre:", filterGenre);
    console.log("Filter subcategory:", filterSubCategory);
    console.log("Filter promo:", filterPromo);

    return filtered;
  }, [
    articlesAvecVariantes,
    filterGenre,
    filterSubCategory,
    filterPromo,
    filterNew,
    searchQuery,
    sortBy,
    showFavoritesOnly,
    favorites,
  ]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((fId) => fId !== id)
        : [...prev, id];
      try {
        localStorage.setItem("vendly-favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
    toast.success(
      favorites.includes(id) ? "Retiré des favoris" : "Ajouté aux favoris",
    );
  };

  const handleQuickView = (art: any) => {
    setSelectedProduct(art);
  };

  const addToCart = (article: any, couleur: string, taille: string) => {
    const variantes = article.variantes || [];
    const n = (s: string) => s?.trim().toLowerCase() ?? "";
    const isTu = (s: string) =>
      ["tu", "unique", "taille unique", ""].includes(n(s));

    const varianteExacte =
      variantes.find(
        (v: any) => n(v.couleur) === n(couleur) && n(v.taille) === n(taille),
      ) ||
      variantes.find(
        (v: any) =>
          n(v.couleur) === n(couleur) && isTu(taille) && isTu(v.taille),
      ) ||
      variantes.find((v: any) => n(v.couleur) === n(couleur)) ||
      variantes[0] ||
      (variantes.length === 0
        ? {
            id: `virtuel-${article.id}`,
            stock: article.quantite || 0,
            couleur,
            taille,
          }
        : null);

    if (!varianteExacte) {
      toast.error("Combinaison indisponible");
      return;
    }

    const stockDisponible = Number(
      varianteExacte.stock ?? varianteExacte.quantite ?? 0,
    );
    if (stockDisponible <= 0) {
      toast.error("Rupture de stock pour cette déclinaison");
      return;
    }

    const imagePanier = varianteExacte.image_url || article.image;

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.variante_id === varianteExacte.id,
      );
      if (existing) {
        if (existing.quantite_selectionnee >= stockDisponible) {
          toast.error("Stock maximal atteint");
          return prev;
        }
        return prev.map((item) =>
          item.variante_id === varianteExacte.id
            ? { ...item, quantite_selectionnee: item.quantite_selectionnee + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: article.id,
          variante_id: varianteExacte.id,
          designation: article.designation,
          reference: article.reference,
          prix_vente: Number(article.prix_vente),
          quantite_selectionnee: 1,
          stock_dispo: stockDisponible,
          categorie: article.categorie,
          image: imagePanier,
          couleur_selectionnee: couleur,
          taille_selectionnee: taille,
        },
      ];
    });
    toast.success("Ajouté au panier");
  };

  const removeFromCart = (varianteId: string) => {
    setCart((prev) => prev.filter((item) => item.variante_id !== varianteId));
  };

  const updateQuantity = (varianteId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.variante_id === varianteId) {
          const nouvelleQuantite = item.quantite_selectionnee + delta;
          if (nouvelleQuantite <= 0) return item;
          if (nouvelleQuantite > item.stock_dispo) return item;
          return { ...item, quantite_selectionnee: nouvelleQuantite };
        }
        return item;
      }),
    );
  };

  const handleApplyPromo = () => {
    const code = promoInput.toUpperCase().trim();
    const promo = dynamicPromoMap[code];
    if (promo) {
      const discount =
        promo.type === "fixed"
          ? Math.round((promo.value / subTotal) * 100 * 100) / 100
          : promo.value;
      setAppliedDiscount(discount);
      setActivePromoCode(code);
      toast.success(`Code promo ${code} appliqué !`);
    } else {
      toast.error("Code promo invalide");
    }
  };

  const cartCount = cart.reduce(
    (acc, item) => acc + item.quantite_selectionnee,
    0,
  );
  const subTotal = cart.reduce(
    (acc, item) => acc + item.prix_vente * item.quantite_selectionnee,
    0,
  );
  const discountAmount = (subTotal * appliedDiscount) / 100;
  const cartTotal = subTotal - discountAmount;

  const reservationMutation = useMutation({
    mutationFn: async (data: {
      nom: string;
      prenom: string;
      telephone: string;
      delayType: string;
      expiresAt: Date;
    }) => {
      if (cart.length === 0) return;
      const cartItems = cart.map((item) => ({
        article_id: item.id,
        variante_id: item.variante_id,
        quantite: item.quantite_selectionnee,
        designation: item.designation,
        prix_unitaire: item.prix_vente,
        taille: item.taille_selectionnee,
        couleur: item.couleur_selectionnee,
      }));
      const { error } = await supabase.from("reservations").insert([
        {
          nom: data.nom,
          prenom: data.prenom,
          telephone: data.telephone,
          items: cartItems,
          date_expiration: data.expiresAt.toISOString(),
          duree_heures:
            data.delayType === "24h"
              ? 24
              : data.delayType === "48h"
                ? 48
                : data.delayType === "72h"
                  ? 72
                  : 4,
          delay_type: data.delayType,
          statut: "en_attente",
        },
      ]);
      if (error) throw error;
      for (const item of cart) {
        if (!item.variante_id.startsWith("virtuel-")) {
          const nouveauStock = Math.max(
            0,
            item.stock_dispo - item.quantite_selectionnee,
          );
          await supabase
            .from("variantes")
            .update({ stock: nouveauStock })
            .eq("id", item.variante_id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Réservation confirmée !");
      setCart([]);
      setIsCartOpen(false);
      setShowCheckoutForm(false);
      setShowReservationModal(false);
      qc.invalidateQueries({ queryKey: ["raw-articles-shop"] });
      qc.invalidateQueries({ queryKey: ["raw-variantes-shop"] });
    },
    onError: (error: any) =>
      toast.error(error.message || "Erreur lors de la réservation."),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) return;
      const cartItems = cart.map((item) => ({
        article_id: item.id,
        variante_id: item.variante_id,
        quantite: item.quantite_selectionnee,
        designation: item.designation,
        prix_unitaire: item.prix_vente,
        taille: item.taille_selectionnee,
        couleur: item.couleur_selectionnee,
      }));

      const decrementStock = async () => {
        for (const item of cart) {
          if (!item.variante_id.startsWith("virtuel-")) {
            const nouveauStock = Math.max(
              0,
              item.stock_dispo - item.quantite_selectionnee,
            );
            await supabase
              .from("variantes")
              .update({ stock: nouveauStock })
              .eq("id", item.variante_id);
          }
        }
      };

      if (confirmMode === "purchase") {
        const { error: saleError } = await supabase.from("sales").insert([
          {
            items: cartItems,
            total: cartTotal,
            customer_name:
              `${customerData.prenom} ${customerData.nom}`.trim() || "Comptoir",
            customer_phone: customerData.telephone || "",
            payment_method: "especes",
          },
        ]);
        if (saleError) throw saleError;
        await decrementStock();
      } else if (confirmMode === "delivery") {
        if (
          !customerData.address.trim() ||
          !customerData.telephone.trim() ||
          !customerData.governorate
        ) {
          throw new Error(
            "Veuillez remplir le Nom, Téléphone, Gouvernorat et Adresse de livraison.",
          );
        }
        const deliveryPayload: Record<string, any> = {
          items: cartItems,
          total_price: cartTotal + shippingFeeTnd,
          client_firstname: customerData.prenom,
          client_lastname: customerData.nom,
          client_phone: customerData.telephone,
          client_email: customerData.email || undefined,
          client_address: customerData.address,
          client_city: customerData.city || undefined,
          client_governorate: customerData.governorate,
          shipping_fees: shippingFeeTnd,
          payment_method: customerData.paymentMethod || "cod",
          delivery_status: "prepared",
        };
        // Colonnes absentes de la table (avant migration SQL) : retry avec les colonnes existantes
        const insertDelivery = async (payload: Record<string, any>) => {
          const { error } = await supabase
            .from("commandes_livraison")
            .insert([payload]);
          if (!error) return;
          if (error.code === "42703") {
            const fallback = { ...payload };
            delete fallback.items;
            delete fallback.client_email;
            delete fallback.client_city;
            delete fallback.client_governorate;
            delete fallback.shipping_fees;
            const { error: err2 } = await supabase
              .from("commandes_livraison")
              .insert([fallback]);
            if (err2) throw err2;
            return;
          }
          throw error;
        };
        await insertDelivery(deliveryPayload);
        await decrementStock();
      } else {
        const { error: resError } = await supabase.from("reservations").insert([
          {
            nom: customerData.nom,
            prenom: customerData.prenom,
            telephone: customerData.telephone,
            items: cartItems,
            date_expiration: new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(),
            statut: "en_attente",
          },
        ]);
        if (resError) throw resError;
        await decrementStock();
      }
    },
    onSuccess: () => {
      const msgs: Record<string, string> = {
        purchase: "Vente comptoir enregistrée !",
        delivery: "Commande livraison créée !",
        reservation: "Réservation confirmée !",
      };
      toast.success(msgs[confirmMode] || "Succès !");

      if (confirmMode === "purchase" || confirmMode === "delivery") {
        const invNumber = `FACT-${Date.now().toString(36).toUpperCase()}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;
        setInvoiceData({
          invoiceNumber: invNumber,
          createdAt: new Date().toISOString(),
          paymentMethod: "Espèces",
          customerName:
            confirmMode === "delivery"
              ? `${customerData.prenom} ${customerData.nom}`.trim() || undefined
              : undefined,
          customerPhone: customerData.telephone || undefined,
          customerAddress:
            confirmMode === "delivery" ? customerData.address : undefined,
          items: [...cart],
          subtotal: subTotal,
          discountPercent: appliedDiscount > 0 ? appliedDiscount : undefined,
          discountCode: activePromoCode || undefined,
          shippingFees:
            confirmMode === "delivery" ? shippingFeeTnd : undefined,
          total:
            cartTotal +
            (confirmMode === "delivery" ? shippingFeeTnd : 0),
          isDelivery: confirmMode === "delivery",
        });
      }

      setCart([]);
      setIsCartOpen(false);
      setShowCheckoutForm(false);
      setCheckoutMode("purchase");
      setAppliedDiscount(0);
      setActivePromoCode("");
      setPromoInput("");
      qc.invalidateQueries({ queryKey: ["raw-articles-shop"] });
      qc.invalidateQueries({ queryKey: ["raw-variantes-shop"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la validation.");
    },
  });

  const handleConfirmCheckout = () => {
    if (
      !customerData.nom.trim() ||
      !customerData.prenom.trim() ||
      !customerData.telephone.trim() ||
      !customerData.governorate ||
      !customerData.address.trim()
    ) {
      toast.error("Veuillez remplir tous les champs obligatoires (nom, téléphone, gouvernorat, adresse).");
      return;
    }
    setConfirmMode("delivery");
    checkoutMutation.mutate();
  };

  const modalExtraSections = selectedProduct && (
    <>
      {/* LIVRAISON & RETOURS */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setOpenDelivery(!openDelivery)}
          className="w-full py-4 flex justify-between items-center text-left text-[11px] font-semibold uppercase tracking-wider text-black"
        >
          <span>Livraison & Retours</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${openDelivery ? "rotate-180" : ""}`}
          />
        </button>
        {openDelivery && (
          <div className="pb-4 text-[12px] font-light text-gray-600 leading-relaxed">
            <p>
              {deliveryText ||
                "Livraison sécurisée à domicile ou recueil immédiat disponible dans nos points de vente partenaires. Retours gratuits sous 14 jours."}
            </p>
          </div>
        )}
      </div>

      {/* AVIS CLIENTS */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setOpenReviews(!openReviews)}
          className="w-full py-4 flex justify-between items-center text-left text-[11px] font-semibold uppercase tracking-wider text-black"
        >
          <span>
            Avis Clients {reviewsList.length > 0 && `(${reviewsList.length})`}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${openReviews ? "rotate-180" : ""}`}
          />
        </button>
        {openReviews && (
          <div className="pb-4 space-y-4">
            {reviewsList.length > 0 && (
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <span className="text-lg font-serif font-bold">
                  {(
                    reviewsList.reduce((s: number, r: any) => s + r.rating, 0) /
                    reviewsList.length
                  ).toFixed(1)}
                </span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${s <= Math.round(reviewsList.reduce((a: number, r: any) => a + r.rating, 0) / reviewsList.length) ? "text-yellow-500 fill-yellow-500" : "text-gray-200"}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-gray-400">
                  {reviewsList.length} avis
                </span>
              </div>
            )}

            <div className="space-y-3 max-h-48 overflow-y-auto">
              {reviewsList.map((r: any) => (
                <div key={r.id} className="text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.author_name}</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-200"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-gray-600 mt-0.5">{r.comment}</p>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
              {reviewsList.length === 0 && (
                <p className="text-[12px] text-gray-400 italic">
                  Aucun avis pour le moment.
                </p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-wider block">
                Donner mon avis
              </span>
              <input
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                placeholder="Votre nom"
                className="w-full border border-gray-200 px-3 py-2 text-[12px] focus:outline-none focus:border-black"
              />
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setReviewRating(s)}
                  >
                    <Star
                      className={`w-5 h-5 ${s <= reviewRating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"} hover:text-yellow-400 transition-colors`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Votre commentaire (optionnel)"
                className="text-[12px] min-h-[60px] border-gray-200 focus:border-black rounded-none"
              />
              <button
                onClick={submitReview}
                className="w-full bg-black text-white text-[11px] uppercase tracking-wider py-2.5 font-medium hover:bg-gray-900 transition-colors"
              >
                Envoyer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QUESTIONS */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setOpenQuestions(!openQuestions)}
          className="w-full py-4 flex justify-between items-center text-left text-[11px] font-semibold uppercase tracking-wider text-black"
        >
          <span>
            Questions {questionsList.length > 0 && `(${questionsList.length})`}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${openQuestions ? "rotate-180" : ""}`}
          />
        </button>
        {openQuestions && (
          <div className="pb-4 space-y-4">
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {questionsList.map((q: any) => (
                <div
                  key={q.id}
                  className="text-[12px] border-l-2 border-gray-200 pl-3"
                >
                  <p className="font-medium text-gray-800">
                    <span className="text-gray-400">Q :</span> {q.question}
                  </p>
                  <p className="text-gray-500 mt-1">
                    <span className="text-gray-400">R :</span>{" "}
                    {q.answer || (
                      <span className="italic text-gray-300">
                        En attente de réponse
                      </span>
                    )}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    {new Date(q.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))}
              {questionsList.length === 0 && (
                <p className="text-[12px] text-gray-400 italic">
                  Aucune question pour le moment.
                </p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <span className="text-[11px] font-medium uppercase tracking-wider block">
                Poser une question
              </span>
              <input
                value={questionName}
                onChange={(e) => setQuestionName(e.target.value)}
                placeholder="Votre nom"
                className="w-full border border-gray-200 px-3 py-2 text-[12px] focus:outline-none focus:border-black"
              />
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Votre question"
                className="text-[12px] min-h-[60px] border-gray-200 focus:border-black rounded-none"
              />
              <button
                onClick={submitQuestion}
                className="w-full bg-black text-white text-[11px] uppercase tracking-wider py-2.5 font-medium hover:bg-gray-900 transition-colors"
              >
                Envoyer
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased overflow-x-hidden">
      {/* NAVBAR STYLE DIOR */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 py-4 px-6 md:px-12">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer group hover:opacity-70 transition-opacity">
                <div className="w-5 h-4 flex flex-col justify-between">
                  <div className="w-full h-[1px] bg-black"></div>
                  <div className="w-full h-[1px] bg-black"></div>
                  <div className="w-full h-[1px] bg-black"></div>
                </div>
                <span className="hidden md:block text-[11px] font-medium tracking-[0.1em] uppercase">
                  Menu
                </span>
              </div>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-full sm:w-[400px] bg-white border-r-0 p-0 overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <Link
                  to="/"
                  className="flex items-center gap-2 group hover:opacity-60 transition-opacity"
                  title="Retour à l'accueil"
                >
                  <ArrowLeft className="w-5 h-5 text-black stroke-[1.5]" />
                  <span className="text-[11px] font-medium tracking-[0.1em] uppercase">
                    Accueil
                  </span>
                </Link>
                <SheetClose className="flex items-center gap-2 group hover:opacity-60 transition-opacity">
                  <span className="text-[11px] font-medium tracking-[0.1em] uppercase">
                    Fermer
                  </span>
                  <X className="w-5 h-5 text-black stroke-[1.5]" />
                </SheetClose>
              </div>

              <div className="p-8 space-y-6">
                <button
                  onClick={() => clearAllFilters()}
                  className="w-full text-left text-sm font-light tracking-[0.1em] uppercase text-black hover:opacity-50 transition-opacity"
                >
                  Toutes les collections
                </button>
                {DIOR_MENU.map((menu) => (
                  <div key={menu.id} className="border-b border-gray-100 pb-4">
                    <button
                      onClick={() =>
                        setExpandedMenu(
                          expandedMenu === menu.id ? null : menu.id,
                        )
                      }
                      className="flex justify-between items-center w-full text-left text-sm font-medium tracking-[0.1em] uppercase text-black"
                    >
                      {menu.title}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-300 stroke-[1.5] ${expandedMenu === menu.id ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${expandedMenu === menu.id ? "max-h-96 opacity-100 pt-6 space-y-4" : "max-h-0 opacity-0"}`}
                    >
                      <button
                        onClick={() => handleFilterClick(menu.title, null)}
                        className="block w-full text-left text-[12px] font-light tracking-[0.05em] text-gray-500 hover:text-black"
                      >
                        Voir tout {menu.title.toLowerCase()}
                      </button>
                      {menu.sub.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => handleFilterClick(menu.title, sub)}
                          className="block w-full text-left text-[12px] font-light tracking-[0.05em] text-gray-500 hover:text-black"
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <div className="text-2xl md:text-3xl font-serif tracking-[0.25em] uppercase absolute left-1/2 -translate-x-1/2 font-semibold">
            VENDLY
          </div>

          <div className="flex items-center gap-5 md:gap-7">
            <button
              onClick={() => setIsSearchOpen((o) => !o)}
              aria-label="Rechercher"
              className="hidden md:block cursor-pointer hover:opacity-60 transition-opacity"
            >
              <Search className="w-5 h-5 stroke-[1.2] text-black" />
            </button>
            <button
              onClick={() => setIsAccountOpen((o) => !o)}
              aria-label="Mon compte"
              className="hidden md:block cursor-pointer hover:opacity-60 transition-opacity"
            >
              <User className="w-5 h-5 stroke-[1.2] text-black" />
            </button>
            <CountrySelector />
            <div
              className="relative cursor-pointer hover:opacity-60 transition-opacity"
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
              title={showFavoritesOnly ? "Voir tout" : "Voir favoris"}
            >
              <Heart
                className={`w-5 h-5 stroke-[1.2] transition-colors ${showFavoritesOnly ? "fill-red-500 text-red-500" : "text-black"}`}
              />
              {favorites.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-black text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                  {favorites.length}
                </span>
              )}
            </div>

            <div
              className="relative cursor-pointer hover:opacity-60 transition-opacity"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingBag className="w-5 h-5 stroke-[1.2] text-black" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-black text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* PANEL RECHERCHE */}
      {isSearchOpen && (
        <div className="border-b border-gray-100 bg-white px-6 md:px-12 py-4">
          <div className="max-w-[1800px] mx-auto flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un article, une référence, une catégorie..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-300 border-b border-gray-200 pb-2 focus:border-black transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[11px] uppercase tracking-widest text-gray-400 hover:text-black"
              >
                Effacer
              </button>
            )}
            <button
              onClick={() => setIsSearchOpen(false)}
              aria-label="Fermer la recherche"
              className="p-1 hover:opacity-60 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {searchQuery.trim() && (
            <div className="max-w-[1800px] mx-auto mt-2 text-[11px] text-gray-400 uppercase tracking-widest">
              {filteredAndSortedArticles.length} résultat
              {filteredAndSortedArticles.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      <AnnouncementBanner />

      {/* BANNIÈRE MÉDIA MISE EN VALEUR ET CENTRÉE */}
      <div className="w-full h-[50vh] md:h-[70vh] bg-gray-100 relative overflow-hidden">
        {bannerType === "video" ? (
          <video
            key={activeVideoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover object-center"
          >
            <source src={activeVideoSrc} type="video/mp4" />
          </video>
        ) : (
          bannerImages.map((src, index) => (
            <img
              key={src}
              src={src}
              alt="Bannière"
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? "opacity-100" : "opacity-0"}`}
            />
          ))
        )}

        <div className="absolute inset-0 bg-black/20 z-10" />

        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <h1 className="text-5xl md:text-7xl font-serif text-white tracking-[0.25em] uppercase font-semibold drop-shadow-2xl select-none">
            VENDLY
          </h1>
        </div>

        <button
          onClick={() =>
            document
              .getElementById("articles-section")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center text-white shadow-lg animate-bounce hover:bg-white/30 transition-all"
          aria-label="Voir les articles"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* MEGA MENU */}
      <MegaMenu
        items={MEGA_MENU_ITEMS}
        activeGenre={filterGenre}
        activeSubCategory={filterSubCategory}
        isAllActive={!filterGenre && !filterPromo && !filterNew}
        saleCount={saleCount}
        isSaleActive={filterPromo}
        isNewActive={filterNew}
        newCount={newCount}
        onSelectNew={() => {
          setFilterNew(true);
          setFilterGenre(null);
          setFilterSubCategory(null);
          setFilterPromo(false);
        }}
        onSelectSale={() => {
          setFilterPromo(true);
          setFilterGenre(null);
          setFilterSubCategory(null);
          setFilterNew(false);
        }}
        onSelectAll={() => {
          setFilterGenre(null);
          setFilterSubCategory(null);
          setFilterPromo(false);
          setFilterNew(false);
        }}
        onSelectGenre={(genre) => {
          setFilterGenre(genre);
          setFilterSubCategory(null);
          setFilterPromo(false);
          setFilterNew(false);
        }}
        onSelectSubCategory={(genre, subCategory) => {
          setFilterGenre(genre);
          setFilterSubCategory(subCategory);
          setFilterPromo(false);
          setFilterNew(false);
        }}
      />

      <div className="py-10 text-center bg-white px-4">
        {(filterGenre || filterSubCategory || filterPromo || filterNew) ? (
          <button
            onClick={clearAllFilters}
            title="Afficher tout le catalogue"
            className="text-2xl md:text-3xl font-serif uppercase tracking-[0.15em] font-medium text-black cursor-pointer hover:opacity-70 transition-opacity"
          >
            {filterNew
              ? "Nouveautés"
              : filterPromo
                ? "Soldes"
                : filterGenre
                  ? filterSubCategory
                    ? `${filterGenre} > ${filterSubCategory}`
                    : filterGenre
                  : heroTitle.default || "Collection Exclusive"}
          </button>
        ) : (
          <h1 className="text-2xl md:text-3xl font-serif uppercase tracking-[0.15em] font-medium">
            {heroTitle.default || "Collection Exclusive"}
          </h1>
        )}
        <p className="text-gray-500 font-light text-[11px] md:text-xs tracking-[0.15em] uppercase mt-3">
          {filterGenre === "Mode Homme"
            ? heroSubtitle.homme || "Savoir-faire et Élégance"
            : filterGenre === "Mode Femme"
              ? heroSubtitle.femme || "Savoir-faire et Élégance"
              : filterGenre === "Mode Enfant"
                ? heroSubtitle.enfant || "Savoir-faire et Élégance"
                : heroSubtitle.default ||
                  "Savoir-faire et Élégance intemporelle"}
        </p>
      </div>

      {/* BANNIÈRE PROMO */}
      {promoBannerText && (
        <div className="bg-black text-white text-center py-3 px-4 text-[11px] tracking-[0.2em] uppercase font-light">
          {promoBannerText}
        </div>
      )}

      {/* GRILLE PRODUITS PRINCIPALE */}
      <main
        id="articles-section"
        className="max-w-[1800px] mx-auto px-6 md:px-12 pb-32"
      >
        <div className="flex flex-col gap-3 mb-8 pb-4 border-b border-gray-200 sm:flex-row sm:justify-between sm:items-center sm:mb-12">
          <p className="text-[11px] font-light text-gray-500 uppercase tracking-[0.1em]">
            {filteredAndSortedArticles.length}{" "}
            {filteredAndSortedArticles.length > 1 ? "articles" : "article"}
            {filterGenre && (
              <span className="text-black">
                {" "}
                • {filterGenre}
                {filterSubCategory && <> &gt; {filterSubCategory}</>}
              </span>
            )}
            {filterPromo && (
              <span className="text-black">
                {" "}
                • Soldes
              </span>
            )}
            {filterNew && (
              <span className="text-black">
                {" "}
                • Nouveautés
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {(filterGenre || filterPromo || filterNew || showFavoritesOnly) && (
              <button
                onClick={() => {
                  clearAllFilters();
                  setShowFavoritesOnly(false);
                }}
                className="text-[11px] text-gray-400 hover:text-black uppercase tracking-[0.1em] underline underline-offset-4 whitespace-nowrap"
              >
                {showFavoritesOnly ? "Voir tout" : "Réinitialiser les filtres"}
              </button>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border-none text-[11px] bg-transparent font-medium uppercase tracking-[0.1em] text-black focus:outline-none cursor-pointer"
            >
              <option value="designation">Trier par Nom</option>
              <option value="prix_asc">Prix Croissant</option>
              <option value="prix_desc">Prix Décroissant</option>
            </select>
            <div className="flex items-center gap-1 sm:border-l sm:border-gray-200 sm:pl-4">
              <button
                onClick={() => setViewMode("grid")}
                title="Grille standard"
                className={`p-1.5 rounded transition-colors ${
                  viewMode === "grid"
                    ? "bg-black text-white"
                    : "text-gray-400 hover:text-black"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("compact")}
                title="Petite grille"
                className={`p-1.5 rounded transition-colors ${
                  viewMode === "compact"
                    ? "bg-black text-white"
                    : "text-gray-400 hover:text-black"
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="Vue liste"
                className={`p-1.5 rounded transition-colors ${
                  viewMode === "list"
                    ? "bg-black text-white"
                    : "text-gray-400 hover:text-black"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-32 text-xs font-medium uppercase tracking-widest text-gray-400">
            Chargement du catalogue...
            <div className="mt-4 text-[10px] text-gray-300">
              Chargement des articles depuis Supabase...
            </div>
          </div>
        ) : filteredAndSortedArticles.length === 0 ? (
          <div className="text-center py-28 flex flex-col items-center gap-8">
            <div className="w-16 h-px bg-gray-200" />
            <p className="text-sm font-medium text-gray-500 uppercase tracking-[0.15em]">
              {filterNew
                ? "Aucune nouveauté pour le moment."
                : filterPromo
                  ? "Aucun article en solde pour le moment."
                  : "Aucun article dans cette catégorie pour le moment."}
            </p>
            <button
              onClick={clearAllFilters}
              className="mt-2 px-10 py-4 bg-black text-white text-[11px] font-medium uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors"
            >
              Voir tous les articles
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === "list"
                ? "flex flex-col gap-4"
                : viewMode === "compact"
                  ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3"
                  : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-16 md:gap-x-10 md:gap-y-24"
            }
          >
            {filteredAndSortedArticles.map((art: any) => (
              <ProductCard
                key={art.id}
                art={art}
                viewMode={viewMode}
                onQuickView={handleQuickView}
                isFavorite={favorites.includes(art.id)}
                toggleFavorite={toggleFavorite}
                selectedCouleur={selectedCouleurs[art.id] || ""}
                selectedTaille={selectedTailles[art.id] || ""}
                onColorChange={(id, couleur) => {
                  setSelectedCouleurs((prev) => ({ ...prev, [id]: couleur }));
                  const v = art.variantes || [];
                  const tailes = trierTailles(
                    Array.from(
                      new Set(
                        v
                          .filter(
                            (va: any) => va.couleur === couleur || !va.couleur,
                          )
                          .map((va: any) => va.taille)
                          .filter(Boolean),
                      ),
                    ),
                  );
                  if (tailes.length)
                    setSelectedTailles((prev) => ({
                      ...prev,
                      [id]: tailes[0],
                    }));
                }}
                onSizeChange={(id, taille) =>
                  setSelectedTailles((prev) => ({ ...prev, [id]: taille }))
                }
                onAddToCart={(art) => {
                  const v = art.variantes || [];
                  let couleur = selectedCouleurs[art.id] || "";
                  let taille = selectedTailles[art.id] || "";
                  if (!couleur && v.length > 0) {
                    const first = v[0];
                    couleur = first.couleur || "Unique";
                    if (!taille) taille = first.taille || "Unique";
                  }
                  if (!taille && v.length > 0) {
                    toast.error("Veuillez sélectionner une taille");
                    return;
                  }
                  addToCart(art, couleur, taille);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {selectedProduct && (
        <ProductQuickView
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
          secondaryAction={(couleur, taille) => (
            <Button
              variant="outline"
              className="w-full border border-gray-300 text-black hover:bg-gray-50 uppercase tracking-[0.15em] font-medium text-xs h-12 rounded-none transition-colors"
              onClick={() => {
                addToCart(selectedProduct!, couleur, taille);
                setSelectedProduct(null);
                setIsCartOpen(true);
                setShowReservationModal(true);
              }}
            >
              Réserver en boutique
            </Button>
          )}
          extraSections={modalExtraSections}
        />
      )}

      <ReservationModal
        open={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        onConfirm={(data) => {
          setShowReservationModal(false);
          reservationMutation.mutate(data);
        }}
        items={cart}
        total={cartTotal}
        isSubmitting={reservationMutation.isPending}
      />

      <StockConflictAlert
        open={!!conflictData}
        onClose={() => setConflictData(null)}
        onForceSale={() => {
          conflictData?.resolveConflict();
          setConflictData(null);
        }}
        reservations={conflictData?.reservations || []}
      />

      {isCartOpen && (
        <CheckoutDrawer
          cart={cart}
          cartTotal={cartTotal}
          subTotal={subTotal}
          discountAmount={discountAmount}
          appliedDiscount={appliedDiscount}
          activePromoCode={activePromoCode}
          promoInput={promoInput}
          customerData={customerData}
          checkoutMutation={checkoutMutation}
          onClose={() => setIsCartOpen(false)}
          onUpdateQuantity={updateQuantity}
          onRemoveFromCart={removeFromCart}
          onApplyPromo={handleApplyPromo}
          onSetPromoInput={setPromoInput}
          onCustomerDataChange={setCustomerData}
          onConfirm={handleConfirmCheckout}
        />
      )}

      <CartConfirmModal
        open={showCartConfirm}
        onClose={() => setShowCartConfirm(false)}
        onConfirm={async () => {
          setShowCartConfirm(false);
          if (confirmMode !== "purchase") {
            checkoutMutation.mutate();
            return;
          }
          // Détection de conflit : vérifier les réservations actives
          try {
            const conflictItems: any[] = [];
            for (const item of cart) {
              if (item.variante_id.startsWith("virtuel-")) continue;
              const { data } = await supabase.rpc(
                "get_active_reservations_for_variante",
                {
                  p_variante_id: item.variante_id,
                },
              );
              const active = (data as any[]) || [];
              const totalReserved = active.reduce(
                (s: number, r: any) => s + Number(r.quantite_reservee || 0),
                0,
              );
              if (totalReserved > 0 && totalReserved >= item.stock_dispo) {
                conflictItems.push(...active);
              }
            }
            if (conflictItems.length > 0) {
              setConflictData({
                reservations: conflictItems,
                resolveConflict: async () => {
                  for (const conflict of conflictItems) {
                    await supabase
                      .from("reservations")
                      .update({ statut: "expiré" })
                      .eq("id", conflict.id);
                  }
                  checkoutMutation.mutate();
                },
              });
              return;
            }
          } catch {}
          checkoutMutation.mutate();
        }}
        mode={confirmMode}
        items={cart}
        subtotal={subTotal}
        discount={appliedDiscount}
        discountCode={activePromoCode}
        customerName={customerData.nom}
        customerPrenom={customerData.prenom}
        isSubmitting={checkoutMutation.isPending}
      />

      <InvoiceModal
        open={!!invoiceData}
        onClose={() => setInvoiceData(null)}
        data={invoiceData}
      />

      {/* MODALE COMPTE CLIENT */}
      {isAccountOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex items-start justify-center pt-32"
          onClick={() => setIsAccountOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md border border-gray-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em]">
                Mon compte
              </h2>
              <button
                onClick={() => setIsAccountOpen(false)}
                className="p-1 hover:opacity-60 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-8 py-8 space-y-4">
              <Link
                to="/compte"
                className="block w-full text-center bg-black text-white py-3 text-xs font-bold uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors"
                onClick={() => setIsAccountOpen(false)}
              >
                Se connecter
              </Link>
              <Link
                to="/compte"
                className="block w-full text-center border border-gray-300 text-black py-3 text-xs font-bold uppercase tracking-[0.2em] hover:bg-gray-50 transition-colors"
                onClick={() => setIsAccountOpen(false)}
              >
                Créer un compte
              </Link>
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                Connectez-vous pour suivre vos commandes, gérer vos favoris et
                bénéficier d'une expérience personnalisée.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
