import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Upload, Download, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { runLowStockCheckAfterImport } from "@/hooks/use-low-stock-alerts";
import { insertNotification } from "@/hooks/use-notifications";
import { CATEGORY_GROUPS, getAllCategoryValues } from "@/lib/categories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const COLUMNS = [
  "Nom_Produit",
  "Reference",
  "Code_Barres",
  "Prix_Achat_DT",
  "Prix_Vente_DT",
  "Categorie",
  "Tailles",
  "Quantites_Par_Taille",
  "Couleurs",
  "Quantite_Totale",
  "Emplacement",
  "Description",
] as const;

const SYSTEM_CATEGORIES: readonly string[] = getAllCategoryValues();

const CATEGORY_ALIASES: Record<string, string> = {
  "femme robe": "Femme - Robe",
  "femme lingerie": "Femme - Lingerie",
  "femme haut": "Femme - Haut",
  "femme bas": "Femme - Bas",
  "femme accessoires": "Femme - Accessoires",
  "femme sac": "Femme - Sac",
  "femme parfum": "Femme - Parfum",
  "femme montre": "Femme - Montre",
  "femme chaussures": "Femme - Chaussures",
  "homme chemise": "Homme - Chemise",
  "homme pantalon": "Homme - Pantalon",
  "homme tshirt": "Homme - T-shirt",
  "homme t-shirt": "Homme - T-shirt",
  "homme accessoires": "Homme - Accessoires",
  "homme sac": "Homme - Sac",
  "homme parfum": "Homme - Parfum",
  "homme montre": "Homme - Montre",
  "homme chaussures": "Homme - Chaussures",
  "enfant garcon": "Enfant - Garçon",
  "enfant fille": "Enfant - Fille",
  "bebe garcon": "Bébé - Garçon",
  "bebe fille": "Bébé - Fille",
  "enfant accessoires": "Enfant - Accessoires",
  "robe": "Femme - Robe",
  "chemise": "Homme - Chemise",
  "pantalon": "Homme - Pantalon",
  "tshirt": "Homme - T-shirt",
  "t-shirt": "Homme - T-shirt",
  "parfum": "Femme - Parfum",
  "montre": "Femme - Montre",
  "chaussures": "Femme - Chaussures",
  "accessoires": "Femme - Accessoires",
  "garcon": "Enfant - Garçon",
  "fille": "Enfant - Fille",
};

function resolveCategory(input: string): string {
  const key = input
    .toLowerCase()
    .replace(/[>\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[key.split(" ").reverse().join(" ")] ?? input;
}

type RawRow = Record<string, any>;

interface ParsedRow {
  index: number;
  raw: RawRow;
  payload: {
    reference: string;
    designation: string;
    taille: string | null;
    quantitesParTaille: string | null;
    couleur: string | null;
    quantite: number;
    prix_vente: number;
    prix_achat: number;
    categorie: string | null;
    emplacement: string | null;
    notes: string | null;
  };
  errors: string[];
}

function parseNum(val: unknown): number {
  if (val === undefined || val === null || val === "") return NaN;
  return Number(String(val).replace(",", "."));
}

function validate(row: RawRow, i: number): ParsedRow {
  const errors: string[] = [];
  const nom = String(row.Nom_Produit ?? "").trim();
  if (!nom) errors.push("Nom_Produit manquant");

  const prixAchat = parseNum(row.Prix_Achat_DT);
  const prixVente = parseNum(row.Prix_Vente_DT);
  const qteTotale = parseNum(row.Quantite_Totale);

  if (isNaN(prixVente) || prixVente < 0)
    errors.push("Prix_Vente_DT invalide");

  const tailles = String(row.Tailles ?? "").trim();
  const qtesParTaille = String(row.Quantites_Par_Taille ?? "").trim();
  if (tailles && !qtesParTaille) errors.push("Quantites_Par_Taille manquante (saisissez les quantités dans le même ordre que les tailles)");
  if (tailles && qtesParTaille) {
    const nTailles = tailles.split(",").length;
    const nQtes = qtesParTaille.split(",").length;
    if (nTailles !== nQtes) errors.push(`Quantites_Par_Taille: ${nQtes} valeur(s) pour ${nTailles} taille(s)`);
  }
  if (!tailles && (isNaN(qteTotale) || !Number.isInteger(qteTotale) || qteTotale < 0))
    errors.push("Quantite_Totale invalide (entier ≥ 0)");

  const ref = String(row.Reference ?? "").trim() ||
    `AUTO-${Date.now().toString(36).slice(-5)}-${i}`;

  const couleurs = String(row.Couleurs ?? "").trim();
  const emplacement = String(row.Emplacement ?? "").trim() || null;
  const desc = String(row.Description ?? "").trim();
  const code = String(row.Code_Barres ?? "").trim();
  const catRaw = String(row.Categorie ?? "").trim();

  const categorie = catRaw ? resolveCategory(catRaw) : null;
  const notes = [code ? `Code-barres: ${code}` : "", desc].filter(Boolean).join("\n") || null;

  return {
    index: i,
    raw: row,
    payload: {
      reference: ref,
      designation: nom,
      taille: tailles || null,
      quantitesParTaille: qtesParTaille || null,
      couleur: couleurs || null,
      quantite: isNaN(qteTotale) ? 0 : qteTotale,
      prix_vente: isNaN(prixVente) ? 0 : prixVente,
      prix_achat: isNaN(prixAchat) ? 0 : prixAchat,
      categorie,
      emplacement,
      notes,
    },
    errors,
  };
}

function parseVariantAxes(
  taille: string | null,
  quantitesParTaille: string | null,
  couleur: string | null,
) {
  const t = taille ? [...new Set(taille.split(",").map((s) => s.trim()).filter(Boolean))] : [];
  const q = quantitesParTaille ? quantitesParTaille.split(",").map((s) => parseInt(s.trim(), 10)) : [];
  const c = couleur ? [...new Set(couleur.split(",").map((s) => s.trim()).filter(Boolean))] : [];
  if (t.length === 0 && c.length === 0) return { tailes: [], couleurs: [], stocks: [] as number[] };
  if (t.length === 0) return { tailes: ["Unique"], couleurs: c, stocks: [0] };
  if (c.length === 0) return { tailes: t, couleurs: ["Unique"], stocks: q };
  return { tailes: t, couleurs: c, stocks: q };
}

export function ImportArticlesDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const importingRef = useRef(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const valid = useMemo(() => rows?.filter((r) => r.errors.length === 0) ?? [], [rows]);
  const invalid = useMemo(() => rows?.filter((r) => r.errors.length > 0) ?? [], [rows]);

  function reset() {
    setRows(null);
    setFileName("");
    setProgress(0);
    setImporting(false);
  }

  async function downloadTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Vendly";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Produits", {
      properties: { tabColor: { argb: "FF2F3E46" } },
    });

    const headers = [
      "Nom_Produit", "Reference", "Code_Barres", "Prix_Achat_DT",
      "Prix_Vente_DT", "Categorie", "Tailles", "Quantites_Par_Taille",
      "Couleurs", "Quantite_Totale", "Emplacement", "Description",
    ];

    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: h === "Description" ? 40 : h === "Quantites_Par_Taille" ? 22 : 18,
    }));

    const headerRow = ws.getRow(1);
    headerRow.height = 30;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F3E46" } };
      cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    const dataRow = ws.getRow(2);
    dataRow.height = 22;
    dataRow.getCell(1).value = "Jean slim homme";
    dataRow.getCell(2).value = "JEAN-001";
    dataRow.getCell(3).value = "6190000000001";
    dataRow.getCell(4).value = 35.0;
    dataRow.getCell(5).value = 89.0;
    dataRow.getCell(6).value = "Homme - Pantalon";
    dataRow.getCell(7).value = "S,M,L,XL";
    dataRow.getCell(8).value = "10,15,8,5";
    dataRow.getCell(9).value = "Noir,Bleu";
    dataRow.getCell(10).value = 38;
    dataRow.getCell(11).value = "Rayon B, Étagère 3";
    dataRow.getCell(12).value = "Jean slim en denim stretch";
    dataRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 10 };
      cell.alignment = { vertical: "middle" };
    });

    for (let r = 3; r <= 100; r++) {
      const row = ws.getRow(r);
      row.height = 22;
      if (r % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F9FA" } };
        });
      }
    }

    const catSheet = workbook.addWorksheet("_categories", { state: "hidden" });
    SYSTEM_CATEGORIES.forEach((cat, i) => {
      catSheet.getCell(i + 1, 1).value = cat;
    });

    for (let r = 2; r <= 100; r++) {
      ws.getCell(r, 6).dataValidation = {
        type: "list",
        formulae: [`'_categories'!$A$1:$A$${SYSTEM_CATEGORIES.length}`],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Catégorie invalide",
        error: "Veuillez choisir une catégorie dans la liste déroulante.",
        showInputMessage: true,
        promptTitle: "Catégorie",
        prompt: "Sélectionnez une catégorie dans la liste.",
      };
    }

    for (let r = 2; r <= 100; r++) {
      ws.getCell(r, 7).dataValidation = {
        type: "textLength",
        operator: "greaterThan",
        formulae: [0],
        allowBlank: true,
        showInputMessage: true,
        promptTitle: "Tailles multiples",
        prompt: "Séparez par une virgule sans espace. Exemple : S,M,L,XL",
        showErrorMessage: false,
      };
    }

    for (let r = 2; r <= 100; r++) {
      ws.getCell(r, 8).dataValidation = {
        type: "textLength",
        operator: "greaterThan",
        formulae: [0],
        allowBlank: true,
        showInputMessage: true,
        promptTitle: "Quantités par taille",
        prompt: "Saisissez les quantités dans le même ordre que les tailles, séparées par une virgule. Exemple si Tailles = S,M,L alors Quantites_Par_Taille = 10,15,5",
        showErrorMessage: false,
      };
    }

    for (let r = 2; r <= 100; r++) {
      ws.getCell(r, 9).dataValidation = {
        type: "textLength",
        operator: "greaterThan",
        formulae: [0],
        allowBlank: true,
        showInputMessage: true,
        promptTitle: "Couleurs multiples",
        prompt: "Séparez par une virgule sans espace. Exemple : Noir,Blanc,Bleu",
        showErrorMessage: false,
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-produits.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
      if (!json.length) {
        toast.error("Le fichier est vide");
        return;
      }
      setRows(json.map((r, i) => validate(r, i)));
    } catch (e: any) {
      toast.error(`Lecture impossible : ${e.message}`);
    }
  }

  async function confirmImport() {
    if (!valid.length || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    setProgress(0);

    const CHUNK = 50;
    let inserted = 0;
    let failed = 0;

    try {
      for (let i = 0; i < valid.length; i += CHUNK) {
        const batch = valid.slice(i, i + CHUNK);

        const { data: articles, error } = await supabase
          .from("articles")
          .insert(
            batch.map((r) => {
              const { tailes, couleurs } = parseVariantAxes(r.payload.taille, r.payload.quantitesParTaille, r.payload.couleur);
              const hasVariants = tailes.length > 0 || couleurs.length > 0;
              return {
                reference: r.payload.reference,
                designation: r.payload.designation,
                taille: r.payload.taille,
                couleur: r.payload.couleur,
                quantite: hasVariants ? 0 : r.payload.quantite,
                prix_vente: r.payload.prix_vente,
                prix_achat: r.payload.prix_achat,
                categorie: r.payload.categorie,
                emplacement: r.payload.emplacement,
                notes: r.payload.notes,
              };
            }),
          )
          .select("id, taille, couleur, quantite");

        if (error) {
          console.error("Erreur d'insertion articles:", error);
          failed += batch.length;
          continue;
        }

        const allVariants: Array<{
          article_id: string;
          taille: string;
          couleur: string;
          stock: number;
          image_url: string | null;
        }> = [];

        for (let aIdx = 0; aIdx < articles.length; aIdx++) {
          const art = articles[aIdx];
          const row = batch[aIdx];
          const { tailes, couleurs, stocks } = parseVariantAxes(art.taille, row.payload.quantitesParTaille, art.couleur);
          if (tailes.length === 0 && couleurs.length === 0) continue;
          for (let tIdx = 0; tIdx < tailes.length; tIdx++) {
            for (const c of couleurs) {
              allVariants.push({
                article_id: art.id,
                taille: tailes[tIdx],
                couleur: c,
                stock: stocks[tIdx] ?? 0,
                image_url: null,
              });
            }
          }
        }

        if (allVariants.length > 0) {
          const { error: errV } = await supabase.from("variantes").insert(allVariants);
          if (errV) console.error("Erreur insertion variantes:", errV);
        }

        inserted += articles.length;
        setProgress(Math.round(((i + batch.length) / valid.length) * 100));
      }

      const importReussi = inserted > 0;
      qc.invalidateQueries({ queryKey: ["raw-articles"] });
      qc.invalidateQueries({ queryKey: ["raw-variantes"] });

      await runLowStockCheckAfterImport(importReussi);

      if (importReussi) {
        insertNotification(`📦 Import Excel : ${inserted} article(s) ajouté(s) avec succès`, "new_article");
      }

      toast.success(`${inserted} produit(s) importé(s) avec succès`);
    } catch (err) {
      toast.error("Une erreur critique est survenue lors de l'import.");
      console.error(err);
    } finally {
      importingRef.current = false;
      setImporting(false);
      reset();
      setTimeout(() => {
        onOpenChange(false);
      }, 100);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Importer depuis Excel
          </DialogTitle>
        </DialogHeader>

        {!rows && (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-6 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Formats acceptés : .xlsx, .csv
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                  <Download className="h-4 w-4" /> Télécharger le modèle
                </Button>
                <Button onClick={() => fileRef.current?.click()} className="gap-2 bg-accent text-accent-foreground hover:bg-accent-hover">
                  <Upload className="h-4 w-4" /> Choisir un fichier
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Colonnes attendues :</p>
              <code className="block rounded bg-secondary p-2">
                {COLUMNS.join(" | ")}
              </code>
            </div>
          </div>
        )}

        {rows && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground truncate">{fileName}</span>
              <div className="flex gap-2">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400">
                  {valid.length} valide(s)
                </span>
                <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive">
                  {invalid.length} erreur(s)
                </span>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-[#c4c7c7] rounded-xl mt-4">
              <Table>
                <TableHeader className="sticky top-0 bg-[#f3f3f4] z-10">
                  <TableRow>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">#</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Nom</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Référence</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Catégorie</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap text-right">Prix Achat</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap text-right">Prix Vente</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Tailles</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Qtés/Taille</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Couleurs</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap text-right">Qté Totale</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap">Emplacement</TableHead>
                    <TableHead className="text-xs font-semibold whitespace-nowrap text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.index} className="hover:bg-[#f9f9f9]">
                      <TableCell className="text-xs text-muted-foreground">{r.index + 1}</TableCell>
                      <TableCell className="text-xs font-medium max-w-[140px] truncate" title={r.payload.designation}>
                        {r.payload.designation || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[90px] truncate" title={r.payload.reference}>
                        {r.payload.reference}
                      </TableCell>
                      <TableCell className="text-xs max-w-[110px] truncate" title={r.payload.categorie ?? ""}>
                        {r.payload.categorie || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right whitespace-nowrap">
                        {r.payload.prix_achat.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-right whitespace-nowrap">
                        {r.payload.prix_vente.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs max-w-[80px] truncate" title={r.payload.taille ?? ""}>
                        {r.payload.taille || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[80px] truncate" title={r.payload.quantitesParTaille ?? ""}>
                        {r.payload.quantitesParTaille || "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[80px] truncate" title={r.payload.couleur ?? ""}>
                        {r.payload.couleur || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right whitespace-nowrap">
                        {r.payload.quantite}
                      </TableCell>
                      <TableCell className="text-xs max-w-[90px] truncate" title={r.payload.emplacement ?? ""}>
                        {r.payload.emplacement || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.errors.length === 0 ? (
                          <CheckCircle2 className="inline-block h-4 w-4 text-emerald-500" />
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-destructive cursor-help text-xs"
                            title={r.errors.join("; ")}
                          >
                            <AlertCircle className="h-4 w-4" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {importing && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">Import en cours… {progress}%</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Annuler
          </Button>
          {rows && (
            <Button
              onClick={confirmImport}
              disabled={importing || valid.length === 0}
              className="bg-accent text-accent-foreground hover:bg-accent-hover"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Import…
                </>
              ) : (
                `Confirmer l'import (${valid.length})`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}