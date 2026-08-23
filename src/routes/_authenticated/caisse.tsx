import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CreditCard,
  Ticket,
  X,
  Check,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/caisse")({
  component: CaissePage,
});

interface PosItem {
  article_id: string;
  variante_id: string;
  designation: string;
  reference: string;
  taille?: string;
  couleur?: string;
  prix_vente: number;
  prix_achat: number;
  stock_dispo: number;
  image?: string;
  qty: number;
}

function CaissePage() {
  const qc = useQueryClient();
  const [cart, setCart] = useState<PosItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [discountPct, setDiscountPct] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [submitting, setSubmitting] = useState(false);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["pos-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(
          "id, designation, reference, categorie, prix_vente, prix_achat, image, images, promotion_active, prix_promotionnel, quantite, status, archived",
        )
        .order("designation");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: variantes = [] } = useQuery({
    queryKey: ["pos-variantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variantes")
        .select("id, article_id, taille, couleur, stock, image_url");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a: any) => {
      if (a.categorie) set.add(a.categorie);
    });
    return Array.from(set).sort();
  }, [articles]);

  const visibleArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a: any) => {
      if (a.archived === true || a.status === "supprime" || a.status === "archive") return false;
      if (category !== "all" && a.categorie !== category) return false;
      if (q) {
        const hay = `${a.designation} ${a.reference} ${a.categorie}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [articles, search, category]);

  const stockOf = (article: any, varianteId?: string) => {
    if (varianteId) {
      const v = variantes.find((x: any) => x.id === varianteId);
      return Number(v?.stock ?? 0);
    }
    const vs = variantes.filter((x: any) => x.article_id === article.id);
    if (vs.length === 0) return Number(article.quantite || 0);
    return vs.reduce((s: number, x: any) => s + Number(x.stock || 0), 0);
  };

  const priceOf = (article: any) => {
    if (article.promotion_active && article.prix_promotionnel) {
      return Number(article.prix_promotionnel);
    }
    return Number(article.prix_vente || 0);
  };

  const addToCart = (article: any) => {
    const vs = variantes.filter((x: any) => x.article_id === article.id && Number(x.stock) > 0);
    let varianteId = "";
    let taille = "";
    let couleur = "";
    let stock = 0;
    let image = article.image;
    if (vs.length > 0) {
      varianteId = vs[0].id;
      taille = vs[0].taille || "";
      couleur = vs[0].couleur || "";
      stock = Number(vs[0].stock || 0);
      image = vs[0].image_url || article.image;
    } else {
      varianteId = `virtuel-${article.id}`;
      stock = Number(article.quantite || 0);
    }
    if (stock <= 0) {
      toast.error("Rupture de stock");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.variante_id === varianteId);
      if (existing) {
        if (existing.qty >= stock) {
          toast.error("Stock maximal atteint");
          return prev;
        }
        return prev.map((i) =>
          i.variante_id === varianteId ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          article_id: article.id,
          variante_id: varianteId,
          designation: article.designation,
          reference: article.reference,
          taille,
          couleur,
          prix_vente: priceOf(article),
          prix_achat: Number(article.prix_achat || 0),
          stock_dispo: stock,
          image,
          qty: 1,
        },
      ];
    });
  };

  const updateQty = (varianteId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.variante_id === varianteId
            ? { ...i, qty: Math.min(Math.max(i.qty + delta, 1), i.stock_dispo) }
            : i,
        )
        .filter((i) => i.qty > 0),
    );
  };

  const removeItem = (varianteId: string) => {
    setCart((prev) => prev.filter((i) => i.variante_id !== varianteId));
  };

  const subtotal = cart.reduce((s, i) => s + i.prix_vente * i.qty, 0);
  const discountAmt = (subtotal * (Number(discountPct) || 0)) / 100;
  const total = Math.max(0, subtotal - discountAmt - promoDiscount);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const { data } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) {
      toast.error("Code promo invalide");
      setPromoDiscount(0);
      return;
    }
    const value = Number(data.discount_value || 0);
    const disc =
      data.discount_type === "fixed"
        ? Math.min(value, subtotal)
        : (subtotal * Math.min(value, 100)) / 100;
    setPromoDiscount(disc);
    toast.success(`Code ${code} appliqué : -${formatCurrency(disc)}`);
  };

  const validate = async () => {
    if (cart.length === 0) {
      toast.error("Le panier est vide");
      return;
    }
    setSubmitting(true);
    try {
      const cartItems = cart.map((i) => ({
        article_id: i.article_id,
        variante_id: i.variante_id.startsWith("virtuel-") ? null : i.variante_id,
        quantite: i.qty,
        designation: i.designation,
        prix_unitaire: i.prix_vente,
        taille: i.taille,
        couleur: i.couleur,
      }));
      const { error } = await supabase.from("sales").insert([
        {
          items: cartItems,
          total,
          customer_name: "Caisse",
          customer_phone: "",
          payment_method: paymentMethod,
        },
      ]);
      if (error) throw error;

      // Déduire le stock
      for (const item of cart) {
        if (!item.variante_id.startsWith("virtuel-")) {
          const v = variantes.find((x: any) => x.id === item.variante_id);
          const nouveauStock = Math.max(0, (Number(v?.stock) || 0) - item.qty);
          await supabase
            .from("variantes")
            .update({ stock: nouveauStock })
            .eq("id", item.variante_id);
        }
      }

      toast.success(`Vente encaissée : ${formatCurrency(total)}`);
      setCart([]);
      setDiscountPct("");
      setPromoInput("");
      setPromoDiscount(0);
      qc.invalidateQueries({ queryKey: ["pos-articles"] });
      qc.invalidateQueries({ queryKey: ["pos-variantes"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la vente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-10 bg-[#fbfbfa] min-h-screen">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-[#747878] font-bold">Back-office</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-black">
          Caisse (POS)
        </h1>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ─── PRODUITS ─── */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un article..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-black"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-sm text-slate-400">Chargement...</div>
          ) : visibleArticles.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">Aucun article</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleArticles.map((a: any) => {
                const stock = stockOf(a);
                const price = priceOf(a);
                return (
                  <button
                    key={a.id}
                    onClick={() => addToCart(a)}
                    disabled={stock <= 0}
                    className={`text-left border rounded-xl overflow-hidden transition-shadow ${
                      stock <= 0
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:shadow-md border-slate-200"
                    }`}
                  >
                    <div className="aspect-[3/4] bg-slate-50">
                      {a.image ? (
                        <img src={a.image} alt={a.designation} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 uppercase">Sans image</div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] truncate">{a.designation}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold">{formatCurrency(price)}</span>
                        <span className={`text-[10px] ${stock > 0 ? "text-slate-400" : "text-red-500"}`}>
                          {stock > 0 ? `${stock} en stock` : "Épuisé"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── PANIER ─── */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#091426] mb-4">
            <ShoppingCart className="w-4 h-4" /> Panier ({cart.reduce((s, i) => s + i.qty, 0)})
          </h2>

          <div className="flex-1 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-14 text-center">
                <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Cliquez sur un produit pour l'ajouter</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.variante_id} className="flex gap-3 border border-slate-100 rounded-xl p-2.5">
                  {item.image ? (
                    <img src={item.image} alt="" className="w-12 h-16 object-cover rounded-lg bg-slate-50" />
                  ) : (
                    <div className="w-12 h-16 rounded-lg bg-slate-50" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{item.designation}</p>
                    <p className="text-[10px] text-slate-400">
                      {item.taille} {item.taille && item.couleur ? "·" : ""} {item.couleur}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-slate-200 rounded-lg">
                        <button onClick={() => updateQty(item.variante_id, -1)} className="px-2 py-1 hover:bg-slate-50"><Minus className="w-3 h-3" /></button>
                        <span className="px-2 text-xs font-bold">{item.qty}</span>
                        <button onClick={() => updateQty(item.variante_id, 1)} className="px-2 py-1 hover:bg-slate-50"><Plus className="w-3 h-3" /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{formatCurrency(item.prix_vente * item.qty)}</span>
                        <button onClick={() => removeItem(item.variante_id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* REMISE & PROMO */}
          <div className="space-y-2 mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                placeholder="Remise %"
                className="h-9 w-24 text-xs rounded-lg"
              />
              <div className="flex-1 flex gap-2">
                <Input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Code promo"
                  className="h-9 text-xs rounded-lg flex-1"
                />
                <Button variant="outline" size="sm" onClick={applyPromo} className="h-9 text-xs">
                  <Ticket className="w-3 h-3 mr-1" /> OK
                </Button>
              </div>
            </div>
            {promoDiscount > 0 && (
              <p className="text-xs text-emerald-600 font-semibold">
                Code appliqué : -{formatCurrency(promoDiscount)}
              </p>
            )}
          </div>

          {/* TOTAUX */}
          <div className="space-y-1.5 mt-4 text-sm border-t border-slate-100 pt-4">
            <div className="flex justify-between text-slate-500">
              <span>Sous-total</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {(discountAmt > 0 || promoDiscount > 0) && (
              <div className="flex justify-between text-red-500">
                <span>Remise</span><span>-{formatCurrency(discountAmt + promoDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* MODE DE PAIEMENT */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Mode de règlement</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "especes", label: "Espèces", icon: Banknote },
                { id: "carte", label: "Carte bancaire", icon: CreditCard },
                { id: "e-dinar", label: "e-Dinar", icon: Smartphone },
              ].map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-[11px] font-semibold transition-colors ${
                      active ? "border-black bg-black text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={validate}
            disabled={submitting || cart.length === 0}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-sm font-bold uppercase tracking-[0.15em]"
          >
            <Check className="w-4 h-4 mr-2" />
            {submitting ? "Encaissement..." : `Encaisser ${formatCurrency(total)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
