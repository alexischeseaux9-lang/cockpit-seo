import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: injection blog. Empile des articles pour les requetes SCRO selectionnees,
// soit explicitement (ids), soit auto (position >= min_position et pas deja enqueue).
const schema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  min_position: z.number().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  let q = supabase.from("site_scro").select("id, query").eq("site_id", params.siteId).eq("enqueued", false);
  if (parsed.data.ids?.length) {
    q = q.in("id", parsed.data.ids);
  } else {
    const minPos = parsed.data.min_position ?? 8; // par defaut: requetes mal classees (position >= 8)
    q = q.gte("position", minPos).order("impressions", { ascending: false }).limit(parsed.data.limit ?? 20);
  }
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ enqueued: 0 });

  const jobs = rows.map((r, i) => ({
    site_id: params.siteId,
    kind: "generate_article",
    status: "pending",
    keyword: r.query,
    priority: 3 + i, // priorite haute: ce sont des opportunites identifiees
  }));
  const { data: inserted } = await supabase.from("site_jobs").insert(jobs).select("id");
  await supabase
    .from("site_scro")
    .update({ enqueued: true })
    .in("id", rows.map((r) => r.id));

  return NextResponse.json({ enqueued: inserted?.length || 0 });
}
