import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  ShoppingBag,
  Plus,
  Minus,
  X,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Ticket,
  User,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ZoomableImage } from "@/components/ZoomableImage";
import { MegaMenu, MEGA_MENU_ITEMS } from "@/components/MegaMenu";
import { categoryMatchesFilter } from "@/lib/categories";
import { CartConfirmModal } from "@/components/CartConfirmModal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export const Route = createFileRoute("/_authenticated/catalogue")({
  component: Catalogue,
});

const BANNER_CONFIG: {
  type: "video" | "images";
  defaultVideo: string;
  images: string[];
  interval: number;
} = {
  type: "video",
  defaultVideo: "/videos/banner-video.mp4",
  images: [
    "/images/couverture1.jpg",
    "/images/couverture2.jpg",
    "/images/couverture3.jpg",
  ],
  interval: 5000,
};


const DIOR_MENU = [
  {
    id: "Vêtements",
    title: "Vêtements",
    sub: ["Femme", "Homme", "Enfant", "Bébé"],
  },
  { id: "Chaussures", title: "Chaussures", sub: ["Chaussures"] },
  { id: "Parfums", title: "Parfums", sub: ["Parfum Homme", "Parfum Femme"] },
  { id: "Accessoires", title: "Accessoires", sub: ["Accessoire", "Montres"] },
];

const PROMO_CODES: Record<string, number> = {
  SOLDES20: 20,
  VENDLY10: 10,
  VIP50: 50,
};

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
    red: "#ef4444",
    bleu: "#3b82f6",
    blue: "#3b82f6",
    vert: "#22c55e",
    green: "#22c55e",
    noir: "#1A1A1A",
    black: "#1A1A1A",
    blanc: "#ffffff",
    white: "#ffffff",
    jaune: "#eab308",
    yellow: "#eab308",
    gris: "#6b7280",
    grey: "#6b7280",
    gray: "#6b7280",
    "gris clair": "#f5f5f5",
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

interface CartItem {
  id: string;
  variante_id: string;
  designation: string;
  reference: string;
  prix_vente: number;
  prix_achat: number;
  quantite_selectionnee: number;
  prix_personnalise: number;
  stock_dispo: number;
  categorie?: string;
  image?: string;
  couleur_selectionnee?: string;
  taille_selectionnee?: string;
}

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
    <span className="absolute top-3 left-3 z-10 bg-red-600 text-white text-xs font-bold px-2.5 py-1 uppercase rounded-sm">
      PROMO -{percent}%
    </span>
  );
}

function ProductCard({
  art,
  onQuickView,
  onQuickAdd,
  selectedCouleur,
  selectedTaille,
  onColorChange,
  onSizeChange,
}: {
  art: any;
  onQuickView: (art: any) => void;
  onQuickAdd: (art: any) => void;
  selectedCouleur: string;
  selectedTaille: string;
  onColorChange: (id: string, couleur: string) => void;
  onSizeChange: (id: string, taille: string) => void;
}) {
  const variantes = art.variantes || [];
  const couleursArt = Array.from(
    new Set(variantes.map((v: any) => v.couleur).filter(Boolean)),
  ) as string[];

  const couleurActive = selectedCouleur || couleursArt[0] || "";

  const taillesDispo = useMemo(() => {
    const brutes = variantes
      .filter((v: any) => !v.couleur || v.couleur === couleurActive)
      .map((v: any) => v.taille)
      .filter(Boolean);
    return trierTailles(Array.from(new Set(brutes)));
  }, [variantes, couleurActive]);

  const tailleActive = selectedTaille || taillesDispo[0] || "";

  const varianteActive = variantes.find(
    (v: any) => v.couleur === couleurActive && v.taille === tailleActive,
  );
  const stockAffiche =
    variantes.length > 0
      ? Number(varianteActive?.stock ?? varianteActive?.quantite ?? 0)
      : Number(art.quantite ?? 0);

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

  return (
    <div className="group cursor-pointer flex flex-col relative">
      <div
        className="relative aspect-[3/4] bg-[#f8f8f8] mb-4 overflow-hidden"
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
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd(art);
          }}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105 z-10"
        >
          <Plus className="w-4 h-4 text-black stroke-[1.5]" />
        </button>

        <span className="absolute bottom-3 left-3 text-[10px] font-bold tracking-wider uppercase px-2 py-1 bg-white/90 border border-gray-200 text-gray-700 rounded-none shadow-sm">
          Stock: {stockAffiche}
        </span>
        <DiscountBadge percent={getDiscountPercent(art)} />
      </div>

      {couleursArt.length > 0 && (
        <div className="flex gap-1.5 mb-3 px-1">
          {couleursArt.slice(0, 5).map((color) => (
            <div
              key={color}
              onMouseEnter={() => setHoveredColor(color)}
              onMouseLeave={() => setHoveredColor(null)}
              onClick={(e) => {
                e.stopPropagation();
                onColorChange(art.id, color);
              }}
              className={`w-3.5 h-3.5 rounded-full border border-gray-300 shadow-sm cursor-pointer hover:border-black transition-colors ${couleurActive === color ? "ring-1 ring-offset-1 ring-black" : ""}`}
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

      <div
        className="text-left px-1 flex-1 flex flex-col"
        onClick={() => onQuickView(art)}
      >
        <h3 className="font-semibold text-[13px] text-black uppercase tracking-[0.08em] mb-1 leading-tight">
          {art.designation}
        </h3>
        <p className="font-light text-[12px] text-gray-400 mb-2 line-clamp-1">
          {art.categorie || art.reference || "Exclusivité Vendly"}
        </p>
        {art.promotion_active && art.prix_promotionnel ? (
          <div className="mt-auto flex items-center gap-1.5">
            <span className="font-medium text-[13px] text-red-600">
              {formatCurrency(art.prix_promotionnel)}
            </span>
            <span className="text-[11px] text-gray-400 line-through">
              {formatCurrency(art.prix_vente)}
            </span>
          </div>
        ) : (
          <span className="font-medium text-[13px] text-black mt-auto">
            {formatCurrency(art.prix_vente)}
          </span>
        )}
      </div>

      {taillesDispo.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 px-1">
          {taillesDispo.slice(0, 6).map((taille) => (
            <button
              key={taille}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSizeChange(art.id, taille);
              }}
              className={`px-2 py-0.5 text-[9px] font-bold border transition-all uppercase ${
                tailleActive === taille
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-500 border-gray-200 hover:border-black"
              }`}
            >
              {taille}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Catalogue() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showInCartConfirm, setShowInCartConfirm] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedCouleur, setSelectedCouleur] = useState("");
  const [selectedTaille, setSelectedTaille] = useState("");
  const [activeModalImage, setActiveModalImage] = useState<string>("");

  const [openDescription, setOpenDescription] = useState(true);

  const [sortBy, setSortBy] = useState("designation");
  const [filterGenre, setFilterGenre] = useState<string | null>(null);
  const [filterSubCategory, setFilterSubCategory] = useState<string | null>(
    null,
  );
  const [filterPromo, setFilterPromo] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const [promoInput, setPromoInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [activePromoCode, setActivePromoCode] = useState<string>("");
  const [showCartConfirm, setShowCartConfirm] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"purchase" | "reservation">(
    "purchase",
  );
  const [reservationName, setReservationName] = useState("");
  const [reservationPrenom, setReservationPrenom] = useState("");
  const [showReservationForm, setShowReservationForm] = useState(false);

  const [selectedCouleurs, setSelectedCouleurs] = useState<
    Record<string, string>
  >({});
  const [selectedTailles, setSelectedTailles] = useState<
    Record<string, string>
  >({});

  const activeVideoSrc = useMemo(() => {
    if (!filterGenre) return BANNER_CONFIG.defaultVideo;
    const g = filterGenre.toLowerCase();
    if (g.includes("homme")) return "/videos/Vhomme.mp4";
    if (g.includes("femme")) return "/videos/Vfemme.mp4";
    if (g.includes("enfant")) return "/videos/Venfents.mp4";
    return BANNER_CONFIG.defaultVideo;
  }, [filterGenre]);

  const isAdmin = user?.role === "PREMIUM ADMIN" || user?.role === "admin";

  useEffect(() => {
    if (BANNER_CONFIG.type !== "images" || BANNER_CONFIG.images.length <= 1)
      return;
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BANNER_CONFIG.images.length);
    }, BANNER_CONFIG.interval);
    return () => clearInterval(timer);
  }, []);

  const { data: rawArticles = [], isLoading } = useQuery({
    queryKey: ["articles-catalogue"],
    queryFn: async () => {
      const { data: articlesData, error: articlesError } = await supabase
        .from("articles")
        .select("*")
        .eq("archived", false)
        .order("designation");

      if (articlesError) throw articlesError;
      if (!articlesData || articlesData.length === 0) return [];

      const articleIds = articlesData.map((art) => art.id);
      const [variantesResult, galleriesResult] = await Promise.all([
        supabase.from("variantes").select("*").in("article_id", articleIds),
        supabase.from("color_galleries").select("*").in("article_id", articleIds),
      ]);

      if (variantesResult.error) {
        return articlesData.map((art) => ({ ...art, variantes: [] }));
      }

      const galleriesByArticle: Record<string, Record<string, { thumbnail_url: string; images: string[]; hex: string }>> = {};
      (galleriesResult.data || []).forEach((g: any) => {
        if (!galleriesByArticle[g.article_id]) galleriesByArticle[g.article_id] = {};
        galleriesByArticle[g.article_id][g.color_name] = { thumbnail_url: g.thumbnail_url || "", images: g.images || [], hex: g.hex || "" };
      });

      return articlesData.map((art) => ({
        ...art,
        variantes: variantesResult.data?.filter((v) => v.article_id === art.id) || [],
        color_galleries: galleriesByArticle[art.id] || {},
      }));
    },
  });

  const { data: saleCount = 0 } = useQuery({
    queryKey: ["sale-count-catalogue"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("archived", false)
        .eq("promotion_active", true);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const handleFilterClick = (genre: string, subCategory: string | null) => {
    setFilterGenre(genre);
    setFilterSubCategory(subCategory);
    setIsMenuOpen(false);
  };

  const clearAllFilters = () => {
    setFilterGenre(null);
    setFilterSubCategory(null);
    setFilterPromo(false);
    setIsMenuOpen(false);
  };

  const filteredArticles = useMemo(() => {
    return rawArticles
      .filter((art: any) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !art.designation?.toLowerCase().includes(q) &&
            !art.reference?.toLowerCase().includes(q)
          )
            return false;
        }
        if (
          !categoryMatchesFilter(art.categorie, filterGenre, filterSubCategory)
        )
          return false;
        if (filterPromo && !art.promotion_active) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        if (sortBy === "prix_asc")
          return Number(a.prix_vente || 0) - Number(b.prix_vente || 0);
        if (sortBy === "prix_desc")
          return Number(b.prix_vente || 0) - Number(a.prix_vente || 0);
        return (a.designation || "").localeCompare(b.designation || "");
      });
  }, [rawArticles, searchQuery, filterGenre, filterSubCategory, filterPromo, sortBy]);

  const handleQuickView = (art: any) => {
    setSelectedProduct(art);
    const v = art.variantes || [];
    const couleursArt = Array.from(
      new Set(v.map((va: any) => va.couleur).filter(Boolean)),
    ) as string[];
    const firstColor = couleursArt[0] || "Unique";
    setSelectedCouleur(firstColor);

    const taillesLies = v
      .filter((va: any) => va.couleur === firstColor || !va.couleur)
      .map((va: any) => va.taille)
      .filter(Boolean);
    const triLies = trierTailles(Array.from(new Set(taillesLies)));
    setSelectedTaille(triLies[0] || "");

    // Image initiale : priorité à la galerie couleur
    const gallery = (art.color_galleries || {})[firstColor];
    if (gallery && gallery.images && gallery.images.length > 0) {
      setActiveModalImage(gallery.images[0]);
    } else {
      const variantImg = v.find(
        (va: any) => va.couleur === firstColor && va.image_url,
      );
      setActiveModalImage(variantImg?.image_url || art.image || "");
    }
  };

  const modalAllImages = useMemo(() => {
    if (!selectedProduct) return [];
    const mv = selectedProduct.variantes || [];
    if (selectedCouleur) {
      const galleries = selectedProduct.color_galleries || {};
      const gallery = galleries[selectedCouleur];
      if (gallery && gallery.images && gallery.images.length > 0) {
        return gallery.images;
      }
      const variantImgs = mv
        .filter((v: any) => v.couleur === selectedCouleur && v.image_url)
        .map((v: any) => v.image_url);
      if (variantImgs.length > 0) return Array.from(new Set(variantImgs)) as string[];
    }
    return [];
  }, [selectedProduct, selectedCouleur]);

  const modalVariantesDefault = selectedProduct ? selectedProduct.variantes || [] : [];

  const { data: freshVariantes = [] } = useQuery({
    queryKey: ["product-variants", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      const { data, error } = await supabase
        .from("variantes")
        .select("*")
        .eq("article_id", selectedProduct.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedProduct?.id,
  });

  const modalVariantes = freshVariantes.length > 0 ? freshVariantes : modalVariantesDefault;
  const couleursUniquesModal = useMemo(() => {
    if (!selectedProduct) return [];
    return Array.from(
      new Set(modalVariantes.map((v: any) => v.couleur).filter(Boolean)),
    ) as string[];
  }, [selectedProduct, modalVariantes]);

  const taillesUniquesDispoModal = useMemo(() => {
    if (!selectedProduct) return [];
    const brutes = modalVariantes
      .filter((v: any) => !v.couleur || v.couleur === selectedCouleur)
      .map((v: any) => v.taille)
      .filter(Boolean);
    return trierTailles(Array.from(new Set(brutes)));
  }, [selectedProduct, modalVariantes, selectedCouleur]);

  const handleColorChange = (id: string, couleur: string) => {
    setSelectedCouleurs((prev) => ({ ...prev, [id]: couleur }));
    const art = rawArticles.find((a: any) => a.id === id);
    if (art) {
      const nt = (art.variantes || [])
        .filter((v: any) => v.couleur === couleur)
        .map((v: any) => v.taille);
      setSelectedTailles((prev) => ({ ...prev, [id]: nt[0] || "" }));
    }
  };

  const handleSizeChange = (id: string, taille: string) => {
    setSelectedTailles((prev) => ({ ...prev, [id]: taille }));
  };

  const addToCart = (article: any, couleur?: string, taille?: string) => {
    const variantes = article.variantes || [];
    const couleurChoisie =
      couleur ||
      selectedCouleurs[article.id] ||
      (
        Array.from(
          new Set(variantes.map((v: any) => v.couleur).filter(Boolean)),
        ) as string[]
      )[0] ||
      "";
    const tailleChoisie = taille || selectedTailles[article.id] || "";

    const n = (s: string) => s?.trim().toLowerCase() ?? "";
    const isTu = (s: string) => ["tu", "unique", "taille unique", ""].includes(n(s));

    const varianteExacte =
      variantes.find((v: any) => n(v.couleur) === n(couleurChoisie) && n(v.taille) === n(tailleChoisie)) ||
      variantes.find((v: any) => n(v.couleur) === n(couleurChoisie) && isTu(tailleChoisie) && isTu(v.taille)) ||
      variantes.find((v: any) => n(v.couleur) === n(couleurChoisie)) ||
      variantes[0] ||
      (variantes.length === 0
        ? {
            id: `virtuel-${article.id}`,
            stock: article.quantite || 0,
            couleur: couleurChoisie,
            taille: tailleChoisie,
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
          prix_achat: Number(article.prix_achat || 0),
          quantite_selectionnee: 1,
          prix_personnalise: Number(article.prix_vente),
          stock_dispo: stockDisponible,
          categorie: article.categorie,
          image: imagePanier,
          couleur_selectionnee: couleurChoisie,
          taille_selectionnee: tailleChoisie,
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

  const updateCartItemPrice = (varianteId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.variante_id === varianteId
          ? { ...item, prix_personnalise: newPrice }
          : item,
      ),
    );
  };

  const handleApplyPromo = () => {
    const code = promoInput.toUpperCase().trim();
    if (PROMO_CODES[code] !== undefined) {
      setAppliedDiscount(PROMO_CODES[code]);
      setActivePromoCode(code);
      toast.success(`Code promo ${code} appliqué (${PROMO_CODES[code]}%)`);
    } else {
      toast.error("Code promo invalide");
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) return;
      if (!user) throw new Error("Utilisateur non connecté");

      const itemsPayload = cart.map((item) => {
        const prixBase = Number(item.prix_personnalise);
        const prixRemise =
          appliedDiscount > 0
            ? prixBase * (1 - appliedDiscount / 100)
            : prixBase;
        return {
          article_id: item.id,
          variante_id: item.variante_id,
          quantite: Number(item.quantite_selectionnee),
          prix_unitaire: Number(prixRemise),
          prix_achat_unitaire: Number(item.prix_achat || 0),
          total: Number(prixRemise * item.quantite_selectionnee),
        };
      });

      const { error } = await supabase.rpc("valider_panier_vente", {
        p_vendeur_id: user.id,
        p_items: itemsPayload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vente enregistrée avec succès !");
      setCart([]);
      setIsCartOpen(false);
      setShowInCartConfirm(false);
      setAppliedDiscount(0);
      setActivePromoCode("");
      setPromoInput("");
      qc.invalidateQueries({ queryKey: ["articles-catalogue"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la validation.");
    },
  });

  const reservationMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) return;
      if (!reservationName.trim() || !reservationPrenom.trim()) {
        throw new Error("Veuillez saisir le nom et le prénom du client.");
      }

      const { error: resError } = await supabase.from("reservations").insert([
        {
          nom: reservationName,
          prenom: reservationPrenom,
          telephone: "",
          vendeur_id: user?.id,
          items: cart.map((item) => ({
            article_id: item.id,
            variante_id: item.variante_id,
            quantite: item.quantite_selectionnee,
            designation: item.designation,
            couleur: item.couleur_selectionnee,
            taille: item.taille_selectionnee,
            prix_unitaire: item.prix_personnalise,
          })),
          date_expiration: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          statut: "en_attente",
        },
      ]);
      if (resError) throw resError;

      for (const item of cart) {
        if (!item.variante_id.startsWith("virtuel-")) {
          const nouveauStock = Math.max(
            0,
            item.stock_dispo - item.quantite_selectionnee,
          );
          const { error: stockError } = await supabase
            .from("variantes")
            .update({ stock: nouveauStock })
            .eq("id", item.variante_id);
          if (stockError) throw stockError;
        }
      }
    },
    onSuccess: () => {
      toast.success("Réservation confirmée ! Les articles sont bloqués 24h.");
      setCart([]);
      setIsCartOpen(false);
      setShowInCartConfirm(false);
      setAppliedDiscount(0);
      setActivePromoCode("");
      setPromoInput("");
      setReservationName("");
      setReservationPrenom("");
      qc.invalidateQueries({ queryKey: ["articles-catalogue"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la réservation.");
    },
  });

  const cartCount = cart.reduce(
    (acc, item) => acc + item.quantite_selectionnee,
    0,
  );
  const subTotal = cart.reduce(
    (acc, item) => acc + item.prix_personnalise * item.quantite_selectionnee,
    0,
  );
  const cartTotal = subTotal - (subTotal * appliedDiscount) / 100;

  return (
    <div className="min-h-screen bg-white text-black font-sans antialiased">
      {/* HEADER STYLE SHOP */}
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
                <span className="text-[11px] font-medium tracking-[0.1em] uppercase">
                  Menu
                </span>
              </div>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-full sm:w-[400px] bg-white border-r-0 p-0 overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100 flex justify-end items-center bg-white sticky top-0 z-10">
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
                  Toutes les catégories
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

          <div className="flex items-center gap-5 md:gap-7">
            <div className="relative hidden md:flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 stroke-[1.5] pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-xs pl-9 pr-3 py-2 w-48 outline-none focus:border-black transition-colors uppercase tracking-[0.05em]"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] font-light text-gray-500 tracking-[0.05em]">
              <User className="w-4 h-4 stroke-[1.2]" />
              <span className="hidden md:inline truncate max-w-[120px]">
                {user?.email || "Vendeur"}
              </span>
            </div>

            <Sheet
              open={isCartOpen}
              onOpenChange={(open) => {
                setIsCartOpen(open);
                if (!open) setShowInCartConfirm(false);
              }}
            >
              <SheetTrigger asChild>
                <div className="relative cursor-pointer hover:opacity-60 transition-opacity">
                  <ShoppingBag className="w-5 h-5 stroke-[1.2] text-black" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-black text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </div>
              </SheetTrigger>

              <SheetContent className="w-full sm:max-w-md bg-white p-6 flex flex-col justify-between z-[100]">
                <div>
                  <SheetHeader className="border-b border-gray-100 pb-4 mb-6">
                    <SheetTitle className="font-medium text-lg uppercase tracking-[0.1em] text-center">
                      Panier Vente
                    </SheetTitle>
                  </SheetHeader>
                  {cart.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm font-light tracking-widest uppercase">
                      Panier vide
                    </div>
                  ) : (
                    <div className="space-y-6 overflow-y-auto max-h-[55vh] pr-2">
                      {cart.map((item) => (
                        <div key={item.variante_id} className="flex gap-4">
                          <img
                            src={item.image}
                            alt={item.designation}
                            className="w-20 h-24 object-cover bg-gray-50"
                          />
                          <div className="flex-1 min-w-0 py-1">
                            <h4 className="font-medium text-[12px] uppercase tracking-[0.05em] truncate mb-1">
                              {item.designation}
                            </h4>
                            <p className="text-[11px] font-light text-gray-500 mb-2">
                              Taille : {item.taille_selectionnee} <br /> Couleur
                              : {item.couleur_selectionnee}
                            </p>
                            {isAdmin ? (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] text-gray-400">
                                  Prix:
                                </span>
                                <Input
                                  type="number"
                                  value={item.prix_personnalise}
                                  onChange={(e) =>
                                    updateCartItemPrice(
                                      item.variante_id,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-24 h-7 text-xs px-2"
                                />
                              </div>
                            ) : (
                              <p className="text-[13px] font-medium">
                                {formatCurrency(item.prix_personnalise)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col justify-between items-end py-1">
                            <button
                              onClick={() => removeFromCart(item.variante_id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <X className="w-4 h-4 stroke-[1.5]" />
                            </button>
                            <div className="flex items-center gap-3 border border-gray-200 px-2 py-1">
                              <button
                                onClick={() =>
                                  updateQuantity(item.variante_id, -1)
                                }
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-[11px]">
                                {item.quantite_selectionnee}
                              </span>
                              <button
                                onClick={() =>
                                  updateQuantity(item.variante_id, 1)
                                }
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 space-y-4 mt-4">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Code promo"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        className="h-9 text-xs rounded-none border-gray-200"
                      />
                      <Button
                        onClick={handleApplyPromo}
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs rounded-none border-gray-200"
                      >
                        <Ticket className="w-3.5 h-3.5 mr-1" /> Appliquer
                      </Button>
                    </div>

                    {appliedDiscount > 0 && (
                      <div className="flex items-center justify-between text-xs text-red-600 bg-red-50 px-3 py-2">
                        <span>Code {activePromoCode} :</span>
                        <span className="font-bold">-{appliedDiscount}%</span>
                      </div>
                    )}

                    <div className="flex justify-between font-medium text-sm tracking-[0.05em] uppercase">
                      <span>Total</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>

                    <Button
                      onClick={() => {
                        setConfirmMode("purchase");
                        setShowCartConfirm(true);
                      }}
                      disabled={cart.length === 0 || checkoutMutation.isPending}
                      className="w-full bg-black text-white hover:bg-gray-800 rounded-none h-12 text-[11px] tracking-[0.1em] uppercase font-medium"
                    >
                      Valider la vente
                    </Button>

                    {showReservationForm ? (
                      <div className="space-y-2 bg-gray-50 p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-700">
                          Client (nom & prénom) :
                        </p>
                        <Input
                          placeholder="Prénom"
                          value={reservationPrenom}
                          onChange={(e) => setReservationPrenom(e.target.value)}
                          className="h-9 text-xs rounded-none border-gray-200"
                        />
                        <Input
                          placeholder="Nom"
                          value={reservationName}
                          onChange={(e) => setReservationName(e.target.value)}
                          className="h-9 text-xs rounded-none border-gray-200"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowReservationForm(false);
                              setReservationName("");
                              setReservationPrenom("");
                            }}
                            className="flex-1 rounded-none border-gray-200 text-xs"
                          >
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (
                                !reservationName.trim() ||
                                !reservationPrenom.trim()
                              ) {
                                toast.error(
                                  "Veuillez saisir le nom et le prénom",
                                );
                                return;
                              }
                              setConfirmMode("reservation");
                              setShowCartConfirm(true);
                              setShowReservationForm(false);
                            }}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 rounded-none text-xs text-white"
                          >
                            Confirmer la réservation
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setShowReservationForm(true)}
                        disabled={cart.length === 0}
                        className="w-full border-gray-300 text-black hover:bg-gray-50 rounded-none h-12 text-[11px] tracking-[0.1em] uppercase font-medium"
                      >
                        Réserver pendant 24h
                      </Button>
                    )}
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <AnnouncementBanner />

      {/* BANNIÈRE STYLE SHOP */}
      <div className="w-full h-[50vh] md:h-[70vh] bg-gray-100 relative overflow-hidden">
        {BANNER_CONFIG.type === "video" ? (
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
          BANNER_CONFIG.images.map((src, index) => (
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
        isAllActive={!filterGenre && !filterPromo}
        saleCount={saleCount}
        isSaleActive={filterPromo}
        onSelectSale={() => {
          setFilterPromo(true);
          setFilterGenre(null);
          setFilterSubCategory(null);
        }}
        onSelectAll={() => {
          setFilterGenre(null);
          setFilterSubCategory(null);
          setFilterPromo(false);
        }}
        onSelectGenre={(genre) => {
          setFilterGenre(genre);
          setFilterSubCategory(null);
          setFilterPromo(false);
        }}
        onSelectSubCategory={(genre, subCategory) => {
          setFilterGenre(genre);
          setFilterSubCategory(subCategory);
          setFilterPromo(false);
        }}
      />

      <div className="py-10 text-center bg-white px-4">
        <h1 className="text-2xl md:text-3xl font-serif uppercase tracking-[0.15em] font-medium">
          {filterPromo ? "Soldes" : (filterSubCategory || filterGenre || "Catalogue")}
        </h1>
      </div>

      {/* GRILLE PRODUITS */}
      <main
        id="articles-section"
        className="max-w-[1800px] mx-auto px-6 md:px-12 pb-32"
      >
        <div className="flex justify-between items-center mb-12 pb-4 border-b border-gray-200">
          <p className="text-[11px] font-light text-gray-500 uppercase tracking-[0.1em]">
            {filteredArticles.length} Article(s)
          </p>
          <div className="flex gap-4 items-center">
            {(filterGenre || searchQuery) && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] text-gray-400 hover:text-black uppercase tracking-[0.1em] underline underline-offset-4"
              >
                Réinitialiser
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
          </div>
        </div>

        {/* Search bar mobile */}
        <div className="md:hidden relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 stroke-[1.5]" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-200 text-xs pl-10 pr-3 py-3 outline-none focus:border-black transition-colors uppercase tracking-[0.05em]"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-32 text-xs font-medium uppercase tracking-widest text-gray-400">
            Chargement du catalogue...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-32 text-xs font-medium uppercase tracking-widest text-gray-400">
            Aucun produit disponible
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-16 md:gap-x-10 md:gap-y-24">
            {filteredArticles.map((art: any) => {
              const couleursArt = Array.from(
                new Set(
                  (art.variantes || [])
                    .map((v: any) => v.couleur)
                    .filter(Boolean),
                ),
              ) as string[];
              return (
                <ProductCard
                  key={art.id}
                  art={art}
                  onQuickView={handleQuickView}
                  onQuickAdd={addToCart}
                  selectedCouleur={
                    selectedCouleurs[art.id] || couleursArt[0] || ""
                  }
                  selectedTaille={selectedTailles[art.id] || ""}
                  onColorChange={handleColorChange}
                  onSizeChange={handleSizeChange}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL QUICK VIEW */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-none w-full max-w-5xl flex flex-col md:flex-row relative shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[95vh] md:max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-5 right-5 p-2 z-20 bg-white rounded-full md:bg-transparent shadow-sm md:shadow-none hover:scale-105 transition-transform"
            >
              <X className="w-5 h-5 text-black stroke-[1.5]" />
            </button>

            <div className="w-full md:w-[60%] bg-[#fcfcfc] p-4 flex flex-row gap-4 h-[45vh] md:h-auto overflow-hidden">
              {modalAllImages.length > 1 && (
                <div className="hidden sm:flex flex-col gap-2.5 overflow-y-auto max-h-full pr-1 scrollbar-none w-20 flex-shrink-0">
                  {modalAllImages.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveModalImage(img)}
                      className={`aspect-[3/4] w-full bg-gray-100 cursor-pointer border transition-all ${activeModalImage === img ? "border-black" : "border-transparent hover:border-gray-400"}`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1 bg-white relative flex items-center justify-center overflow-hidden aspect-[3/4] md:aspect-auto">
                {activeModalImage ? (
                  <ZoomableImage
                    src={activeModalImage}
                    alt=""
                    className="w-full h-full"
                    zoom={2.5}
                    lensSize={160}
                  />
                ) : (
                  <div className="text-gray-300 text-xs uppercase tracking-widest">
                    Aucun aperçu
                  </div>
                )}
              </div>
            </div>

            <div className="w-full md:w-[40%] p-6 md:p-10 flex flex-col overflow-y-auto bg-white border-l border-gray-50">
              <div className="mb-6">
                <span className="text-[10px] text-gray-400 font-light tracking-[0.2em] uppercase block mb-1">
                  {selectedProduct.categorie || "EXCLUSIVITÉ"}
                </span>
                <h2 className="text-lg md:text-xl font-serif text-black uppercase tracking-[0.1em] font-medium mb-2 leading-tight">
                  {selectedProduct.designation}
                </h2>
                {selectedProduct.promotion_active && selectedProduct.prix_promotionnel ? (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg font-bold text-red-600">{formatCurrency(selectedProduct.prix_promotionnel)}</span>
                    <span className="text-sm text-gray-400 line-through">{formatCurrency(selectedProduct.prix_vente)}</span>
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">-{Math.round((1 - selectedProduct.prix_promotionnel / selectedProduct.prix_vente) * 100)}%</span>
                  </div>
                ) : (
                  <p className="text-base font-medium text-black mt-2">
                    {formatCurrency(selectedProduct.prix_vente)}
                  </p>
                )}
              </div>

              {couleursUniquesModal.length > 0 && (
                <div className="space-y-3 mb-6 border-t border-gray-100 pt-4">
                  <span className="text-[11px] font-medium text-black uppercase tracking-[0.1em] block">
                    Couleur :{" "}
                    <span className="font-light text-gray-500">
                      {selectedCouleur}
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {couleursUniquesModal.map((color) => {
                      const gallery = (selectedProduct?.color_galleries || {})[color];
                      const thumb = gallery?.thumbnail_url || gallery?.images?.[0];
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setSelectedCouleur(color);
                            const galleries = selectedProduct.color_galleries || {};
                            const gallery = galleries[color];
                            if (gallery && gallery.images && gallery.images.length > 0) {
                              setActiveModalImage(gallery.images[0]);
                            } else {
                              const mVars = selectedProduct.variantes || [];
                              const variantImg = mVars.find(
                                (v: any) => v.couleur === color && v.image_url,
                              );
                              if (variantImg)
                                setActiveModalImage(variantImg.image_url);
                            }
                            const listTailles = (selectedProduct.variantes || [])
                              .filter((v: any) => v.couleur === color)
                              .map((v: any) => v.taille)
                              .filter(Boolean);
                            const triNouveau = trierTailles(
                              Array.from(new Set(listTailles)),
                            );
                            setSelectedTaille(triNouveau[0] || "");
                          }}
                          className={`w-12 h-12 overflow-hidden border-2 transition-all flex items-center justify-center ${selectedCouleur === color ? "border-black shadow-md" : "border-gray-200 hover:border-gray-400"}`}
                          title={color}
                        >
                          {thumb ? (
                            <img src={thumb} alt={color} className="w-full h-full object-cover" />
                          ) : (
                            <span
                              className="w-full h-full"
                              style={getColorStyle(color, selectedProduct)}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-8 border-t border-gray-100 pt-4">
                <span className="text-[11px] font-medium text-black uppercase tracking-[0.1em] block">
                  Taille
                </span>
                <div className="flex flex-wrap gap-2">
                  {taillesUniquesDispoModal.length > 0 ? (
                    taillesUniquesDispoModal.map((size) => {
                      const variantForSize = modalVariantes.find(
                        (v: any) =>
                          v.taille === size &&
                          (couleursUniquesModal.length === 0 ||
                            v.couleur === selectedCouleur),
                      );
                      const isAvailable =
                        modalVariantes.length > 0
                          ? !!(
                              variantForSize &&
                              Number(
                                variantForSize.stock ??
                                  variantForSize.quantite ??
                                  0,
                              ) > 0
                            )
                          : Number(selectedProduct.quantite ?? 0) > 0;
                      return (
                        <button
                          key={size}
                          disabled={!isAvailable}
                          onClick={() => setSelectedTaille(size)}
                          className={`h-9 min-w-[38px] px-3 border text-[11px] font-medium uppercase tracking-wider transition-all ${
                            !isAvailable
                              ? "opacity-30 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-300 line-through"
                              : selectedTaille === size
                                ? "bg-black text-white border-black"
                                : "bg-white text-black border-gray-200 hover:border-black"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-[12px] font-light text-gray-400">
                      Taille unique
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 mb-6">
                <Button
                  className="w-full bg-black text-white hover:bg-gray-900 uppercase tracking-[0.15em] font-medium text-xs h-12 rounded-none transition-colors"
                  onClick={() => {
                    addToCart(selectedProduct, selectedCouleur, selectedTaille);
                    setSelectedProduct(null);
                  }}
                  disabled={!selectedCouleur && couleursUniquesModal.length > 0}
                >
                  Ajouter au panier
                </Button>
              </div>

              <div className="border-t border-gray-200 mt-4">
                <div className="border-b border-gray-200">
                  <button
                    onClick={() => setOpenDescription(!openDescription)}
                    className="w-full py-4 flex justify-between items-center text-left text-[11px] font-semibold uppercase tracking-wider text-black"
                  >
                    <span>Description</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-500 transition-transform ${openDescription ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openDescription && (
                    <div className="pb-4 text-[12px] font-light text-gray-600 leading-relaxed space-y-1">
                      <p>
                        {selectedProduct.description ||
                          "Cette pièce incarne l'élégance intemporelle de notre maison."}
                      </p>
                      {selectedProduct.reference && (
                        <p className="text-[11px] text-gray-400 pt-1">
                          Référence : {selectedProduct.reference}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CartConfirmModal
        open={showCartConfirm}
        onClose={() => setShowCartConfirm(false)}
        onConfirm={() => {
          setShowCartConfirm(false);
          if (confirmMode === "purchase") {
            checkoutMutation.mutate();
          } else {
            reservationMutation.mutate();
          }
        }}
        mode={confirmMode}
        items={cart}
        subtotal={subTotal}
        discount={appliedDiscount}
        discountCode={activePromoCode}
        customerName={reservationName}
        customerPrenom={reservationPrenom}
        isSubmitting={
          checkoutMutation.isPending || reservationMutation.isPending
        }
      />
    </div>
  );
}
