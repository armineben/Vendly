import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { User, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_GROUPS } from "@/lib/categories";
import { FilterDropdown } from "@/components/FilterDropdown";

export const Route = createFileRoute("/_authenticated/gestion-catalogue")({
  component: GestionCataloguePage,
});

type Status = "ok" | "archive" | "supprime";

function GestionCataloguePage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("ok");
  const [selected, setSelected] = useState<string[]>([]);
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [promoFilter, setPromoFilter] = useState<string>("all");
  const [bulkDiscount, setBulkDiscount] = useState<number>(20);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["articles-by-status", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("status", tab)
        .order("designation");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return items.filter((a: any) => {
      const cat = (a.categorie || "").toLowerCase();
      const matchGenre =
        genreFilter === "all" ||
        (genreFilter === "FEMME" && cat.startsWith("femme")) ||
        (genreFilter === "HOMME" && cat.startsWith("homme")) ||
        (genreFilter === "ENFANTS" && (cat.startsWith("enfant") || cat.startsWith("bébé")));
      const matchCat = catFilter === "all" || a.categorie === catFilter;
      const matchPromo = promoFilter === "all" || (promoFilter === "promo" && a.promotion_active);
      return matchGenre && matchCat && matchPromo;
    });
  }, [items, genreFilter, catFilter, promoFilter]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase
        .from("articles")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["articles-by-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleNew = useMutation({
    mutationFn: async ({ id, isNew }: { id: string; isNew: boolean }) => {
      const { error } = await supabase
        .from("articles")
        .update({ is_new: isNew })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nouveauté mise à jour");
      qc.invalidateQueries({ queryKey: ["articles-by-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const hardDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("sales").delete().in("article_id", ids);
      const { error } = await supabase.from("articles").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Articles supprimés définitivement");
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["articles-by-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkPromo = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: articles, error: fetchErr } = await supabase
        .from("articles")
        .select("id, prix_vente")
        .in("id", ids);
      if (fetchErr) throw fetchErr;

      const updates = (articles || []).map((a: any) => ({
        id: a.id,
        promotion_active: true,
        prix_promotionnel: Number(a.prix_vente || 0) * (1 - bulkDiscount / 100),
      }));

      for (const u of updates) {
        const { error } = await supabase
          .from("articles")
          .update({ promotion_active: u.promotion_active, prix_promotionnel: u.prix_promotionnel })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${bulkDiscount}% appliqué sur ${selected.length} article(s)`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["articles-by-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearPromo = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("articles")
        .update({ promotion_active: false, prix_promotionnel: null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Promotions retirées sur ${selected.length} article(s)`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["articles-by-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === filtered.length) {
      setSelected([]);
    } else {
      setSelected(filtered.map((a: any) => a.id));
    }
  };

  if (!isAdmin) {
    return <div className="p-10 text-center text-muted-foreground">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10">
      <h1 className="font-display text-4xl">Gestion du catalogue</h1>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as Status); setSelected([]); }}>
        <TabsList>
          <TabsTrigger value="ok">Actifs</TabsTrigger>
          <TabsTrigger value="archive">Archives</TabsTrigger>
          <TabsTrigger value="supprime">Corbeille</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">

          {/* FILTRES DÉROULANTS */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
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
                { value: "promo", label: "🔥 Articles en promotion" },
              ]}
            />

            <span className="text-xs text-zinc-400 font-medium">
              {filtered.length} article(s)
            </span>
          </div>

          {/* Barre d'actions pour la corbeille */}
          {tab === "supprime" && filtered.length > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-secondary/30 rounded-xl">
              <input
                type="checkbox"
                checked={selected.length === filtered.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">
                {selected.length > 0 ? `${selected.length} sélectionné(s)` : "Tout sélectionner"}
              </span>

              {selected.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => {
                    if (window.confirm(`Supprimer définitivement ${selected.length} article(s) ?`)) {
                      hardDelete.mutate(selected);
                    }
                  }}
                >
                  🗑️ Supprimer la sélection ({selected.length})
                </Button>
              )}

              {selected.length === 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => {
                    if (window.confirm("Vider toute la corbeille ? Cette action est irréversible !")) {
                      hardDelete.mutate(filtered.map((a: any) => a.id));
                    }
                  }}
                >
                  🗑️ Vider la corbeille
                </Button>
              )}
            </div>
          )}

          {/* Barre d'actions groupées pour les actifs */}
          {tab === "ok" && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
              <input
                type="checkbox"
                checked={selected.length === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">
                {selected.length > 0 ? `${selected.length} sélectionné(s)` : "Tout sélectionner"}
              </span>

              {selected.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-xs text-amber-800 font-medium">%</Label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    className="w-16 h-8 text-sm"
                    value={bulkDiscount}
                    onChange={(e) => setBulkDiscount(Number(e.target.value))}
                  />
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => {
                      if (window.confirm(`Appliquer ${bulkDiscount}% de réduction sur ${selected.length} article(s) ?`)) {
                        bulkPromo.mutate(selected);
                      }
                    }}
                  >
                    🔥 Appliquer la promo ({selected.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700"
                    onClick={() => {
                      if (window.confirm(`Supprimer les promotions sur ${selected.length} article(s) ?`)) {
                        clearPromo.mutate(selected);
                      }
                    }}
                  >
                    Retirer promo
                  </Button>
                </div>
              )}
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4 font-medium">Désignation</th>
                <th className="p-4 font-medium">Catégorie</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="p-10 text-center">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="p-10 text-center text-slate-400">Aucun article trouvé.</td></tr>
              ) : filtered.map((a: any) => (
                <tr key={a.id} className={`border-b ${selected.includes(a.id) ? 'bg-red-50' : ''}`}>

                  {/* Checkbox uniquement dans la corbeille */}
                  {tab === "supprime" && (
                    <td className="p-4 w-8">
                      <input
                        type="checkbox"
                        checked={selected.includes(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </td>
                  )}

                  <td className="p-4">
                    <div className="font-medium">{a.designation}</div>
                    <div className="text-xs text-slate-400">{a.reference}</div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <button
                        onClick={() => toggleNew.mutate({ id: a.id, isNew: !a.is_new })}
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          a.is_new
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-50 text-slate-400 border-slate-200 hover:text-indigo-600"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${a.is_new ? "bg-indigo-500" : "bg-slate-300"}`} />
                        {a.is_new ? "Nouveau ✓" : "Nouveau"}
                      </button>
                      {a.promotion_active && (
                        <span className="inline-block text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          -{Math.round((1 - a.prix_promotionnel / a.prix_vente) * 100)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">{a.categorie || "—"}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {tab === "ok" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: a.id, status: "archive" })}>Archiver</Button>
                          <Button size="sm" variant="destructive" onClick={() => setStatus.mutate({ id: a.id, status: "supprime" })}>Corbeille</Button>
                        </>
                      )}
                      {tab === "archive" && (
                        <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: "ok" })}>Restaurer</Button>
                      )}
                      {tab === "supprime" && (
                        <>
                          <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: "ok" })}>Récupérer</Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                            if (window.confirm(`Supprimer "${a.designation}" définitivement ?`)) {
                              hardDelete.mutate([a.id]);
                            }
                          }}>Supprimer</Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </TabsContent>
      </Tabs>
    </div>
  );
}
