import { useState } from "react";
import { X, Minus, Plus, Trash2, Check, Truck, CreditCard, Banknote, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/lib/currency";

const GOUVERNORATS = [
  "Ariana", "Béja", "Ben Arous", "Bizerte", "Gabès", "Gafsa",
  "Jendouba", "Kairouan", "Kasserine", "Kébili", "La Manouba",
  "Le Kef", "Mahdia", "Médenine", "Monastir", "Nabeul",
  "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tataouine",
  "Tozeur", "Tunis", "Zaghouan",
];

interface CartItem {
  id: string;
  variante_id: string;
  designation: string;
  reference: string;
  prix_vente: number;
  quantite_selectionnee: number;
  stock_dispo: number;
  categorie?: string;
  image?: string;
  couleur_selectionnee?: string;
  taille_selectionnee?: string;
}

interface CheckoutDrawerProps {
  cart: CartItem[];
  cartTotal: number;
  subTotal: number;
  discountAmount: number;
  appliedDiscount: number;
  activePromoCode: string;
  promoInput: string;
  customerData: { nom: string; prenom: string; telephone: string; email: string; governorate: string; city: string; address: string; paymentMethod?: string };
  checkoutMutation: { isPending: boolean };
  onClose: () => void;
  onUpdateQuantity: (varianteId: string, delta: number) => void;
  onRemoveFromCart: (varianteId: string) => void;
  onApplyPromo: () => void;
  onSetPromoInput: (value: string) => void;
  onCustomerDataChange: (data: any) => void;
  onConfirm: () => void;
}

export function CheckoutDrawer({
  cart,
  cartTotal,
  subTotal,
  discountAmount,
  appliedDiscount,
  activePromoCode,
  promoInput,
  customerData,
  checkoutMutation,
  onClose,
  onUpdateQuantity,
  onRemoveFromCart,
  onApplyPromo,
  onSetPromoInput,
  onCustomerDataChange,
  onConfirm,
}: CheckoutDrawerProps) {
  const [step, setStep] = useState<"panier" | "coord" | "confirmation">("coord");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card">("cod");
  const { formatPrice, shippingFeeTnd, selectedZone, selectedCurrency } =
    useCurrency();

  const totalWithShipping = cartTotal + shippingFeeTnd;

  const updateCustomer = (field: string, value: string) => {
    onCustomerDataChange({ ...customerData, [field]: value });
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[^0-9+]/g, "");
    if (!cleaned.startsWith("+216") && cleaned.length > 0) {
      updateCustomer("telephone", "+216" + cleaned.replace(/^\+?216/, ""));
    } else {
      updateCustomer("telephone", cleaned);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
      <div className="relative w-full max-w-[1200px] min-h-screen md:min-h-0 bg-white md:my-8 md:rounded-2xl shadow-2xl flex flex-col">
        {/* HEADER */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 md:px-8 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em]">Finaliser la commande</h2>
          <button onClick={onClose} className="p-2 -m-2 hover:opacity-60 transition-opacity">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BREADCRUMB */}
        <div className="px-4 md:px-8 pt-6 pb-4">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em]">
            <span className={step === "panier" ? "text-black" : "text-gray-300"}>Panier</span>
            <span className="text-gray-300">→</span>
            <span className={step === "coord" ? "text-black" : "text-gray-300"}>Coordonnées & paiement</span>
            <span className="text-gray-300">→</span>
            <span className={step === "confirmation" ? "text-black" : "text-gray-300"}>Confirmation</span>
          </div>
        </div>

        {/* 2-COLUMNS CONTENT */}
        <div className="flex-1 flex flex-col md:flex-row px-4 md:px-8 pb-6 gap-8">
          {/* LEFT COLUMN — FORMULAIRE */}
          <div className="flex-1 space-y-8">
            {/* SECTION 1 — COORDONNÉES */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black mb-5 pb-3 border-b border-gray-100">
                1. Vos coordonnées
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Prénom *</Label>
                    <Input
                      value={customerData.prenom}
                      onChange={(e) => updateCustomer("prenom", e.target.value)}
                      placeholder="Prénom"
                      className="h-10 text-xs rounded-none border-gray-200 focus-visible:ring-black"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Nom *</Label>
                    <Input
                      value={customerData.nom}
                      onChange={(e) => updateCustomer("nom", e.target.value)}
                      placeholder="Nom"
                      className="h-10 text-xs rounded-none border-gray-200 focus-visible:ring-black"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Téléphone *</Label>
                  <Input
                    value={customerData.telephone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+216 XX XXX XXX"
                    className="h-10 text-xs rounded-none border-gray-200 focus-visible:ring-black"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
                    Email <span className="text-gray-300 font-normal">(facultatif)</span>
                  </Label>
                  <Input
                    value={customerData.email}
                    onChange={(e) => updateCustomer("email", e.target.value)}
                    placeholder="email@exemple.com"
                    type="email"
                    className="h-10 text-xs rounded-none border-gray-200 focus-visible:ring-black"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Gouvernorat *</Label>
                    <select
                      value={customerData.governorate}
                      onChange={(e) => updateCustomer("governorate", e.target.value)}
                      className="w-full h-10 text-xs border border-gray-200 bg-white px-3 focus:outline-none focus:border-black"
                    >
                      <option value="">Sélectionner</option>
                      {GOUVERNORATS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Ville / Délégation</Label>
                    <Input
                      value={customerData.city}
                      onChange={(e) => updateCustomer("city", e.target.value)}
                      placeholder="Ville"
                      className="h-10 text-xs rounded-none border-gray-200 focus-visible:ring-black"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Adresse de livraison *</Label>
                  <Input
                    value={customerData.address}
                    onChange={(e) => updateCustomer("address", e.target.value)}
                    placeholder="Rue, numéro, code postal"
                    className="h-10 text-xs rounded-none border-gray-200 focus-visible:ring-black"
                  />
                </div>
              </div>
            </section>

            {/* SECTION 2 — LIVRAISON */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black mb-5 pb-3 border-b border-gray-100">
                2. Mode de livraison
              </h3>
              <div className="border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs font-medium text-black">Livraison standard à domicile</p>
                    <p className="text-[10px] text-gray-400">
                      {selectedZone?.country_name || "Tunisie"} · Sous 2 à 5 jours ouvrés
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold">
                  {formatPrice(shippingFeeTnd)}
                </span>
              </div>
            </section>

            {/* SECTION 3 — PAIEMENT */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black mb-5 pb-3 border-b border-gray-100">
                3. Mode de paiement
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 border border-gray-200 p-4 cursor-pointer hover:border-black transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "cod"}
                    onChange={() => {
                      setPaymentMethod("cod");
                      onCustomerDataChange({ ...customerData, paymentMethod: "cod" });
                    }}
                    className="accent-black"
                  />
                  <Banknote className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs font-medium text-black">Paiement à la livraison</p>
                    <p className="text-[10px] text-gray-400">Payez en espèces à la réception</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 border border-gray-200 p-4 cursor-pointer hover:border-black transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "card"}
                    onChange={() => {
                      setPaymentMethod("card");
                      onCustomerDataChange({ ...customerData, paymentMethod: "card" });
                    }}
                    className="accent-black"
                  />
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs font-medium text-black">Carte Bancaire / e-Dinar</p>
                    <p className="text-[10px] text-gray-400">Paiement sécurisé en ligne</p>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN — RÉCAPITULATIF */}
          <div className="md:w-[380px] shrink-0">
            <div className="md:sticky md:top-24 bg-gray-50 border border-gray-100 p-5 space-y-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black pb-3 border-b border-gray-200">
                Récapitulatif
              </h3>

              {/* ARTICLES */}
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.variante_id} className="flex gap-3">
                    <img
                      src={item.image}
                      alt={item.designation}
                      className="w-14 h-16 object-cover bg-gray-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-medium uppercase tracking-[0.05em] truncate">{item.designation}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {item.taille_selectionnee && `${item.taille_selectionnee}`}
                        {item.taille_selectionnee && item.couleur_selectionnee && " / "}
                        {item.couleur_selectionnee && `${item.couleur_selectionnee}`}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-gray-200">
                          <button
                            onClick={() => onUpdateQuantity(item.variante_id, -1)}
                            className="px-1.5 py-1 hover:bg-gray-100"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-[10px] px-2 min-w-[20px] text-center">{item.quantite_selectionnee}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.variante_id, 1)}
                            className="px-1.5 py-1 hover:bg-gray-100"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium">{formatPrice(item.prix_vente * item.quantite_selectionnee)}</span>
                          <button
                            onClick={() => onRemoveFromCart(item.variante_id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CODE PROMO */}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Code promo"
                  value={promoInput}
                  onChange={(e) => onSetPromoInput(e.target.value.toUpperCase())}
                  className="h-8 text-[10px] rounded-none border-gray-200 focus-visible:ring-black"
                />
                <Button
                  onClick={onApplyPromo}
                  variant="outline"
                  size="sm"
                  className="h-8 text-[10px] rounded-none border-gray-200 shrink-0"
                >
                  <Ticket className="w-3 h-3 mr-1" /> Appliquer
                </Button>
              </div>
              {appliedDiscount > 0 && (
                <div className="flex items-center justify-between text-[10px] text-red-600 bg-red-50 px-3 py-2">
                  <span>Code {activePromoCode} :</span>
                  <span className="font-bold">-{formatPrice(discountAmount)}</span>
                </div>
              )}

              {/* TOTAUX */}
              <div className="space-y-2 text-[11px] border-t border-gray-200 pt-4">
                <div className="flex justify-between text-gray-500">
                  <span>Sous-total</span>
                  <span>{formatPrice(subTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Livraison</span>
                  <span>{formatPrice(shippingFeeTnd)}</span>
                </div>
                {appliedDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Réduction ({activePromoCode})</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-gray-200">
                  <span>Total à payer</span>
                  <span>{formatPrice(totalWithShipping)}</span>
                </div>
                <p className="text-[9px] text-gray-400 text-right">TVA incluse</p>
              </div>

              {/* CTA */}
              <Button
                className="w-full bg-black text-white hover:bg-gray-800 rounded-none h-12 text-xs font-bold uppercase tracking-[0.15em]"
                onClick={onConfirm}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? (
                  "Traitement..."
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Confirmer ma commande</>
                )}
              </Button>

              {/* RÉASSURANCE */}
              <div className="text-center text-[9px] text-gray-400 uppercase tracking-[0.1em]">
                Transactions sécurisées · Données protégées
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}