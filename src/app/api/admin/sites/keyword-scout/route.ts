import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { keywordScout } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  site_id: z.string().uuid(),
  niche: z.string().min(2),
  count: z.number().int().min(1).max(200).optional(),
  enqueue: z.boolean().optional(),
});

// Genere des mots-cles de niche. Si enqueue=true, empile les jobs generate_article.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = getServiceClient();
  const { data: site } = await supabase
    .from("sites")
    .select("voice_profile")
    .eq("id", parsed.data.site_id)
    .single();
  const lang = site?.voice_profile?.content_language || "francais";
  const count = parsed.data.count ?? 30;

  let keywords: string[];
  try {
    keywords = await keywordScout(parsed.data.niche, count, lang);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "scout_failed" }, { status: 500 });
  }

  let enqueued = 0;
  if (parsed.data.enqueue && keywords.length) {
    const rows = keywords.map((kw, i) => ({
      site_id: parsed.data.site_id,
      kind: "generate_article",
      status: "pending",
      keyword: kw,
      priority: 10 + i,
    }));
    const { data } = await supabase.from("site_jobs").insert(rows).select("id");
    enqueued = data?.length || 0;
  }

  return NextResponse.json({ keywords, enqueued });
}
