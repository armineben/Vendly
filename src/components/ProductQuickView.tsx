import { useState, useEffect, useMemo } from "react";
import { X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZoomableImage } from "@/components/ZoomableImage";
import { formatCurrency } from "@/lib/format";

function getColorStyle(colorName: string, product?: any): React.CSSProperties {
  const fromGallery = product?.color_galleries?.[colorName]?.hex;
  if (fromGallery && fromGallery.includes(",")) {
    const [c1, c2] = fromGallery.split(",").map((s: string) => s.trim());
    return { background: `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` };
  }
  if (fromGallery) return { backgroundColor: fromGallery };
  const clean = colorName.toLowerCase().trim();
  const colorMap: Record<string, string> = {
    rouge: "#ef4444", red: "#ef4444",
    bleu: "#3b82f6", blue: "#3b82f6",
    vert: "#22c55e", green: "#22c55e",
    noir: "#000000", black: "#000000",
    blanc: "#ffffff", white: "#ffffff",
    jaune: "#eab308", yellow: "#eab308",
    gris: "#6b7280", grey: "#6b7280", gray: "#6b7280",
    "gris clair": "#f5f5f5",
    rose: "#ec4899",
    orange: "#f97316",
    violet: "#a855f7",
    marron: "#78350f",
    beige: "#f5f5dc",
    marine: "#000080",
  };
  return { backgroundColor: colorMap[clean] || "#e2e8f0" };
}

function trierTailles(tailles: string[]) {
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

function getDiscountPercent(product: any): number {
  if (!product) return 0;
  if (product.promotion_active && product.prix_promotionnel && product.prix_vente > 0) {
    return Math.round((1 - product.prix_promotionnel / product.prix_vente) * 100);
  }
  return 0;
}

interface ProductQuickViewProps {
  product: any;
  variantes?: any[];
  onClose: () => void;
  onAddToCart: (article: any, couleur: string, taille: string) => void;
  secondaryAction?: (couleur: string, taille: string) => React.ReactNode;
  extraSections?: React.ReactNode;
  descriptionTitle?: string;
}

export function ProductQuickView({
  product,
  variantes: variantesProp,
  onClose,
  onAddToCart,
  secondaryAction,
  extraSections,
  descriptionTitle = "Description",
}: ProductQuickViewProps) {
  const [selectedCouleur, setSelectedCouleur] = useState("");
  const [selectedTaille, setSelectedTaille] = useState("");
  const [activeModalImage, setActiveModalImage] = useState("");
  const [openDescription, setOpenDescription] = useState(true);

  const modalVariantes = variantesProp ?? product?.variantes ?? [];

  function getColorGalleryImages(color: string): string[] {
    const galleries = product?.color_galleries || {};
    const gallery = galleries[color];
    if (gallery && gallery.images && gallery.images.length > 0) {
      return gallery.images;
    }
    return [];
  }

  const modalAllImages = useMemo(() => {
    if (!product) return [];
    // Priorité : galerie de la couleur sélectionnée
    if (selectedCouleur) {
      const colorImgs = getColorGalleryImages(selectedCouleur);
      if (colorImgs.length > 0) return colorImgs;
      const variantImgs = modalVariantes
        .filter((v: any) => v.couleur === selectedCouleur && v.image_url)
        .map((v: any) => v.image_url);
      if (variantImgs.length > 0) return Array.from(new Set(variantImgs)) as string[];
    }
    // Fallback : images directes de l'article (images / image)
    const articleImgs = getArticleImages(product);
    if (articleImgs.length > 0) return articleImgs;
    return [];
  }, [product, modalVariantes, selectedCouleur]);

  const couleursUniquesModal = useMemo(() => {
    if (!product) return [];
    return Array.from(
      new Set(modalVariantes.map((v: any) => v.couleur).filter(Boolean)),
    ) as string[];
  }, [product, modalVariantes]);

  const taillesUniquesDispoModal = useMemo(() => {
    if (!product) return [];
    const brutes = modalVariantes
      .filter((v: any) => !v.couleur || v.couleur === selectedCouleur)
      .map((v: any) => v.taille)
      .filter(Boolean);
    return trierTailles(Array.from(new Set(brutes)));
  }, [product, modalVariantes, selectedCouleur]);

  const discountPercent = useMemo(() => getDiscountPercent(product), [product]);

  useEffect(() => {
    if (!product) return;
    const v = variantesProp ?? product.variantes ?? [];
    const couleurs = Array.from(
      new Set(v.map((va: any) => va.couleur).filter(Boolean)),
    ) as string[];
    const firstColor = couleurs[0] || "Unique";
    setSelectedCouleur(firstColor);

    const tailles = v
      .filter((va: any) => va.couleur === firstColor || !va.couleur)
      .map((va: any) => va.taille)
      .filter(Boolean);
    const tri = trierTailles(Array.from(new Set(tailles)));
    setSelectedTaille(tri[0] || "");

    // Image initiale : galerie couleur → variant image_url → article images → article image
    const colorImgs = getColorGalleryImages(firstColor);
    if (colorImgs.length > 0) {
      setActiveModalImage(colorImgs[0]);
    } else {
      const variantImg = v.find(
        (va: any) => va.couleur === firstColor && va.image_url,
      );
      const articleImgs = getArticleImages(product);
      setActiveModalImage(
        variantImg?.image_url ||
        (articleImgs.length > 0 ? articleImgs[0] : "") ||
        product.image || ""
      );
    }
  }, [product, variantesProp]);

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-none w-full max-w-5xl flex flex-col md:flex-row relative shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[95vh] md:max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 z-20 bg-white rounded-full md:bg-transparent shadow-sm md:shadow-none hover:scale-105 transition-transform"
        >
          <X className="w-5 h-5 text-black stroke-[1.5]" />
        </button>

        {/* LEFT: Images */}
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
              <div className="relative w-full h-full">
                <ZoomableImage
                  src={activeModalImage}
                  alt=""
                  className="w-full h-full"
                  zoom={2.5}
                  lensSize={160}
                />
                {product.promotion_active && discountPercent > 0 && (
                  <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 uppercase rounded-sm z-10">
                    -{discountPercent}%
                  </span>
                )}
              </div>
            ) : (
              <div className="text-gray-300 text-xs uppercase tracking-widest">
                Aucun aperçu
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Product info */}
        <div className="w-full md:w-[40%] p-6 md:p-10 flex flex-col overflow-y-auto bg-white border-l border-gray-50">
          <div className="mb-6">
            <span className="text-[10px] text-gray-400 font-light tracking-[0.2em] uppercase block mb-1">
              {product.categorie || "EXCLUSIVITÉ"}
            </span>
            <h2 className="text-lg md:text-xl font-serif text-black uppercase tracking-[0.1em] font-medium mb-2 leading-tight">
              {product.designation}
            </h2>

            {/* Prix dynamique */}
            <div className="mt-2">
              {product.promotion_active && product.prix_promotionnel ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-bold text-red-600">
                    {formatCurrency(product.prix_promotionnel)}
                  </span>
                  <span className="text-sm text-zinc-400 line-through">
                    {formatCurrency(product.prix_vente)}
                  </span>
                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                    -{discountPercent}%
                  </span>
                </div>
              ) : (
                <span className="text-base font-medium text-black">
                  {formatCurrency(product.prix_vente)}
                </span>
              )}
            </div>
          </div>

          {/* Couleurs — vignettes avec image */}
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
                  const gallery = (product?.color_galleries || {})[color];
                  const thumb = gallery?.thumbnail_url || gallery?.images?.[0];
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setSelectedCouleur(color);
                        const colorImgs = getColorGalleryImages(color);
                        if (colorImgs.length > 0) {
                          setActiveModalImage(colorImgs[0]);
                        } else {
                          const variantImg = modalVariantes.find(
                            (v: any) => v.couleur === color && v.image_url,
                          );
                          if (variantImg) {
                            setActiveModalImage(variantImg.image_url);
                          } else {
                            const articleImgs = getArticleImages(product);
                            if (articleImgs.length > 0)
                              setActiveModalImage(articleImgs[0]);
                          }
                        }
                        const listTailles = modalVariantes
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
                          style={getColorStyle(color, product)}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tailles */}
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
                  const stock = variantForSize
                    ? Number(variantForSize.stock ?? variantForSize.quantite ?? 0)
                    : 0;
                  const isOutOfStock = modalVariantes.length > 0 && stock <= 0;

                  return (
                    <button
                      key={size}
                      disabled={isOutOfStock}
                      onClick={() => setSelectedTaille(size)}
                      className={`h-9 min-w-[38px] px-3 border text-[11px] font-medium uppercase tracking-wider transition-all ${
                        isOutOfStock
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

          {/* Actions */}
          <div className="space-y-2.5 mb-6">
            <Button
              className="w-full bg-black text-white hover:bg-gray-900 uppercase tracking-[0.15em] font-medium text-xs h-12 rounded-none transition-colors"
              onClick={() => {
                onAddToCart(product, selectedCouleur, selectedTaille);
                onClose();
              }}
              disabled={!selectedCouleur && couleursUniquesModal.length > 0}
            >
              Ajouter au panier
            </Button>

            {secondaryAction?.(selectedCouleur, selectedTaille)}
          </div>

          {/* Extra sections (description, reviews, etc.) */}
          <div className="border-t border-gray-200 mt-4">
            <div className="border-b border-gray-200">
              <button
                onClick={() => setOpenDescription(!openDescription)}
                className="w-full py-4 flex justify-between items-center text-left text-[11px] font-semibold uppercase tracking-wider text-black"
              >
                <span>{descriptionTitle}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-500 transition-transform ${openDescription ? "rotate-180" : ""}`}
                />
              </button>
              {openDescription && (
                <div className="pb-4 text-[12px] font-light text-gray-600 leading-relaxed space-y-1">
                  <p>
                    {product.description ||
                      "Cette pièce incarne l'élégance intemporelle de notre maison."}
                  </p>
                  {product.reference && (
                    <p className="text-[11px] text-gray-400 pt-1">
                      Référence : {product.reference}
                    </p>
                  )}
                </div>
              )}
            </div>

            {extraSections}
          </div>
        </div>
      </div>
    </div>
  );
}
