import { NextRequest, NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getSiteContext } from "@/lib/site-context";
import { listCollections, getCollectionMeta, getCollectionProductCount } from "@/lib/shopify";
import { computeTaxonomyAudit } from "@/lib/taxonomy/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST: sync les collections Shopify + audit heuristique 7 dimensions.
export async function POST(req: NextRequest, { params }: { params: { siteId: string } }) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const { supabase, shop, token } = await getSiteContext(params.siteId);
    const collections = await listCollections(shop, token);
    const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
    const now = new Date().toISOString();
    const scores: number[] = [];

    for (const c of collections.slice(0, 50)) {
      const [meta, count] = await Promise.all([getCollectionMeta(shop, token, c.id), getCollectionProductCount(shop, token, c.id)]);
      const { score, breakdown } = computeTaxonomyAudit({
        body_html: c.body_html, meta_title: meta.title_tag, meta_description: meta.description_tag, image_url: c.image_url, products_count: count,
      });
      scores.push(score);
      await supabase.from("site_taxonomies").upsert(
        {
          site_id: params.siteId, platform: "shopify", kind: "collection",
          external_id: String(c.id), handle: c.handle, name: c.title,
          url: `https://${host}/collections/${c.handle}`,
          current_description: c.body_html, current_meta_title: meta.title_tag, current_meta_description: meta.description_tag,
          current_image_url: c.image_url, products_count: count,
          quality_score: score, quality_breakdown: breakdown, audit_at: now,
          generation_metadata: { kind: c.kind }, updated_at: now,
        },
        { onConflict: "site_id,platform,kind,external_id" }
      );
    }

    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return NextResponse.json({ ok: true, fetched: collections.length, summary: { avg, min: Math.min(...scores, 0), max: Math.max(...scores, 0) } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
