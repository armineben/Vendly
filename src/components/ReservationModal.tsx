import { useState } from "react";
import { X, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";

interface CartItem {
  id: string;
  variante_id: string;
  designation: string;
  prix_vente: number;
  quantite_selectionnee: number;
  taille_selectionnee?: string;
  couleur_selectionnee?: string;
  image?: string;
}

interface ReservationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    nom: string;
    prenom: string;
    telephone: string;
    delayType: "le_jour_meme" | "24h" | "48h" | "72h";
    heurePassage?: string;
    expiresAt: Date;
  }) => void;
  items: CartItem[];
  total: number;
  isSubmitting?: boolean;
}

const DELAY_OPTIONS = [
  { value: "le_jour_meme" as const, label: "Le jour même", icon: Calendar },
  { value: "24h" as const, label: "24 heures", icon: Clock },
  { value: "48h" as const, label: "48 heures", icon: Clock },
  { value: "72h" as const, label: "72 heures", icon: Clock },
];

export function ReservationModal({
  open,
  onClose,
  onConfirm,
  items,
  total,
  isSubmitting,
}: ReservationModalProps) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [delayType, setDelayType] = useState<"le_jour_meme" | "24h" | "48h" | "72h">("24h");
  const [heurePassage, setHeurePassage] = useState("");

  if (!open) return null;

  function calcExpiresAt(): Date {
    const now = new Date();
    if (delayType === "le_jour_meme") {
      if (heurePassage) {
        const [h, m] = heurePassage.split(":").map(Number);
        const exp = new Date(now);
        exp.setHours(h, m, 0, 0);
        if (exp <= now) exp.setDate(exp.getDate() + 1);
        return exp;
      }
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    }
    const heures = delayType === "24h" ? 24 : delayType === "48h" ? 48 : 72;
    return new Date(now.getTime() + heures * 60 * 60 * 1000);
  }

  function handleSubmit() {
    if (!nom.trim() || !prenom.trim() || !telephone.trim()) return;
    if (delayType === "le_jour_meme" && !heurePassage) return;
    onConfirm({
      nom: nom.trim(),
      prenom: prenom.trim(),
      telephone: telephone.trim(),
      delayType,
      heurePassage: delayType === "le_jour_meme" ? heurePassage : undefined,
      expiresAt: calcExpiresAt(),
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative z-[10000] w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl bg-white p-6 shadow-xl duration-150 max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-black transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-5">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Réservation en boutique</h3>
          <p className="text-sm text-gray-500 mt-1">
            Les articles seront bloqués pour le client.
          </p>
        </div>

        {/* Client info */}
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Prénom *</Label>
              <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" className="rounded-none" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nom *</Label>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="rounded-none" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Téléphone *</Label>
            <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Numéro de téléphone" className="rounded-none" />
          </div>

          {/* Delay selection */}
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Délai de réservation</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {DELAY_OPTIONS.map((opt) => {
                const active = delayType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDelayType(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 border text-xs font-medium rounded-lg transition-all ${
                      active
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <opt.icon className={`h-3.5 w-3.5 ${active ? "text-amber-600" : "text-gray-400"}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour picker for "Le jour même" */}
          {delayType === "le_jour_meme" && (
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Heure de passage *</Label>
              <Input type="time" value={heurePassage} onChange={(e) => setHeurePassage(e.target.value)} className="rounded-none" />
            </div>
          )}

          {/* Items summary */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Articles</p>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                {item.image && <img src={item.image} alt="" className="w-8 h-10 object-cover rounded" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.designation}</p>
                  <p className="text-[10px] text-gray-500">
                    {item.taille_selectionnee && `T: ${item.taille_selectionnee}`}
                    {item.taille_selectionnee && item.couleur_selectionnee && " | "}
                    {item.couleur_selectionnee && `C: ${item.couleur_selectionnee}`}
                    {' '}x{item.quantite_selectionnee}
                  </p>
                </div>
                <span className="text-xs font-medium">{formatCurrency(item.prix_vente * item.quantite_selectionnee)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1 rounded-lg">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !nom.trim() || !prenom.trim() || !telephone.trim() || (delayType === "le_jour_meme" && !heurePassage)}
            className="flex-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
          >
            {isSubmitting ? "Réservation..." : "Confirmer la réservation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
