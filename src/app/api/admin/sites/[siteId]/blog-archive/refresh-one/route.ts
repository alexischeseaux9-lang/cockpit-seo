import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { runJob } from "@/lib/job-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST: cree un job update_article et le lance immediatement (refresh d'un article).
const schema = z.object({
  shopify_article_id: z.union([z.string(), z.number()]),
  target_title: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: job, error } = await supabase
    .from("site_jobs")
    .insert({
      site_id: params.siteId,
      kind: "update_article",
      status: "pending",
      target_external_id: String(parsed.data.shopify_article_id),
      target_title: parsed.data.target_title || null,
    })
    .select("id")
    .single();
  if (error || !job) return NextResponse.json({ error: error?.message || "insert_failed" }, { status: 500 });

  const res = await runJob(job.id);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
