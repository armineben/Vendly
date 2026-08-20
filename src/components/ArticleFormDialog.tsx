import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload, X, Zap, Copy, ImageIcon, Loader2, Package, Tag, Palette, Ruler } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/lib/upload-file.functions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_GROUPS } from "@/lib/categories";

const TAILLES_STD = ["TU", "XS", "S", "M", "L", "XL", "XXL"];
const POINTURES_GRILLE = Array.from({ length: 61 }, (_, i) => (16 + i * 0.5).toFixed(1).replace('.0', ''));
const AGES = ["0-3m", "3-6m", "6-12m", "12-18m", "18-24m", "2 ans", "3 ans", "4 ans", "5 ans", "6 ans", "8 ans", "10 ans", "12 ans", "14 ans"];

const PREDEFINED_COLORS = [
  { name: "Noir", hex: "#000000" },
  { name: "Blanc", hex: "#FFFFFF" },
  { name: "Or", hex: "#D4AF37" },
  { name: "Rouge", hex: "#DC2626" },
  { name: "Bordeaux", hex: "#800020" },
  { name: "Rose", hex: "#EC4899" },
  { name: "Vert", hex: "#16A34A" },
  { name: "Bleu", hex: "#2563EB" },
  { name: "Marine", hex: "#000080" },
  { name: "Gris", hex: "#6B7280" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Marron", hex: "#78350F" },
  { name: "Kaki", hex: "#C3B091" },
  { name: "Argent", hex: "#C0C0C0" },
];

const GENRE_OPTIONS = [
  { label: "Femme", value: "Femme" },
  { label: "Homme", value: "Homme" },
  { label: "Enfants", value: "Enfants" },
];

const CATEGORIES_BY_GENRE: Record<string, { label: string; value: string }[]> = {
  Femme: CATEGORY_GROUPS.find((g) => g.title === "FEMME")?.items || [],
  Homme: CATEGORY_GROUPS.find((g) => g.title === "HOMME")?.items || [],
  Enfants: CATEGORY_GROUPS.find((g) => g.title === "ENFANTS")?.items || [],
};

function extractGenre(categorie: string): string {
  if (!categorie) return "";
  const parts = categorie.split(" - ");
  const prefix = parts[0]?.toLowerCase() || "";
  if (prefix === "femme") return "Femme";
  if (prefix === "homme") return "Homme";
  if (prefix === "enfant" || prefix === "bébé") return "Enfants";
  return "";
}

function extractSubCategory(categorie: string): string {
  if (!categorie) return "";
  const parts = categorie.split(" - ");
  return parts[1] || "";
}

export function ArticleFormDialog({ open, onOpenChange, article }: { open: boolean, onOpenChange: (v: boolean) => void, article: any | null }) {
  const [form, setForm] = useState<any>({
    reference: "", designation: "", description: "", categorie: "", images: [],
    prix_achat: 0, prix_vente: 0, quantite: 0, emplacement: "",
    variantes: [{ taille: "", couleur: "", stock: 0, image_url: "", images: [] }]
  });

  const [genre, setGenre] = useState("");
  const [subCategory, setSubCategory] = useState("");

  const [multiMode, setMultiMode] = useState(true);
  const [selectedTailleMass, setSelectedTailleMass] = useState<string[]>([]);
  const [selectedCouleurMass, setSelectedCouleurMass] = useState<string>("");
  const [defaultMassStock, setDefaultMassStock] = useState<number>(0);
  const [massImages, setMassImages] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [rowUploadingIndex, setRowUploadingIndex] = useState<number | null>(null);
  const [massUploading, setMassUploading] = useState(false);
  const [promotionActive, setPromotionActive] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState<number>(20);
  const [colorGalleries, setColorGalleries] = useState<Record<string, { thumbnail_url: string; images: string[] }>>({});
  const [colorUploading, setColorUploading] = useState<string | null>(null);
  const [colorHexMap, setColorHexMap] = useState<Record<string, string>>({});
  const [colorHex2Map, setColorHex2Map] = useState<Record<string, string>>({});
  const [perVariantPricing, setPerVariantPricing] = useState(false);
  const colorFileInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowFileInputRef = useRef<HTMLInputElement>(null);
  const massFileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const prevOpen = useRef(false);

  useEffect(() => {
    const justOpened = open && !prevOpen.current;
    prevOpen.current = open;

    if (justOpened) {
      if (article) {
        let initialImages: string[] = [];
        if (Array.isArray(article.images)) {
          initialImages = article.images;
        } else if (article.image) {
          initialImages = [article.image];
        }

        setForm({
          id: article.id,
          reference: article.reference || "",
          designation: article.designation || "",
          description: article.description || "",
          categorie: article.categorie || "",
          images: initialImages,
          prix_achat: article.prix_achat || 0,
          prix_vente: article.prix_vente || 0,
          quantite: article.quantite || 0,
          emplacement: article.emplacement || "",
          variantes: article.variantes && article.variantes.length > 0
            ? article.variantes.map((v: any) => ({
                taille: v.taille || "",
                couleur: v.couleur || "",
                stock: v.stock || 0,
                image_url: v.image_url || "",
                images: v.images || (v.image_url ? [v.image_url] : []),
                prix_achat: v.prix_achat ?? 0,
                prix_vente: v.prix_vente ?? 0
              }))
            : [{ taille: "", couleur: "", stock: 0, image_url: "", images: [] }]
        });
        setGenre(extractGenre(article.categorie || ""));
        setSubCategory(article.subcategory || article.sub_category || extractSubCategory(article.categorie || ""));

        (async () => {
          const { data: galleries } = await supabase
            .from("color_galleries")
            .select("*")
            .eq("article_id", article.id);
          if (galleries && galleries.length > 0) {
            const map: Record<string, { thumbnail_url: string; images: string[] }> = {};
            const hexMap: Record<string, string> = {};
            const hex2Map: Record<string, string> = {};
            galleries.forEach((g: any) => {
              map[g.color_name] = { thumbnail_url: g.thumbnail_url || "", images: g.images || [] };
              if (g.hex) {
                const parts = g.hex.split(",");
                hexMap[g.color_name] = parts[0];
                if (parts[1]) hex2Map[g.color_name] = parts[1];
              }
            });
            setColorGalleries(map);
            setColorHexMap(hexMap);
            setColorHex2Map(hex2Map);
          }
        })();

        setPromotionActive(!!article.promotion_active);
        if (article.promotion_active && article.prix_promotionnel && article.prix_vente > 0) {
          setDiscountPercentage(Math.round((1 - article.prix_promotionnel / article.prix_vente) * 100));
        } else {
          setDiscountPercentage(20);
        }
      } else {
        setForm({
          reference: "", designation: "", description: "", categorie: "", images: [],
          prix_achat: 0, prix_vente: 0, quantite: 0, emplacement: "",
          variantes: [{ taille: "", couleur: "", stock: 0, image_url: "", images: [] }]
        });
        setGenre("");
        setSubCategory("");
        setPromotionActive(false);
        setDiscountPercentage(20);
        setColorGalleries({});
        setColorHexMap({});
        setColorHex2Map({});
        setPerVariantPricing(false);
      }
      setSelectedTailleMass([]);
      setSelectedCouleurMass("");
      setDefaultMassStock(0);
      setMassImages([]);
      setMultiMode(true);
    }
  }, [open, article]);

  useEffect(() => {
    const parts: string[] = [];
    if (genre) parts.push(genre);
    if (subCategory) parts.push(subCategory);
    const cat = parts.join(" - ");
    setForm((prev: any) => ({ ...prev, categorie: cat }));
  }, [genre, subCategory]);

  const totalVariantStock = useMemo(() => {
    return form.variantes.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
  }, [form.variantes]);

  useEffect(() => {
    const hasVariants = form.variantes.some((v: any) => v.taille || v.couleur);
    if (hasVariants) {
      setForm((prev: any) => ({ ...prev, quantite: totalVariantStock }));
    }
  }, [totalVariantStock]);

  useEffect(() => {
    if (!subCategory) return;
    const sc = subCategory.toLowerCase();
    if (sc.includes("accessoire") || sc.includes("sac") || sc.includes("parfum") || sc.includes("montre")) {
      setSelectedTailleMass(["TU"]);
    }
  }, [subCategory]);

  const getGridTailles = () => {
    if (!subCategory) return TAILLES_STD;
    const sc = subCategory.toLowerCase();
    if (sc.includes("accessoire") || sc.includes("sac") || sc.includes("parfum") || sc.includes("montre")) return ["TU"];
    if (sc.includes("chaussure")) return ["TU", ...POINTURES_GRILLE];
    if (sc.includes("enfant") || sc.includes("bébé") || sc.includes("garçon") || sc.includes("fille")) return ["TU", ...AGES];
    return TAILLES_STD;
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileUpload(file: File) {
    const base64 = await fileToBase64(file);
    const { publicUrl } = await uploadFile({ data: { base64, fileName: file.name, folder: "articles" } });
    return publicUrl;
  }

  async function handleMultipleFileUpload(files: FileList) {
    setUploading(true);
    const urls: string[] = [];
    let count = 0;
    for (const file of Array.from(files)) {
      try {
        const url = await handleFileUpload(file);
        urls.push(url);
        count++;
      } catch (e: any) {
        toast.error(`Échec pour ${file.name} : ${e.message}`);
      }
    }
    if (urls.length > 0) {
      setForm((prev: any) => ({ ...prev, images: [...(prev.images || []), ...urls] }));
      toast.success(`${count} image(s) ajoutée(s) à la galerie !`);
    }
    setUploading(false);
  }

  async function handleMassFilesUpload(files: FileList) {
    setMassUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const { publicUrl } = await uploadFile({ data: { base64, fileName: file.name, folder: "variants/mass" } });
        urls.push(publicUrl);
      }
      setMassImages((prev) => [...prev, ...urls]);
      setForm((prev: any) => {
        const currentImages = prev.images || [];
        const newImages = [...currentImages];
        urls.forEach((url) => {
          if (!newImages.includes(url)) newImages.push(url);
        });
        return { ...prev, images: newImages };
      });
      toast.success(`${urls.length} image(s) ajoutée(s) à la série !`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMassUploading(false);
    }
  }

  async function handleRowFileUpload(file: File, index: number) {
    setRowUploadingIndex(index);
    try {
      const base64 = await fileToBase64(file);
      const { publicUrl } = await uploadFile({ data: { base64, fileName: file.name, folder: "variants" } });

      const updatedVariants = [...form.variantes];
      updatedVariants[index].image_url = publicUrl;

      const currentImages = form.images || [];
      const newImages = currentImages.includes(publicUrl) ? currentImages : [...currentImages, publicUrl];

      setForm({ ...form, variantes: updatedVariants, images: newImages });
      toast.success("Image liée à cette variante !");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRowUploadingIndex(null);
    }
  }

  async function handleColorImagesUpload(files: FileList, colorName: string) {
    setColorUploading(colorName);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const { publicUrl } = await uploadFile({ data: { base64, fileName: file.name, folder: "color_galleries" } });
        urls.push(publicUrl);
      }
      setColorGalleries((prev) => {
        const existing = prev[colorName] || { thumbnail_url: "", images: [] };
        const allImages = [...existing.images, ...urls];
        return {
          ...prev,
          [colorName]: {
            thumbnail_url: existing.thumbnail_url || allImages[0] || "",
            images: allImages,
          },
        };
      });
      toast.success(`${urls.length} image(s) ajoutée(s) pour "${colorName}"`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setColorUploading(null);
    }
  }

  const toggleTailleMass = (t: string) => {
    setSelectedTailleMass((prev) =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      let articleId = form.id;
      const validVariants = form.variantes.filter((v: any) => v.taille || v.couleur);
      const hasVariants = validVariants.length > 0;

      // Collecter toutes les images depuis les galeries couleur
      const allColorImages = Object.values(colorGalleries).flatMap((g) => g.images).filter(Boolean);
      const firstGallery = Object.values(colorGalleries)[0];
      const mainImage = firstGallery?.thumbnail_url || allColorImages[0] || form.images?.[0] || form.image || "";
      const finalImages = allColorImages.length > 0
        ? Array.from(new Set([...allColorImages, ...(form.images || [])]))
        : form.images;

      const payload = {
        reference: form.reference || `REF-${Date.now().toString(36).toUpperCase()}`,
        designation: form.designation,
        description: form.description,
        categorie: form.categorie,
        prix_achat: Number(form.prix_achat),
        prix_vente: Number(form.prix_vente),
        quantite: Number(form.quantite || 0),
        emplacement: form.emplacement || "",
        images: finalImages,
        image: mainImage,
        promotion_active: promotionActive,
        prix_promotionnel: promotionActive ? Number(form.prix_vente || 0) * (1 - discountPercentage / 100) : null
      };

      if (articleId) {
        const { error: errA } = await supabase.from("articles").update(payload).eq("id", articleId);
        if (errA) throw errA;

        const { error: errDelV } = await supabase.from("variantes").delete().eq("article_id", articleId);
        if (errDelV) throw errDelV;
      } else {
        const { data: newArticle, error: errA } = await supabase.from("articles").insert([payload]).select("id").single();
        if (errA) throw errA;
        articleId = newArticle.id;
      }

      if (hasVariants) {
        const { error: errV } = await supabase.from("variantes").insert(validVariants.map((v: any) => ({
          article_id: articleId,
          taille: v.taille || "Unique",
          couleur: v.couleur || "Unique",
          stock: Number(v.stock || 0),
          image_url: v.image_url || (v.images?.[0]) || null,
          images: v.images && v.images.length > 0 ? v.images : null
        })));
        if (errV) throw errV;
      }

      const galleryEntries = Object.entries(colorGalleries)
        .filter(([colorName]) => colorName.trim())
        .map(([colorName, data]) => ({
          article_id: articleId,
          color_name: colorName,
          thumbnail_url: data.thumbnail_url || data.images[0] || null,
          images: data.images || [],
          hex: colorHex2Map[colorName] ? `${colorHexMap[colorName] || ""},${colorHex2Map[colorName]}` : (colorHexMap[colorName] || null),
        }));
      if (galleryEntries.length > 0) {
        const { error: errDelG } = await supabase.from("color_galleries").delete().eq("article_id", articleId);
        if (errDelG) throw errDelG;
        const { error: errG } = await supabase.from("color_galleries").insert(galleryEntries);
        if (errG) throw errG;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Article mis à jour !" : "Article enregistré avec succès !");
      qc.invalidateQueries({ queryKey: ["raw-articles"] });
      qc.invalidateQueries({ queryKey: ["raw-variantes"] });
      qc.invalidateQueries({ queryKey: ["color-galleries-shop"] });
      qc.invalidateQueries({ queryKey: ["articles-catalogue"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Erreur : " + error.message);
    }
  });

  const newColorInputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 bg-white border border-slate-200 shadow-xl z-[50]">
        <DialogHeader className="px-6 py-5 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {form.id ? `Modifier: ${form.designation}` : "Nouvel Article"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

            {/* ─── SECTION 1 : Informations Générales ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Informations Générales</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600 font-medium">Référence</Label>
                    <Input placeholder="Auto" className="text-xs h-9 border-gray-200 focus:border-black" value={form.reference} onChange={(e) => setForm({...form, reference: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600 font-medium">Genre</Label>
                    <Select value={genre} onValueChange={(v) => { setGenre(v); setSubCategory(""); }}>
                      <SelectTrigger className="h-9 text-xs border-gray-200">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="bg-white z-50 shadow-xl border border-gray-200">
                        {GENRE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600 font-medium">Catégorie</Label>
                    <Select value={subCategory} onValueChange={setSubCategory} disabled={!genre}>
                      <SelectTrigger className="h-9 text-xs border-gray-200">
                        <SelectValue placeholder={genre ? "Choisir..." : "Sélectionnez d'abord un genre"} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="bg-white z-50 shadow-xl border border-gray-200">
                        {(CATEGORIES_BY_GENRE[genre] || []).map((item) => (
                          <SelectItem key={item.value} value={extractSubCategory(item.value)} className="text-xs">{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 font-medium">Désignation *</Label>
                  <Input placeholder="Ex: Polo Lacoste" className="text-xs h-9 border-gray-200 focus:border-black" value={form.designation} onChange={(e) => setForm({...form, designation: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 font-medium">Description</Label>
                  <Textarea placeholder="Détails du produit..." className="text-xs border-gray-200 focus:border-black resize-none" rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
                </div>
              </div>
            </section>

            {/* ─── SECTION 2 : Prix & Solde ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Prix &amp; Solde</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 font-medium">Prix d'Achat (DT)</Label>
                  <Input type="number" step="0.01" className="text-xs h-9 border-gray-200 focus:border-black" value={form.prix_achat} onChange={(e) => setForm({...form, prix_achat: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 font-medium">Prix de Vente (DT)</Label>
                  <Input type="number" step="0.01" className="text-xs h-9 border-gray-200 focus:border-black" value={form.prix_vente} onChange={(e) => setForm({...form, prix_vente: e.target.value})} />
                </div>
              </div>
              {(() => {
                const pa = Number(form.prix_achat || 0);
                const pv = Number(form.prix_vente || 0);
                const margeDT = pv - pa;
                const margePct = pa > 0 ? (margeDT / pa) * 100 : 0;
                const isPositive = margeDT >= 0;
                return (
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${isPositive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      Marge : {margeDT.toFixed(2)} DT
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${isPositive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {margePct.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}
              <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-amber-800 text-sm">🏷️ Mettre en solde</Label>
                    <p className="text-xs text-amber-600/70">Activer un prix promotionnel pour cet article</p>
                  </div>
                  <Switch checked={promotionActive} onCheckedChange={setPromotionActive} />
                </div>
                {promotionActive && (
                  <div className="grid grid-cols-3 gap-4 items-end pt-2 border-t border-amber-200/60">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-amber-800">Réduction (%)</Label>
                      <Input type="number" min="1" max="99" className="text-xs h-9" value={discountPercentage} onChange={(e) => setDiscountPercentage(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-amber-800">Prix actuel</Label>
                      <div className="h-9 flex items-center px-3 rounded-lg border border-amber-200 bg-white text-sm font-bold text-amber-700">
                        {Number(form.prix_vente || 0).toFixed(2)} DT
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-amber-800">Prix soldé</Label>
                      <div className="h-9 flex items-center px-3 rounded-lg border border-amber-300 bg-amber-100 text-sm font-bold text-red-600">
                        {(Number(form.prix_vente || 0) * (1 - discountPercentage / 100)).toFixed(2)} DT
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ─── SECTION 3 : Couleurs & Galeries ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Couleurs &amp; Galeries</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(colorGalleries).map(([colorName, gallery], idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1 flex-1">
                        <div className="relative group shrink-0">
                          <div
                            className="w-8 h-8 rounded-lg border-2 border-slate-200 overflow-hidden cursor-pointer"
                            style={colorHex2Map[colorName] && colorHexMap[colorName]
                              ? { background: `linear-gradient(135deg, ${colorHexMap[colorName]} 50%, ${colorHex2Map[colorName]} 50%)` }
                              : { backgroundColor: colorHexMap[colorName] || "#e2e8f0" }
                            }
                          >
                            <input
                              type="color"
                              value={colorHexMap[colorName] || "#e2e8f0"}
                              onChange={(e) => setColorHexMap((prev) => ({ ...prev, [colorName]: e.target.value }))}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title="Couleur principale"
                            />
                          </div>
                        </div>
                        {colorHex2Map[colorName] && (
                          <div className="relative group shrink-0">
                            <div className="w-6 h-6 rounded-lg border-2 border-slate-200 overflow-hidden cursor-pointer" style={{ backgroundColor: colorHex2Map[colorName] }}>
                              <input
                                type="color"
                                value={colorHex2Map[colorName]}
                                onChange={(e) => setColorHex2Map((prev) => ({ ...prev, [colorName]: e.target.value }))}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                title="Couleur secondaire"
                              />
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (colorHex2Map[colorName]) {
                              setColorHex2Map((prev) => { const u = { ...prev }; delete u[colorName]; return u; });
                            } else {
                              setColorHex2Map((prev) => ({ ...prev, [colorName]: "#cccccc" }));
                            }
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-600 px-1 leading-none shrink-0"
                          title={colorHex2Map[colorName] ? "Retirer la 2e couleur" : "Ajouter une 2e couleur"}
                        >
                          {colorHex2Map[colorName] ? "×2" : "+2"}
                        </button>
                        <Input
                          value={colorName}
                          onChange={(e) => {
                            const oldKey = colorName;
                            const newKey = e.target.value;
                            if (newKey && newKey !== oldKey) {
                              setColorGalleries((prev) => {
                                const updated = { ...prev };
                                updated[newKey] = updated[oldKey];
                                delete updated[oldKey];
                                return updated;
                              });
                              setColorHexMap((prev) => {
                                const updated = { ...prev };
                                updated[newKey] = updated[oldKey];
                                delete updated[oldKey];
                                return updated;
                              });
                              setColorHex2Map((prev) => {
                                const updated = { ...prev };
                                updated[newKey] = updated[oldKey];
                                delete updated[oldKey];
                                return updated;
                              });
                            }
                          }}
                          className="text-xs font-semibold h-8 w-36 border-0 border-b border-transparent focus:border-slate-300 rounded-none px-0"
                          placeholder="Nom de la couleur"
                        />
                        <span className="text-[10px] text-slate-400 ml-auto">
                          {colorHex2Map[colorName] && <span className="text-amber-500 font-semibold mr-2">2 couleurs</span>}
                          {gallery.images.length} image(s)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-red-50 text-red-400 hover:text-red-600 shrink-0"
                        onClick={() => {
                          setColorGalleries((prev) => {
                            const updated = { ...prev };
                            delete updated[colorName];
                            return updated;
                          });
                          setColorHexMap((prev) => {
                            const updated = { ...prev };
                            delete updated[colorName];
                            return updated;
                          });
                          setColorHex2Map((prev) => {
                            const updated = { ...prev };
                            delete updated[colorName];
                            return updated;
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {PREDEFINED_COLORS.map((pc) => (
                        <button
                          key={pc.hex}
                          type="button"
                          onClick={() => {
                            const oldKey = colorName;
                            const newKey = pc.name;
                            if (newKey !== oldKey) {
                              setColorGalleries((prev) => {
                                const updated = { ...prev };
                                updated[newKey] = updated[oldKey] || { thumbnail_url: "", images: [] };
                                delete updated[oldKey];
                                return updated;
                              });
                              setColorHexMap((prev) => {
                                const updated = { ...prev };
                                updated[newKey] = pc.hex;
                                delete updated[oldKey];
                                return updated;
                              });
                              setColorHex2Map((prev) => {
                                const updated = { ...prev };
                                updated[newKey] = updated[oldKey];
                                delete updated[oldKey];
                                return updated;
                              });
                            } else {
                              setColorHexMap((prev) => ({ ...prev, [colorName]: pc.hex }));
                            }
                          }}
                          className="w-6 h-6 rounded-full border-2 border-slate-200 hover:scale-110 transition-transform shrink-0"
                          style={{ backgroundColor: pc.hex }}
                          title={pc.name}
                        />
                      ))}
                    </div>

                    {gallery.images.length > 0 && (
                      <div className="grid grid-cols-6 gap-2 mb-3">
                        {gallery.images.map((imgUrl, idx) => (
                          <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                            <img src={imgUrl} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setColorGalleries((prev) => {
                                  const updated = { ...prev };
                                  const curr = { ...updated[colorName] };
                                  curr.images = curr.images.filter((_, i) => i !== idx);
                                  if (curr.images.length === 0) {
                                    curr.thumbnail_url = "";
                                  } else if (curr.thumbnail_url === imgUrl) {
                                    curr.thumbnail_url = curr.images[0];
                                  }
                                  updated[colorName] = curr;
                                  return updated;
                                });
                              }}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            {idx === 0 && (
                              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5 font-medium">Miniature</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          colorFileInputRef.current!.dataset.color = colorName;
                          colorFileInputRef.current?.click();
                        }}
                        disabled={colorUploading === colorName}
                        className="border-dashed bg-slate-50 h-8 text-xs text-slate-600"
                      >
                        {colorUploading === colorName ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                        Ajouter des photos
                      </Button>
                      {gallery.images.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-slate-500 h-8"
                          onClick={() => {
                            setColorGalleries((prev) => {
                              const updated = { ...prev };
                              updated[colorName] = { thumbnail_url: "", images: [] };
                              return updated;
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Effacer tout
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed bg-slate-50 h-10 text-xs text-slate-500"
            onClick={() => {
  const newName = `Couleur ${Object.keys(colorGalleries || {}).length + 1}`;
  setColorGalleries((prev) => ({
    ...prev,
    [newName]: { thumbnail_url: "", images: [] },
  }));
}}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Ajouter une couleur
                </Button>

                <input
                  type="file"
                  ref={colorFileInputRef}
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const color = e.target.dataset.color;
                    if (e.target.files && color) {
                      handleColorImagesUpload(e.target.files, color);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            </section>

            {/* ─── SECTION 4 : Tailles & Stocks ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Ruler className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tailles &amp; Stocks</h3>
              </div>

              {/* Générateur rapide */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <Label className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                    <Zap className="h-4 w-4 text-amber-500 fill-amber-500" /> Générateur rapide de variantes
                  </Label>
                  <Button type="button" variant="outline" size="sm" className="rounded-lg bg-white shadow-sm" onClick={() => setMultiMode(!multiMode)}>
                    {multiMode ? "Fermer" : "Ouvrir"}
                  </Button>
                </div>

                {multiMode && (
                  <div className="space-y-4 pt-3 border-t bg-white p-4 rounded-lg border shadow-inner">
                    <div>
                      <Label className="text-xs font-bold text-slate-500 uppercase">1. Choisissez vos tailles :</Label>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {getGridTailles().map(t => {
                          const active = selectedTailleMass.includes(t);
                          return (
                            <button
                              type="button"
                              key={t}
                              onClick={() => toggleTailleMass(t)}
                              className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition-all ${active ? "bg-zinc-950 text-white border-zinc-950 shadow-sm" : "bg-white text-slate-700 hover:bg-zinc-100 border-slate-200"}`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4 items-end">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase">2. Couleur</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ex: GOLD"
                            className="text-xs h-9 border-gray-200"
                            value={selectedCouleurMass}
                            onChange={(e) => setSelectedCouleurMass(e.target.value)}
                          />
                          <select
                            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                            value={selectedCouleurMass}
                            onChange={(e) => setSelectedCouleurMass(e.target.value)}
                          >
                            <option value="">ou galerie...</option>
                            {Object.keys(colorGalleries).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase">3. Photos</Label>
                        <div className="flex items-center gap-1">
                          {massImages.length > 0 ? (
                            <div className="flex gap-1 items-center">
                              <div className="flex -space-x-2">
                                {massImages.slice(0, 3).map((url, i) => (
                                  <div key={i} className="w-7 h-7 rounded-md border border-slate-200 overflow-hidden bg-slate-50">
                                    <img src={url} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium ml-1">+{massImages.length - 3 > 0 ? massImages.length - 3 : ""}</span>
                              <button type="button" onClick={() => setMassImages([])} className="text-[10px] text-red-400 hover:text-red-600 ml-1">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">Auto depuis galerie</span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => massFileInputRef.current?.click()}
                            title="Ajouter photos pour cette série"
                          >
                            <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <input type="file" ref={massFileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => e.target.files && e.target.files.length > 0 && handleMassFilesUpload(e.target.files)} />
                        </div>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase">4. Qté par taille</Label>
                        <Input type="number" min="0" placeholder="Ex: 10" className="text-xs h-9 border-gray-200" value={defaultMassStock} onChange={(e) => setDefaultMassStock(Number(e.target.value))} />
                      </div>
                      <div className="col-span-2 flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow h-9 text-xs"
                          disabled={selectedTailleMass.length === 0 || defaultMassStock <= 0}
                          onClick={() => {
                            const color = selectedCouleurMass.trim() || "Couleur Unique";
                            const galleryForColor = colorGalleries[color];
                            const variantImages = massImages.length > 0
                              ? massImages
                              : (galleryForColor?.images?.length > 0 ? galleryForColor.images : (form.images || []));
                            const nouvellesLignes = selectedTailleMass.map(t => ({
                              taille: t,
                              couleur: color,
                              stock: defaultMassStock,
                              image_url: variantImages[0] || (galleryForColor?.thumbnail_url) || "",
                              images: variantImages,
                              prix_achat: Number(form.prix_achat || 0),
                              prix_vente: Number(form.prix_vente || 0),
                            }));

                            setForm((prev: any) => {
                              const lignesFiltrees = prev.variantes.filter((v: any) => v.taille !== "" || v.couleur !== "");
                              return { ...prev, variantes: [...lignesFiltrees, ...nouvellesLignes] };
                            });
                            setSelectedTailleMass([]);
                            setMassImages([]);
                            toast.success(`Ajouté ! Vous pouvez maintenant configurer une autre couleur.`);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tableau des variantes */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold text-slate-800">Variantes ({form.variantes.filter((v: any) => v.taille || v.couleur).length})</Label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <span className="text-[10px] text-slate-500 font-medium">Prix par variante</span>
                      <input type="checkbox" checked={perVariantPricing} onChange={(e) => setPerVariantPricing(e.target.checked)} className="rounded border-slate-300 text-black focus:ring-black h-3.5 w-3.5" />
                    </label>
                    <span className="text-xs text-emerald-600 font-medium">Stock : {totalVariantStock}</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {form.variantes.map((v: any, i: number) => {
                    const vPA = Number(v.prix_achat ?? form.prix_achat ?? 0);
                    const vPV = Number(v.prix_vente ?? form.prix_vente ?? 0);
                    const vMarge = vPV - vPA;
                    const vMargePct = vPA > 0 ? (vMarge / vPA) * 100 : 0;
                    const hex = colorHexMap[v.couleur] || "";
                    const hex2 = colorHex2Map[v.couleur] || "";
                    return (
                    <div key={i} className="bg-white border border-slate-200 p-2 rounded-xl shadow-sm">
                      <div className={`grid ${perVariantPricing ? "grid-cols-12" : "grid-cols-12"} gap-2 items-center`}>
                        <div className="col-span-1 flex items-center gap-1">
                          {hex && <div className="w-3 h-3 rounded-full border border-slate-300 shrink-0" style={hex2 ? { background: `linear-gradient(135deg, ${hex} 50%, ${hex2} 50%)` } : { backgroundColor: hex }} />}
                          {v.images && v.images.length > 0 ? (
                            <div className="relative w-8 h-8 border rounded-md overflow-hidden bg-slate-100 group">
                              <img src={v.images[0]} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => { const n = [...form.variantes]; n[i].images = []; n[i].image_url = ""; setForm({ ...form, variantes: n }); }} className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"><X className="h-3 w-3" /></button>
                              {v.images.length > 1 && <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-tl">+{v.images.length - 1}</span>}
                            </div>
                          ) : v.image_url ? (
                            <div className="relative w-8 h-8 border rounded-md overflow-hidden bg-slate-100 group">
                              <img src={v.image_url} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => { const n = [...form.variantes]; n[i].image_url = ""; setForm({ ...form, variantes: n }); }} className="absolute inset-0 bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setRowUploadingIndex(i); rowFileInputRef.current?.click(); }} className={`w-8 h-8 border border-dashed rounded-md flex items-center justify-center hover:bg-slate-50 text-slate-400 ${rowUploadingIndex === i ? 'animate-pulse bg-amber-50' : ''}`} title="Image spécifique"><ImageIcon className="h-3.5 w-3.5" /></button>
                          )}
                        </div>

                        <div className="col-span-2">
                          <div className="flex items-center gap-1">
                            {hex && <div className="w-3 h-3 rounded-full border border-slate-300 shrink-0 hidden" style={{ backgroundColor: hex }} />}
                            <Input placeholder="Couleur" className="text-xs h-8 border-gray-200" value={v.couleur} onChange={(e) => { const n = [...form.variantes]; n[i].couleur = e.target.value; setForm({ ...form, variantes: n }); }} />
                          </div>
                        </div>

                        <div className="col-span-2">
                          <select
                            className="w-full h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                            value={v.taille || ""}
                            onChange={(e) => {
                              const n = [...form.variantes];
                              n[i].taille = e.target.value;
                              setForm({ ...form, variantes: n });
                            }}
                          >
                            <option value="">Taille</option>
                            {getGridTailles().map(t => <option key={t} value={t}>{t === "TU" ? "TU / Taille Unique" : t}</option>)}
                          </select>
                        </div>

                        {perVariantPricing && (
                          <>
                            <div className="col-span-2">
                              <Input type="number" step="0.01" placeholder="Achat" className="text-xs h-8 border-gray-200" value={v.prix_achat ?? ""} onChange={(e) => { const n = [...form.variantes]; n[i].prix_achat = Number(e.target.value); setForm({ ...form, variantes: n }); }} />
                            </div>
                            <div className="col-span-2">
                              <Input type="number" step="0.01" placeholder="Vente" className="text-xs h-8 border-gray-200" value={v.prix_vente ?? ""} onChange={(e) => { const n = [...form.variantes]; n[i].prix_vente = Number(e.target.value); setForm({ ...form, variantes: n }); }} />
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${vMarge >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                {vMarge.toFixed(1)}
                              </span>
                            </div>
                          </>
                        )}

                        <div className={`flex items-center gap-1 ${perVariantPricing ? "col-span-1" : "col-span-3"}`}>
                          <Input type="number" placeholder="Qté / Stock" min="0" className="text-xs h-8 border-gray-200" value={v.stock} onChange={(e) => { const n = [...form.variantes]; n[i].stock = e.target.value; setForm({ ...form, variantes: n }); }} />
                        </div>

                        <div className="col-span-1 flex justify-center gap-0.5">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-slate-100 text-slate-500" title="Dupliquer" onClick={() => {
                            const copieLigne = { ...v };
                            const nouvellesVariantes = [...form.variantes];
                            nouvellesVariantes.splice(i + 1, 0, copieLigne);
                            setForm({ ...form, variantes: nouvellesVariantes });
                          }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50 text-red-500" onClick={() => setForm({ ...form, variantes: form.variantes.filter((_: any, idx: number) => idx !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                    );
                  })}

                <input type="file" ref={rowFileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && rowUploadingIndex !== null && handleRowFileUpload(e.target.files[0], rowUploadingIndex)} />

                <Button type="button" variant="outline" size="sm" className="w-full bg-white rounded-xl border-dashed mt-3 text-xs text-slate-500" onClick={() => setForm({ ...form, variantes: [...form.variantes, { taille: "", couleur: "", stock: 0, image_url: "", prix_achat: Number(form.prix_achat || 0), prix_vente: Number(form.prix_vente || 0) }] })}>
                  <Plus className="h-4 w-4 mr-1.5" /> Ajouter une ligne manuellement
                </Button>
                </div>
              </div>
            </section>

          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0">
            <Button type="button" variant="outline" className="rounded-xl text-xs" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" className="bg-black text-white rounded-xl px-6 text-xs" disabled={save.isPending}>
              {save.isPending ? "Enregistrement..." : "Enregistrer l'article"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
