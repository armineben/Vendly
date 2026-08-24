import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { sendInvoice } from "@/lib/send-invoice.functions";
import { sendReservationConfirmation } from "@/lib/reservation-emails.functions";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Banknote,
  CreditCard,
  Ticket,
  Smartphone,
  LayoutGrid,
  List,
  Printer,
  Mail,
  CalendarPlus,
  Check,
  X,
  PauseCircle,
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
  discountPct: number;
}

type SortKey = "alpha_asc" | "alpha_desc" | "price_asc" | "price_desc" | "new" | "sale";

function CaissePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [cart, setCart] = useState<PosItem[]>([]);
  const [ticketNumber, setTicketNumber] = useState(() =>
    `TICKET-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
  );
  const [pendingCarts, setPendingCarts] = useState<any[]>([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortKey>("alpha_asc");
  const [discountPct, setDiscountPct] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [acompte, setAcompte] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [submitting, setSubmitting] = useState(false);
  const [saleResult, setSaleResult] = useState<any>(null);
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  // Modale réservation
  const [resOpen, setResOpen] = useState(false);
  const [resNom, setResNom] = useState("");
  const [resPrenom, setResPrenom] = useState("");
  const [resTel, setResTel] = useState("+216");
  const [resEmail, setResEmail] = useState("");
  const [resAcompte, setResAcompte] = useState("");
  const [resDelay, setResDelay] = useState<"jour" | "24h" | "48h" | "72h">("24h");
  const [resSubmitting, setResSubmitting] = useState(false);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["pos-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(
          "id, designation, reference, categorie, prix_vente, prix_achat, image, images, promotion_active, prix_promotionnel, quantite, status, archived, is_new, created_at",
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

  // Réception des articles sélectionnés depuis le Catalogue
  useEffect(() => {
    if (isLoading || articles.length === 0) return;
    try {
      const raw = localStorage.getItem("pos-transfer-items");
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (ids.length === 0) return;
      ids.forEach((id) => {
        const art = articles.find((a: any) => a.id === id);
        if (art) addToCart(art);
      });
      localStorage.removeItem("pos-transfer-items");
      toast.success(`${ids.length} article(s) transféré(s) depuis le catalogue.`);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, articles.length]);

  // Charger les paniers en attente
  const loadPendingCarts = async () => {
    let query = supabase
      .from("pending_carts")
      .select("*")
      .order("created_at", { ascending: false });
    // Un vendeur ne voit que ses paniers (+ globaux) ; l'admin voit tout
    if (!isAdmin) {
      query = query.or(`created_by.is.null,created_by.eq.${user?.id ?? "00000000-0000-0000-0000-000000000000"}`);
    }
    const { data } = await query;
    setPendingCarts(data ?? []);
  };
  useEffect(() => {
    loadPendingCarts();
  }, []);

  const holdCart = async () => {
    if (cart.length === 0) {
      toast.error("Le panier est vide.");
      return;
    }
    try {
      const { error } = await supabase.from("pending_carts").insert([
        {
          ticket_number: ticketNumber,
          items: cart,
          total,
          created_by: user?.id || null,
        },
      ]);
      if (error) throw error;
      toast.success(`Panier ${ticketNumber} mis en attente.`);
      setCart([]);
      setDiscountPct("");
      setPromoInput("");
      setPromoDiscount(0);
      setAcompte("");
      setTicketNumber(
        `TICKET-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
      );
      await loadPendingCarts();
    } catch (e: any) {
      console.error("Erreur mise en attente:", e);
      toast.error(e.message || "Erreur lors de la mise en attente.");
    }
  };

  const loadPendingCart = async (pc: any) => {
    if (cart.length > 0) {
      if (!window.confirm("Charger ce panier ? Le panier actuel sera remplacé.")) return;
    }
    setCart(Array.isArray(pc.items) ? pc.items : []);
    setTicketNumber(pc.ticket_number || "");
    toast.success(`Panier ${pc.ticket_number} chargé.`);
  };

  const deletePendingCart = async (id: string) => {
    if (!window.confirm("Supprimer ce panier en attente ?")) return;
    const { error } = await supabase.from("pending_carts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Panier en attente supprimé.");
      loadPendingCarts();
    }
  };

  const cancelSale = () => {
    if (cart.length === 0) return;
    if (!window.confirm("Annuler la vente ? Le panier sera vidé.")) return;
    setCart([]);
    setDiscountPct("");
    setPromoInput("");
    setPromoDiscount(0);
    setAcompte("");
    setTicketNumber(
      `TICKET-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
    );
    toast.success("Vente annulée, panier vidé.");
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a: any) => {
      if (a.categorie) set.add(a.categorie);
    });
    return Array.from(set).sort();
  }, [articles]);

  const visibleArticles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = articles.filter((a: any) => {
      if (a.archived === true || a.status === "supprime" || a.status === "archive") return false;
      if (category !== "all" && a.categorie !== category) return false;
      if (q) {
        const hay = `${a.designation} ${a.reference} ${a.categorie}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    switch (sortBy) {
      case "alpha_asc":
        return [...list].sort((a, b) => (a.designation || "").localeCompare(b.designation || ""));
      case "alpha_desc":
        return [...list].sort((a, b) => (b.designation || "").localeCompare(a.designation || ""));
      case "price_asc":
        return [...list].sort((a, b) => priceOf(a) - priceOf(b));
      case "price_desc":
        return [...list].sort((a, b) => priceOf(b) - priceOf(a));
      case "new":
        return [...list].sort((a, b) =>
          Number(b.is_new || false) - Number(a.is_new || false),
        );
      case "sale":
        return [...list].sort(
          (a, b) =>
            Number(b.promotion_active || false) - Number(a.promotion_active || false),
        );
      default:
        return list;
    }
  }, [articles, search, category, sortBy]);

  const stockOf = (article: any, varianteId?: string) => {
    if (varianteId) {
      const v = variantes.find((x: any) => x.id === varianteId);
      return Number(v?.stock ?? 0);
    }
    const vs = variantes.filter((x: any) => x.article_id === article.id);
    if (vs.length === 0) return Number(article.quantite || 0);
    return vs.reduce((s: number, x: any) => s + Number(x.stock || 0), 0);
  };

  function priceOf(article: any) {
    if (article.promotion_active && article.prix_promotionnel) {
      return Number(article.prix_promotionnel);
    }
    return Number(article.prix_vente || 0);
  }

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
      toast.warning("Stock à zéro — ajout en mode caisse (surstock).");
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.variante_id === varianteId);
      if (existing) {
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
          discountPct: 0,
        },
      ];
    });
  };

  const updateQty = (varianteId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.variante_id === varianteId
            ? { ...i, qty: Math.max(i.qty + delta, 1) }
            : i,
        )
        .filter((i) => i.qty > 0),
    );
  };

  const removeItem = (varianteId: string) => {
    setCart((prev) => prev.filter((i) => i.variante_id !== varianteId));
  };

  const setItemDiscount = (varianteId: string, pct: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.variante_id === varianteId
          ? { ...i, discountPct: Math.min(Math.max(pct, 0), 100) }
          : i,
      ),
    );
  };

  // Prix effectif d'un article du panier (remise article)
  const effPrice = (item: PosItem) => item.prix_vente * (1 - (item.discountPct || 0) / 100);

  const subtotal = cart.reduce((s, i) => s + effPrice(i) * i.qty, 0);
  const discountAmt = (subtotal * (Number(discountPct) || 0)) / 100;
  const total = Math.max(0, subtotal - discountAmt - promoDiscount);
  const acompteNum = Number(acompte) || 0;
  const reste = Math.max(0, total - acompteNum);

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

  const buildItemsPayload = () =>
    cart.map((i) => ({
      article_id: i.article_id,
      variante_id: i.variante_id.startsWith("virtuel-") ? null : i.variante_id,
      quantite: i.qty,
      designation: i.designation,
      prix_unitaire: effPrice(i),
      taille: i.taille,
      couleur: i.couleur,
      image: i.image,
    }));

  const deductStock = async () => {
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
  };

  const validate = async () => {
    if (cart.length === 0) {
      toast.error("Le panier est vide");
      return;
    }
    setSubmitting(true);
    try {
      const baseSale = {
        items: buildItemsPayload(),
        total,
        customer_name: "Caisse",
        customer_phone: "",
        payment_method: paymentMethod,
      };
      // Insertion résiliente : si la colonne acompte est absente (42703), retry sans.
      let { error } = await supabase
        .from("sales")
        .insert([{ ...baseSale, acompte: acompteNum > 0 ? acompteNum : null }]);
      if (error && error.code === "42703") {
        ({ error } = await supabase.from("sales").insert([baseSale]));
      }
      if (error) {
        console.error("Erreur encaissement:", error);
        throw new Error(`Encaissement impossible (${error.code}): ${error.message}`);
      }
      await deductStock();

      const invNumber = `FACT-${Date.now().toString(36).toUpperCase()}`;
      setSaleResult({
        invoiceNumber: invNumber,
        date: new Date().toLocaleString("fr-FR"),
        items: cart.map((i) => ({
          designation: i.designation,
          qty: i.qty,
          prix: effPrice(i),
        })),
        subtotal,
        discount: discountAmt + promoDiscount,
        total,
        paymentMethod,
        acompte: acompteNum,
      });

      toast.success(`Vente encaissée : ${formatCurrency(total)}`);
      setCart([]);
      setDiscountPct("");
      setPromoInput("");
      setPromoDiscount(0);
      setAcompte("");
      qc.invalidateQueries({ queryKey: ["pos-articles"] });
      qc.invalidateQueries({ queryKey: ["pos-variantes"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la vente");
    } finally {
      setSubmitting(false);
    }
  };

  // Réservation : ouvre la modale client
  const reserve = () => {
    if (cart.length === 0) {
      toast.error("Le panier est vide");
      return;
    }
    setResOpen(true);
  };

  const submitReservation = async () => {
    if (!resNom.trim() || !resPrenom.trim()) {
      toast.error("Veuillez saisir le nom et le prénom du client.");
      return;
    }
    if (!resEmail || !resEmail.includes("@")) {
      toast.error("Veuillez saisir une adresse email valide.");
      return;
    }
    setResSubmitting(true);
    try {
      const heures =
        resDelay === "jour" ? 4 : resDelay === "24h" ? 24 : resDelay === "48h" ? 48 : 72;
      const expiresAt = new Date(Date.now() + heures * 3600 * 1000);
      const acompte = Number(resAcompte) || 0;

      const basePayload = {
        nom: resNom.trim(),
        prenom: resPrenom.trim(),
        telephone: resTel,
        email: resEmail.trim(),
        acompte,
        items: buildItemsPayload(),
        date_expiration: expiresAt.toISOString(),
        duree_heures: heures,
        delay_type: resDelay,
        statut: "en_attente",
        created_by: user?.id || null,
      };

      // Numéro de réservation séquentiel (RES-0001, ...)
      const { data: resNumber } = await supabase.rpc("get_next_number", {
        p_prefix: "RES",
      });
      if (resNumber) basePayload.document_number = resNumber;

      // Insertion résiliente : si contrainte NOT NULL (23502) ou colonne manquante
      // (42703) sur le schéma actuel, on complète avec les colonnes héritées.
      let { error } = await supabase.from("reservations").insert([basePayload]);
      if (error && (error.code === "23502" || error.code === "42703")) {
        const legacy = await supabase.from("reservations").insert([
          {
            ...basePayload,
            client_name: `${resPrenom.trim()} ${resNom.trim()}`.trim(),
            client_phone: resTel,
            status: "actif",
            expiration_date: expiresAt.toISOString(),
          },
        ]);
        error = legacy.error;
      }
      if (error) {
        console.error("Erreur insertion réservation:", error);
        throw new Error(
          `Insertion réservation impossible (${error.code}): ${error.message}`,
        );
      }

      // Email de confirmation — indépendant, jamais bloquant
      sendReservationConfirmation({
        data: {
          email: resEmail.trim(),
          nom: resNom.trim(),
          prenom: resPrenom.trim(),
          telephone: resTel,
          acompte,
          dateExpiration: expiresAt.toISOString(),
          items: cart.map((i) => ({
            designation: i.designation,
            quantite: i.qty,
            prix_unitaire: effPrice(i),
          })),
        },
      })
        .then(() => {
          toast.success("Email de confirmation envoyé.");
        })
        .catch((err) => {
          console.error("Erreur envoi email réservation:", err);
          toast.warning(
            "Réservation enregistrée, mais l'email n'a pas pu être envoyé.",
          );
        });

      toast.success("Réservation créée ! Confirmation envoyée par email.");
      setCart([]);
      setResOpen(false);
      setResNom("");
      setResPrenom("");
      setResTel("+216");
      setResEmail("");
      setResAcompte("");
      setResDelay("24h");
      qc.invalidateQueries({ queryKey: ["pos-articles"] });
      qc.invalidateQueries({ queryKey: ["pos-variantes"] });
      navigate({ to: "/reservations" });
    } catch (e: any) {
      console.error("Erreur validation réservation (POS):", e);
      toast.error(
        (e?.message || "Erreur lors de la réservation").slice(0, 300),
      );
    } finally {
      setResSubmitting(false);
    }
  };

  const sendInvoiceEmail = async () => {
    if (!invoiceEmail || !invoiceEmail.includes("@")) {
      toast.error("Veuillez saisir une adresse email valide.");
      return;
    }
    setEmailSending(true);
    try {
      await sendInvoice({
        data: {
          email: invoiceEmail,
          invoiceNumber: saleResult.invoiceNumber,
          date: saleResult.date,
          items: saleResult.items,
          subtotal: saleResult.subtotal,
          discount: saleResult.discount,
          total: saleResult.total,
          paymentMethod: saleResult.paymentMethod,
        },
      });
      toast.success("Facture envoyée par e-mail !");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi de la facture.");
    } finally {
      setEmailSending(false);
    }
  };

  const sortOptions: { id: SortKey; label: string }[] = [
    { id: "alpha_asc", label: "A → Z" },
    { id: "alpha_desc", label: "Z → A" },
    { id: "price_asc", label: "Prix croissant" },
    { id: "price_desc", label: "Prix décroissant" },
    { id: "new", label: "Nouveaux" },
    { id: "sale", label: "Soldés" },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-10 bg-[#fbfbfa] min-h-screen print:hidden">
      <header className="print:hidden flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#747878] font-bold">Back-office</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-black">Caisse (POS)</h1>
        </div>
        <button
          onClick={() => {
            loadPendingCarts();
            setPendingOpen(true);
          }}
          className="relative flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-black transition-colors shadow-xs"
        >
          <ShoppingCart className="w-4 h-4" /> Paniers
          {pendingCarts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-black text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {pendingCarts.length}
            </span>
          )}
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ─── PRODUITS ─── */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs print:hidden">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom ou référence (SKU)..."
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
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white"
              >
                {sortOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded ${viewMode === "grid" ? "bg-black text-white" : "text-slate-400"}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded ${viewMode === "list" ? "bg-black text-white" : "text-slate-400"}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-xs text-slate-400 ml-auto">
                {visibleArticles.length} article{visibleArticles.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-sm text-slate-400">Chargement...</div>
          ) : visibleArticles.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">Aucun article</div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleArticles.map((a: any) => {
                const stock = stockOf(a);
                const price = priceOf(a);
                return (
                  <button
                    key={a.id}
                    onClick={() => addToCart(a)}
                    disabled={stock <= 0}
                    className={`text-left border rounded-xl overflow-hidden transition-shadow ${stock <= 0 ? "opacity-40 cursor-not-allowed" : "hover:shadow-md border-slate-200"}`}
                  >
                    <div className="aspect-[3/4] bg-slate-50 relative">
                      {a.image ? (
                        <img src={a.image} alt={a.designation} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 uppercase">Sans image</div>
                      )}
                      {a.is_new && (
                        <span className="absolute top-1.5 left-1.5 bg-black text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">New</span>
                      )}
                      {a.promotion_active && (
                        <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">-{Math.round((1 - price / Number(a.prix_vente || 1)) * 100)}%</span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] truncate">{a.designation}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold">{formatCurrency(price)}</span>
                        <span className={`text-[10px] ${stock > 0 ? "text-slate-400" : "text-red-500"}`}>{stock > 0 ? `${stock} en stock` : "Épuisé"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {visibleArticles.map((a: any) => {
                const stock = stockOf(a);
                const price = priceOf(a);
                return (
                  <button
                    key={a.id}
                    onClick={() => addToCart(a)}
                    disabled={stock <= 0}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 ${stock <= 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {a.image ? (
                      <img src={a.image} alt="" className="w-10 h-14 object-cover rounded bg-slate-50" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-slate-50" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{a.designation}</p>
                      <p className="text-[10px] text-slate-400 truncate">{a.reference}</p>
                    </div>
                    {a.is_new && <span className="text-[9px] bg-black text-white px-1.5 py-0.5 rounded uppercase shrink-0">New</span>}
                    <span className="text-sm font-bold shrink-0">{formatCurrency(price)}</span>
                    <span className={`text-[10px] w-16 text-right shrink-0 ${stock > 0 ? "text-slate-400" : "text-red-500"}`}>{stock > 0 ? `${stock}` : "Épuisé"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── PANIER ─── */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col print:hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#091426]">
              <ShoppingCart className="w-4 h-4" /> Panier ({cart.reduce((s, i) => s + i.qty, 0)})
            </h2>
            <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-700 px-3 py-1 text-[10px] font-bold tracking-wider">
              {ticketNumber}
            </span>
          </div>

          <div className="flex-1 space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-14 text-center">
                <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Cliquez sur un produit pour l'ajouter</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.variante_id} className="border border-slate-100 rounded-xl p-2.5">
                  <div className="flex gap-3">
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
                      {item.qty > item.stock_dispo && (
                        <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                          ⚠ Surstock : {item.stock_dispo} dispo en stock
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-slate-200 rounded-lg">
                          <button onClick={() => updateQty(item.variante_id, -1)} className="px-2 py-1 hover:bg-slate-50"><Minus className="w-3 h-3" /></button>
                          <span className="px-2 text-xs font-bold">{item.qty}</span>
                          <button onClick={() => updateQty(item.variante_id, 1)} className="px-2 py-1 hover:bg-slate-50"><Plus className="w-3 h-3" /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{formatCurrency(effPrice(item) * item.qty)}</span>
                          <button onClick={() => removeItem(item.variante_id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      {/* Remise article */}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPct || ""}
                          onChange={(e) => setItemDiscount(item.variante_id, Number(e.target.value))}
                          placeholder="Remise article %"
                          className="w-32 px-2 py-1 text-[10px] border border-slate-200 rounded focus:outline-none"
                        />
                        {item.discountPct > 0 && (
                          <span className="text-[10px] text-red-500">-{item.discountPct}%</span>
                        )}
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
                placeholder="Remise panier %"
                className="h-9 w-32 text-xs rounded-lg"
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
              <p className="text-xs text-emerald-600 font-semibold">Code appliqué : -{formatCurrency(promoDiscount)}</p>
            )}
          </div>

          {/* TOTAUX */}
          <div className="space-y-1.5 mt-4 text-sm border-t border-slate-100 pt-4">
            <div className="flex justify-between text-slate-500"><span>Sous-total</span><span>{formatCurrency(subtotal)}</span></div>
            {(discountAmt > 0 || promoDiscount > 0) && (
              <div className="flex justify-between text-red-500"><span>Remise</span><span>-{formatCurrency(discountAmt + promoDiscount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(total)}</span></div>
            <div className="flex items-center gap-2 pt-2">
              <Input
                type="number"
                min="0"
                value={acompte}
                onChange={(e) => setAcompte(e.target.value)}
                placeholder="Acompte reçu"
                className="h-8 w-36 text-xs rounded-lg"
              />
              {acompteNum > 0 && (
                <span className="text-xs text-slate-500">Reste : {formatCurrency(reste)}</span>
              )}
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
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-[11px] font-semibold transition-colors ${active ? "border-black bg-black text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
                  >
                    <Icon className="w-4 h-4" /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Button
              onClick={validate}
              disabled={submitting || cart.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-sm font-bold uppercase tracking-[0.15em]"
            >
              <Check className="w-4 h-4 mr-2" />
              {submitting ? "Encaissement..." : `Encaisser ${formatCurrency(total)}`}
            </Button>
            <Button
              onClick={reserve}
              disabled={submitting || cart.length === 0}
              variant="outline"
              className="w-full border-slate-300 text-slate-600 h-11 text-xs font-bold uppercase tracking-[0.15em]"
            >
              <CalendarPlus className="w-4 h-4 mr-2" /> Réserver
            </Button>
            {cart.length > 0 && (
              <Button
                onClick={holdCart}
                variant="outline"
                className="w-full border-amber-300 text-amber-700 h-11 text-xs font-bold uppercase tracking-[0.15em]"
              >
                <PauseCircle className="w-4 h-4 mr-2" /> Mettre en attente
              </Button>
            )}
            {cart.length > 0 && (
              <Button
                onClick={cancelSale}
                variant="ghost"
                className="w-full text-red-500 hover:bg-red-50 h-10 text-xs font-bold uppercase tracking-[0.15em]"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Annuler la vente
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── PANIERS EN ATTENTE ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#091426]">
            <PauseCircle className="w-4 h-4" /> Paniers en attente ({pendingCarts.length})
          </h3>
          <button
            onClick={() => loadPendingCarts()}
            className="text-xs text-slate-400 hover:text-black"
          >
            Actualiser
          </button>
        </div>

        {pendingCarts.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Aucun panier en attente.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingCarts.map((pc) => (
              <div
                key={pc.id}
                className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 hover:border-black transition-colors"
              >
                <button onClick={() => loadPendingCart(pc)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-800">{pc.ticket_number}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(pc.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {Array.isArray(pc.items) ? pc.items.length : 0} article(s) ·{" "}
                    {formatCurrency(Number(pc.total || 0))}
                  </p>
                </button>
                <button
                  onClick={() => deletePendingCart(pc.id)}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODALE PANIERS EN ATTENTE ─── */}
      {pendingOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4" onClick={() => setPendingOpen(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#091426]">
                Paniers en attente ({pendingCarts.length})
              </h2>
              <button onClick={() => setPendingOpen(false)} className="text-slate-400 hover:text-black"><X className="w-4 h-4" /></button>
            </div>
            {pendingCarts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Aucun panier en attente.</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {pendingCarts.map((pc) => (
                  <div key={pc.id} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 hover:border-black transition-colors">
                    <button onClick={() => { loadPendingCart(pc); setPendingOpen(false); }} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-slate-800">{pc.ticket_number}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(pc.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{Array.isArray(pc.items) ? pc.items.length : 0} article(s)
                        {" · "}{formatCurrency(Number(pc.total || 0))}
                      </p>
                    </button>
                    <button onClick={() => deletePendingCart(pc.id)} className="text-slate-300 hover:text-red-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODALE RÉSERVATION ─── */}
      {resOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#091426]">Réservation</h2>
              <button onClick={() => setResOpen(false)} className="text-slate-400 hover:text-black"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">Prénom *</Label>
                  <Input value={resPrenom} onChange={(e) => setResPrenom(e.target.value)} placeholder="Prénom" className="h-9 text-xs rounded-lg mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-slate-400">Nom *</Label>
                  <Input value={resNom} onChange={(e) => setResNom(e.target.value)} placeholder="Nom" className="h-9 text-xs rounded-lg mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-slate-400">Téléphone</Label>
                <Input value={resTel} onChange={(e) => setResTel(e.target.value)} className="h-9 text-xs rounded-lg mt-1" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-slate-400">Adresse e-mail *</Label>
                <Input type="email" value={resEmail} onChange={(e) => setResEmail(e.target.value)} placeholder="client@exemple.com" className="h-9 text-xs rounded-lg mt-1" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-slate-400">Acompte versé (DT)</Label>
                <Input type="number" min="0" value={resAcompte} onChange={(e) => setResAcompte(e.target.value)} placeholder="0" className="h-9 text-xs rounded-lg mt-1" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-slate-400">Durée de la réservation</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {(["jour", "24h", "48h", "72h"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setResDelay(d)}
                      className={`px-2 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${resDelay === d ? "border-black bg-black text-white" : "border-slate-200 text-slate-600"}`}
                    >
                      {d === "jour" ? "Jour même" : d}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Expiration :{" "}
                  {new Date(
                    Date.now() +
                      (resDelay === "jour" ? 4 : resDelay === "24h" ? 24 : resDelay === "48h" ? 48 : 72) *
                        3600 *
                        1000,
                  ).toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-10 text-xs" onClick={() => setResOpen(false)}>Annuler</Button>
                <Button onClick={submitReservation} disabled={resSubmitting} className="flex-1 h-10 text-xs font-bold">
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  {resSubmitting ? "..." : "Confirmer la réservation"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALE FACTURE ─── */}
      {saleResult && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 my-8">
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-[#091426]">Vente encaissée</h2>
              <p className="text-xs text-slate-500">Total : {formatCurrency(saleResult.total)}</p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Envoyer la facture par e-mail</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    placeholder="client@exemple.com"
                    className="h-9 text-xs rounded-lg flex-1"
                  />
                  <Button onClick={sendInvoiceEmail} disabled={emailSending} className="h-9 text-xs">
                    <Mail className="w-3.5 h-3.5 mr-1" />
                    {emailSending ? "..." : "Envoyer"}
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-slate-300 text-slate-600 h-11 text-xs font-bold uppercase tracking-[0.15em]"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4 mr-2" /> Imprimer le ticket
              </Button>
              <Button
                variant="ghost"
                className="w-full text-slate-400 text-xs"
                onClick={() => setSaleResult(null)}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TICKET IMPRESSION ─── */}
      {saleResult && (
        <div className="hidden print:block p-6 font-mono text-xs">
          <div className="text-center mb-3">
            <h1 className="text-sm font-bold uppercase tracking-widest">Vendly</h1>
            <p className="text-[10px]">Ticket de caisse</p>
            <p className="text-[10px]">{saleResult.date}</p>
            <p className="text-[10px]">N° {saleResult.invoiceNumber}</p>
          </div>
          <div className="border-t border-b border-black py-1 my-2">
            {saleResult.items.map((i: any, idx: number) => (
              <div key={idx} className="flex justify-between py-0.5">
                <span className="max-w-[180px] truncate">{i.designation} × {i.qty}</span>
                <span>{(i.prix * i.qty).toFixed(3)} DT</span>
              </div>
            ))}
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between"><span>Sous-total</span><span>{saleResult.subtotal.toFixed(3)} DT</span></div>
            {saleResult.discount > 0 && (
              <div className="flex justify-between"><span>Remise</span><span>-{saleResult.discount.toFixed(3)} DT</span></div>
            )}
            {saleResult.acompte > 0 && (
              <div className="flex justify-between"><span>Acompte</span><span>-{saleResult.acompte.toFixed(3)} DT</span></div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
              <span>TOTAL</span><span>{saleResult.total.toFixed(3)} DT</span>
            </div>
            <p className="text-[10px] mt-1">Paiement : {saleResult.paymentMethod}</p>
          </div>
          <p className="text-center text-[10px] mt-4">Merci de votre visite !</p>
        </div>
      )}
    </div>
  );
}
