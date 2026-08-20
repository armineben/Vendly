export const fmt = new Intl.NumberFormat("fr-TN", { // Changé pour fr-TN (Tunisie)
  style: "currency",
  currency: "TND",
  minimumFractionDigits: 3, // Forcer 3 décimales pour les millimes
  maximumFractionDigits: 3,
});

export const formatCurrency = (n: number | null | undefined) =>
  fmt.format(Number(n ?? 0));

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const formatDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function resolveImage(image: string | null | undefined): string | null {
  if (!image) return null;
  const trimmed = image.trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:|\/)/.test(trimmed)) return trimmed;
  return `/images/${trimmed}`;
}
