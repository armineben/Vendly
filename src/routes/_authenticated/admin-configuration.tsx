import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Image,
  Video,
  Tag,
  Percent,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Settings,
  Megaphone,
  Loader2,
  Calendar,
  Flame,
  Eye,
  EyeOff,
  Palette,
  User,
  Camera,
  Globe,
  MapPin,
  Mail,
  Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { uploadAvatar } from "@/lib/upload-avatar.functions";

export const Route = createFileRoute("/_authenticated/admin-configuration")({
  component: AdminConfiguration,
});

// ─── Types ──────────────────────────────────────────────────────

interface BannerCategoryConfig {
  type: "video" | "image";
  button_text: string;
  button_link: string;
}

interface AnnouncementConfig {
  text: string;
  bg_color: string;
  enabled: boolean;
}

interface SiteConfigRow {
  id: string;
  banner_type?: string | null;
  video_default?: string | null;
  video_homme?: string | null;
  video_femme?: string | null;
  video_enfant?: string | null;
  banner_interval?: string | null;
  title_default?: string | null;
  title_homme?: string | null;
  title_femme?: string | null;
  title_enfant?: string | null;
  subtitle_default?: string | null;
  subtitle_homme?: string | null;
  subtitle_femme?: string | null;
  subtitle_enfant?: string | null;
  promo_banner_text?: string | null;
  delivery_text?: string | null;
  default_description?: string | null;
  config_json?: Record<string, any> | null;
}

// ─── Shared helpers ─────────────────────────────────────────────

const THEMES = [
  { label: "Noir", value: "#000000" },
  { label: "Rouge", value: "#dc2626" },
  { label: "Bleu", value: "#2563eb" },
  { label: "Vert", value: "#16a34a" },
  { label: "Orange", value: "#ea580c" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Rose", value: "#ec4899" },
  { label: "Gris foncé", value: "#4b5563" },
];

const SALE_CATEGORIES = ["Tous", "Homme", "Femme", "Enfant", "Accessoires", "Sacs"];

const CATEGORIES = ["default", "homme", "femme", "enfant"] as const;
type CatKey = (typeof CATEGORIES)[number];

const CAT_LABELS: Record<CatKey, string> = {
  default: "Par défaut",
  homme: "Homme",
  femme: "Femme",
  enfant: "Enfant",
};

function defaultBannerCfg(type?: string): Record<string, BannerCategoryConfig> {
  const t = type === "image" ? "image" : "video";
  const obj: Record<string, BannerCategoryConfig> = {};
  CATEGORIES.forEach((c) => {
    obj[c] = { type: t, button_text: "", button_link: "" };
  });
  return obj;
}

function useSiteConfig() {
  return useQuery<SiteConfigRow | null>({
    queryKey: ["site-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("*")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

async function upsertConfig(payload: Record<string, any>) {
  const { error } = await supabase
    .from("site_config")
    .upsert({ id: "main", ...payload }, { onConflict: "id" });
  if (error) throw error;
}

// ─── Component ──────────────────────────────────────────────────

function AdminConfiguration() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-500 text-sm">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#091426] flex items-center gap-3">
          <Settings className="h-6 w-6 text-slate-400" />
          Configuration du site
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Gérez les bannières, codes promo, annonces et promotions.
        </p>
      </div>

      <Tabs defaultValue="banners" className="space-y-6">
        <TabsList className="w-full flex-wrap justify-start bg-slate-100 p-1 gap-1 rounded-xl">
          <TabsTrigger value="banners" className="rounded-lg data-[state=active]:shadow-xs gap-2">
            <Image className="h-4 w-4" /> Couvertures
          </TabsTrigger>
          <TabsTrigger value="promocodes" className="rounded-lg data-[state=active]:shadow-xs gap-2">
            <Tag className="h-4 w-4" /> Codes Promo
          </TabsTrigger>
          <TabsTrigger value="announcement" className="rounded-lg data-[state=active]:shadow-xs gap-2">
            <Megaphone className="h-4 w-4" /> Barre d'Annonce
          </TabsTrigger>
          <TabsTrigger value="masspromo" className="rounded-lg data-[state=active]:shadow-xs gap-2">
            <Percent className="h-4 w-4" /> Promotions de Masse
          </TabsTrigger>
          <TabsTrigger value="monprofil" className="rounded-lg data-[state=active]:shadow-xs gap-2">
            <User className="h-4 w-4" /> Mon Profil
          </TabsTrigger>
          <TabsTrigger value="shipping" className="rounded-lg data-[state=active]:shadow-xs gap-2">
            <MapPin className="h-4 w-4" /> Livraison & Devises
          </TabsTrigger>
          <TabsTrigger value="newsletter" className="rounded-lg data-[state=active]:shadow-xs gap-2">
            <Mail className="h-4 w-4" /> Newsletter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="banners">
          <BannersTab />
        </TabsContent>
        <TabsContent value="promocodes">
          <PromoCodesTab />
        </TabsContent>
        <TabsContent value="announcement">
          <AnnouncementTab />
        </TabsContent>
        <TabsContent value="masspromo">
          <MassPromoTab />
        </TabsContent>
        <TabsContent value="monprofil">
          <MonProfilTab />
        </TabsContent>
        <TabsContent value="shipping">
          <ShippingConfigTab />
        </TabsContent>
        <TabsContent value="newsletter">
          <NewsletterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Upload helper ────────────────────────────────────────────────

async function uploadVideo(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const ext = file.name.split(".").pop() || "mp4";
  const path = `videos/${crypto.randomUUID()}.${ext}`;

  // Simulate progress for browsers that don't provide it
  if (onProgress) onProgress(5);

  const { error: uploadError } = await supabase.storage
    .from("site-assets")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;
  if (onProgress) onProgress(80);

  const { data: pubData } = supabase.storage
    .from("site-assets")
    .getPublicUrl(path);

  if (onProgress) onProgress(100);
  return pubData.publicUrl;
}

// ─── Video uploader inline ────────────────────────────────────────

function VideoUploader({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Veuillez sélectionner un fichier vidéo valide.");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadVideo(file, setProgress);
      onChange(url);
      toast.success(`Vidéo "${label}" mise à jour`);
    } catch (err: any) {
      const msg =
        err?.message?.includes("bucket") ||
        err?.message?.includes("404")
          ? 'Bucket "site-assets" introuvable. Créez-le dans Supabase Storage.'
          : err.message || "Erreur lors du téléversement";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const fileName =
    value && !uploading ? value.split("/").pop()?.split("?").shift() ?? "" : "";

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value && !uploading && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500 truncate max-w-full">
          <Video className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate" title={value}>
            {fileName || "URL enregistrée"}
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-auto text-red-400 hover:text-red-600 shrink-0"
            title="Supprimer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
      {uploading ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Téléversement… {progress}%
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#091426] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 border border-dashed border-slate-300 rounded-md px-3 py-2 hover:border-slate-500 hover:text-slate-700 transition-colors">
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFile}
          />
          <Plus className="h-3.5 w-3.5" />
          {value ? "Changer la vidéo" : "Importer depuis le PC"}
        </label>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  1.  BANNERS TAB
// ═══════════════════════════════════════════════════════════════════

function BannersTab() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useSiteConfig();

  const [bannerType, setBannerType] = useState("video");
  const [defaultVideo, setDefaultVideo] = useState("");
  const [videoHomme, setVideoHomme] = useState("");
  const [videoFemme, setVideoFemme] = useState("");
  const [videoEnfant, setVideoEnfant] = useState("");
  const [bannerInterval, setBannerInterval] = useState("3000");
  const [bannerImages, setBannerImages] = useState<string[]>([""]);
  const [heroDefaultTitle, setHeroDefaultTitle] = useState("");
  const [heroHommeTitle, setHeroHommeTitle] = useState("");
  const [heroFemmeTitle, setHeroFemmeTitle] = useState("");
  const [heroEnfantTitle, setHeroEnfantTitle] = useState("");
  const [heroDefaultSub, setHeroDefaultSub] = useState("");
  const [heroHommeSub, setHeroHommeSub] = useState("");
  const [heroFemmeSub, setHeroFemmeSub] = useState("");
  const [heroEnfantSub, setHeroEnfantSub] = useState("");
  const [bannerCfg, setBannerCfg] = useState<Record<string, BannerCategoryConfig>>({});

  useEffect(() => {
    if (!config) return;
    setBannerType(config.banner_type ?? "video");
    setDefaultVideo(config.video_default ?? "");
    setVideoHomme(config.video_homme ?? "");
    setVideoFemme(config.video_femme ?? "");
    setVideoEnfant(config.video_enfant ?? "");
    setBannerInterval(config.banner_interval ?? "3000");
    const imgs = config.config_json?.banner_images;
    setBannerImages(Array.isArray(imgs) && imgs.length > 0 ? imgs : [""]);
    setHeroDefaultTitle(config.title_default ?? "");
    setHeroHommeTitle(config.title_homme ?? "");
    setHeroFemmeTitle(config.title_femme ?? "");
    setHeroEnfantTitle(config.title_enfant ?? "");
    setHeroDefaultSub(config.subtitle_default ?? "");
    setHeroHommeSub(config.subtitle_homme ?? "");
    setHeroFemmeSub(config.subtitle_femme ?? "");
    setHeroEnfantSub(config.subtitle_enfant ?? "");
    setBannerCfg((config.config_json?.banner_cfg as any) ?? defaultBannerCfg(config.banner_type ?? undefined));
  }, [config]);

  const updateBannerCfg = (cat: string, field: keyof BannerCategoryConfig, val: any) => {
    setBannerCfg((prev) => ({ ...prev, [cat]: { ...(prev[cat] ?? { type: "video", button_text: "", button_link: "" }), [field]: val } }));
  };

  const getVideoForCat = (cat: CatKey) => {
    const map: Record<CatKey, string> = {
      default: defaultVideo,
      homme: videoHomme,
      femme: videoFemme,
      enfant: videoEnfant,
    };
    return map[cat];
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      upsertConfig({
        banner_type: bannerType,
        video_default: defaultVideo || null,
        video_homme: videoHomme || null,
        video_femme: videoFemme || null,
        video_enfant: videoEnfant || null,
        banner_interval: bannerInterval || "3000",
        title_default: heroDefaultTitle || null,
        title_homme: heroHommeTitle || null,
        title_femme: heroFemmeTitle || null,
        title_enfant: heroEnfantTitle || null,
        subtitle_default: heroDefaultSub || null,
        subtitle_homme: heroHommeSub || null,
        subtitle_femme: heroFemmeSub || null,
        subtitle_enfant: heroEnfantSub || null,
        config_json: {
          ...config?.config_json,
          banner_images: bannerImages.filter(Boolean),
          banner_cfg: bannerCfg,
        },
      }),
    onSuccess: () => {
      toast.success("Bannières mises à jour !");
      qc.invalidateQueries({ queryKey: ["site-config"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Section : Vidéo par défaut / Type global ── */}
      <CardSection title="Type de bannière">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bannerType"
              value="video"
              checked={bannerType === "video"}
              onChange={(e) => setBannerType(e.target.value)}
              className="accent-[#091426]"
            />
            <Video className="h-4 w-4 text-slate-500" /> Vidéo
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bannerType"
              value="images"
              checked={bannerType === "images"}
              onChange={(e) => setBannerType(e.target.value)}
              className="accent-[#091426]"
            />
            <Image className="h-4 w-4 text-slate-500" /> Diaporama d'images
          </label>
        </div>
      </CardSection>

      {bannerType === "video" && (
        <>
          {/* ── Section : Vidéos de couverture ── */}
          <CardSection title="Vidéos de couverture">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <VideoUploader value={defaultVideo} onChange={setDefaultVideo} label="Vidéo par défaut" />
              <VideoUploader value={videoHomme} onChange={setVideoHomme} label="Mode Homme" />
              <VideoUploader value={videoFemme} onChange={setVideoFemme} label="Mode Femme" />
              <VideoUploader value={videoEnfant} onChange={setVideoEnfant} label="Mode Enfant" />
            </div>
          </CardSection>
        </>
      )}

      {bannerType === "images" && (
        <CardSection title="Images du diaporama">
          <div className="space-y-2">
            {bannerImages.map((url, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={url}
                  onChange={(e) => {
                    const next = [...bannerImages];
                    next[i] = e.target.value;
                    setBannerImages(next);
                  }}
                  placeholder="URL de l'image"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setBannerImages((p) => p.filter((_, j) => j !== i))}
                  disabled={bannerImages.length <= 1}
                  className="text-red-500 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setBannerImages((p) => [...p, ""])} className="mt-1 gap-1">
              <Plus className="h-3.5 w-3.5" /> Ajouter une image
            </Button>
            <div>
              <Label>Intervalle (ms)</Label>
              <Input type="number" value={bannerInterval} onChange={(e) => setBannerInterval(e.target.value)} className="w-32" />
            </div>
          </div>
        </CardSection>
      )}

      {/* ── Section : Configuration par catégorie (type, bouton, lien) ── */}
      <CardSection title="Configuration par catégorie">
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const cfg = bannerCfg[cat] ?? { type: "video", button_text: "", button_link: "" };
            return (
              <div
                key={cat}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
              >
                <h3 className="text-sm font-bold text-[#091426] uppercase tracking-wider">
                  {CAT_LABELS[cat]}
                </h3>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name={`bg-type-${cat}`}
                      value="video"
                      checked={cfg.type === "video"}
                      onChange={() => updateBannerCfg(cat, "type", "video")}
                      className="accent-[#091426]"
                    />
                    <Video className="h-3.5 w-3.5 text-slate-500" /> Vidéo
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name={`bg-type-${cat}`}
                      value="image"
                      checked={cfg.type === "image"}
                      onChange={() => updateBannerCfg(cat, "type", "image")}
                      className="accent-[#091426]"
                    />
                    <Image className="h-3.5 w-3.5 text-slate-500" /> Image
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px]">Texte du bouton</Label>
                    <Input
                      value={cfg.button_text}
                      onChange={(e) => updateBannerCfg(cat, "button_text", e.target.value)}
                      placeholder="Découvrir la collection"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Lien du bouton</Label>
                    <Input
                      value={cfg.button_link}
                      onChange={(e) => updateBannerCfg(cat, "button_link", e.target.value)}
                      placeholder="/shop?genre=homme"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardSection>

      {/* ── Section : Textes du Hero ── */}
      <CardSection title="Textes du Hero (par catégorie)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Titres</h4>
            {CATEGORIES.map((cat) => {
              const setter = cat === "default" ? setHeroDefaultTitle : cat === "homme" ? setHeroHommeTitle : cat === "femme" ? setHeroFemmeTitle : setHeroEnfantTitle;
              const val = cat === "default" ? heroDefaultTitle : cat === "homme" ? heroHommeTitle : cat === "femme" ? heroFemmeTitle : heroEnfantTitle;
              return (
                <div key={cat}>
                  <Label>{CAT_LABELS[cat]}</Label>
                  <Input value={val} onChange={(e) => setter(e.target.value)} />
                </div>
              );
            })}
          </div>
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sous-titres</h4>
            {CATEGORIES.map((cat) => {
              const setter = cat === "default" ? setHeroDefaultSub : cat === "homme" ? setHeroHommeSub : cat === "femme" ? setHeroFemmeSub : setHeroEnfantSub;
              const val = cat === "default" ? heroDefaultSub : cat === "homme" ? heroHommeSub : cat === "femme" ? heroFemmeSub : heroEnfantSub;
              return (
                <div key={cat}>
                  <Label>{CAT_LABELS[cat]}</Label>
                  <Input value={val} onChange={(e) => setter(e.target.value)} />
                </div>
              );
            })}
          </div>
        </div>
      </CardSection>

      {/* ── Live Preview ── */}
      <CardSection title="Aperçu en direct (Bannière par défaut)">
        <div className="relative w-full h-32 rounded-xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-white text-sm font-semibold tracking-wider uppercase">
              {heroDefaultTitle || "Titre par défaut"}
            </p>
            <p className="text-white/60 text-[10px] mt-0.5 tracking-wide">
              {heroDefaultSub || "Sous-titre"}
            </p>
            {bannerCfg.default?.button_text && (
              <span className="inline-block mt-2 border border-white/60 text-white text-[10px] px-3 py-1 uppercase tracking-widest">
                {bannerCfg.default.button_text}
              </span>
            )}
          </div>
          <div className="absolute bottom-2 right-3 text-[9px] text-white/30 uppercase tracking-wider">
            <Eye className="h-3 w-3 inline mr-1" />
            {bannerType === "video" ? "Vidéo" : "Diaporama"} • {bannerCfg.default?.type ?? bannerType}
          </div>
        </div>
      </CardSection>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-[#091426] hover:opacity-90 gap-2">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Mettre à jour les bannières
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  2.  PROMO CODES TAB
// ═══════════════════════════════════════════════════════════════════

function PromoCodesTab() {
  const qc = useQueryClient();
  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState<"percentage" | "fixed">("percentage");
  const [newValue, setNewValue] = useState("");
  const [newMinPurchase, setNewMinPurchase] = useState("");
  const [newExpires, setNewExpires] = useState("");
  const [creating, setCreating] = useState(false);

  const isExpired = (c: any) => c.expires_at && new Date(c.expires_at) < new Date();

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("promo_codes")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    }
  };

  const deleteCode = async (id: string) => {
    if (!confirm("Supprimer ce code promo ?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Code supprimé");
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    }
  };

  const createCode = async () => {
    if (!newCode.trim()) { toast.error("Le nom du code est requis"); return; }
    if (!newValue.trim() || Number(newValue) <= 0) { toast.error("Valeur invalide"); return; }
    setCreating(true);
    const payload: Record<string, any> = {
      code: newCode.trim().toUpperCase(),
      discount_type: newType,
      discount_value: Number(newValue),
      expires_at: newExpires || null,
    };
    if (newMinPurchase.trim() && Number(newMinPurchase) > 0) {
      payload.minimum_purchase = Number(newMinPurchase);
    }
    const { error } = await supabase.from("promo_codes").insert(payload);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Code promo créé !");
      setNewCode("");
      setNewValue("");
      setNewMinPurchase("");
      setNewExpires("");
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    }
    setCreating(false);
  };

  const now = new Date().toISOString().split("T")[0];

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <CardSection title="Codes promo existants">
        {codes.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun code promo pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="pb-2 pr-4">Code</th>
                  <th className="pb-2 pr-4">Réduction</th>
                  <th className="pb-2 pr-4">Min. achat</th>
                  <th className="pb-2 pr-4">Expire le</th>
                  <th className="pb-2 pr-4">Actif</th>
                  <th className="pb-2 pr-4">Utilisations</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c: any) => {
                  const expired = isExpired(c);
                  const rowBg = expired ? "opacity-50" : "";
                  return (
                    <tr key={c.id} className={`border-b border-slate-100 ${rowBg}`}>
                      <td className="py-3 pr-4 font-semibold text-[#091426]">
                        {c.code}
                        {expired && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700 uppercase tracking-wider">
                            Expiré
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {c.discount_type === "percentage" ? `${c.discount_value}%` : `${formatCurrency(c.discount_value)}`}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {c.minimum_purchase ? formatCurrency(c.minimum_purchase) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {c.expires_at ? (
                          <span className={expired ? "text-red-500 font-semibold" : ""}>
                            {new Date(c.expires_at).toLocaleDateString("fr-FR")}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <Switch
                          checked={c.is_active && !expired}
                          onCheckedChange={() => toggleActive(c.id, c.is_active)}
                          disabled={expired}
                        />
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : ""}
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="icon" onClick={() => deleteCode(c.id)} className="text-red-500 h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardSection>

      <CardSection title="Créer un nouveau code promo">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
          <div>
            <Label>Code</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="SOLDES30" />
          </div>
          <div>
            <Label>Type</Label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "percentage" | "fixed")}
              className="w-full h-10 rounded-lg border border-slate-200 bg-background px-3 text-sm focus:outline-none focus:border-[#091426]"
            >
              <option value="percentage">%</option>
              <option value="fixed">Montant fixe (DT)</option>
            </select>
          </div>
          <div>
            <Label>{newType === "percentage" ? "Pourcentage" : "Montant"}</Label>
            <Input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={newType === "percentage" ? "30" : "5000"} />
          </div>
          <div>
            <Label>Min. d'achat (optionnel)</Label>
            <Input type="number" value={newMinPurchase} onChange={(e) => setNewMinPurchase(e.target.value)} placeholder="120" min={0} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> Expiration
            </Label>
            <Input type="date" value={newExpires} onChange={(e) => setNewExpires(e.target.value)} min={now} />
          </div>
          <Button onClick={createCode} disabled={creating} className="bg-[#091426] hover:opacity-90 gap-1 h-10">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer
          </Button>
        </div>
      </CardSection>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  3.  ANNOUNCEMENT BAR TAB
// ═══════════════════════════════════════════════════════════════════

function AnnouncementTab() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useSiteConfig();

  const [text, setText] = useState("");
  const [bgColor, setBgColor] = useState("#000000");
  const [enabled, setEnabled] = useState(false);
  const [saleActive, setSaleActive] = useState(false);
  const [saleText, setSaleText] = useState("");
  const [salePercentage, setSalePercentage] = useState(20);
  const [saleCategory, setSaleCategory] = useState("Tous");
  const [promoText, setPromoText] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [defaultDesc, setDefaultDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [customColor, setCustomColor] = useState("");

  useEffect(() => {
    if (!config) return;
    const ann = config.config_json?.announcement as AnnouncementConfig | undefined;
    setText(ann?.text ?? "");
    setBgColor(ann?.bg_color ?? "#000000");
    setEnabled(ann?.enabled ?? false);
    const sale = config.config_json?.sale as Record<string, any> | undefined;
    setSaleActive(sale?.active ?? false);
    setSaleText(sale?.text ?? "");
    setSalePercentage(sale?.percentage ?? 20);
    setSaleCategory(sale?.category ?? "Tous");
    setPromoText(config.promo_banner_text ?? "");
    setDeliveryText(config.delivery_text ?? "");
    setDefaultDesc(config.default_description ?? "");
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertConfig({
        promo_banner_text: promoText || null,
        delivery_text: deliveryText || null,
        default_description: defaultDesc || null,
        config_json: {
          ...config?.config_json,
          announcement: { text, bg_color: bgColor, enabled },
          sale: { active: saleActive, text: saleText, percentage: salePercentage, category: saleCategory },
        },
      });
      toast.success("Barre d'annonce mise à jour !");
      qc.invalidateQueries({ queryKey: ["site-config"] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <CardSection title="Barre d'annonce (topbar)">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Activer la barre d'annonce</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div>
            <Label>Texte de l'annonce</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Livraison gratuite dès 120 DT d'achat" />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Palette className="h-3.5 w-3.5 text-slate-400" /> Couleur de fond
            </Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setBgColor(t.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${bgColor === t.value ? "border-black scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: t.value }}
                  title={t.label}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <Input
                  type="color"
                  value={customColor || bgColor}
                  onChange={(e) => { setCustomColor(e.target.value); setBgColor(e.target.value); }}
                  className="w-10 h-10 p-0.5 cursor-pointer border rounded"
                />
                <span className="text-[10px] text-slate-400 font-mono">{bgColor}</span>
              </div>
            </div>
          </div>

          {/* Live preview */}
          {enabled && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <div
                className="py-2.5 px-4 text-center text-xs font-medium tracking-wider uppercase"
                style={{ backgroundColor: bgColor, color: "#ffffff" }}
              >
                {text || "Aperçu de l'annonce"}
              </div>
            </div>
          )}
          {!enabled && (
            <div className="rounded-xl border border-dashed border-slate-300 py-3 px-4 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
              <EyeOff className="h-4 w-4" /> Barre désactivée — aucun affichage public
            </div>
          )}
        </div>
      </CardSection>

      <CardSection title="Bandeau de solde">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Activer le bandeau de solde</Label>
            <Switch checked={saleActive} onCheckedChange={setSaleActive} />
          </div>
          {saleActive && (
            <>
              <div>
                <Label>Texte promo</Label>
                <Input value={saleText} onChange={(e) => setSaleText(e.target.value)} placeholder="Ex: Soldes exceptionnelles" />
              </div>
              <div>
                <Label>Pourcentage de réduction</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={salePercentage}
                  onChange={(e) => setSalePercentage(Number(e.target.value))}
                  className="max-w-28"
                />
              </div>
              <div>
                <Label>Catégorie ciblée</Label>
                <Select value={saleCategory} onValueChange={setSaleCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-pink-500 py-2.5 px-4 text-center text-xs font-semibold text-white">
                  {saleText || "Soldes"} : -{salePercentage}% sur{" "}
                  {saleCategory === "Tous" ? "toute la boutique" : `la collection ${saleCategory}`} 🔥
                </div>
              </div>
            </>
          )}
          {!saleActive && (
            <div className="rounded-xl border border-dashed border-slate-300 py-3 px-4 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
              <EyeOff className="h-4 w-4" /> Bandeau désactivé — aucun affichage public
            </div>
          )}
        </div>
      </CardSection>

      <CardSection title="Textes globaux du shop">
        <div className="space-y-3">
          <div>
            <Label>Bannière promo (texte au-dessus des articles)</Label>
            <Input value={promoText} onChange={(e) => setPromoText(e.target.value)} placeholder="Ex: Bénéficiez de -50% sur la collection d'été !" />
          </div>
          <div>
            <Label>Texte Livraison & Retours</Label>
            <Textarea value={deliveryText} onChange={(e) => setDeliveryText(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Description par défaut des produits</Label>
            <Textarea value={defaultDesc} onChange={(e) => setDefaultDesc(e.target.value)} rows={2} />
          </div>
        </div>
      </CardSection>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-[#091426] hover:opacity-90 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  4.  MASS PROMOTIONS TAB
// ═══════════════════════════════════════════════════════════════════

function MassPromoTab() {
  const qc = useQueryClient();

  const [promoCategorie, setPromoCategorie] = useState("");
  const [globalPercent, setGlobalPercent] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [applying, setApplying] = useState(false);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["articles-categories-mass"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("categorie")
        .eq("archived", false);
      if (error) throw error;
      const unique = Array.from(new Set((data ?? []).map((a: any) => (a.categorie || "").trim()).filter(Boolean))) as string[];
      return unique.sort();
    },
  });

  const { data: articles = [], error: articlesError, isLoading: articlesLoading } = useQuery({
    queryKey: ["articles-promo-mass", promoCategorie],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, reference, designation, prix_vente, prix_promotionnel, promotion_active, categorie, image, images")
        .eq("archived", false)
        .eq("categorie", promoCategorie.trim())
        .order("designation");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!promoCategorie,
  });

  useEffect(() => {
    if (articlesError) {
      setFetchError(articlesError.message);
    } else {
      setFetchError(null);
    }
  }, [articlesError]);

  useEffect(() => {
    setRows(articles.map((a: any) => {
      const existingPromo = !!a.promotion_active;
      const existingPercent = existingPromo && a.prix_promotionnel
        ? Math.round((1 - a.prix_promotionnel / a.prix_vente) * 100)
        : 0;
      return {
        id: a.id,
        reference: a.reference,
        designation: a.designation,
        prix_vente: a.prix_vente,
        categorie: a.categorie,
        image: a.image || (a.images?.[0]) || "",
        checked: existingPromo,
        percent: existingPercent,
      };
    }));
  }, [articles, promoCategorie]);

  const updateRow = (id: string, field: string, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const promoCount = articles.length;
  const selectedCount = rows.filter(r => r.checked).length;
  const unselectedCount = rows.length - selectedCount;
  const readyToPromote = rows.filter(r => r.checked && r.percent > 0);

  const applyGlobalPercent = () => {
    const p = Number(globalPercent);
    if (!p || p <= 0) {
      toast.error("Entrez un pourcentage valide (> 0)");
      return;
    }
    setRows(prev => prev.map(r => r.checked ? { ...r, percent: p } : r));
    toast.success(`% appliqué aux ${rows.filter(r => r.checked).length} article(s) coché(s)`);
  };

  const applyPromotions = async () => {
    const toPromote = rows.filter(r => r.checked && r.percent > 0);
    const toRemove = rows.filter(r => r.checked && r.percent <= 0);

    if (toPromote.length === 0 && toRemove.length === 0) {
      toast.error("Aucun article sélectionné avec un pourcentage valide");
      return;
    }

    const msg = toPromote.length > 0 && toRemove.length > 0
      ? `Appliquer la promo sur ${toPromote.length} et retirer la promo de ${toRemove.length} article(s) ?`
      : toPromote.length > 0
        ? `Appliquer les réductions sur ${toPromote.length} article(s) ?`
        : `Retirer la promotion de ${toRemove.length} article(s) ?`;
    if (!confirm(msg)) return;

    setApplying(true);
    let successCount = 0;
    const errors: string[] = [];

    const toPromoteUpdates = toPromote.map(async (row) => {
      const salePrice = Math.round(Number(row.prix_vente) * (1 - row.percent / 100) * 100) / 100;
      const { error } = await supabase
        .from("articles")
        .update({
          promotion_active: true,
          prix_promotionnel: salePrice,
        })
        .eq("id", row.id);
      if (error) {
        errors.push(`[${row.reference || row.id}] ${error.message}`);
      } else {
        successCount++;
      }
    });

    const toRemoveUpdates = toRemove.map(async (row) => {
      const { error } = await supabase
        .from("articles")
        .update({ promotion_active: false, prix_promotionnel: null })
        .eq("id", row.id);
      if (error) {
        errors.push(`[${row.reference || row.id}] ${error.message}`);
      } else {
        successCount++;
      }
    });

    await Promise.all([...toPromoteUpdates, ...toRemoveUpdates]);

    setApplying(false);

    if (errors.length > 0) {
      toast.error(
        <div className="space-y-1">
          <p className="font-semibold">{successCount} succès, {errors.length} échec(s)</p>
          <ul className="text-[11px] list-disc pl-4 space-y-0.5">
            {errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
            {errors.length > 3 && <li className="text-slate-400">… et {errors.length - 3} autre(s)</li>}
          </ul>
        </div>,
        { duration: 8000 },
      );
    } else {
      toast.success(`${successCount} article(s) mis à jour`);
    }

    qc.invalidateQueries({ queryKey: ["articles-promo-mass"] });
  };

  return (
    <div className="space-y-6">
      <CardSection title="Lancer une promotion par catégorie">
        <p className="text-xs text-slate-500 mb-4">
          Sélectionnez une catégorie, définissez un pourcentage global (optionnel), puis personnalisez article par article dans le tableau ci-dessous.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end mb-6">
          <div className="sm:col-span-2">
            <Label>Catégorie</Label>
            <select
              value={promoCategorie}
              onChange={(e) => { setPromoCategorie(e.target.value); setGlobalPercent(""); setFetchError(null); }}
              className="w-full h-10 rounded-lg border border-slate-200 bg-background px-3 text-sm focus:outline-none focus:border-[#091426]"
            >
              <option value="">Sélectionner...</option>
              {categories.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Réduction globale (%)</Label>
            <Input
              type="number"
              value={globalPercent}
              onChange={(e) => setGlobalPercent(e.target.value)}
              placeholder="20"
              min={1}
              max={99}
            />
          </div>
          <Button
            onClick={applyGlobalPercent}
            disabled={!globalPercent || selectedCount === 0}
            variant="outline"
            className="gap-2 h-10"
          >
            <Percent className="h-4 w-4" /> Appliquer le %
          </Button>
          <Button
            onClick={applyPromotions}
            disabled={applying || readyToPromote.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2 h-10"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            Confirmer
          </Button>
          <Button
            variant="outline"
            onClick={() => { setPromoCategorie(""); setGlobalPercent(""); setRows([]); }}
            className="h-10"
          >
            Réinitialiser
          </Button>
        </div>

        {promoCategorie && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-bold text-[#091426]">{promoCount}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Dans la catégorie</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700">{selectedCount}</p>
                <p className="text-[10px] text-emerald-600 uppercase tracking-wider mt-1">Sélectionnés</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-bold text-slate-500">{unselectedCount}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Non sélectionnés</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{readyToPromote.length}</p>
                <p className="text-[10px] text-amber-600 uppercase tracking-wider mt-1">Prêts à appliquer</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="p-3 w-10">
                        {rows.length > 0 && (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 accent-black cursor-pointer h-4 w-4"
                            checked={rows.every(r => r.checked)}
                            onChange={() => {
                              const allChecked = rows.every(r => r.checked);
                              setRows(prev => prev.map(r => ({ ...r, checked: !allChecked })));
                            }}
                          />
                        )}
                      </th>
                      <th className="p-3">Article</th>
                      <th className="p-3 text-right">Prix initial</th>
                      <th className="p-3 w-28 text-right">% Réduction</th>
                      <th className="p-3 text-right">Prix soldé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fetchError ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center">
                          <div className="flex flex-col items-center gap-1 text-red-500">
                            <span className="font-medium">Erreur de chargement</span>
                            <span className="text-[11px] text-red-400 max-w-md">{fetchError}</span>
                          </div>
                        </td>
                      </tr>
                    ) : articlesLoading ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 text-sm">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
                          Chargement…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 text-sm">
                          <Percent className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                          Aucun article trouvé dans cette catégorie
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className={`hover:bg-slate-50/50 transition-colors ${row.checked ? 'bg-amber-50/30' : ''}`}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 accent-black cursor-pointer h-4 w-4"
                              checked={row.checked}
                              onChange={(e) => updateRow(row.id, "checked", e.target.checked)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                                {row.image ? (
                                  <img src={row.image} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-slate-300 text-[10px]">—</div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 text-[13px]">{row.designation || "Sans nom"}</p>
                                <p className="text-[11px] text-slate-400 font-mono">{row.reference || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-semibold text-slate-900">
                            {formatCurrency(row.prix_vente)}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={99}
                                value={row.percent}
                                onChange={(e) => updateRow(row.id, "percent", Number(e.target.value))}
                                className="w-20 h-8 text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                disabled={!row.checked}
                              />
                              <span className="text-slate-400 text-xs w-4">%</span>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <span className={`font-semibold ${row.checked && row.percent > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                              {row.checked && row.percent > 0
                                ? formatCurrency(Number(row.prix_vente) * (1 - row.percent / 100))
                                : "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{rows.length} article(s) · {selectedCount} sélectionné(s)</span>
                  {readyToPromote.length > 0 && (
                    <span className="font-medium text-emerald-600">
                      {readyToPromote.length} avec % &gt; 0
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardSection>

      {!promoCategorie && (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
          <Percent className="h-8 w-8 text-slate-300" />
          Sélectionnez une catégorie pour commencer
        </div>
      )}
    </div>
  );
}

// ─────────────── MON PROFIL TAB ──────────────────────────────────

function MonProfilTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile]);

  const avatarUrl = profile?.avatar_url || null;
  const initial = (profile?.display_name || user?.email || "U")[0].toUpperCase();

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0 || !user?.id) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          await uploadAvatar({ data: { base64, fileName: file.name } });
          await qc.invalidateQueries({ queryKey: ["user-profile", user.id] });
          toast.success("Photo de profil mise à jour !");
        } catch (err: any) {
          toast.error("Erreur d'upload : " + err.message);
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        toast.error("Erreur de lecture du fichier");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error("Erreur d'upload : " + error.message);
      setUploading(false);
    }
  }

  async function handleSaveName() {
    if (!user?.id || !displayName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName.trim() });
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      await qc.invalidateQueries({ queryKey: ["user-profile", user.id] });
      toast.success("Nom mis à jour !");
    }
    setSavingName(false);
  }

  return (
    <div className="max-w-lg space-y-8">
      {/* Avatar */}
      <CardSection title="Photo de profil">
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-full w-full rounded-full object-cover border-2 border-slate-200"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-bold text-white shadow-sm">
                {initial}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="mr-2 h-4 w-4" />
              Changer la photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <p className="mt-1 text-xs text-slate-400">PNG, JPG ou WEBP</p>
          </div>
        </div>
      </CardSection>

      {/* Display Name */}
      <CardSection title="Nom d'affichage">
        <div className="flex gap-3">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Votre nom"
            className="max-w-xs"
          />
          <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()}>
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
        </div>
      </CardSection>

      {/* Email (lecture seule) */}
      <CardSection title="Email">
        <p className="text-sm text-slate-600">{user?.email || "—"}</p>
      </CardSection>
    </div>
  );
}

// ─────────────── CARD WRAPPER ───────────────────────────────────

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#091426]">
        {title}
      </h2>
      {children}
    </section>
);
}

// ─── Newsletter ──────────────────────────────────────────────

function NewsletterTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: subscribers = [], isLoading } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("id, email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = search.trim()
    ? subscribers.filter((s: any) =>
        s.email.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : subscribers;

  const exportCsv = () => {
    setExporting(true);
    const header = "Email;Date d'inscription";
    const rows = subscribers.map(
      (s: any) =>
        `${s.email};${new Date(s.created_at).toLocaleDateString("fr-FR")}`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <CardSection title="Inscrits à la newsletter">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <p className="text-sm text-slate-600">
            <strong className="text-black">{subscribers.length}</strong>{" "}
            inscrit{subscribers.length > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-3">
            {subscribers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={exporting}
                className="text-xs"
              >
                Exporter CSV
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un email..."
                className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-black w-60"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {search.trim()
              ? "Aucun email trouvé."
              : "Aucun inscrit pour le moment."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="pb-3 text-left">Email</th>
                  <th className="pb-3 text-right">Date d'inscription</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 text-sm text-slate-800">{s.email}</td>
                    <td className="py-3 text-sm text-slate-500 text-right">
                      {new Date(s.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardSection>
    </div>
  );
}

// ─── Livraison & Devises ──────────────────────────────────────

function ShippingConfigTab() {
  const qc = useQueryClient();
  const { data: currencies = [], isLoading: loadCurrencies } = useQuery({
    queryKey: ["admin-currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: zones = [], isLoading: loadZones } = useQuery({
    queryKey: ["admin-shipping-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("*")
        .order("country_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [newZone, setNewZone] = useState({
    country_code: "",
    country_name: "",
    currency_code: "TND",
    shipping_fee: "",
  });

  const updateCurrencyRate = async (code: string, rate: number) => {
    const { error } = await supabase
      .from("currencies")
      .update({ rate_to_tnd: rate })
      .eq("code", code);
    if (error) toast.error(error.message);
    else {
      toast.success(`Taux ${code} mis à jour`);
      qc.invalidateQueries({ queryKey: ["admin-currencies"] });
    }
  };

  const updateZoneFee = async (id: string, fee: number) => {
    const { error } = await supabase
      .from("shipping_zones")
      .update({ shipping_fee: fee })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Frais de livraison mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
    }
  };

  const addZone = async () => {
    if (!newZone.country_code.trim() || !newZone.country_name.trim()) {
      toast.error("Code pays et nom requis");
      return;
    }
    const { error } = await supabase.from("shipping_zones").insert([
      {
        country_code: newZone.country_code.toUpperCase().trim(),
        country_name: newZone.country_name.trim(),
        currency_code: newZone.currency_code,
        shipping_fee: Number(newZone.shipping_fee) || 0,
      },
    ]);
    if (error) toast.error(error.message);
    else {
      toast.success("Zone ajoutée");
      setNewZone({
        country_code: "",
        country_name: "",
        currency_code: "TND",
        shipping_fee: "",
      });
      qc.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
    }
  };

  const deleteZone = async (id: string) => {
    if (!confirm("Supprimer cette zone de livraison ?")) return;
    const { error } = await supabase
      .from("shipping_zones")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Zone supprimée");
      qc.invalidateQueries({ queryKey: ["admin-shipping-zones"] });
    }
  };

  if (loadCurrencies || loadZones) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TAUX DE CHANGE */}
      <CardSection title="Taux de change (1 TND = X)">
        <div className="space-y-3">
          {currencies.map((c: any) => (
            <div
              key={c.code}
              className="flex flex-wrap items-center justify-between gap-3 border border-slate-100 rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#091426]">
                  {c.name}{" "}
                  <span className="text-slate-400 font-normal">
                    ({c.code} · {c.symbol})
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Affichage : {c.locale}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  key={c.code}
                  defaultValue={Number(c.rate_to_tnd)}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-28 h-9 text-sm rounded-lg"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0 && v !== Number(c.rate_to_tnd)) {
                      updateCurrencyRate(c.code, v);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() =>
                    updateCurrencyRate(c.code, Number(c.rate_to_tnd))
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          Les prix du catalogue sont stockés en TND. Le taux convertit les prix
          dans la devise sélectionnée par le client.
        </p>
      </CardSection>

      {/* ZONES DE LIVRAISON */}
      <CardSection title="Frais de livraison par pays / zone">
        <div className="space-y-3">
          {zones.map((z: any) => (
            <div
              key={z.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-slate-100 rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[#091426]">
                  {z.country_name}{" "}
                  <span className="text-slate-400 font-normal">
                    ({z.country_code} · {z.currency_code})
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Devise affichée au client : {z.currency_code}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  key={z.id}
                  defaultValue={Number(z.shipping_fee)}
                  type="number"
                  step="0.001"
                  min="0"
                  className="w-28 h-9 text-sm rounded-lg"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!isNaN(v) && v !== Number(z.shipping_fee)) {
                      updateZoneFee(z.id, v);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-red-500 hover:text-red-600"
                  onClick={() => deleteZone(z.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* AJOUTER UNE ZONE */}
        <div className="mt-5 border-t border-slate-100 pt-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            Ajouter une zone
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Input
              placeholder="Code pays (FR)"
              value={newZone.country_code}
              onChange={(e) =>
                setNewZone((p) => ({ ...p, country_code: e.target.value }))
              }
              className="h-9 rounded-lg"
            />
            <Input
              placeholder="Nom (France)"
              value={newZone.country_name}
              onChange={(e) =>
                setNewZone((p) => ({ ...p, country_name: e.target.value }))
              }
              className="h-9 rounded-lg"
            />
            <Select
              value={newZone.currency_code}
              onValueChange={(v) =>
                setNewZone((p) => ({ ...p, currency_code: v }))
              }
            >
              <SelectTrigger className="h-9 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c: any) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Frais"
              type="number"
              step="0.001"
              min="0"
              value={newZone.shipping_fee}
              onChange={(e) =>
                setNewZone((p) => ({ ...p, shipping_fee: e.target.value }))
              }
              className="h-9 rounded-lg"
            />
            <Button className="h-9 gap-2" onClick={addZone}>
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </div>
        </div>
      </CardSection>
    </div>
  );
}




