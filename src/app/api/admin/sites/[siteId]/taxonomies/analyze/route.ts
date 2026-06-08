import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext, logChange } from "@/lib/site-context";
import { analyzeCollection } from "@/lib/anthropic";
import { analyzeSerp } from "@/lib/serp";
import { listCollectionsLite, listProductsWithPrice } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({ tax_id: z.string().uuid() });

// POST: genere la version optimisee d'une collection (Claude).
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    const { supabase, shop, token, voice } = await getSiteContext(params.siteId);
    const { data: tax } = await supabase
      .from("site_taxonomies")
      .select("*")
      .eq("id", parsed.data.tax_id)
      .single();
    if (!tax) return NextResponse.json({ error: "taxonomy_not_found" }, { status: 404 });

    // SERP best-effort pour nourrir l'analyse
    const lang = voice.content_language || "francais";
    let serp;
    try { serp = await analyzeSerp(tax.name, lang === "francais" ? "fr" : "us", lang === "francais" ? "fr" : "en"); } catch { serp = undefined; }

    // Cibles de maillage interne REELLES (collections + produits de la boutique), pour eviter
    // les liens inventes vers des collections inexistantes.
    let internalTargets: { name: string; url: string }[] = [];
    try {
      const [cols, prods] = await Promise.all([
        listCollectionsLite(shop, token).catch(() => []),
        listProductsWithPrice(shop, token, 60).catch(() => []),
      ]);
      const colTargets = cols
        .filter((c) => c.handle !== tax.handle && c.handle !== "frontpage" && (c.title || "").trim().toLowerCase() !== "home page")
        .map((c) => ({ name: c.title, url: `/collections/${c.handle}` }));
      const prodTargets = prods.slice(0, 30).map((p) => ({ name: p.title, url: `/products/${p.handle}` }));
      internalTargets = [...colTargets, ...prodTargets];
    } catch { internalTargets = []; }

    const analysis = await analyzeCollection(tax.name, tax.current_description || "", voice, serp, internalTargets);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("site_taxonomies")
      .update({
        intent_class: analysis.intent_class,
        quality_score: analysis.quality_score,
        serp_analysis: serp || null,
        suggested_h1: analysis.suggested_h1,
        suggested_description_html: analysis.suggested_description_html,
        suggested_meta_title: analysis.suggested_meta_title,
        suggested_meta_description: analysis.suggested_meta_description,
        suggested_faq: analysis.suggested_faq || [],
        suggested_internal_links: analysis.suggested_internal_links || [],
        suggested_schema: analysis.suggested_schema || null,
        analyzed_at: now,
        updated_at: now,
      })
      .eq("id", parsed.data.tax_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logChange({
      siteId: params.siteId,
      kind: "collection_optimized_draft",
      target_type: "collection",
      target_id: parsed.data.tax_id,
      target_title: tax.name,
      before_value: tax.current_description || undefined,
      after_value: analysis.suggested_description_html,
      note: "Version optimisee draftee",
      source: "ai",
    });

    return NextResponse.json({ taxonomy: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
