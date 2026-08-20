import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, X, Star, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProductDrawer({
  article,
  onClose,
}: {
  article: any | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [selectedSize, setSelectedSize] = useState("M");
  const [vendeurId, setVendeurId] = useState<string>("");

  const { data: vendeurs = [] } = useQuery({
    queryKey: ["vendeurs-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!vendeurId && user) setVendeurId(user.id);
  }, [user, vendeurId]);

  const sell = useMutation({
    mutationFn: async () => {
      if (!article) return;
      if (!vendeurId) throw new Error("Sélectionnez le vendeur");

      const { data: freshArticle, error: fetchError } = await supabase
        .from("articles")
        .select("quantite")
        .eq("id", article.id)
        .maybeSingle();

      if (fetchError) throw new Error(`[Échec Lecture Stock] : ${fetchError.message}`);
      if (!freshArticle) throw new Error("L'article n'existe plus.");

      const stockActuel = freshArticle.quantite || 0;
      const nouveauStock = stockActuel - qty;

      if (nouveauStock < 0) {
        throw new Error(`Stock insuffisant ! Disponible : ${stockActuel}`);
      }

      const { error: updateStockError } = await supabase
        .from("articles")
        .update({ quantite: nouveauStock })
        .eq("id", article.id);

      if (updateStockError) throw new Error(`[Échec Stock] : ${updateStockError.message}`);

      const unit = Number(article.prix_vente);
      const total = unit * qty;
      const { error: insertSaleError } = await supabase
        .from("sales")
        .insert({
          article_id: article.id,
          quantite: qty,
          prix_unitaire: unit,
          prix_achat_unitaire: Number(article.prix_achat || 0),
          total,
          benefice: (unit - Number(article.prix_achat || 0)) * qty,
          vendeur_id: vendeurId
        });

      if (insertSaleError) throw new Error(`[Échec Vente] : ${insertSaleError.message}`);

      return true;
    },
    onSuccess: () => {
      toast.success("Vente enregistrée avec succès !");
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      setQty(1);
      onClose();
    },
    onError: (e: any) => {
      alert(`Erreur critique Supabase :\n\n${e.message}`);
    },
  });

  const open = !!article;
  const totalPrice = (article ? Number(article.prix_vente) : 0) * qty;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && !sell.isPending && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md bg-[#F5F5F5] text-[#1a1c1c] p-0 border-l border-[#c4c7c7]">
        {article && (
          <div className="flex flex-col h-full min-h-screen pb-36">
            {/* Header / Top Bar */}
            <div className="sticky top-0 z-10 bg-[#F5F5F5]/80 backdrop-blur-md border-b border-[#c4c7c7] px-6 py-4 flex justify-between items-center">
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#eeeeee] transition-colors">
                <X className="w-5 h-5 text-[#000000]" />
              </button>
              <span className="font-semibold tracking-tighter text-[20px] text-[#000000]">VENDLY</span>
              <div className="w-10" />
            </div>

            {/* Content Container */}
            <div className="p-6 space-y-6">
              {/* Product Info Head */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-[12px] font-bold tracking-wider text-[#1a1c1c]">
                  <Star className="w-4 h-4 fill-current text-[#000000]" />
                  <span>4.8 (124 REVIEWS)</span>
                </div>
                <h1 className="text-[28px] font-medium tracking-tighter uppercase leading-tight text-[#000000]">
                  {article.designation}
                </h1>
                <p className="text-[24px] font-medium text-[#000000]">
                  {formatCurrency(article.prix_vente)}
                </p>
              </div>

              {/* Product Badges/Details */}
              <div className="space-y-2 border-t border-[#c4c7c7] pt-4 text-sm text-[#444748]">
                <div className="flex justify-between py-1 border-b border-[#eeeeee]">
                  <span>Référence</span>
                  <span className="font-medium text-[#1a1c1c]">{article.reference || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#eeeeee]">
                  <span>Catégorie</span>
                  <span className="font-medium text-[#1a1c1c]">{article.categorie || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#eeeeee]">
                  <span>Couleur</span>
                  <span className="font-medium text-[#1a1c1c]">{article.couleur || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>En stock</span>
                  <span className="font-medium text-[#1a1c1c]">{article.quantite} pièces</span>
                </div>
              </div>

              {/* Size Selector Tailored Look */}
              <div className="space-y-3 pt-2">
                <h3 className="text-[12px] font-bold tracking-widest uppercase text-[#1a1c1c]">SELECT SIZE</h3>
                <div className="flex flex-wrap gap-2">
                  {["S", "M", "L", "XL", "XXL"].map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 rounded-full border transition-all duration-300 font-semibold text-sm flex items-center justify-center
                        ${selectedSize === size 
                          ? "bg-[#000000] text-white border-[#000000]" 
                          : "border-[#747878] text-[#1a1c1c] hover:border-[#000000]"}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vendeur Assignment Dropdown */}
              <div className="space-y-2 pt-2">
                <Label className="text-[12px] font-bold tracking-widest text-[#1a1c1c] uppercase">Assigner au Vendeur *</Label>
                <Select value={vendeurId} onValueChange={setVendeurId} disabled={sell.isPending}>
                  <SelectTrigger className="rounded-full border-[#747878] bg-white h-12">
                    <SelectValue placeholder="Choisir le vendeur" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendeurs.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.display_name || v.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bottom Action Bar (Fixed Look) */}
            <div className="absolute bottom-0 left-0 w-full bg-[#000000] p-6 flex items-center justify-between gap-4 shadow-2xl">
              {/* Quantity Counter */}
              <div className="flex items-center gap-4 text-white border border-white/20 px-4 py-2.5 rounded-full">
                <button 
                  className="opacity-80 hover:opacity-100 transition-opacity active:scale-90"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={sell.isPending}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-semibold min-w-[16px] text-center text-sm">{qty}</span>
                <button 
                  className="opacity-80 hover:opacity-100 transition-opacity active:scale-90"
                  onClick={() => setQty(Math.min(article.quantite, qty + 1))}
                  disabled={sell.isPending}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Add to Cart / Validate Sale Button */}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Confirmer la vente de ${qty} x "${article.designation}" pour ${formatCurrency(totalPrice)} ?`)) {
                    sell.mutate();
                  }
                }}
                disabled={sell.isPending || article.quantite === 0}
                className="flex-1 bg-white text-[#000000] font-bold text-sm py-3.5 px-6 rounded-full hover:bg-[#f9f9f9] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingBag className="w-4 h-4" />
                {sell.isPending 
                  ? "ENREGISTREMENT..." 
                  : article.quantite === 0 
                    ? "ÉPUISÉ" 
                    : `CONFIRMER — ${formatCurrency(totalPrice)}`}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}