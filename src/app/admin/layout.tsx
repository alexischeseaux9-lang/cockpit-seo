// Pass-through : chaque page admin porte sa propre chrome (header + nav).
// Pas de sidebar persistante (le detail site est plein ecran, cf. screenshots).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--bg)] text-zinc-100">{children}</div>;
}
