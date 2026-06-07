// Helpers de formatage partages (dates, classnames). Aucun em-dash dans les sorties.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function daysSince(iso?: string | null): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
}

export function monthsSince(iso?: string | null): number {
  return daysSince(iso) / 30;
}

// "il y a 3 j", "il y a 5 mois", "a l'instant"
export function relativeTime(iso?: string | null): string {
  if (!iso) return "jamais";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "-";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "a l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const y = Math.round(mo / 12);
  return `il y a ${y} an${y > 1 ? "s" : ""}`;
}

const FR_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const FR_DATETIME = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const FR_WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return FR_DATE.format(d);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return FR_DATETIME.format(d);
}

export function formatWeekday(d: Date): string {
  return FR_WEEKDAY.format(d);
}

export function formatUsd(n?: number | null): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return "$" + v.toFixed(v < 1 ? 3 : 2);
}
