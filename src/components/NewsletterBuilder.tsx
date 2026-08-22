import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { sendNewsletter } from "@/lib/send-newsletter.functions";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  RectangleHorizontal,
  Columns2,
  Columns3,
  BookOpen,
  Save,
  Search,
  GripVertical,
  Send,
} from "lucide-react";

type Frame = "hero" | "duo" | "trio" | "magazine";
type ImageFormat = "1:1" | "3:4" | "16:9";

interface Block {
  id: string;
  frame: Frame;
  format: ImageFormat;
  articleIds: string[];
}

interface NewsletterRow {
  id: string;
  subject: string;
  content: Block[];
}

const FRAMES: { id: Frame; label: string; icon: any; slots: number }[] = [
  { id: "hero", label: "Grand Rectangle", icon: RectangleHorizontal, slots: 1 },
  { id: "duo", label: "Grille 2 Colonnes", icon: Columns2, slots: 2 },
  { id: "trio", label: "Grille 3 Colonnes", icon: Columns3, slots: 3 },
  { id: "magazine", label: "Carte Magazine", icon: BookOpen, slots: 1 },
];

const FORMATS: { id: ImageFormat; label: string }[] = [
  { id: "1:1", label: "Carré 1:1" },
  { id: "3:4", label: "Portrait 3:4" },
  { id: "16:9", label: "Paysage 16:9" },
];

const fmtAspect: Record<ImageFormat, string> = {
  "1:1": "aspect-square",
  "3:4": "aspect-[3/4]",
  "16:9": "aspect-video",
};

let uid = 0;
const makeId = () => `b${Date.now()}_${uid++}`;

const newBlock = (frame: Frame): Block => ({
  id: makeId(),
  frame,
  format: "3:4",
  articleIds: [],
});

export function NewsletterBuilder() {
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [articlesMap, setArticlesMap] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [savedList, setSavedList] = useState<NewsletterRow[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("articles")
        .select(
          "id, designation, reference, prix_vente, prix_promotionnel, promotion_active, image",
        )
        .in("status", ["ok", "actif"])
        .order("designation");
      const list = data ?? [];
      setArticles(list);
      const map: Record<string, any> = {};
      list.forEach((a: any) => (map[a.id] = a));
      setArticlesMap(map);
    };
    load();
    loadSaved();
    loadSubscriberCount();
  }, []);

  const loadSubscriberCount = async () => {
    const { count, error } = await supabase
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true });
    if (!error && typeof count === "number") setSubscriberCount(count);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerFor(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadSaved = async () => {
    const { data } = await supabase
      .from("newsletters")
      .select("*")
      .order("updated_at", { ascending: false });
    setSavedList(data ?? []);
  };

  const filteredArticles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a: any) =>
        a.designation?.toLowerCase().includes(q) ||
        a.reference?.toLowerCase().includes(q),
    );
  }, [articles, searchTerm]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const deleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const toggleArticle = (blockId: string, articleId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const has = block.articleIds.includes(articleId);
    updateBlock(blockId, {
      articleIds: has
        ? block.articleIds.filter((id) => id !== articleId)
        : [...block.articleIds, articleId].slice(0, FRAMES.find((f) => f.id === block.frame)!.slots),
    });
  };

  const reset = () => {
    setSubject("");
    setBlocks([]);
  };

  const save = async (): Promise<string | null> => {
    if (!subject.trim()) {
      toast.error("Veuillez saisir un objet pour la newsletter.");
      return null;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("newsletters")
      .insert([{ subject: subject.trim(), content: blocks }])
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message || "Erreur lors de l'enregistrement.");
      return null;
    }
    toast.success("Newsletter enregistrée !");
    await loadSaved();
    return data?.id ?? null;
  };

  const sendNow = async () => {
    if (!subject.trim()) {
      toast.error("Veuillez saisir un objet pour la newsletter.");
      return;
    }
    if (blocks.length === 0) {
      toast.error("Ajoutez au moins un bloc avant d'envoyer.");
      return;
    }
    if (subscriberCount === 0) {
      toast.warning("Aucun abonné à la newsletter pour le moment.");
      return;
    }
    setSending(true);
    try {
      const newsletterId = await save();
      if (!newsletterId) return;
      const result = await sendNewsletter({
        data: { newsletterId, subject: subject.trim(), content: blocks },
      });
      toast.success(
        `Newsletter envoyée à ${result.sent} abonné${
          result.sent > 1 ? "s" : ""
        }${result.skipped > 0 ? ` · ${result.skipped} en échec` : ""}.`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  const deleteSaved = async (id: string) => {
    if (!confirm("Supprimer cette newsletter ?")) return;
    const { error } = await supabase.from("newsletters").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Newsletter supprimée");
      loadSaved();
    }
  };

  const loadSavedNewsletter = (row: NewsletterRow) => {
    setSubject(row.subject);
    setBlocks(Array.isArray(row.content) ? row.content : []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* ─── ÉDITEUR ─── */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <Label className="text-xs font-bold text-[#091426]">Objet de la newsletter</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex : Les nouveautés de la semaine"
            className="mt-2 h-10 rounded-lg"
          />
        </div>

        {/* BLOCS */}
        {blocks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-400">
              Aucun bloc. Ajoutez un cadre pour commencer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map((block, index) => (
              <div key={block.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
                {/* EN-TÊTE BLOC */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Bloc {index + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteBlock(block.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* CADRE */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">Cadre</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {FRAMES.map((f) => {
                      const Icon = f.icon;
                      const active = block.frame === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => updateBlock(block.id, { frame: f.id, articleIds: [] })}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                            active
                              ? "border-black bg-black text-white"
                              : "border-slate-200 text-slate-600 hover:border-slate-400"
                          }`}
                        >
                          <Icon className="w-4 h-4" /> {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FORMAT IMAGE */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">
                    Format des photos
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    {FORMATS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => updateBlock(block.id, { format: f.id })}
                        className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                          block.format === f.id
                            ? "border-black bg-black text-white"
                            : "border-slate-200 text-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ARTICLES */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">
                    Articles ({block.articleIds.length}/
                    {FRAMES.find((f) => f.id === block.frame)!.slots})
                  </Label>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {block.articleIds.map((id) => {
                      const a = articlesMap[id];
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full pl-1 pr-2 py-1 text-xs"
                        >
                          {a?.image ? (
                            <img src={a.image} alt="" className="w-6 h-6 object-cover rounded-full" />
                          ) : (
                            <span className="w-6 h-6 bg-slate-200 rounded-full" />
                          )}
                          {a?.designation?.slice(0, 20)}
                          <button
                            onClick={() => toggleArticle(block.id, id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                    {block.articleIds.length <
                      FRAMES.find((f) => f.id === block.frame)!.slots && (
                      <button
                        onClick={() => setPickerFor(pickerFor === block.id ? null : block.id)}
                        className="inline-flex items-center gap-1.5 border border-dashed border-slate-300 rounded-full px-3 py-1 text-xs text-slate-500 hover:border-slate-500"
                      >
                        <Plus className="w-3 h-3" /> Ajouter un article
                      </button>
                    )}
                  </div>
                </div>

                {/* SÉLECTEUR D'ARTICLES */}
                {pickerFor === block.id && (
                  <div ref={pickerRef} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredArticles.length === 0 && (
                        <p className="text-xs text-slate-400 py-2 text-center">Aucun article</p>
                      )}
                      {filteredArticles.map((a: any) => {
                        const selected = block.articleIds.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            onClick={() => toggleArticle(block.id, a.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors ${
                              selected ? "bg-black text-white" : "hover:bg-slate-100"
                            }`}
                          >
                            <span className="flex-1 truncate">{a.designation}</span>
                            <span className={selected ? "text-white/70" : "text-slate-400"}>
                              {formatCurrency(Number(a.prix_vente || 0))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AJOUTER UN BLOC */}
        <div className="flex flex-wrap gap-2">
          {FRAMES.map((f) => {
            const Icon = f.icon;
            return (
              <Button
                key={f.id}
                variant="outline"
                size="sm"
                onClick={() => setBlocks((prev) => [...prev, newBlock(f.id)])}
                className="text-xs"
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" /> + {f.label}
              </Button>
            );
          })}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">
          <Button onClick={() => save()} disabled={saving} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Enregistrement..." : "Enregistrer la newsletter"}
          </Button>
          <Button variant="outline" onClick={reset} className="text-slate-600">
            Réinitialiser
          </Button>
        </div>

        {/* ENVOI */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#091426]">
                {subscriberCount} abonné{subscriberCount > 1 ? "s" : ""} prêt{subscriberCount > 1 ? "s" : ""} à recevoir la newsletter
              </p>
              <p className="text-xs text-slate-500 mt-1">
                L'envoi concerne tous les e-mails de la table
                newsletter_subscribers.
              </p>
            </div>
            <Button
              onClick={sendNow}
              disabled={sending || subscriberCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              {sending
                ? "Envoi en cours..."
                : subscriberCount === 0
                  ? "Aucun abonné"
                  : `Envoyer à ${subscriberCount} abonné${subscriberCount > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── APERÇU + SAUVEGARDES ─── */}
      <div className="space-y-6">
        {/* APERÇU */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <Label className="text-xs font-bold text-[#091426] mb-3 block">Aperçu</Label>
          {blocks.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl h-48 flex items-center justify-center">
              <p className="text-xs text-slate-300">Aperçu vide</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subject && (
                <h2 className="text-lg font-serif font-semibold uppercase tracking-wider">
                  {subject}
                </h2>
              )}
              {blocks.map((block) => (
                <BlockPreview key={block.id} block={block} articlesMap={articlesMap} />
              ))}
            </div>
          )}
        </div>

        {/* SAUVEGARDES */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <Label className="text-xs font-bold text-[#091426] mb-3 block">
            Newsletters enregistrées ({savedList.length})
          </Label>
          {savedList.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              Aucune newsletter enregistrée.
            </p>
          ) : (
            <div className="space-y-2">
              {savedList.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2.5"
                >
                  <button onClick={() => loadSavedNewsletter(row)} className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{row.subject}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(row.updated_at).toLocaleDateString("fr-FR")} ·{" "}
                      {(row.content || []).length} bloc(s)
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500"
                    onClick={() => deleteSaved(row.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Aperçu d'un bloc ────────────────────────────────────────
function BlockPreview({ block, articlesMap }: { block: Block; articlesMap: Record<string, any> }) {
  const arts = block.articleIds.map((id) => articlesMap[id]).filter(Boolean);
  const aspect = fmtAspect[block.format];

  const Img = ({ a }: { a: any }) => (
    <div className={`${aspect} bg-slate-100 overflow-hidden`}>
      {a?.image ? (
        <img src={a.image} alt={a.designation} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 uppercase">
          Image
        </div>
      )}
    </div>
  );

  const Title = ({ a }: { a: any }) => (
    <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.05em] truncate">
      {a?.designation}
    </p>
  );

  const Price = ({ a }: { a: any }) => (
    <p className="text-[12px] font-bold">
      {a?.promotion_active && a?.prix_promotionnel ? (
        <>
          <span className="text-red-600">{formatCurrency(Number(a.prix_promotionnel))}</span>{" "}
          <span className="text-slate-400 line-through text-[11px]">
            {formatCurrency(Number(a.prix_vente))}
          </span>
        </>
      ) : (
        formatCurrency(Number(a?.prix_vente || 0))
      )}
    </p>
  );

  if (arts.length === 0) return null;

  switch (block.frame) {
    case "hero":
      return (
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <Img a={arts[0]} />
          <div className="p-3">
            <Title a={arts[0]} />
            <Price a={arts[0]} />
          </div>
        </div>
      );
    case "duo":
      return (
        <div className="grid grid-cols-2 gap-3">
          {arts.slice(0, 2).map((a, i) => (
            <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
              <Img a={a} />
              <div className="p-2">
                <Title a={a} />
                <Price a={a} />
              </div>
            </div>
          ))}
        </div>
      );
    case "trio":
      return (
        <div className="grid grid-cols-3 gap-3">
          {arts.slice(0, 3).map((a, i) => (
            <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
              <Img a={a} />
              <div className="p-2">
                <Title a={a} />
                <Price a={a} />
              </div>
            </div>
          ))}
        </div>
      );
    case "magazine":
      return (
        <div className="border border-slate-100 rounded-xl overflow-hidden flex gap-3">
          <div className="w-2/5 shrink-0">
            <Img a={arts[0]} />
          </div>
          <div className="flex-1 flex flex-col justify-center p-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.05em] leading-tight">
              {arts[0]?.designation}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {arts[0]?.reference || "Exclusivité Vendly"}
            </p>
            <Price a={arts[0]} />
          </div>
        </div>
      );
    default:
      return null;
  }
}
