import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: jobs du site (ordre priorite decroissante, puis FIFO) + compteurs par statut.
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("site_jobs")
    .select("id, kind, status, keyword, brief, target_title, priority, error, output, created_at, completed_at")
    .eq("site_id", params.siteId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const statuses = ["pending", "in_progress", "done", "error"] as const;
  const counts: Record<string, number> = { pending: 0, in_progress: 0, done: 0, error: 0 };
  await Promise.all(
    statuses.map(async (st) => {
      const { count } = await supabase
        .from("site_jobs")
        .select("id", { count: "exact", head: true })
        .eq("site_id", params.siteId)
        .eq("status", st);
      counts[st] = count || 0;
    }),
  );

  return NextResponse.json({ jobs: data, counts });
}

// DELETE: supprime un job de la roadmap (?id=...)
export async function DELETE(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from("site_jobs").delete().eq("id", id).eq("site_id", params.siteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const itemSchema = z.object({
  keyword: z.string().min(1),
  brief: z.string().nullable().optional(),
  priority: z.number().int().optional(),
  target_blog_hint: z.string().nullable().optional(),
});
const enqueueSchema = z.object({
  // Trois formes : mots-cles simples, items riches (Roadmap bulk), ou un update_article (Blog).
  keywords: z.array(z.string().min(1)).optional(),
  items: z.array(itemSchema).optional(),
  priority: z.number().int().optional(),
  update: z
    .object({ target_external_id: z.string().min(1), target_title: z.string().optional() })
    .optional(),
});

// POST: empile des jobs (generate_article simple/bulk, ou update_article depuis Blog)
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = enqueueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Forme update_article (un article a rafraichir, empile dans la file)
  if (parsed.data.update) {
    const supabase = getServiceClient();
    const { target_external_id, target_title } = parsed.data.update;
    // Evite les doublons en file pour le meme article.
    const { data: existing } = await supabase
      .from("site_jobs")
      .select("id")
      .eq("site_id", params.siteId)
      .eq("kind", "update_article")
      .eq("target_external_id", target_external_id)
      .in("status", ["pending", "in_progress"])
      .maybeSingle();
    if (existing) return NextResponse.json({ enqueued: 0, already_queued: true, id: existing.id });
    const { data, error } = await supabase
      .from("site_jobs")
      .insert({
        site_id: params.siteId,
        kind: "update_article",
        status: "pending",
        target_external_id,
        target_title: target_title ?? null,
        priority: 8,
      })
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ enqueued: 1, id: data?.id });
  }
  const items: { keyword: string; brief?: string | null; priority?: number; target_blog_hint?: string | null }[] =
    parsed.data.items && parsed.data.items.length
      ? parsed.data.items
      : (parsed.data.keywords || []).map((k) => ({ keyword: k }));
  if (!items.length) return NextResponse.json({ error: "no_keywords" }, { status: 400 });

  const supabase = getServiceClient();
  const rows = items.map((it, i) => ({
    site_id: params.siteId,
    kind: "generate_article",
    status: "pending",
    keyword: it.keyword,
    brief: it.brief ?? null,
    target_blog_hint: it.target_blog_hint ?? null,
    priority: it.priority ?? parsed.data.priority ?? 5 + i,
  }));
  const { data, error } = await supabase.from("site_jobs").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enqueued: data?.length || 0 });
}
