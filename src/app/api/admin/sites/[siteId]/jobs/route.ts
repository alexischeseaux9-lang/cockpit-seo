import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: liste des jobs du site (recents d'abord)
export async function GET(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("site_jobs")
    .select("id, kind, status, keyword, priority, error, output, created_at, completed_at")
    .eq("site_id", params.siteId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}

const enqueueSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  priority: z.number().int().optional(),
});

// POST: empile des jobs generate_article (1 par mot-cle)
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = enqueueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supabase = getServiceClient();
  const rows = parsed.data.keywords.map((kw, i) => ({
    site_id: params.siteId,
    kind: "generate_article",
    status: "pending",
    keyword: kw,
    priority: parsed.data.priority ?? 5 + i,
  }));
  const { data, error } = await supabase.from("site_jobs").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enqueued: data?.length || 0 });
}
