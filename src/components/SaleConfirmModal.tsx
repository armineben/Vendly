interface SaleConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalPrice: number;
  designation: string;
  quantity: number;
  unitPrice: number;
  isSubmitting?: boolean;
}

export function SaleConfirmModal({
  open,
  onClose,
  onConfirm,
  totalPrice,
  designation,
  quantity,
  unitPrice,
  isSubmitting = false,
}: SaleConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="pointer-events-auto relative z-[10000] w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl bg-white p-6 shadow-xl duration-150">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            ⚠️
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-900">Confirmer la vente ?</h3>
          <p className="mb-4 text-sm text-gray-500">
            Vérifiez bien les articles avant de valider. Cette action va déduire les articles du
            stock.
          </p>
        </div>

        <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">{designation}</p>
          <p className="mt-1 text-gray-500">
            {quantity} × {unitPrice.toFixed(2)} DT
          </p>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-purple-900">
            <span>Total à encaisser :</span>
            <span>{totalPrice.toFixed(2)} DT</span>
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            disabled={isSubmitting}
            className="pointer-events-auto flex-1 cursor-pointer rounded-lg bg-gray-100 py-2.5 font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirm();
            }}
            disabled={isSubmitting}
            className="pointer-events-auto flex-1 cursor-pointer rounded-lg bg-green-600 py-2.5 font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? "Enregistrement…" : "Oui, valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
