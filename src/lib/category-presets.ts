export type CategoryPreset = {
  match: RegExp;
  tailles: string[];
  couleurs: string[];
};

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    match: /soutien|brassi/i,
    tailles: ["85B", "90B", "95C", "100C"],
    couleurs: ["Noir", "Blanc", "Beige"],
  },
  {
    match: /lingerie|culotte|string|shorty/i,
    tailles: ["S", "M", "L", "XL"],
    couleurs: ["Noir", "Blanc", "Rouge", "Beige"],
  },
  {
    match: /pyjama|nuisette|nuit/i,
    tailles: ["S", "M", "L", "XL", "XXL"],
    couleurs: ["Bleu", "Rose", "Gris", "Blanc"],
  },
  {
    match: /robe|jupe/i,
    tailles: ["36", "38", "40", "42", "44"],
    couleurs: ["Noir", "Blanc", "Rouge"],
  },
];

export function presetFor(categorie: string | null | undefined): CategoryPreset | null {
  if (!categorie) return null;
  return CATEGORY_PRESETS.find((p) => p.match.test(categorie)) ?? null;
}
