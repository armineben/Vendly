export interface CategoryItem {
  label: string;
  value: string;
}

export interface CategoryGroup {
  title: string;
  color: string;
  items: CategoryItem[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    title: "FEMME",
    color: "#f43f5e",
    items: [
      { label: "Robe", value: "Femme - Robe" },
      { label: "Lingerie", value: "Femme - Lingerie" },
      { label: "Haut", value: "Femme - Haut" },
      { label: "Bas", value: "Femme - Bas" },
      { label: "Accessoires", value: "Femme - Accessoires" },
      { label: "Sac", value: "Femme - Sac" },
      { label: "Parfum", value: "Femme - Parfum" },
      { label: "Montre", value: "Femme - Montre" },
      { label: "Chaussures", value: "Femme - Chaussures" },
    ],
  },
  {
    title: "HOMME",
    color: "#3b82f6",
    items: [
      { label: "Chemise", value: "Homme - Chemise" },
      { label: "Pantalon", value: "Homme - Pantalon" },
      { label: "T-shirt", value: "Homme - T-shirt" },
      { label: "Short", value: "Homme - Short" },
      { label: "Pyjama", value: "Homme - Pyjama" },
      { label: "Sous-vêtement", value: "Homme - Sous-vêtement" },
      { label: "Accessoires", value: "Homme - Accessoires" },
      { label: "Sac", value: "Homme - Sac" },
      { label: "Parfum", value: "Homme - Parfum" },
      { label: "Montre", value: "Homme - Montre" },
      { label: "Chaussures", value: "Homme - Chaussures" },
    ],
  },
  {
    title: "ENFANTS",
    color: "#22c55e",
    items: [
      { label: "Garçon", value: "Enfant - Garçon" },
      { label: "Fille", value: "Enfant - Fille" },
      { label: "Bébé Garçon", value: "Bébé - Garçon" },
      { label: "Bébé Fille", value: "Bébé - Fille" },
      { label: "Accessoires", value: "Enfant - Accessoires" },
    ],
  },
];

export function getAllCategoryValues(): string[] {
  return CATEGORY_GROUPS.flatMap((g) => g.items.map((i) => i.value));
}

export function getCategoryLabel(value: string): string {
  for (const group of CATEGORY_GROUPS) {
    for (const item of group.items) {
      if (item.value === value) return item.label;
    }
  }
  return value;
}

export function findGroupForCategory(value: string): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((g) => g.items.some((i) => i.value === value));
}

// Normalisation : minuscules, suppression des accents, "&" → " et ", ponctuation → espace
function normalizeCategory(s: string | null | undefined): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Familles génériques → suffixes de catégorie DB acceptés (normalisés)
const FAMILY_SUFFIXES: Record<string, string[]> = {
  vetements: [
    "robe",
    "robes",
    "lingerie",
    "haut",
    "hauts",
    "bas",
    "chemise",
    "chemises",
    "pantalon",
    "pantalons",
    "t-shirt",
    "t shirts",
    "t shirt",
    "short",
    "shorts",
    "pyjama",
    "pyjamas",
    "sous-vetement",
    "sous-vetements",
    "garcon",
    "garcons",
    "fille",
    "filles",
    "costume",
    "costumes",
    "manteau",
    "manteaux",
    "veste",
    "vestes",
    "jupe",
    "jupes",
    "pull",
    "pulls",
    "sweat",
    "sweats",
    "gilet",
    "gilets",
    "legging",
    "leggings",
  ],
  chaussures: [
    "chaussures",
    "chaussure",
    "escarpins",
    "escarpin",
    "baskets",
    "basket",
    "bottes",
    "botte",
    "sandales",
    "sandale",
    "souliers",
    "soulier",
    "mocassins",
    "mocassin",
    "talons",
    "talon",
    "sneakers",
  ],
  accessoires: [
    "accessoires",
    "accessoire",
    "bijoux",
    "bijou",
    "ceintures",
    "ceinture",
    "echarpes",
    "echarpe",
    "foulards",
    "foulard",
    "lunettes",
    "cravates",
    "cravate",
    "chapeaux",
    "gants",
    "etoles",
    "etole",
    "sac",
    "sacs",
    "sac a main",
    "sac a dos",
    "pochette",
    "pochettes",
  ],
  sacs: ["sac", "sacs", "sac a main", "sac a dos", "pochette", "pochettes"],
  montres: ["montre", "montres"],
  parfums: ["parfum", "parfums", "eau de toilette", "eau de parfum"],
};

// Sous-catégories du mega-menu / menu latéral → suffixes DB acceptés
const SUBCATEGORY_MAP: Record<string, string[]> = {
  robes: ["robe", "robes"],
  "tops et chemisiers": [
    "haut",
    "hauts",
    "top",
    "tops",
    "chemisier",
    "chemisiers",
    "lingerie",
  ],
  pantalons: ["pantalon", "pantalons", "bas", "jean", "jeans", "jogging"],
  jupes: ["jupe", "jupes", "bas"],
  "manteaux et vestes": [
    "manteau",
    "manteaux",
    "veste",
    "vestes",
    "blazer",
    "blazers",
    "costume",
    "costumes",
  ],
  escarpins: ["escarpin", "escarpins", "chaussures", "talon", "talons"],
  baskets: ["basket", "baskets", "chaussures", "sneakers"],
  bottes: ["botte", "bottes", "chaussures"],
  sandales: ["sandale", "sandales", "chaussures", "espadrilles"],
  souliers: ["soulier", "souliers", "chaussures"],
  mocassins: ["mocassin", "mocassins", "chaussures"],
  sacs: ["sac", "sacs", "sac a main", "sac a dos", "pochette", "pochettes"],
  bijoux: ["bijoux", "bijou", "accessoires", "accessoire"],
  ceintures: ["ceinture", "ceintures", "accessoires", "accessoire"],
  "echarpes et foulards": [
    "echarpe",
    "echarpes",
    "foulard",
    "foulards",
    "accessoires",
    "accessoire",
  ],
  montre: ["montre", "montres"],
  montres: ["montre", "montres"],
  parfum: ["parfum", "parfums", "eau de toilette", "eau de parfum"],
  parfums: ["parfum", "parfums", "eau de toilette", "eau de parfum"],
  "parfum homme": ["parfum", "parfums"],
  "parfum femme": ["parfum", "parfums"],
  chemises: ["chemise", "chemises"],
  "t-shirts": ["t-shirt", "t shirts", "t shirt", "tee shirt"],
  costumes: ["costume", "costumes", "blazer", "blazers"],
  manteaux: ["manteau", "manteaux", "veste", "vestes", "blazer", "blazers"],
  lunettes: ["lunettes", "accessoires", "accessoire"],
  cravates: ["cravate", "cravates", "accessoires", "accessoire"],
  garcon: ["garcon", "garcons"],
  fille: ["fille", "filles"],
  "bebe garcon": ["garcon", "garcons"],
  "bebe fille": ["fille", "filles"],
  vetements: FAMILY_SUFFIXES.vetements,
  chaussures: FAMILY_SUFFIXES.chaussures,
  accessoires: FAMILY_SUFFIXES.accessoires,
};

/**
 * Vérifie si un article correspond aux filtres genre + sous-catégorie.
 *
 * Le terme "genre" désigne l'onglet principal ("Mode Femme", "Mode Homme",
 * "Mode Enfant", "Montres", "Parfums", "Accessoires") et la sous-catégorie
 * est le libellé du menu ("Robes", "Tops & Chemisiers", "Baskets", ...).
 *
 * La comparaison est insensible à la casse, aux accents et tolère les
 * pluriels, avec un mapping précis libellés-modèle → valeurs DB.
 */
export function categoryMatchesFilter(
  categorie: string | null,
  genre: string | null,
  subCategory: string | null,
): boolean {
  if (!genre && !subCategory) return true;

  const raw = String(categorie || "").toLowerCase();
  const segments = raw
    .split(/(?:\s+[-–—]|[-–—]\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const prefix = segments.length > 1 ? normalizeCategory(segments[0]) : "";
  const suffix = normalizeCategory(
    segments.length > 1 ? segments[segments.length - 1] : raw,
  );
  const cat = normalizeCategory(raw);

  const g = normalizeCategory((genre || "").replace(/^mode\s+/i, ""));

  // ---- Filtre genre (onglet principal) ----
  if (genre) {
    const isFemme = prefix.startsWith("femme") || cat.startsWith("femme");
    const isHomme = prefix.startsWith("homme") || cat.startsWith("homme");
    const isEnfant =
      prefix.startsWith("enfant") ||
      prefix.startsWith("bebe") ||
      cat.startsWith("enfant") ||
      cat.startsWith("bebe");

    if (g.startsWith("femme") && !isFemme) return false;
    if (g.startsWith("homme") && !isHomme) return false;
    if ((g === "enfant" || g === "enfants") && !isEnfant) return false;

    // Genres "métiers" (pas de préfixe obligatoire) : filtre direct par famille
    const meta =
      g.startsWith("parfum") ||
      g.startsWith("montre") ||
      g.startsWith("accessoire");
    if (meta && !subCategory) {
      if (g.startsWith("parfum"))
        return FAMILY_SUFFIXES.parfums.some(
          (a) => normalizeCategory(a) === suffix,
        );
      if (g.startsWith("montre"))
        return FAMILY_SUFFIXES.montres.some(
          (a) => normalizeCategory(a) === suffix,
        );
      if (g.startsWith("accessoire"))
        return (
          FAMILY_SUFFIXES.accessoires.some(
            (a) => normalizeCategory(a) === suffix,
          ) || FAMILY_SUFFIXES.sacs.some((a) => normalizeCategory(a) === suffix)
        );
    }
  }

  // ---- Filtre par sous-catégorie ----
  if (subCategory) {
    const target = normalizeCategory(subCategory);

    // Correspondance directe avec la valeur DB complète
    if (target === cat) return true;

    // Sous-catégories qui imposent un préfixe précis
    if (target === "parfum homme")
      return (
        (prefix.startsWith("homme") || cat.startsWith("homme")) &&
        FAMILY_SUFFIXES.parfums.some((a) => normalizeCategory(a) === suffix)
      );
    if (target === "parfum femme")
      return (
        (prefix.startsWith("femme") || cat.startsWith("femme")) &&
        FAMILY_SUFFIXES.parfums.some((a) => normalizeCategory(a) === suffix)
      );
    if (target === "bebe garcon")
      return (
        (prefix.startsWith("bebe") || cat.startsWith("bebe")) &&
        suffix.includes("garcon")
      );
    if (target === "bebe fille")
      return (
        (prefix.startsWith("bebe") || cat.startsWith("bebe")) &&
        suffix.includes("fille")
      );

    const accepted = SUBCATEGORY_MAP[target];
    if (accepted) {
      return accepted.some((a) => normalizeCategory(a) === suffix);
    }

    // Repli : correspondance plurielle / partielle
    const targetSingular = target.replace(/s$/, "");
    const suffixSingular = suffix.replace(/s$/, "");
    return (
      suffixSingular === targetSingular ||
      suffix.includes(target) ||
      target.includes(suffix)
    );
  }

  return true;
}
