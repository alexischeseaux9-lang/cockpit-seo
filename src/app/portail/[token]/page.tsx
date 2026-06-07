import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portail public en lecture seule. Le token EST l'autorisation. Aucune action possible.
export default async function PortailPage({ params }: { params: { token: string } }) {
  const supabase = getServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, name, url")
    .eq("client_view_token", params.token)
    .maybeSingle();

  if (!site) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Lien invalide.
      </main>
    );
  }

  const { data: optimizations } = await supabase
    .from("site_optimizations")
    .select("kind, target_type, target_title, target_url, note, done_at")
    .eq("site_id", site.id)
    .order("done_at", { ascending: false })
    .limit(100);

  const { count: published } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("published", true);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Rapport de travail</p>
        <h1 className="mb-1 text-2xl font-semibold">{site.name}</h1>
        <p className="mb-8 text-sm text-zinc-500">{site.url} · {published || 0} articles publies</p>

        <div className="space-y-2">
          {(optimizations || []).length === 0 && <p className="text-sm text-zinc-500">Aucune activite pour le moment.</p>}
          {(optimizations || []).map((o, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-200">{o.target_title || o.kind}</span>
                <span className="text-xs text-zinc-500">{new Date(o.done_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-zinc-500">{o.kind} · {o.target_type}{o.note ? ` · ${o.note}` : ""}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
