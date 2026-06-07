import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { discoverSite } from "@/lib/onboarding/site-discovery";
import { discoverProfile } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  url: z.string().min(1),
  platform: z.enum(["shopify", "wordpress", "github_mdx"]).optional(),
});

// Etape 1 du wizard: scrape + draft voice_profile, persiste un onboarding_run.
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  let meta;
  try {
    meta = await discoverSite(parsed.data.url);
  } catch {
    return NextResponse.json({ error: "scrape_failed" }, { status: 422 });
  }
  if (meta.text.length < 80) return NextResponse.json({ error: "scrape_empty" }, { status: 422 });

  try {
    const ctx = `${meta.title}\n${meta.description}\n${meta.h1 || ""}\n${meta.about_excerpt || ""}\n${meta.paragraphs.join(" ")}\n${meta.text}`;
    const result = await discoverProfile(meta.url, ctx);
    // langue detectee prioritaire si le draft ne l'a pas
    if (!result.voice_profile.content_language && meta.language) {
      result.voice_profile.content_language = meta.language === "fr" ? "francais" : meta.language === "en" ? "anglais" : meta.language;
    }
    const supabase = getServiceClient();
    const { data: run } = await supabase
      .from("onboarding_runs")
      .insert({
        url: meta.url,
        platform: parsed.data.platform || meta.inferred_platform || "shopify",
        discovery: meta,
        draft_voice_profile: result.voice_profile,
        voice_profile: result.voice_profile,
        site_meta: { title: meta.title, description: meta.description, og_image: meta.og_image, keyword_pillars: result.keyword_pillars, inferred_platform: meta.inferred_platform, language: meta.language },
        status: "reviewing",
      })
      .select("id")
      .single();

    return NextResponse.json({
      run_id: run?.id,
      draft_voice_profile: result.voice_profile,
      keyword_pillars: result.keyword_pillars,
      discovery: { language: meta.language, inferred_platform: meta.inferred_platform, title: meta.title, description: meta.description, og_image: meta.og_image, favicon: meta.favicon, paragraphs: meta.paragraphs.length },
      site_meta: { title: meta.title, description: meta.description, og_image: meta.og_image },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "discover_failed" }, { status: 500 });
  }
}
