import { ShoppingBag, Clock, Truck, User } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CartItemDisplay {
  designation: string;
  quantite_selectionnee: number;
  prix_vente: number;
  image?: string;
  taille_selectionnee?: string;
  couleur_selectionnee?: string;
}

interface CartConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: "purchase" | "delivery" | "reservation";
  items: CartItemDisplay[];
  subtotal: number;
  discount?: number;
  discountCode?: string;
  customerName?: string;
  customerPrenom?: string;
  isSubmitting?: boolean;
}

export function CartConfirmModal({
  open,
  onClose,
  onConfirm,
  mode,
  items,
  subtotal,
  discount = 0,
  discountCode,
  customerName,
  customerPrenom,
  isSubmitting = false,
}: CartConfirmModalProps) {
  if (!open) return null;

  const discountAmount = (subtotal * discount) / 100;
  const finalTotal = subtotal - discountAmount;
  const isPurchase = mode === "purchase";
  const isDelivery = mode === "delivery";

  const iconBg = isPurchase ? "bg-emerald-100 text-emerald-600" : isDelivery ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600";
  const IconComponent = isPurchase ? ShoppingBag : isDelivery ? Truck : Clock;
  const title = isPurchase ? "Confirmer l'achat" : isDelivery ? "Confirmer la livraison" : "Confirmer la réservation";
  const subtitle = isPurchase ? "Vérifiez le récapitulatif avant de finaliser." : isDelivery ? "La commande sera préparée après confirmation." : "Les articles seront bloqués pendant 24h.";
  const confirmLabel = isSubmitting ? "Traitement..." : isPurchase ? "Confirmer l'achat" : isDelivery ? "Créer la livraison" : "Confirmer la réservation";
  const confirmBg = isPurchase ? "bg-emerald-600 hover:bg-emerald-700" : isDelivery ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative z-[10000] w-full max-w-lg animate-in fade-in zoom-in-95 rounded-xl bg-white p-6 shadow-xl duration-150 max-h-[90vh] flex flex-col">
        <div className="text-center mb-4">
          <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
            <IconComponent className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-3 bg-gray-50 rounded-lg p-3">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.designation}
                  className="w-14 h-16 object-cover rounded bg-gray-100 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-medium text-gray-900 truncate">
                  {item.designation}
                </p>
                <p className="text-xs text-gray-500">
                  {item.taille_selectionnee &&
                    `Taille: ${item.taille_selectionnee}`}
                  {item.taille_selectionnee &&
                    item.couleur_selectionnee &&
                    " | "}
                  {item.couleur_selectionnee &&
                    `Couleur: ${item.couleur_selectionnee}`}
                </p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-gray-500">
                    x{item.quantite_selectionnee}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {formatCurrency(
                      item.prix_vente * item.quantite_selectionnee,
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isPurchase && customerName && (
          <div className="mt-3 flex items-center gap-2 bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            <User className="w-4 h-4 shrink-0" />
            <span>
              {isDelivery ? "Livraison pour" : "Réservation au nom de"}{" "}
              <strong>
                {customerPrenom} {customerName}
              </strong>
            </span>
          </div>
        )}

        <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Sous-total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-red-600 font-medium">
              <span>Réduction ({discountCode || `${discount}%`})</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>Total</span>
            <span>{formatCurrency(finalTotal)}</span>
          </div>
        </div>

        {mode === "reservation" && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg p-2 text-center">
            ⏰ Ces articles seront automatiquement remis en stock si la
            réservation n'est pas validée sous 24h.
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white shadow-sm transition disabled:opacity-50 cursor-pointer ${confirmBg}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
