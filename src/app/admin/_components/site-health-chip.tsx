import { CircleDot } from "lucide-react";

const MAP: Record<string, { cls: string; label: string }> = {
  green: { cls: "border-emerald-700 text-emerald-300", label: "OK" },
  yellow: { cls: "border-amber-700 text-amber-300", label: "Attention" },
  red: { cls: "border-red-700 text-red-300", label: "Critique" },
};

export function SiteHealthChip({ level }: { level: string }) {
  const m = MAP[level] || MAP.green;
  return (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${m.cls}`}>
      <CircleDot size={11} /> {m.label}
    </span>
  );
}
