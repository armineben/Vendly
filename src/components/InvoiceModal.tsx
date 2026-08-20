import { useRef } from "react";
import { X, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";

interface InvoiceItem {
  designation: string;
  quantite_selectionnee: number;
  prix_vente: number;
  taille_selectionnee?: string;
  couleur_selectionnee?: string;
}

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  data: {
    invoiceNumber: string;
    createdAt: string;
    vendeurNom?: string;
    paymentMethod: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: InvoiceItem[];
    subtotal: number;
    discountPercent?: number;
    discountCode?: string;
    shippingFees?: number;
    total: number;
    isDelivery?: boolean;
  } | null;
}

export function InvoiceModal({ open, onClose, data }: InvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !data) return null;

  const discountAmount = data.discountPercent ? (data.subtotal * data.discountPercent) / 100 : 0;

  function handlePrint() {
    const d = data!;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { window.print(); return; }
    const content = printRef.current?.innerHTML || "";
    printWindow.document.write(`
      <html>
      <head>
        <title>Facture ${d.invoiceNumber}</title>
        <style>
          @page { margin: 10mm; size: 80mm auto; }
          body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; margin: 0; padding: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 4px 2px; text-align: left; font-size: 10px; }
          th { border-bottom: 1px dashed #000; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .border-t { border-top: 1px dashed #000; }
          .border-b { border-bottom: 1px dashed #000; }
          .font-bold { font-weight: bold; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mb-2 { margin-bottom: 8px; }
          .pt-2 { padding-top: 8px; }
          .pb-2 { padding-bottom: 8px; }
          .text-xs { font-size: 9px; }
          .text-sm { font-size: 10px; }
          .text-lg { font-size: 14px; }
          .tracking-widest { letter-spacing: 2px; }
          .leading-relaxed { line-height: 1.5; }
          hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative z-[10000] w-full max-w-lg animate-in fade-in zoom-in-95 rounded-xl bg-white shadow-xl duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-bold tracking-wider uppercase">Facture</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-black transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Invoice content - print area */}
        <div className="flex-1 overflow-y-auto p-5" ref={printRef}>
          {/* Store header */}
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold tracking-[0.3em] uppercase">VENDLY</h1>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Avenue de la Liberté, Tunis<br />
              Tél : +216 XX XXX XXX<br />
              Matricule : 1234567 X / A / M / 000
            </p>
          </div>

          <hr className="my-3 border-dashed" />

          {/* Invoice meta */}
          <table className="w-full text-xs mb-3">
            <tbody>
              <tr><td className="text-gray-500 pr-2 w-24">N° Facture</td><td className="font-bold">{data.invoiceNumber}</td></tr>
              <tr><td className="text-gray-500 pr-2">Date</td><td>{formatDateTime(data.createdAt)}</td></tr>
              {data.vendeurNom && <tr><td className="text-gray-500 pr-2">Vendeur</td><td>{data.vendeurNom}</td></tr>}
              <tr><td className="text-gray-500 pr-2">Paiement</td><td>{data.paymentMethod}</td></tr>
            </tbody>
          </table>

          {/* Customer */}
          <div className="text-xs mb-3 p-2 bg-gray-50 rounded">
            <span className="text-gray-500">Client : </span>
            <span className="font-bold">{data.customerName || "Client Passage"}</span>
            {data.customerPhone && <span className="block text-gray-500">Tél : {data.customerPhone}</span>}
            {data.isDelivery && data.customerAddress && <span className="block text-gray-500">Adresse : {data.customerAddress}</span>}
          </div>

          <hr className="my-3 border-dashed" />

          {/* Items table */}
          <table className="w-full text-xs mb-3">
            <thead>
              <tr className="border-b border-dashed border-gray-400">
                <th className="text-left pb-1">Article</th>
                <th className="text-center pb-1">Qté</th>
                <th className="text-right pb-1">P.U.</th>
                <th className="text-right pb-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-1">
                    <span>{item.designation}</span>
                    {(item.taille_selectionnee || item.couleur_selectionnee) && (
                      <span className="text-gray-400 block text-[9px]">
                        {item.taille_selectionnee && `T: ${item.taille_selectionnee}`}
                        {item.taille_selectionnee && item.couleur_selectionnee && " | "}
                        {item.couleur_selectionnee && `C: ${item.couleur_selectionnee}`}
                      </span>
                    )}
                  </td>
                  <td className="text-center py-1">{item.quantite_selectionnee}</td>
                  <td className="text-right py-1">{formatCurrency(item.prix_vente)}</td>
                  <td className="text-right py-1 font-medium">{formatCurrency(item.prix_vente * item.quantite_selectionnee)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="my-3 border-dashed" />

          {/* Totals */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Sous-total</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Remise {data.discountCode ? `(${data.discountCode})` : ""}</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {data.shippingFees && data.shippingFees > 0 && (
              <div className="flex justify-between">
                <span>Frais de livraison</span>
                <span>{formatCurrency(data.shippingFees)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-dashed border-gray-400">
              <span>TOTAL NET À PAYER</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
          </div>

          <hr className="my-4 border-dashed" />

          {/* Footer */}
          <div className="text-center text-[9px] text-gray-500 leading-relaxed">
            <p className="font-bold text-xs text-black mb-1">MERCI DE VOTRE VISITE</p>
            <p>Politique d'échange : 7 jours</p>
            <p>sur présentation du ticket de caisse.</p>
            <p className="mt-2">Vendly — Votre boutique de confiance</p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 px-5 py-3 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-lg">
            Fermer
          </Button>
          <Button onClick={handlePrint} className="flex-1 rounded-lg bg-black text-white hover:bg-gray-800">
            <Printer className="h-4 w-4 mr-2" /> Imprimer la facture
          </Button>
        </div>
      </div>
    </div>
  );
}
