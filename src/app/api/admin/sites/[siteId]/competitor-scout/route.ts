import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { scrapeCompetitorTopics } from "@/lib/competitors";
import { competitorGapKeywords } from "@/lib/anthropic";
import { getSiteContext } from "@/lib/site-context";
import { getDefaultBlogId, listArticles } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  competitors: z.array(z.string().min(3)).min(1).max(8),
  count: z.number().int().min(5).max(60).optional(),
  enqueue: z.boolean().optional(),
});

// POST: scrape les blogs concurrents, fait curer par Claude (gap niche), renvoie les idees
// (et les empile si enqueue=true).
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: site } = await supabase.from("sites").select("name, url, voice_profile").eq("id", params.siteId).maybeSingle();
  if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  const voice = (site.voice_profile || {}) as Record<string, any>;
  const lang = voice.content_language || "anglais";
  const niche =
    [site.name, voice.audience, voice.tone_description, voice.mascot].filter(Boolean).join(" | ").slice(0, 600) ||
    site.url ||
    site.name;

  // 1. scrape concurrents
  const { topics, perSite } = await scrapeCompetitorTopics(parsed.data.competitors);
  if (!topics.length) {
    return NextResponse.json({ ok: false, error: "no_topics_found", per_site: perSite, ideas: [] });
  }

  // 2. articles existants (dedupe) - best effort si Shopify connecte
  let existing: string[] = [];
  try {
    const ctx = await getSiteContext(params.siteId);
    if (ctx?.shop && ctx?.token) {
      const blogId = await getDefaultBlogId(ctx.shop, ctx.token);
      existing = (await listArticles(ctx.shop, ctx.token, blogId, 100)).map((a) => a.title);
    }
  } catch {
    /* site non connecte ou lecture impossible : on continue sans dedupe live */
  }

  // 3. curation Claude
  let ideas: { keyword: string; brief: string; priority: number }[] = [];
  try {
    ideas = await competitorGapKeywords({ niche, lang, count: parsed.data.count || 30, existingTitles: existing, competitorTopics: topics.slice(0, 200) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "curation_failed", per_site: perSite, ideas: [] }, { status: 500 });
  }

  // 4. enqueue optionnel
  let enqueued = 0;
  if (parsed.data.enqueue && ideas.length) {
    const rows = ideas.map((it, i) => ({
      site_id: params.siteId,
      kind: "generate_article",
      status: "pending",
      keyword: it.keyword,
      brief: it.brief || null,
      priority: it.priority ?? 5 + i,
    }));
    const { data } = await supabase.from("site_jobs").insert(rows).select("id");
    enqueued = data?.length || 0;
  }

  return NextResponse.json({ ok: true, ideas, enqueued, scanned: topics.length, per_site: perSite });
}
