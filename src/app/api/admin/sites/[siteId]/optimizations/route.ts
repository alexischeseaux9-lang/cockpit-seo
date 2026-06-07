import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: log filtrable + compteurs par kind.
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("target_id");
  const kind = searchParams.get("kind");
  const targetType = searchParams.get("target_type");

  const supabase = getServiceClient();
  let q = supabase
    .from("site_optimizations")
    .select("*")
    .eq("site_id", params.siteId)
    .order("done_at", { ascending: false })
    .limit(200);
  if (targetId) q = q.eq("target_id", targetId);
  if (kind) q = q.eq("kind", kind);
  if (targetType) q = q.eq("target_type", targetType);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // compteurs par kind (sur tout le site)
  const { data: all } = await supabase.from("site_optimizations").select("kind").eq("site_id", params.siteId);
  const counters: Record<string, number> = {};
  for (const r of all || []) counters[r.kind] = (counters[r.kind] || 0) + 1;

  return NextResponse.json({ ok: true, optimizations: data || [], counters, total: (all || []).length });
}

// POST: ajout manuel (1 ou plusieurs).
const optimSchema = z.object({
  kind: z.string().min(1),
  target_type: z.string().min(1),
  target_id: z.string().nullable().optional(),
  target_title: z.string().nullable().optional(),
  target_url: z.string().nullable().optional(),
  before_value: z.string().max(20000).nullable().optional(),
  after_value: z.string().max(20000).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  source: z.enum(["manual", "ai", "system"]).optional(),
});
const bodySchema = z.object({
  optimization: optimSchema.optional(),
  optimizations: z.array(optimSchema).max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const items = parsed.data.optimizations || (parsed.data.optimization ? [parsed.data.optimization] : []);
  if (!items.length) return NextResponse.json({ error: "no_items" }, { status: 400 });

  const rows = items.map((o) => ({ ...o, site_id: params.siteId, source: o.source || "manual", done_at: new Date().toISOString() }));
  const supabase = getServiceClient();
  const { data, error } = await supabase.from("site_optimizations").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: data?.length || 0 });
}

export async function DELETE(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from("site_optimizations").delete().eq("site_id", params.siteId).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
