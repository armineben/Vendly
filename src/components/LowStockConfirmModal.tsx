import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LowStockAlertResult } from "@/utils/stockAlerts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertReport: LowStockAlertResult | null;
}

export function LowStockConfirmModal({ open, onOpenChange, alertReport }: Props) {
  if (!alertReport) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>⚠️ Alerte stock critique</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{alertReport.items.length}</strong>{" "}
                article(s) ont moins de 5 unités en stock.
              </p>
              <p>
                Souhaitez-vous ouvrir WhatsApp pour envoyer le rapport d&apos;alerte au
                gestionnaire ?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Plus tard</AlertDialogCancel>
          <AlertDialogAction
            className="bg-accent text-accent-foreground hover:bg-accent-hover"
            onClick={() => {
              window.open(alertReport.whatsappUrl, "_blank", "noopener,noreferrer");
            }}
          >
            Envoyer sur WhatsApp
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
