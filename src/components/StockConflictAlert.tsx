import { AlertTriangle, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

interface ActiveReservation {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  quantite_reservee: number;
  expires_at: string;
}

interface StockConflictAlertProps {
  open: boolean;
  onClose: () => void;
  onForceSale: () => void;
  reservations: ActiveReservation[];
}

export function StockConflictAlert({
  open,
  onClose,
  onForceSale,
  reservations,
}: StockConflictAlertProps) {
  if (!open || reservations.length === 0) return null;

  const r = reservations[0];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative z-[10000] w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl bg-white p-6 shadow-xl duration-150">
        <div className="text-center mb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">⚠️ Conflit de stock</h3>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Le dernier article en stock est actuellement réservé par{" "}
            <strong>{r.prenom} {r.nom}</strong>{" "}
            jusqu'au <strong>{formatDateTime(r.expires_at)}</strong>.
          </p>
        </div>

        <div className="bg-amber-50 rounded-lg p-3 mb-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <User className="h-4 w-4 shrink-0" />
            <span>Client : {r.prenom} {r.nom}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Clock className="h-4 w-4 shrink-0" />
            <span>Expire le : {formatDateTime(r.expires_at)}</span>
          </div>
          {r.telephone && (
            <div className="text-xs text-amber-700">
              Tél : {r.telephone}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Vous pouvez forcer la vente (la réservation sera annulée) ou attendre
          que la réservation expire automatiquement.
        </p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-lg"
          >
            Annuler
          </Button>
          <Button
            onClick={onForceSale}
            className="flex-1 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Forcer la vente
          </Button>
        </div>
      </div>
    </div>
  );
}
