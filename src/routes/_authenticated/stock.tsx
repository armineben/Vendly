import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Download, Copy, Upload, Archive, User, Tag, Sparkles } from "lucide-react";
import { ImportArticlesDialog } from "@/components/ImportArticlesDialog";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, resolveImage } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArticleFormDialog } from "@/components/ArticleFormDialog";
import { CATEGORY_GROUPS } from "@/lib/categories";
import { FilterDropdown } from "@/components/FilterDropdown";

export const Route = createFileRoute("/_authenticated/stock")({
  component: StockPage,
});

function StockPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [promoFilter, setPromoFilter] = useState<string>("all");
  const [sort, setSort] = useState<"reference" | "quantite" | "designation">("reference");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 1. Récupération des articles de manière totalement isolée
  const { data: articles = [], isLoading: isLoadingArticles } = useQuery({
    queryKey: ["raw-articles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("articles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Récupération des variantes de manière totalement isolée
  const { data: variantes = [], isLoading: isLoadingVariantes } = useQuery({
    queryKey: ["raw-variantes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("variantes").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = isLoadingArticles || isLoadingVariantes;

  // 3. Reconstruction manuelle et ultra-sécurisée des lignes à afficher
  const flattenedRows = useMemo(() => {
    const rows: any[] = [];
    
    articles.forEach((article) => {
      if (!article) return;

      // On cherche si cet article possède des variantes correspondantes
      const artVariantes = variantes.filter((v) => v.article_id === article.id);

      if (artVariantes.length === 0) {
        // Pas de variante : Ligne standard
        rows.push({
          ...article,
          unique_row_id: `${article.id}-default`,
          variante_id: null,
          taille: article.taille || "—",
          couleur: article.couleur || "—",
          quantite: article.quantite ?? 0,
          image_affichee: article.image || (article.images && article.images[0]) || null
        });
      } else {
        // Multiples variantes : Une ligne par variante
        artVariantes.forEach((v) => {
          rows.push({
            ...article,
            unique_row_id: String(v.id),
            variante_id: v.id,
            taille: v.taille || "—",
            couleur: v.couleur || "—",
            quantite: v.stock ?? v.quantite ?? 0,
            image_affichee: v.image_url || article.image || (article.images && article.images[0]) || null
          });
        });
      }
    });
    
    return rows;
  }, [articles, variantes]);

  // Application des filtres et tris
  const filtered = useMemo(() => {
    let r = flattenedRows.filter((row) => {
      if (
        row.archived === true || 
        row.status === "supprime" || 
        row.status === "archive"
      ) {
        return false;
      }

      const s = search.trim().toLowerCase();
      const matchSearch =
        !s ||
        (row.reference && String(row.reference).toLowerCase().includes(s)) ||
        (row.designation && String(row.designation).toLowerCase().includes(s));
        
      const cat = (row.categorie || "").toLowerCase();
      const matchGenre =
        genreFilter === "all" ||
        (genreFilter === "FEMME" && cat.startsWith("femme")) ||
        (genreFilter === "HOMME" && cat.startsWith("homme")) ||
        (genreFilter === "ENFANTS" && (cat.startsWith("enfant") || cat.startsWith("bébé")));
      const matchCat = catFilter === "all" || row.categorie === catFilter;
      const matchPromo = promoFilter === "all" || (promoFilter === "promo" && row.promotion_active);
      return matchSearch && matchGenre && matchCat && matchPromo;
    });

    r = r.sort((a, b) => {
      if (sort === "quantite") return (a.quantite || 0) - (b.quantite || 0);
      const valA = String(a[sort as keyof typeof a] ?? "");
      const valB = String(b[sort as keyof typeof b] ?? "");
      return valA.localeCompare(valB);
    });

    return r;
  }, [flattenedRows, search, genreFilter, catFilter, promoFilter, sort]);

  // Regroupement par article (une ligne unique par produit)
  const groupedRows = useMemo(() => {
    const groups: Record<string, any> = {};

    filtered.forEach((row) => {
      if (!groups[row.id]) {
        groups[row.id] = {
          ...row,
          unique_row_id: row.id,
          totalStock: 0,
          sizes: [] as { taille: string; quantite: number }[],
          colors: [] as string[],
          variantRows: [] as any[],
        };
      }
      const g = groups[row.id];
      g.totalStock += row.quantite || 0;
      if (row.taille && row.taille !== "—") {
        const existing = g.sizes.find((s: any) => s.taille === row.taille);
        if (existing) {
          existing.quantite += row.quantite || 0;
        } else {
          g.sizes.push({ taille: row.taille, quantite: row.quantite || 0 });
        }
      }
      if (row.couleur && row.couleur !== "—" && !g.colors.includes(row.couleur)) {
        g.colors.push(row.couleur);
      }
      g.variantRows.push(row);
    });

    return Object.values(groups);
  }, [filtered]);

  // Stats du tableau de bord
  const stats = useMemo(() => {
    const actifs = groupedRows.filter((r) => !(r.archived === true || r.status === "supprime" || r.status === "archive"));
    const totalArticles = actifs.length;
    const totalStock = actifs.reduce((acc, r) => acc + (r.totalStock || 0), 0);
    const lowStock = actifs.filter((r) => (r.totalStock || 0) <= 2);
    const allCats = CATEGORY_GROUPS.flatMap((g) => g.items.map((i) => i.value));
    return { totalArticles, totalStock, lowStockCount: lowStock.length, categoriesCount: allCats.length };
  }, [groupedRows]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("articles")
        .update({ status, archived: status === "archive" || status === "supprime" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "archive" ? "Article archivé" : "Déplacé dans la corbeille");
      qc.invalidateQueries({ queryKey: ["raw-articles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkTrash = useMutation({
    mutationFn: async (articleIds: string[]) => {
      const { error } = await supabase
        .from("articles")
        .update({ status: "supprime", archived: true }) 
        .in("id", articleIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Articles déplacés dans la corbeille");
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["raw-articles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkSetNew = useMutation({
    mutationFn: async ({
      articleIds,
      isNew,
    }: {
      articleIds: string[];
      isNew: boolean;
    }) => {
      const { error } = await supabase
        .from("articles")
        .update({ is_new: isNew })
        .in("id", articleIds);
      if (error && error.code === "42703") {
        throw new Error(
          "Colonne is_new absente : exécutez la migration articles_is_new dans Supabase.",
        );
      }
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut Nouveau mis à jour");
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["raw-articles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateQty = useMutation({
    mutationFn: async ({ row, quantite }: { row: any; quantite: number }) => {
      if (row.variante_id) {
        const { error } = await supabase
          .from("variantes")
          .update({ stock: quantite })
          .eq("id", row.variante_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("articles")
          .update({ quantite: quantite })
          .eq("id", row.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["raw-articles"] });
      qc.invalidateQueries({ queryKey: ["raw-variantes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function exportXlsx() {
    const rows = filtered.map((a) => ({
      Référence: a.reference,
      Désignation: a.designation,
      Catégorie: a.categorie,
      Taille: a.taille,
      Couleur: a.couleur,
      Quantité: a.quantite,
      ...(isAdmin ? { "Prix achat": Number(a.prix_achat) } : {}),
      "Prix vente": Number(a.prix_vente),
      Emplacement: a.emplacement,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const handleBulkTrash = () => {
    if (selectedIds.length === 0) return;
    const distinctArticleIds = Array.from(
      new Set(filtered.filter((row) => selectedIds.includes(row.unique_row_id)).map((row) => row.id))
    );
    if (window.confirm(`Voulez-vous vraiment déplacer ces articles vers la corbeille ?`)) {
      bulkTrash.mutate(distinctArticleIds);
    }
  };

  const handleBulkNew = (isNew: boolean) => {
    if (selectedIds.length === 0) return;
    const distinctArticleIds = Array.from(
      new Set(filtered.filter((row) => selectedIds.includes(row.unique_row_id)).map((row) => row.id))
    );
    bulkSetNew.mutate({ articleIds: distinctArticleIds, isNew });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10 bg-[#fbfbfa] min-h-screen">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#747878] font-bold">Back-office</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-black">Gestion du stock</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportXlsx} className="text-xs font-bold border-border bg-white text-black shadow-2xs hover:bg-[#fafafa]">
            <Download className="mr-2 h-3.5 w-3.5 text-[#747878]" /> Exporter
          </Button>
          
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)} className="text-xs font-bold border-border bg-white text-black shadow-2xs hover:bg-[#fafafa]">
                <Upload className="mr-2 h-3.5 w-3.5 text-[#747878]" /> Importer depuis Excel
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
                className="bg-black text-white hover:bg-black/90 text-xs font-bold shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" /> Ajouter
              </Button>
            </>
          )}
        </div>
      </header>

      {/* CARTES RÉSUMÉ (DASHBOARD) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#747878]">Articles</p>
          <p className="text-3xl font-extrabold text-black mt-1">{stats.totalArticles}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#747878]">Stock total</p>
          <p className="text-3xl font-extrabold text-black mt-1">{stats.totalStock}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#747878]">Catégories</p>
          <p className="text-3xl font-extrabold text-black mt-1">{stats.categoriesCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-5 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#747878]">Stock bas</p>
          <p className={`text-3xl font-extrabold mt-1 ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-black'}`}>
            {stats.lowStockCount}
          </p>
        </div>
      </div>

      {/* FILTRES DÉROULANTS */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterDropdown
          label="Genre"
          icon={User}
          value={genreFilter}
          onChange={(v) => { setGenreFilter(v); setCatFilter("all"); }}
          options={[
            { value: "all", label: "Tous les genres", icon: User },
            { value: "FEMME", label: "Femme" },
            { value: "HOMME", label: "Homme" },
            { value: "ENFANTS", label: "Enfants" },
          ]}
        />

        <FilterDropdown
          label="Catégorie"
          icon={Tag}
          value={catFilter}
          onChange={setCatFilter}
          options={[
            { value: "all", label: "Toutes les catégories", icon: Tag },
            ...(genreFilter === "all"
              ? CATEGORY_GROUPS.flatMap((g) =>
                  g.items.map((i) => ({ value: i.value, label: `${g.title} - ${i.label}` }))
                )
              : (CATEGORY_GROUPS.find((g) => g.title === genreFilter)?.items.map((i) => ({
                  value: i.value,
                  label: i.label,
                })) ?? [])
            ),
          ]}
        />

        <FilterDropdown
          label="Promotions"
          icon={Tag}
          value={promoFilter}
          onChange={setPromoFilter}
          options={[
            { value: "all", label: "Tous les articles" },
            { value: "promo", label: "🔥 En Promotion" },
          ]}
        />

        <span className="text-xs text-zinc-400 font-medium ml-auto">
          {groupedRows.length} article(s)
        </span>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747878]" />
          <Input
            placeholder="Rechercher par référence ou désignation"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-border rounded-lg placeholder:text-[#a0a0a0] focus-visible:ring-black"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-[180px] bg-white border-border rounded-lg font-medium text-black">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reference">Tri : Référence</SelectItem>
              <SelectItem value="designation">Tri : Désignation</SelectItem>
              <SelectItem value="quantite">Tri : Quantité</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-sm font-semibold text-indigo-900">
              {selectedIds.length} article{selectedIds.length > 1 ? "s" : ""} sélectionné{selectedIds.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkNew(true)}
              className="border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 text-xs font-bold shadow-sm"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Marquer comme Nouveau
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkNew(false)}
              className="border-slate-300 text-slate-600 bg-white hover:bg-slate-50 text-xs font-bold shadow-sm"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 opacity-40" /> Retirer des nouveautés
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkTrash}
              className="border-red-200 text-red-600 bg-white hover:bg-red-50 text-xs font-bold shadow-sm"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Corbeille ({selectedIds.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Décocher tout
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse text-left">
            <thead className="bg-[#b3b3b3] text-[11px] font-bold uppercase tracking-wider text-black border-b border-border">
              <tr>
                {isAdmin && (
                  <th className="px-6 py-3.5 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-black focus:ring-black accent-black cursor-pointer h-4 w-4"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(groupedRows.map((a) => a.unique_row_id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      checked={groupedRows.length > 0 && selectedIds.length === groupedRows.length}
                    />
                  </th>
                )}
                <th className="px-6 py-3.5">Article</th>
                <th className="px-6 py-3.5">Catégorie</th>
                <th className="px-6 py-3.5">Tailles</th>
                <th className="px-6 py-3.5">Couleurs</th>
                <th className="px-6 py-3.5 text-center">Stock total</th>
                {isAdmin && <th className="px-6 py-3.5 text-right">Achat</th>}
                <th className="px-6 py-3.5 text-right">Vente</th>
                {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-[#f0f0f0]">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 6} className="px-6 py-16 text-center text-muted-foreground font-medium">
                    Chargement des articles...
                  </td>
                </tr>
              ) : groupedRows.map((a) => {
                const img = resolveImage(a.image_affichee || a.image || (a.images?.[0]));
                const low = (a.totalStock || 0) <= 2;
                const isChecked = selectedIds.includes(a.unique_row_id);
                return (
                  <tr 
                    key={a.unique_row_id} 
                    className={`hover:bg-[#fafafa] transition-colors ${
                      isChecked ? "bg-[#f5f5f4] hover:bg-[#eaeae9]" : ""
                    }`}
                  >
                    {isAdmin && (
                      <td className="px-6 py-4 w-10">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-black focus:ring-black accent-black cursor-pointer h-4 w-4"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, a.unique_row_id]);
                            } else {
                              setSelectedIds(selectedIds.filter((id) => id !== a.unique_row_id));
                            }
                          }}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#fafafa] border border-border">
                          {img && (
                            <img
                              src={img}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-black">{a.designation || "Sans nom"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{a.reference || "Pas de réf"}</p>
                          {a.promotion_active && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                              -{Math.round((1 - a.prix_promotionnel / a.prix_vente) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#747878]">{a.categorie || "—"}</td>
                    <td className="px-6 py-4">
                      {a.sizes && a.sizes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {a.sizes.map((s: any) => (
                            <span key={s.taille} className="inline-block bg-zinc-100 px-2 py-0.5 rounded text-xs text-zinc-700 font-medium whitespace-nowrap">
                              {s.taille} <span className="text-zinc-400 font-normal">({s.quantite})</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#747878] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {a.colors && a.colors.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {a.colors.map((c: string) => (
                            <span key={c} className="inline-block bg-zinc-100 px-2 py-0.5 rounded text-xs text-zinc-700 font-medium">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#747878]">Couleur Unique</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-bold text-sm ${low ? "text-red-600" : "text-black"}`}>
                        {a.totalStock || 0}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right text-[#747878]">
                        {formatCurrency(a.prix_achat)}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right font-semibold text-black">
                      {a.promotion_active && a.prix_promotionnel ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-red-600">{formatCurrency(a.prix_promotionnel)}</span>
                          <span className="text-[#747878] line-through text-xs">{formatCurrency(a.prix_vente)}</span>
                        </div>
                      ) : (
                        formatCurrency(a.prix_vente)
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              const { id, unique_row_id, variante_id, variantes, created_at, updated_at, ...rest } = a;
                              setEditing({
                                ...rest,
                                designation: `${a.designation || ""} (Copie)`,
                                reference: `${a.reference || ""}-COPIE`,
                                quantite: 0,
                              });
                              setOpen(true);
                            }}
                            className="rounded-md p-2 text-muted-foreground hover:bg-[#fafafa] hover:text-black transition-colors"
                            title="Dupliquer"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => {
                              const toutesLesVariantesDeLarticle = (a.variantRows || []).map((r: any) => ({
                                id: r.variante_id,
                                article_id: r.id,
                                taille: r.taille,
                                couleur: r.couleur,
                                stock: r.quantite,
                                image_url: r.image_affichee || r.image || (r.images?.[0]),
                              }));
                              setEditing({
                                ...a,
                                variantes: toutesLesVariantesDeLarticle
                              });
                              setOpen(true);
                            }}
                            className="rounded-md p-2 text-muted-foreground hover:bg-[#fafafa] hover:text-black transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => {
                              if (confirm(`Archiver "${a.designation || ""}" ?`))
                                updateStatus.mutate({ id: a.id, status: "archive" });
                            }}
                            className="rounded-md p-2 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 transition-colors"
                            title="Archiver"
                          >
                            <Archive className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Déplacer "${a.designation || ""}" vers la corbeille ?`))
                                updateStatus.mutate({ id: a.id, status: "supprime" });
                            }}
                            className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Mettre à la corbeille"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!isLoading && groupedRows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 6} className="px-6 py-16 text-center text-muted-foreground font-medium italic">
                    Aucun article actif trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <>
          <ArticleFormDialog open={open} onOpenChange={setOpen} article={editing} />
          <ImportArticlesDialog open={importOpen} onOpenChange={setImportOpen} />
        </>
      )}
    </div>
  );
}