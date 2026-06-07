// Sparkline SVG pure (pas de lib). Affiche les publications par jour sur 14j.
export function Sparkline({ data, width = 120, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data);
  const step = width / (data.length - 1 || 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400" />
    </svg>
  );
}
