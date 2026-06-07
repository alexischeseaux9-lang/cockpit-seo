import { getServiceClient } from "@/lib/supabase";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portail public en lecture seule. Le token EST l'autorisation.
export default async function PortailPage({ params, searchParams }: { params: { token: string }; searchParams: { kind?: string } }) {
  const supabase = getServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, name, url")
    .eq("client_view_token", params.token)
    .maybeSingle();

  if (!site) {
    return <main className="flex min-h-screen items-center justify-center text-zinc-400">Lien invalide.</main>;
  }

  const kind = searchParams?.kind || "";
  let q = supabase
    .from("site_optimizations")
    .select("kind, target_type, target_title, target_url, note, done_at")
    .eq("site_id", site.id)
    .order("done_at", { ascending: false })
    .limit(200);
  if (kind) q = q.eq("kind", kind);
  const { data: optimizations } = await q;

  const { data: allKinds } = await supabase.from("site_optimizations").select("kind").eq("site_id", site.id);
  const kinds = Array.from(new Set((allKinds || []).map((r) => r.kind)));

  const { count: published } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("published", true);

  return (
    <main className="min-h-screen px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Rapport de travail</p>
        <h1 className="mb-1 mt-1 text-2xl font-semibold tracking-tight">{site.name}</h1>
        <p className="mb-6 text-sm text-zinc-500">{site.url} · {published || 0} articles publies</p>

        <div className="mb-6 flex flex-wrap gap-1.5">
          <Link href={`/portail/${params.token}`} className={!kind ? "inline-flex rounded-full border border-transparent bg-white px-3 py-1 text-xs font-medium text-black" : "inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200"}>Tout</Link>
          {kinds.map((k) => (
            <Link key={k} href={`/portail/${params.token}?kind=${encodeURIComponent(k)}`} className={kind === k ? "inline-flex rounded-full border border-transparent bg-white px-3 py-1 text-xs font-medium text-black" : "inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200"}>{k}</Link>
          ))}
        </div>

        <div className="space-y-2">
          {(optimizations || []).length === 0 && <p className="text-sm text-zinc-500">Aucune activite.</p>}
          {(optimizations || []).map((o, i) => (
            <div key={i} className="card-base p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-zinc-200">{o.target_title || o.kind}</span>
                <span className="shrink-0 text-xs text-zinc-500">{new Date(o.done_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-zinc-500">{o.kind} · {o.target_type}{o.note ? ` · ${o.note}` : ""}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
